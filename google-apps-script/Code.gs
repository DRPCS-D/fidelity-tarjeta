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
 *
 * CÓMO ACTUALIZAR (si ya tenías esto instalado y pegás una versión nueva):
 * Guardar el archivo NO alcanza para que la URL ".../exec" ya publicada
 * use el código nuevo. Hay que ir a Implementar > Administrar implementaciones,
 * editar (ícono de lápiz) la implementación existente, en "Versión" elegir
 * "Nueva versión" e Implementar. Así la URL no cambia.
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
  "egr_otros_detalle", "ing_otros_detalle",
];

// Columnas fijas al principio de la planilla.
const FIXED_COLUMNS = ["id", "timestamp", "estado"];
const ALL_COLUMNS = FIXED_COLUMNS.concat(FIELD_NAMES);

// Columnas que llegan como texto "dd/mm/aaaa". Sheets las auto-convierte a
// un valor de fecha real si se escriben sin más, lo que rompe tanto la
// vista del panel como la generación del PDF (que espera ese texto tal
// cual). Por eso se fuerza el formato de celda a texto ("@") antes de
// escribir, y se re-formatean defensivamente al leer por si ya quedaron
// guardadas como fecha (filas viejas, o edición manual en la planilla).
const DATE_COLUMNS = ["tit_fecha_solicitud", "tit_fecha_nac", "con_fecha_nac", "seg_emision", "seg_vigencia_desde", "seg_vigencia_hasta"];

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

// Si Sheets terminó guardando una fecha real (Date) en vez del texto
// "dd/mm/aaaa" esperado, la reformatea al leerla para no romper al
// panel de gestión ni al generador de PDF.
function formatCellForJson_(colName, value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (DATE_COLUMNS.indexOf(colName) !== -1) {
      return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
    }
    if (colName === "timestamp") {
      return value.toISOString();
    }
  }
  return value;
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
      headers.forEach((h, i) => { obj[h] = formatCellForJson_(h, row[i]); });
      return obj;
    });
    return jsonResponse_({ ok: true, rows: rows });
  }

  // Acción de mantenimiento: corrige filas ya guardadas donde una fecha
  // quedó como valor de fecha real en vez de texto "dd/mm/aaaa".
  // Se puede llamar una sola vez después de actualizar este script.
  if (action === "repairDates") {
    return handleRepairDates_();
  }

  // Acción de mantenimiento: agrega al final de la planilla las columnas
  // que falten (por ejemplo, campos nuevos agregados a FIELD_NAMES después
  // de que la planilla ya tenía datos, como egr_otros_detalle). Se puede
  // llamar una sola vez después de actualizar este script.
  if (action === "syncColumns") {
    return handleSyncColumns_();
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
  if (action === "update") {
    return handleUpdateRecord_(body);
  }
  if (action === "bulkImport") {
    return handleBulkImport_(body);
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

  const rowIndex = sheet.getLastRow() + 1;

  // Forzar formato de texto en las columnas de fecha ANTES de escribir el
  // valor, para que Sheets no las convierta automáticamente en un valor
  // de fecha real (eso rompería el "dd/mm/aaaa" que espera el PDF).
  DATE_COLUMNS.forEach((colName) => {
    const colIndex = ALL_COLUMNS.indexOf(colName);
    if (colIndex !== -1) {
      sheet.getRange(rowIndex, colIndex + 1).setNumberFormat("@");
    }
  });

  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
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

// Edición desde el Panel de gestión: actualiza uno o varios campos de una
// solicitud ya guardada. body.id y body.data = { nombre_columna: valor, ... }.
// No permite tocar las columnas fijas (id, timestamp, estado) por esta vía.
function handleUpdateRecord_(body) {
  const id = body.id;
  const data = body.data || {};
  if (!id) {
    return jsonResponse_({ ok: false, error: "Falta id." });
  }

  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("id");

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) === String(id)) {
      const rowIndex = r + 1;
      Object.keys(data).forEach((colName) => {
        if (FIXED_COLUMNS.indexOf(colName) !== -1) return;
        const colIndex = headers.indexOf(colName);
        if (colIndex === -1) return;
        if (DATE_COLUMNS.indexOf(colName) !== -1) {
          sheet.getRange(rowIndex, colIndex + 1).setNumberFormat("@");
        }
        sheet.getRange(rowIndex, colIndex + 1).setValue(data[colName]);
      });
      return jsonResponse_({ ok: true });
    }
  }
  return jsonResponse_({ ok: false, error: "No se encontró la solicitud con id " + id });
}

// Importación masiva: recibe muchas filas en un solo POST y las escribe
// de una sola vez (mucho más rápido y confiable que llamar "create" una
// por una). body.rows = [{ id, timestamp, estado, data: {...} }, ...]
function handleBulkImport_(body) {
  const items = body.rows || [];
  if (!items.length) {
    return jsonResponse_({ ok: false, error: "No se recibieron filas para importar." });
  }

  const sheet = getSheet_();
  const startRow = sheet.getLastRow() + 1;

  const matrix = items.map((item) => {
    const data = item.data || {};
    return ALL_COLUMNS.map((col) => {
      if (col === "id") return item.id || Utilities.getUuid();
      if (col === "timestamp") return item.timestamp || new Date().toISOString();
      if (col === "estado") return item.estado || "Pendiente";
      return data[col] !== undefined && data[col] !== null ? data[col] : "";
    });
  });

  // Igual que en handleCreate_: forzar texto en las columnas de fecha
  // ANTES de escribir, para que Sheets no las convierta en fechas reales.
  DATE_COLUMNS.forEach((colName) => {
    const colIndex = ALL_COLUMNS.indexOf(colName);
    if (colIndex !== -1) {
      sheet.getRange(startRow, colIndex + 1, matrix.length, 1).setNumberFormat("@");
    }
  });

  sheet.getRange(startRow, 1, matrix.length, ALL_COLUMNS.length).setValues(matrix);
  return jsonResponse_({ ok: true, imported: matrix.length });
}

function handleSyncColumns_() {
  const sheet = getSheet_();
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const missing = ALL_COLUMNS.filter((c) => headers.indexOf(c) === -1);
  if (missing.length) {
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
  return jsonResponse_({ ok: true, added: missing });
}

function handleRepairDates_() {
  const sheet = getSheet_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tz = Session.getScriptTimeZone();
  let fixed = 0;

  DATE_COLUMNS.forEach((colName) => {
    const colIndex = headers.indexOf(colName);
    if (colIndex === -1) return;
    const numRows = values.length - 1;
    if (numRows <= 0) return;

    // Deja toda la columna en formato texto para que no vuelva a pasar.
    sheet.getRange(2, colIndex + 1, numRows, 1).setNumberFormat("@");

    for (let r = 1; r < values.length; r++) {
      const cell = values[r][colIndex];
      if (Object.prototype.toString.call(cell) === "[object Date]") {
        const formatted = Utilities.formatDate(cell, tz, "dd/MM/yyyy");
        sheet.getRange(r + 1, colIndex + 1).setValue(formatted);
        fixed++;
      }
    }
  });

  return jsonResponse_({ ok: true, fixed: fixed });
}
