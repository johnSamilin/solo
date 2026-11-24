# Публикация Solo в Google Play, RuStore, F-Droid и Snap Store

Solo состоит из двух клиентов:

- Android: `native-clients/android`, Kotlin + WebView с веб-приложением;
- Linux desktop: `native-clients/electron`, Electron.

Android-версии уже разделены на flavors `googlePlay` и `ruStore`. Для Google Play нужен Android App Bundle (`.aab`), для RuStore - подписанный APK (`.apk`). F-Droid не принимает загруженные бинарные файлы: он собирает FOSS-приложение из исходного кода. Для появления Solo в магазине приложений Ubuntu нужно опубликовать Electron-клиент как snap в Snap Store.

## 1. Общая подготовка

1. Выбрать владельца, имя пакета и постоянные идентификаторы:

   - Android package: сейчас `com.solo.app`;
   - Snap name: например `solo-notes`, если `solo` уже занято;
   - GitHub repository: сейчас `https://github.com/johnSamilin/solo`.

   `applicationId` нельзя изменить после первой публикации без выпуска нового приложения. Сначала проверить, что `com.solo.app` свободен в Google Play Console и RuStore Console.

2. Поддерживать одну версию для всех клиентов. Сейчас Android и Electron используют `3.6.0`, Android `versionCode` равен `3`. Перед каждым релизом обновлять:

   - `version` в `package.json`;
   - `version` в `native-clients/electron/package.json`;
   - `versionName` и следующий по величине `versionCode` в `native-clients/android/app/build.gradle.kts`;
   - `CHANGELOG.md`.

3. Добавить в корень репозитория явную открытую лицензию, например `LICENSE` с текстом GPL-3.0-or-later или другой лицензии, совместимой с F-Droid. Сейчас README содержит `NO LICENSE`; это блокирует публикацию в F-Droid. Выбирать лицензию нужно только если автор действительно готов предоставить исходный код на ее условиях.

4. Подготовить публичные материалы:

   - политику конфиденциальности по стабильному HTTPS URL;
   - адрес поддержки;
   - иконку 512 x 512 px PNG;
   - минимум 2 честных скриншота Android-интерфейса;
   - описание, категорию и возрастной рейтинг;
   - полный список собираемых и передаваемых данных.

   В описании можно указать, что Solo хранит заметки локально в HTML. Нельзя заявлять «нет облака» или «нет передачи данных», пока это не подтверждено проверкой всех зависимостей и сетевых вызовов.

5. Выполнить базовую проверку веб- и desktop-клиента из корня репозитория:

   ```bash
   npm ci
   npm run lint
   npm test
   npm run build
   npm --prefix native-clients/electron ci
   npm --prefix native-clients/electron run lint
   npm --prefix native-clients/electron run typecheck
   ```

## 2. Подготовить Android-релиз

### Проверить разрешения

`native-clients/android/app/src/main/AndroidManifest.xml` содержит:

- `MANAGE_EXTERNAL_STORAGE`;
- `READ_MEDIA_IMAGES`;
- доступ к сети.

`MANAGE_EXTERNAL_STORAGE` - ограниченное разрешение Google Play. Оно допустимо только если полный доступ к хранилищу является основной функцией приложения. Для Solo предпочтительнее выбирать каталог через Storage Access Framework и сохранять долгосрочное разрешение на выбранный каталог, без доступа ко всему устройству. Если разрешение остается:

1. Подготовить видео, показывающее невозможность работы ключевой функции без него.
2. Заполнить декларацию **All files access** в Google Play Console.
3. Четко объяснить его необходимость RuStore.

Google Play также проверяет `targetSdk`. В проекте сейчас установлен API 34. Непосредственно перед отправкой сверить актуальное требование в Play Console и обновить `compileSdk`/`targetSdk` в `native-clients/android/app/build.gradle.kts`, если это требуется.

### Создать ключ подписи

Один keystore используется для всех будущих Android-обновлений и RuStore. Хранить его вне Git и создать защищенную резервную копию.

```bash
keytool -genkeypair \
  -keystore "$HOME/.android/solo-release.jks" \
  -alias solo \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

Создать `native-clients/android/keystore.properties` и добавить его в `.gitignore`:

```properties
storeFile=/Users/USER/.android/solo-release.jks
storePassword=CHANGE_ME
keyAlias=solo
keyPassword=CHANGE_ME
```

Затем подключить файл к `native-clients/android/app/build.gradle.kts`:

```kotlin
import java.util.Properties

val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    require(file.exists()) { "Release signing requires keystore.properties" }
    file.inputStream().use(::load)
}

android {
    signingConfigs {
        create("release") {
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
        }
    }
    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

Не добавлять реальные пароли или `.jks` в репозиторий. В CI хранить их только в protected/secret variables.

### Собрать и проверить

Веб-assets должны быть собраны до Gradle-сборки Android. Выполнять из корня репозитория:

```bash
npm ci
npm run build:android
./native-clients/android/gradlew -p native-clients/android clean test lint
./native-clients/android/gradlew -p native-clients/android bundleGooglePlayRelease assembleRuStoreRelease
```

Файлы релиза:

```bash
ls -lh native-clients/android/app/build/outputs/bundle/googlePlayRelease/app-googlePlay-release.aab
ls -lh native-clients/android/app/build/outputs/apk/ruStore/release/app-ruStore-release.apk
apksigner verify --verbose --print-certs \
  native-clients/android/app/build/outputs/apk/ruStore/release/app-ruStore-release.apk
```

Проверить RuStore APK на чистом устройстве:

```bash
adb uninstall com.solo.app
adb install native-clients/android/app/build/outputs/apk/ruStore/release/app-ruStore-release.apk
```

Проверить выбор каталога, создание/редактирование HTML-заметки, изображения, поиск, перезапуск приложения и обновление поверх предыдущей версии. AAB проверять через Internal testing Google Play.

## 3. Опубликовать в Google Play

1. Зарегистрировать Google Play Developer account, оплатить регистрационный взнос и пройти запрошенную верификацию.
2. В [Google Play Console](https://play.google.com/console/) создать приложение с package name `com.solo.app`.
3. Заполнить Store listing: название, описания, иконка, скриншоты, feature graphic 1024 x 500 px, контакты и политика конфиденциальности.
4. В **App content** заполнить Privacy policy, Ads, App access, Content rating, Target audience и Data safety.
5. Если `MANAGE_EXTERNAL_STORAGE` остается, заполнить All files access declaration с обоснованием и видео.
6. Включить Play App Signing при первом релизе. Google будет управлять app-signing key, а созданный keystore останется upload key.
7. Создать **Internal testing** release и загрузить:

   ```text
   native-clients/android/app/build/outputs/bundle/googlePlayRelease/app-googlePlay-release.aab
   ```

8. Установить версию из Play Store тестировщиками. Для новых личных аккаунтов Google может потребовать закрытое тестирование до production: следовать требованию Console.
9. После тестирования создать **Production** release, добавить release notes и отправить на проверку.

## 4. Опубликовать в RuStore

1. Создать и верифицировать кабинет в [RuStore Console](https://console.rustore.ru/) как физическое лицо, самозанятый, ИП или юридическое лицо.
2. Создать приложение с тем же package name `com.solo.app`.
3. Заполнить карточку: описание, категория, контакты, политика конфиденциальности, возрастной рейтинг, иконка и скриншоты.
4. Создать версию и загрузить:

   ```text
   native-clients/android/app/build/outputs/apk/ruStore/release/app-ruStore-release.apk
   ```

5. Заполнить сведения о данных, монетизации, рекламе и специальных разрешениях. Объяснить полный доступ к файлам, если он не удален.
6. Отправить на модерацию, после одобрения опубликовать и установить версию из RuStore на реальном устройстве.

## 5. Подготовить выпуск в F-Droid

F-Droid публикует только свободное и открытое ПО. Нельзя загрузить в него `app-ruStore-release.apk` или `app-googlePlay-release.aab`. Процесс такой: подготовить воспроизводимую сборку, добавить метаданные в репозиторий [fdroid/fdroiddata](https://gitlab.com/fdroid/fdroiddata) и дождаться, когда их инфраструктура соберет и подпишет APK.

### Обязательные условия

- В корне есть FOSS-лицензия, совместимая с исходным кодом и зависимостями.
- Исходный код Android, web-assets и все нужные зависимости доступны публично по неизменяемому git tag.
- Сборка не скачивает проприетарные зависимости, трекеры или закрытые SDK.
- Нет обязательных антифункций: рекламы, трекинга, обязательного внешнего аккаунта, несвободных сетевых сервисов без свободной альтернативы.
- Приложение строится без секретов, локальных путей и заранее скопированных неотслеживаемых assets.

Текущий проект нужно доработать до этого состояния: `copy-web-assets.sh` и Gradle-сборка должны сами собирать web-клиент либо получать его из исходников детерминированным способом. F-Droid build server не сможет использовать локально созданную папку `app/src/main/assets`, потому что она исключена из Git.

### Добавить Fastlane-метаданные

Создать каталог `native-clients/android/fastlane/metadata/android/en-US/` и как минимум файлы:

```text
title.txt
short_description.txt
full_description.txt
```

Поместить PNG-скриншоты в:

```text
native-clients/android/fastlane/metadata/android/en-US/images/phoneScreenshots/
```

Пример команд:

```bash
mkdir -p native-clients/android/fastlane/metadata/android/en-US/images/phoneScreenshots
touch native-clients/android/fastlane/metadata/android/en-US/title.txt
touch native-clients/android/fastlane/metadata/android/en-US/short_description.txt
touch native-clients/android/fastlane/metadata/android/en-US/full_description.txt
```

Добавить русскую локаль аналогично в `android/ru-RU/`.

### Сделать F-Droid-вариант

Создать flavor `fdroid` без сервисов или зависимостей, запрещенных политикой F-Droid. Его application ID должен быть тем же, что у основной FOSS-версии, например `com.solo.app`; flavor не должен добавлять обязательные проприетарные SDK.

После того как Gradle научится детерминированно готовить assets, локально проверить сборку:

```bash
npm ci
npm run build:android
./native-clients/android/gradlew -p native-clients/android assembleFdroidRelease
```

Создать подписанный git tag исходников:

```bash
git tag -s v3.6.0 -m "Solo 3.6.0"
git push origin v3.6.0
```

Подготовить файл `metadata/com.solo.app.yml` в fork репозитория `fdroid/fdroiddata`. В нем фиксируются source URL, tag/commit, Android subdirectory, Gradle flavor, номера версий, лицензия, описание сборки и anti-features при наличии. Использовать шаблон и валидатор из [документации F-Droid](https://f-droid.org/docs/Submitting_to_F-Droid_Quick_Start_Guide/), затем создать Merge Request в `fdroid/fdroiddata`.

Не использовать ключ Google Play для F-Droid: APK F-Droid подписывает своей подписью. Из-за разных подписей пользователи не смогут обновить APK из Google Play/RuStore через F-Droid и наоборот. Это нормальное ограничение, его стоит указать на странице загрузок.

## 6. Опубликовать Electron-клиент в Snap Store

Сейчас Electron Forge производит DEB, но `snapcraft.yaml` отсутствует. Нужен отдельный snap-рецепт. Размещать его удобно в корне репозитория: тогда сборка имеет доступ и к веб-проекту, и к `native-clients/electron`.

### Настроить Snapcraft

На Ubuntu установить инструменты и авторизоваться:

```bash
sudo snap install snapcraft --classic
snapcraft login
```

Зарегистрировать имя пакета заранее, чтобы его не занял другой разработчик:

```bash
snapcraft register solo-notes
```

Создать в корне проекта `snap/snapcraft.yaml`. Это рабочая стартовая конфигурация для x86_64; перед production заменить владельца, ссылки и версию:

```yaml
name: solo-notes
base: core22
version: "3.6.0"
summary: Local-first HTML notes
description: |
  Solo is a private local-first note-taking application.
  Notes are stored as HTML files chosen by the user.
grade: devel
confinement: strict
license: GPL-3.0-or-later
website: https://github.com/johnSamilin/solo
source-code: https://github.com/johnSamilin/solo
issues: https://github.com/johnSamilin/solo/issues
contact: https://t.me/WatasheeBaka
architectures:
  - build-on: [amd64]
    build-for: [amd64]

apps:
  solo-notes:
    command: opt/solo/solo
    desktop: usr/share/applications/solo-notes.desktop
    plugs:
      - desktop
      - desktop-legacy
      - wayland
      - x11
      - opengl
      - audio-playback
      - home

parts:
  solo:
    plugin: nil
    source: .
    build-packages:
      - nodejs
      - npm
      - python3
      - make
      - g++
    override-build: |
      npm ci
      npm --prefix native-clients/electron ci
      npm --prefix native-clients/electron run package
      mkdir -p "$CRAFT_PART_INSTALL/opt/solo"
      cp -a native-clients/electron/out/Solo-linux-x64/. "$CRAFT_PART_INSTALL/opt/solo/"
      mkdir -p "$CRAFT_PART_INSTALL/usr/share/applications"
      cp snap/gui/solo-notes.desktop "$CRAFT_PART_INSTALL/usr/share/applications/"
```

`native-clients/electron/out/Solo-linux-x64` - ожидаемый путь Electron Forge для текущего имени приложения. Если команда `package` выведет другой путь, заменить его в `cp` и закрепить это в рецепте.

Добавить `snap/gui/solo-notes.desktop`:

```ini
[Desktop Entry]
Name=Solo
Comment=Local-first HTML notes
Exec=solo-notes
Icon=solo-notes
Terminal=false
Type=Application
Categories=Office;Utility;
StartupWMClass=Solo
```

Скопировать PNG/SVG-иконку в `snap/gui/solo-notes.png`. Идентификатор `Icon=` в desktop-файле должен совпадать с именем иконки без расширения. Добавлять plug `removable-media` только если приложению действительно необходимы USB-накопители или SD-карты: он требует ручного подключения пользователем после установки.

Проверить, что desktop-клиент можно собрать на Ubuntu x86_64:

```bash
npm ci
npm --prefix native-clients/electron ci
npm --prefix native-clients/electron run make:linux
```

После добавления рецепта собрать и проверить snap:

```bash
snapcraft
sudo snap install --dangerous solo-notes_3.6.0_amd64.snap
solo-notes
snapcraft lint solo-notes_3.6.0_amd64.snap
```

`--dangerous` нужен только для локальной установки неподписанного snap. Проверить запуск, открытие и сохранение заметок, доступ к домашнему каталогу, файл-диалоги, иконку и появление программы в меню приложений Ubuntu.

### Отправить в Snap Store

1. Войти в [Snapcraft Dashboard](https://snapcraft.io/) тем же аккаунтом, которым зарегистрировано имя.
2. Проверить карточку приложения: описание, категория, лицензия, скриншоты, иконка, сайт и ссылка на исходники.
3. Отправить тестовую сборку в канал `edge`:

   ```bash
   snapcraft upload --release=edge solo-notes_3.6.0_amd64.snap
   ```

4. Установить ее на отдельной Ubuntu-машине:

   ```bash
   sudo snap install solo-notes --edge
   ```

5. После проверки продвинуть эту же ревизию в `candidate`, затем в `stable` через Dashboard или CLI:

   ```bash
   snapcraft release solo-notes <revision> candidate
   snapcraft release solo-notes <revision> stable
   ```

   `<revision>` - номер ревизии, который Snapcraft вернет после upload. После публикации в `stable` приложение будет доступно через Ubuntu App Center/Snap Store.

## 7. Выпуск обновлений

1. Обновить все номера версий и `CHANGELOG.md`.
2. Собрать и проверить Android-артефакты:

   ```bash
   npm ci
   npm run build:android
   ./native-clients/android/gradlew -p native-clients/android clean test lint \
     bundleGooglePlayRelease assembleRuStoreRelease
   ```

3. Загрузить новый AAB в Google Play и новый APK в RuStore. `versionCode` должен быть больше предыдущего.
4. Для F-Droid создать новый подписанный git tag и обновить build block в `fdroiddata` Merge Request.
5. Для Snap обновить версию, собрать и опубликовать:

   ```bash
   snapcraft
   snapcraft upload --release=edge solo-notes_<version>_amd64.snap
   ```

6. Сначала проверять обновления через Google Play internal/closed testing и Snap `edge`/`candidate`, затем переводить их в production/stable.

## Контрольный список

- [ ] Есть согласованная FOSS-лицензия и файл `LICENSE`.
- [ ] Политика конфиденциальности и контакты опубликованы.
- [ ] Проверены заявления о приватности и сетевой активности.
- [ ] Проверена или удалена необходимость `MANAGE_EXTERNAL_STORAGE`.
- [ ] `targetSdk` соответствует текущему требованию Google Play.
- [ ] Android keystore сохранен вне Git и зарезервирован.
- [ ] AAB Google Play и APK RuStore собраны и подписаны.
- [ ] Протестированы обновление и чистая установка Android-приложения.
- [ ] Для F-Droid сборка воспроизводима из публичного tag без локальных assets и секретов.
- [ ] Для F-Droid добавлены Fastlane metadata и Merge Request в `fdroiddata`.
- [ ] Добавлены `snap/snapcraft.yaml`, desktop-файл и иконка.
- [ ] Snap протестирован локально и опубликован в edge до stable.
