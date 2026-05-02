import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

/**
 * One-time helper for production DBs that already contain schema/data but have no Prisma migration history.
 * When `prisma migrate deploy` fails with P3005, run this ONCE against the same DATABASE_URL/DIRECT_URL,
 * then run `prisma migrate deploy` again.
 *
 * Usage (from /backend):
 *   node ./scripts/prisma-resolve-all-applied.mjs
 *
 * Notes:
 * - On some networks (especially Windows + certain ISPs) Supabase transaction pooler port 6543 may be unreachable,
 *   while session pooler port 5432 works. Prisma CLI uses `DATABASE_URL` by default; for this baseline helper we
 *   prefer `DIRECT_URL` when present.
 */

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(backendRoot, "prisma", "migrations");

function listMigrationFolders() {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  return entries
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(migrationsDir, name, "migration.sql")))
    .sort((a, b) => a.localeCompare(b));
}

function run(cmd, args, env) {
  const res = spawnSync(cmd, args, {
    cwd: backendRoot,
    stdio: "inherit",
    env,
  });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

const folders = listMigrationFolders();
if (!folders.length) {
  console.error("No migrations found.");
  process.exit(1);
}

const directUrl = process.env.DIRECT_URL?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const preferDirect = (process.env.PRISMA_BASELINE_USE_DIRECT_URL ?? "true").toLowerCase() !== "false";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}
if (!directUrl) {
  console.error("Missing DIRECT_URL in environment. For Supabase + Prisma, DIRECT_URL should be session pooler :5432.");
  process.exit(1);
}

const migrateEnv = { ...process.env };
if (preferDirect) {
  migrateEnv.DATABASE_URL = directUrl;
}

console.log(
  `Using DATABASE_URL for migrate CLI: ${preferDirect ? "DIRECT_URL (session :5432)" : "DATABASE_URL (as-is)"}`,
);

console.log(`Marking ${folders.length} migration(s) as already applied (baseline)…`);
for (const name of folders) {
  console.log(`- prisma migrate resolve --applied ${name}`);
  run("npx", ["prisma", "migrate", "resolve", "--applied", name], migrateEnv);
}

console.log("Done. Next run: npx prisma migrate deploy");
