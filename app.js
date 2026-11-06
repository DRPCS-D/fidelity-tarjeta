// ============================================================
// App formulario Fidelity Card — lógica de UI + envío a Google Sheets
// (la generación del PDF se hace desde el panel de gestión, ver pdfgen.js)
// ============================================================

const form = document.getElementById("fidelity-form");

// ---------- Navegación por tabs / pasos ----------
// Las listas se calculan en cada uso porque el paso "Ingresos / Egresos"
// aparece u oculta según el tipo de empleo.
const getTabButtons = () => Array.from(document.querySelectorAll(".tab-btn:not([hidden])"));
const getPanels = () => Array.from(document.querySelectorAll(".tab-panel:not([hidden])"));
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnSend = document.getElementById("btn-send");
const getLastStepIndex = () => getPanels().length - 1;
let currentStep = 0;

function showStep(index) {
  const tabButtons = getTabButtons();
  const panels = getPanels();
  const lastStepIndex = panels.length - 1;
  currentStep = Math.max(0, Math.min(index, lastStepIndex));
  tabButtons.forEach((b, i) => b.classList.toggle("active", i === currentStep));
  panels.forEach((p, i) => p.classList.toggle("active", i === currentStep));
  btnPrev.hidden = currentStep === 0;
  btnNext.hidden = currentStep === lastStepIndex;
  btnSend.hidden = currentStep !== lastStepIndex;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector(".tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (btn) showStep(getTabButtons().indexOf(btn));
});
btnPrev.addEventListener("click", () => showStep(currentStep - 1));
btnNext.addEventListener("click", () => showStep(currentStep + 1));

// ---------- "Ingresos / Egresos" solo para Empleado/a y Comerciante ----------
const FINANCE_EMPLOYMENT_TYPES = ["Empleado", "Comerciante"];
const financeTabBtn = document.querySelector('.tab-btn[data-tab="finanzas"]');
const financePanel = document.querySelector('.tab-panel[data-panel="finanzas"]');
function financeEnabled() {
  return FINANCE_EMPLOYMENT_TYPES.includes(form.elements["lab_tipo_empleo"].value);
}
function refreshFinanceStep() {
  const enabled = financeEnabled();
  financeTabBtn.hidden = !enabled;
  financePanel.hidden = !enabled;
  if (!enabled) {
    // Se descartan los montos cargados, así no viajan datos de un paso inhabilitado.
    financePanel.querySelectorAll("input").forEach((el) => { el.value = ""; });
    financePanel.querySelectorAll(".field-error").forEach((el) => el.classList.remove("field-error"));
  }
  const activeIdx = getPanels().findIndex((p) => p.classList.contains("active"));
  if (activeIdx !== -1) showStep(activeIdx);
}
form.addEventListener("change", (e) => {
  if (e.target.name === "lab_tipo_empleo") refreshFinanceStep();
});
refreshFinanceStep();

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

// ---------- Bloqueo de emojis / símbolos no soportados ----------
form.addEventListener("input", (e) => {
  const el = e.target;
  if (el.tagName === "INPUT" && ["text", "email", "tel"].includes(el.type)) stripBlockedChars(el);
});

// ---------- Validación de campos obligatorios (marcados con "*") ----------
const REQUIRED_FIELDS = [
  "tit_nombre", "tit_ci", "tit_monto_solicitado", "tit_nacionalidad", "tit_sexo",
  "tit_fecha_nac", "tit_vivienda", "tit_celular",
  "dom_direccion", "dom_barrio", "dom_ciudad",
  "lab_empresa", "lab_tipo_empleo", "lab_cargo", "lab_monto_ingreso", "lab_antiguedad",
  "refper1_nombre", "refper1_celular", "refper1_vinculo",
  "refper2_nombre", "refper2_celular", "refper2_vinculo",
];

// Campos que solo se vuelven obligatorios según otra respuesta (p. ej.
// "Vivienda: Otra" exige especificar cuál).
function getConditionalRequiredFields() {
  const extra = [];
  if (form.elements["tit_vivienda"].value === "Otra") extra.push("tit_vivienda_otra");
  if (form.elements["lab_tipo_empleo"].value === "Otro") extra.push("lab_tipo_empleo_otro");
  if (financeEnabled()) extra.push("ing_sueldo");
  return extra;
}

// Devuelve los nombres de todos los campos obligatorios vacíos.
// (No se usa validación nativa del navegador porque los pasos no activos
// tienen display:none, y los campos ocultos quedan excluidos de esa validación.)
function findMissingRequiredFields() {
  return REQUIRED_FIELDS.concat(getConditionalRequiredFields()).filter((name) => {
    const el = form.elements[name];
    return !el || !(el.value || "").toString().trim();
  });
}

function goToFieldStep(name) {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) return;
  const panel = el.closest(".tab-panel");
  const index = getPanels().indexOf(panel);
  if (index !== -1) showStep(index);
  el.focus();
}

// ---------- Marcado en rojo de campos obligatorios faltantes ----------
// Para un grupo de radios, el borde rojo se aplica al contenedor
// ".radio-row" (los <input type="radio"> individuales no tienen borde propio).
function getFieldErrorTarget(name) {
  const el = form.querySelector(`[name="${name}"]`);
  if (!el) return null;
  if (el.type === "radio") {
    const wrapper = el.closest(".field-radio");
    return (wrapper && wrapper.querySelector(".radio-row")) || el;
  }
  return el;
}

function setFieldError(name, hasError) {
  const target = getFieldErrorTarget(name);
  if (target) target.classList.toggle("field-error", hasError);
}

// Limpia la marca de error de un campo apenas se completa, sin esperar
// a un nuevo intento de envío. También limpia el mensaje de "Falta
// completar..." si era justo ese campo el que faltaba.
let lastMissingFieldName = null;
form.addEventListener("input", clearFieldErrorIfFilled);
form.addEventListener("change", clearFieldErrorIfFilled);
function clearFieldErrorIfFilled(e) {
  const name = e.target.name;
  if (!name) return;
  const el = form.elements[name];
  if (el && (el.value || "").toString().trim()) {
    setFieldError(name, false);
    if (name === lastMissingFieldName) {
      lastMissingFieldName = null;
      setSendMsg("", "");
    }
  }
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
  const ingIds = ["ing_sueldo", "ing_otros"];
  const egrIds = ["egr_gastos_familiares", "egr_cuota_prestamos", "egr_alquiler", "egr_otros"];
  const sum = (ids) => ids.reduce((acc, id) => acc + parseMoney(form.elements[id].value), 0);
  form.elements["ing_total"].value = formatMoney(sum(ingIds));
  form.elements["egr_total"].value = formatMoney(sum(egrIds));
}
document.querySelectorAll(".money").forEach((el) => el.addEventListener("input", recalcTotals));

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

// Versión del texto de la declaración jurada que se muestra al cliente.
// Subir TERMS_VERSION cada vez que se cambie el texto; el hash (calculado
// sobre el texto real de la pantalla) avisa si se olvidó de subirla.
const TERMS_VERSION = "v1";
function getTermsVersion() {
  const text = document.querySelector(".terms-text").textContent.replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${TERMS_VERSION} (${h.toString(16).padStart(8, "0")})`;
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function collectFormData() {
  const data = new FormData(form);
  const get = (name) => (data.get(name) || "").toString().trim();
  const result = {};
  for (const name of ALL_FIELD_NAMES) {
    if (name === "tit_fecha_solicitud") {
      result[name] = todayDMY();
    } else if (name === "terms_version") {
      result[name] = termsCheckbox.checked ? getTermsVersion() : "";
    } else if (name === "terms_aceptado") {
      // Constancia de la aceptación (el envío exige tener el check tildado).
      result[name] = termsCheckbox.checked ? `Sí - ${todayDMY()} ${nowHM()}` : "";
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
termsCheckbox.addEventListener("change", () => {
  if (termsCheckbox.checked) {
    termsCheckbox.classList.remove("field-error");
    if (lastMissingFieldName === "terms-accept") {
      lastMissingFieldName = null;
      setSendMsg("", "");
    }
  }
});

btnSend.addEventListener("click", async () => {
  const missing = findMissingRequiredFields();
  missing.forEach((name) => setFieldError(name, true));
  if (missing.length) {
    goToFieldStep(missing[0]);
    lastMissingFieldName = missing[0];
    setSendMsg(`Falta completar el campo obligatorio "${FIELD_LABELS[missing[0]] || missing[0]}".`, "error");
    return;
  }
  if (!termsCheckbox.checked) {
    termsCheckbox.classList.add("field-error");
    showStep(getLastStepIndex());
    termsCheckbox.focus();
    lastMissingFieldName = "terms-accept";
    setSendMsg("Falta aceptar la declaración jurada y autorización para poder enviar.", "error");
    return;
  }
  lastMissingFieldName = null;
  btnSend.disabled = true;
  setSendMsg("Enviando registro…", "");
  try {
    await sendRecord();
    showSuccessScreen();
  } catch (err) {
    console.error(err);
    setSendMsg("Ocurrió un error al enviar el registro: " + err.message, "error");
  } finally {
    btnSend.disabled = false;
  }
});

function showSuccessScreen() {
  document.getElementById("tabs").hidden = true;
  form.hidden = true;
  document.getElementById("success-screen").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
