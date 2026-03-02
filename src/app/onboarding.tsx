import arrowWhite from "@/assets/icons/arrowwhite.png";
import onboardIcon from "@/assets/icons/onboard.png";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  background: "#EAF0F8",
  primary: "#2F5FD0",
  badgeBackground: "#D5E4FF",
  badgeText: "#2F5FD0",
  title: "#111827",
  buttonText: "#FFFFFF",
} as const;

const SPACING = {
  screenPadding: 24,
  contentGap: 20,
  iconSize: 132,
  badgeHorizontal: 12,
  badgeVertical: 4,
  titleMaxWidth: 260,
  buttonHorizontal: 20,
  buttonVertical: 15,
  buttonRadius: 14,
} as const;

export default function OnboardingScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Image
              source={onboardIcon}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>Moneyme</Text>
          </View>

          <Text className="text-3xl font-bold text-center">
            Simple spending{"\n"}application
          </Text>

          <Pressable style={styles.button} onPress={() => router.push("/")}>
            <Text style={styles.buttonText}>
              <>
                First spending
                <Image
                  source={arrowWhite}
                  className=" px-6  items-center"
                  resizeMode="contain"></Image>
              </>
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.screenPadding,
  },
  content: {
    alignItems: "center",
    gap: SPACING.contentGap,
  },
  iconContainer: {
    width: SPACING.iconSize,
    height: SPACING.iconSize,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: SPACING.iconSize * 0.72,
    height: SPACING.iconSize * 0.72,
  },
  badge: {
    paddingHorizontal: SPACING.badgeHorizontal,
    paddingVertical: SPACING.badgeVertical,
    borderRadius: 999,
    backgroundColor: COLORS.badgeBackground,
  },
  badgeText: {
    color: COLORS.badgeText,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  title: {
    maxWidth: SPACING.titleMaxWidth,
    textAlign: "center",
    color: COLORS.title,
    fontSize: 42 / 2,
    lineHeight: 28,
    fontWeight: "600",
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: SPACING.buttonRadius,
    paddingHorizontal: SPACING.buttonHorizontal,
    paddingVertical: SPACING.buttonVertical,
  },
  buttonText: {
    color: COLORS.buttonText,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },
});
