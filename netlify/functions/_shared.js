const crypto = require("node:crypto");
const { getStore } = require("@netlify/blobs");

const cookieName = "ucen_sd_session";
const requiredEnv = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "DEFAULT_TUTOR_PASSWORD", "SESSION_SECRET"];

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

async function getUserStore() {
  return getStore("service-desk-users", blobOptions());
}

async function getStateStore() {
  return getStore("service-desk-scheduler", blobOptions());
}

async function readUsers() {
  assertRequiredEnv();
  const store = await getUserStore();
  const saved = await store.get("users", { type: "json" });
  if (saved?.users?.length) return saved.users.filter((user) => user.role !== "cafe_digital" && user.id !== "cafe-digital");
  const users = createDefaultUsers();
  await writeUsers(users);
  return users;
}

async function writeUsers(users) {
  const store = await getUserStore();
  await store.setJSON("users", { users });
}

async function findUserByEmail(email) {
  const users = await readUsers();
  return users.find((user) => user.email.toLowerCase() === String(email || "").trim().toLowerCase()) || null;
}

async function findUserById(id) {
  const users = await readUsers();
  return users.find((user) => user.id === id) || null;
}

function createDefaultUsers() {
  assertRequiredEnv();
  const tutors = [
    [process.env.TUTOR_MONSERRAT_EMAIL, "Monserrat Vargas"],
    [process.env.TUTOR_VIVIANA_EMAIL, "Viviana Briceño"],
    [process.env.TUTOR_FERNANDO_EMAIL, "Fernando García"],
    [process.env.TUTOR_DENISSE_BRAVO_EMAIL, "Denisse Bravo"],
    [process.env.TUTOR_DENISSE_ROSSEL_EMAIL, "Denisse Rossel"],
  ];

  return [
    createUser({
      id: "admin-cristopher",
      name: process.env.ADMIN_NAME || "Administrador",
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: "admin",
    }),
    ...tutors
      .filter(([email]) => Boolean(email))
      .map(([email, name]) =>
        createUser({
          id: `tutor-${slug(name)}`,
          name,
          email,
          password: process.env.DEFAULT_TUTOR_PASSWORD,
          role: "tutor",
        }),
      ),
  ];
}

function createUser({ id, name, email, password, role }) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    id,
    name,
    email,
    role,
    photo: "",
    passwordHash: hashPassword(password, salt),
    salt,
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };
}

function verifyPassword(user, password) {
  if (!user?.passwordHash || !user?.salt) return false;
  return crypto.timingSafeEqual(
    Buffer.from(user.passwordHash, "hex"),
    Buffer.from(hashPassword(password, user.salt), "hex"),
  );
}

function setUserPassword(user, password, mustChangePassword = false) {
  user.salt = crypto.randomBytes(16).toString("hex");
  user.passwordHash = hashPassword(password, user.salt);
  user.mustChangePassword = mustChangePassword;
  user.passwordChangedAt = new Date().toISOString();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password || ""), salt, 120000, 32, "sha256").toString("hex");
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    photo: user.photo || "",
    mustChangePassword: Boolean(user.mustChangePassword),
  };
}

async function createToken(user) {
  const expiresAt = Date.now() + Number(process.env.SESSION_DAYS || 7) * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ userId: user.id, expiresAt })).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

async function readUserFromEvent(event) {
  const token = readCookie(event, cookieName);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== sign(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.expiresAt || Date.now() > data.expiresAt) return null;
    return findUserById(data.userId);
  } catch {
    return null;
  }
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function sessionCookie(token) {
  const secure = process.env.COOKIE_SECURE === "false" ? "" : "; Secure";
  return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Number(process.env.SESSION_DAYS || 7) * 86400}${secure}`;
}

function clearCookie() {
  return `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(event, name) {
  const header = event.headers.cookie || event.headers.Cookie || "";
  return header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function readState() {
  const store = await getStateStore();
  const saved = await store.get("main-state", { type: "json" });
  if (saved) return saved;
  const initial = createDefaultState();
  await store.setJSON("main-state", initial);
  return initial;
}

async function writeState(state) {
  const store = await getStateStore();
  await store.setJSON("main-state", state);
}

function createDefaultState() {
  const agents = [
    "Monserrat Vargas",
    "Viviana Briceño",
    "Fernando García",
    "Denisse Bravo",
    "Denisse Rossel",
  ].map((name, index) => ({ id: crypto.randomUUID(), name, order: index }));
  const monserrat = agents.find((agent) => agent.name === "Monserrat Vargas");

  return {
    month: 4,
    year: 2026,
    agents,
    specialDays: [
      "2026-01-01",
      "2026-04-03",
      "2026-04-04",
      "2026-05-01",
      "2026-05-21",
      "2026-06-20",
      "2026-06-29",
      "2026-07-16",
      "2026-08-15",
      "2026-09-18",
      "2026-09-19",
      "2026-10-12",
      "2026-10-31",
      "2026-11-01",
      "2026-12-08",
      "2026-12-25",
    ].map((date) => ({ id: crypto.randomUUID(), date, type: "holiday" })),
    recurringLocks: [],
    absences: monserrat
      ? [{ id: crypto.randomUUID(), agentId: monserrat.id, type: "medical", from: "2026-01-01", to: "", indefinite: true }]
      : [],
    manualOverrides: {},
    schedule: {},
  };
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function assertRequiredEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno en Netlify: ${missing.join(", ")}`);
  }
}

function blobOptions() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) return { siteID, token };
  return undefined;
}

module.exports = {
  clearCookie,
  createDefaultState,
  createDefaultUsers,
  createToken,
  findUserByEmail,
  json,
  publicUser,
  readState,
  readUserFromEvent,
  readUsers,
  sessionCookie,
  setUserPassword,
  verifyPassword,
  writeState,
  writeUsers,
};

