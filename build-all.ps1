$ErrorActionPreference = "Stop"
$root = "C:\Users\zeepe\OneDrive\Desktop\JT-Power-Tools"
$source = Join-Path $root "JT-Tools-Master"
$buildDir = Join-Path $root "Build"

# Ensure Build folder exists
if (!(Test-Path $buildDir)) { New-Item -ItemType Directory -Path $buildDir | Out-Null }

# --- Chrome Build ---
$chromeZip = Join-Path $buildDir "jt-power-tools-chrome.zip"
if (Test-Path $chromeZip) { Remove-Item $chromeZip -Force }
$chromeTmp = Join-Path $root "chrome-build-temp"
if (Test-Path $chromeTmp) { Remove-Item $chromeTmp -Recurse -Force }

Copy-Item $source $chromeTmp -Recurse
# Remove Firefox-only files
Remove-Item (Join-Path $chromeTmp "manifest.firefox.json") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $chromeTmp "background\background.js") -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $chromeTmp "*") -DestinationPath $chromeZip -Force
Remove-Item $chromeTmp -Recurse -Force
Write-Host "Chrome build: $([math]::Round((Get-Item $chromeZip).Length / 1KB, 1)) KB"

# --- Firefox Build ---
$firefoxZip = Join-Path $buildDir "jt-power-tools-firefox.zip"
if (Test-Path $firefoxZip) { Remove-Item $firefoxZip -Force }
$firefoxTmp = Join-Path $root "firefox-build-temp"
if (Test-Path $firefoxTmp) { Remove-Item $firefoxTmp -Recurse -Force }

Copy-Item $source $firefoxTmp -Recurse
# Swap manifest and remove Chrome-only files
Copy-Item (Join-Path $firefoxTmp "manifest.firefox.json") (Join-Path $firefoxTmp "manifest.json") -Force
Remove-Item (Join-Path $firefoxTmp "manifest.firefox.json") -ErrorAction SilentlyContinue
Remove-Item (Join-Path $firefoxTmp "background\service-worker.js") -ErrorAction SilentlyContinue

Compress-Archive -Path (Join-Path $firefoxTmp "*") -DestinationPath $firefoxZip -Force
Remove-Item $firefoxTmp -Recurse -Force
Write-Host "Firefox build: $([math]::Round((Get-Item $firefoxZip).Length / 1KB, 1)) KB"

Write-Host "Done! Both builds in: $buildDir"
