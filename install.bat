@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Instalando PedidoFresco Printer
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado.
  echo Instala Node.js 20 o superior y volve a ejecutar.
  pause
  exit /b 1
)

echo [1/3] Instalando dependencias...
call npm install
if errorlevel 1 (
  echo ERROR durante npm install.
  pause
  exit /b 1
)

echo [2/3] Configurando inicio automatico...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-startup.ps1"
if errorlevel 1 (
  echo No se pudo crear el inicio automatico.
  echo El servicio igualmente puede iniciarse con start.bat.
)

echo [3/3] Iniciando servicio...
start "" wscript.exe "%~dp0start-hidden.vbs"

echo.
echo PedidoFresco Printer instalado.
echo Servicio: http://127.0.0.1:9105
echo.
echo En PedidoFresco:
echo Administracion ^> Parametrias ^> PedidoFresco Printer
echo.
pause
