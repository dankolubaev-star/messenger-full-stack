const path = require("path");
const { PrismaClient } = require("@prisma/client");
 
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
 
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
 
async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ База данных подключена");
    return true;
  } catch (error) {
    console.error("❌ Ошибка подключения к БД:", error.message);
    return false;
  }
}

// Создание таблиц с новыми полями
async function initDatabase() {
  try {
    // Таблица User
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS User (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE,
        name TEXT,
        password TEXT NOT NULL,
        emailVerified INTEGER DEFAULT 0,
        emailVerifyCode TEXT,
        emailVerifyExpires DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    // Таблица Message
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS Message (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        senderId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (senderId) REFERENCES User(id) ON DELETE CASCADE
      )
    `;
    console.log("✅ Таблицы успешно созданы (или уже существуют)");
  } catch (e) {
    console.error("❌ Ошибка при создании таблиц:", e);
  }
}

async function ensureTables() {
  try {
    const tables = await prisma.$queryRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name='User'
    `;
    if (tables.length === 0) {
      console.log("📦 Таблицы не найдены, создаём...");
      await initDatabase();
    } else {
      console.log("✅ Таблицы уже существуют");
      // Можно проверить наличие новых колонок и добавить их при необходимости
      const columns = await prisma.$queryRaw`PRAGMA table_info(User)`;
      const hasPhone = columns.some(col => col.name === 'phone');
      const hasPassword = columns.some(col => col.name === 'password');
      if (!hasPassword || !hasPhone) {
        console.log("⚠️ Обновляем структуру таблицы User...");
        // В SQLite нельзя просто добавить колонку с NOT NULL и без значения по умолчанию,
        // поэтому проще удалить таблицу и создать заново (или предложить пользователю удалить dev.db)
        console.log("❌ Старая структура БД. Удалите файл dev.db и перезапустите приложение.");
        process.exit(1);
      }
    }
  } catch (e) {
    console.error("❌ Ошибка при проверке таблиц:", e);
    await initDatabase();
  }
}

async function shutdown() {
  await prisma.$disconnect();
  console.log("🔌 Отключение от базы данных");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { prisma, testConnection, initDatabase, ensureTables };
