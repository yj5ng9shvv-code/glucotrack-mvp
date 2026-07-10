# Автоматическая установка MySQL/MariaDB

Backend сам устанавливает базу при первом запуске:

1. Подключается к MySQL/MariaDB.
2. Выполняет `CREATE DATABASE IF NOT EXISTS`.
3. Подключается к базе `DB_NAME`.
4. Создаёт все таблицы, индексы и внешние ключи.
5. Записывает версию в `schema_migrations`.
6. Только после успешной установки запускает HTTP API.

Повторный запуск безопасен: существующие база и таблицы не удаляются.

## Настройка `.env`

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=diabetik_app
DB_USER=admin_glukotrack
DB_PASSWORD=ваш_пароль
DB_CONNECTION_LIMIT=10
DB_AUTO_CREATE=true
```

После заполнения `.env`:

```bash
npm install --omit=dev
npm start
```

Отдельная проверка установки:

```bash
npm run db:install
```

## Ограничение Hestia

Hestia часто запрещает обычному пользователю MySQL создавать новые базы.
Если база уже создана в панели, это не мешает: все таблицы установятся
автоматически.

Если нужно автоматически создать и саму базу, укажите пользователя MySQL,
у которого есть право `CREATE DATABASE`:

```env
DB_ADMIN_USER=mysql_admin
DB_ADMIN_PASSWORD=пароль_администратора
```

Административные реквизиты используются только на этапе создания базы.
Приложение продолжает работать через `DB_USER`.

`DATABASE_URL` не используется.

## Проверка

```bash
curl http://127.0.0.1:8787/health
```

Успешный ответ содержит:

```json
{
  "ok": true,
  "database": {
    "ready": true,
    "database": "diabetik_app",
    "schemaVersion": 1
  }
}
```
