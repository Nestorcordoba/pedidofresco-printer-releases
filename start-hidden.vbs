Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "cmd /c cd /d """ & base & """ && node src\server.js >> printer.log 2>&1"
shell.Run cmd, 0, False
