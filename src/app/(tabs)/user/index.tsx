import { useTransactionDrafts } from "@/hooks/use-transaction-drafts";
import { useWorkspace } from "@/hooks/use-workspace";
import { ROUTES } from "@/navigation/route-names";
import { ProfileScreen } from "@/screens";
import { palette } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function ProfileRoute() {
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

  return (
    <View style={styles.container}>
      <ProfileScreen />
      <View style={styles.actionGroup}>
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
              size={18}
            />
            <Text style={styles.readyLabel}>SAVE READY</Text>
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
            color={palette.black}
            name="text-box-search-outline"
            size={18}
          />
          <Text style={styles.draftsLabel}>REVIEW DRAFTS</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{openCount}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  actionGroup: {
    alignItems: "flex-end",
    bottom: 104,
    gap: 9,
    position: "absolute",
    right: 20,
  },
  draftsButton: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderColor: palette.text,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 15,
  },
  draftsLabel: {
    color: palette.black,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.7,
  },
  countBadge: {
    alignItems: "center",
    backgroundColor: palette.black,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 22,
    minWidth: 22,
    paddingHorizontal: 6,
  },
  countText: {
    color: palette.text,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
  readyButton: {
    alignItems: "center",
    backgroundColor: palette.surface,
    borderColor: palette.income,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  readyLabel: {
    color: palette.income,
    fontFamily: fonts.ledger,
    fontSize: 8,
    letterSpacing: 0.7,
  },
  readyCountBadge: {
    alignItems: "center",
    backgroundColor: palette.income,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 20,
    minWidth: 20,
    paddingHorizontal: 6,
  },
  readyCountText: {
    color: palette.black,
    fontFamily: fonts.ledger,
    fontSize: 8,
  },
});
