# Formulario Fidelity Card

App web (sin backend) para completar el **Formulario Único de Identificación de Cliente y Manifestación de Bienes** de Fidelity Card y descargar un PDF con el **mismo formato exacto** del original, con los datos ya completados.

## Cómo usarla

1. Abrí `index.html` con un servidor local (no funciona con doble clic por las restricciones de `fetch` sobre `file://`). Opciones simples:
   - Con Python: `python -m http.server 8000` dentro de esta carpeta, y luego abrí `http://localhost:8000` en el navegador.
   - Con Node: `npx serve .`
   - Con la extensión "Live Server" de VS Code.
2. Completá los datos en las distintas pestañas (Datos del Titular, Domicilio y Laboral, Ingresos/Egresos, Referencias, Cónyuge/Adicional, Registro de Firmas, Datos de Tarjeta, Seguro Crediticio).
3. Hacé clic en **"Descargar PDF completado"**. Se genera y descarga un PDF idéntico al formulario original, con los campos llenados y las opciones (Sexo, Estado Civil, Vivienda, Tipo de empleo) marcadas con una X.

## Qué queda en blanco a propósito

Los espacios de **firma**, **aclaración** y **Nº de C.I.** de la Declaración Jurada, del Formulario de Registro de Firmas, de las Condiciones Generales (pág. 3) y del pie del Contrato de Seguro Crediticio (pág. 4) se dejan **en blanco** para completarse a mano, tal como se acordó.

## Estructura

- `index.html` — formulario.
- `styles.css` — estilos.
- `fields.js` — coordenadas exactas (medidas sobre el PDF original) de cada campo/checkbox en cada página.
- `app.js` — lógica de la UI y generación del PDF con [pdf-lib](https://pdf-lib.js.org/) (cargado desde CDN).
- `assets/fidelity-template.pdf` — copia del PDF original, usada como plantilla de fondo (no se modifica el texto legal, solo se agregan capas de texto encima).

## Privacidad

Todo el procesamiento ocurre en el navegador. Ningún dato del formulario se envía a un servidor.
