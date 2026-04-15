# Directiva: Chatbot IA WhatsApp — Masajes Boutique

## Objetivo
Gestionar todas las conversaciones entrantes de clientes por WhatsApp de forma inteligente,
usando Google Gemini como cerebro IA, para responder preguntas, gestionar el estado de la
conversación y eventualmente redirigir a la reserva online.

## Entradas (Inputs)
- Mensajes de texto de usuario entrando por el Webhook de Meta.
- Payload JSON con campos: `from` (número de teléfono), `body` (texto del mensaje), `timestamp`.

## Salidas (Outputs)
- Respuesta de texto generada por Gemini Pro enviada de vuelta al usuario vía WhatsApp Cloud API.
- Log detallado en `logs/chatbot.log` de cada interacción.

## Flujo Principal
1. Meta envía un POST entrante a `POST /webhook`.
2. `webhook_router.py` extrae el número de teléfono y el mensaje del payload.
3. Se llama a `gemini_service.py` con el mensaje.
4. `gemini_service.py` prepara el prompt con el contexto del negocio y llama a la API de Gemini.
5. Gemini devuelve una respuesta en texto.
6. `whatsapp_service.py` envía la respuesta al usuario usando la Graph API de Meta.
7. Todo el proceso se registra en `logs/chatbot.log`.

## Variables de Entorno Requeridas
- `META_TOKEN`: Token de acceso permanente de Meta.
- `META_PHONE_ID`: ID interno del número de WhatsApp Business.
- `WHATSAPP_VERIFY_TOKEN`: Token secreto para verificar el webhook en Meta.
- `GEMINI_API_KEY`: Clave de API de Google AI Studio (Gemini Pro).

## Restricciones y Casos Borde Conocidos
- El payload de Meta envuelve los mensajes en múltiples capas de JSON. La extracción
  debe seguir la ruta: `body -> entry[0] -> changes[0] -> value -> messages[0]`.
- Si `messages` no existe en el payload (ej. notificaciones de "leído"), el servidor
  debe responder `200 OK` inmediatamente sin procesar nada para evitar reintentos de Meta.
- Nunca se debe devolver un status HTTP != 200 a Meta, o iniciará bucles de reintento.
- Si la llamada a Gemini falla, enviar al usuario el mensaje de fallback:
  "Hola, en este momento no puedo responder. Escríbeme al 670 409 550 y te atiendo."

## Personalidad del Asistente (System Prompt)
El asistente se llama "OSCAR IA" y sigue estas reglas:
- Responde SIEMPRE en español.
- Es cálido, profesional y conciso.
- Conoce los 4 servicios: Relajante (55€), Descontracturante (65€), Ayurveda (75€), Parejas (120€).
- Cubre Barcelona ciudad y área metropolitana.
- El tiempo mínimo de antelación para reservar es de 3 horas.
- Para reservas, siempre redirige al enlace: https://masajesboutique.netlify.app/reservas.html
