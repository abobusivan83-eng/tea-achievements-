import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  FlatList,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
  type ListRenderItem,
} from "react-native";
import { Image } from "expo-image";
import { ImageZoom } from "@likashefqet/react-native-image-zoom";
import { Video, ResizeMode } from "expo-av";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../../theme";
import { isEvidenceVideoUrl } from "../../lib/mediaUrls";

type Item = { uri: string; isVideo: boolean };

type Props = {
  visible: boolean;
  urls: string[];
  initialIndex?: number;
  onClose: () => void;
};

const VideoPage = memo(function VideoPage({ uri, active }: { uri: string; active: boolean }) {
  return (
    <Video
      source={{ uri }}
      style={styles.videoInner}
      useNativeControls={active}
      resizeMode={ResizeMode.CONTAIN}
      isLooping={false}
      shouldPlay={active}
      isMuted={!active}
    />
  );
});

const ZoomPage = memo(function ZoomPage({ uri, height }: { uri: string; height: number }) {
  return (
    <ImageZoom
      uri={uri}
      style={[styles.zoom, { height }]}
      minScale={1}
      maxScale={6}
      doubleTapScale={3}
      isSingleTapEnabled
    />
  );
});

export function MediaViewerModal({ visible, urls, initialIndex = 0, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const data: Item[] = useMemo(
    () => urls.map((uri) => ({ uri, isVideo: isEvidenceVideoUrl(uri) })),
    [urls],
  );
  const [focused, setFocused] = useState(0);
  const listRef = useRef<FlatList<Item>>(null);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 58 }), []);

  useEffect(() => {
    if (!visible || data.length === 0) return;
    const clamped = Math.min(Math.max(0, initialIndex), data.length - 1);
    setFocused(clamped);
    const t = requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({ index: clamped, animated: false });
      } catch {
        setTimeout(() => listRef.current?.scrollToOffset({ offset: clamped * winW, animated: false }), 50);
      }
    });
    return () => cancelAnimationFrame(t);
  }, [visible, initialIndex, data.length, winW]);

  const pageH = Math.min(winH * 0.68, 520);

  const onViewableItemsChanged = useCallback((info: { viewableItems: ViewToken<Item>[] }) => {
    const ix = info.viewableItems[0]?.index;
    if (typeof ix === "number") setFocused(ix);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const i = Math.round(x / Math.max(winW, 1));
      setFocused(Math.max(0, Math.min(i, data.length - 1)));
    },
    [data.length, winW],
  );

  const renderPage: ListRenderItem<Item> = useCallback(
    ({ item, index: i }) => {
      const active = i === focused;
      if (item.isVideo) {
        return (
          <View style={[styles.page, { width: winW, height: pageH }]}>
            <VideoPage uri={item.uri} active={active} />
          </View>
        );
      }
      return (
        <View style={[styles.page, { width: winW, height: pageH }]}>
          <ZoomPage uri={item.uri} height={pageH} />
        </View>
      );
    },
    [focused, pageH, winW],
  );

  if (!visible || !data.length) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.toolbar}>
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Закрыть">
            <Ionicons name="close" size={28} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.counter}>
            {focused + 1} / {data.length}
          </Text>
          <View style={styles.iconBtn} />
        </View>

        <FlatList<Item>
          ref={listRef}
          data={data}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(it, idx) => `${it.uri}-${idx}`}
          renderItem={renderPage}
          initialScrollIndex={Math.min(initialIndex, data.length - 1)}
          getItemLayout={(_, i) => ({ length: winW, offset: winW * i, index: i })}
          extraData={focused}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollToIndexFailed={() =>
            setTimeout(() => listRef.current?.scrollToOffset({ offset: focused * winW, animated: false }), 120)
          }
        />

        <View style={[styles.thumbRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <FlatList<Item>
            data={data}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(it, idx) => `t-${it.uri}-${idx}`}
            contentContainerStyle={styles.thumbContent}
            windowSize={5}
            maxToRenderPerBatch={8}
            initialNumToRender={6}
            removeClippedSubviews
            renderItem={({ item, index: i }) => (
              <Pressable
                onPress={() => {
                  listRef.current?.scrollToIndex({ index: i, animated: true });
                  setFocused(i);
                }}
                style={[styles.thumbWrap, i === focused && styles.thumbActive]}
              >
                {item.isVideo ? (
                  <View style={styles.thumbVideo}>
                    <Ionicons name="play" size={18} color="#fff" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.thumb}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={140}
                  />
                )}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0c10" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.space.sm,
    paddingBottom: theme.space.sm,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  counter: { ...theme.typography.sm, color: theme.colors.textMuted },
  page: {
    justifyContent: "center",
    alignItems: "center",
  },
  zoom: {
    width: "100%",
  },
  videoInner: {
    width: "94%",
    maxWidth: "100%",
    flex: 1,
    alignSelf: "center",
    backgroundColor: "#000",
  },
  thumbRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  thumbContent: { paddingHorizontal: theme.space.sm, gap: 8 },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbActive: { borderColor: theme.colors.accent },
  thumb: { width: "100%", height: "100%" },
  thumbVideo: {
    flex: 1,
    backgroundColor: "#1a1a24",
    alignItems: "center",
    justifyContent: "center",
  },
});
