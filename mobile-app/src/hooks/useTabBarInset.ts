import { theme } from "../theme";

/**
 * Высота визуальной части кастомного tab bar (иконки + подписи), без safe area.
 * Используется только в `PremiumTabBar`.
 */
export const TAB_BAR_CONTENT_HEIGHT = 54;

/**
 * Контент таб-экранов в React Navigation уже лежит **над** таб-баром — не добавляем
 * второй раз высоту панели (иначе «пустое пространство» между контентом и табами).
 * Оставляем лишь небольшой внутренний отступ у последних элементов.
 */
export function useTabBarInset() {
  return theme.space.md;
}
