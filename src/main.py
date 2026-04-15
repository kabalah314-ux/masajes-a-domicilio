"""
main.py — Punto de Entrada del Servidor FastAPI
Microservicio Chatbot IA — Masajes Boutique
"""
import logging
import os
import sys

# Asegurar que la raíz del proyecto esté en el PATH de Python
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.api.webhook_router import router as webhook_router
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

# ── Configuración de Logging ────────────────────────────────────────────────
# Log simultáneo en consola Y en archivo logs/chatbot.log
os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),                                # Consola (visible en Render)
        logging.FileHandler("logs/chatbot.log", encoding="utf-8"),  # Archivo local
    ],
)
logger = logging.getLogger(__name__)

# ── Aplicación FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title="Masajes Boutique — Chatbot IA API",
    description="Servidor de Webhooks de WhatsApp + Gemini Pro para automatizar la atención al cliente.",
    version="1.0.0",
)

# Registrar el router de webhooks
app.include_router(webhook_router)


@app.get("/")
async def health_check():
    """Endpoint de comprobación de salud (para Render y monitoreo)."""
    logger.info("[HEALTH] Ping recibido.")
    return {"status": "online", "service": "Masajes Boutique Chatbot IA v1.0"}


# ── Arranque del Servidor ────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    logger.info(f"[STARTUP] Iniciando servidor en el puerto {port}...")
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=False)
