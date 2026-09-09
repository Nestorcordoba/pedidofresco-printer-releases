const bwipjs = require("bwip-js");
const sharp = require("sharp");

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const b = (...values) => Buffer.from(values.flat());
const concat = (...parts) =>
  Buffer.concat(
    parts
      .flat()
      .filter(Boolean)
      .map((x) => (Buffer.isBuffer(x) ? x : Buffer.from(x)))
  );

const CP850 = {
  "á": 160, "í": 161, "ó": 162, "ú": 163, "ñ": 164, "Ñ": 165,
  "ª": 166, "º": 167, "¿": 168, "®": 169, "¬": 170, "½": 171,
  "¼": 172, "¡": 173, "«": 174, "»": 175,
  "Á": 181, "Â": 182, "À": 183, "©": 184,
  "é": 130, "â": 131, "ä": 132, "à": 133, "å": 134,
  "ç": 135, "ê": 136, "ë": 137, "è": 138, "ï": 139,
  "î": 140, "ì": 141, "Ä": 142, "Å": 143, "É": 144,
  "æ": 145, "Æ": 146, "ô": 147, "ö": 148, "ò": 149,
  "û": 150, "ù": 151, "ÿ": 152, "Ö": 153, "Ü": 154,
  "ø": 155, "£": 156, "Ø": 157, "×": 158, "ƒ": 159,
  "ü": 129,
};

function textBuffer(value) {
  const out = [];
  for (const ch of String(value ?? "")) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) out.push(code);
    else if (CP850[ch] !== undefined) out.push(CP850[ch]);
    else if (ch === "\n") out.push(LF);
    else out.push(63);
  }
  return Buffer.from(out);
}

function text(value = "") {
  return textBuffer(value);
}

function line(value = "") {
  return concat(text(value), b(LF));
}

function init() {
  // ESC @ init + ESC t 2 (CP850 en gran parte de ESC/POS)
  return concat(b(ESC, 0x40), b(ESC, 0x74, 0x02));
}

function align(mode = "left") {
  const n = mode === "center" ? 1 : mode === "right" ? 2 : 0;
  return b(ESC, 0x61, n);
}

function bold(on = true) {
  return b(ESC, 0x45, on ? 1 : 0);
}

function size(width = 1, height = 1) {
  const w = Math.max(1, Math.min(8, Number(width || 1))) - 1;
  const h = Math.max(1, Math.min(8, Number(height || 1))) - 1;
  return b(GS, 0x21, (w << 4) | h);
}

function normalSize() {
  return size(1, 1);
}

function feedDots(dots = 0) {
  let left = Math.max(0, Math.round(Number(dots || 0)));
  const parts = [];
  while (left > 0) {
    const n = Math.min(255, left);
    parts.push(b(ESC, 0x4a, n));
    left -= n;
  }
  return concat(parts);
}

function feedMm(mm = 0, dpi = 203) {
  return feedDots((Number(mm || 0) * Number(dpi || 203)) / 25.4);
}

function cut(partial = true) {
  // GS V m n. m=66 partial, m=65 full.
  return b(GS, 0x56, partial ? 66 : 65, 0);
}

function separator(chars = 48) {
  return "-".repeat(Math.max(8, chars));
}

function charsForWidth(widthMm = 80) {
  const w = Number(widthMm || 80);
  if (w <= 58) return 32;
  if (w <= 67) return 40;
  return 48;
}

function money(value) {
  const n = Number(value || 0);
  try {
    return n.toLocaleString("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `$ ${n.toFixed(2)}`;
  }
}

function clean(value) {
  return String(value ?? "")
    .replace(/[\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrap(value, maxChars) {
  const raw = clean(value);
  if (!raw) return [];

  const words = raw.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) lines.push(current);

    if (word.length <= maxChars) {
      current = word;
    } else {
      let remain = word;
      while (remain.length > maxChars) {
        lines.push(remain.slice(0, maxChars));
        remain = remain.slice(maxChars);
      }
      current = remain;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function leftRight(left, right, chars) {
  let l = clean(left);
  let r = clean(right);
  const width = Math.max(8, Number(chars || 48));

  if (r.length >= width) {
    r = r.slice(0, width);
    return r;
  }

  const availableLeft = Math.max(0, width - r.length - 1);
  if (l.length > availableLeft) {
    l = l.slice(0, availableLeft);
  }

  return `${l}${" ".repeat(
    Math.max(1, width - l.length - r.length)
  )}${r}`;
}

function formatDate(value) {
  const d = new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return clean(value);
  return d.toLocaleString("es-AR");
}

function formatCaeDate(value) {
  const raw = clean(value);
  if (!raw) return "";

  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(6, 8)}/${raw.slice(4, 6)}/${raw.slice(0, 4)}`;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString("es-AR");
}

function qrCommand(payload, moduleSize = 5) {
  const data = textBuffer(String(payload || ""));
  if (!data.length) return Buffer.alloc(0);

  const storeLen = data.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;

  return concat(
    // Model 2
    b(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00),
    // Size
    b(
      GS,
      0x28,
      0x6b,
      0x03,
      0x00,
      0x31,
      0x43,
      Math.max(3, Math.min(8, Number(moduleSize || 5)))
    ),
    // Error correction M
    b(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 49),
    // Store
    b(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30),
    data,
    // Print
    b(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
  );
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeBarcodeType(code, requested = "AUTO") {
  const value = clean(code).replace(/\s+/g, "");
  const req = String(requested || "AUTO").toUpperCase();

  if (/^\d{13}$/.test(value)) return "ean13";
  if (/^\d{8}$/.test(value)) return "ean8";
  if (req === "EAN13" && /^\d{12,13}$/.test(value)) return "ean13";
  if (req === "EAN8" && /^\d{7,8}$/.test(value)) return "ean8";
  return "code128";
}

async function barcodePng(code, requestedFormat = "AUTO") {
  const value = clean(code);
  if (!value) return null;

  let bcid = normalizeBarcodeType(value, requestedFormat);

  const make = async (type) =>
    bwipjs.toBuffer({
      bcid: type,
      text: value,
      scale: 2,
      height: 10,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
      backgroundcolor: "FFFFFF",
    });

  try {
    return await make(bcid);
  } catch {
    bcid = "code128";
    try {
      return await make(bcid);
    } catch {
      return null;
    }
  }
}

function rasterEscPos(raw, width, height, threshold = 180) {
  const bytesPerRow = Math.ceil(width / 8);
  const data = Buffer.alloc(bytesPerRow * height, 0);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = raw[y * width + x];
      const black = pixel < threshold;
      if (!black) continue;

      const offset = y * bytesPerRow + Math.floor(x / 8);
      data[offset] |= 0x80 >> (x % 8);
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  return concat(
    b(GS, 0x76, 0x30, 0x00, xL, xH, yL, yH),
    data
  );
}

async function renderLabelRaster({
  label = {},
  dotsPerLine = 576,
  heightMm = 35,
  dpi = 203,
} = {}) {
  const width = Math.max(256, Math.round(Number(dotsPerLine || 576)));
  const height = Math.max(
    120,
    Math.round((Number(heightMm || 35) * Number(dpi || 203)) / 25.4)
  );

  const price = money(label?.precio || 0);
  const name = clean(label?.nombre || "Producto").toUpperCase();
  const unit = clean(label?.unidad || "");
  const code = clean(label?.codigo || "");
  const showCodeText = label?.showCodeText !== false;
  const offer = label?.oferta === true;

  const barcode = await barcodePng(code, label?.barcodeFormat || "AUTO");
  const barcodeData = barcode
    ? `data:image/png;base64,${barcode.toString("base64")}`
    : "";

  const padX = Math.max(12, Math.round(width * 0.04));
  const contentW = width - padX * 2;

  const priceFont = width <= 384 ? 42 : width <= 512 ? 48 : 54;
  const nameFont = width <= 384 ? 20 : 22;
  const unitFont = 15;
  const codeFont = 16;

  const barcodeW = Math.min(contentW * 0.76, width <= 384 ? 300 : 410);
  const barcodeH = Math.max(46, Math.round(height * 0.22));

  const nameLines =
    name.length > 32
      ? [name.slice(0, 32), name.slice(32, 64)]
      : [name];

  const nameSvg = nameLines
    .map(
      (ln, i) =>
        `<text x="${width / 2}" y="${98 + i * 22}" text-anchor="middle" font-family="Arial" font-size="${nameFont}" font-weight="700">${xmlEscape(ln)}</text>`
    )
    .join("");

  const offerSvg = offer
    ? `<rect x="${padX}" y="6" width="88" height="24" rx="5" fill="#000"/>
       <text x="${padX + 44}" y="23" text-anchor="middle" font-family="Arial" font-size="15" font-weight="700" fill="#fff">OFERTA</text>`
    : "";

  const barcodeY = nameLines.length > 1 ? 151 : 132;
  const unitY = nameLines.length > 1 ? 140 : 119;
  const codeY = Math.min(height - 16, barcodeY + barcodeH + 20);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#fff"/>
    ${offerSvg}
    <text x="${width / 2}" y="62" text-anchor="middle"
      font-family="Arial" font-size="${priceFont}" font-weight="900">${xmlEscape(price)}</text>
    ${nameSvg}
    <text x="${width / 2}" y="${unitY}" text-anchor="middle"
      font-family="Arial" font-size="${unitFont}">${xmlEscape(
        unit ? `Unidad: ${unit}` : ""
      )}</text>
    ${
      barcodeData
        ? `<image href="${barcodeData}" x="${
            (width - barcodeW) / 2
          }" y="${barcodeY}" width="${barcodeW}" height="${barcodeH}" preserveAspectRatio="none"/>`
        : ""
    }
    ${
      showCodeText
        ? `<text x="${width / 2}" y="${codeY}" text-anchor="middle"
            font-family="Courier New" font-size="${codeFont}" font-weight="700">${xmlEscape(
              code
            )}</text>`
        : ""
    }
  </svg>`;

  const raw = await sharp(Buffer.from(svg))
    .flatten({ background: "#ffffff" })
    .greyscale()
    .resize(width, height, { fit: "fill" })
    .raw()
    .toBuffer();

  return {
    width,
    height,
    command: rasterEscPos(raw, width, height),
  };
}

async function buildLabelsJob({
  labels = [],
  dotsPerLine = 576,
  heightMm = 35,
  dpi = 203,
  cutEach = true,
  feedBeforeCutMm = 0,
} = {}) {
  const parts = [init(), align("left")];

  for (const label of labels) {
    const raster = await renderLabelRaster({
      label,
      dotsPerLine,
      heightMm,
      dpi,
    });

    parts.push(raster.command);

    if (Number(feedBeforeCutMm || 0) > 0) {
      parts.push(feedMm(feedBeforeCutMm, dpi));
    }

    if (cutEach) {
      parts.push(cut(true));
    } else {
      parts.push(b(LF));
    }
  }

  return concat(parts);
}

function buildTicketJob({
  ticket = {},
  widthMm = 80,
  cut: shouldCut = true,
  feedBeforeCutMm = 0,
  dpi = 203,
} = {}) {
  const chars = charsForWidth(widthMm);
  const parts = [init(), align("center")];

  const empresa = ticket?.empresa || {};
  const fiscal = ticket?.fiscal || {};
  const items = Array.isArray(ticket?.items) ? ticket.items : [];

  parts.push(bold(true), size(2, 2));
  parts.push(line(clean(empresa?.nombre || "PedidoFresco").toUpperCase()));
  parts.push(normalSize());

  if (empresa?.subtitulo) parts.push(line(clean(empresa.subtitulo)));
  if (empresa?.cuit) parts.push(line(`CUIT ${clean(empresa.cuit)}`));
  if (empresa?.condicionIva) parts.push(line(clean(empresa.condicionIva)));
  if (empresa?.direccion) parts.push(line(clean(empresa.direccion)));
  if (empresa?.telefono) parts.push(line(`Tel. ${clean(empresa.telefono)}`));

  parts.push(line(separator(chars)));
  parts.push(size(2, 1));
  parts.push(
    line(
      fiscal?.autorizado
        ? "TICKET FACTURA"
        : "TICKET"
    )
  );
  parts.push(normalSize(), bold(false));
  parts.push(line(separator(chars)));

  parts.push(align("left"));
  parts.push(line(leftRight("Fecha", formatDate(ticket?.fecha), chars)));
  if (ticket?.ventaId) {
    parts.push(line(leftRight("Venta", clean(ticket.ventaId), chars)));
  }
  parts.push(
    line(
      leftRight(
        "Cliente",
        clean(ticket?.cliente || "Consumidor final"),
        chars
      )
    )
  );

  if (ticket?.caja) {
    parts.push(line(leftRight("Caja", clean(ticket.caja), chars)));
  }

  if (ticket?.usuario) {
    parts.push(line(leftRight("Usuario", clean(ticket.usuario), chars)));
  }

  parts.push(line(separator(chars)));
  parts.push(bold(true), line("PRODUCTOS"), bold(false));

  for (const it of items) {
    const nameLines = wrap(
      clean(it?.nombre || "Producto").toUpperCase(),
      chars
    ).slice(0, 2);

    nameLines.forEach((ln) => parts.push(bold(true), line(ln), bold(false)));

    if (it?.codigo) {
      parts.push(line(clean(it.codigo)));
    }

    const qty = Number(it?.cantidad || 1);
    const price = Number(it?.precio || 0);
    const subtotal = Number(
      it?.subtotal ?? qty * price
    );

    parts.push(
      line(
        leftRight(
          `${qty} x ${money(price)}`,
          money(subtotal),
          chars
        )
      )
    );
  }

  parts.push(line(separator(chars)));
  parts.push(bold(true), size(2, 2));
  parts.push(
    line(
      leftRight(
        "TOTAL",
        money(ticket?.total || 0),
        Math.max(20, Math.floor(chars / 2))
      )
    )
  );
  parts.push(normalSize(), bold(false));
  parts.push(line(separator(chars)));

  const metodo = clean(
    ticket?.pago?.medioCobroNombre ||
      ticket?.pago?.metodo ||
      ""
  );
  if (metodo) {
    parts.push(line(leftRight("Paga con", metodo, chars)));
  }

  if (Number(ticket?.pagaCon || 0) > 0) {
    parts.push(
      line(leftRight("Recibido", money(ticket.pagaCon), chars))
    );
  }

  if (Number(ticket?.vuelto || 0) >= 0) {
    parts.push(
      line(leftRight("Vuelto", money(ticket.vuelto), chars))
    );
  }

  parts.push(line(separator(chars)));
  parts.push(align("center"), bold(true));

  if (fiscal?.autorizado) {
    parts.push(line("COMPROBANTE FISCAL"));
    parts.push(line("AUTORIZADO ARCA"));

    if (fiscal?.cae) {
      parts.push(line(`CAE: ${clean(fiscal.cae)}`));
    }

    const vto = formatCaeDate(fiscal?.caeVencimiento);
    if (vto) {
      parts.push(line(`Vto. CAE: ${vto}`));
    }

    if (fiscal?.qrData) {
      parts.push(b(LF));
      parts.push(qrCommand(fiscal.qrData, widthMm <= 58 ? 4 : 5));
      parts.push(b(LF));
    }
  } else if (fiscal?.pendiente) {
    parts.push(line("PENDIENTE DE"));
    parts.push(line("AUTORIZACION ARCA"));
    parts.push(bold(false));
    wrap(
      "Se autorizara automaticamente al recuperar Internet.",
      chars
    ).forEach((ln) => parts.push(line(ln)));
    parts.push(line("Este ticket aun no posee CAE."));
  } else {
    parts.push(line("COMPROBANTE NO FISCAL"));
  }

  parts.push(bold(false));
  parts.push(line(separator(chars)));

  const footer = clean(
    empresa?.leyendaPie || "Gracias por su compra!"
  );

  wrap(footer, chars).forEach((ln) => parts.push(line(ln)));
  parts.push(b(LF));

  if (Number(feedBeforeCutMm || 0) > 0) {
    parts.push(feedMm(feedBeforeCutMm, dpi));
  }

  if (shouldCut) {
    parts.push(cut(true));
  }

  return concat(parts);
}

module.exports = {
  buildLabelsJob,
  buildTicketJob,
};
