@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path ([Environment]::GetFolderPath('Startup')) 'PedidoFresco Printer.lnk'; if(Test-Path $p){Remove-Item $p -Force}; Write-Host 'Inicio automatico eliminado.'"
pause
