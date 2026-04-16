# Обновленная архитектура мобильного приложения Solo для Android

## Изменения архитектуры согласно требованиям

### Ключевые изменения:
1. **Упрощенный UI**: Удалены нативные UI компоненты, оставлен только WebView контейнер
2. **Произвольное хранилище**: Поддержка папки `rootFolder` в любом месте файловой системы
3. **Без сжатия изображений**: Сохранение оригинального качества изображений
4. **Без темной темы**: Только светлая тема
5. **Без аналитики**: Удалены системы мониторинга и аналитики
6. **Мульти-магазин**: Поддержка публикации в Google Play и RuStore

## Общая архитектура

```mermaid
graph TB
    subgraph "UI Layer"
        A[MainActivity] --> B[WebViewFragment]
        A --> C[FolderPickerActivity]
        A --> D[SimpleSettingsActivity]
    end
    
    subgraph "Bridge Layer"
        B --> F[WebViewBridge]
        F --> G[JavaScriptInterface]
        G --> H[FileSystemManager]
        G --> I[AudioPlayer]
        G --> J[SearchEngine]
    end
    
    subgraph "Data Layer"
        H --> K[RootFolder Storage]
        K --> L[Произвольное местоположение]
        J --> M[Search Index]
        N[Assets] --> B
    end
    
    subgraph "Web Application"
        O[Solo Web App] --> B
        O --> P[TipTap Editor]
        O --> Q[Howler.js Audio]
        O --> R[Search UI]
    end
    
    F --> O
    O --> G
    
    subgraph "Permissions"
        S[MANAGE_EXTERNAL_STORAGE] --> H
        T[Storage Access Framework] --> C
    end
```

## Компонентная диаграмма (упрощенная)

```mermaid
graph LR
    subgraph "Android Application"
        A[MainActivity] --> B[WebViewBridge]
        A --> C[FileSystemManager]
        A --> D[AudioPlayer]
        A --> E[SearchEngine]
        A --> F[SimpleSettingsManager]
        
        B --> G[JavaScript Interface]
        G --> H[WebView]
        
        C --> I[RootFolder Storage]
        C --> J[MANAGE_EXTERNAL_STORAGE]
        D --> K[MediaPlayer]
        E --> L[Search Index]
        F --> M[SharedPreferences]
    end
    
    subgraph "Web Application"
        H --> N[Solo App]
        N --> O[Editor Component]
        N --> P[Search Component]
        N --> Q[Audio Component]
        N --> R[Image Upload]
    end
    
    subgraph "External"
        S[Google Play] --> A
        T[RuStore] --> A
    end
```

## Последовательность загрузки приложения (обновленная)

```mermaid
sequenceDiagram
    participant User
    participant MainActivity
    participant WebView
    participant WebViewBridge
    participant FileSystem
    participant StorageFramework
    participant SoloApp
    
    User->>MainActivity: Запуск приложения
    MainActivity->>StorageFramework: Проверка rootFolder
    alt rootFolder не выбран
        StorageFramework->>User: Диалог выбора папки
        User->>StorageFramework: Выбор rootFolder
    end
    StorageFramework-->>MainActivity: Путь к rootFolder
    MainActivity->>WebView: Инициализация
    MainActivity->>WebViewBridge: Создание bridge
    MainActivity->>FileSystem: Настройка rootFolder
    WebView->>SoloApp: Загрузка index.html из assets
    SoloApp->>WebViewBridge: Проверка доступности bridge
    WebViewBridge->>FileSystem: Запрос структуры файлов
    FileSystem-->>WebViewBridge: Структура папок
    WebViewBridge-->>SoloApp: Данные через JavaScript
    SoloApp-->>User: Отображение интерфейса
```

## Bridge API Диаграмма (обновленная)

```mermaid
graph TD
    subgraph "JavaScript Interface"
        A[selectFolder] --> B[Выбор папки через SAF]
        C[getDataFolder] --> D[Получение rootFolder]
        E[openFile] --> F[Чтение файла]
        G[updateFile] --> H[Запись файла]
        I[readStructure] --> J[Чтение структуры]
        K[search] --> L[Поиск по заметкам]
        M[playTypewriterSound] --> N[Воспроизведение звука]
        O[uploadImage] --> P[Загрузка изображений без сжатия]
    end
    
    subgraph "Android Implementation"
        B --> Q[Storage Access Framework]
        Q --> R[MANAGE_EXTERNAL_STORAGE]
        D --> S[SharedPreferences]
        F --> T[File.readText]
        H --> U[File.writeText]
        J --> V[File.walk]
        L --> W[SearchEngine.search]
        N --> X[MediaPlayer.play]
        P --> Y[Image Save Original Quality]
    end
```

## Структура проекта Android (обновленная)

```
solo/native-clients/android/
├── app/
│   ├── src/main/
│   │   ├── java/com/solo/
│   │   │   ├── MainActivity.kt
│   │   │   ├── bridge/
│   │   │   │   ├── WebViewBridge.kt
│   │   │   │   ├── FileSystemManager.kt
│   │   │   │   ├── AudioPlayer.kt
│   │   │   │   └── SearchEngine.kt
│   │   │   ├── ui/
│   │   │   │   ├── FolderPickerActivity.kt
│   │   │   │   └── SimpleSettingsActivity.kt
│   │   │   └── utils/
│   │   │       ├── PermissionHelper.kt
│   │   │       └── SecurityUtils.kt
│   │   ├── res/
│   │   │   ├── layout/
│   │   │   │   ├── activity_main.xml
│   │   │   │   ├── activity_folder_picker.xml
│   │   │   │   └── activity_settings.xml
│   │   │   └── values/
│   │   │       ├── colors.xml (только светлая тема)
│   │   │       └── strings.xml
│   │   └── assets/
│   │       ├── solo/          # Веб-приложение solo
│   │       │   ├── index.html
│   │       │   ├── assets/
│   │       │   └── ...
│   │       └── typewriter.mp3
│   ├── build.gradle.kts
│   └── AndroidManifest.xml
├── build.gradle.kts
└── settings.gradle.kts
```

## Поток данных при загрузке изображений (без сжатия)

```mermaid
sequenceDiagram
    participant User
    participant EditorUI
    participant WebViewBridge
    participant FileSystem
    participant Storage
    
    User->>EditorUI: Вставка изображения
    EditorUI->>WebViewBridge: uploadImage(base64Data, fileName)
    WebViewBridge->>FileSystem: saveImage(base64Data, fileName)
    FileSystem->>FileSystem: Декодирование base64
    FileSystem->>Storage: Сохранение оригинальных байтов
    Storage-->>FileSystem: Подтверждение записи
    FileSystem-->>WebViewBridge: Путь к сохраненному файлу
    WebViewBridge-->>EditorUI: URL изображения
    EditorUI-->>User: Отображение изображения
```

## Поток выбора папки с MANAGE_EXTERNAL_STORAGE

```mermaid
sequenceDiagram
    participant User
    participant App
    participant SAF
    participant System
    
    User->>App: Запрос выбора папки
    App->>System: Проверка разрешения MANAGE_EXTERNAL_STORAGE
    alt Разрешение есть
        App->>SAF: Запрос на выбор любой папки
        SAF->>User: Системный диалог выбора
        User->>SAF: Выбор rootFolder
        SAF-->>App: URI выбранной папки
        App->>App: Сохранение в SharedPreferences
    else Разрешения нет
        App->>System: Запрос разрешения
        System->>User: Диалог разрешения
        User->>System: Предоставление разрешения
        System-->>App: Подтверждение
        App->>SAF: Повторный запрос выбора
    end
```

## Технологический стек (обновленный)

| Компонент | Технология | Назначение | Изменения |
|-----------|------------|------------|-----------|
| Язык | Kotlin | Основной язык разработки | Без изменений |
| UI Framework | Jetpack Compose (минимально) | Базовый UI | Упрощен, удалены сложные компоненты |
| Архитектура | MVVM (упрощенная) | Организация кода | Удалена Clean Architecture для упрощения |
| Асинхронность | Kotlin Coroutines | Асинхронные операции | Без изменений |
| WebView | Android WebView + Accompanist | Отображение веб-приложения | Без изменений |
| Bridge | @JavascriptInterface | Коммуникация JS-Kotlin | Без изменений |
| Аудио | Android MediaPlayer | Воспроизведение звуков | Без изменений |
| Хранение | File API + SAF + MANAGE_EXTERNAL_STORAGE | Локальное хранение в произвольных папках | Добавлена поддержка произвольных путей |
| Поиск | Kotlin Sequence + Regex | Поиск по файлам | Без изменений |
| Разрешения | Android Permissions API | Управление разрешениями | Добавлен MANAGE_EXTERNAL_STORAGE |
| Публикация | Google Play + RuStore | Распространение приложения | Добавлена поддержка RuStore |

## Схема разрешений

```mermaid
graph TD
    A[Приложение] --> B[Основные разрешения]
    B --> C[INTERNET]
    B --> D[ACCESS_NETWORK_STATE]
    
    A --> E[Разрешения хранилища]
    E --> F[READ_EXTERNAL_STORAGE]
    E --> G[WRITE_EXTERNAL_STORAGE]
    E --> H[MANAGE_EXTERNAL_STORAGE]
    
    A --> I[Разрешения медиа]
    I --> J[READ_MEDIA_IMAGES]
    
    H --> K[Выбор произвольных папок]
    F --> L[Чтение файлов]
    G --> M[Запись файлов]
    J --> N[Доступ к галерее]
```

## Модель безопасности

### Защита от path traversal:
```kotlin
fun isPathSafe(file: File): Boolean {
    val rootPath = rootFolder?.canonicalPath ?: return false
    val filePath = file.canonicalPath
    // Проверка, что файл находится внутри rootFolder
    return filePath.startsWith(rootPath)
}
```

### Обработка разрешений:
1. **Runtime permissions**: READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE
2. **Special permission**: MANAGE_EXTERNAL_STORAGE (требует ручного одобрения пользователем)
3. **Storage Access Framework**: Для выбора папок без MANAGE_EXTERNAL_STORAGE

### Изоляция данных:
- Все операции файловой системы ограничены `rootFolder`
- JavaScript bridge имеет доступ только к методам FileSystemManager
- Проверка всех путей на безопасность

## Конфигурация сборки для разных магазинов

### Google Play:
```gradle
android {
    defaultConfig {
        applicationId "com.solo.app"
        versionCode 1
        versionName "1.0"
    }
    
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt')
        }
    }
}
```

### RuStore:
```gradle
android {
    defaultConfig {
        applicationId "com.solo.app"
        versionCode 1
        versionName "1.0"
        // Специфичные настройки для RuStore
    }
    
    // Возможные дополнительные конфигурации
    flavorDimensions "store"
    productFlavors {
        googlePlay {
            dimension "store"
            // Настройки для Google Play
        }
        companyStore {
            dimension "store"
            // Настройки для RuStore
        }
    }
}
```

## Миграция с electron.ts на nativeBridge.ts

### Изменения в кодовой базе:
1. **Переименование файла**: `src/utils/electron.ts` → `src/utils/nativeBridge.ts`
2. **Обновление импортов**: Во всех файлах, импортирующих electron.ts
3. **Унификация API**: Создание общего интерфейса для Electron и Android
4. **Определение платформы**: Логика определения доступного API

### Новая структура nativeBridge.ts:
```typescript
// Общий интерфейс для всех платформ
interface NativeAPI {
    readStructure(): Promise<{success: boolean, structure?: FileNode[], error?: string}>;
    openFile(path: string): Promise<{success: boolean, content?: string, error?: string}>;
    updateFile(path: string, content: string): Promise<{success: boolean, error?: string}>;
    selectFolder(): Promise<{success: boolean, path?: string, error?: string}>;
    getDataFolder(): Promise<{success: boolean, path?: string, error?: string}>;
    playTypewriterSound(): Promise<void>;
    uploadImage(base64Data: string, fileName: string): Promise<{success: boolean, url?: string, error?: string}>;
}

// Определение доступного API
export function getPlatformAPI(): NativeAPI | null {
    if (window.electronAPI) {
        return window.electronAPI as NativeAPI;
    } else if (window.androidBridge) {
        return window.androidBridge as NativeAPI;
    } else {
        return null; // Веб-версия
    }
}
```

Эта обновленная архитектура отражает все изменения, запрошенные пользователем, и обеспечивает минималистичный, но функциональный подход к реализации Android версии Solo.