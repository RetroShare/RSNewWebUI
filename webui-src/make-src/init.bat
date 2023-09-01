@echo off
REM create dummy webfiles at qmake run

set publicdest=%1\webui
if "%1" == "" set publicdest=..\..\webui

if exist %publicdest% echo removing %publicdest%&&rd %publicdest% /S /Q

echo creating %publicdest%
md %publicdest%

echo creating %publicdest%\app.js, %publicdest%\styles.css, %publicdest%\index.html
echo. > %publicdest%\app.js
echo. > %publicdest%\styles.css
echo. > %publicdest%\index.html
