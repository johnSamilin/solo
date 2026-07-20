/**
 * Доступ к feature-флагам.
 *
 * Значения задаются в `feature-flags.json` в корне проекта и раскрываются
 * на этапе компиляции через vite `define`:
 *  - платформа: `__IS_PACKAGED__` / `__IS_DESKTOP__` / `__IS_ANDROID__`;
 *  - активный набор целиком: `__ACTIVE_FEATURE_FLAGS__`;
 *  - каждый флаг отдельной булевой константой: `__FF_<NAME>__`
 *    (напр. `extended-search` -> `__FF_EXTENDED_SEARCH__`).
 *
 * Режим сборки определяется полностью на этапе компиляции: для каждой
 * платформы выполняется отдельная сборка (PLATFORM=desktop|android|packaged),
 * а per-flag константы позволяют минификатору вырезать мёртвый код.
 *
 * Для tree-shaking предпочтительно использовать статические геттеры из
 * объекта `flags` (например `flags.extendedSearch`) или явную константу
 * `__FF_EXTENDED_SEARCH__`, т.к. они сворачиваются в булев литерал.
 */

/** Активный режим работы текущей сборки (compile-time). */
export const currentMode: FeatureFlagMode = __IS_PACKAGED__
  ? 'PACKAGED'
  : __IS_ANDROID__
    ? 'MOBILE'
    : 'DESKTOP';

/** Активный набор feature-флагов (compile-time inlined). */
export const featureFlags: FeatureFlagSet = __ACTIVE_FEATURE_FLAGS__;

/**
 * Статические флаги, раскрываемые в булевы литералы на этапе компиляции.
 * Использование `flags.extendedSearch` позволяет минификатору вырезать
 * неактивные ветки полностью.
 */
export const flags = {
  extendedSearch: __FF_EXTENDED_SEARCH__,
  deepLinking: __FF_DEEP_LINKING__,
  defaultTheme: __FF_DEFAULT_THEME__,
} as const;

/**
 * Динамическая проверка флага по строковому имени.
 * Работает в рантайме через инлайненный объект активных флагов;
 * не даёт tree-shaking — для этого используйте `flags.*`.
 */
export function isFeatureEnabled(flag: string): boolean {
  return featureFlags[flag] === true;
}
