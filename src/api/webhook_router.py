"""
webhook_router.py — Router de Webhooks de WhatsApp (Meta)
Gestiona la validación del webhook (GET) y la recepción de mensajes entrantes (POST).
"""
import logging
from fastapi import APIRouter, Request, Response, HTTPException
from src.services.gemini_service import get_ai_response
from src.services.whatsapp_service import send_text_message
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)
router = APIRouter()

WHATSAPP_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "masajes_boutique_ai_2024")


@router.get("/webhook")
async def verify_webhook(request: Request):
    """
    Endpoint de verificación del Webhook de Meta.
    Meta llama a este endpoint con 3 parámetros para comprobar que el servidor es legítimo.
    Documentación: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    logger.info(f"[WEBHOOK-VERIFY] Solicitud de verificación recibida. Mode: {mode}, Token: {token}")

    if mode == "subscribe" and token == WHATSAPP_VERIFY_TOKEN:
        logger.info("[WEBHOOK-VERIFY] ✅ Verificación exitosa.")
        return Response(content=challenge, media_type="text/plain")
    else:
        logger.warning(f"[WEBHOOK-VERIFY] ❌ Token inválido recibido: '{token}'")
        raise HTTPException(status_code=403, detail="Forbidden: Token de verificación inválido.")


@router.post("/webhook")
async def receive_message(request: Request):
    """
    Endpoint principal de recepción de mensajes de WhatsApp.
    Meta envía aquí todos los eventos: mensajes nuevos, confirmaciones de lectura, etc.

    CRÍTICO: Siempre debe devolver HTTP 200 OK para evitar que Meta reintente el envío.
    """
    try:
        body = await request.json()
        logger.info(f"[WEBHOOK-INCOMING] Payload recibido: {str(body)[:300]}")

        # Navegar por la estructura anidada del payload de Meta
        entry = body.get("entry", [])
        if not entry:
            logger.info("[WEBHOOK-INCOMING] Payload sin 'entry'. Ignorando.")
            return {"status": "ok"}

        changes = entry[0].get("changes", [])
        if not changes:
            logger.info("[WEBHOOK-INCOMING] Payload sin 'changes'. Ignorando.")
            return {"status": "ok"}

        value = changes[0].get("value", {})
        messages = value.get("messages")

        # Si no hay 'messages', es una notificación de estado (leído, entregado, etc.)
        if not messages:
            logger.info("[WEBHOOK-INCOMING] Notificación de estado (sin mensajes). Ignorando.")
            return {"status": "ok"}

        message = messages[0]
        sender_phone = message.get("from")          # Número del cliente
        message_type = message.get("type")          # 'text', 'image', 'audio', etc.

        # Por ahora solo procesamos mensajes de texto
        if message_type != "text":
            logger.info(f"[WEBHOOK-INCOMING] Tipo de mensaje no soportado: '{message_type}'. Ignorando.")
            send_text_message(sender_phone, "Por ahora solo puedo responder mensajes de texto 😊")
            return {"status": "ok"}

        user_text = message.get("text", {}).get("body", "")
        logger.info(f"[WEBHOOK-INCOMING] 📩 Mensaje de {sender_phone}: '{user_text}'")

        # Llamar a la IA pasando el teléfono para mantener memoria de conversación
        ai_response = get_ai_response(user_text, phone=sender_phone)

        # Enviar la respuesta al usuario
        send_text_message(sender_phone, ai_response)

    except Exception as e:
        # Aunque haya un error interno, devolvemos 200 para que Meta no reintente
        logger.error(f"[WEBHOOK-ERROR] Error procesando el webhook: {e}", exc_info=True)

    return {"status": "ok"}
