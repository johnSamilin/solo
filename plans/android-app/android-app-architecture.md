# Архитектура мобильного приложения Solo для Android

## Общая архитектура

```mermaid
graph TB
    subgraph "UI Layer"
        A[MainActivity] --> B[WebViewFragment]
        A --> C[NavigationDrawer]
        A --> D[SearchFragment]
        A --> E[SettingsActivity]
    end
    
    subgraph "Bridge Layer"
        B --> F[WebViewBridge]
        F --> G[JavaScriptInterface]
        G --> H[FileSystemManager]
        G --> I[AudioPlayer]
        G --> J[SearchEngine]
    end
    
    subgraph "Data Layer"
        H --> K[Local File Storage]
        J --> L[Search Index]
        M[Assets] --> B
    end
    
    subgraph "Web Application"
        N[Solo Web App] --> B
        N --> O[TipTap Editor]
        N --> P[Howler.js Audio]
        N --> Q[Search UI]
    end
    
    F --> N
    N --> G
```

## Компонентная диаграмма

```mermaid
graph LR
    subgraph "Android Application"
        A[MainActivity] --> B[WebViewBridge]
        A --> C[FileSystemManager]
        A --> D[AudioPlayer]
        A --> E[SearchEngine]
        A --> F[SettingsManager]
        
        B --> G[JavaScript Interface]
        G --> H[WebView]
        
        C --> I[Local Storage]
        D --> J[MediaPlayer]
        E --> K[Search Index]
        F --> L[SharedPreferences]
    end
    
    subgraph "Web Application"
        H --> M[Solo App]
        M --> N[Editor Component]
        M --> O[Search Component]
        M --> P[Audio Component]
    end
```

## Последовательность загрузки приложения

```mermaid
sequenceDiagram
    participant User
    participant MainActivity
    participant WebView
    participant WebViewBridge
    participant FileSystem
    participant SoloApp
    
    User->>MainActivity: Запуск приложения
    MainActivity->>WebView: Инициализация
    MainActivity->>WebViewBridge: Создание bridge
    WebView->>SoloApp: Загрузка index.html из assets
    SoloApp->>WebViewBridge: Проверка доступности bridge
    WebViewBridge->>FileSystem: Запрос структуры файлов
    FileSystem-->>WebViewBridge: Структура папок
    WebViewBridge-->>SoloApp: Данные через JavaScript
    SoloApp-->>User: Отображение интерфейса
```

## Bridge API Диаграмма

```mermaid
graph TD
    subgraph "JavaScript Interface"
        A[selectFolder] --> B[Выбор папки]
        C[getDataFolder] --> D[Получение текущей папки]
        E[openFile] --> F[Чтение файла]
        G[updateFile] --> H[Запись файла]
        I[readStructure] --> J[Чтение структуры]
        K[search] --> L[Поиск по заметкам]
        M[playTypewriterSound] --> N[Воспроизведение звука]
        O[uploadImage] --> P[Загрузка изображений]
    end
    
    subgraph "Android Implementation"
        B --> Q[File Picker Dialog]
        D --> R[SharedPreferences]
        F --> S[File.readText]
        H --> T[File.writeText]
        J --> U[File.walk]
        L --> V[SearchEngine.search]
        N --> W[MediaPlayer.play]
        P --> X[Image Save]
    end
```

## Структура проекта Android

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
│   │   │   │   ├── components/
│   │   │   │   └── theme/
│   │   │   └── utils/
│   │   ├── res/
│   │   └── assets/
│   │       ├── solo/          # Веб-приложение solo
│   │       │   ├── index.html
│   │       │   ├── assets/
│   │       │   └── ...
│   │       └── typewriter.mp3
├── build.gradle.kts
└── settings.gradle.kts
```

## Поток данных при поиске

```mermaid
sequenceDiagram
    participant User
    participant SearchUI
    participant WebViewBridge
    participant SearchEngine
    participant FileSystem
    
    User->>SearchUI: Ввод поискового запроса
    SearchUI->>WebViewBridge: search(query, tags)
    WebViewBridge->>SearchEngine: Выполнить поиск
    SearchEngine->>FileSystem: Получить список HTML файлов
    FileSystem-->>SearchEngine: Список файлов
    loop Для каждого файла
        SearchEngine->>FileSystem: Чтение содержимого
        FileSystem-->>SearchEngine: Текст файла
        SearchEngine->>SearchEngine: Анализ и фильтрация
    end
    SearchEngine-->>WebViewBridge: Результаты поиска
    WebViewBridge-->>SearchUI: Отображение результатов
    SearchUI-->>User: Показать найденные заметки
```

## Технологический стек

| Компонент | Технология | Назначение |
|-----------|------------|------------|
| Язык | Kotlin | Основной язык разработки |
| UI Framework | Jetpack Compose | Современный UI toolkit |
| Архитектура | MVVM + Clean Architecture | Организация кода |
| Асинхронность | Kotlin Coroutines + Flow | Асинхронные операции |
| WebView | Android WebView + Chrome Custom Tabs | Отображение веб-приложения |
| Bridge | @JavascriptInterface | Коммуникация JS-Kotlin |
| Аудио | Android MediaPlayer | Воспроизведение звуков |
| Хранение | File API + SharedPreferences | Локальное хранение данных |
| Поиск | Kotlin Sequence + Regex | Поиск по файлам |
| Навигация | Navigation Component | Навигация между экранами |
