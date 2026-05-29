@echo off
cd /d "%~dp0"
echo.
echo  *** KomplaensPro - Obnovlenie ***
echo.
echo  [1/3] Poluchayu obnovleniya...
git pull origin master
echo.
echo  [2/3] Ustanavlivayu zavisimosti...
call npm install --silent
echo.
echo  [3/3] Zapuskayu prilozhenie...
echo.
call npm start
