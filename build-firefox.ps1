$ErrorActionPreference = "Stop"
$root = "C:\Users\zeepe\OneDrive\Desktop\JT-Power-Tools"
$source = Join-Path $root "JT-Tools-Master"
$tempDir = Join-Path $root "firefox-build-temp"
$zipPath = Join-Path $root "jt-power-tools-firefox.zip"

# Clean up
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }

# Copy source
Copy-Item $source $tempDir -Recurse

# Swap manifest
Copy-Item (Join-Path $tempDir "manifest.firefox.json") (Join-Path $tempDir "manifest.json") -Force
Remove-Item (Join-Path $tempDir "manifest.firefox.json") -ErrorAction SilentlyContinue

# Remove Chrome-only files
Remove-Item (Join-Path $tempDir "background\service-worker.js") -ErrorAction SilentlyContinue

# Create ZIP
Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -Force

# Clean up temp
Remove-Item $tempDir -Recurse -Force

Write-Host "Firefox build complete!"
Write-Host "Size: $([math]::Round((Get-Item $zipPath).Length / 1KB, 1)) KB"
