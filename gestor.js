// ============================================================
// Panel de gestión — lista solicitudes desde Google Sheets y
// permite marcarlas como Aprobado / Rechazado.
// ============================================================

let allRecords = [];
let currentFilter = "Todos";
let currentDateFrom = null; // Date (00:00 del día elegido) o null
let currentDateTo = null; // Date (23:59:59 del día elegido) o null
let currentSearch = "";
let selectedRecordId = null;

// ---------- Acceso simple con contraseña ----------
const gate = document.getElementById("gate");
const gateContent = document.getElementById("gestor-content");

function checkStoredAccess() {
  return sessionStorage.getItem("fidelity_gestor_ok") === "1";
}
function grantAccess() {
  sessionStorage.setItem("fidelity_gestor_ok", "1");
  gate.hidden = true;
  gateContent.hidden = false;
  loadRecords();
}
document.getElementById("gate-submit").addEventListener("click", tryLogin);
document.getElementById("gate-password").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryLogin();
});
function tryLogin() {
  const val = document.getElementById("gate-password").value;
  if (val === GESTOR_PASSWORD) {
    grantAccess();
  } else {
    document.getElementById("gate-error").textContent = "Contraseña incorrecta.";
  }
}

// ---------- Carga de datos ----------
const listStatus = document.getElementById("list-status");
function setListStatus(msg, type) {
  listStatus.textContent = msg;
  listStatus.className = "status-msg" + (type ? " " + type : "");
}

async function loadRecords() {
  if (!SHEETS_API_URL) {
    setListStatus("Falta configurar SHEETS_API_URL en config.js (ver README).", "error");
    return;
  }
  setListStatus("Cargando solicitudes…", "");
  try {
    const url = `${SHEETS_API_URL}?action=list&token=${encodeURIComponent(API_TOKEN)}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Error desconocido.");
    allRecords = json.rows || [];
    allRecords.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    setListStatus(`${allRecords.length} solicitud(es) cargada(s).`, "ok");
    renderTable();
  } catch (err) {
    console.error(err);
    setListStatus("Error al cargar las solicitudes: " + err.message, "error");
  }
}
document.getElementById("btn-refresh").addEventListener("click", loadRecords);

// ---------- Filtros (panel desplegable) ----------
const filtersDropdown = document.getElementById("filters-dropdown");
const filtersToggle = document.getElementById("filters-toggle");
const filtersPanel = document.getElementById("filters-panel");
const filtersBadge = document.getElementById("filters-badge");
const filterDateFromInput = document.getElementById("filter-date-from");
const filterDateToInput = document.getElementById("filter-date-to");

function toggleFiltersPanel(show) {
  const next = show !== undefined ? show : filtersPanel.hidden;
  filtersPanel.hidden = !next;
}
filtersToggle.addEventListener("click", () => toggleFiltersPanel());
document.addEventListener("click", (e) => {
  if (!filtersDropdown.contains(e.target)) toggleFiltersPanel(false);
});

function updateFiltersBadge() {
  let count = 0;
  if (currentFilter !== "Todos") count++;
  if (currentDateFrom) count++;
  if (currentDateTo) count++;
  filtersBadge.hidden = count === 0;
  filtersBadge.textContent = String(count);
  filtersToggle.classList.toggle("filters-toggle-active", count > 0);
}

function applyFiltersFromPanel() {
  const checked = document.querySelector('input[name="estado-filter"]:checked');
  currentFilter = checked ? checked.value : "Todos";

  const fromVal = filterDateFromInput.value;
  const toVal = filterDateToInput.value;
  currentDateFrom = fromVal ? new Date(fromVal + "T00:00:00") : null;
  currentDateTo = toVal ? new Date(toVal + "T23:59:59") : null;

  updateFiltersBadge();
  renderTable();
  toggleFiltersPanel(false);
}
document.getElementById("filters-apply").addEventListener("click", applyFiltersFromPanel);

document.getElementById("filters-clear").addEventListener("click", () => {
  document.querySelector('input[name="estado-filter"][value="Todos"]').checked = true;
  filterDateFromInput.value = "";
  filterDateToInput.value = "";
  currentFilter = "Todos";
  currentDateFrom = null;
  currentDateTo = null;
  updateFiltersBadge();
  renderTable();
  toggleFiltersPanel(false);
});

document.getElementById("search-input").addEventListener("input", (e) => {
  currentSearch = e.target.value.trim().toLowerCase();
  renderTable();
});

// ---------- Exportar a Excel ----------
document.getElementById("btn-export").addEventListener("click", () => {
  const records = getFilteredRecords();
  if (!records.length) {
    alert("No hay solicitudes para exportar con los filtros actuales.");
    return;
  }
  const rows = records.map((r) => ({
    "Fecha": formatTimestamp(r.timestamp),
    "Titular": r.tit_nombre || "",
    "C.I.": r.tit_ci || "",
    "Celular": r.tit_celular || "",
    "Monto Solicitado": r.tit_monto_solicitado ? formatMoney(r.tit_monto_solicitado) : "",
    "Estado": r.estado || "Pendiente",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `fidelity_solicitudes_${fecha}.xlsx`);
});

function formatMoney(v) {
  if (v === null || v === undefined || v === "") return "";
  // Se descartan puntos/espacios/"Gs." etc. y se vuelve a formatear, para
  // que sea idempotente aunque el valor ya venga con separador de miles
  // (p. ej. los totales de ingresos/egresos, que ya llegan formateados).
  const digits = String(v).replace(/\D/g, "");
  if (!digits) return String(v);
  const n = parseInt(digits, 10);
  return isNaN(n) ? String(v) : n.toLocaleString("es-PY");
}

// Campos monetarios (Gs.) que se muestran con punto de miles en el
// detalle de la solicitud.
const MONEY_FIELDS = new Set([
  "tit_monto_solicitado", "tit_monto_concedido", "lab_monto_ingreso",
  "ing_sueldo", "ing_sueldo_conyuge", "ing_jubilacion", "ing_otros", "ing_total",
  "egr_gastos_familiares", "egr_cuota_prestamos", "egr_alquiler", "egr_otros", "egr_total",
  "conlab_monto_ingreso", "card_linea_credito", "card_costo_emision",
  "card_costo_cuota_anual", "card_costo_renovacion", "seg_capital",
]);
function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---------- Tabla ----------
const tbody = document.getElementById("records-tbody");
const emptyMsg = document.getElementById("empty-msg");

function getFilteredRecords() {
  return allRecords.filter((r) => {
    if (currentFilter !== "Todos" && r.estado !== currentFilter) return false;
    if (currentDateFrom || currentDateTo) {
      const d = new Date(r.timestamp);
      if (isNaN(d.getTime())) return false;
      if (currentDateFrom && d < currentDateFrom) return false;
      if (currentDateTo && d > currentDateTo) return false;
    }
    if (currentSearch) {
      const haystack = `${r.tit_nombre || ""} ${r.tit_ci || ""}`.toLowerCase();
      if (!haystack.includes(currentSearch)) return false;
    }
    return true;
  });
}

function estadoBadgeClass(estado) {
  if (estado === "Aprobado") return "badge badge-approved";
  if (estado === "Rechazado") return "badge badge-rejected";
  return "badge badge-pending";
}

function renderTable() {
  const records = getFilteredRecords();
  tbody.innerHTML = "";
  emptyMsg.hidden = records.length > 0;

  for (const r of records) {
    const tr = document.createElement("tr");
    tr.className = "clickable-row";
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td>${formatTimestamp(r.timestamp)}</td>
      <td>${escapeHtml(r.tit_nombre || "—")}</td>
      <td>${escapeHtml(r.tit_ci || "—")}</td>
      <td>${escapeHtml(r.tit_celular || "—")}</td>
      <td>${formatMoney(r.tit_monto_solicitado) || "—"}</td>
      <td><span class="${estadoBadgeClass(r.estado)}">${escapeHtml(r.estado || "Pendiente")}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

tbody.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  openDetail(tr.dataset.id);
});

// ---------- Modal de detalle ----------
const modal = document.getElementById("detail-modal");
const detailBody = document.getElementById("detail-body");
const detailTitle = document.getElementById("detail-title");

function openDetail(id) {
  const record = allRecords.find((r) => String(r.id) === String(id));
  if (!record) return;
  selectedRecordId = id;
  detailTitle.textContent = `Solicitud de ${record.tit_nombre || "—"}`;

  let html = `<div class="detail-estado">Estado actual: <span class="${estadoBadgeClass(record.estado)}">${escapeHtml(record.estado || "Pendiente")}</span></div>`;
  for (const group of FIELD_GROUPS) {
    const rowsHtml = group.fields
      .filter((f) => record[f] !== undefined && record[f] !== "")
      .map((f) => {
        const value = MONEY_FIELDS.has(f) ? formatMoney(record[f]) : record[f];
        return `<div class="detail-row"><span class="detail-label">${FIELD_LABELS[f] || f}</span><span class="detail-value">${escapeHtml(value)}</span></div>`;
      })
      .join("");
    if (!rowsHtml) continue;
    html += `<div class="detail-group"><h3>${group.title}</h3>${rowsHtml}</div>`;
  }
  detailBody.innerHTML = html;
  modal.hidden = false;
}

document.getElementById("detail-close").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

document.getElementById("detail-approve").addEventListener("click", () => updateStatus("Aprobado"));
document.getElementById("detail-reject").addEventListener("click", () => updateStatus("Rechazado"));

document.getElementById("detail-download").addEventListener("click", async () => {
  const record = allRecords.find((r) => String(r.id) === String(selectedRecordId));
  if (!record) return;
  const btn = document.getElementById("detail-download");
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "Generando…";
  try {
    const pdfBytes = await generateFidelityPdf(record);
    downloadBlob(pdfBytes, buildFidelityFileName(record));
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el PDF: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
});

async function updateStatus(estado) {
  if (!selectedRecordId) return;
  const approveBtn = document.getElementById("detail-approve");
  const rejectBtn = document.getElementById("detail-reject");
  approveBtn.disabled = true;
  rejectBtn.disabled = true;
  try {
    const res = await fetch(SHEETS_API_URL, {
      method: "POST",
      body: JSON.stringify({ token: API_TOKEN, action: "updateStatus", id: selectedRecordId, estado }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Error desconocido.");
    const record = allRecords.find((r) => String(r.id) === String(selectedRecordId));
    if (record) record.estado = estado;
    modal.hidden = true;
    renderTable();
  } catch (err) {
    console.error(err);
    alert("No se pudo actualizar el estado: " + err.message);
  } finally {
    approveBtn.disabled = false;
    rejectBtn.disabled = false;
  }
}

// Se hace al final del archivo (y no arriba, cerca del resto del login)
// para que todas las funciones/variables ya estén definidas antes de
// disparar la carga automática cuando la sesión ya estaba iniciada.
if (checkStoredAccess()) {
  grantAccess();
}
