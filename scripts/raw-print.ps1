param(
  [Parameter(Mandatory=$true)]
  [string]$PrinterName,

  [Parameter(Mandatory=$true)]
  [string]$FilePath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "Archivo RAW no encontrado: $FilePath"
}

$source = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class PedidoFrescoRawPrinter {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint="OpenPrinterW",
        SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)]
    public static extern bool OpenPrinter(
        string szPrinter,
        out IntPtr hPrinter,
        IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint="ClosePrinter",
        SetLastError=true, ExactSpelling=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW",
        SetLastError=true, CharSet=CharSet.Unicode, ExactSpelling=true)]
    public static extern int StartDocPrinter(
        IntPtr hPrinter,
        int level,
        [In] DOCINFO di);

    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter",
        SetLastError=true, ExactSpelling=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter",
        SetLastError=true, ExactSpelling=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter",
        SetLastError=true, ExactSpelling=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint="WritePrinter",
        SetLastError=true, ExactSpelling=true)]
    public static extern bool WritePrinter(
        IntPtr hPrinter,
        IntPtr pBytes,
        int dwCount,
        out int dwWritten);

    public static void SendFile(string printerName, string filePath) {
        byte[] bytes = File.ReadAllBytes(filePath);
        IntPtr hPrinter;

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
            throw new Exception(
                "No se pudo abrir la impresora. Win32=" +
                Marshal.GetLastWin32Error()
            );
        }

        try {
            DOCINFO di = new DOCINFO();
            di.pDocName = "PedidoFresco ESC-POS";
            di.pDataType = "RAW";

            if (StartDocPrinter(hPrinter, 1, di) == 0) {
                throw new Exception(
                    "StartDocPrinter falló. Win32=" +
                    Marshal.GetLastWin32Error()
                );
            }

            try {
                if (!StartPagePrinter(hPrinter)) {
                    throw new Exception(
                        "StartPagePrinter falló. Win32=" +
                        Marshal.GetLastWin32Error()
                    );
                }

                IntPtr unmanaged = Marshal.AllocCoTaskMem(bytes.Length);

                try {
                    Marshal.Copy(bytes, 0, unmanaged, bytes.Length);
                    int written;

                    if (!WritePrinter(
                        hPrinter,
                        unmanaged,
                        bytes.Length,
                        out written
                    )) {
                        throw new Exception(
                            "WritePrinter falló. Win32=" +
                            Marshal.GetLastWin32Error()
                        );
                    }

                    if (written != bytes.Length) {
                        throw new Exception(
                            "La impresora recibió " + written +
                            " de " + bytes.Length + " bytes."
                        );
                    }
                }
                finally {
                    Marshal.FreeCoTaskMem(unmanaged);
                }

                EndPagePrinter(hPrinter);
            }
            finally {
                EndDocPrinter(hPrinter);
            }
        }
        finally {
            ClosePrinter(hPrinter);
        }
    }
}
"@

if (-not ("PedidoFrescoRawPrinter" -as [type])) {
  Add-Type -TypeDefinition $source -Language CSharp
}

[PedidoFrescoRawPrinter]::SendFile($PrinterName, $FilePath)
Write-Output "OK"
