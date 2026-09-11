// ============================================================
// App formulario Fidelity Card — lógica de UI + envío a Google Sheets
// (la generación del PDF se hace desde el panel de gestión, ver pdfgen.js)
// ============================================================

const form = document.getElementById("fidelity-form");

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
  setSendMsg("", "");
});

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

// ---------- Envío del registro a Google Sheets ----------
const sendMsg = document.getElementById("send-msg");
function setSendMsg(msg, type) {
  sendMsg.textContent = msg;
  sendMsg.className = "status-msg" + (type ? " " + type : "");
}

const DATE_INPUT_NAMES = ["tit_fecha_solicitud", "tit_fecha_nac", "con_fecha_nac", "seg_emision", "seg_vigencia_desde", "seg_vigencia_hasta"];

function collectFormData() {
  const data = new FormData(form);
  const get = (name) => (data.get(name) || "").toString().trim();
  const result = {};
  for (const name of ALL_FIELD_NAMES) {
    result[name] = DATE_INPUT_NAMES.includes(name) ? formatDateDMY(get(name)) : get(name);
  }
  return result;
}

async function sendRecord() {
  if (!SHEETS_API_URL) {
    throw new Error("Falta configurar SHEETS_API_URL en config.js (ver README).");
  }
  const payload = {
    token: API_TOKEN,
    action: "create",
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    data: collectFormData(),
  };
  const res = await fetch(SHEETS_API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Error desconocido al enviar el registro.");
  return json;
}

document.getElementById("btn-send").addEventListener("click", async () => {
  const btn = document.getElementById("btn-send");
  const nombre = (form.elements["tit_nombre"].value || "").trim();
  if (!nombre) {
    setSendMsg("Completá al menos el nombre del titular antes de enviar.", "error");
    return;
  }
  btn.disabled = true;
  setSendMsg("Enviando registro…", "");
  try {
    await sendRecord();
    setSendMsg("Registro enviado correctamente a la planilla. Podés descargar el PDF desde el Panel de gestión.", "ok");
  } catch (err) {
    console.error(err);
    setSendMsg("Ocurrió un error al enviar el registro: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
});
