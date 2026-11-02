import { useState } from "react";
import {
  Pressable as NativePressable,
  type GestureResponderEvent,
  type PressableProps,
  type PressableStateCallbackType,
} from "react-native";

/**
 * A drop-in `Pressable` that works with NativeWind on Android and iOS.
 *
 * NativeWind v4 ignores the function form of a Pressable's `style`
 * (`style={({ pressed }) => [...]}`) on native, so every style in it is dropped:
 * rows stack instead of lining up, fixed sizes vanish, flex layouts collapse.
 * The web build does not show this, which is how it went unnoticed.
 * See https://github.com/nativewind/nativewind/issues/847.
 *
 * This resolves the function itself, from its own pressed state, and hands the
 * underlying Pressable a plain style. Use it everywhere instead of importing
 * `Pressable` from react-native (a test enforces that).
 */
export function Pressable({
  children,
  onPressIn,
  onPressOut,
  style,
  ...rest
}: PressableProps) {
  const [pressed, setPressed] = useState(false);
  const dynamic = typeof style === "function" || typeof children === "function";
  const state = { pressed } as PressableStateCallbackType;

  return (
    <NativePressable
      {...rest}
      // Track the pressed state only when something actually depends on it.
      onPressIn={
        dynamic
          ? (event: GestureResponderEvent) => {
              setPressed(true);
              onPressIn?.(event);
            }
          : onPressIn
      }
      onPressOut={
        dynamic
          ? (event: GestureResponderEvent) => {
              setPressed(false);
              onPressOut?.(event);
            }
          : onPressOut
      }
      style={typeof style === "function" ? style(state) : style}>
      {typeof children === "function" ? children(state) : children}
    </NativePressable>
  );
}
