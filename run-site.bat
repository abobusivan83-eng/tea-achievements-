@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Clan Site Launcher

REM ==================================================
REM Clan Salamanca - One-click launcher for Windows
REM - Starts backend + frontend in separate windows
REM - Soft mode: Prisma/DB steps do NOT hard-stop
REM - Keeps this window open with pause
REM ==================================================

REM Always run from the folder where this .bat lives
cd /d "%~dp0"

echo ==================================================
echo  Starting clan site (soft mode)
echo ==================================================

REM Optional debug: set TRACE=1 before running
if defined TRACE echo on

REM ---- Check Node.js
where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
  where node >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH.
    echo [HINT] Install Node.js LTS from https://nodejs.org
    echo [HINT] Or add: C:\Program Files\nodejs\ to PATH, then open a NEW CMD.
    echo.
    pause
    goto :end
  )
)

REM ---- Check npm
where npm >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] npm not found in PATH.
    echo [HINT] Reinstall Node.js with npm included, then open a NEW CMD.
    echo.
    pause
    goto :end
  )
)

REM ---- Basic structure checks
if not exist "backend\package.json" (
  echo [ERROR] Missing backend\package.json
  echo [HINT] Run this file from the project root folder.
  echo.
  pause
  goto :end
)
if not exist "frontend\package.json" (
  echo [ERROR] Missing frontend\package.json
  echo [HINT] Run this file from the project root folder.
  echo.
  pause
  goto :end
)

REM ---- Create .env from examples if missing
if not exist "backend\.env" (
  if exist "backend\.env.example" (
    copy /y "backend\.env.example" "backend\.env" >nul
    if errorlevel 1 (
      echo [WARN] Failed to create backend\.env - permissions or AV may block file write.
    ) else (
      echo [INFO] Created backend\.env from backend\.env.example
    )
  ) else (
    echo [WARN] backend\.env.example not found. Create backend\.env manually.
  )
)
if not exist "frontend\.env" (
  if exist "frontend\.env.example" (
    copy /y "frontend\.env.example" "frontend\.env" >nul
    if errorlevel 1 (
      echo [WARN] Failed to create frontend\.env - permissions or AV may block file write.
    ) else (
      echo [INFO] Created frontend\.env from frontend\.env.example
    )
  ) else (
    echo [WARN] frontend\.env.example not found. Create frontend\.env manually.
  )
)

REM ---- Helper: run a command and warn on failure (soft mode)
REM Usage: call :try "Label" "command"
goto :afterhelpers

:try
set "LABEL=%~1"
set "CMD=%~2"
set "TRY_FAILED=0"
echo.
echo [STEP] %LABEL%
call %CMD%
if errorlevel 1 (
  set "TRY_FAILED=1"
  echo [WARN] Step failed: %LABEL%
  echo [HINT] Read the error above. Continuing in soft mode.
)
exit /b 0

:afterhelpers

REM ---- Helper: free prisma engine locks (Windows EPERM on rename)
echo.
echo [INFO] Preparing clean Prisma state (unlock engine files)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":4000 .*LISTENING"') do (
  echo [INFO] Stopping process on port 4000 (PID %%P)
  taskkill /PID %%P /F >nul 2>nul
)
if exist "backend\node_modules\.prisma\client" (
  del /f /q "backend\node_modules\.prisma\client\query_engine-windows.dll.node.tmp*" >nul 2>nul
  del /f /q "backend\node_modules\.prisma\client\query_engine-windows.dll.node-journal" >nul 2>nul
)

REM ---- Install deps if node_modules missing
if not exist "backend\node_modules" (
  pushd backend
  call :try "backend: npm install" "npm install"
  popd
)
if not exist "frontend\node_modules" (
  pushd frontend
  call :try "frontend: npm install" "npm install"
  popd
)

REM ---- Ensure newly added frontend deps exist, e.g. react-icons
if not exist "frontend\node_modules\react-icons" (
  echo.
  echo [INFO] Installing missing frontend dependency: react-icons
  pushd frontend
  call :try "frontend: npm install - react-icons missing" "npm install"
  popd
)

REM ---- DB mode: postgres if docker available, otherwise sqlite
set "DB_MODE=sqlite"
where docker >nul 2>nul
if errorlevel 1 (
  echo.
  echo [INFO] Docker not found. Falling back to SQLite local DB.
) else (
  if exist "docker-compose.yml" (
    call :try "docker: start postgres" "docker compose up -d db"
    set "DB_MODE=postgres"
  )
)

REM ---- Prisma steps (soft mode)
pushd backend
if "%DB_MODE%"=="postgres" (
  call :try "prisma: generate - postgres (attempt 1)" "npx prisma generate"
  if "%TRY_FAILED%"=="1" (
    timeout /t 2 >nul
    call :try "prisma: generate - postgres (attempt 2)" "npx prisma generate"
  )
  call :try "prisma: migrate deploy - postgres" "npx prisma migrate deploy"
  call :try "prisma: seed - postgres" "npm run seed"
) else (
  echo.
  echo [INFO] Using SQLite local DB: backend\prisma\dev.db
  set "DATABASE_URL=file:./prisma/dev.db"
  call :try "prisma: generate - sqlite (attempt 1)" "npx prisma generate --schema prisma/schema.sqlite.prisma"
  if "%TRY_FAILED%"=="1" (
    timeout /t 2 >nul
    call :try "prisma: generate - sqlite (attempt 2)" "npx prisma generate --schema prisma/schema.sqlite.prisma"
  )
  call :try "prisma: migrate deploy - sqlite" "npx prisma migrate deploy --schema prisma/schema.sqlite.prisma"
  call :try "prisma: seed - sqlite" "npm run seed"
)
popd

REM ---- Start backend window
echo.
echo [INFO] Starting backend window - http://localhost:4000
if "%DB_MODE%"=="postgres" (
  start "Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev & echo. & echo [NOTE] If backend stopped, check errors above. & pause"
) else (
  start "Backend" cmd /k "cd /d ""%~dp0backend"" && set DATABASE_URL=file:./prisma/dev.db && npm run dev & echo. & echo [NOTE] If backend stopped, check errors above. & pause"
)

REM ---- Start frontend window
echo [INFO] Starting frontend window - http://localhost:3000
start "Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run start & echo. & echo [NOTE] If frontend stopped, check errors above. & pause"

echo ==================================================
echo Site started! Open browser: http://localhost:3000
echo ==================================================
pause

:end
endlocal
exit /b 0

