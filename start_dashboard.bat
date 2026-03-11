@echo off
REM start_dashboard.bat — Launch the Security Review Dashboard (Windows)
REM Usage: Double-click or run from terminal: start_dashboard.bat

cd /d "%~dp0"

REM Activate virtual environment
if not exist ".venv\Scripts\activate.bat" (
    echo [X] Virtual environment not found. Run setup.bat first.
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat

REM Verify frontend is built
if not exist "frontend\dist\index.html" (
    echo [!] Frontend not built. Building now...
    cd frontend
    call npm run build
    cd ..
)

echo.
echo   Starting Security Review Dashboard...
echo   Open http://localhost:8000 in your browser
echo   Press Ctrl+C to stop
echo.

python main.py --dashboard
pause
