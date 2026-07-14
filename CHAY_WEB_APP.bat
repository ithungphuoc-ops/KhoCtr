@echo off
chcp 65001 >nul
title KhoUNICE Web App
cd /d "%~dp0"

echo.
echo ==========================================
echo   KHOUNICE WEB APP v2.0.0
echo   HP Cons Viet Nam
echo ==========================================
echo.

:: Kiem tra Python
echo Dang kiem tra Python...
python --version
if errorlevel 1 (
    echo [LOI] Chua cai Python. Tai tai https://python.org
    pause
    exit /b
)

:: Tao file .env neu chua co
if not exist "api\.env" (
    echo [INFO] Tao file .env tu .env.example...
    copy "api\.env.example" "api\.env" >nul
    echo.
    echo [QUAN TRONG] Mo file api\.env va dien vao:
    echo   CLAUDE_API_KEY=your_claude_api_key
    echo   (SUPABASE da duoc dien san)
    echo.
    notepad "api\.env"
)

:: Cai thu vien Python
echo [1/4] Kiem tra thu vien Python...
pip install fastapi "uvicorn[standard]" python-multipart python-dotenv pypdf pymupdf
if errorlevel 1 (
    echo.
    echo [LOI] Khong cai duoc thu vien Python - xem loi o tren
    pause
    exit /b
)
echo     OK

:: Cai node_modules neu chua co
echo [2/4] Kiem tra node_modules...
if exist "frontend\node_modules" goto skip_npm
echo     Dang cai npm packages (lan dau co the mat 2-3 phut)...
cd /d "%~dp0frontend"
npm install
if errorlevel 1 (
    echo.
    echo [LOI] npm install that bai - xem loi o tren
    pause
    exit /b
)
cd /d "%~dp0"
:skip_npm
echo     OK

:: Build frontend
echo [3/4] Build frontend...
cd /d "%~dp0frontend"
npm run build
if errorlevel 1 (
    echo [CANH BAO] Build that bai, chay dev mode thay the...
    echo.
    echo Mo 2 cua so rieng:
    echo   Cua so 1: chay backend (tu dong mo)
    echo   Cua so 2: chay frontend dev (http://localhost:3000)
    start "KhoUNICE Backend" cmd /k "cd /d "%~dp0api" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
    start "KhoUNICE Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
    timeout /t 3 >nul
    start http://localhost:3000
    pause
    exit /b
)
cd /d "%~dp0"
echo     OK

:: Chay backend (serve ca frontend)
echo [4/4] Khoi dong server...
echo.
echo ==========================================
echo   App dang chay tai: http://localhost:8000
echo   Nhan Ctrl+C de dung
echo ==========================================
echo.
start http://localhost:8000
cd /d "%~dp0api"
python -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
