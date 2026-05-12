/**
 * Одна точка входа перед EAS Cloud: проверки привязки проекта и сессии, затем build --wait.
 *
 * npm run build:apk:cloud
 *
 * Переменную EXPO_PUBLIC_API_BASE_URL нужно указать локально (.env или env) или в Expo Environment.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.join(__dirname, "..");
const isWin = process.platform === "win32";
const shell = isWin;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell, cwd: mobileRoot });
  process.exit(r.status ?? 1);
}

function loadDotEnv() {
  const envPath = path.join(mobileRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[key] === undefined || process.env[key] === "") process.env[key] = val;
  }
}

loadDotEnv();

const profileArg = process.argv[2]?.trim();
const profile = profileArg || process.env.EAS_PROFILE?.trim() || "preview-apk";

const expoCfg = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], {
  cwd: mobileRoot,
  encoding: "utf8",
  shell,
  maxBuffer: 10 * 1024 * 1024,
});

if ((expoCfg.status ?? 1) !== 0) {
  console.error(expoCfg.stderr || "expo config failed");
  process.exit(1);
}

/** @type {Record<string, unknown>} */
let cfg;
try {
  cfg = JSON.parse(expoCfg.stdout || "{}");
} catch {
  console.error("[EAS] Не удалось разобрать JSON из `npx expo config`.");
  process.exit(1);
}

const configExtra = cfg.extra && typeof cfg.extra === "object" ? cfg.extra : {};
const eas = configExtra.eas && typeof configExtra.eas === "object" ? configExtra.eas : {};
let projectId = typeof eas.projectId === "string" ? eas.projectId : null;

if (!projectId) {
  const easProjPath = path.join(mobileRoot, ".eas", "project.json");
  if (fs.existsSync(easProjPath)) {
    try {
      const ep = JSON.parse(fs.readFileSync(easProjPath, "utf8"));
      projectId =
        typeof ep.projectId === "string"
          ? ep.projectId
          : typeof ep.id === "string"
            ? ep.id
            : null;
    } catch {
      /* ignore */
    }
  }
}

if (!projectId) {
  console.error(`
[EAS] Проект не привязан к аккаунту Expo (нет extra.eas.projectId в смерженном app config).

  Один раз из каталога mobile-app выполните:
    npm run eas:init

  Затем снова:
    npm run build:apk:cloud
`);
  process.exit(1);
}

console.log(`[EAS] projectId=${projectId}`);
console.log(`[EAS] profile=${profile}`);

const whoami = spawnSync("npx", ["eas-cli@latest", "whoami"], { cwd: mobileRoot, encoding: "utf8", shell });
const loggedIn = (whoami.status ?? 1) === 0;
const token = Boolean(process.env.EXPO_TOKEN?.trim());

if (!loggedIn && !token) {
  console.error(`
[EAS] Нет авторизации Expo и переменная EXPO_TOKEN не задана.

  Войти:
    npx eas-cli@latest login

  Или экспортировать EXPO_TOKEN (robot access token для CI).
`);
  process.exit(1);
}

if (!loggedIn && token) {
  console.log("[EAS] Используется EXPO_TOKEN (non-interactive).");
}

if (!process.env.EXPO_PUBLIC_API_BASE_URL?.trim()) {
  console.warn(
    "[EAS] Локально EXPO_PUBLIC_API_BASE_URL не установлен.\n" +
      "Если сборка упадёт на этапе JS bundle — добавьте URL в Expo → Environment или в файл .env",
  );
}

const waitArg = process.env.EAS_WAIT === "0" ? [] : ["--wait"];
run("npx", [
  "eas-cli@latest",
  "build",
  "--platform",
  "android",
  "--profile",
  profile,
  "--non-interactive",
  ...waitArg,
]);
