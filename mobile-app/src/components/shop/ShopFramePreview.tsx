import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { FrameOverlayId, FrameShape } from "../../lib/cosmetics";
import { getFrame } from "../../lib/cosmetics";
import { DEFAULT_AVATAR_DATA_URI } from "../../lib/defaultAvatar";

const RING: Record<FrameOverlayId, readonly [string, string]> = {
  none: ["rgba(255,255,255,0.22)", "rgba(255,255,255,0.08)"],
  "metal-steel": ["#c8d0dc", "#5c6570"],
  "metal-bronze": ["#d4a574", "#6b4423"],
  "metal-gold": ["#ffe08a", "#b8860b"],
  "minimal-blue": ["#79c0ff", "#1f6feb"],
  "minimal-green": ["#56d364", "#238636"],
  "minimal-purple": ["#d2a8ff", "#8957e5"],
  "carbon-grid": ["#8b949e", "#30363d"],
  "tech-circuit": ["#58a6ff", "#388bfd"],
  "arcane-runes": ["#c297ff", "#6e40c9"],
  "royal-crown": ["#ffd56a", "#d4a017"],
  "neon-edges": ["#ff7b72", "#58a6ff"],
  "retro-pixel": ["#7ee787", "#238636"],
  "ember-flame": ["#ffa657", "#da3633"],
  "glacier-crystal": ["#a5d6ff", "#388bfd"],
  "void-aura": ["#b87fff", "#1f1528"],
  radioactive: ["#56d364", "#ffa657"],
  sigil: ["#d2a8ff", "#58a6ff"],
  "holo-prism": ["#ff7b72", "#79c0ff"],
};

function shapeRadius(shape: FrameShape, innerPx: number): number {
  if (shape === "circle") return innerPx / 2;
  if (shape === "square") return 10;
  return 14;
}

type Props = {
  frameKey: string;
  size?: number;
};

/** Превью рамки в магазине по `item.key`, в духе сайта (`AvatarFrame` + `getFrame`). */
export function ShopFramePreview({ frameKey, size = 56 }: Props) {
  const f = getFrame(frameKey);
  const shape: FrameShape = f?.shape ?? "circle";
  const overlay: FrameOverlayId = f?.overlayId ?? "metal-steel";
  const ring: readonly [string, string] = RING[overlay] ?? RING["metal-steel"];
  const pad = 3;
  const inner = Math.max(32, size - pad * 2);
  const outerR = shapeRadius(shape, inner) + pad;
  const innerR = shapeRadius(shape, inner);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <LinearGradient
        colors={[ring[0], ring[1]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.ring,
          {
            width: inner + pad * 2,
            height: inner + pad * 2,
            borderRadius: outerR,
            padding: pad,
          },
        ]}
      >
        <View
          style={[
            styles.innerClip,
            {
              width: inner,
              height: inner,
              borderRadius: innerR,
            },
          ]}
        >
          <Image
            source={{ uri: DEFAULT_AVATAR_DATA_URI }}
            style={{ width: inner, height: inner, borderRadius: innerR }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
  },
  innerClip: {
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
});
