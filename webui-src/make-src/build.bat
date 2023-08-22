@echo off
REM create webfiles from sources at compile time (works without npm/node.js)

setlocal enabledelayedexpansion

echo "### Starting WebUI build ###"

set src=%~dp0..\..\webui-src

rem Output destination
if "%~1" == "" (
	set publicdest=%~dp0..\..\webui
) else (
	set publicdest=%~1\webui
)

if exist "%publicdest%"	echo removing existing %publicdest%&&rd %publicdest% /S /Q

echo creating %publicdest%
md %publicdest%

rem Make full path
pushd %publicdest%
set publicdest=%cd%
popd

echo copying html file
xcopy /s %src%\index.html %publicdest%

echo copying css file
xcopy /s %src%\styles.css %publicdest%

echo building app.js
echo - copying template.js ...
copy %src%\make-src\template.js %publicdest%\app.js

pushd %src%\app
set "basefolder=%cd%\"
for /R %%F in (*.js) do call :addfile-js "%basefolder%" "%%F"
popd

echo copying assets folder
xcopy /s %src%\assets\ %publicdest%

echo copying data folder
xcopy /s %src%\..\data %publicdest%\data\

echo "### WebUI build complete ###"

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
