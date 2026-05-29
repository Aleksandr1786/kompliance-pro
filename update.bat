@echo off
chcp 65001 >nul
echo.
echo ╔═══════════════════════════════════════╗
echo ║     КомплаенсПро — Обновление         ║
echo ╚═══════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [1/3] Получаю обновления с GitHub...
git pull origin master
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось получить обновления.
    echo Проверьте подключение к интернету.
    pause
    exit /b 1
)

echo.
echo [2/3] Устанавливаю новые зависимости...
call npm install --silent
if %errorlevel% neq 0 (
    echo ОШИБКА: Не удалось установить зависимости.
    pause
    exit /b 1
)

echo.
echo [3/3] Готово! Запускаю приложение...
echo.
echo ✓ КомплаенсПро успешно обновлён!
echo.
timeout /t 2 >nul
call npm start
