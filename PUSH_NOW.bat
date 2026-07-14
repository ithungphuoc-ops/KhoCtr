@echo off
cd /d "D:\AI\Test AI\KhoUNICE_Web"
echo Dang push 3 commits len GitHub...
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
    echo PUSH THANH CONG! Render se tu deploy sau ~2 phut.
) else (
    echo PUSH THAT BAI. Kiem tra ket noi hoac credentials.
)
pause
