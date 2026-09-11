// ============================================================
// App formulario Fidelity Card — lógica de UI + generación del PDF
// ============================================================

const form = document.getElementById("fidelity-form");
const statusMsg = document.getElementById("status-msg");

// ---------- Navegación por tabs ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => b.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add("active");
  });
});

// ---------- Campos condicionales ("Otra/Otro: Especificar") ----------
function refreshConditionalInputs() {
  document.querySelectorAll(".conditional-input[data-show-when]").forEach((input) => {
    const [fieldName, expectedValue] = input.dataset.showWhen.split("=");
    const checked = form.querySelector(`input[name="${fieldName}"]:checked`);
    const show = checked && checked.value === expectedValue;
    input.classList.toggle("visible", !!show);
    if (!show) input.value = "";
  });
}
form.addEventListener("change", (e) => {
  if (e.target.type === "radio") refreshConditionalInputs();
});
refreshConditionalInputs();

// ---------- Autocálculo de Ingresos / Egresos ----------
function parseMoney(str) {
  if (!str) return 0;
  const n = parseFloat(String(str).replace(/[^\d.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, ""));
  return isNaN(n) ? 0 : n;
}
function formatMoney(n) {
  return n ? n.toLocaleString("es-PY") : "";
}
function recalcTotals() {
  const ingIds = ["ing_sueldo", "ing_sueldo_conyuge", "ing_jubilacion", "ing_otros"];
  const egrIds = ["egr_gastos_familiares", "egr_cuota_prestamos", "egr_alquiler", "egr_otros"];
  const sum = (ids) => ids.reduce((acc, id) => acc + parseMoney(form.elements[id].value), 0);
  form.elements["ing_total"].value = formatMoney(sum(ingIds));
  form.elements["egr_total"].value = formatMoney(sum(egrIds));
}
document.querySelectorAll(".money").forEach((el) => el.addEventListener("input", recalcTotals));

// ---------- Reset ----------
document.getElementById("btn-reset").addEventListener("click", () => {
  if (!confirm("¿Limpiar todos los datos del formulario?")) return;
  form.reset();
  recalcTotals();
  refreshConditionalInputs();
  setStatus("", "");
});

function setStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = "status-msg" + (type ? " " + type : "");
}

// ---------- Utilidades de fecha ----------
function splitDate(isoValue) {
  // isoValue: "YYYY-MM-DD"
  if (!isoValue) return null;
  const [y, m, d] = isoValue.split("-");
  return { day: d, month: m, year: y };
}
function formatDateDMY(isoValue) {
  const parts = splitDate(isoValue);
  if (!parts) return "";
  return `${parts.day}/${parts.month}/${parts.year}`;
}

// ---------- Generación del PDF ----------
document.getElementById("btn-generate").addEventListener("click", async () => {
  const btn = document.getElementById("btn-generate");
  btn.disabled = true;
  setStatus("Generando PDF…", "");
  try {
    await generatePdf();
    setStatus("PDF descargado correctamente.", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Ocurrió un error al generar el PDF: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
});

async function generatePdf() {
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

  const data = new FormData(form);
  const get = (name) => (data.get(name) || "").toString().trim();

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

  // ---- campos de texto simples (se excluyen las fechas libres de pág. 4,
  //      que se dibujan aparte más abajo con formato dd/mm/aaaa) ----
  for (const f of TEXT_FIELDS) {
    if (FREE_DATE_FIELDS.includes(f.name)) continue;
    const value = get(f.name);
    if (!value) continue;
    drawFitted(pages[f.page], value, f.x, f.yTop, f.size, f.maxWidth, f.bold ? fontBold : font, black);
  }

  // ---- campos de fecha con 3 huecos (día / mes / año) ----
  for (const df of DATE_FIELDS) {
    const parts = splitDate(get(df.name));
    if (!parts) continue;
    const page = pages[df.page];
    drawFitted(page, parts.day, df.day.x, df.day.yTop, df.size, 20, font, black);
    drawFitted(page, parts.month, df.month.x, df.month.yTop, df.size, 28, font, black);
    drawFitted(page, parts.year, df.year.x, df.year.yTop, df.size, 34, font, black);
  }

  // ---- fechas libres de página 4 (Emisión / Vigencia desde-hasta) ----
  for (const name of FREE_DATE_FIELDS) {
    const fieldDef = TEXT_FIELDS.find((f) => f.name === name);
    const text = formatDateDMY(get(name));
    if (!text || !fieldDef) continue;
    drawFitted(pages[fieldDef.page], text, fieldDef.x, fieldDef.yTop, fieldDef.size, fieldDef.maxWidth, font, black);
  }

  // ---- checkboxes: marca "X" centrada dentro del óvalo ----
  for (const [groupName, group] of Object.entries(CHECKBOX_GROUPS)) {
    const checked = form.querySelector(`input[name="${groupName}"]:checked`);
    if (!checked) continue;
    const opt = group.options[checked.value];
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

  const pdfBytes = await pdfDoc.save();
  downloadBlob(pdfBytes, buildFileName());
}

function buildFileName() {
  const nombre = (form.elements["tit_nombre"].value || "").trim();
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
