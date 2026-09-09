; PedidoFresco Printer - Inno Setup
#define MyAppName "PedidoFresco Printer"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "PedidoFresco"
#define MyAppExeName "runtime\node.exe"

[Setup]
AppId={{85F24E6C-49AF-4E93-BD7B-3E3F2E80D764}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\PedidoFrescoPrinter
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=PedidoFrescoPrinterSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=PedidoFresco Printer
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Files]
Source: "..\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "..\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\scripts\*"; DestDir: "{app}\scripts"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\run-installed.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\PedidoFresco Printer"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\run-installed.vbs"""; WorkingDir: "{app}"
Name: "{userstartup}\PedidoFresco Printer"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\run-installed.vbs"""; WorkingDir: "{app}"

[Run]
Filename: "{sys}\wscript.exe"; Parameters: """{app}\run-installed.vbs"""; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent; Description: "Iniciar PedidoFresco Printer"

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /F /IM node.exe /FI ""WINDOWTITLE eq PedidoFresco*"""; Flags: runhidden; RunOnceId: "StopPedidoFrescoPrinter"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
end;
