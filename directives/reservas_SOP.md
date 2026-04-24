# Directiva: Sistema Autónomo de Reservas FastAPI (Calendar + WhatsApp)

## Objetivo
Unificar la lógica de agendamiento, lectura de Google Calendar y automatización de WhatsApp dentro del servidor backend autónomo FastAPI alojado en Render. Esto elimina la dependencia de Netlify Functions y n8n, creando un microservicio autocontenido en Python.

## Entradas (Inputs)
1. **GET `/api/slots?date=YYYY-MM-DD`**: Petición desde el front-end para leer los horarios ocupados.
2. **POST `/api/bookings`**: Petición desde el front-end (`js/reservas.js`) con payload: `{ date, time, service, full_name, phone, address, notes }`.

## Salidas (Outputs)
1. Inserción de un nuevo evento en Google Calendar usando `google-credentials.json` (Service Account).
2. Notificación vía WhatsApp (Plantilla de Meta) al **Cliente**: Confirmando la cita (Nombre, fecha, hora, dirección).
3. Notificación vía WhatsApp (Plantilla de Meta) a **Oscar**: Información de la reserva + enlace `wa.me/` del cliente.
4. Envío opcional de Tarjeta de Contacto (vCard) de Oscar al cliente para facilitar comunicación futura.

## Flujo Principal
1. El usuario finaliza el formulario en `reservas.js`.
2. `reservas.js` envía el POST al servidor en Render (`/api/bookings`).
3. `booking_router.py` valida la carga (payload).
4. Llama a `calendar_service.py` para bloquear la hora en Google Calendar de forma estricta (usando `Europe/Madrid`).
5. Tras confirmarse el evento en Calendar, llama a `whatsapp_service.send_template()` dos veces en paralelo (una al cliente, otra a Oscar).
6. El backend responde HTTP 200 al frontend y el frontend muestra el ticket de confirmación al usuario.

## Variables de Entorno Requeridas
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `GOOGLE_PRIVATE_KEY` (O lectura local de `google-credentials.json`).
- `GOOGLE_CALENDAR_ID`: El ID del calendario principal.
- `META_TOKEN` y `META_PHONE_ID`: Credenciales de WhatsApp Cloud API.
- `OSCAR_REAL_PHONE`: El número de teléfono destino para avisos internos.
- `WA_TEMPLATE_NAME` y `WA_OSCAR_TEMPLATE_NAME`: Nombres internos en Meta de las plantillas aprobadas.

## Restricciones y Casos Borde Conocidos
- **Husos Horarios:** Google Calendar API es implacable con las zonas horarias. Los eventos deben crearse con `MADRID_TZ.localize()` antes de llamar a `.isoformat()`, que produce el offset correcto `+02:00`/`+01:00`. NUNCA añadir `+ 'Z'` a una datetime local: eso la marca como UTC y desplaza la cita 1-2 horas. [CORREGIDO ✅]
- **Fail-safe de WhatsApp:** Si Meta/WhatsApp se cae o bloquea, **NUNCA** se debe abortar la escritura en Calendar. Calendar va primero. Si WhatsApp falla, se loggea como error pero la reserva cuenta como confirmada internamente y el Frontend recibe "200 OK".
- **Formato Teléfonos:** Para generar enlace `wa.me`, se debe limpiar el teléfono de espacios, guiones y signos de '+'. Para la API de Meta, `_format_phone()` en `whatsapp_service.py` añade el prefijo `34` automáticamente si el número tiene 9 dígitos. [CORREGIDO ✅]
- **Plantillas Meta — CRÍTICO:** Las plantillas `WA_TEMPLATE_NAME` y `WA_OSCAR_TEMPLATE_NAME` deben existir y estar **APROBADAS** en Meta Business → WhatsApp Manager → Plantillas. El número exacto de parámetros `{{N}}` en el texto de la plantilla debe coincidir exactamente con los que envía el código o Meta devuelve error #132000.
  - `confirmacion_reserva`: 4 parámetros → {{1}} Nombre, {{2}} Fecha, {{3}} Hora, {{4}} Dirección
  - `aviso_nueva_reserva`: 5 parámetros → {{1}} Nombre, {{2}} Fecha, {{3}} Hora, {{4}} Dirección, {{5}} Link wa.me
- **Modo Desarrollo Meta (#131030):** En modo sandbox solo se puede enviar a números añadidos manualmente como testers en la consola de Meta (developers.facebook.com → App → WhatsApp → Quick Start). Para clientes reales hay que pasar la app a Modo Live (requiere verificación de empresa).
- **Memoria de Conversación:** El chatbot ahora mantiene historial por número de teléfono en `_conversation_history` (dict de deques, máx 20 turnos). Al reiniciar el servidor se pierde el historial. Para persistencia se necesitaría Redis.

- **Estructura Plantillas:** En Meta, si la plantilla requiere 4 parámetros `{{1}} {{2}} {{3}} {{4}}`, el body components no debe tener ni 3 ni 5, o fallará con error 400.
- **URL Backend en Frontend — CRÍTICO:** `js/reservas.js` tiene la URL del backend hardcodeada en 3 sitios (GET slots mes, GET slots día, POST bookings). SIEMPRE verificar que apuntan a `masajes-a-domicilio.onrender.com/api`. En Abr-2026 se detectó que el POST de bookings apuntaba a un placeholder (`tu-backend-fastapi.onrender.com`) → las reservas se enviaban al vacío y el frontend mostraba "éxito" porque el `catch` lo tragaba. [CORREGIDO ✅]
- **Render Plan Gratuito:** El servidor se duerme tras ~15min de inactividad. El primer request tras dormir tarda ~30s (cold start). Esto puede causar timeout en la carga de slots del calendario.
