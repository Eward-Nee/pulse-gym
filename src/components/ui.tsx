import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { t } from "../i18n";
export const palettes = {
  pulse: {
    bg: "#111217",
    surface: "#1d1f27",
    raised: "#282b35",
    text: "#f7f6f8",
    muted: "#a6a9b5",
    accent: "#ff978b",
    on: "#301814",
    line: "#333641",
    soft: "#352829",
  },
  couples: {
    bg: "#f7f0eb",
    surface: "#fffaf6",
    raised: "#eee0dc",
    text: "#38272d",
    muted: "#7e656d",
    accent: "#9c4b60",
    on: "#fff8f4",
    line: "#e3cdd0",
    soft: "#f1dbdf",
  },
};
export type Palette = typeof palettes.pulse;
export const Theme = createContext<{ c: Palette; reduced: boolean }>({
  c: palettes.pulse,
  reduced: false,
});
export const useTheme = () => useContext(Theme);
export function T({
  children,
  muted = false,
  size = 14,
  bold = false,
  style,
  selectable,
}: React.PropsWithChildren<{
  muted?: boolean;
  size?: number;
  bold?: boolean;
  style?: any;
  selectable?: boolean;
}>) {
  const { c } = useTheme();
  return (
    <Text
      selectable={selectable}
      style={[
        {
          color: muted ? c.muted : c.text,
          fontSize: size,
          lineHeight: size * 1.45,
          fontWeight: bold ? "700" : "400",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Label({ children }: React.PropsWithChildren) {
  const { c } = useTheme();
  return (
    <Text
      style={{
        color: c.accent,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 2,
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: React.PropsWithChildren<{ style?: ViewStyle }>) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: 22,
          padding: 18,
          borderWidth: 1,
          borderColor: c.line,
          marginBottom: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({
  children,
  style,
}: React.PropsWithChildren<{ style?: ViewStyle }>) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  primary = false,
  icon,
  small = false,
  disabled = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { c, reduced } = useTheme(),
    scale = useRef(new Animated.Value(1)).current;
  const animate = (v: number) => {
    if (!reduced)
      Animated.spring(scale, {
        toValue: v,
        useNativeDriver: true,
        speed: 40,
        bounciness: 5,
      }).start();
  };
  return (
    <Animated.View
      style={{ transform: [{ scale }], opacity: disabled ? 0.45 : 1 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={() => animate(0.96)}
        onPressOut={() => animate(1)}
        onPress={() => {
          if (Platform.OS !== "web" && !reduced)
            void Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={({ pressed }) => ({
          minHeight: small ? 40 : 48,
          paddingHorizontal: small ? 11 : 18,
          paddingVertical: small ? 9 : 13,
          borderRadius: small ? 12 : 15,
          backgroundColor: primary ? c.accent : c.raised,
          flexDirection: "row",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={small ? 15 : 18}
            color={primary ? c.on : danger ? "#d75964" : c.text}
          />
        )}
        <Text
          style={{
            color: primary ? c.on : danger ? "#d75964" : c.text,
            fontSize: small ? 12 : 14,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <T size={12} muted style={{ marginBottom: 6 }}>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          {
            minHeight: 48,
            backgroundColor: c.bg,
            borderColor: c.line,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            color: c.text,
            fontSize: 16,
          },
          props.multiline && { minHeight: 88, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 42,
        justifyContent: "center",
        paddingHorizontal: 14,
        borderRadius: 30,
        backgroundColor: selected ? c.accent : c.raised,
        marginBottom: 6,
      }}
    >
      <Text
        style={{
          color: selected ? c.on : c.muted,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Pill({ children }: React.PropsWithChildren) {
  const { c } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: c.soft,
      }}
    >
      <T size={11} style={{ color: c.accent }}>
        {children}
      </T>
    </View>
  );
}
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ marginBottom: 22, marginTop: 8 }}>
      <T size={32} bold style={{ letterSpacing: -1.2, lineHeight: 37 }}>
        {title}
      </T>
      {subtitle && (
        <T muted style={{ marginTop: 10 }}>
          {subtitle}
        </T>
      )}
    </View>
  );
}
export function Empty({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const { c } = useTheme();
  return (
    <Card style={{ padding: 26, alignItems: "center" }}>
      <Ionicons name={icon} size={30} color={c.accent} />
      <T bold size={17} style={{ marginTop: 12, textAlign: "center" }}>
        {title}
      </T>
      <T muted style={{ textAlign: "center", marginTop: 8 }}>
        {body}
      </T>
    </Card>
  );
}
export function Sheet({
  title,
  children,
  onClose,
}: React.PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { c, reduced } = useTheme();
  return (
    <Modal
      visible
      animationType={reduced ? "none" : "slide"}
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <Theme.Consumer>
        {(value) => (
          <Theme.Provider value={value}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1, backgroundColor: c.bg }}
            >
              <View
                style={{
                  paddingTop: Platform.OS === "ios" ? 25 : 40,
                  paddingHorizontal: 22,
                  paddingBottom: 16,
                  borderBottomColor: c.line,
                  borderBottomWidth: 1,
                }}
              >
                <Row style={{ justifyContent: "space-between" }}>
                  <T size={23} bold>
                    {title}
                  </T>
                  <Button label={t("Close")} small onPress={onClose} />
                </Row>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: 22,
                  paddingBottom: 60,
                  maxWidth: 620,
                  width: "100%",
                  alignSelf: "center",
                }}
              >
                {children}
              </ScrollView>
            </KeyboardAvoidingView>
          </Theme.Provider>
        )}
      </Theme.Consumer>
    </Modal>
  );
}
export type Wallpaper = "iron" | "steel" | "plain";
/** Photo wallpaper with a tint, or a solid themed gradient. Fills its parent; put content on top. */
export function Wallpaper({
  wallpaper,
  couples,
  children,
  style,
}: React.PropsWithChildren<{
  wallpaper: Wallpaper;
  couples: boolean;
  style?: ViewStyle;
}>) {
  const tint: [string, string] =
    wallpaper === "iron"
      ? ["#b4552a55", "#111217e6"]
      : wallpaper === "steel"
        ? ["#2b6fa655", "#0b1825ee"]
        : couples
          ? ["#9c4b60", "#4a2230"]
          : ["#2b2d38", "#15161c"];
  return (
    <View style={[{ overflow: "hidden", backgroundColor: "#111217" }, style]}>
      {wallpaper !== "plain" && (
        <Image
          source={require("../../assets/gym-wallpaper.jpg")}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      )}
      <LinearGradient colors={tint} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}
export function Hero({
  couples,
  wallpaper,
  onPress,
}: {
  couples: boolean;
  wallpaper: Wallpaper;
  onPress: () => void;
}) {
  return (
    <Wallpaper
      wallpaper={wallpaper}
      couples={couples}
      style={{ borderRadius: 26, marginBottom: 22 }}
    >
      <View style={{ minHeight: 255, padding: 23, justifyContent: "flex-end" }}>
        <Text
          style={{
            color: "#f3bbb3",
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          {couples ? t("TOGETHER / EVERY REP") : t("YOUR PEOPLE. YOUR PACE.")}
        </Text>
        <Text
          style={{
            color: "#fff",
            fontSize: 36,
            fontWeight: "800",
            lineHeight: 39,
            letterSpacing: -1,
          }}
        >
          {couples ? t("Stronger.\nTogether.") : t("Build your\nown momentum.")}
        </Text>
        <Text style={{ color: "#d2d1d9", fontSize: 13, marginVertical: 13 }}>
          {couples
            ? t("One team. Two people. Your pace.")
            : t("Your workouts. Your circle. Your next step.")}
        </Text>
        <Button
          label={t("Start your next session")}
          primary
          icon="play"
          onPress={onPress}
        />
      </View>
    </Wallpaper>
  );
}
export function useReducedMotion() {
  const [reduced, set] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(set);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", set);
    return () => sub.remove();
  }, []);
  return reduced;
}
export function Busy() {
  return (
    <View style={{ padding: 40 }}>
      <ActivityIndicator color="#ff978b" />
    </View>
  );
}
/** Slides and fades its content in on mount; give it a new `key` per screen. direction: 1 from the right, -1 from the left. */
export function ScreenTransition({
  direction,
  children,
}: React.PropsWithChildren<{ direction: number }>) {
  const { reduced } = useTheme(),
    progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [progress, reduced]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: progress,
        transform: [
          {
            translateX: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [direction * 36, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
/** Determinate progress bar. `value` is 0..1; the fill eases to each new value. */
export function ProgressBar({ value }: { value: number }) {
  const { c, reduced } = useTheme(),
    fill = useRef(new Animated.Value(0)).current,
    pct = Math.max(0, Math.min(1, value || 0));
  useEffect(() => {
    if (reduced) fill.setValue(pct);
    else
      Animated.timing(fill, {
        toValue: pct,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start();
  }, [pct, reduced, fill]);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{
        height: 10,
        borderRadius: 5,
        backgroundColor: c.raised,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 5,
          backgroundColor: c.accent,
          width: fill.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}
