import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ActionButton } from "@/components/finance/action-button";
import { FinanceSheet } from "@/components/finance/finance-sheet";
import { StatePanel } from "@/components/finance/state-panel";
import { UI_PREVIEW_ENABLED } from "@/config/runtime";
import { useOffline } from "@/context/offline-context";
import type { TransactionAttachmentContract } from "@/contracts/backend";
import { formatReceiptSize } from "@/features/attachments/file-validation";
import { useAuth } from "@/hooks/use-auth";
import {
  useDeleteTransactionAttachment,
  useRetryTransactionAttachment,
  useTransactionAttachments,
  useUploadTransactionAttachment,
} from "@/hooks/use-attachments";
import { useWorkspace } from "@/hooks/use-workspace";
import { pickReceiptFile } from "@/services/attachments/receipt-file-service";
import { backendErrorMessage } from "@/services/backend/errors";
import {
  createAttachmentSignedUrl,
  type ReceiptUploadProgress,
} from "@/services/supabase/attachment-service";
import type { Transaction } from "@/services/supabase/transaction-service";
import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";

const EMPTY_ATTACHMENTS: TransactionAttachmentContract[] = [];

function statusCopy(attachment: TransactionAttachmentContract) {
  if (attachment.upload_status === "uploaded") return "PRIVATE / READY";
  if (attachment.upload_status === "failed") return "UPLOAD FAILED";
  if (attachment.upload_status === "uploading") return "UPLOAD INTERRUPTED";
  return "AWAITING UPLOAD";
}

export function ReceiptSheet({
  onClose,
  transaction,
  visible,
}: {
  onClose: () => void;
  transaction: Transaction | null;
  visible: boolean;
}) {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const { workspace } = useWorkspace();
  const [progress, setProgress] = useState<ReceiptUploadProgress | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(
    null,
  );

  const canUseRemoteReceipt =
    !!transaction &&
    transaction.sync_state === "synced" &&
    !transaction.id.startsWith("local_") &&
    !transaction.id.startsWith("opt_");
  const attachmentsQuery = useTransactionAttachments(
    workspace?.id ?? "",
    transaction?.id ?? "",
    visible && canUseRemoteReceipt,
  );
  const attachments = attachmentsQuery.data ?? EMPTY_ATTACHMENTS;
  const uploadMutation = useUploadTransactionAttachment();
  const retryMutation = useRetryTransactionAttachment();
  const deleteMutation = useDeleteTransactionAttachment();
  const isBusy =
    uploadMutation.isPending ||
    retryMutation.isPending ||
    deleteMutation.isPending;

  useEffect(() => {
    setActionError(null);
    setProgress(null);
    setActiveAttachmentId(null);
  }, [visible, transaction?.id]);

  const uploadFile = async () => {
    if (!transaction || !workspace || !user?.uid) return;
    if (!isOnline) {
      setActionError(
        "Receipts need a connection. The transaction itself remains available offline.",
      );
      return;
    }
    setActionError(null);
    try {
      const file = await pickReceiptFile();
      if (!file) return;
      await uploadMutation.mutateAsync({
        file,
        onProgress: setProgress,
        ownerUserId: user.uid,
        transaction,
        workspaceId: workspace.id,
      });
      setProgress(null);
    } catch (error) {
      setProgress(null);
      setActionError(
        error instanceof Error ? error.message : backendErrorMessage(error),
      );
    }
  };

  const retryFile = async (attachment: TransactionAttachmentContract) => {
    if (!transaction || !workspace || !user?.uid) return;
    if (!isOnline) {
      setActionError("Reconnect before retrying this private upload.");
      return;
    }
    setActiveAttachmentId(attachment.id);
    setActionError(null);
    try {
      const file = await pickReceiptFile();
      if (!file) return;
      await retryMutation.mutateAsync({
        attachment,
        input: {
          file,
          onProgress: setProgress,
          ownerUserId: user.uid,
          transaction,
          workspaceId: workspace.id,
        },
      });
      setProgress(null);
    } catch (error) {
      setProgress(null);
      setActionError(
        error instanceof Error ? error.message : backendErrorMessage(error),
      );
    } finally {
      setActiveAttachmentId(null);
    }
  };

  const openFile = async (attachment: TransactionAttachmentContract) => {
    if (!isOnline && !UI_PREVIEW_ENABLED) {
      setActionError("Reconnect to create a short-lived private viewing link.");
      return;
    }
    setActiveAttachmentId(attachment.id);
    setActionError(null);
    try {
      if (UI_PREVIEW_ENABLED) {
        Alert.alert(
          "Private receipt preview",
          "A live build opens a short-lived signed URL. Fixture mode keeps this sample offline.",
        );
        return;
      }
      const signedUrl = await createAttachmentSignedUrl(attachment);
      await WebBrowser.openBrowserAsync(signedUrl);
    } catch (error) {
      setActionError(backendErrorMessage(error));
    } finally {
      setActiveAttachmentId(null);
    }
  };

  const removeFile = async (attachment: TransactionAttachmentContract) => {
    setActiveAttachmentId(attachment.id);
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(attachment);
    } catch (error) {
      setActionError(backendErrorMessage(error));
    } finally {
      setActiveAttachmentId(null);
    }
  };

  const confirmRemove = (attachment: TransactionAttachmentContract) => {
    Alert.alert(
      "Delete private receipt?",
      `${attachment.original_filename} will be removed from private storage. The transaction remains in the ledger.`,
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => void removeFile(attachment),
          style: "destructive",
          text: "Delete receipt",
        },
      ],
    );
  };

  return (
    <FinanceSheet
      description={
        transaction
          ? `${transaction.note || "Ledger entry"} · ${transaction.transaction_date}`
          : "Private documents attached to a ledger entry."
      }
      onClose={onClose}
      title="Receipt vault"
      visible={visible}>
      <View style={styles.privacyPanel}>
        <View style={styles.privacyThread} />
        <MaterialCommunityIcons
          color={palette.signalMoss}
          name="shield-lock-outline"
          size={19}
        />
        <View style={styles.privacyCopy}>
          <Text style={styles.privacyTitle}>PRIVATE BY DEFAULT</Text>
          <Text style={styles.privacyText}>
            Files use owner-only storage rules. Viewing links expire after 60
            seconds.
          </Text>
        </View>
      </View>

      {progress ? (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{
            max: 100,
            min: 0,
            now: Math.round(progress.fraction * 100),
            text: progress.label,
          }}
          style={styles.progressPanel}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress.fraction * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{progress.label}</Text>
        </View>
      ) : null}

      {actionError ? (
        <View accessibilityRole="alert" style={styles.errorPanel}>
          <MaterialCommunityIcons
            color={palette.expense}
            name="alert-circle-outline"
            size={17}
          />
          <Text style={styles.errorText}>{actionError}</Text>
        </View>
      ) : null}

      {!canUseRemoteReceipt ? (
        <StatePanel
          description="Let this entry finish syncing first. Its amount and ledger status are unaffected."
          title="Receipt waits for sync"
        />
      ) : attachmentsQuery.isLoading ? (
        <StatePanel
          description="Reading owner-only attachment records."
          loading
          title="Opening the vault"
        />
      ) : attachmentsQuery.isError ? (
        <StatePanel
          actionLabel="Retry"
          description="The transaction is safe. Try reading its private receipts again."
          onAction={() => void attachmentsQuery.refetch()}
          title="Vault unavailable"
        />
      ) : attachments.length === 0 ? (
        <StatePanel
          description="Add a PDF, JPEG, PNG, or WebP up to 10 MB. PDFs may contain up to 25 pages."
          title="No receipt attached"
        />
      ) : (
        <View style={styles.attachmentList}>
          {attachments.map((attachment) => {
            const active = activeAttachmentId === attachment.id;
            const ready = attachment.upload_status === "uploaded";
            return (
              <View key={attachment.id} style={styles.attachmentRow}>
                <View
                  style={[
                    styles.statusThread,
                    {
                      backgroundColor: ready
                        ? palette.signalMoss
                        : palette.signalAmber,
                    },
                  ]}
                />
                <View style={styles.fileIcon}>
                  <MaterialCommunityIcons
                    color={palette.textMuted}
                    name={
                      attachment.mime_type === "application/pdf"
                        ? "file-pdf-box"
                        : "file-image-outline"
                    }
                    size={20}
                  />
                </View>
                <View style={styles.fileCopy}>
                  <Text numberOfLines={1} style={styles.fileName}>
                    {attachment.original_filename}
                  </Text>
                  <Text style={styles.fileMeta}>
                    {formatReceiptSize(attachment.file_size_bytes)}
                    {attachment.page_count
                      ? ` · ${attachment.page_count} ${attachment.page_count === 1 ? "PAGE" : "PAGES"}`
                      : ""}
                    {` · ${statusCopy(attachment)}`}
                  </Text>
                  {attachment.last_upload_error ? (
                    <Text numberOfLines={2} style={styles.fileError}>
                      {attachment.last_upload_error}
                    </Text>
                  ) : null}
                  <View style={styles.fileActions}>
                    {ready ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={active || isBusy || !isOnline}
                        onPress={() => void openFile(attachment)}>
                        <Text style={styles.fileAction}>VIEW</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={active || isBusy}
                        onPress={() => void retryFile(attachment)}>
                        <Text style={styles.fileAction}>RETRY</Text>
                      </Pressable>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      disabled={active || isBusy || !isOnline}
                      onPress={() => confirmRemove(attachment)}>
                      <Text style={styles.deleteAction}>DELETE</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <ActionButton
        disabled={!canUseRemoteReceipt || !isOnline || isBusy}
        icon="paperclip"
        label={isOnline ? "Add private receipt" : "Reconnect to add receipt"}
        loading={uploadMutation.isPending}
        onPress={() => void uploadFile()}
      />
    </FinanceSheet>
  );
}

const styles = StyleSheet.create({
  privacyPanel: {
    alignItems: "center",
    backgroundColor: withAlpha(palette.signalMoss, 0.035),
    borderColor: palette.line,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 82,
    overflow: "hidden",
    padding: 14,
    position: "relative",
  },
  privacyThread: {
    backgroundColor: palette.signalMoss,
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 1,
  },
  privacyCopy: { flex: 1, gap: 4 },
  privacyTitle: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  privacyText: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  progressPanel: { gap: 8 },
  progressTrack: { backgroundColor: palette.line, height: 2, width: "100%" },
  progressFill: { backgroundColor: palette.signalCyan, height: 2 },
  progressText: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  errorPanel: {
    alignItems: "center",
    backgroundColor: withAlpha(palette.expense, 0.04),
    borderColor: withAlpha(palette.expense, 0.25),
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  errorText: {
    color: palette.textMuted,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  attachmentList: { borderColor: palette.line, borderWidth: 1 },
  attachmentRow: {
    alignItems: "center",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    minHeight: 96,
    overflow: "hidden",
    padding: 12,
    position: "relative",
  },
  statusThread: {
    bottom: 0,
    left: 0,
    position: "absolute",
    top: 0,
    width: 1,
  },
  fileIcon: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    marginRight: 12,
    width: 42,
  },
  fileCopy: { flex: 1, gap: 5 },
  fileName: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
  },
  fileMeta: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.35,
  },
  fileError: {
    color: palette.expense,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 14,
  },
  fileActions: { flexDirection: "row", gap: 18, marginTop: 3 },
  fileAction: {
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.6,
  },
  deleteAction: {
    color: palette.expense,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.6,
  },
});
