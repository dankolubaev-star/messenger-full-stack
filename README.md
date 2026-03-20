# Messenger Full Stack MVP

Локальный MVP-мессенджер на `Node.js` с сервером на `Express`, real-time обновлениями через `Socket.IO`, аутентификацией на сессиях и SQLite-базой через `Prisma`.

Текущий репозиторий уже содержит и backend, и простой frontend. Frontend раздаётся самим backend как статические файлы.

## Что уже реализовано

- регистрация по `email` и `password`
- подтверждение email 6-значным кодом
- повторная отправка кода подтверждения
- вход и выход через `passport-local`
- хранение сессий в SQLite через `express-session` + `connect-sqlite3`
- удаление аккаунта
- получение профиля текущего пользователя
- обновление профиля через API (`name`, `username`)
- загрузка общей истории сообщений
- отправка сообщений в общий чат
- мгновенная доставка новых сообщений через `Socket.IO`
- индикатор `typing`
- статический frontend с формами входа, регистрации и интерфейсом чата
- запуск с доступом:
  - на `localhost`
  - по локальному IP в одной сети
  - через `localtunnel`, если туннель поднялся успешно

## Текущий стек

- Backend: `Node.js`, `Express`, `Passport`, `Socket.IO`
- База данных: `SQLite`
- ORM: `Prisma`
- Сессии: `express-session`, `connect-sqlite3`
- Email: `nodemailer` с Gmail
- Frontend: ванильные `HTML + CSS + JavaScript`

## Структура проекта

```text
.
├── backend
│   ├── prisma
│   │   ├── migrations
│   │   └── schema.prisma
│   ├── scripts
│   │   └── seed.js
│   ├── .env
│   ├── db.js
│   ├── package.json
│   └── server.js
├── frontend
│   ├── client.js
│   └── index.html
├── docker-compose.yml
└── README.md
```

## Как это устроено

### Backend

Сервер находится в `backend/server.js` и отвечает за:

- HTTP API
- сессии и авторизацию
- отправку email-кодов
- работу с Prisma
- WebSocket-события
- раздачу `frontend/index.html` и `frontend/client.js`

### Frontend

Frontend лежит в папке `frontend` и не требует отдельного dev-сервера. После запуска backend приложение открывается в браузере автоматически.

### База данных

Фактическая конфигурация проекта сейчас использует:

- `Prisma`
- `SQLite`
- `DATABASE_URL=file:./dev.db`

Файлы БД и сессий создаются локально в папке `backend`.

## Требования

- `Node.js 18+`
- `npm`
- Gmail-аккаунт или другой Gmail mailbox с паролем приложения для отправки кодов подтверждения

## Настройка окружения

Сервер при старте требует `EMAIL_USER` и `EMAIL_PASS`. Если их нет, приложение завершится с ошибкой.

Создайте или обновите файл `backend/.env`:

```env
DATABASE_URL="file:./dev.db"
PORT=3001
SESSION_SECRET="dev-secret-change-me"
EMAIL_USER="your_gmail@gmail.com"
EMAIL_PASS="your_gmail_app_password"
```

Примечания:

- `EMAIL_PASS` должен быть именно app password, а не обычный пароль Gmail.
- `DATABASE_URL`, `PORT` и `SESSION_SECRET` имеют fallback-значения в коде, но для нормального запуска лучше явно задать их в `.env`.
- Без корректной почтовой конфигурации регистрация не имеет смысла, потому что подтверждение email обязательно для отправки сообщений.

## Запуск проекта

### 1. Установить зависимости

```bash
cd backend
npm install
```

### 2. Применить Prisma migration

```bash
npx prisma migrate dev
```

### 3. Запустить сервер

```bash
npm run dev
```

или:

```bash
npm start
```

После запуска сервер:

- поднимется на `http://localhost:<PORT>`
- будет доступен по локальному IP в вашей сети
- попытается поднять публичную ссылку через `localtunnel`
- автоматически откроет браузер

## Основные API endpoints

### Аутентификация

- `POST /auth/register` — регистрация
- `POST /auth/verify` — подтверждение email кодом
- `POST /auth/resend-code` — повторная отправка кода
- `POST /auth/login` — вход
- `POST /auth/logout` — выход
- `GET /auth/status` — проверка текущей сессии
- `DELETE /auth/account` — удаление аккаунта

### Профиль

- `GET /me` — получить профиль текущего пользователя
- `PATCH /me` — обновить `name` и `username`

### Сообщения

- `GET /messages?take=200` — получить историю сообщений
- `POST /messages` — отправить сообщение

### Служебные маршруты

- `GET /health` — healthcheck
- `GET /api/network-info` — локальный IP и порт
- `GET /api/public-url` — текущая публичная ссылка `localtunnel`
- `POST /test/emit` — тестовая отправка WebSocket-события

## WebSocket события

Используется `Socket.IO`.

Сервер отправляет:

- `new_message` — новое сообщение
- `typing` — состояние набора текста

Клиент отправляет:

- `typing`

## Модели данных

### User

- `id`
- `email`
- `phone`
- `name`
- `username`
- `password`
- `emailVerified`
- `emailVerifyCode`
- `emailVerifyExpires`
- `createdAt`

### Message

- `id`
- `text`
- `senderId`
- `createdAt`

## Что видно в интерфейсе

- вкладки входа и регистрации
- валидация полей на клиенте
- модальное окно подтверждения email
- список диалогов в интерфейсе
- общий поток сообщений
- визуальная группировка сообщений по отправителю и дате
- индикатор того, что другой пользователь печатает
- вкладка настроек профиля

## Известные ограничения и технический долг

Важно: ниже не планы, а наблюдения по текущему состоянию кода.

- Визуальные "диалоги" на frontend пока локальные и mock-only. Backend хранит не отдельные диалоги, а общий список сообщений.
- Кнопки сохранения/обновления профиля присутствуют в UI, но обработчики в `frontend/client.js` для них не реализованы до конца.
- Скрипт `backend/scripts/seed.js` устарел: он использует поле `passwordHash`, которого нет в текущей Prisma-схеме.
- `docker-compose.yml` в корне поднимает `PostgreSQL`, но текущее приложение настроено на `SQLite` и этот compose-файл сейчас не нужен для основного запуска.
- `ONBOARDING.md` и старый `README.md` описывали прежнее состояние проекта и не соответствовали текущей реализации.
- История сообщений общая для всех пользователей; приватные чаты на уровне backend ещё не реализованы.

## Полезные команды

```bash
cd backend
npm run dev
npm start
npx prisma migrate dev
npx prisma studio
```

## Статус проекта

Сейчас это рабочий MVP локального мессенджера с обязательной email-верификацией, базовой авторизацией и общим real-time чатом. Репозиторий уже содержит пользовательский интерфейс и сервер в одном проекте, но часть файлов вокруг него осталась от более ранних итераций и требует дальнейшей зачистки.
