$ErrorActionPreference = "Stop"

$base = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$vbs = Join-Path $base "start-hidden.vbs"

$startup = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startup "PedidoFresco Printer.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = '"' + $vbs + '"'
$shortcut.WorkingDirectory = $base
$shortcut.Description = "PedidoFresco Printer ESC/POS"
$shortcut.Save()

Write-Output "Inicio automático configurado: $shortcutPath"
