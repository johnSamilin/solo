# Сборка Android-приложения Solo

## Что нужно установить

1. **Android Studio** (версия Hedgehog или новее)
   - Скачать: https://developer.android.com/studio
   - Установить как обычную программу

2. **Node.js** (версия 18 или новее)
   - Скачать: https://nodejs.org/
   - Нужен для сборки веб-части приложения

## Подготовка веб-приложения

Перед открытием Android-проекта нужно собрать веб-часть и скопировать её в assets.

### На macOS / Linux

Открыть терминал и выполнить:

```bash
cd путь/к/проекту/solo
npm install
bash native-clients/android/copy-web-assets.sh
```

### На Windows

Открыть командную строку и выполнить:

```cmd
cd путь\к\проекту\solo
npm install
npm run build
xcopy /E /I /Y dist\* native-clients\android\app\src\main\assets\solo\
copy public\typewriter.mp3 native-clients\android\app\src\main\assets\typewriter.mp3
copy public\typewriter-1.mp3 native-clients\android\app\src\main\assets\typewriter-1.mp3
```

## Открытие проекта в Android Studio

1. Запустить Android Studio
2. Выбрать **"Open"** (не "New Project")
3. В диалоге выбора папки указать путь:
   ```
   путь/к/проекту/solo/native-clients/android
   ```
4. Нажать **"OK"**

Android Studio начнет синхронизацию проекта. Это занимает несколько минут при первом открытии -- скачиваются Gradle, Android SDK и зависимости.

Если появится предложение обновить Gradle plugin -- согласитесь.

## Генерация Gradle Wrapper (если нужно)

При первом открытии Android Studio может сообщить об отсутствии `gradle-wrapper.jar`. Это нормально. Для исправления:

1. В Android Studio откройте **Terminal** (панель внизу)
2. Выполните:
   ```
   gradle wrapper
   ```
   Или просто согласитесь с предложением Android Studio скачать wrapper автоматически.

## Запуск на устройстве или эмуляторе

### На физическом телефоне (рекомендуется)

1. На телефоне включить **Режим разработчика**:
   - Настройки -> О телефоне -> 7 раз нажать на "Номер сборки"
2. Включить **USB-отладку**:
   - Настройки -> Для разработчиков -> USB-отладка -> Включить
3. Подключить телефон USB-кабелем к компьютеру
4. На телефоне разрешить отладку при появлении запроса
5. В Android Studio:
   - Вверху слева выбрать variant: **googlePlayDebug** (или **ruStoreDebug**)
   - В выпадающем списке устройств выбрать подключённый телефон
   - Нажать зеленую кнопку **Run** (треугольник) или `Shift + F10`

### На эмуляторе

1. В Android Studio: **Tools -> Device Manager**
2. Нажать **"Create Device"**
3. Выбрать любой телефон (например, Pixel 6)
4. Выбрать системный образ с **API 34**
5. Нажать **"Finish"**
6. Запустить эмулятор, затем нажать **Run**

## Варианты сборки (Build Variants)

Проект имеет два варианта:

- **googlePlay** -- для Google Play Store
- **ruStore** -- для RuStore

Переключение: **Build -> Select Build Variant** (панель слева внизу).

Для отладки используйте `googlePlayDebug` или `ruStoreDebug`.

## Сборка APK для установки

Для создания файла APK, который можно отправить на телефон:

1. **Build -> Build Bundle(s) / APK(s) -> Build APK(s)**
2. Дождаться завершения сборки
3. Нажать на ссылку **"locate"** в уведомлении внизу
4. APK файл будет в:
   ```
   native-clients/android/app/build/outputs/apk/googlePlay/debug/app-googlePlay-debug.apk
   ```

Этот файл можно переслать на телефон и установить (потребуется разрешить установку из неизвестных источников).

## Сборка подписанного релиза

Для публикации в магазинах приложений нужна подпись:

1. **Build -> Generate Signed Bundle / APK**
2. Выбрать **APK** (или **Android App Bundle** для Google Play)
3. Создать новый keystore (или использовать существующий):
   - Нажать **"Create new..."**
   - Заполнить поля (запомнить пароль!)
   - Сохранить keystore в безопасное место
4. Выбрать **release** build type
5. Выбрать нужный flavor (googlePlay или ruStore)
6. Нажать **"Finish"**

## Решение частых проблем

### "SDK location not found"
Создайте файл `local.properties` в папке `native-clients/android/` с содержимым:
```
sdk.dir=/путь/к/Android/Sdk
```
На macOS обычно: `/Users/имя/Library/Android/sdk`
На Windows обычно: `C:\\Users\\имя\\AppData\\Local\\Android\\Sdk`

### "Failed to find target with hash string 'android-34'"
В Android Studio: **Tools -> SDK Manager -> SDK Platforms** -> отметить **Android 14 (API 34)** -> Apply.

### "Gradle wrapper not found"
В меню **File -> Invalidate Caches / Restart**, затем при открытии проекта согласиться с загрузкой wrapper.

### Приложение показывает белый экран
Проверьте, что веб-assets скопированы. Папка `app/src/main/assets/solo/` должна содержать `index.html`.

### При выборе папки приложение падает
На Android 11+ приложение запрашивает разрешение MANAGE_EXTERNAL_STORAGE. Это нормальное поведение -- разрешите доступ в настройках.
