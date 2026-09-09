Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = """" & base & "\runtime\node.exe"" """ & base & "\src\server.js"""
shell.Run cmd, 0, False
