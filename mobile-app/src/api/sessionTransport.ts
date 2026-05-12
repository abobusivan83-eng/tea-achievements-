/** Сброс axios-instance без импорта authStore (избегаем циклических зависимостей). */
let invalidateHttpClientImpl: () => void = () => {};

export function registerHttpClientInvalidator(fn: () => void): void {
  invalidateHttpClientImpl = fn;
}

export function invalidateHttpClient(): void {
  invalidateHttpClientImpl();
}
