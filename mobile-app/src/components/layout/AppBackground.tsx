import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../../theme";

/** Как `body` на сайте: radial + linear (--bg1 / steam). */
export function AppBackground({ children }: PropsWithChildren) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={[theme.colors.backgroundDeep, theme.colors.background]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(102,192,244,0.14)", "transparent"]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 0.75 }}
        style={styles.blobTop}
      />
      <LinearGradient
        colors={["rgba(6,182,212,0.10)", "transparent"]}
        start={{ x: 0.9, y: 0.1 }}
        end={{ x: 0.2, y: 0.6 }}
        style={styles.blobRight}
      />
      <LinearGradient
        colors={["rgba(136,71,255,0.10)", "transparent"]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.4, y: 0.3 }}
        style={styles.blobBottom}
      />
      <LinearGradient
        colors={["rgba(15,18,24,0.2)", "rgba(27,40,56,0.35)", "rgba(15,18,24,0.2)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  blobTop: {
    position: "absolute",
    top: -80,
    left: -60,
    right: -40,
    height: 280,
  },
  blobRight: {
    position: "absolute",
    top: 120,
    right: -100,
    width: 280,
    height: 320,
  },
  blobBottom: {
    position: "absolute",
    bottom: -100,
    left: -40,
    right: -40,
    height: 320,
  },
});
