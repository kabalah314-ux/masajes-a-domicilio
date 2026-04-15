"""
whatsapp_service.py — Módulo de Salida WhatsApp
Envía mensajes de texto al usuario usando la Graph API de Meta (WhatsApp Cloud API).
"""
import logging
import requests
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

META_TOKEN = os.getenv("META_TOKEN")
META_PHONE_ID = os.getenv("META_PHONE_ID")

GRAPH_API_URL = f"https://graph.facebook.com/v19.0/{META_PHONE_ID}/messages"


def send_text_message(to: str, text: str) -> bool:
    """
    Envía un mensaje de texto plano a un número de WhatsApp.

    Args:
        to: Número de teléfono del destinatario (sin + y con prefijo de país, ej: 34670409550).
        text: Texto del mensaje a enviar.

    Returns:
        True si el mensaje se envió correctamente, False en caso de error.
    """
    if not META_TOKEN or not META_PHONE_ID:
        logger.error("[WA] Faltan credenciales META_TOKEN o META_PHONE_ID. No se puede enviar mensaje.")
        return False

    headers = {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json",
    }

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }

    try:
        response = requests.post(GRAPH_API_URL, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
        logger.info(f"[WA] Mensaje enviado correctamente a {to}.")
        return True
    except requests.exceptions.HTTPError as e:
        logger.error(f"[WA-HTTP-ERROR] Fallo al enviar a {to}. Status: {e.response.status_code}. Detalle: {e.response.text}")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"[WA-NET-ERROR] Error de red al enviar a {to}: {e}")
        return False
