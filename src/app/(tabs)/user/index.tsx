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
  const openCount = drafts.data?.length ?? 0;

  return (
    <View style={styles.container}>
      <ProfileScreen />
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  draftsButton: {
    alignItems: "center",
    backgroundColor: palette.text,
    borderColor: palette.text,
    borderRadius: 16,
    borderWidth: 1,
    bottom: 104,
    flexDirection: "row",
    gap: 9,
    minHeight: 48,
    paddingHorizontal: 15,
    position: "absolute",
    right: 20,
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
});
