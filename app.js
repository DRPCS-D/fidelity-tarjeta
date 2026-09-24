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
  if (panels[currentStep].dataset.panel === "domicilio") {
    initDomMap();
    // El mapa se mide mal si se crea/actualiza mientras su contenedor
    // estaba con display:none (el paso anterior a activarse).
    setTimeout(() => domMap && domMap.invalidateSize(), 0);
  }
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

// ---------- Ubicación GPS (mapa opcional en Domicilio Particular) ----------
// Arregla las rutas de los íconos por defecto de Leaflet, que se rompen
// al cargar la librería desde un CDN en vez de instalarla localmente.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const DEFAULT_LOCATION = { lat: -25.5097, lng: -54.6111 }; // Ciudad del Este, Paraguay
const locationStatus = document.getElementById("location-status");
const btnClearLocation = document.getElementById("btn-clear-location");
let domMap = null;
let domMarker = null;

function setLocationStatus(msg, type) {
  locationStatus.textContent = msg;
  locationStatus.className = "status-msg" + (type ? " " + type : "");
}

function placeMarker(lat, lng) {
  if (domMarker) {
    domMarker.setLatLng([lat, lng]);
  } else {
    domMarker = L.marker([lat, lng]).addTo(domMap);
  }
  form.elements["dom_gps_lat"].value = lat.toFixed(6);
  form.elements["dom_gps_lng"].value = lng.toFixed(6);
  btnClearLocation.hidden = false;
}

function initDomMap() {
  if (domMap) return;
  domMap = L.map("dom-map").setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(domMap);
  domMap.on("click", (e) => {
    placeMarker(e.latlng.lat, e.latlng.lng);
    setLocationStatus("Ubicación marcada manualmente.", "ok");
  });
  // Si el formulario ya traía coordenadas cargadas (p. ej. al reabrir un
  // borrador), se muestra el marcador correspondiente.
  const savedLat = parseFloat(form.elements["dom_gps_lat"].value);
  const savedLng = parseFloat(form.elements["dom_gps_lng"].value);
  if (!isNaN(savedLat) && !isNaN(savedLng)) {
    domMap.setView([savedLat, savedLng], 16);
    placeMarker(savedLat, savedLng);
  }
}

document.getElementById("btn-use-gps").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setLocationStatus("Tu navegador no soporta geolocalización. Marcá el punto manualmente en el mapa.", "error");
    return;
  }
  setLocationStatus("Obteniendo tu ubicación…", "");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      domMap.setView([latitude, longitude], 16);
      placeMarker(latitude, longitude);
      setLocationStatus("Ubicación obtenida correctamente.", "ok");
    },
    (err) => {
      setLocationStatus(`No se pudo obtener tu ubicación (${err.message}). Marcá el punto manualmente en el mapa.`, "error");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

btnClearLocation.addEventListener("click", () => {
  if (domMarker) {
    domMap.removeLayer(domMarker);
    domMarker = null;
  }
  form.elements["dom_gps_lat"].value = "";
  form.elements["dom_gps_lng"].value = "";
  btnClearLocation.hidden = true;
  setLocationStatus("", "");
});

// ---------- Bloqueo de emojis / símbolos no soportados ----------
form.addEventListener("input", (e) => {
  const el = e.target;
  if (el.tagName === "INPUT" && ["text", "email", "tel"].includes(el.type)) stripBlockedChars(el);
});

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
  const index = Array.from(panels).indexOf(panel);
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
// a un nuevo intento de envío.
form.addEventListener("input", clearFieldErrorIfFilled);
form.addEventListener("change", clearFieldErrorIfFilled);
function clearFieldErrorIfFilled(e) {
  const name = e.target.name;
  if (!name) return;
  const el = form.elements[name];
  if (el && (el.value || "").toString().trim()) setFieldError(name, false);
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
termsCheckbox.addEventListener("change", () => {
  if (termsCheckbox.checked) termsCheckbox.classList.remove("field-error");
});

btnSend.addEventListener("click", async () => {
  const missing = findMissingRequiredFields();
  missing.forEach((name) => setFieldError(name, true));
  if (missing.length) {
    goToFieldStep(missing[0]);
    setSendMsg(`Falta completar el campo obligatorio "${FIELD_LABELS[missing[0]] || missing[0]}".`, "error");
    return;
  }
  if (!termsCheckbox.checked) {
    termsCheckbox.classList.add("field-error");
    showStep(lastStepIndex);
    termsCheckbox.focus();
    setSendMsg("Falta aceptar la declaración jurada y autorización para poder enviar.", "error");
    return;
  }
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
