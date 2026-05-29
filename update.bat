@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo.
echo  ====================================
echo   КомплаенсПро - Обновление
echo  ====================================
echo.
echo  Шаг 1: Получаю обновления...
git pull origin master
echo.
echo  Шаг 2: Устанавливаю зависимости...
call npm install --silent
echo.
echo  Шаг 3: Запускаю приложение...
echo.
call npm start
