/**
 * Backend simple para el formulario Fidelity Card, usando una planilla de
 * Google Sheets como base de datos.
 *
 * CÓMO INSTALAR (ver README.md del proyecto para el detalle paso a paso):
 * 1. Creá una planilla de Google Sheets nueva (el nombre no importa).
 * 2. Extensiones > Apps Script.
 * 3. Borrá el contenido de Code.gs y pegá este archivo completo.
 * 4. Cambiá SHARED_TOKEN por el mismo valor que pusiste en API_TOKEN
 *    dentro de config.js del proyecto web.
 * 5. Implementar > Nueva implementación > tipo "Aplicación web".
 *    - Ejecutar como: Yo (tu cuenta).
 *    - Quién tiene acceso: Cualquier usuario.
 * 6. Copiá la URL que te da (".../exec") y pegala en SHEETS_API_URL
 *    dentro de config.js.
 */

const SHEET_NAME = "Solicitudes";

// Debe coincidir EXACTAMENTE con API_TOKEN en config.js
const SHARED_TOKEN = "fidelity-2025";

// Mismo orden que ALL_FIELD_NAMES en manifest.js. Si agregás un campo
// nuevo al formulario, agregalo acá también (al final, para no romper
// las columnas ya existentes) y en manifest.js.
const FIELD_NAMES = [
  "tit_nombre", "tit_fecha_solicitud", "tit_ci", "tit_monto_solicitado", "tit_monto_concedido",
  "tit_nacionalidad", "tit_sexo", "tit_fecha_nac", "tit_vivienda", "tit_vivienda_otra",
  "tit_estado_civil", "tit_celular", "tit_email", "meta_sucursal", "meta_seccion", "meta_captador",
  "dom_direccion", "dom_barrio", "dom_ciudad", "dom_obs",
  "lab_empresa", "lab_celular", "lab_direccion", "lab_tipo_empleo", "lab_tipo_empleo_otro",
  "lab_cargo", "lab_monto_ingreso", "lab_antiguedad",
  "ing_sueldo", "ing_sueldo_conyuge", "ing_jubilacion", "ing_otros", "ing_total",
  "egr_gastos_familiares", "egr_cuota_prestamos", "egr_alquiler", "egr_otros", "egr_total",
  "refcom1_entidad", "refcom1_telefono", "refcom2_entidad", "refcom2_telefono",
  "refper1_nombre", "refper1_celular", "refper1_vinculo",
  "refper2_nombre", "refper2_celular", "refper2_vinculo",
  "con_nombre", "con_nacionalidad", "con_ci", "con_sexo", "con_fecha_nac",
  "conlab_empresa", "conlab_celular", "conlab_direccion", "conlab_tipo_empleo", "conlab_tipo_empleo_otro",
  "conlab_cargo", "conlab_monto_ingreso", "conlab_antiguedad",
  "firma_nombres", "firma_apellidos",
  "card_numero", "card_linea_credito", "card_costo_emision", "card_costo_cuota_anual",
  "card_costo_renovacion", "card_interes_compensatorio", "card_interes_moratorio",
  "card_interes_punitorio", "card_gestion_recupero",
  "seg_sucursal", "seg_poliza", "seg_asegurado", "seg_documento", "seg_domicilio", "seg_localidad",
  "seg_emision", "seg_vigencia_desde", "seg_vigencia_hasta", "seg_plazo", "seg_capital",
];

// Columnas fijas al principio de la planilla.
const FIXED_COLUMNS = ["id", "timestamp", "estado"];
const ALL_COLUMNS = FIXED_COLUMNS.concat(FIELD_NAMES);

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ALL_COLUMNS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  return token === SHARED_TOKEN;
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (!checkToken_(params.token)) {
    return jsonResponse_({ ok: false, error: "Token inválido." });
  }
  const action = params.action || "list";

  if (action === "ping") {
    return jsonResponse_({ ok: true, message: "pong" });
  }

  if (action === "list") {
    const sheet = getSheet_();
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const rows = values.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
    return jsonResponse_({ ok: true, rows: rows });
  }

  return jsonResponse_({ ok: false, error: "Acción desconocida: " + action });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ ok: false, error: "JSON inválido." });
  }

  if (!checkToken_(body.token)) {
    return jsonResponse_({ ok: false, error: "Token inválido." });
  }

  const action = body.action;

  if (action === "create") {
    return handleCreate_(body);
  }
  if (action === "updateStatus") {
    return handleUpdateStatus_(body);
  }
  return jsonResponse_({ ok: false, error: "Acción desconocida: " + action });
}

function handleCreate_(body) {
  const sheet = getSheet_();
  const id = body.id || Utilities.getUuid();
  const timestamp = new Date().toISOString();
  const data = body.data || {};
  const estado = "Pendiente";

  const row = ALL_COLUMNS.map((col) => {
    if (col === "id") return id;
    if (col === "timestamp") return timestamp;
    if (col === "estado") return estado;
    return data[col] !== undefined ? data[col] : "";
  });

  sheet.appendRow(row);
  return jsonResponse_({ ok: true, id: id, timestamp: timestamp });
}

function handleUpdateStatus_(body) {
  const id = body.id;
  const estado = body.estado;
  if (!id || !estado) {
    return jsonResponse_({ ok: false, error: "Falta id o estado." });
  }
  if (["Pendiente", "Aprobado", "Rechazado"].indexOf(estado) === -1) {
    return jsonResponse_({ ok: false, error: "Estado inválido: " + estado });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("id");
  const estadoCol = headers.indexOf("estado");

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      sheet.getRange(r + 1, estadoCol + 1).setValue(estado);
      return jsonResponse_({ ok: true });
    }
  }
  return jsonResponse_({ ok: false, error: "No se encontró la solicitud con id " + id });
}
