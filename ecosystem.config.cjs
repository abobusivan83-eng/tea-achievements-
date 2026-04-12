/**
 * PM2: два окружения на одном сервере (production + staging ЗБТ).
 * Пути и env-файлы поправьте под свой сервер.
 *
 * Node 20+: --env-file подхватывает переменные из .env.production / .env.staging
 *
 * Запуск:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: "tea-backend-production",
      cwd: "/var/www/tea-achievements/backend",
      script: "dist/server.js",
      interpreter: "node",
      interpreter_args: "--env-file=.env.production",
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
      time: true,
      error_file: "/var/log/pm2/tea-backend-production-error.log",
      out_file: "/var/log/pm2/tea-backend-production-out.log",
      merge_logs: true,
    },
    {
      name: "tea-backend-staging",
      cwd: "/var/www/tea-achievements-staging/backend",
      script: "dist/server.js",
      interpreter: "node",
      interpreter_args: "--env-file=.env.staging",
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      time: true,
      error_file: "/var/log/pm2/tea-backend-staging-error.log",
      out_file: "/var/log/pm2/tea-backend-staging-out.log",
      merge_logs: true,
    },
  ],
};
