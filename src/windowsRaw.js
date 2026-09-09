const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const scriptsDir = path.resolve(__dirname, "..", "scripts");

function execPowerShell(script, args = [], timeout = 20000) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        script,
        ...args,
      ],
      {
        windowsHide: true,
        timeout,
        maxBuffer: 5 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const message =
            String(stderr || "").trim() ||
            String(stdout || "").trim() ||
            error.message;
          return reject(new Error(message));
        }
        resolve(String(stdout || "").trim());
      }
    );
  });
}

async function listPrinters() {
  const script = path.join(scriptsDir, "list-printers.ps1");
  const stdout = await execPowerShell(script, [], 15000);
  if (!stdout) return [];

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed];

  return arr
    .map((p) => ({
      name: String(p?.Name || "").trim(),
      driverName: String(p?.DriverName || "").trim(),
      portName: String(p?.PortName || "").trim(),
      default: p?.Default === true,
      network: p?.Network === true,
      shared: p?.Shared === true,
      status: String(p?.PrinterStatus ?? ""),
    }))
    .filter((p) => p.name);
}

async function sendRawToPrinter(printerName, data) {
  const name = String(printerName || "").trim();
  if (!name) {
    throw new Error("No se indicó la impresora Windows.");
  }

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  if (!buffer.length) {
    throw new Error("No hay datos para imprimir.");
  }

  const tmpFile = path.join(
    os.tmpdir(),
    `pedidofresco-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.bin`
  );

  fs.writeFileSync(tmpFile, buffer);

  try {
    const script = path.join(scriptsDir, "raw-print.ps1");
    await execPowerShell(
      script,
      ["-PrinterName", name, "-FilePath", tmpFile],
      30000
    );
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

module.exports = {
  listPrinters,
  sendRawToPrinter,
};
