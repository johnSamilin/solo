# План реализации мобильного приложения Solo для Android

## Фаза 1: Настройка проекта и инфраструктуры

### 1.1 Создание Android проекта
- Создать новый Android проект в `solo/native-clients/android/`
- Настроить структуру модулей (app модуль)
- Настроить Gradle с необходимыми зависимостями
- Настроить минимальную версию API 24 (Android 7.0)

### 1.2 Конфигурация сборки
- Добавить зависимости:
  - Jetpack Compose для UI
  - Kotlin Coroutines для асинхронности
  - Navigation Component
  - Accompanist для WebView
- Настроить proguard/r8 правила
- Настроить signing config для релиза

### 1.3 Подготовка веб-приложения
- Собрать веб-приложение solo в single-file режим
- Скопировать собранные файлы в `app/src/main/assets/solo/`
- Добавить аудио файл `typewriter.mp3` в assets

## Фаза 2: Реализация базовой инфраструктуры

### 2.1 MainActivity и навигация
- Создать `MainActivity` с Navigation Drawer
- Реализовать базовую навигацию между экранами
- Настроить тему приложения (light/dark mode)

### 2.2 WebView интеграция
- Создать `WebViewFragment` для отображения веб-приложения
- Настроить WebView с поддержкой JavaScript
- Реализовать загрузку локального HTML из assets

### 2.3 Bridge инфраструктура
- Создать базовый класс `WebViewBridge`
- Настроить `@JavascriptInterface` методы
- Реализовать безопасную коммуникацию между JS и Kotlin

## Фаза 3: Реализация File System Bridge

### 3.1 FileSystemManager
- Реализовать класс для работы с файловой системой Android
- Добавить проверку безопасности путей (path traversal)
- Реализовать методы для чтения/записи файлов

### 3.2 Основные API методы
- `selectFolder()` - диалог выбора папки через Storage Access Framework
- `getDataFolder()` - получение текущей выбранной папки
- `openFile(relativePath)` - чтение файла с кодировкой UTF-8
- `updateFile(relativePath, content)` - запись файла
- `readStructure()` - рекурсивное чтение структуры папок

### 3.3 Метаданные и теги
- Реализовать парсинг JSON метаданных файлов
- Добавить поддержку тегов и paragraph tags
- Реализовать кэширование структуры для производительности

## Фаза 4: Реализация дополнительных функций

### 4.1 AudioPlayer для звука пишущей машинки
- Создать `AudioPlayer` класс на основе MediaPlayer
- Реализовать метод `playTypewriterSound()`
- Добавить управление громкостью и настройками звука

### 4.2 SearchEngine
- Реализовать индексацию файлов при загрузке
- Добавить fuzzy search алгоритм на Kotlin
- Реализовать фильтрацию по тегам (AND/OR/NOT)
- Оптимизировать поиск для больших коллекций

### 4.3 Image Upload поддержка
- Реализовать выбор изображений из галереи
- Добавить сжатие изображений для оптимизации
- Реализовать сохранение изображений в папку assets

## Фаза 5: UI/UX улучшения

### 5.1 Нативный UI компоненты
- Реализовать Navigation Drawer с быстрым доступом
- Добавить Search Bar в Toolbar
- Создать Floating Action Button для новой заметки
- Реализовать Bottom Navigation для основных разделов

### 5.2 Адаптация веб-интерфейса
- Добавить meta viewport tag для responsive design
- Настроить CSS media queries для мобильных устройств
- Оптимизировать touch interactions в редакторе

### 5.3 Настройки приложения
- Создать экран настроек с SharedPreferences
- Добавить настройки звука, темы, шрифтов
- Реализовать выбор папки данных

## Фаза 6: Интеграция и тестирование

### 6.1 Интеграция с веб-приложением
- Модифицировать `useTypewriterSound.ts` для поддержки Android
- Обновить `electron.ts` для определения платформы
- Протестировать все bridge методы

### 6.2 Тестирование
- Написать unit tests для FileSystemManager, SearchEngine
- Реализовать UI tests с Espresso
- Протестировать на разных устройствах и версиях Android

### 6.3 Оптимизация производительности
- Добавить кэширование для часто читаемых файлов
- Оптимизировать поисковый индекс
- Реализовать фоновую загрузку контента

## Фаза 7: Подготовка к релизу

### 7.1 Полировка приложения
- Добавить иконку приложения
- Настроить splash screen
- Добавить поддержку разных языков
- Реализовать analytics и crash reporting

### 7.2 Сборка и публикация
- Настроить CI/CD pipeline
- Создать release build с кодовой обфускацией
- Подготовить описание для Google Play Store
- Публикация в Google Play Console

## Детали реализации ключевых компонентов

### WebViewBridge.kt (структура)
```kotlin
class WebViewBridge(
    private val context: Context,
    private val fileSystemManager: FileSystemManager,
    private val audioPlayer: AudioPlayer,
    private val searchEngine: SearchEngine
) {
    @JavascriptInterface
    fun selectFolder(): String {
        // Реализация выбора папки
    }
    
    @JavascriptInterface
    fun openFile(relativePath: String): String {
        return fileSystemManager.openFile(relativePath)
    }
    
    @JavascriptInterface
    fun playTypewriterSound() {
        audioPlayer.play()
    }
    
    // ... другие методы
}
```

### FileSystemManager.kt (ключевые методы)
```kotlin
class FileSystemManager(private val context: Context) {
    private var dataFolder: File? = null
    
    fun setDataFolder(folder: File) {
        this.dataFolder = folder
    }
    
    fun openFile(relativePath: String): String {
        val file = File(dataFolder, relativePath)
        require(isPathSafe(file)) { "Path traversal attempt" }
        return file.readText()
    }
    
    private fun isPathSafe(file: File): Boolean {
        return file.canonicalPath.startsWith(dataFolder?.canonicalPath ?: "")
    }
    
    fun readStructure(): List<FileNode> {
        // Рекурсивное чтение структуры папок
    }
}
```

### Интеграция с существующим кодом solo
1. Модификация `src/utils/electron.ts`:
```typescript
export function getPlatformAPI() {
    if (window.electronAPI) {
        return window.electronAPI;
    } else if (window.androidBridge) {
        return window.androidBridge;
    } else {
        throw new Error('No platform API available');
    }
}
```

2. Обновление `useTypewriterSound.ts`:
```typescript
const audioSrc = window.androidBridge
    ? `android_asset://typewriter.mp3`
    : window.electronAPI
    ? `audio://${currentSettings.typewriterSound}.mp3`
    : `/${currentSettings.typewriterSound}.mp3`;
```

## Оценка сложности и приоритеты

### Высокий приоритет (MVP):
1. WebView с загрузкой веб-приложения
2. Basic FileSystem bridge (openFile, updateFile)
3. Навигация между заметками
4. Базовая структура проекта

### Средний приоритет:
1. Поиск по заметкам
2. Звук пишущей машинки
3. Нативный UI компоненты
4. Настройки приложения

### Низкий приоритет:
1. Продвинутые функции редактора
2. Синхронизация с desktop версией
3. Расширенные настройки темы
4. Analytics и мониторинг

## Риски и митигации

| Риск | Митигация |
|------|-----------|
| Производительность WebView на старых устройствах | Кэширование, оптимизация загрузки |
| Ограничения файловой системы Android | Использование Storage Access Framework |
| Совместимость с разными версиями Android | Минимальная версия API 24, тестирование |
| Безопасность path traversal | Строгая проверка путей, canonical path |
| Потребление памяти большими заметками | Постепенная загрузка, lazy loading |

## Следующие шаги

1. Создать Android проект в `solo/native-clients/android/`
2. Реализовать базовую интеграцию WebView
3. Разработать FileSystemManager с основными методами
4. Протестировать bridge коммуникацию
5. Постепенно добавлять остальные функции согласно плану
