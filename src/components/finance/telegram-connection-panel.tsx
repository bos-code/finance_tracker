import { ActionButton } from "@/components/finance/action-button";
import { TELEGRAM_BOT_USERNAME, UI_PREVIEW_ENABLED } from "@/config/runtime";
import {
  formatCountdown,
  linkCodeSecondsRemaining,
  telegramStartUrl,
} from "@/features/channels/telegram-link";
import { useTelegramConnection } from "@/hooks/use-telegram-connection";
import { backendErrorMessage } from "@/services/backend/errors";
import type { TelegramLinkCode } from "@/services/supabase/channel-service";
import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

function formatLinkedDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TelegramConnectionPanel() {
  const [linkCode, setLinkCode] = useState<TelegramLinkCode | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const remaining = linkCode
    ? linkCodeSecondsRemaining(linkCode.expiresAt, now)
    : 0;
  const codeActive = linkCode !== null && remaining > 0;
  const codeExpired = linkCode !== null && remaining === 0;

  const { connection, createLinkCode, disconnect, simulateLink } =
    useTelegramConnection({ pollWhileLinking: codeActive });
  const linked = connection.data ?? null;

  useEffect(() => {
    if (!codeActive) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [codeActive]);

  // The webhook creates the connection; polling notices it and we clear the
  // now-useless code.
  useEffect(() => {
    if (linked && linkCode) {
      setLinkCode(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [linked, linkCode]);

  const generate = async () => {
    try {
      const next = await createLinkCode.mutateAsync();
      setNow(Date.now());
      setLinkCode(next);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Surfaced below through createLinkCode.error.
    }
  };

  const openTelegram = async () => {
    if (!linkCode) return;
    const url = telegramStartUrl(TELEGRAM_BOT_USERNAME, linkCode.code);
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Telegram could not be opened",
        "Open Telegram yourself, find the Finance Tracker bot, and send /link followed by the code.",
      );
    }
  };

  const confirmDisconnect = () => {
    if (!linked) return;
    Alert.alert(
      "Disconnect Telegram?",
      "The bot will stop saving drafts from this chat. Drafts and transactions you already have stay in the app.",
      [
        { style: "cancel", text: "Cancel" },
        {
          onPress: () => {
            disconnect.mutate(linked.id, {
              onError: (error) =>
                Alert.alert("Not disconnected", backendErrorMessage(error)),
            });
          },
          style: "destructive",
          text: "Disconnect",
        },
      ],
    );
  };

  if (connection.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.textMuted} />
      </View>
    );
  }

  if (connection.isError) {
    return (
      <View style={styles.block}>
        <Text style={styles.title}>Telegram status unavailable</Text>
        <Text style={styles.body}>{backendErrorMessage(connection.error)}</Text>
        <ActionButton
          label="Try again"
          onPress={() => void connection.refetch()}
          tone="quiet"
        />
      </View>
    );
  }

  if (linked) {
    return (
      <View style={styles.block}>
        <View style={styles.statusRow}>
          <View style={[styles.signal, { backgroundColor: palette.income }]} />
          <View style={styles.statusCopy}>
            <Text style={styles.title}>Connected</Text>
            <Text style={styles.body}>
              Linked on {formatLinkedDate(linked.linked_at)}. Message the bot
              something like “spent 2500 on lunch” and it appears in Drafts for
              you to review.
            </Text>
          </View>
        </View>
        <ActionButton
          icon="link-off"
          label="Disconnect Telegram"
          loading={disconnect.isPending}
          onPress={confirmDisconnect}
          tone="danger"
        />
      </View>
    );
  }

  const deepLink = linkCode
    ? telegramStartUrl(TELEGRAM_BOT_USERNAME, linkCode.code)
    : null;

  return (
    <View style={styles.block}>
      <View style={styles.statusRow}>
        <View style={[styles.signal, { backgroundColor: palette.signalCyan }]} />
        <View style={styles.statusCopy}>
          <Text style={styles.title}>Not connected</Text>
          <Text style={styles.body}>
            Link one Telegram account to save entries by chat. Nothing becomes a
            transaction until you review it.
          </Text>
        </View>
      </View>

      {codeActive && linkCode ? (
        <View style={styles.codeBox}>
          <Text style={styles.codeCaption}>YOUR LINK CODE</Text>
          <Text
            accessibilityLabel={`Link code ${linkCode.code.replace("-", " ").split("").join(" ")}`}
            selectable
            style={styles.code}>
            {linkCode.code}
          </Text>
          <Text style={styles.countdown}>
            Expires in {formatCountdown(remaining)} · single use
          </Text>
          <Text style={styles.body}>
            {deepLink
              ? "Tap Open Telegram, then press Start. Or send the code yourself:"
              : "Open the Finance Tracker bot in Telegram and send:"}
          </Text>
          <Text selectable style={styles.command}>
            /link {linkCode.code}
          </Text>
        </View>
      ) : null}

      {codeExpired ? (
        <Text style={styles.warning}>
          That code expired. Generate a new one to continue.
        </Text>
      ) : null}

      {createLinkCode.isError ? (
        <Text style={styles.warning}>
          {backendErrorMessage(createLinkCode.error)}
        </Text>
      ) : null}

      {codeActive && deepLink ? (
        <ActionButton
          icon="send-outline"
          label="Open Telegram"
          onPress={() => void openTelegram()}
        />
      ) : null}

      <ActionButton
        label={
          codeActive
            ? "Get a new code"
            : codeExpired
              ? "Generate a new code"
              : "Generate link code"
        }
        loading={createLinkCode.isPending}
        onPress={() => void generate()}
        tone={codeActive ? "quiet" : "primary"}
      />

      {UI_PREVIEW_ENABLED ? (
        <ActionButton
          label="Simulate linking (preview only)"
          loading={simulateLink.isPending}
          onPress={() => simulateLink.mutate()}
          tone="quiet"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 14, paddingVertical: 6 },
  body: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
  },
  centered: { alignItems: "center", paddingVertical: 28 },
  code: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 30,
    letterSpacing: 4,
  },
  codeBox: {
    borderColor: palette.lineStrong,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  codeCaption: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  command: {
    backgroundColor: palette.surface,
    color: palette.textMuted,
    fontFamily: fonts.ledger,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  countdown: {
    color: palette.signalAmber,
    fontFamily: fonts.ledger,
    fontSize: 9,
  },
  signal: { marginRight: 13, width: 1 },
  statusCopy: { flex: 1, gap: 5 },
  statusRow: { flexDirection: "row" },
  title: {
    color: palette.text,
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: "600",
  },
  warning: {
    color: palette.warning,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 17,
  },
});
