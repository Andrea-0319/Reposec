@echo off
REM setup.bat — Automated setup for Security Review System (Windows)
REM Usage: Double-click or run from terminal: setup.bat

setlocal enabledelayedexpansion
echo.

REM ── Prerequisite checks ─────────────────────────────────────────────

echo [+] Checking prerequisites...

REM Python — check availability
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [X] Python is not installed. Please install Python 3.10+ and retry.
    pause
    exit /b 1
)

REM Verify Python version >= 3.10
for /f "tokens=*" %%v in ('python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"') do set PY_VERSION=%%v
for /f "tokens=*" %%v in ('python -c "import sys; print(sys.version_info.major)"') do set PY_MAJOR=%%v
for /f "tokens=*" %%v in ('python -c "import sys; print(sys.version_info.minor)"') do set PY_MINOR=%%v

if !PY_MAJOR! lss 3 (
    echo [X] Python 3.10+ is required (found !PY_VERSION!^).
    pause
    exit /b 1
)
if !PY_MAJOR! equ 3 if !PY_MINOR! lss 10 (
    echo [X] Python 3.10+ is required (found !PY_VERSION!^).
    pause
    exit /b 1
)
echo [OK] Python !PY_VERSION! found

REM Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [X] Node.js is not installed. Please install Node.js 20+ and retry.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
echo [OK] Node.js !NODE_VERSION! found

REM npm
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [X] npm is not installed. Please install Node.js (includes npm^) and retry.
    pause
    exit /b 1
)

REM Git (optional)
where git >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] Git found (required for remote repo scanning^)
) else (
    echo [i] Git not found — remote repository scanning will not be available.
)

REM ── Virtual environment ─────────────────────────────────────────────

if not exist ".venv" (
    echo [+] Creating virtual environment...
    python -m venv .venv
    echo [OK] Virtual environment created (.venv\^)
) else (
    echo [OK] Virtual environment already exists (.venv\^)
)

REM Activate venv
call .venv\Scripts\activate.bat

REM ── Python dependencies ─────────────────────────────────────────────

echo [+] Installing Python dependencies...
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo [OK] Python dependencies installed

REM ── Frontend build ──────────────────────────────────────────────────

echo [+] Installing frontend dependencies...
cd frontend
call npm install --silent
echo [OK] Frontend dependencies installed

echo [+] Building frontend (React + Vite^)...
call npm run build
echo [OK] Frontend built successfully
cd ..

REM ── Environment file ────────────────────────────────────────────────

if not exist ".env" (
    copy .env.example .env >nul
    echo [OK] Created .env from .env.example
) else (
    echo [OK] .env already exists (keeping current values^)
)

REM ── Done ────────────────────────────────────────────────────────────

echo.
echo ======================================
echo   Setup complete!
echo ======================================
echo.
echo   To start the dashboard:
echo     start_dashboard.bat
echo.
echo   To run a scan from CLI:
echo     .venv\Scripts\activate
echo     python main.py "C:\path\to\repo"
echo.
pause
