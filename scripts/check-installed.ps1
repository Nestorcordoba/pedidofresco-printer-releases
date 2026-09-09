$ErrorActionPreference = "SilentlyContinue"

try {
  $r = Invoke-RestMethod -Uri "http://127.0.0.1:9105/health" -TimeoutSec 3
  if ($r.ok -eq $true) {
    Write-Output "OK"
    exit 0
  }
} catch {}

Write-Output "ERROR"
exit 1
