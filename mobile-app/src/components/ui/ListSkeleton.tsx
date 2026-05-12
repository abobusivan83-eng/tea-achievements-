import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { CardSkeleton } from "./Skeleton";
import { theme } from "../../theme";

type Props = { count?: number };

export const ListSkeleton = memo(function ListSkeleton({ count = 6 }: Props) {
  return (
    <View style={styles.wrap} accessibilityLabel="Загрузка списка" accessibilityState={{ busy: true }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={String(i)} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: theme.space.sm },
});
