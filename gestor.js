// ============================================================
// Panel de gestión — lista solicitudes desde Google Sheets y
// permite marcarlas como Aprobado / Rechazado.
// ============================================================

let allRecords = [];
let currentFilter = "Todos";
let currentSearch = "";
let selectedRecordId = null;
let selectedRecordFull = null;

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

function renderLoadingRows() {
  tbody.innerHTML = `
    <tr class="skeleton-row"><td colspan="7">Cargando solicitudes…</td></tr>
  `;
  emptyMsg.hidden = true;
}

async function loadRecords() {
  if (!SHEETS_API_URL) {
    setListStatus("Falta configurar SHEETS_API_URL en config.js (ver README).", "error");
    return;
  }
  setListStatus("Cargando solicitudes…", "");
  renderLoadingRows();
  const btnRefresh = document.getElementById("btn-refresh");
  btnRefresh.disabled = true;
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
    tbody.innerHTML = "";
    emptyMsg.hidden = false;
  } finally {
    btnRefresh.disabled = false;
  }
}
document.getElementById("btn-refresh").addEventListener("click", loadRecords);

// ---------- Filtros ----------
document.getElementById("filter-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll("#filter-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  currentFilter = btn.dataset.estado;
  renderTable();
});
document.getElementById("search-input").addEventListener("input", (e) => {
  currentSearch = e.target.value.trim().toLowerCase();
  renderTable();
});

function formatMoney(v) {
  if (!v) return "";
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? v : n.toLocaleString("es-PY");
}
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
    tr.innerHTML = `
      <td>${formatTimestamp(r.timestamp)}</td>
      <td>${escapeHtml(r.tit_nombre || "—")}</td>
      <td>${escapeHtml(r.tit_ci || "—")}</td>
      <td>${escapeHtml(r.tit_celular || "—")}</td>
      <td>${formatMoney(r.tit_monto_solicitado) || "—"}</td>
      <td><span class="${estadoBadgeClass(r.estado)}">${escapeHtml(r.estado || "Pendiente")}</span></td>
      <td class="row-actions">
        <button type="button" class="btn secondary btn-sm" data-action="detail" data-id="${escapeHtml(r.id)}">Ver</button>
      </td>
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
  const btn = e.target.closest("button[data-action='detail']");
  if (!btn) return;
  openDetail(btn.dataset.id);
});

// ---------- Modal de detalle ----------
const modal = document.getElementById("detail-modal");
const detailBody = document.getElementById("detail-body");
const detailTitle = document.getElementById("detail-title");

async function fetchFullRecord(id) {
  const url = `${SHEETS_API_URL}?action=get&id=${encodeURIComponent(id)}&token=${encodeURIComponent(API_TOKEN)}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "Error desconocido.");
  return json.row;
}

function renderDetailBody(record) {
  let html = `<div class="detail-estado">Estado actual: <span class="${estadoBadgeClass(record.estado)}">${escapeHtml(record.estado || "Pendiente")}</span></div>`;
  for (const group of FIELD_GROUPS) {
    const rowsHtml = group.fields
      .filter((f) => record[f] !== undefined && record[f] !== "")
      .map((f) => `<div class="detail-row"><span class="detail-label">${FIELD_LABELS[f] || f}</span><span class="detail-value">${escapeHtml(record[f])}</span></div>`)
      .join("");
    if (!rowsHtml) continue;
    html += `<div class="detail-group"><h3>${group.title}</h3>${rowsHtml}</div>`;
  }
  detailBody.innerHTML = html;
}

async function openDetail(id) {
  const summary = allRecords.find((r) => String(r.id) === String(id));
  selectedRecordId = id;
  selectedRecordFull = null;
  detailTitle.textContent = `Solicitud de ${(summary && summary.tit_nombre) || "—"}`;
  detailBody.innerHTML = '<p class="hint">Cargando detalle…</p>';
  modal.hidden = false;

  try {
    const record = await fetchFullRecord(id);
    if (selectedRecordId !== id) return; // se cerró/cambió mientras cargaba
    selectedRecordFull = record;
    detailTitle.textContent = `Solicitud de ${record.tit_nombre || "—"}`;
    renderDetailBody(record);
  } catch (err) {
    console.error(err);
    detailBody.innerHTML = `<p class="status-msg error">Error al cargar el detalle: ${escapeHtml(err.message)}</p>`;
  }
}

document.getElementById("detail-close").addEventListener("click", () => { modal.hidden = true; });
modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });

document.getElementById("detail-approve").addEventListener("click", () => updateStatus("Aprobado"));
document.getElementById("detail-reject").addEventListener("click", () => updateStatus("Rechazado"));

document.getElementById("detail-download").addEventListener("click", async () => {
  const btn = document.getElementById("detail-download");
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "Generando…";
  try {
    const record = selectedRecordFull || (await fetchFullRecord(selectedRecordId));
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
    if (selectedRecordFull) selectedRecordFull.estado = estado;
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
// para que tbody/emptyMsg y las demás funciones ya estén definidas antes
// de disparar la carga automática cuando la sesión ya estaba iniciada.
if (checkStoredAccess()) {
  grantAccess();
}
