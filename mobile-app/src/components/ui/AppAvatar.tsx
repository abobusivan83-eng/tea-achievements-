import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { theme } from "../../theme";

type Props = {
  uri?: string | null;
  size?: number;
};

export function AppAvatar({ uri, size = 44 }: Props) {
  const radius = Math.round(size * 0.28);
  if (!uri) {
    return <View style={[styles.placeholder, { width: size, height: size, borderRadius: radius }]} />;
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={140}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
