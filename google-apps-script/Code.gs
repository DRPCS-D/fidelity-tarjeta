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

// Busca en qué fila de la hoja está un id, leyendo SOLO la columna "id"
// (mucho más rápido que traer toda la hoja para buscar una fila).
// Devuelve el número de fila real (1-indexed) o -1 si no se encontró.
function findRowById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

// Devuelve una solicitud completa (todas las columnas), para el detalle
// del panel de gestión y la generación del PDF.
function handleGetOne_(params) {
  const id = params.id;
  if (!id) {
    return jsonResponse_({ ok: false, error: "Falta id." });
  }
  const sheet = getSheet_();
  const row = findRowById_(sheet, id);
  if (row === -1) {
    return jsonResponse_({ ok: false, error: "No se encontró la solicitud con id " + id });
  }
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => { obj[h] = formatCellForJson_(h, values[i]); });
  return jsonResponse_({ ok: true, row: obj });
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
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const colIndex = {};
    headers.forEach((h, i) => { colIndex[h] = i; });
    // El listado inicial del panel solo necesita estas columnas (lo que se
    // ve en la tabla + lo que se busca). Traer todo (85+ columnas x cientos
    // de filas) hace que la carga inicial pese ~1MB y tarde varios segundos;
    // el detalle completo de cada solicitud se pide aparte, al abrirla
    // (ver acción "get"). Además se lee solo hasta la última columna que
    // hace falta (en vez de toda la hoja), para que el propio getValues()
    // sea más rápido del lado de Sheets.
    const summaryCols = ["id", "timestamp", "estado", "tit_nombre", "tit_ci", "tit_celular", "tit_monto_solicitado"];
    const maxIndex = summaryCols.reduce((max, c) => {
      const i = colIndex[c];
      return (i !== undefined && i > max) ? i : max;
    }, 0);
    const numDataRows = lastRow - 1;
    const rows = [];
    if (numDataRows > 0) {
      const values = sheet.getRange(2, 1, numDataRows, maxIndex + 1).getValues();
      values.forEach((row) => {
        const obj = {};
        summaryCols.forEach((h) => {
          const i = colIndex[h];
          obj[h] = i !== undefined ? formatCellForJson_(h, row[i]) : "";
        });
        rows.push(obj);
      });
    }
    return jsonResponse_({ ok: true, rows: rows });
  }

  if (action === "get") {
    return handleGetOne_(params);
  }

  // Acción de mantenimiento: corrige filas ya guardadas donde una fecha
  // quedó como valor de fecha real en vez de texto "dd/mm/aaaa".
  // Se puede llamar una sola vez después de actualizar este script.
  if (action === "repairDates") {
    return handleRepairDates_();
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
  const row = findRowById_(sheet, id);
  if (row === -1) {
    return jsonResponse_({ ok: false, error: "No se encontró la solicitud con id " + id });
  }
  const estadoCol = ALL_COLUMNS.indexOf("estado") + 1;
  sheet.getRange(row, estadoCol).setValue(estado);
  return jsonResponse_({ ok: true });
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
