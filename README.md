# Formulario Fidelity Card

App web (sin backend propio) para completar el **Formulario Único de Identificación de Cliente y Manifestación de Bienes** de Fidelity Card, enviar cada solicitud a una **planilla de Google Sheets**, y desde un **panel de gestión** revisarlas, marcarlas como **Aprobado** / **Rechazado** y descargar el PDF con el **mismo formato exacto** del original.

## Cómo usarla

1. Abrí `index.html` con un servidor local (no funciona con doble clic por las restricciones de `fetch` sobre `file://`). Opciones simples:
   - Con Python: `python -m http.server 8000` dentro de esta carpeta, y luego abrí `http://localhost:8000` en el navegador.
   - Con Node: `npx serve .`
   - Con la extensión "Live Server" de VS Code.
   - En producción: desplegado en Vercel (sitio estático, sin configuración especial).
2. Completá los datos en las distintas pestañas (Datos del Titular, Domicilio y Laboral, Ingresos/Egresos, Referencias, Cónyuge/Adicional, Registro de Firmas, Datos de Tarjeta, Seguro Crediticio).
3. **"Enviar registro a la planilla"** guarda los datos en la planilla de Google Sheets (queda con estado "Pendiente").
4. Entrá a `gestor.html` (Panel de gestión), abrí el detalle de la solicitud y desde ahí:
   - **"Descargar PDF"** genera y descarga un PDF idéntico al formulario original, con los campos llenados y las opciones (Sexo, Estado Civil, Vivienda, Tipo de empleo) marcadas con una X — usando los datos ya guardados en la planilla.
   - **"Aprobar"** / **"Rechazar"** cambian el estado de la solicitud.

## Conectar con Google Sheets (una sola vez)

El envío de datos y el panel de gestión funcionan contra una planilla de Google Sheets, usando un pequeño script (Google Apps Script) como intermediario — no hace falta backend propio ni credenciales complejas.

1. Creá una planilla nueva en [sheets.google.com](https://sheets.google.com) (el nombre no importa, el script crea una hoja llamada "Solicitudes" adentro).
2. Menú **Extensiones > Apps Script**.
3. Borrá todo el contenido de `Code.gs` que aparece por defecto y pegá el contenido completo de [`google-apps-script/Code.gs`](google-apps-script/Code.gs) de este repo.
4. (Opcional pero recomendado) Cambiá el valor de `SHARED_TOKEN` en ese archivo por una palabra clave propia.
5. Guardá el proyecto (ícono de disco o Ctrl+S).
6. **Implementar > Nueva implementación**:
   - Tipo: **Aplicación web**.
   - Ejecutar como: **Yo** (tu cuenta de Google).
   - Quién tiene acceso: **Cualquier usuario**.
   - Implementar. La primera vez te va a pedir autorizar permisos (es tu propio script, es seguro aceptarlo).
7. Copiá la URL que termina en `/exec`.
8. En este proyecto, abrí `config.js` y completá:
   ```js
   const SHEETS_API_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
   const API_TOKEN = "el-mismo-valor-que-pusiste-en-SHARED_TOKEN";
   ```
9. Si cambiaste el token en el paso 4, actualizá también `API_TOKEN` en `config.js` para que coincida exactamente con `SHARED_TOKEN` en `Code.gs`.
10. Volvé a desplegar en Vercel (o hacé `git push`, que dispara el redeploy automático) para que el sitio use la nueva configuración.

Cada vez que agregues un campo nuevo al formulario, agregalo también en `manifest.js` (columna `ALL_FIELD_NAMES`) **y** en `FIELD_NAMES` dentro de `google-apps-script/Code.gs`, siempre al final de la lista para no correr las columnas ya existentes en la planilla.

### Actualizar el script cuando ya está instalado

Pegar una versión nueva de `Code.gs` y guardar **no alcanza** para que la URL `.../exec` ya publicada use el código nuevo (los Web Apps de Apps Script quedan "congelados" en la versión que estaba deployada). Para actualizarla sin cambiar la URL:

1. En el editor de Apps Script: **Implementar > Administrar implementaciones**.
2. Click en el ícono de lápiz (editar) de la implementación existente.
3. En **Versión**, elegí **Nueva versión**.
4. **Implementar**.

### Corregir fechas guardadas mal (una sola vez)

Google Sheets puede convertir automáticamente el texto `"dd/mm/aaaa"` en una fecha real de la hoja al guardarlo, lo que rompe tanto el panel de gestión como la descarga del PDF para esas solicitudes. La versión actual de `Code.gs` ya lo evita para los envíos nuevos. Si tenías solicitudes guardadas **antes** de este fix, corretilas una sola vez visitando en el navegador (reemplazando la URL y el token):

```
https://script.google.com/macros/s/TU_ID/exec?action=repairDates&token=TU_TOKEN
```

Va a responder algo como `{"ok":true,"fixed":2}` indicando cuántas celdas corrigió.

## Panel de gestión (`gestor.html`)

- Pide una contraseña simple (configurada en `GESTOR_PASSWORD` dentro de `config.js`) antes de mostrar las solicitudes.
- Lista todas las solicitudes con filtros por estado (Todos / Pendientes / Aprobados / Rechazados) y buscador por nombre o C.I.
- Al abrir el detalle de una solicitud se pueden ver todos los campos cargados, descargar el PDF completado, y marcarla como **Aprobado** o **Rechazado** con un clic.

### ⚠️ Sobre la seguridad de `API_TOKEN` y `GESTOR_PASSWORD`

Son una protección básica para que no cualquiera que encuentre la URL pueda cargar o leer datos — **no son un sistema de login real**, ya que ambos valores están visibles en el código fuente del sitio (cualquiera puede verlos con "Ver código fuente" del navegador). Alcanza para uso interno de un equipo chico, pero si más adelante necesitás control de acceso serio (usuarios individuales, permisos por rol, auditoría), conviene migrar a una autenticación real (por ejemplo, login con cuenta de Google restringido a tu dominio).

## Qué queda en blanco a propósito

Los espacios de **firma**, **aclaración** y **Nº de C.I.** de la Declaración Jurada, del Formulario de Registro de Firmas, de las Condiciones Generales (pág. 3) y del pie del Contrato de Seguro Crediticio (pág. 4) se dejan **en blanco** para completarse a mano, tal como se acordó.

## Estructura

- `index.html` — formulario.
- `gestor.html` — panel de gestión de solicitudes (listado, detalle, Aprobar/Rechazar, descarga de PDF).
- `styles.css` — estilos de ambas páginas.
- `config.js` — URL del Web App de Google Sheets, token compartido y contraseña del panel de gestión.
- `manifest.js` — lista maestra de campos del formulario (nombres, etiquetas legibles y agrupación), usada para enviar datos a la planilla y para mostrarlos en el panel de gestión.
- `fields.js` — coordenadas exactas (medidas sobre el PDF original) de cada campo/checkbox en cada página, usadas para generar el PDF.
- `pdfgen.js` — genera el PDF con [pdf-lib](https://pdf-lib.js.org/) (cargado desde CDN) a partir de los datos de una solicitud ya guardada; lo usa `gestor.js`.
- `app.js` — lógica del formulario: tabs, autocálculo de totales y envío del registro a Google Sheets.
- `gestor.js` — lógica del panel de gestión: login simple, listado, filtros, cambio de estado y descarga de PDF.
- `assets/fidelity-template.pdf` — copia del PDF original, usada como plantilla de fondo (no se modifica el texto legal, solo se agregan capas de texto encima).
- `assets/logo-color.png`, `assets/logo-white.png`, `assets/favicon.ico` — logo e ícono oficiales de Fidelity Group, extraídos del manual de marca.
- `google-apps-script/Code.gs` — script que se pega en Google Apps Script; expone la planilla como una API simple (crear solicitud, listar, cambiar estado).

## Identidad de marca

Los colores, la tipografía y el logo siguen el manual de marca de Fidelity Group:

- **Azul Francia 2** `#2B4193` (RGB 43-65-147) — color primario (header, botones, títulos de sección).
- **Gris 30%** `#C6C6C5` (RGB 198-198-197) — color secundario (líneas divisorias, detalles).
- Tipografía: `Helvetica Neue` (con `Helvetica`/`Arial` como respaldo, ya que Helvetica Neue no está disponible como fuente web).
- El motivo de red de nodos del manual se usa como decoración sutil en el header de ambas páginas.

Las variables de color están centralizadas en `styles.css` (`:root`), así que para ajustar la paleta alcanza con cambiar `--brand`, `--brand-dark`, `--brand-light` y `--brand-gray` ahí.

## Privacidad

El PDF se genera 100% en el navegador (a partir de los datos guardados en la planilla). Los datos del formulario solo se envían a la planilla de Google Sheets cuando hacés clic en "Enviar registro a la planilla" — nunca a ningún otro servidor.
