# Install Render CLI into .tools/render (Windows)
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\_render-common.ps1"

New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null

if (Test-Path $RenderExe) {
    $ver = & $RenderExe --version 2>&1
    Write-Host "Render CLI already installed: $ver"
    exit 0
}

$zip = Join-Path $env:TEMP "render-cli.zip"
Write-Host "Downloading Render CLI v$RenderVersion..."
Invoke-WebRequest -Uri $RenderZipUrl -OutFile $zip
Expand-Archive -Path $zip -DestinationPath $ToolsDir -Force

$bundled = Join-Path $ToolsDir "cli_v2.17.0.exe"
if (Test-Path $bundled) {
    Copy-Item $bundled $RenderExe -Force
}

Remove-Item $zip -Force -ErrorAction SilentlyContinue
& $RenderExe --version

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  & `"$RenderExe`" login"
Write-Host "  & `"$RenderExe`" workspace set"
Write-Host "  .\scripts\render-setup.ps1"
