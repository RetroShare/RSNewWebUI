@echo off
REM create webfiles from sources at compile time (works without npm/node.js)

setlocal enabledelayedexpansion

set publicdest=%1\webui
set src=%1\webui-src

if "%1" == "" set publicdest=..\..\webui&&set src=..

if exist "%publicdest%"	echo remove existing %publicdest%&&rd %publicdest% /S /Q

echo mkdir %publicdest%
md %publicdest%

echo building app.js
echo - copy template.js ...
copy %src%\make-src\template.js %publicdest%\app.js

pushd %src%\app
set "basefolder=%cd%\"
for /R %%F in (*.js) do call :addfile-js "%basefolder%" "%%F"
popd

echo building app.css
rem type %src%\app\green-black.scss >> %publicdest%\app.css
type %src%\make-src\main.css >> %publicdest%\app.css
rem type %src%\make-src\chat.css >> %publicdest%\app.css

pushd %src%\app
set "basefolder=%cd%\"
for /R %%F in (*.css) do (
	set fname=%%~dpnF
	set fname=!fname:%basefolder%=!
	set fname=!fname:\=/!
	echo - adding !fname! ...
	type %%F >> %publicdest%\app.css
)
popd

echo copy assets folder
xcopy /s %src%\assets\ %publicdest%

echo copy data folder
xcopy /s %src%\..\data %publicdest%\data\

echo build.bat complete

goto :EOF

:addfile-js
set basefolder=%~1
set fname=%~2

set registername=%~dpn2
set registername=!registername:%basefolder%=!
set registername=%registername:\=/%

echo - adding %registername% ...
echo require.register("%registername%", function(exports, require, module) { >> %publicdest%\app.js
type %fname% >> %publicdest%\app.js
echo. >> %publicdest%\app.js
echo }); >> %publicdest%\app.js


:EOF
