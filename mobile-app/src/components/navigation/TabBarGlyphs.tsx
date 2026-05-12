import { StyleSheet, View } from "react-native";

type GProps = { color: string; size?: number };

/** Тонкие «line»-иконки в духе шапки сайта (без внешних шрифтов). */
export function TabGlyphProfile({ color, size = 22 }: GProps) {
  const s = size;
  const w = Math.max(2, s * 0.1);
  return (
    <View style={[styles.box, { width: s, height: s }]}>
      <View
        style={{
          width: s * 0.38,
          height: s * 0.38,
          borderRadius: s * 0.19,
          borderWidth: w,
          borderColor: color,
        }}
      />
      <View
        style={{
          marginTop: s * 0.05,
          width: s * 0.62,
          height: s * 0.28,
          borderBottomLeftRadius: s * 0.31,
          borderBottomRightRadius: s * 0.31,
          borderWidth: w,
          borderColor: color,
          borderTopWidth: 0,
        }}
      />
    </View>
  );
}

export function TabGlyphTasks({ color, size = 22 }: GProps) {
  const s = size;
  const w = Math.max(2, s * 0.1);
  return (
    <View style={[styles.box, { width: s, height: s }]}>
      <View style={[styles.square, { width: s * 0.72, height: s * 0.72, borderRadius: s * 0.12, borderColor: color, borderWidth: w }]} />
      <View
        style={{
          position: "absolute",
          left: s * 0.22,
          top: s * 0.32,
          width: s * 0.22,
          height: w * 1.2,
          backgroundColor: color,
          transform: [{ rotate: "-52deg" }],
        }}
      />
    </View>
  );
}

export function TabGlyphShop({ color, size = 22 }: GProps) {
  const s = size;
  const w = Math.max(2, s * 0.1);
  return (
    <View style={[styles.box, { width: s, height: s }]}>
      <View
        style={{
          width: s * 0.58,
          height: s * 0.42,
          borderWidth: w,
          borderColor: color,
          borderTopLeftRadius: s * 0.08,
          borderTopRightRadius: s * 0.08,
          borderBottomWidth: 0,
        }}
      />
      <View
        style={{
          marginTop: -w * 0.5,
          width: s * 0.78,
          height: s * 0.22,
          borderWidth: w,
          borderColor: color,
          borderBottomLeftRadius: s * 0.1,
          borderBottomRightRadius: s * 0.1,
          borderTopWidth: 0,
        }}
      />
    </View>
  );
}

export function TabGlyphChart({ color, size = 22 }: GProps) {
  const s = size;
  const w = Math.max(2, s * 0.11);
  return (
    <View style={[styles.box, { width: s, height: s, justifyContent: "flex-end" }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: s * 0.7, gap: s * 0.12 }}>
        <View style={{ width: w, height: s * 0.28, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: w, height: s * 0.48, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: w, height: s * 0.65, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

export function TabGlyphBell({ color, size = 22 }: GProps) {
  const s = size;
  const w = Math.max(2, s * 0.1);
  return (
    <View style={[styles.box, { width: s, height: s }]}>
      <View
        style={{
          width: s * 0.55,
          height: s * 0.48,
          borderWidth: w,
          borderColor: color,
          borderTopLeftRadius: s * 0.28,
          borderTopRightRadius: s * 0.28,
          borderBottomWidth: 0,
        }}
      />
      <View style={{ width: s * 0.62, height: w, backgroundColor: color, marginTop: -w * 0.3, borderRadius: 1 }} />
      <View style={{ width: s * 0.22, height: w * 1.1, backgroundColor: color, marginTop: s * 0.04, borderRadius: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  square: {},
});
