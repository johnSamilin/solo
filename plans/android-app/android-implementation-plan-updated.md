# Обновленный план реализации мобильного приложения Solo для Android

## Изменения согласно требованиям пользователя

### 1. Удаление темной темы
- **Изменение**: Убрана поддержка темной темы из плана реализации
- **Причина**: Пользователю не нужна темная тема, важен минимализм
- **Влияние на план**: 
  - Удалить пункт "Настроить тему приложения (light/dark mode)" из раздела 2.1
  - Удалить настройки темы из экрана настроек (раздел 5.3)
  - Использовать только светлую тему в приложении

### 2. Отказ от сжатия изображений
- **Изменение**: Убрано сжатие изображений при загрузке
- **Причина**: Важно сохранить качество изображений без изменений
- **Влияние на план**:
  - Удалить пункт "Добавить сжатие изображений для оптимизации" из раздела 4.3
  - Изменить метод `uploadImage` для сохранения оригинального качества
  - Увеличить лимиты памяти для работы с большими изображениями

### 3. Хранение данных в произвольной папке с повышенными разрешениями
- **Изменение**: Заметки и изображения хранятся в папке `rootFolder`, которая может находиться в любом месте файловой системы
- **Причина**: Гибкость выбора места хранения данных
- **Влияние на план**:
  - Добавить запрос разрешения `MANAGE_EXTERNAL_STORAGE` в AndroidManifest.xml
  - Реализовать выбор папки через Storage Access Framework с поддержкой любых местоположений
  - Обновить FileSystemManager для работы с произвольными путями
  - Добавить проверку безопасности для произвольных путей

### 4. Удаление нативных UI компонентов (пункт 5.1)
- **Изменение**: Убрана реализация нативных UI компонентов
- **Причина**: Веб-приложение уже имеет необходимый UI, важен минимализм
- **Влияние на план**:
  - Удалить весь раздел 5.1 "Нативный UI компоненты"
  - Упростить MainActivity до базового WebView контейнера
  - Убрать Navigation Drawer, Search Bar, FAB, Bottom Navigation
  - Сохранить только минимальную навигацию для выбора папки и настроек

### 5. Переименование electron.ts в nativeBridge.ts
- **Изменение**: Файл `electron.ts` будет переименован в `nativeBridge.ts`
- **Причина**: Унификация названия для поддержки разных платформ
- **Влияние на план**:
  - Обновить импорты во всем проекте
  - Изменить логику определения платформы
  - Обновить документацию и комментарии

### 6. Публикация не только в Google Play, но и в RuStore
- **Изменение**: Добавлена поддержка публикации в альтернативном магазине приложений
- **Причина**: Расширение аудитории приложения
- **Влияние на план**:
  - Добавить подготовку сборки для RuStore
  - Настроить специфичные требования магазина
  - Обновить раздел 7.2 "Сборка и публикация"

### 7. Удаление аналитики и мониторинга
- **Изменение**: Убраны analytics и crash reporting
- **Причина**: Пользователю не нужна аналитика и мониторинг
- **Влияние на план**:
  - Удалить пункт "Реализовать analytics и crash reporting" из раздела 7.1
  - Убрать соответствующие зависимости из Gradle
  - Упростить код приложения

## Обновленный план реализации

### Фаза 1: Настройка проекта и инфраструктуры

#### 1.1 Создание Android проекта
- Создать новый Android проект в `solo/native-clients/android/`
- Настроить структуру модулей (app модуль)
- Настроить Gradle с необходимыми зависимостями
- Настроить минимальную версию API 24 (Android 7.0)

#### 1.2 Конфигурация сборки
- Добавить зависимости:
  - Jetpack Compose для UI (минимальные компоненты)
  - Kotlin Coroutines для асинхронности
  - Accompanist для WebView
- Настроить proguard/r8 правила
- Настроить signing config для релиза
- Добавить разрешение `MANAGE_EXTERNAL_STORAGE` в AndroidManifest.xml

#### 1.3 Подготовка веб-приложения
- Собрать веб-приложение solo в single-file режим
- Скопировать собранные файлы в `app/src/main/assets/solo/`
- Добавить аудио файл `typewriter.mp3` в assets

### Фаза 2: Реализация базовой инфраструктуры

#### 2.1 MainActivity и минимальный UI
- Создать `MainActivity` как простой контейнер для WebView
- Реализовать базовую навигацию для выбора папки
- Использовать только светлую тему приложения

#### 2.2 WebView интеграция
- Создать `WebViewFragment` для отображения веб-приложения
- Настроить WebView с поддержкой JavaScript
- Реализовать загрузку локального HTML из assets

#### 2.3 Bridge инфраструктура
- Создать базовый класс `WebViewBridge`
- Настроить `@JavascriptInterface` методы
- Реализовать безопасную коммуникацию между JS и Kotlin

### Фаза 3: Реализация File System Bridge с поддержкой произвольных папок

#### 3.1 FileSystemManager с поддержкой MANAGE_EXTERNAL_STORAGE
- Реализовать класс для работы с файловой системой Android
- Добавить проверку безопасности путей (path traversal)
- Реализовать методы для чтения/записи файлов в произвольных папках
- Добавить поддержку разрешения `MANAGE_EXTERNAL_STORAGE`

#### 3.2 Основные API методы
- `selectFolder()` - диалог выбора папки через Storage Access Framework с поддержкой любых местоположений
- `getDataFolder()` - получение текущей выбранной папки (rootFolder)
- `openFile(relativePath)` - чтение файла с кодировкой UTF-8
- `updateFile(relativePath, content)` - запись файла
- `readStructure()` - рекурсивное чтение структуры папок

#### 3.3 Метаданные и теги
- Реализовать парсинг JSON метаданных файлов
- Добавить поддержку тегов и paragraph tags
- Реализовать кэширование структуры для производительности

### Фаза 4: Реализация дополнительных функций

#### 4.1 AudioPlayer для звука пишущей машинки
- Создать `AudioPlayer` класс на основе MediaPlayer
- Реализовать метод `playTypewriterSound()`
- Добавить управление громкостью

#### 4.2 SearchEngine
- Реализовать индексацию файлов при загрузке
- Добавить fuzzy search алгоритм на Kotlin
- Реализовать фильтрацию по тегам (AND/OR/NOT)
- Оптимизировать поиск для больших коллекций

#### 4.3 Image Upload поддержка (без сжатия)
- Реализовать выбор изображений из галереи
- Сохранять изображения в оригинальном качестве
- Реализовать сохранение изображений в папку assets выбранной rootFolder

### Фаза 5: Минимальные UI/UX улучшения

#### 5.1 Адаптация веб-интерфейса
- Добавить meta viewport tag для responsive design
- Настроить CSS media queries для мобильных устройств
- Оптимизировать touch interactions в редакторе

#### 5.2 Минимальные настройки приложения
- Создать экран настроек с SharedPreferences
- Добавить настройки звука и шрифтов
- Реализовать выбор папки данных (rootFolder)

### Фаза 6: Интеграция и тестирование

#### 6.1 Интеграция с веб-приложением
- Модифицировать `nativeBridge.ts` (бывший `electron.ts`) для поддержки Android
- Обновить `useTypewriterSound.ts` для определения платформы
- Протестировать все bridge методы

#### 6.2 Тестирование
- Написать unit tests для FileSystemManager, SearchEngine
- Реализовать UI tests с Espresso
- Протестировать на разных устройствах и версиях Android

#### 6.3 Оптимизация производительности
- Добавить кэширование для часто читаемых файлов
- Оптимизировать поисковый индекс
- Реализовать фоновую загрузку контента

### Фаза 7: Подготовка к релизу

#### 7.1 Полировка приложения
- Добавить иконку приложения
- Настроить splash screen
- Добавить поддержку разных языков

#### 7.2 Сборка и публикация в Google Play и RuStore
- Настроить CI/CD pipeline
- Создать release build с кодовой обфускацией
- Подготовить описание для Google Play Store
- Подготовить сборку и документацию для RuStore
- Публикация в оба магазина приложений

## Обновленная архитектура bridge

### WebViewBridge.kt (обновленная структура)
```kotlin
class WebViewBridge(
    private val context: Context,
    private val fileSystemManager: FileSystemManager,
    private val audioPlayer: AudioPlayer,
    private val searchEngine: SearchEngine
) {
    @JavascriptInterface
    fun selectFolder(): String {
        // Реализация выбора папки через Storage Access Framework
        // с поддержкой MANAGE_EXTERNAL_STORAGE для произвольных путей
    }
    
    @JavascriptInterface
    fun getDataFolder(): String {
        return fileSystemManager.getCurrentFolder()?.absolutePath ?: ""
    }
    
    @JavascriptInterface
    fun openFile(relativePath: String): String {
        return fileSystemManager.openFile(relativePath)
    }
    
    @JavascriptInterface
    fun updateFile(relativePath: String, content: String): Boolean {
        return fileSystemManager.updateFile(relativePath, content)
    }
    
    @JavascriptInterface
    fun readStructure(): String {
        return fileSystemManager.readStructure()
    }
    
    @JavascriptInterface
    fun playTypewriterSound() {
        audioPlayer.play()
    }
    
    @JavascriptInterface
    fun uploadImage(base64Data: String, fileName: String): String {
        // Сохранение изображения в оригинальном качестве
        return fileSystemManager.saveImage(base64Data, fileName)
    }
    
    @JavascriptInterface
    fun search(query: String, tags: String): String {
        return searchEngine.search(query, tags.split(","))
    }
}
```

### FileSystemManager.kt (обновленные методы для произвольных папок)
```kotlin
class FileSystemManager(private val context: Context) {
    private var rootFolder: File? = null
    
    fun setRootFolder(folder: File) {
        this.rootFolder = folder
    }
    
    fun getCurrentFolder(): File? = rootFolder
    
    fun openFile(relativePath: String): String {
        val file = File(rootFolder, relativePath)
        require(isPathSafe(file)) { "Path traversal attempt" }
        return file.readText()
    }
    
    fun updateFile(relativePath: String, content: String): Boolean {
        val file = File(rootFolder, relativePath)
        require(isPathSafe(file)) { "Path traversal attempt" }
        file.parentFile?.mkdirs()
        return file.writeText(content).let { true }
    }
    
    private fun isPathSafe(file: File): Boolean {
        val rootPath = rootFolder?.canonicalPath ?: return false
        val filePath = file.canonicalPath
        return filePath.startsWith(rootPath)
    }
    
    fun saveImage(base64Data: String, fileName: String): String {
        // Декодирование base64 и сохранение без сжатия
        val bytes = Base64.decode(base64Data, Base64.DEFAULT)
        val imageFile = File(rootFolder, "assets/$fileName")
        imageFile.parentFile?.mkdirs()
        imageFile.writeBytes(bytes)
        return "assets/$fileName"
    }
    
    fun readStructure(): List<FileNode> {
        // Рекурсивное чтение структуры папок
    }
}
```

### Интеграция с обновленным nativeBridge.ts
1. Переименование `electron.ts` в `nativeBridge.ts`:
```typescript
// Файл: src/utils/nativeBridge.ts
export async function loadFromNative(): Promise<ParseResult> {
    const api = getPlatformAPI();
    if (!api) {
        throw new Error('Native API not available');
    }

    const result = await api.readStructure();
    if (!result.success || !result.structure) {
        throw new Error(result.error || 'Failed to read structure');
    }

    return parseFileStructure(result.structure);
}

export function getPlatformAPI() {
    if (window.electronAPI) {
        return window.electronAPI;
    } else if (window.androidBridge) {
        return window.androidBridge;
    } else {
        // Веб-версия или fallback
        return null;
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
2. FileSystem bridge с поддержкой произвольных папок и MANAGE_EXTERNAL_STORAGE
3. Basic bridge методы (openFile, updateFile, readStructure)
4. Выбор папки через Storage Access Framework

### Средний приоритет:
1. Поиск по заметкам
2. Звук пишущей машинки
3. Загрузка изображений без сжатия
4. Минимальные настройки приложения

### Низкий приоритет:
1. Поддержка публикации в RuStore
2. Расширенные функции редактора
3. Многоязычная поддержка

## Риски и митигации

| Риск | Митигация |
|------|-----------|
| Разрешение MANAGE_EXTERNAL_STORAGE может быть отклонено Google Play | Использовать Storage Access Framework как fallback, подготовить обоснование для Google Play |
| Производительность WebView на старых устройствах | Кэширование, оптимизация загрузки |
| Ограничения файловой системы Android с произвольными путями | Тщательное тестирование на разных версиях Android |
| Безопасность path traversal с произвольными корневыми папками | Строгая проверка canonical path, изоляция операций |
| Потребление памяти большими изображениями без сжатия | Постепенная загрузка, lazy loading изображений |

## Следующие шаги

1. Создать Android проект в `solo/native-clients/android/` с обновленной конфигурацией
2. Реализовать базовую интеграцию WebView с минимальным UI
3. Разработать FileSystemManager с поддержкой MANAGE_EXTERNAL_STORAGE и произвольных папок
4. Переименовать `electron.ts` в `nativeBridge.ts` и обновить импорты
5. Протестировать bridge коммуникацию с обновленными требованиями
6. Постепенно добавлять остальные функции согласно обновленному плану