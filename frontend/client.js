const socket = io(window.location.origin, { withCredentials: true });

const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");

const textInput = document.getElementById("text");

const sendBtn = document.getElementById("send");
const reloadBtn = document.getElementById("reload");

// Элементы аутентификации
const authContainer = document.getElementById("auth-container");
const userInfoDiv = document.getElementById("user-info");
const currentUserSpan = document.getElementById("current-user");
const logoutBtn = document.getElementById("logout-btn");
const deleteAccountBtn = document.getElementById("delete-account-btn");
const chatContainer = document.getElementById("chat-container");

// Вкладки
const tabBtns = document.querySelectorAll(".tab-btn");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

// Поля входа
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const loginEmailError = document.getElementById("login-email-error");
const loginPasswordError = document.getElementById("login-password-error");

// Поля регистрации
const regEmail = document.getElementById("reg-email");
const regName = document.getElementById("reg-name");
const regPhone = document.getElementById("reg-phone");
const regPassword = document.getElementById("reg-password");
const regPassword2 = document.getElementById("reg-password2");
const registerBtn = document.getElementById("register-btn");
const regEmailError = document.getElementById("reg-email-error");
const regNameError = document.getElementById("reg-name-error");
const regPhoneError = document.getElementById("reg-phone-error");
const regPasswordError = document.getElementById("reg-password-error");
const regPassword2Error = document.getElementById("reg-password2-error");

// Диалог подтверждения
const verifyDialog = document.getElementById("verify-dialog");
const verifyEmailSpan = document.getElementById("verify-email");
const verifyCode = document.getElementById("verify-code");
const verifyBtn = document.getElementById("verify-btn");
const resendCodeBtn = document.getElementById("resend-code");
const cancelVerifyBtn = document.getElementById("cancel-verify");

let currentUser = null;

function getSenderName(msg) {
  return (
    msg?.sender?.name ||
    msg?.sender?.email ||
    msg?.senderId ||
    msg?.sender?.id ||
    "Неизвестно"
  );
}

function isMyMessage(msg) {
  const myId = currentUser?.id;
  if (!myId) return false;
  return msg?.senderId === myId || msg?.sender?.id === myId;
}

function getSenderId(msg) {
  return msg?.senderId || msg?.sender?.id || null;
}

function getInitials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s[0].toUpperCase();
}

async function apiFetch(url, options = {}) {
  const opts = {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  };
  return fetch(url, opts);
}

// ========== Валидация ==========
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone) {
  if (!phone) return true;
  // Удаляем все пробелы, дефисы, скобки
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  const re = /^\+?[0-9]{10,15}$/;
  return re.test(cleaned);
}

function validateName(name) {
  if (!name) return true;
  return name.trim().length > 0;
}

function validatePassword(password) {
  return password.length >= 6;
}

function validatePasswordMatch(p1, p2) {
  return p1 === p2;
}

// Функции для обновления ошибок на форме входа
function validateLoginForm() {
  let isValid = true;

  if (!validateEmail(loginEmail.value.trim())) {
    loginEmailError.textContent =
      "Некорректный email. Пример: user@example.com";
    loginEmail.classList.add("error-border");
    isValid = false;
  } else {
    loginEmailError.textContent = "";
    loginEmail.classList.remove("error-border");
  }

  if (!validatePassword(loginPassword.value)) {
    loginPasswordError.textContent = "Пароль должен быть не менее 6 символов";
    loginPassword.classList.add("error-border");
    isValid = false;
  } else {
    loginPasswordError.textContent = "";
    loginPassword.classList.remove("error-border");
  }

  return isValid;
}

// Функции для обновления ошибок на форме регистрации
function validateRegisterForm() {
  let isValid = true;

  // Email
  if (!validateEmail(regEmail.value.trim())) {
    regEmailError.textContent = "Некорректный email. Пример: user@example.com";
    regEmail.classList.add("error-border");
    isValid = false;
  } else {
    regEmailError.textContent = "";
    regEmail.classList.remove("error-border");
  }

  // Имя
  if (regName.value.trim() && !validateName(regName.value)) {
    regNameError.textContent = "Имя не может быть пустым";
    regName.classList.add("error-border");
    isValid = false;
  } else {
    regNameError.textContent = "";
    regName.classList.remove("error-border");
  }

  // Телефон
  if (regPhone.value.trim() && !validatePhone(regPhone.value.trim())) {
    regPhoneError.textContent =
      "Телефон должен содержать 10-15 цифр, может начинаться с +. Пример: 79123456789";
    regPhone.classList.add("error-border");
    isValid = false;
  } else {
    regPhoneError.textContent = "";
    regPhone.classList.remove("error-border");
  }

  // Пароль
  if (!validatePassword(regPassword.value)) {
    regPasswordError.textContent = "Пароль должен быть не менее 6 символов";
    regPassword.classList.add("error-border");
    isValid = false;
  } else {
    regPasswordError.textContent = "";
    regPassword.classList.remove("error-border");
  }

  // Подтверждение пароля
  if (!validatePasswordMatch(regPassword.value, regPassword2.value)) {
    regPassword2Error.textContent = "Пароли не совпадают";
    regPassword2.classList.add("error-border");
    isValid = false;
  } else {
    regPassword2Error.textContent = "";
    regPassword2.classList.remove("error-border");
  }

  return isValid;
}

// Подписка на события ввода
loginEmail.addEventListener("input", validateLoginForm);
loginPassword.addEventListener("input", validateLoginForm);

regEmail.addEventListener("input", validateRegisterForm);
regName.addEventListener("input", validateRegisterForm);
regPhone.addEventListener("input", validateRegisterForm);
regPassword.addEventListener("input", validateRegisterForm);
regPassword2.addEventListener("input", validateRegisterForm);

// ========== Общие функции ==========
function setStatus(type, msg) {
  statusEl.className = type;
  statusEl.textContent = msg;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"]/g, function (match) {
    if (match === "&") return "&amp;";
    if (match === "<") return "&lt;";
    if (match === ">") return "&gt;";
    if (match === '"') return "&quot;";
    return match;
  });
}

function isNearBottom(el, threshold = 80) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

function ensureEmptyStateVisible(show) {
  const existing = document.getElementById("empty-state");
  if (show) {
    if (!existing) {
      const div = document.createElement("div");
      div.id = "empty-state";
      div.className = "empty-state";
      div.textContent = "Пока пусто — напиши первое сообщение 🙂";
      messagesEl.appendChild(div);
    }
  } else {
    if (existing) existing.remove();
  }
}

// ===== Date separators (Сегодня / Вчера / дата) =====
function dateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateLabel(d) {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((today - target) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";

  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function lastRenderedDateKey() {
  const seps = messagesEl.querySelectorAll(".date-sep");
  const last = seps[seps.length - 1];
  return last ? last.dataset.date : null;
}

function appendDateSeparator(d) {
  const key = dateKey(d);

  const sep = document.createElement("div");
  sep.className = "date-sep";
  sep.dataset.date = key;

  const span = document.createElement("span");
  span.textContent = dateLabel(d);
  sep.appendChild(span);

  messagesEl.appendChild(sep);
}

function maybeInsertDateSeparatorForMsg(msg) {
  const d = msg?.createdAt ? new Date(msg.createdAt) : new Date();
  const key = dateKey(d);
  const lastKey = lastRenderedDateKey();
  if (lastKey !== key) appendDateSeparator(d);
}

function displayMessage(msg) {
  try {
    const shouldStick = isNearBottom(messagesEl);
    ensureEmptyStateVisible(false);

    const senderId = getSenderId(msg);
    const mine = isMyMessage(msg);

    // Ищем последний отрисованный .msg (игнорим date-sep)
    const lastMsgEl = (() => {
      for (let i = messagesEl.children.length - 1; i >= 0; i--) {
        const el = messagesEl.children[i];
        if (el.classList && el.classList.contains("msg")) return el;
      }
      return null;
    })();

    const createdAt = msg.createdAt ? new Date(msg.createdAt) : new Date();
    const dayKey = dateKey(createdAt);

    // Группируем, если тот же sender и тот же день
    const isGrouped =
      !!lastMsgEl &&
      lastMsgEl.dataset.senderId === String(senderId) &&
      lastMsgEl.dataset.dayKey === dayKey;
    const prevEl = lastMsgEl;

    const msgDiv = document.createElement("div");
    msgDiv.className = `msg ${mine ? "self" : "other"}`;
    msgDiv.dataset.senderId = String(senderId);
    msgDiv.dataset.dayKey = dayKey;
    // По умолчанию: одиночное сообщение группы
    msgDiv.classList.add("group-single");

    if (isGrouped && prevEl) {
      // Если предыдущее было одиночным — станет началом группы
      if (prevEl.classList.contains("group-single")) {
        prevEl.classList.remove("group-single");
        prevEl.classList.add("group-start");
      }
      // Если предыдущее было концом — станет серединой
      else if (prevEl.classList.contains("group-end")) {
        prevEl.classList.remove("group-end");
        prevEl.classList.add("group-mid");
      }

      // Текущее сообщение становится концом группы
      msgDiv.classList.remove("group-single");
      msgDiv.classList.add("group-end");
    }

    // Аватар (показываем только если не grouped)
    if (!mine && !isGrouped) {
      const avatar = document.createElement("div");
      avatar.className = "avatar";
      const senderName = getSenderName(msg);
      avatar.textContent = getInitials(senderName);
      msgDiv.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    // Мета (имя + время) — только если не grouped
    if (!isGrouped) {
      const meta = document.createElement("div");
      meta.className = "meta";
      const sender = getSenderName(msg);
      const time = msg.createdAt
        ? new Date(msg.createdAt).toLocaleString()
        : "";
      meta.textContent = `${escapeHtml(sender)}`;
      bubble.appendChild(meta);
    }

    const textDiv = document.createElement("div");
    textDiv.className = "text";
    textDiv.textContent = msg.text;

    bubble.appendChild(textDiv);
    const timeEl = document.createElement("div");
    timeEl.className = "time";
    timeEl.textContent = createdAt.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    bubble.appendChild(timeEl);
    msgDiv.appendChild(bubble);

    messagesEl.appendChild(msgDiv);

    if (shouldStick) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch (e) {
    console.error("displayMessage error:", e);
  }
}

// ========== Загрузка сообщений ==========
async function loadMessages() {
  try {
    const res = await apiFetch("/messages?take=200");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Сервер вернул не массив");
    messagesEl.innerHTML = "";
    if (!data.length) {
      ensureEmptyStateVisible(true);
      return;
    }
    data.forEach((m) => {
      maybeInsertDateSeparatorForMsg(m);
      displayMessage(m);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } catch (e) {
    setStatus("error", "Ошибка загрузки: " + e.message);
  }
}

// ========== Аутентификация ==========

// Переключение вкладок
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.tab === "login") {
      loginForm.classList.add("active");
      registerForm.classList.remove("active");
    } else {
      loginForm.classList.remove("active");
      registerForm.classList.add("active");
    }
  });
});

// Проверка статуса при загрузке
async function checkAuthStatus() {
  try {
    const res = await apiFetch("/auth/status");
    const data = await res.json();
    if (data.authenticated) {
      currentUser = data.user;
      showAuthenticatedUI();
    } else {
      showUnauthenticatedUI();
    }
  } catch (e) {
    console.error("Ошибка проверки статуса:", e);
  }
}

function showAuthenticatedUI() {
  authContainer.style.display = "none";
  const userInfoCard = document.getElementById("user-info-card");
  if (userInfoCard) userInfoCard.style.display = "block";
  userInfoDiv.style.display = "flex";
  currentUserSpan.textContent = `${currentUser.name || currentUser.email} (${currentUser.email})`;
  chatContainer.style.display = "block";
  setStatus("", "");
  loadMessages();
}

function showUnauthenticatedUI() {
  authContainer.style.display = "block";
  const userInfoCard = document.getElementById("user-info-card");
  if (userInfoCard) userInfoCard.style.display = "none";
  userInfoDiv.style.display = "none";
  chatContainer.style.display = "none";
  messagesEl.innerHTML = "";
  textInput.value = "";
  setStatus("", "");
}

// Регистрация
registerBtn.addEventListener("click", async () => {
  // Очищаем предыдущие ошибки
  [
    regEmailError,
    regNameError,
    regPhoneError,
    regPasswordError,
    regPassword2Error,
  ].forEach((el) => {
    if (el) el.textContent = "";
  });
  [regEmail, regName, regPhone, regPassword, regPassword2].forEach((el) => {
    if (el) el.classList.remove("error-border");
  });

  if (!validateRegisterForm()) {
    setStatus("error", "Исправьте ошибки в форме");
    return;
  }

  const email = regEmail.value.trim();
  const password = regPassword.value;
  const name = regName.value.trim() || undefined;
  const phone = regPhone.value.trim()
    ? regPhone.value.replace(/[\s\-\(\)]/g, "")
    : undefined;

  try {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, phone }),
    });
    const data = await res.json();

    if (!res.ok) {
      // Обработка структурированных ошибок от express-validator
      if (data.errors && Array.isArray(data.errors)) {
        data.errors.forEach((err) => {
          const field = err.param;
          const msg = err.msg;
          if (field === "email") {
            regEmailError.textContent = msg;
            regEmail.classList.add("error-border");
          } else if (field === "phone") {
            regPhoneError.textContent = msg;
            regPhone.classList.add("error-border");
          } else if (field === "password") {
            regPasswordError.textContent = msg;
            regPassword.classList.add("error-border");
          } else if (field === "name") {
            regNameError.textContent = msg;
            regName.classList.add("error-border");
          }
        });
        setStatus("error", "Проверьте поля с ошибками");
      }
      // Обработка простой текстовой ошибки (например, дубликат)
      else if (data.error) {
        const errorMsg = data.error.toLowerCase();
        if (errorMsg.includes("email")) {
          regEmailError.textContent = data.error;
          regEmail.classList.add("error-border");
        } else if (errorMsg.includes("телефон")) {
          regPhoneError.textContent = data.error;
          regPhone.classList.add("error-border");
        } else {
          setStatus("error", data.error);
        }
      } else {
        setStatus("error", "Ошибка регистрации");
      }
      return;
    }

    // Успех – показываем диалог подтверждения
    verifyEmailSpan.textContent = email;
    verifyDialog.style.display = "flex";
    setStatus("ok", "Код отправлен на email");
  } catch (e) {
    setStatus("error", e.message);
  }
});

// Подтверждение кода
verifyBtn.addEventListener("click", async () => {
  const code = verifyCode.value.trim();
  const email = verifyEmailSpan.textContent;
  if (!code) {
    setStatus("error", "Введите код");
    return;
  }
  try {
    const res = await apiFetch("/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Ошибка подтверждения");
    }

    // Успешное подтверждение – автоматический вход
    currentUser = data.user;
    verifyDialog.style.display = "none";
    showAuthenticatedUI();
    setStatus("ok", "Регистрация прошла успешно! Добро пожаловать!");
  } catch (e) {
    setStatus("error", e.message);
  }
});

// Повторная отправка кода
resendCodeBtn.addEventListener("click", async () => {
  const email = verifyEmailSpan.textContent;
  try {
    const res = await apiFetch("/auth/resend-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setStatus("ok", "Код отправлен повторно");
  } catch (e) {
    setStatus("error", e.message);
  }
});

// Отмена диалога
cancelVerifyBtn.addEventListener("click", () => {
  verifyDialog.style.display = "none";
  verifyCode.value = "";
});

// Вход
loginBtn.addEventListener("click", async () => {
  if (!validateLoginForm()) {
    setStatus("error", "Исправьте ошибки в форме");
    return;
  }

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  try {
    const res = await apiFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.needsVerification) {
        verifyEmailSpan.textContent = data.email;
        verifyDialog.style.display = "flex";
        setStatus("error", data.error);
      } else {
        throw new Error(data.error || "Ошибка входа");
      }
      return;
    }
    currentUser = data.user;
    showAuthenticatedUI();
    setStatus("ok", "Вход выполнен");
  } catch (e) {
    setStatus("error", e.message);
  }
});

// Выход
logoutBtn.addEventListener("click", async () => {
  try {
    const res = await apiFetch("/auth/logout", { method: "POST" });
    if (!res.ok) throw new Error("Ошибка выхода");
    showUnauthenticatedUI();
    setStatus("ok", "Вы вышли");
  } catch (e) {
    setStatus("error", e.message);
  }
});

// Удаление аккаунта
deleteAccountBtn.addEventListener("click", async () => {
  if (
    !confirm(
      "Вы уверены, что хотите удалить аккаунт? Все сообщения будут безвозвратно удалены.",
    )
  )
    return;
  try {
    const res = await apiFetch("/auth/account", { method: "DELETE" });
    if (!res.ok) throw new Error("Ошибка удаления");
    showUnauthenticatedUI();
    setStatus("ok", "Аккаунт удалён");
  } catch (e) {
    setStatus("error", e.message);
  }
});

// ========== Отправка сообщений ==========
sendBtn.addEventListener("click", sendMessage);
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const text = textInput.value.trim();
  if (!text) return;
  try {
    const res = await apiFetch("/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Ошибка отправки");
    }
    textInput.value = "";
  } catch (e) {
    setStatus("error", e.message);
  }
}

// ========== WebSocket ==========
socket.on("new_message", (msg) => {
  const shouldStick = isNearBottom(messagesEl);
  ensureEmptyStateVisible(false);
  maybeInsertDateSeparatorForMsg(msg);
  displayMessage(msg);
  if (shouldStick) {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
});

reloadBtn.addEventListener("click", loadMessages);

// Инициализация
checkAuthStatus();
