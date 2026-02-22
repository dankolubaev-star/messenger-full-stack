const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const { prisma, ensureTables } = require("./db");
const { exec } = require("child_process");
const SQLiteStore = require("connect-sqlite3")(session);

require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

process.env.DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";
process.env.PORT = process.env.PORT || 3001;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const PORT = process.env.PORT;

// Определяем путь к папке frontend
let frontendPath = path.join(__dirname, "frontend");
if (!fs.existsSync(frontendPath)) {
  frontendPath = path.join(__dirname, "../frontend");
}
console.log(`📁 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

app.use(express.json());

// Настройка сессий (храним в SQLite)
app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: __dirname }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 дней
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
          return done(null, false, { message: "Неверный email или пароль" });
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid)
          return done(null, false, { message: "Неверный email или пароль" });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    },
  ),
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerified: true,
      },
    });
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Middleware для проверки аутентификации
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: "Требуется авторизация" });
}

// Middleware для проверки подтверждения email
function ensureVerified(req, res, next) {
  if (req.user.emailVerified) return next();
  res.status(403).json({
    error: "Email не подтверждён",
    needsVerification: true,
    email: req.user.email,
  });
}

// Валидация
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });
  next();
};

// Настройка почты для Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Функция отправки кода подтверждения с добрым письмом
async function sendVerificationCode(email, code) {
  const mailOptions = {
    from: `"Messenger MVP" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Код подтверждения для мессенджера",
    text: `Здравствуйте! Спасибо, что выбрали наш мессенджер. Мы рады приветствовать вас!
    
Ваш код подтверждения: ${code}

Код действителен 15 минут. Если вы не запрашивали этот код, просто проигнорируйте это письмо.

С уважением, команда Messenger MVP.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px;">
        <h2 style="color: #333;">Добро пожаловать в Messenger MVP!</h2>
        <p>Здравствуйте! Спасибо, что выбрали наш мессенджер. Мы рады приветствовать вас!</p>
        <p style="font-size: 16px;">Ваш код подтверждения:</p>
        <p style="font-size: 24px; font-weight: bold; color: #007bff;">${code}</p>
        <p>Код действителен <strong>15 минут</strong>.</p>
        <p>Если вы не запрашивали этот код, просто проигнорируйте это письмо.</p>
        <hr style="border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">С уважением, команда Messenger MVP.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

// ========== API аутентификации ==========

// Регистрация
app.post(
  "/auth/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("phone")
      .optional()
      .matches(/^\+?[0-9]{10,15}$/),
    body("name").optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, phone, name } = req.body;
      const existing = await prisma.user.findFirst({
        where: { OR: [{ email }, { phone: phone || undefined }] },
      });
      if (existing) {
        return res
          .status(400)
          .json({ error: "Email или телефон уже используются" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const verifyCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          phone,
          name,
          emailVerifyCode: verifyCode,
          emailVerifyExpires: expiresAt,
          emailVerified: false,
        },
      });

      await sendVerificationCode(email, verifyCode);

      res
        .status(201)
        .json({ message: "Код отправлен на email", userId: user.id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Ошибка регистрации" });
    }
  },
);

// Подтверждение email
app.post(
  "/auth/verify",
  [body("email").isEmail(), body("code").isLength({ min: 6, max: 6 })],
  validate,
  async (req, res) => {
    try {
      const { email, code } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user)
        return res.status(404).json({ error: "Пользователь не найден" });
      if (user.emailVerified)
        return res.status(400).json({ error: "Email уже подтверждён" });
      if (user.emailVerifyCode !== code)
        return res.status(400).json({ error: "Неверный код" });
      if (new Date() > user.emailVerifyExpires)
        return res.status(400).json({ error: "Код истёк" });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifyCode: null,
          emailVerifyExpires: null,
        },
      });

      // Автоматический вход
      req.login(user, (err) => {
        if (err) throw err;
        res.json({
          message: "Регистрация прошла успешно! Добро пожаловать!",
          user: { id: user.id, email: user.email, name: user.name },
        });
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Ошибка подтверждения" });
    }
  },
);

// Повторная отправка кода
app.post(
  "/auth/resend-code",
  [body("email").isEmail()],
  validate,
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user)
        return res.status(404).json({ error: "Пользователь не найден" });
      if (user.emailVerified)
        return res.status(400).json({ error: "Email уже подтверждён" });

      const newCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerifyCode: newCode, emailVerifyExpires: expiresAt },
      });

      await sendVerificationCode(email, newCode);

      res.json({ message: "Код отправлен повторно" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Ошибка отправки кода" });
    }
  },
);

// Вход
app.post("/auth/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info.message });
    req.login(user, (err) => {
      if (err) return next(err);
      if (!user.emailVerified) {
        return res.status(403).json({
          error: "Email не подтверждён",
          needsVerification: true,
          email: user.email,
        });
      }
      return res.json({
        message: "Вход выполнен",
        user: { id: user.id, email: user.email, name: user.name },
      });
    });
  })(req, res, next);
});

// Выход
app.post("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Ошибка выхода" });
    req.session.destroy((err) => {
      if (err)
        return res.status(500).json({ error: "Ошибка завершения сессии" });
      res.clearCookie("connect.sid");
      res.json({ message: "Выход выполнен" });
    });
  });
});

// Статус аутентификации
app.get("/auth/status", (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ authenticated: true, user: req.user });
  } else {
    res.json({ authenticated: false });
  }
});

// Удаление аккаунта
app.delete("/auth/account", ensureAuthenticated, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    req.logout(() => {
      req.session.destroy(() => {
        res.json({ message: "Аккаунт удалён" });
      });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка удаления аккаунта" });
  }
});

// ========== API сообщений (только для аутентифицированных) ==========

// Получить историю сообщений
app.get("/messages", ensureAuthenticated, async (req, res) => {
  try {
    const take = Math.min(Number(req.query.take || 50), 200);

    const messages = await prisma.message.findMany({
      take,
      orderBy: { createdAt: "desc" },
      include: { sender: { select: { id: true, email: true, name: true } } },
    });

    res.json(messages.reverse());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// Создать сообщение
app.post(
  "/messages",
  ensureAuthenticated,
  ensureVerified,
  [body("text").trim().isLength({ min: 1, max: 1000 })],
  validate,
  async (req, res) => {
    try {
      const { text } = req.body;
      const senderId = req.user.id;

      const msg = await prisma.message.create({
        data: { text, senderId },
        include: { sender: { select: { id: true, email: true, name: true } } },
      });

      io.emit("new_message", msg);
      res.status(201).json(msg);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to create message" });
    }
  },
);

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Корневой маршрут
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ========== WebSocket ==========
io.on("connection", (socket) => {
  console.log(`🔌 User connected (socket id: ${socket.id})`);
  socket.on("disconnect", () => {
    console.log(`🔌 User disconnected (socket id: ${socket.id})`);
  });
});

app.post("/test/emit", (req, res) => {
  console.log("🧪 Тестовая отправка события");

  io.emit("new_message", {
    id: Date.now(),
    text: "Тест от сервера",
    sender: { name: "Server" },
    createdAt: new Date().toISOString(),
  });

  // ВАЖНО: именно json
  res.json({ ok: true });
});

// ========== Запуск сервера ==========
async function startServer() {
  await ensureTables();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);

    const url = `http://localhost:${PORT}`;
    if (process.platform === "win32") exec(`start ${url}`);
    else if (process.platform === "darwin") exec(`open ${url}`);
    else exec(`xdg-open ${url}`);
  });
}

startServer();
