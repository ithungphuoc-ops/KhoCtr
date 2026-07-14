@echo off
chcp 65001 >nul
title KhoUNICE Debug
echo.
echo === KIEM TRA MOI TRUONG ===
echo.

echo [Python]
python --version
echo.

echo [pip]
pip --version
echo.

echo [Node]
node --version
echo.

echo [npm]
npm --version
echo.

echo === CAI THU VIEN PYTHON ===
cd /d "%~dp0api"
pip install fastapi "uvicorn[standard]" python-multipart python-dotenv pypdf
echo Ket qua pip: %errorlevel%
echo.

echo === KIEM TRA BACKEND ===
python -c "from main import app; print('Backend OK -', len([r for r in app.routes]), 'routes')"
echo.

echo === BUILD FRONTEND ===
cd /d "%~dp0frontend"
call npm run build
echo Ket qua build: %errorlevel%
echo.

echo === XONG, NHAN ENTER DE DONG ===
pause
