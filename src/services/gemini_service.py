"""
gemini_service.py — Módulo de Inteligencia Artificial
Integración con Google Gemini usando el SDK oficial google-genai.
"""
import logging
import os
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
- Para reservar: https://masajesboutique.netlify.app/reservas.html

Si el cliente quiere reservar o pregunta por horarios disponibles, dile que puede hacerlo
directamente en el enlace de reservas de arriba. El sistema es rápido y sencillo."""

# Fallback message si la IA falla
FALLBACK_MESSAGE = (
    "Hola, en este momento no puedo responderte automáticamente 🙏. "
    "Por favor, escríbeme directamente al 670 409 550 y te atiendo enseguida."
)

# Inicializar cliente
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


def get_ai_response(user_message: str) -> str:
    """
    Envía un mensaje a Gemini y devuelve la respuesta generada.

    Args:
        user_message: El texto del mensaje del cliente.

    Returns:
        Respuesta de texto generada por Gemini, o el mensaje de fallback si falla.
    """
    client = _get_client()
    if not client:
        return FALLBACK_MESSAGE

    try:
        logger.info(f"[GEMINI] Enviando mensaje a la IA: '{user_message[:80]}'")
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                max_output_tokens=300,
                temperature=0.7,
            ),
        )
        ai_text = response.text.strip()
        logger.info(f"[GEMINI] Respuesta recibida: '{ai_text[:80]}'")
        return ai_text
    except Exception as e:
        logger.error(f"[GEMINI-ERROR] Fallo al llamar a Gemini: {e}")
        return FALLBACK_MESSAGE
