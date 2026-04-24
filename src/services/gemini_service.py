"""
gemini_service.py — Módulo de Inteligencia Artificial
Integración con Google Gemini usando el SDK oficial google-genai.
Incluye memoria de conversación por número de teléfono.
"""
import logging
import os
from collections import deque
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# System prompt: la personalidad y conocimiento del asistente
SYSTEM_PROMPT = """Eres OSCAR IA, el asistente virtual de "Masajes Boutique", un servicio
profesional de masajes a domicilio en Barcelona gestionado por Oscar.

TUS REGLAS:
- Responde SIEMPRE en español.
- Sé cálido, cercano y profesional. Usa emojis con moderación.
- Sé conciso: no escribas párrafos largos. Máximo 3-4 frases por respuesta.
- Nunca inventes información. Si no sabes algo, dilo amablemente.

SERVICIOS Y PRECIOS (con desplazamiento incluido):
- 🌊 Masaje Relajante: 55€ (60 min)
- 💆 Masaje Descontracturante: 65€ (60 min)
- 🪷 Masaje Ayurveda: 75€ (75 min)
- 👫 Masaje en Pareja: 120€ (60 min para los dos)

INFORMACIÓN OPERATIVA:
- Zona de cobertura: Barcelona ciudad y área metropolitana (Hospitalet, Badalona, Cornellà, Sant Cugat, Sabadell, Terrassa).
- Tiempo mínimo de antelación: 3 horas para el mismo día.
- Horario: Lunes a Sábado, 9:00h a 21:00h.
- Pago: Efectivo o Bizum al finalizar la sesión.
- Para reservar: https://www.masajesadomicilio.site/reservas.html

Si el cliente quiere reservar o pregunta por horarios disponibles, dile que puede hacerlo
directamente en el enlace de reservas de arriba. El sistema es rápido y sencillo."""

# Fallback message si la IA falla
FALLBACK_MESSAGE = (
    "Hola, en este momento no puedo responderte automáticamente 🙏. "
    "Por favor, escríbeme directamente al 670 409 550 y te atiendo enseguida."
)

# ── Memoria de conversación ───────────────────────────────────────────────────
# Clave: número de teléfono (str). Valor: deque de dicts {role, parts}
# Máximo 20 turnos por usuario para evitar tokens infinitos y fugas de memoria.
MAX_HISTORY_TURNS = 20
_conversation_history: dict[str, deque] = {}

def _get_history(phone: str) -> list:
    """Devuelve el historial de conversación de un teléfono como lista."""
    if phone not in _conversation_history:
        _conversation_history[phone] = deque(maxlen=MAX_HISTORY_TURNS * 2)
    return list(_conversation_history[phone])

def _append_to_history(phone: str, role: str, text: str):
    """Añade un turno al historial de conversación del teléfono."""
    if phone not in _conversation_history:
        _conversation_history[phone] = deque(maxlen=MAX_HISTORY_TURNS * 2)
    _conversation_history[phone].append(
        types.Content(role=role, parts=[types.Part(text=text)])
    )

# ── Cliente Gemini ────────────────────────────────────────────────────────────
_client = None

def _get_client():
    """Devuelve el cliente de Gemini, inicializándolo si es necesario."""
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            logger.critical("[GEMINI] GEMINI_API_KEY no está configurada.")
            return None
        _client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("[GEMINI] Cliente inicializado correctamente.")
    return _client


def get_ai_response(user_message: str, phone: str = "default") -> str:
    """
    Envía un mensaje a Gemini con el historial de conversación y devuelve la respuesta.

    Args:
        user_message: El texto del mensaje del cliente.
        phone: Número de teléfono del cliente (para memoria individual).

    Returns:
        Respuesta de texto generada por Gemini, o el mensaje de fallback si falla.
    """
    client = _get_client()
    if not client:
        return FALLBACK_MESSAGE

    try:
        logger.info(f"[GEMINI] 📩 Mensaje de {phone}: '{user_message[:80]}'")

        # Añadir el mensaje del usuario al historial ANTES de llamar a Gemini
        _append_to_history(phone, "user", user_message)
        history = _get_history(phone)

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=300,
                temperature=0.7,
            ),
        )
        ai_text = response.text.strip()

        # Guardar la respuesta de la IA en el historial
        _append_to_history(phone, "model", ai_text)

        logger.info(f"[GEMINI] ✅ Respuesta a {phone}: '{ai_text[:80]}'")
        return ai_text
    except Exception as e:
        logger.error(f"[GEMINI-ERROR] Fallo al llamar a Gemini: {e}")
        return FALLBACK_MESSAGE
