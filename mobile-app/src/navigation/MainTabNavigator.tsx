import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LeaderboardStack, NotificationsStack, ProfileStack, ShopStack, TasksStack } from "./stacks/TabStacks";
import { PremiumTabBar } from "./PremiumTabBar";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <PremiumTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
      }}
      initialRouteName="Profile"
    >
      <Tab.Screen name="Profile" component={ProfileStack} options={{ title: "Профиль", tabBarLabel: "Профиль" }} />
      <Tab.Screen name="Tasks" component={TasksStack} options={{ title: "Задания", tabBarLabel: "Задания" }} />
      <Tab.Screen name="Shop" component={ShopStack} options={{ title: "Магазин", tabBarLabel: "Магазин" }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardStack} options={{ title: "Рейтинг", tabBarLabel: "Рейтинг" }} />
      <Tab.Screen
        name="Notifications"
        component={NotificationsStack}
        options={{ title: "Уведомления", tabBarLabel: "Уведомл." }}
      />
    </Tab.Navigator>
  );
}
