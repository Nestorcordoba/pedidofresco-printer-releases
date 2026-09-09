param(
  [string]$NodeVersion = "22.22.0"
)

$ErrorActionPreference = "Stop"
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $base

Write-Host "=== PedidoFresco Printer - Build Setup.exe ===" -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm no esta disponible en la PC de compilacion."
}

Write-Host "[1/5] Instalando dependencias Windows..."
npm install --omit=dev

$runtimeDir = Join-Path $base "runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

$nodeExe = (Get-Command node).Source
if (-not (Test-Path $nodeExe)) {
  throw "No se encontro node.exe."
}

Write-Host "[2/5] Copiando runtime Node..."
Copy-Item $nodeExe (Join-Path $runtimeDir "node.exe") -Force

$iscc = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if (-not $iscc) {
  if (Get-Command choco -ErrorAction SilentlyContinue) {
    Write-Host "[3/5] Instalando Inno Setup..."
    choco install innosetup -y --no-progress
    $iscc = @(
      "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
      "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  }
}

if (-not $iscc) {
  throw "No se encontro Inno Setup 6 (ISCC.exe)."
}

Write-Host "[4/5] Compilando PedidoFrescoPrinterSetup.exe..."
& $iscc (Join-Path $base "installer\PedidoFrescoPrinter.iss")

$exe = Join-Path $base "installer\dist\PedidoFrescoPrinterSetup.exe"
if (-not (Test-Path $exe)) {
  throw "El instalador no fue generado."
}

Write-Host "[5/5] OK: $exe" -ForegroundColor Green
