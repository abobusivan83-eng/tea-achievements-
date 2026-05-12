import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, ListRenderItem, Platform, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { AchievementDetailSheet, AppScreen, EmptyState, ErrorState, ListSkeleton, ScreenHeader, Button } from "../../components";
import { TaskListCard } from "../../components/tasks/TaskListCard";
import { TaskSegmentedControl } from "../../components/tasks/TaskSegmentedControl";
import { fetchTasks } from "../../api/tasks";
import { tasksListKey } from "../../lib/queryKeys";
import { partitionTasks } from "../../lib/taskUtils";
import { useTabBarInset } from "../../hooks/useTabBarInset";
import type { TasksStackParamList } from "../../navigation/types";
import type { TaskItem } from "../../types/tasks";
import { theme } from "../../theme";

export function TasksListScreen() {
  const bottom = useTabBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<TasksStackParamList>>();
  const [tab, setTab] = useState<"available" | "completed">("available");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [achTask, setAchTask] = useState<TaskItem | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const q = useQuery({
    queryKey: tasksListKey,
    queryFn: fetchTasks,
    staleTime: 35_000,
  });

  const { available, completed } = useMemo(() => partitionTasks(q.data ?? [], nowMs), [q.data, nowMs]);
  const data = tab === "available" ? available : completed;

  const onRefresh = useCallback(() => {
    void q.refetch();
  }, [q]);

  const goDetail = useCallback(
    (taskId: string) => {
      navigation.navigate("TaskDetail", { taskId });
    },
    [navigation],
  );

  const renderItem: ListRenderItem<TaskItem> = useCallback(
    ({ item }) => (
      <TaskListCard
        task={item}
        nowMs={nowMs}
        onOpenTask={() => goDetail(item.id)}
        onOpenAchievement={item.achievement ? () => setAchTask(item) : undefined}
      />
    ),
    [goDetail, nowMs],
  );

  const keyExtractor = useCallback((item: TaskItem) => item.id, []);

  if (q.isLoading && q.data === undefined) {
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Задания" subtitle="Список квестов клана" />
        <TaskSegmentedControl value={tab} onChange={setTab} />
        <ListSkeleton count={5} />
      </AppScreen>
    );
  }

  if (q.isError) {
    const msg = q.error instanceof Error ? q.error.message : "Ошибка сети или сервера.";
    return (
      <AppScreen scroll bottomInset={bottom}>
        <ScreenHeader title="Задания" />
        <ErrorState title="Не удалось загрузить задания" message={msg} onRetry={onRefresh} />
        <Button variant="ghost" onPress={onRefresh}>
          Обновить
        </Button>
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false} bottomInset={bottom}>
      <ScreenHeader title="Задания" subtitle={tab === "available" ? "Активные квесты" : "Принятые модерацией"} />
      <TaskSegmentedControl
        value={tab}
        onChange={setTab}
        availableCount={available.length}
        completedCount={completed.length}
      />
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title={
              tab === "available"
                ? completed.length > 0
                  ? "Нет заданий в работе"
                  : "Нет доступных заданий"
                : "Нет выполненных заданий"
            }
            subtitle={
              tab === "available"
                ? completed.length > 0
                  ? "Текущие уже приняты или недоступны."
                  : "Новые задания появятся здесь."
                : "Принятые задания отобразятся в этом списке."
            }
            icon="clipboard-outline"
            style={{ marginTop: theme.space.md }}
          />
        }
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
      {achTask?.achievement ? (
        <AchievementDetailSheet
          visible
          onClose={() => setAchTask(null)}
          title={achTask.achievement.title}
          description={achTask.achievement.description ?? ""}
          rarity={achTask.achievement.rarity}
          points={achTask.achievement.points}
          iconUrl={achTask.achievement.iconUrl}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: theme.space.sm, flexGrow: 1 },
});
