// ============================================================
// App formulario Fidelity Card — lógica de UI + envío a Google Sheets
// (la generación del PDF se hace desde el panel de gestión, ver pdfgen.js)
// ============================================================

const form = document.getElementById("fidelity-form");

// ---------- Navegación por tabs / pasos ----------
const tabButtons = document.querySelectorAll(".tab-btn:not([hidden])");
const panels = document.querySelectorAll(".tab-panel:not([hidden])");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnSend = document.getElementById("btn-send");
const lastStepIndex = panels.length - 1;
let currentStep = 0;

function showStep(index) {
  currentStep = Math.max(0, Math.min(index, lastStepIndex));
  tabButtons.forEach((b, i) => b.classList.toggle("active", i === currentStep));
  panels.forEach((p, i) => p.classList.toggle("active", i === currentStep));
  btnPrev.hidden = currentStep === 0;
  btnNext.hidden = currentStep === lastStepIndex;
  btnSend.hidden = currentStep !== lastStepIndex;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

tabButtons.forEach((btn, i) => {
  btn.addEventListener("click", () => showStep(i));
});
btnPrev.addEventListener("click", () => showStep(currentStep - 1));
btnNext.addEventListener("click", () => showStep(currentStep + 1));

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

// ---------- Validación de campos obligatorios (marcados con "*") ----------
const REQUIRED_FIELDS = [
  "tit_nombre", "tit_ci", "tit_monto_solicitado", "tit_nacionalidad", "tit_sexo",
  "tit_fecha_nac", "tit_vivienda", "tit_estado_civil", "tit_celular",
  "dom_direccion", "dom_barrio", "dom_ciudad",
  "lab_empresa", "lab_tipo_empleo", "lab_cargo", "lab_monto_ingreso", "lab_antiguedad",
  "ing_sueldo",
  "refper1_nombre", "refper1_celular", "refper1_vinculo",
  "refper2_nombre", "refper2_celular", "refper2_vinculo",
];

// Campos que solo se vuelven obligatorios según otra respuesta (p. ej.
// "Vivienda: Otra" exige especificar cuál).
function getConditionalRequiredFields() {
  const extra = [];
  if (form.elements["tit_vivienda"].value === "Otra") extra.push("tit_vivienda_otra");
  if (form.elements["lab_tipo_empleo"].value === "Otro") extra.push("lab_tipo_empleo_otro");
  return extra;
}

// Devuelve el nombre del primer campo obligatorio vacío, o null si está todo completo.
// (No se usa validación nativa del navegador porque los pasos no activos
// tienen display:none, y los campos ocultos quedan excluidos de esa validación.)
function findFirstMissingRequiredField() {
  for (const name of REQUIRED_FIELDS.concat(getConditionalRequiredFields())) {
    const el = form.elements[name];
    if (!el) continue;
    if (!(el.value || "").toString().trim()) return name;
  }
  return null;
}

function goToFieldStep(name) {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) return;
  const panel = el.closest(".tab-panel");
  const index = Array.from(panels).indexOf(panel);
  if (index !== -1) showStep(index);
  el.focus();
}

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
  updateSendEnabled();
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

const DATE_INPUT_NAMES = ["tit_fecha_nac", "con_fecha_nac", "seg_emision", "seg_vigencia_desde", "seg_vigencia_hasta"];

function todayDMY() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function collectFormData() {
  const data = new FormData(form);
  const get = (name) => (data.get(name) || "").toString().trim();
  const result = {};
  for (const name of ALL_FIELD_NAMES) {
    if (name === "tit_fecha_solicitud") {
      result[name] = todayDMY();
    } else {
      result[name] = DATE_INPUT_NAMES.includes(name) ? formatDateDMY(get(name)) : get(name);
    }
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

// ---------- Aceptación de términos ----------
const termsCheckbox = document.getElementById("terms-accept");
function updateSendEnabled() {
  btnSend.disabled = !termsCheckbox.checked;
}
termsCheckbox.addEventListener("change", updateSendEnabled);
updateSendEnabled();

btnSend.addEventListener("click", async () => {
  const missing = findFirstMissingRequiredField();
  if (missing) {
    goToFieldStep(missing);
    setSendMsg(`Falta completar el campo obligatorio "${FIELD_LABELS[missing] || missing}".`, "error");
    return;
  }
  if (!termsCheckbox.checked) {
    setSendMsg("Debés aceptar la declaración jurada antes de enviar.", "error");
    return;
  }
  btnSend.disabled = true;
  setSendMsg("Enviando registro…", "");
  try {
    await sendRecord();
    setSendMsg("Registro enviado correctamente a la planilla. Podés descargar el PDF desde el Panel de gestión.", "ok");
  } catch (err) {
    console.error(err);
    setSendMsg("Ocurrió un error al enviar el registro: " + err.message, "error");
  } finally {
    updateSendEnabled();
  }
});
