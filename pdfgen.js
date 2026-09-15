// ============================================================
// Generación del PDF de Fidelity Card a partir de un objeto plano de
// datos (mismos nombres que TEXT_FIELDS/DATE_FIELDS/CHECKBOX_GROUPS de
// fields.js), con las fechas ya como texto "dd/mm/aaaa".
//
// Se usa desde el panel de gestión (gestor.js) para descargar el PDF de
// una solicitud ya guardada en la planilla. Depende de pdf-lib y de
// fields.js (deben cargarse antes que este archivo).
// ============================================================

async function generateFidelityPdf(dataset) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  const templateBytes = await fetch("assets/fidelity-template.pdf").then((r) => {
    if (!r.ok) throw new Error("No se pudo cargar la plantilla PDF (assets/fidelity-template.pdf).");
    return r.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  const black = rgb(0.05, 0.05, 0.05);

  const get = (name) => (dataset[name] || "").toString().trim();

  // Campos monetarios (Gs.) que se muestran con punto de miles en el PDF.
  const MONEY_FIELDS = new Set([
    "tit_monto_solicitado", "tit_monto_concedido", "lab_monto_ingreso",
    "ing_sueldo", "ing_sueldo_conyuge", "ing_jubilacion", "ing_otros", "ing_total",
    "egr_gastos_familiares", "egr_cuota_prestamos", "egr_alquiler", "egr_otros", "egr_total",
    "conlab_monto_ingreso", "card_linea_credito", "card_costo_emision",
    "card_costo_cuota_anual", "card_costo_renovacion", "seg_capital",
  ]);
  // Reformatea con punto de miles; idempotente aunque el valor ya venga
  // formateado (p. ej. los totales, que ya llegan con puntos).
  function formatMoneyValue(v) {
    const digits = String(v).replace(/\D/g, "");
    if (!digits) return v;
    const n = parseInt(digits, 10);
    return isNaN(n) ? v : n.toLocaleString("es-PY");
  }

  // ---- helper: dibuja texto en una línea, reduciendo el tamaño si no entra ----
  function drawFitted(page, text, x, yTop, size, maxWidth, useFont, color) {
    if (!text) return;
    let fontSize = size;
    const minSize = 5;
    while (fontSize > minSize && useFont.widthOfTextAtSize(text, fontSize) > maxWidth) {
      fontSize -= 0.25;
    }
    const baseline = PDF_PAGE_H - (yTop - fontSize * 0.22);
    page.drawText(text, { x, y: baseline, size: fontSize, font: useFont, color });
  }

  // ---- campos de texto simples (incluye las fechas libres de pág. 4,
  //      que ya llegan formateadas como "dd/mm/aaaa") ----
  const OTROS_DETALLE_MAP = { ing_otros: "ing_otros_detalle", egr_otros: "egr_otros_detalle" };
  for (const f of TEXT_FIELDS) {
    let value = get(f.name);
    if (MONEY_FIELDS.has(f.name) && value) value = formatMoneyValue(value);
    const detalleField = OTROS_DETALLE_MAP[f.name];
    if (detalleField) {
      const detalle = get(detalleField);
      if (detalle && value) value = `${detalle} - Gs. ${value}`;
      else if (detalle) value = detalle;
    }
    if (!value) continue;
    drawFitted(pages[f.page], value, f.x, f.yTop, f.size, f.maxWidth, f.bold ? fontBold : font, black);
  }

  // ---- campos de fecha con 3 huecos (día / mes / año), guardados como "dd/mm/aaaa" ----
  function parseDMY(value) {
    if (!value) return null;
    const parts = value.split("/");
    if (parts.length !== 3) return null;
    return { day: parts[0].trim(), month: parts[1].trim(), year: parts[2].trim() };
  }
  for (const df of DATE_FIELDS) {
    const parts = parseDMY(get(df.name));
    if (!parts) continue;
    const page = pages[df.page];
    drawFitted(page, parts.day, df.day.x, df.day.yTop, df.size, 20, font, black);
    drawFitted(page, parts.month, df.month.x, df.month.yTop, df.size, 28, font, black);
    drawFitted(page, parts.year, df.year.x, df.year.yTop, df.size, 34, font, black);
  }

  // ---- checkboxes: marca "X" centrada dentro del óvalo ----
  for (const [groupName, group] of Object.entries(CHECKBOX_GROUPS)) {
    const value = get(groupName);
    if (!value) continue;
    const opt = group.options[value];
    if (!opt) continue;
    const size = 7.5;
    const mark = "X";
    const w = fontBold.widthOfTextAtSize(mark, size);
    const page = pages[group.page];
    page.drawText(mark, {
      x: opt.cx - w / 2,
      y: PDF_PAGE_H - opt.cy - size * 0.36,
      size,
      font: fontBold,
      color: black,
    });
  }

  return pdfDoc.save();
}

function buildFidelityFileName(dataset) {
  const nombre = (dataset.tit_nombre || "").trim();
  const slug = nombre
    ? nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    : "cliente";
  return `fidelity_${slug}.pdf`;
}

function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
