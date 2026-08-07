@echo off
REM create webfiles from sources at compile time (works without npm/node.js)

setlocal enabledelayedexpansion

echo "### Starting WebUI build ###"

set "src=%~dp0..\..\webui-src"

rem Output destination
if "%~1"=="" (
	set "publicdest=%~dp0..\..\webui"
) else (
	set "publicdest=%~1\webui"
)

if exist "%publicdest%" (
	echo removing existing %publicdest%
	rd "%publicdest%" /S /Q
)

echo creating %publicdest%
md "%publicdest%"

rem Make full path
pushd "%publicdest%"
set "publicdest=%cd%"
popd

echo copying html file
copy /Y "%src%\index.html" "%publicdest%\index.html" >nul

echo copying css file
copy /Y "%src%\styles.css" "%publicdest%\styles.css" >nul

echo building app.js
echo - copying template.js ...
copy /Y "%src%\make-src\template.js" "%publicdest%\app.js" >nul

pushd "%src%\app"
set "basefolder=%cd%\"
set "lastsection="
for /R %%F in (*.js) do call :addfile-js "%basefolder%" "%%F"
popd

echo copying assets folder
xcopy "%src%\assets\*" "%publicdest%\" /E /I /Y >nul

echo "### WebUI build complete ###"

goto :EOF

:addfile-js
set "basefolder=%~1"
set "fname=%~2"

set "registername=%~dpn2"
set "registername=!registername:%basefolder%=!"
set "registername=%registername:\=/%"

for /f "tokens=1,2 delims=/" %%A in ("!registername!") do (
	if "%%B"=="" (
		echo - adding !registername! ...
		set "lastsection="
	) else if not "!lastsection!"=="%%A" (
		echo - adding %%A/* ...
		set "lastsection=%%A"
	)
)
echo require.register("%registername%", function(exports, require, module) { >>"%publicdest%\app.js"
type "%fname%" >>"%publicdest%\app.js"
echo. >>"%publicdest%\app.js"
echo }); >>"%publicdest%\app.js"

:EOF
