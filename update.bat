@echo off
cd /d "%~dp0"
echo.
echo  *** KomplaensPro - Obnovlenie ***
echo.
echo  [1/2] Poluchayu obnovleniya...
git pull origin master
echo.
echo  [2/2] Zapuskayu prilozhenie...
echo.
call npm start
