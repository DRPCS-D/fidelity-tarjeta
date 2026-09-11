// ============================================================
// Configuración de conexión con Google Sheets (vía Apps Script).
// Completá SHEETS_API_URL después de desplegar el Web App de Apps
// Script (ver README.md, sección "Conectar con Google Sheets").
// ============================================================

// URL del Web App de Apps Script, algo como:
// https://script.google.com/macros/s/AKfycb.../exec
const SHEETS_API_URL = "";

// Token compartido simple para evitar que cualquiera con la URL
// pueda escribir en la planilla. No es seguridad fuerte (cualquiera
// que vea el código fuente lo puede ver), pero evita accesos casuales.
// Debe coincidir EXACTAMENTE con el valor de SHARED_TOKEN en Code.gs.
const API_TOKEN = "fidelity-2025";

// Contraseña simple para entrar al panel de gestión (gestor.html).
// Cambiala por la que quieras usar en tu equipo. Igual que el token
// de arriba, es una protección básica, no un login real.
const GESTOR_PASSWORD = "fidelity2025";
