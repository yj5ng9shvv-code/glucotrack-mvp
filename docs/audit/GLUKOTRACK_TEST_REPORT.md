# GlukoTrack Test Report

## Выполненные тесты
- Backend unit tests:
  - `npm.cmd test` (директория `backend/`)
  - Результат: `34` passed, `0` failed (`duration_ms 674.1113`)
  - Покрытие: политики AI upload, billing/subscription, device identity, SOS PIN/location, sync conflicts, sensor merge

- Unit-тесты Flutter/Dart:
  - `test/sensor_adapter_test.dart` — добавлен и проверен на уровне кода
  - Фактический запуск блокирован в этой среде из‑за зависания `flutter test`/`flutter --version` в PTY без вывода.

## Неполные проверки (по заданию)
- Полный набор Flutter unit/widget/integration/e2e
- Проверки Android/iOS/Web/Desktop сборок
- Проверки локализации всех языков в рантайме

## Рекомендованный следующий прогон
Запустить в CI/локально с рабочим flutter-раннером:
1. `flutter test`
2. `flutter test --coverage`
3. `flutter build apk` / `flutter build appbundle` / `flutter build ios`
4. `flutter build web` и smoke-проверка install page
5. Windows build + локальная проверка запуска
