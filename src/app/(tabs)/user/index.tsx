import { type AppTheme, useStyles, useTheme } from "@/theme/theme-context";
import { useTransactionDrafts } from "@/hooks/use-transaction-drafts";
import { useWorkspace } from "@/hooks/use-workspace";
import { ROUTES } from "@/navigation/route-names";
import { ProfileScreen } from "@/screens";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfileRoute() {
  const { palette } = useTheme();
  const styles = useStyles(createStyles);
  const { workspace } = useWorkspace();
  const drafts = useTransactionDrafts(
    workspace?.id ?? "",
    { includeConfirmed: false, includeExpired: false },
    !!workspace?.id,
  );
  const openDrafts = drafts.data ?? [];
  const openCount = openDrafts.length;
  const readyCount = openDrafts.filter(
    (draft) => draft.lifecycle === "pending_confirmation",
  ).length;

  // Shortcuts sit in the page itself, never floating over settings rows.
  const shortcuts =
    openCount > 0 ? (
      <View style={styles.shortcuts}>
        {readyCount > 0 ? (
          <Pressable
            accessibilityLabel={`Save ${readyCount} ready transaction drafts`}
            accessibilityRole="button"
            onPress={() => router.push(ROUTES.DRAFT_FINALIZE as never)}
            style={({ pressed }) => [
              styles.readyButton,
              { opacity: pressed ? 0.62 : 1 },
            ]}>
            <MaterialCommunityIcons
              color={palette.income}
              name="check-decagram-outline"
              size={22}
            />
            <Text style={styles.readyLabel}>Save ready drafts</Text>
            <View style={styles.readyCountBadge}>
              <Text style={styles.readyCountText}>{readyCount}</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel={`Review ${openCount} open transaction drafts`}
          accessibilityRole="button"
          onPress={() => router.push(ROUTES.DRAFTS as never)}
          style={({ pressed }) => [
            styles.draftsButton,
            { opacity: pressed ? 0.62 : 1 },
          ]}>
          <MaterialCommunityIcons
            color={palette.onPrimary}
            name="text-box-search-outline"
            size={22}
          />
          <Text style={styles.draftsLabel}>Review drafts</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{openCount}</Text>
          </View>
        </Pressable>
      </View>
    ) : null;

  return <ProfileScreen topSlot={shortcuts} />;
}

const createStyles = ({ palette, fonts, fs }: AppTheme) =>
  StyleSheet.create({
    shortcuts: { gap: 10, marginBottom: 22 },
    draftsButton: {
      alignItems: "center",
      backgroundColor: palette.text,
      borderColor: palette.text,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 16,
    },
    draftsLabel: {
      color: palette.onPrimary,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fs(16),
      fontWeight: "700",
    },
    countBadge: {
      alignItems: "center",
      backgroundColor: palette.onPrimary,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 28,
      minWidth: 28,
      paddingHorizontal: 8,
    },
    countText: {
      color: palette.text,
      fontFamily: fonts.ledger,
      fontSize: fs(13),
      fontWeight: "700",
    },
    readyButton: {
      alignItems: "center",
      backgroundColor: palette.surface,
      borderColor: palette.income,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 16,
    },
    readyLabel: {
      color: palette.income,
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fs(16),
      fontWeight: "700",
    },
    readyCountBadge: {
      alignItems: "center",
      backgroundColor: palette.income,
      borderRadius: 999,
      justifyContent: "center",
      minHeight: 28,
      minWidth: 28,
      paddingHorizontal: 8,
    },
    readyCountText: {
      color: palette.canvas,
      fontFamily: fonts.ledger,
      fontSize: fs(13),
      fontWeight: "700",
    },
  });
