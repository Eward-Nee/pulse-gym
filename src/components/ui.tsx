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
import type { WallpaperId } from "../core/model";
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
/** The generated gym photograph is 941 x 1672 (portrait). */
const PHOTO = { width: 941, height: 1672 };
// Light colour treatments over the photo; `tint` is [r, g, b, alpha].
const TREATMENTS = {
  iron: { tint: [224, 128, 46, 0.2] },
  steel: { tint: [63, 134, 200, 0.28] },
  rose: { tint: [208, 88, 124, 0.3] },
} as const;
const hex = (n: number) =>
  Math.round(Math.max(0, Math.min(1, n)) * 255)
    .toString(16)
    .padStart(2, "0");
/**
 * The photo (iron / steel / rose treatments) or a solid themed gradient (plain).
 * Fills its parent; put content on top. `focus` is the vertical centre of the
 * visible window as a fraction of the photo: the equipment sits in its lower half,
 * the top is empty dark wall. `scrim` darkens the bottom for text.
 */
export function Wallpaper({
  wallpaper,
  couples,
  focus = 0.7,
  scrim = 0.7,
  children,
  style,
}: React.PropsWithChildren<{
  wallpaper: WallpaperId;
  couples: boolean;
  focus?: number;
  scrim?: number;
  style?: ViewStyle;
}>) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  // Cover the box, then slide the photo so the window is centred on `focus`.
  const imgW = Math.max(box.width, (box.height * PHOTO.width) / PHOTO.height),
    imgH = (imgW * PHOTO.height) / PHOTO.width,
    top = -Math.max(
      0,
      Math.min(imgH - box.height, imgH * focus - box.height / 2),
    ),
    left = -(imgW - box.width) / 2;
  return (
    <View
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox((b) =>
          b.width === width && b.height === height ? b : { width, height },
        );
      }}
      style={[{ overflow: "hidden", backgroundColor: "#111217" }, style]}
    >
      {wallpaper === "plain" ? (
        <LinearGradient
          colors={couples ? ["#9c4b60", "#4a2230"] : ["#2b2d38", "#15161c"]}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <>
          {box.width > 0 && (
            <Image
              source={require("../../assets/gym-wallpaper.jpg")}
              resizeMode="cover"
              fadeDuration={0}
              style={{
                position: "absolute",
                width: imgW,
                height: imgH,
                top,
                left,
              }}
            />
          )}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: `rgba(${TREATMENTS[wallpaper].tint[0]},${TREATMENTS[wallpaper].tint[1]},${TREATMENTS[wallpaper].tint[2]},${TREATMENTS[wallpaper].tint[3]})`,
              },
            ]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["#11121700", `#111217${hex(scrim)}`]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              top: "35%",
            }}
          />
        </>
      )}
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
  wallpaper: WallpaperId;
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
/** Scroll content must end this far above the bottom so the floating tab bar never hides it. */
export const NAV_CLEARANCE = 108;
type TabSpec<K extends string> = {
  key: K;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};
/**
 * Floating bottom tab bar. Its outer container has no background, so screen
 * content scrolls behind it. One animated position drives everything: a pill
 * that slides (and stretches slightly) between tabs, and a cross-fade plus a
 * small pop on the icon and label of the selected tab.
 */
export function TabBar<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabSpec<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  const { c, reduced } = useTheme(),
    index = Math.max(
      0,
      tabs.findIndex((t) => t.key === active),
    ),
    pos = useRef(new Animated.Value(index)).current,
    mounted = useRef(false),
    [width, setWidth] = useState(0),
    PAD = 5,
    tabWidth = width ? (width - PAD * 2) / tabs.length : 0;
  useEffect(() => {
    if (reduced || !mounted.current) {
      mounted.current = true;
      pos.setValue(index);
      return;
    }
    const run = Animated.spring(pos, {
      toValue: index,
      stiffness: 260,
      damping: 21,
      mass: 0.9,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [index, reduced, pos]);
  const slots = tabs.map((_, i) => i),
    halves = slots.flatMap((i) => (i ? [i - 0.5, i] : [i]));
  const body = (tab: TabSpec<K>, color: string) => (
    <View style={{ alignItems: "center", paddingVertical: 11, gap: 4 }}>
      <Ionicons name={tab.icon} size={20} color={color} />
      <Text style={{ fontSize: 11, fontWeight: "700", color }}>
        {tab.label}
      </Text>
    </View>
  );
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 22,
        paddingTop: 8,
        paddingBottom: Platform.OS === "web" ? 16 : 5,
      }}
    >
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          backgroundColor: c.surface,
          borderRadius: 28,
          padding: PAD,
          flexDirection: "row",
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: PAD,
              bottom: PAD,
              left: PAD,
              width: tabWidth,
              borderRadius: 24,
              backgroundColor: c.accent,
              transform: [
                {
                  translateX: pos.interpolate({
                    inputRange: slots,
                    outputRange: slots.map((i) => i * tabWidth),
                  }),
                },
                {
                  scaleX: pos.interpolate({
                    inputRange: halves,
                    outputRange: halves.map((h) => (h % 1 ? 1.1 : 1)),
                  }),
                },
              ],
            }}
          />
        )}
        {tabs.map((tab, i) => {
          const near = (outside: number, inside: number) =>
            pos.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [outside, inside, outside],
              extrapolate: "clamp",
            });
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: tab.key === active }}
              onPress={() => {
                if (Platform.OS !== "web" && !reduced)
                  void Haptics.selectionAsync().catch(() => {});
                onChange(tab.key);
              }}
              style={{ flex: 1 }}
            >
              <Animated.View style={{ opacity: near(1, 0) }}>
                {body(tab, c.muted)}
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
                style={{
                  ...StyleSheet.absoluteFill,
                  opacity: near(0, 1),
                  transform: [{ scale: near(0.88, 1) }],
                }}
              >
                {body(tab, c.on)}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
