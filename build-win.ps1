$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = "C:\Users\29819\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$electronVersion = "41.2.1"
$electronZipName = "electron-v$electronVersion-win32-x64.zip"

function Find-FirstFile {
  param(
    [string]$Path,
    [string]$Filter
  )

  $item = Get-ChildItem -Path $Path -Recurse -Filter $Filter -ErrorAction SilentlyContinue |
    Sort-Object FullName |
    Select-Object -First 1 -ExpandProperty FullName

  return $item
}

function Ensure-ElectronRuntime {
  param(
    [string]$ProjectRoot,
    [string]$PnpmRoot,
    [string]$Version,
    [string]$ZipName
  )

  $electronRoot = Join-Path $PnpmRoot "electron@$Version\node_modules\electron"
  $distPath = Join-Path $electronRoot "dist"
  $zipPath = Join-Path $ProjectRoot "tools\$ZipName"
  $pathTxt = Join-Path $electronRoot "path.txt"
  $electronExe = Join-Path $distPath "electron.exe"

  if (Test-Path $electronExe) {
    return $electronExe
  }

  New-Item -ItemType Directory -Force -Path (Split-Path $zipPath -Parent) | Out-Null

  $downloadUrls = @(
    "https://npmmirror.com/mirrors/electron/v$Version/$ZipName",
    "https://sourceforge.net/projects/electron.mirror/files/v$Version/$ZipName/download",
    "https://github.com/electron/electron/releases/download/v$Version/$ZipName"
  )

  $downloaded = $false
  foreach ($url in $downloadUrls) {
    try {
      Write-Host "Trying runtime download: $url" -ForegroundColor DarkCyan
      Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
      if ((Test-Path $zipPath) -and ((Get-Item $zipPath).Length -gt 100MB)) {
        $downloaded = $true
        break
      }
    } catch {
      Write-Host "Download failed for: $url" -ForegroundColor Yellow
    }
  }

  if (-not $downloaded) {
    throw "Unable to download the Electron runtime from all fallback mirrors."
  }

  if (Test-Path $distPath) {
    Remove-Item -LiteralPath $distPath -Recurse -Force
  }

  Expand-Archive -LiteralPath $zipPath -DestinationPath $distPath -Force
  Set-Content -LiteralPath $pathTxt -Value "electron.exe" -NoNewline

  if (-not (Test-Path $electronExe)) {
    throw "Electron runtime was extracted, but electron.exe was not found."
  }

  return $electronExe
}

if (-not (Test-Path $nodeExe)) {
  Write-Host "Runtime node.exe was not found." -ForegroundColor Red
  exit 1
}

$pnpmRoot = Join-Path $projectRoot "node_modules\.pnpm"
$electronViteBin = Find-FirstFile -Path $pnpmRoot -Filter "electron-vite.js"
$builderBin = Join-Path $projectRoot "node_modules\.bin\electron-builder.CMD"

if (-not $electronViteBin) {
  Write-Host "electron-vite entry was not found. Please make sure dependencies are installed." -ForegroundColor Red
  exit 1
}

try {
  Write-Host "Ensuring the Electron runtime is available..." -ForegroundColor Cyan
  [void](Ensure-ElectronRuntime -ProjectRoot $projectRoot -PnpmRoot $pnpmRoot -Version $electronVersion -ZipName $electronZipName)
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host "Please keep this window open and send me the last lines if it still fails." -ForegroundColor Yellow
  exit 1
}

Write-Host "Building the app..." -ForegroundColor Cyan
& $nodeExe $electronViteBin build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. Please check the error output above." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $builderBin)) {
  Write-Host "electron-builder was not found. You can still use start-dev.bat to open the desktop app." -ForegroundColor Yellow
  exit 0
}

Write-Host "Packaging the Windows installer..." -ForegroundColor Cyan
& $builderBin --win nsis
if ($LASTEXITCODE -ne 0) {
  Write-Host "Packaging failed. Please check the error output above." -ForegroundColor Red
  exit 1
}

Write-Host "Packaging completed. Check the release folder for the installer." -ForegroundColor Green
