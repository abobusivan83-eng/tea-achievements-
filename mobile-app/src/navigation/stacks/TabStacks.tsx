import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ShopScreen } from "../../screens/ShopScreen";
import { GiftsScreen } from "../../screens/GiftsScreen";
import { LeaderboardScreen } from "../../screens/LeaderboardScreen";
import { TasksListScreen } from "../../screens/tasks/TasksListScreen";
import { TaskDetailScreen } from "../../screens/tasks/TaskDetailScreen";
import { AchievementsScreen } from "../../screens/AchievementsScreen";
import { NotificationsScreen } from "../../screens/NotificationsScreen";
import { ProfileScreen } from "../../screens/ProfileScreen";
import { ProfileEditScreen } from "../../screens/ProfileEditScreen";
import { AdminScreen } from "../../screens/AdminScreen";
import { PublicProfileScreen } from "../../screens/PublicProfileScreen";
import { PublicUserAchievementsScreen } from "../../screens/PublicUserAchievementsScreen";
import { SupportIdeaScreen } from "../../screens/SupportIdeaScreen";
import { SupportReportScreen } from "../../screens/SupportReportScreen";
import type {
  LeaderboardStackParamList,
  NotificationsStackParamList,
  ProfileStackParamList,
  ShopStackParamList,
  TasksStackParamList,
} from "../types";

const stackScreenOptions = {
  headerShown: false,
  animation: "slide_from_right" as const,
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
  detachInactiveScreens: true,
};

const ShopNav = createNativeStackNavigator<ShopStackParamList>();
const TasksNav = createNativeStackNavigator<TasksStackParamList>();
const NotifNav = createNativeStackNavigator<NotificationsStackParamList>();
const LbNav = createNativeStackNavigator<LeaderboardStackParamList>();
const ProfNav = createNativeStackNavigator<ProfileStackParamList>();

export function ShopStack() {
  return (
    <ShopNav.Navigator screenOptions={stackScreenOptions}>
      <ShopNav.Screen name="ShopMain" component={ShopScreen} />
      <ShopNav.Screen name="Gifts" component={GiftsScreen} />
    </ShopNav.Navigator>
  );
}

export function TasksStack() {
  return (
    <TasksNav.Navigator screenOptions={stackScreenOptions}>
      <TasksNav.Screen name="TasksMain" component={TasksListScreen} />
      <TasksNav.Screen name="TaskDetail" component={TaskDetailScreen} />
    </TasksNav.Navigator>
  );
}

export function NotificationsStack() {
  return (
    <NotifNav.Navigator screenOptions={stackScreenOptions}>
      <NotifNav.Screen name="NotificationsMain" component={NotificationsScreen} />
    </NotifNav.Navigator>
  );
}

export function LeaderboardStack() {
  return (
    <LbNav.Navigator screenOptions={stackScreenOptions}>
      <LbNav.Screen name="LeaderboardMain" component={LeaderboardScreen} />
      <LbNav.Screen name="PublicProfile" component={PublicProfileScreen} />
      <LbNav.Screen name="PublicAchievements" component={PublicUserAchievementsScreen} />
    </LbNav.Navigator>
  );
}

export function ProfileStack() {
  return (
    <ProfNav.Navigator screenOptions={stackScreenOptions}>
      <ProfNav.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfNav.Screen name="ProfileEdit" component={ProfileEditScreen} />
      <ProfNav.Screen name="AchievementsMain" component={AchievementsScreen} />
      <ProfNav.Screen name="PublicProfile" component={PublicProfileScreen} />
      <ProfNav.Screen name="PublicAchievements" component={PublicUserAchievementsScreen} />
      <ProfNav.Screen name="SupportIdea" component={SupportIdeaScreen} />
      <ProfNav.Screen name="SupportReport" component={SupportReportScreen} />
      <ProfNav.Screen name="AdminMain" component={AdminScreen} />
    </ProfNav.Navigator>
  );
}
