# WebUI Build Script in PowerShell (Optional)
$ErrorActionPreference = "Stop"

$makeSrcDir = $PSScriptRoot
$src = Resolve-Path "$makeSrcDir\.."
$dest = Join-Path (Resolve-Path "$makeSrcDir\..\..") "webui"

if ($args.Count -gt 0 -and $args[0] -ne "") {
    $dest = Join-Path $args[0] "webui"
}

Write-Host "### Starting WebUI build ###"
Write-Host "Source: $src"
Write-Host "Destination: $dest"

if (!(Test-Path $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Write-Host "Copying html and assembling styles.css..."
Copy-Item "$src\index.html" "$dest\index.html" -Force

$cssBase = Get-Content "$src\styles.css" -Raw -Encoding UTF8
$extraCss = ""
if (Test-Path "$src\app\scss\pages\_board.scss") {
    $extraCss += (Get-Content "$src\app\scss\pages\_board.scss" -Raw -Encoding UTF8) + "`n`n"
}
if (Test-Path "$src\app\scss\pages\_people.scss") {
    $extraCss += (Get-Content "$src\app\scss\pages\_people.scss" -Raw -Encoding UTF8) + "`n`n"
}
if (Test-Path "$src\app\scss\pages\_chat.scss") {
    $extraCss += (Get-Content "$src\app\scss\pages\_chat.scss" -Raw -Encoding UTF8) + "`n`n"
}
if (Test-Path "$src\app\scss\pages\_home.scss") {
    $extraCss += (Get-Content "$src\app\scss\pages\_home.scss" -Raw -Encoding UTF8) + "`n`n"
}
if (Test-Path "$src\app\scss\pages\_network.scss") {
    $extraCss += (Get-Content "$src\app\scss\pages\_network.scss" -Raw -Encoding UTF8) + "`n`n"
}
if (Test-Path "$src\app\scss\components\_statusbar.scss") {
    $extraCss += (Get-Content "$src\app\scss\components\_statusbar.scss" -Raw -Encoding UTF8) + "`n`n"
}

$combinedCss = $cssBase + "`n`n" + $extraCss
[System.IO.File]::WriteAllText("$dest\styles.css", $combinedCss, $utf8NoBom)

Write-Host "Building app.js..."
$template = Get-Content "$src\make-src\template.js" -Raw -Encoding UTF8
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine($template)

$appDir = Resolve-Path "$src\app"
$files = Get-ChildItem -Path $appDir.Path -Recurse -Filter "*.js"

foreach ($f in $files) {
    $rel = $f.FullName.Substring($appDir.Path.Length + 1).Replace('\', '/').Replace('.js', '')
    Write-Host "- adding $rel ..."
    [void]$sb.AppendLine("require.register(`"$rel`", function(exports, require, module) {")
    $fileText = Get-Content $f.FullName -Raw -Encoding UTF8
    [void]$sb.AppendLine($fileText)
    [void]$sb.AppendLine("});")
}

[System.IO.File]::WriteAllText("$dest\app.js", $sb.ToString(), $utf8NoBom)

if (Test-Path "$src\assets") {
    Write-Host "Copying assets..."
    Copy-Item "$src\assets\*" "$dest\" -Recurse -Force
}

Write-Host "### WebUI build complete ###"
