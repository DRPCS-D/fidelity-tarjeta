// Coordenadas medidas directamente sobre "fidelity en pdf completo 2025.pdf"
// (PyMuPDF, sistema de origen arriba-izquierda). PAGE es 0-based.
// PAGE_W / PAGE_H son el tamaño real de cada página (A4).
const PDF_PAGE_W = 595.276;
const PDF_PAGE_H = 841.89;

// Campos de texto simple: {name, page, x, yTop, size, maxWidth, bold}
// "yTop" es la coordenada Y del renglón (medida desde arriba), tomada del
// borde inferior del texto/línea original para que el valor quede apoyado
// sobre la misma línea que en el PDF.
const TEXT_FIELDS = [
  // ---- Página 1: Datos del Titular ----
  { name: "tit_nombre", page: 0, x: 98, yTop: 164.8, size: 8, maxWidth: 350 },
  { name: "tit_ci", page: 0, x: 107, yTop: 184.8, size: 8, maxWidth: 320 },
  { name: "tit_monto_solicitado", page: 0, x: 500, yTop: 184.8, size: 7, maxWidth: 88 },
  { name: "tit_monto_concedido", page: 0, x: 504, yTop: 204.8, size: 7, maxWidth: 88 },
  { name: "tit_nacionalidad", page: 0, x: 71, yTop: 204.8, size: 8, maxWidth: 115 },
  { name: "tit_vivienda_otra", page: 0, x: 424, yTop: 224.5, size: 7, maxWidth: 150 },
  { name: "tit_celular", page: 0, x: 92, yTop: 268.6, size: 8, maxWidth: 140 },
  { name: "tit_email", page: 0, x: 310, yTop: 268.6, size: 8, maxWidth: 260 },
  { name: "meta_sucursal", page: 0, x: 497, yTop: 19.6, size: 7, maxWidth: 75 },
  { name: "meta_seccion", page: 0, x: 494, yTop: 40.3, size: 7, maxWidth: 78 },
  { name: "meta_captador", page: 0, x: 499, yTop: 61.3, size: 7, maxWidth: 73 },

  // ---- Página 1: Domicilio Particular ----
  { name: "dom_direccion", page: 0, x: 58, yTop: 333.3, size: 8, maxWidth: 410 },
  { name: "dom_barrio", page: 0, x: 46, yTop: 353.3, size: 8, maxWidth: 422 },
  { name: "dom_ciudad", page: 0, x: 50, yTop: 373.3, size: 8, maxWidth: 418 },
  { name: "dom_obs", page: 0, x: 42, yTop: 393.3, size: 8, maxWidth: 426 },

  // ---- Página 1: Datos Laborales ----
  { name: "lab_empresa", page: 0, x: 57, yTop: 455.7, size: 8, maxWidth: 248 },
  { name: "lab_celular", page: 0, x: 383, yTop: 455.7, size: 8, maxWidth: 190 },
  { name: "lab_direccion", page: 0, x: 87, yTop: 477.0, size: 8, maxWidth: 485 },
  { name: "lab_tipo_empleo_otro", page: 0, x: 450, yTop: 495.4, size: 7, maxWidth: 125 },
  { name: "lab_cargo", page: 0, x: 47, yTop: 516.2, size: 8, maxWidth: 142 },
  { name: "lab_monto_ingreso", page: 0, x: 262, yTop: 516.2, size: 7.5, maxWidth: 128 },
  { name: "lab_antiguedad", page: 0, x: 444, yTop: 516.2, size: 8, maxWidth: 130 },

  // ---- Página 1: Ingresos y Egresos ----
  { name: "ing_sueldo", page: 0, x: 50, yTop: 574.9, size: 8, maxWidth: 222 },
  { name: "ing_sueldo_conyuge", page: 0, x: 84, yTop: 594.9, size: 8, maxWidth: 188 },
  { name: "ing_jubilacion", page: 0, x: 60, yTop: 615.1, size: 8, maxWidth: 212 },
  { name: "ing_otros", page: 0, x: 77, yTop: 633.7, size: 8, maxWidth: 195 },
  { name: "ing_total", page: 0, x: 96, yTop: 654.7, size: 8, maxWidth: 178, bold: true },
  { name: "egr_gastos_familiares", page: 0, x: 346, yTop: 574.9, size: 8, maxWidth: 228 },
  { name: "egr_cuota_prestamos", page: 0, x: 356, yTop: 594.9, size: 8, maxWidth: 218 },
  { name: "egr_alquiler", page: 0, x: 340, yTop: 614.7, size: 8, maxWidth: 234 },
  { name: "egr_otros", page: 0, x: 380, yTop: 634.7, size: 8, maxWidth: 194 },
  { name: "egr_total", page: 0, x: 353, yTop: 654.7, size: 8, maxWidth: 220, bold: true },

  // ---- Página 1: Referencias ----
  { name: "refcom1_entidad", page: 0, x: 52, yTop: 727.2, size: 8, maxWidth: 166 },
  { name: "refcom1_telefono", page: 0, x: 261, yTop: 727.2, size: 8, maxWidth: 310 },
  { name: "refcom2_entidad", page: 0, x: 52, yTop: 747.2, size: 8, maxWidth: 166 },
  { name: "refcom2_telefono", page: 0, x: 261, yTop: 747.2, size: 8, maxWidth: 310 },
  { name: "refper1_nombre", page: 0, x: 98, yTop: 794.2, size: 8, maxWidth: 180 },
  { name: "refper1_celular", page: 0, x: 358, yTop: 794.2, size: 8, maxWidth: 104 },
  { name: "refper1_vinculo", page: 0, x: 501, yTop: 794.2, size: 8, maxWidth: 75 },
  { name: "refper2_nombre", page: 0, x: 98, yTop: 814.2, size: 8, maxWidth: 180 },
  { name: "refper2_celular", page: 0, x: 358, yTop: 814.2, size: 8, maxWidth: 104 },
  { name: "refper2_vinculo", page: 0, x: 501, yTop: 814.2, size: 8, maxWidth: 75 },

  // ---- Página 2: Cónyuge / Adicional ----
  { name: "con_nombre", page: 1, x: 98, yTop: 68.6, size: 8, maxWidth: 470 },
  { name: "con_nacionalidad", page: 1, x: 71, yTop: 87.6, size: 8, maxWidth: 125 },
  { name: "con_ci", page: 1, x: 291, yTop: 87.6, size: 8, maxWidth: 115 },

  { name: "conlab_empresa", page: 1, x: 57, yTop: 179.6, size: 8, maxWidth: 248 },
  { name: "conlab_celular", page: 1, x: 383, yTop: 179.6, size: 8, maxWidth: 190 },
  { name: "conlab_direccion", page: 1, x: 87, yTop: 200.8, size: 8, maxWidth: 485 },
  { name: "conlab_tipo_empleo_otro", page: 1, x: 450, yTop: 219.2, size: 7, maxWidth: 125 },
  { name: "conlab_cargo", page: 1, x: 47, yTop: 242.1, size: 8, maxWidth: 142 },
  { name: "conlab_monto_ingreso", page: 1, x: 262, yTop: 242.1, size: 7.5, maxWidth: 128 },
  { name: "conlab_antiguedad", page: 1, x: 444, yTop: 242.1, size: 8, maxWidth: 130 },

  // ---- Página 2: Registro de Firmas ----
  { name: "firma_nombres", page: 1, x: 57, yTop: 522.7, size: 8, maxWidth: 500 },
  { name: "firma_apellidos", page: 1, x: 57, yTop: 542.7, size: 8, maxWidth: 500 },

  // ---- Página 3: Datos de la Tarjeta ----
  { name: "card_numero", page: 2, x: 132, yTop: 458.8, size: 7, maxWidth: 133 },
  { name: "card_linea_credito", page: 2, x: 331, yTop: 458.8, size: 7, maxWidth: 225 },
  { name: "card_costo_emision", page: 2, x: 140, yTop: 474.0, size: 6.5, maxWidth: 124 },
  { name: "card_costo_cuota_anual", page: 2, x: 389, yTop: 474.0, size: 6.5, maxWidth: 64 },
  { name: "card_costo_renovacion", page: 2, x: 150, yTop: 489.1, size: 6.5, maxWidth: 53 },
  { name: "card_interes_compensatorio", page: 2, x: 152, yTop: 504.2, size: 6.5, maxWidth: 52 },
  { name: "card_interes_moratorio", page: 2, x: 138, yTop: 519.3, size: 6.5, maxWidth: 67 },
  { name: "card_interes_punitorio", page: 2, x: 136, yTop: 534.4, size: 6.5, maxWidth: 69 },
  { name: "card_gestion_recupero", page: 2, x: 203, yTop: 549.6, size: 7, maxWidth: 355 },

  // ---- Página 4: Seguro Crediticio ----
  { name: "seg_sucursal", page: 3, x: 59, yTop: 87.5, size: 6.5, maxWidth: 52 },
  { name: "seg_poliza", page: 3, x: 456, yTop: 85, size: 6.5, maxWidth: 100 },
  { name: "seg_asegurado", page: 3, x: 110, yTop: 104, size: 7, maxWidth: 260 },
  { name: "seg_documento", page: 3, x: 465, yTop: 104, size: 7, maxWidth: 94 },
  { name: "seg_domicilio", page: 3, x: 106, yTop: 128, size: 7, maxWidth: 174 },
  { name: "seg_localidad", page: 3, x: 337, yTop: 128, size: 7, maxWidth: 220 },
  { name: "seg_emision", page: 3, x: 59, yTop: 158, size: 6.5, maxWidth: 68 },
  { name: "seg_vigencia_desde", page: 3, x: 134, yTop: 158, size: 6.5, maxWidth: 104 },
  { name: "seg_vigencia_hasta", page: 3, x: 246, yTop: 158, size: 6.5, maxWidth: 100 },
  { name: "seg_plazo", page: 3, x: 376, yTop: 154, size: 6.5, maxWidth: 45 },
  { name: "seg_capital", page: 3, x: 428, yTop: 158, size: 6.5, maxWidth: 130 },
];

// Campos de fecha (input type="date" -> se descompone en día/mes/año y se
// coloca en los 3 huecos separados por "/" del PDF original).
const DATE_FIELDS = [
  {
    name: "tit_fecha_solicitud", page: 0, size: 8,
    day: { x: 484, yTop: 164.8 }, month: { x: 507, yTop: 164.8 }, year: { x: 544, yTop: 164.8 },
  },
  {
    name: "tit_fecha_nac", page: 0, size: 8,
    day: { x: 98, yTop: 224.5 }, month: { x: 125, yTop: 224.5 }, year: { x: 168, yTop: 224.5 },
  },
  {
    name: "con_fecha_nac", page: 1, size: 8,
    day: { x: 98, yTop: 107.3 }, month: { x: 125, yTop: 107.3 }, year: { x: 168, yTop: 107.3 },
  },
];

// Checkboxes: se dibuja una "X" centrada en (cx, cy) del óvalo correspondiente.
const CHECKBOX_GROUPS = {
  tit_sexo: {
    page: 0,
    options: { M: { cx: 233.3, cy: 198.85 }, F: { cx: 269.3, cy: 198.85 } },
  },
  tit_vivienda: {
    page: 0,
    options: {
      Propia: { cx: 275.0, cy: 218.75 },
      Alquilada: { cx: 331.3, cy: 218.75 },
      Otra: { cx: 413.1, cy: 218.75 },
    },
  },
  tit_estado_civil: {
    page: 0,
    options: {
      Soltero: { cx: 106.75, cy: 239.45 },
      Casado: { cx: 172.6, cy: 239.45 },
      Divorciado: { cx: 249.6, cy: 239.45 },
      Viudo: { cx: 307.6, cy: 239.45 },
    },
  },
  lab_tipo_empleo: {
    page: 0,
    options: {
      Empleado: { cx: 129.7, cy: 489.65 },
      Independiente: { cx: 210.0, cy: 489.65 },
      Comerciante: { cx: 281.0, cy: 489.65 },
      Jubilado: { cx: 347.6, cy: 489.65 },
      Otro: { cx: 438.35, cy: 489.65 },
    },
  },
  con_sexo: {
    page: 1,
    options: { M: { cx: 451.3, cy: 82.55 }, F: { cx: 487.3, cy: 82.55 } },
  },
  conlab_tipo_empleo: {
    page: 1,
    options: {
      Empleado: { cx: 129.7, cy: 213.55 },
      Independiente: { cx: 210.0, cy: 213.55 },
      Comerciante: { cx: 281.0, cy: 213.55 },
      Jubilado: { cx: 347.6, cy: 213.55 },
      Otro: { cx: 438.35, cy: 213.55 },
    },
  },
};

// Fechas de página 4 que se escriben como texto libre "dd/mm/aaaa"
// (en el PDF original no hay huecos separados por "/").
const FREE_DATE_FIELDS = ["seg_emision", "seg_vigencia_desde", "seg_vigencia_hasta"];
