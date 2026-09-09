# PedidoFresco Printer

Servicio local Windows para impresión directa **ESC/POS RAW** desde PedidoFresco.

## Qué resuelve

- Tickets de Caja sin popup de impresión de Chrome.
- Ticket fiscal ARCA con CAE, vencimiento y QR.
- Ticket pendiente de ARCA cuando la venta se realizó offline.
- Etiquetas de 58/67/80 mm.
- Etiquetas con altura física configurable, por defecto **35 mm**.
- Corte después de cada etiqueta.
- Selección independiente de impresora de tickets y etiquetas.
- Cada PC puede tener su propia configuración.

## Arquitectura

```text
PedidoFresco Web
      |
      | HTTP local
      v
http://127.0.0.1:9105
      |
      | RAW ESC/POS
      v
Spooler Windows -> Impresora térmica
```

## Instalación en una PC

1. Descomprimir `pedido-fresco-printer`.
2. Verificar Node.js 20 o superior:
   `node -v`
3. Ejecutar `install.bat`.
4. El instalador ejecuta `npm install`, configura inicio automático y levanta el servicio.
5. Abrir en navegador:
   `http://127.0.0.1:9105/health`

Debe responder un JSON con `"ok": true`.

## Configuración en PedidoFresco

Ir a:

**Administración → Parametrías → PedidoFresco Printer · ESC/POS**

1. Habilitar servicio local.
2. URL: `http://127.0.0.1:9105`
3. Presionar **Probar conexión**.
4. Presionar **Detectar impresoras Windows**.
5. Seleccionar:
   - impresora de tickets;
   - impresora de etiquetas.
6. En Caja elegir **ESC/POS directa**.
7. En Etiquetas elegir **ESC/POS directa**.
8. Guardar configuración de esta PC.
9. Probar ticket y etiqueta.

La configuración queda en `localStorage`: no se comparte con otras PCs.

## Caja

Cuando `ticketMode = escpos`, Caja intenta imprimir por el servicio local.

Si el ticket fue autorizado por ARCA se imprime:

- CAE;
- vencimiento;
- QR fiscal.

Si la venta se hizo offline solicitando ARCA:

- imprime `PENDIENTE DE AUTORIZACION ARCA`;
- no inventa CAE;
- al sincronizar, ARCA autoriza desde backend.

Si el servicio local falla y `fallbackBrowser=true`, Caja usa el popup clásico.

## Etiquetas

El endpoint `/print/labels` genera cada etiqueta como un raster ESC/POS exacto.

Ejemplo 80 mm:

- ancho imprimible: 576 dots;
- 203 dpi;
- alto 35 mm: ~280 dots;
- se envía el raster completo;
- se manda `CUT`.

Esto evita depender de PDF, A4, 80x297, márgenes o escala de Chrome.

## Endpoints

- `GET /health`
- `GET /printers`
- `POST /print/test`
- `POST /print/ticket`
- `POST /print/labels`

## Seguridad

El servidor escucha sólo en:

`127.0.0.1`

No queda expuesto a la red LAN.

Además valida `Origin` según `config.json`.

## Impresoras compatibles

El envío usa el spooler de Windows con `DataType=RAW`.

La impresora debe aceptar comandos ESC/POS. Es habitual en POS-58, POS-80, XPrinter, GPrinter, Epson TM y compatibles.

Si el driver transforma RAW o la impresora no entiende ESC/POS, instalar el driver ESC/POS/RAW correspondiente del fabricante.
# pedidofresco-printer-releases
