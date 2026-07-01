## Анализ реализации P2P-синхронизации Solo

После детального изучения всей кодовой базы P2P-синхронизации (25 файлов, ~5000 строк кода) представляю полный анализ.

### 🏗️ Общая архитектура

```
Web Layer (React + MobX)          Native Layer (Electron main)
┌──────────────────────┐          ┌──────────────────────────────┐
│  SyncStore →          │  IPC    │  sync-transport.ts →         │
│  TransportManager →   │ Bridge  │  SyncEngine → BluetoothManager│
│  PeerDiscovery        │◀──────▶│  SyncEngine → ConflictResolver│
│  SyncStatusBar        │          │  SyncEngine → FileWatcher    │
│  SyncConflictPanel    │          │  SyncEngine → BootScanner    │
│  SyncSettings         │          │  SyncEngine → SyncDatabase   │
└──────────────────────┘          │  SQLite (sync.db)            │
                                  └──────────────────────────────┘
```

Архитектура концептуально верная: Bridge-паттерн, разделение на web/native слои, SQLite для persistence. Однако реализация содержит **критические пробелы**.

---

### 🔴 Критические проблемы (блокирующие)

#### 1. BluetoothManager — 100% заглушка

Все методы — фиктивные:

| Метод | Файл | Что делает | Что должен делать |
|-------|------|------------|-------------------|
| `initialize()` | [`BluetoothManager.ts:53`](solo/native-clients/electron/electron/sync/BluetoothManager.ts:53) | `return true` | Инициализация Bluetooth-стека |
| `startDiscovery()` | [`BluetoothManager.ts:70`](solo/native-clients/electron/electron/sync/BluetoothManager.ts:70) | `await setTimeout(3000)` | SDP-запрос через UUID |
| `connect()` | [`BluetoothManager.ts:104`](solo/native-clients/electron/electron/sync/BluetoothManager.ts:104) | Создаёт `{address, write: ()=>{}}` | RFCOMM-соединение |
| `sendMessage()` | [`BluetoothManager.ts:153`](solo/native-clients/electron/electron/sync/BluetoothManager.ts:153) | только `console.log` | Запись в сокет |

**Без реализации BluetoothManager вся система неработоспособна.**

#### 2. SyncEngine.runSyncSession() — не завершена

В [`SyncEngine.ts:442-450`](solo/native-clients/electron/electron/sync/SyncEngine.ts:442) находятся мёртвые комментарии вместо реальной логики:

```
// Шаг 3: Получаем MANIFEST от пира и вычисляем diff
// (Это асинхронно — пир пришлёт MANIFEST, а мы ответим MANIFEST_DIFF)
// Шаг 4: Передаём файлы, которые нужны пиру
// (Пир пришлёт MANIFEST_DIFF, мы ответим FILE)
// Шаг 5: Получаем файлы, которые нужны нам
// (Мы отправляем MANIFEST_DIFF, пир отвечает FILE)
```

**Сессия завершается SYNC_COMPLETE, не синхронизировав ни одного файла.**

#### 3. computeDiff() не отправляется пиру

[`computeDiff()`](solo/native-clients/electron/electron/sync/SyncEngine.ts:639) вычисляет, какие файлы нам нужны от пира. Но SyncEngine **никогда не отправляет** `MANIFEST_DIFF` пиру. В [`handleMessage()`](solo/native-clients/electron/electron/sync/SyncEngine.ts:546) он только обрабатывает запрос пира, но не инициирует свой.

#### 4. ConflictResolver не интегрирован

[`ConflictResolver.checkForConflict()`](solo/native-clients/electron/electron/sync/ConflictResolver.ts:47) существует, но нигде не вызывается в [`SyncEngine.ts`](solo/native-clients/electron/electron/sync/SyncEngine.ts). **Конфликты не детектируются.**

#### 5. Дублирование типов — угроза рассинхронизации

[`src/sync/types.ts`](solo/src/sync/types.ts) и [`electron/sync/types.ts`](solo/native-clients/electron/electron/sync/types.ts) — полные копии. Любое изменение требует правки в двух местах.

---

### 🟡 Серьёзные проблемы

| Проблема | Файл | Описание |
|----------|------|----------|
| **`lastSyncAt` всегда null** | [`SyncEngine.ts:230`](solo/native-clients/electron/electron/sync/SyncEngine.ts:230) | Поле не обновляется после сессии |
| **Нет авто-синхронизации** | [`SyncEngine.ts`](solo/native-clients/electron/electron/sync/SyncEngine.ts) | В плане `sync_interval_ms: 300000`, в коде нет таймера |
| **Android bridge не расширен** | [`nativeBridge.ts`](solo/src/utils/nativeBridge.ts) | Нет sync-методов для Android WebView |
| **FileWatcher — узкий фильтр** | [`FileWatcher.ts:26`](solo/native-clients/electron/electron/sync/FileWatcher.ts:26) | Только `.html`, `.json`, `.css` |
| **Типы IPC не согласованы** | [`sync-transport.ts`](solo/native-clients/electron/electron/handlers/sync-transport.ts) ↔ [`SyncStore.ts`](solo/src/stores/SyncStore.ts) | `syncGetStatus` возвращает `{success, status}`, а SyncStore читает как `SyncStatus` напрямую |

---

### 🟢 Мелкие замечания

- **Нет таймаутов** на HANDSHAKE, соединение, передачу файла — риск вечного зависания
- **Нет шифрования** payload
- **Нет retry-логики** при неудачной отправке
- **SyncEngine — God Object**: 830 строк, делает всё
- **Нет graceful degradation** при отсутствии Bluetooth
- **Нет тестов** на sync-функциональность

---

### 🎯 Итоговая оценка

| Компонент | Статус |
|-----------|--------|
| Архитектура (план) | ✅ Проработана |
| Типы и протокол | ✅ Корректны |
| SQLite schema | ✅ Отлично |
| UI (React/MobX) | ✅ Хорошо |
| IPC Bridge | ⚠️ Средне |
| BluetoothManager | ❌ **Заглушка, не реализован** |
| SyncEngine (логика) | ❌ **Не закончена** |
| ConflictResolver | ⚠️ Написан, не интегрирован |
| Тесты | ❌ **Отсутствуют** |

**Вывод:** Архитектура продумана, типы и протокол корректны, UI готов. Однако самая критическая часть — BluetoothManager и логика sync-сессии — либо не реализованы, либо реализованы как заглушки. **Система в текущем виде не выполняет синхронизацию.** Требуется доработка ~70% кода в native-слое.

### 📋 Приоритетный план доработки

1. **🔥 Срочно:** Реализовать BluetoothManager для реальной платформы (macOS IOBluetooth / Linux BlueZ)
2. **🔥 Срочно:** Завершить `runSyncSession()` — ожидание MANIFEST, отправка MANIFEST_DIFF, цикл FILE→FILE_ACK
3. **🔥 Срочно:** Интегрировать ConflictResolver в computeDiff()
4. **📌 Важно:** Устранить дублирование типов
5. **📌 Важно:** Исправить `lastSyncAt`
6. **📌 Важно:** Добавить авто-синхронизацию
7. **📌 Важно:** Расширить Android bridge
8. **💡 Улучшение:** Добавить таймауты, retry, тесты