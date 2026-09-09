const http = require("http");
const path = require("path");
const fs = require("fs");

const { listPrinters, sendRawToPrinter } = require("./windowsRaw");
const { buildLabelsJob, buildTicketJob } = require("./escpos");

const VERSION = "1.0.0";
const configPath = path.resolve(__dirname, "..", "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return {};
  }
}

function json(res, status, payload, origin = "") {
  const headers = corsHeaders(origin);
  res.writeHead(status, {
    ...headers,
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function corsHeaders(origin = "") {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Accept, X-Requested-With",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function allowedOrigin(origin, cfg) {
  if (!origin) return true;

  const list = Array.isArray(cfg?.allowedOrigins)
    ? cfg.allowedOrigins
    : [];

  if (list.includes("*")) return true;
  if (list.includes(origin)) return true;

  if (
    /^https?:\/\/localhost(?::\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)
  ) {
    return true;
  }

  return false;
}

function readBody(req, maxBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error("Payload demasiado grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(
          JSON.parse(Buffer.concat(chunks).toString("utf8"))
        );
      } catch {
        reject(new Error("JSON inválido."));
      }
    });

    req.on("error", reject);
  });
}

function dotsForWidth(widthMm, cfg) {
  const map = cfg?.defaultDotsPerLine || {};
  const key = String(Number(widthMm || 80));
  const value = Number(map[key]);
  if (Number.isFinite(value) && value > 0) return value;

  const width = Number(widthMm || 80);
  if (width <= 58) return 384;
  if (width <= 67) return 512;
  return 576;
}

async function route(req, res) {
  const cfg = readConfig();
  const origin = String(req.headers.origin || "");

  if (!allowedOrigin(origin, cfg)) {
    return json(
      res,
      403,
      {
        ok: false,
        message: `Origen no permitido: ${origin}`,
      },
      "null"
    );
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  const url = new URL(
    req.url || "/",
    `http://${req.headers.host || "127.0.0.1"}`
  );

  if (req.method === "GET" && url.pathname === "/health") {
    return json(
      res,
      200,
      {
        ok: true,
        service: "PedidoFresco Printer",
        version: VERSION,
        platform: process.platform,
        pid: process.pid,
      },
      origin
    );
  }

  if (req.method === "GET" && url.pathname === "/printers") {
    try {
      const items = await listPrinters();
      return json(res, 200, { ok: true, items }, origin);
    } catch (e) {
      return json(
        res,
        500,
        { ok: false, message: e?.message || String(e) },
        origin
      );
    }
  }

  if (req.method === "POST" && url.pathname === "/print/labels") {
    try {
      const body = await readBody(req);
      const printer = String(
        body?.printer || cfg?.defaultPrinter || ""
      ).trim();

      if (!printer) {
        throw new Error("Seleccioná la impresora de etiquetas.");
      }

      const widthMm = Number(body?.widthMm || 80);
      const dotsPerLine = Number(
        body?.dotsPerLine || dotsForWidth(widthMm, cfg)
      );

      const labels = Array.isArray(body?.labels)
        ? body.labels
        : [];

      if (!labels.length) {
        throw new Error("No se recibieron etiquetas.");
      }

      const raw = await buildLabelsJob({
        labels,
        dotsPerLine,
        heightMm: Number(body?.heightMm || 35),
        dpi: Number(cfg?.dpi || 203),
        cutEach: body?.cutEach !== false,
        feedBeforeCutMm: Number(body?.feedBeforeCutMm || 0),
      });

      await sendRawToPrinter(printer, raw);

      return json(
        res,
        200,
        {
          ok: true,
          printer,
          count: labels.length,
          widthMm,
          heightMm: Number(body?.heightMm || 35),
          dotsPerLine,
        },
        origin
      );
    } catch (e) {
      return json(
        res,
        500,
        { ok: false, message: e?.message || String(e) },
        origin
      );
    }
  }

  if (req.method === "POST" && url.pathname === "/print/ticket") {
    try {
      const body = await readBody(req);
      const printer = String(
        body?.printer || cfg?.defaultPrinter || ""
      ).trim();

      if (!printer) {
        throw new Error("Seleccioná la impresora de tickets.");
      }

      const widthMm = Number(body?.widthMm || 80);

      const raw = buildTicketJob({
        ticket: body?.ticket || {},
        widthMm,
        cut: body?.cut !== false,
        feedBeforeCutMm: Number(body?.feedBeforeCutMm || 0),
        dpi: Number(cfg?.dpi || 203),
      });

      await sendRawToPrinter(printer, raw);

      return json(
        res,
        200,
        {
          ok: true,
          printer,
          widthMm,
          fiscal:
            body?.ticket?.fiscal?.autorizado === true
              ? "autorizado"
              : body?.ticket?.fiscal?.pendiente === true
              ? "pendiente"
              : "no_fiscal",
        },
        origin
      );
    } catch (e) {
      return json(
        res,
        500,
        { ok: false, message: e?.message || String(e) },
        origin
      );
    }
  }

  if (req.method === "POST" && url.pathname === "/print/test") {
    try {
      const body = await readBody(req);
      const printer = String(
        body?.printer || cfg?.defaultPrinter || ""
      ).trim();

      if (!printer) {
        throw new Error("Seleccioná una impresora.");
      }

      if (body?.type === "label") {
        const widthMm = Number(body?.widthMm || 80);
        const raw = await buildLabelsJob({
          labels: [
            {
              nombre: "PEDIDOFRESCO - PRUEBA",
              unidad: "unidad",
              precio: 1234.56,
              codigo: "7791234567890",
              barcodeFormat: "AUTO",
              showCodeText: true,
            },
          ],
          dotsPerLine: Number(
            body?.dotsPerLine ||
              dotsForWidth(widthMm, cfg)
          ),
          heightMm: Number(body?.heightMm || 35),
          dpi: Number(cfg?.dpi || 203),
          cutEach: body?.cut !== false,
        });

        await sendRawToPrinter(printer, raw);
      } else {
        const raw = buildTicketJob({
          widthMm: Number(body?.widthMm || 80),
          cut: body?.cut !== false,
          dpi: Number(cfg?.dpi || 203),
          ticket: {
            empresa: {
              nombre: "PedidoFresco",
              subtitulo: "Prueba de impresora",
              leyendaPie: "Impresion ESC/POS OK",
            },
            ventaId: "TEST-0001",
            fecha: new Date().toISOString(),
            cliente: "Consumidor final",
            caja: "Caja prueba",
            usuario: "Usuario prueba",
            items: [
              {
                codigo: "7791234567890",
                nombre: "Producto de prueba",
                cantidad: 1,
                precio: 1000,
                subtotal: 1000,
              },
            ],
            total: 1000,
            pagaCon: 1000,
            vuelto: 0,
            pago: { metodo: "EFECTIVO" },
            fiscal: {
              autorizado: false,
              pendiente: false,
            },
          },
        });

        await sendRawToPrinter(printer, raw);
      }

      return json(res, 200, { ok: true, printer }, origin);
    } catch (e) {
      return json(
        res,
        500,
        { ok: false, message: e?.message || String(e) },
        origin
      );
    }
  }

  return json(
    res,
    404,
    { ok: false, message: "Ruta no encontrada." },
    origin
  );
}

const cfg = readConfig();
const host = String(cfg?.host || "127.0.0.1");
const port = Number(cfg?.port || 9105);

const server = http.createServer((req, res) => {
  route(req, res).catch((e) => {
    json(
      res,
      500,
      { ok: false, message: e?.message || String(e) },
      String(req.headers.origin || "")
    );
  });
});

server.listen(port, host, () => {
  console.log("");
  console.log("=========================================");
  console.log(" PedidoFresco Printer");
  console.log(` http://${host}:${port}`);
  console.log(` version ${VERSION}`);
  console.log("=========================================");
  console.log("");
});
