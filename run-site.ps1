$ErrorActionPreference = "Continue"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Clan Salamanca - PowerShell launcher (soft mode)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Always run from script folder
Set-Location -Path $PSScriptRoot

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] $Name not found." -ForegroundColor Red
    Write-Host $InstallHint
    Write-Host "This window will stay open."
    Read-Host "Press Enter to exit"
    exit 1
  }
}

Require-Command node "Install Node.js LTS 20+ from https://nodejs.org and run again."
Require-Command npm  "Reinstall Node.js (npm is bundled) and run again."

# If Node is installed but not in PATH (common on Windows), try the default location for this session.
$defaultNodeDir = Join-Path $env:ProgramFiles "nodejs"
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $defaultNodeDir "node.exe"))) {
  $env:Path = "$defaultNodeDir;$env:Path"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $defaultNodeDir "npm.cmd"))) {
  $env:Path = "$defaultNodeDir;$env:Path"
}

Require-Command node "Node.js is installed but not found in PATH. Add C:\Program Files\nodejs\ to PATH and reopen the terminal."
Require-Command npm  "npm is installed but not found in PATH. Add C:\Program Files\nodejs\ to PATH and reopen the terminal."

function Test-PortInUse([int]$Port, [string]$What) {
  try {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop
    foreach ($l in $listeners) {
      Write-Host ""
      Write-Host "[WARN] Port $Port is already in use. $What may fail to start." -ForegroundColor DarkYellow
      Write-Host "[HINT] Close the app using this port, then re-run the launcher."
      if ($l.OwningProcess) {
        Write-Host "[HINT] PID: $($l.OwningProcess) (use: taskkill /PID $($l.OwningProcess) /F)"
      }
      return
    }
  } catch {
    # Fallback: do nothing (older Windows / permission issues)
  }
}

Test-PortInUse 3000 "Frontend (Vite)"
Test-PortInUse 4000 "Backend (API)"

if (-not (Test-Path "backend/package.json")) {
  Write-Host "[ERROR] Missing backend/package.json" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}
if (-not (Test-Path "frontend/package.json")) {
  Write-Host "[ERROR] Missing frontend/package.json" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

function Try-Step([string]$Label, [scriptblock]$Block) {
  Write-Host ""
  Write-Host "[STEP] $Label" -ForegroundColor Yellow
  try {
    & $Block
    if ($LASTEXITCODE -ne 0) { throw "ExitCode=$LASTEXITCODE" }
    return $true
  } catch {
    Write-Host "[WARN] Step failed: $Label" -ForegroundColor DarkYellow
    Write-Host "[HINT] Read the error above. Continuing (soft mode)."
    return $false
  }
}

function Unlock-PrismaEngine {
  Write-Host ""
  Write-Host "[INFO] Preparing clean Prisma state (unlock engine files)" -ForegroundColor DarkYellow
  try {
    $listeners = Get-NetTCPConnection -State Listen -LocalPort 4000 -ErrorAction Stop
    foreach ($l in $listeners) {
      if ($l.OwningProcess) {
        Write-Host "[INFO] Stopping process on port 4000 (PID $($l.OwningProcess))"
        Stop-Process -Id $l.OwningProcess -Force -ErrorAction SilentlyContinue
      }
    }
  } catch {}

  $prismaClientDir = Join-Path $PSScriptRoot "backend\node_modules\.prisma\client"
  if (Test-Path $prismaClientDir) {
    Remove-Item -Path (Join-Path $prismaClientDir "query_engine-windows.dll.node.tmp*") -Force -ErrorAction SilentlyContinue
    Remove-Item -Path (Join-Path $prismaClientDir "query_engine-windows.dll.node-journal") -Force -ErrorAction SilentlyContinue
  }
}

# Create .env from examples if missing
if (-not (Test-Path "backend/.env") -and (Test-Path "backend/.env.example")) {
  Copy-Item "backend/.env.example" "backend/.env" -Force
  Write-Host "[INFO] Created backend/.env from backend/.env.example"
}
if (-not (Test-Path "frontend/.env") -and (Test-Path "frontend/.env.example")) {
  Copy-Item "frontend/.env.example" "frontend/.env" -Force
  Write-Host "[INFO] Created frontend/.env from frontend/.env.example"
}

# Install deps if missing
if (-not (Test-Path "backend/node_modules")) {
  Try-Step "backend: npm install" { Set-Location backend; npm install; Set-Location $PSScriptRoot }
}
if (-not (Test-Path "frontend/node_modules")) {
  Try-Step "frontend: npm install" { Set-Location frontend; npm install; Set-Location $PSScriptRoot }
}

# Ensure newly added deps exist (e.g. react-icons)
if (-not (Test-Path "frontend/node_modules/react-icons")) {
  Try-Step "frontend: npm install (react-icons missing)" { Set-Location frontend; npm install; Set-Location $PSScriptRoot }
}

# DB mode: postgres if docker available, otherwise sqlite fallback
$dbMode = "sqlite"
if (Get-Command docker -ErrorAction SilentlyContinue) {
  if (Test-Path "docker-compose.yml") {
    Try-Step "docker: start postgres (docker compose up -d db)" { docker compose up -d db }
    $dbMode = "postgres"
  }
} else {
  Write-Host ""
  Write-Host "[INFO] Docker not found. Falling back to SQLite local DB." -ForegroundColor DarkYellow
}

# Prisma steps (soft mode)
Unlock-PrismaEngine
if ($dbMode -eq "postgres") {
  $ok = Try-Step "prisma: generate (postgres) - attempt 1" { Set-Location backend; npx prisma generate; Set-Location $PSScriptRoot }
  if (-not $ok) {
    Start-Sleep -Seconds 2
    Unlock-PrismaEngine
    Try-Step "prisma: generate (postgres) - attempt 2" { Set-Location backend; npx prisma generate; Set-Location $PSScriptRoot }
  }
  Try-Step "prisma: migrate dev (postgres)" { Set-Location backend; npx prisma migrate dev --name init; Set-Location $PSScriptRoot }
  Try-Step "prisma: seed (postgres)" { Set-Location backend; npm run seed; Set-Location $PSScriptRoot }
} else {
  $env:DATABASE_URL = "file:./prisma/dev.db"
  Write-Host ""
  Write-Host "[INFO] Using SQLite local DB: backend/prisma/dev.db" -ForegroundColor DarkYellow
  $ok = Try-Step "prisma: generate (sqlite) - attempt 1" { Set-Location backend; npx prisma generate --schema prisma/schema.sqlite.prisma; Set-Location $PSScriptRoot }
  if (-not $ok) {
    Start-Sleep -Seconds 2
    Unlock-PrismaEngine
    Try-Step "prisma: generate (sqlite) - attempt 2" { Set-Location backend; npx prisma generate --schema prisma/schema.sqlite.prisma; Set-Location $PSScriptRoot }
  }
  Try-Step "prisma: migrate dev (sqlite)" { Set-Location backend; npx prisma migrate dev --name init --schema prisma/schema.sqlite.prisma; Set-Location $PSScriptRoot }
  Try-Step "prisma: seed (sqlite)" { Set-Location backend; npm run seed; Set-Location $PSScriptRoot }
}

# Start backend/frontend in separate windows, keep them open
Write-Host ""
Write-Host "[INFO] Starting backend window (http://localhost:4000)"
if ($dbMode -eq "postgres") {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$PSScriptRoot\backend`" && npm run dev"
} else {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$PSScriptRoot\backend`" && set DATABASE_URL=file:./prisma/dev.db && npm run dev"
}

Write-Host "[INFO] Starting frontend window (http://localhost:3000)"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$PSScriptRoot\frontend`" && npm run start"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Site started! Open browser: http://localhost:3000" -ForegroundColor Green
Write-Host " Backend logs: Backend window" -ForegroundColor Green
Write-Host " Frontend logs: Frontend window" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

Read-Host "Press Enter to close this window"

