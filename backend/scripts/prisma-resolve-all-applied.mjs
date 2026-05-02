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

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env,
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

console.log(`Marking ${folders.length} migration(s) as already applied (baseline)…`);
for (const name of folders) {
  console.log(`- prisma migrate resolve --applied ${name}`);
  run("npx", ["prisma", "migrate", "resolve", "--applied", name]);
}

console.log("Done. Next run: npx prisma migrate deploy");
