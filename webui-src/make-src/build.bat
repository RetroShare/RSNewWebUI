@echo off
REM create webfiles from sources at compile time (works without npm/node.js)
REM Updated to match build.sh functionality

setlocal enabledelayedexpansion

echo "### Starting WebUI build ###"

set src=%~dp0..\..\webui-src

rem Output destination
if "%~1"=="" (
	set publicdest=%~dp0..\..\webui
) else (
	set publicdest=%~1\webui
)

if not "%~2"=="" (
	if exist "%publicdest%" (
		echo removing existing %publicdest%
		rmdir /s /q "%publicdest%"
	)
)

if not exist "%publicdest%" (
	echo creating %publicdest%
	mkdir "%publicdest%"
)

rem Make full path
for %%i in ("%publicdest%") do set publicdest=%%~fi

echo copying html file
copy /y "%src%\index.html" "%publicdest%\"

echo copying css file
copy /y "%src%\styles.css" "%publicdest%\"

echo building app.js
echo - copying template.js ...
copy /y "%src%\make-src\template.js" "%publicdest%\app.js"

rem Clear existing content in app.js and rebuild
echo. > "%publicdest%\app.js"
copy /y "%src%\make-src\template.js" "%publicdest%\app.js"

rem Process all JS files recursively
for /R "%src%\app" %%F in (*.js) do (
	call :addfile-js "%%F"
)

echo copying assets folder
xcopy /s /e /i /y "%src%\assets" "%publicdest%\assets\"

echo "### WebUI build complete ###"
goto :EOF

:addfile-js
set filepath=%~1
set fname=%filepath%

rem Get relative path from app folder
set relpath=!fname:%src%\app=!
set relpath=!relpath:\=/!
set relpath=!relpath:.js=!

echo - adding !relpath! ...
echo require.register("!relpath!", function(exports, require, module) { >> "%publicdest%\app.js"
type "!fname!" >> "%publicdest%\app.js"
echo. >> "%publicdest%\app.js"
echo }); >> "%publicdest%\app.js"

:EOF