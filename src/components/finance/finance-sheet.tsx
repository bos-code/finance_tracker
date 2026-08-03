import { palette, withAlpha } from "@/theme/colors";
import { fonts } from "@/theme/typography";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function FinanceSheet({
  children,
  description,
  onClose,
  scroll = true,
  title,
  visible,
}: {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  scroll?: boolean;
  title: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.scrollContent}>{children}</View>
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.modal}>
        <Pressable
          accessibilityLabel="Close sheet"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.scrim}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none">
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 18) },
            ]}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>FINANCE TRACKER / REVIEW</Text>
                <Text style={styles.title}>{title}</Text>
                {description ? (
                  <Text style={styles.description}>{description}</Text>
                ) : null}
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.close,
                  { opacity: pressed ? 0.56 : 1 },
                ]}>
                <MaterialCommunityIcons
                  color={palette.textMuted}
                  name="close"
                  size={19}
                />
              </Pressable>
            </View>
            {content}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(palette.black, 0.76),
  },
  sheet: {
    backgroundColor: palette.surface,
    borderColor: palette.lineStrong,
    borderCurve: "continuous",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: "92%",
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    backgroundColor: palette.lineStrong,
    borderRadius: 2,
    height: 3,
    marginTop: 10,
    width: 38,
  },
  header: {
    alignItems: "flex-start",
    borderBottomColor: palette.line,
    borderBottomWidth: 1,
    flexDirection: "row",
    padding: 20,
  },
  headerCopy: { flex: 1, gap: 5, paddingRight: 16 },
  eyebrow: {
    color: palette.textQuiet,
    fontFamily: fonts.ledger,
    fontSize: 7,
    letterSpacing: 0.8,
  },
  title: { color: palette.text, fontFamily: fonts.display, fontSize: 24 },
  description: {
    color: palette.textQuiet,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
  },
  close: {
    alignItems: "center",
    borderColor: palette.line,
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  scrollContent: { gap: 20, padding: 20, paddingBottom: 8 },
});
