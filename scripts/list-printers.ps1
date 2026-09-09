$ErrorActionPreference = "Stop"

$printers = Get-CimInstance Win32_Printer |
  Select-Object Name, DriverName, PortName, Default, Network, Shared, PrinterStatus

$printers | ConvertTo-Json -Depth 3 -Compress
