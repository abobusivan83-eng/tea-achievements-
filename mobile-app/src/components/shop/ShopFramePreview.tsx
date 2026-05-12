import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { FrameOverlayId, FrameShape } from "../../lib/cosmetics";
import { getFrame } from "../../lib/cosmetics";
import { DEFAULT_AVATAR_DATA_URI } from "../../lib/defaultAvatar";
import { getFrameShellGradient, getOverlayRingPreset } from "../../lib/framePreviewTheme";

function outerRadius(shape: FrameShape, outer: number): number {
  if (shape === "circle") return outer / 2;
  const scale = outer / 64;
  if (shape === "square") return Math.round(16 * scale);
  return Math.round(22 * scale);
}

function innerImgRadius(shape: FrameShape, inner: number): number {
  if (shape === "circle") return inner / 2;
  const scale = inner / 52;
  if (shape === "square") return Math.max(6, Math.round(12 * scale));
  return Math.max(8, Math.round(18 * scale));
}

type Props = {
  frameKey: string;
  /** Внешний размер превью (как на сайте: внутренний аватар ≈ size − 12 при эталоне 64). */
  size?: number;
};

/**
 * Превью рамки в магазине: оболочка `.frame--*` + кольцо `.avatar-frame--*`, как `AvatarFrame` на сайте.
 */
export function ShopFramePreview({ frameKey, size = 56 }: Props) {
  const f = getFrame(frameKey);
  const shape: FrameShape = f?.shape ?? "circle";
  const fxClass = f?.className ?? "frame--common";
  const overlayId: FrameOverlayId = f?.overlayId ?? "metal-steel";
  const reduceMotion = useReducedMotion();

  const outer = size;
  const inner = Math.max(32, Math.round((52 * outer) / 64));
  const shellPad = Math.max(2, Math.round((3 * outer) / 64));
  const outerR = outerRadius(shape, outer);
  const innerR = innerImgRadius(shape, inner);

  const shell = getFrameShellGradient(fxClass);
  const ringPreset = getOverlayRingPreset(overlayId);

  const pulse = useSharedValue(1);

  const wantsPulse =
    !reduceMotion &&
    (Boolean(f?.animated) ||
      Boolean(ringPreset.pulseShadow) ||
      fxClass === "frame--softglow" ||
      fxClass === "frame--neon" ||
      fxClass === "frame--ember" ||
      fxClass === "frame--void" ||
      fxClass === "frame--radioactive" ||
      fxClass === "frame--legendary-animated" ||
      fxClass === "frame--legendary-particles" ||
      fxClass.startsWith("frame--creator-"));

  useEffect(() => {
    if (!wantsPulse) {
      cancelAnimation(pulse);
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.055, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [wantsPulse]);

  const shellAnim = useAnimatedStyle(() => {
    if (!wantsPulse) return { opacity: 1 };
    return {
      opacity: interpolate(pulse.value, [1, 1.055], [0.9, 1]),
    };
  });

  const ringAnim = useAnimatedStyle(() => {
    const m = wantsPulse ? interpolate(pulse.value, [1, 1.055], [0.94, 1]) : 1;
    return {
      opacity: ringPreset.borderColor === "transparent" ? 0 : m,
      ...(Platform.OS === "ios"
        ? {
            shadowOpacity: ringPreset.shadowOpacity * m,
          }
        : {}),
    };
  });

  const showRing = overlayId !== "none" && ringPreset.borderColor !== "transparent";

  return (
    <View style={[styles.outer, { width: outer, height: outer, borderRadius: outerR }]}>
      <Animated.View style={[StyleSheet.absoluteFill, shellAnim]}>
        <LinearGradient
          colors={[...shell.colors]}
          start={shell.start}
          end={shell.end}
          style={[StyleSheet.absoluteFill, { borderRadius: outerR }]}
        />
      </Animated.View>

      <View
        style={[
          styles.innerPad,
          {
            padding: shellPad,
            borderRadius: outerR,
          },
        ]}
      >
        <View style={[styles.imgClip, { width: inner, height: inner, borderRadius: innerR }]}>
          <Image
            source={{ uri: DEFAULT_AVATAR_DATA_URI }}
            style={{ width: inner, height: inner, borderRadius: innerR }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      </View>

      {showRing ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: 2,
              left: 2,
              right: 2,
              bottom: 2,
              borderRadius: Math.max(outerR - 2, 4),
              borderColor: ringPreset.borderColor,
              borderWidth: 3,
              shadowColor: ringPreset.glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowRadius: ringPreset.shadowRadius,
              ...(Platform.OS === "android" ? { elevation: Math.min(10, Math.round(ringPreset.shadowRadius / 2)) } : {}),
            },
            ringAnim,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "relative",
    overflow: "hidden",
  },
  innerPad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imgClip: {
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  ring: {
    position: "absolute",
    backgroundColor: "transparent",
  },
});
