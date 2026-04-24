"""
booking_router.py — Maneja las peticiones de reservas del frontend
"""
import logging
import os
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from src.services.calendar_service import get_slots_for_month, get_slots_for_date, insert_appointment, test_google_auth
from src.services.whatsapp_service import send_template_message, send_contact_card

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

@router.get("/calendar-health")
async def calendar_health():
    """Diagnóstico: verifica si Google Calendar funciona en este entorno."""
    result = test_google_auth()
    if result["ok"]:
        logger.info("[CALENDAR-HEALTH] ✅ Google Calendar auth OK")
    else:
        logger.error(f"[CALENDAR-HEALTH] ❌ FAILED: {result['error']}")
    return result

class BookingPayload(BaseModel):
    date: str
    time: str
    service: str
    full_name: str
    phone: str
    address: str
    notes: Optional[str] = ""

@router.get("/slots")
async def get_slots(date: Optional[str] = None, month: Optional[str] = None):
    """
    Retorna la lista de fechas disponibles para un mes, 
    o las horas disponibles para un día específico.
    """
    if month:
        try:
            yyyy, mm = map(int, month.split('-'))
            available_dates = get_slots_for_month(yyyy, mm)
            return {"availableDates": available_dates}
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de mes invalido. Usa YYYY-MM")
    elif date:
        try:
            yyyy, mm, dd = map(int, date.split('-'))
            slots = get_slots_for_date(yyyy, mm, dd)
            return slots
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usa YYYY-MM-DD")
    else:
        raise HTTPException(status_code=400, detail="Falta parámetro ?date= o ?month=")

@router.post("/bookings")
async def create_booking(payload: BookingPayload):
    """
    Graba la cita en GCalendar y manda notificaciones por WhatsApp.
    """
    logger.info(f"[BOOKING-API] Nueva peticion de reserva de {payload.full_name} para {payload.date} {payload.time}")
    
    # 1. Guardar en Google Calendar (siempre primero, nunca se cancela por fallo de WA)
    cal_success = insert_appointment(
        date_str=payload.date,
        time_str=payload.time,
        service_name=payload.service,
        full_name=payload.full_name,
        phone=payload.phone,
        address=payload.address,
        notes=payload.notes
    )
    
    if not cal_success:
        logger.warning("[BOOKING-API] ⚠️ Aviso: no se ha grabado en Google Calendar. Continuando con el flujo de WA.")
    
    # 2. Preparar parámetros comunes
    nombre_pila = payload.full_name.split(' ')[0]
    oscar_phone = os.getenv("OSCAR_REAL_PHONE", "34670409550")
    
    yyyy, mm, dd = map(int, payload.date.split('-'))
    meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado', 'Domingo']
    import datetime
    dia_semana = datetime.datetime(yyyy, mm, dd).weekday()
    
    fecha_legible = f"{dias[dia_semana]}, {dd} de {meses[mm-1]}"
    hora_legible = f"{payload.time}h"
    clean_client_phone = "".join(filter(str.isdigit, payload.phone))
    wa_me_link = f"https://wa.me/{clean_client_phone}"
    
    # 3. Nombres de las plantillas Meta (deben coincidir EXACTAMENTE con las aprobadas en Meta)
    # ⚠️  IMPORTANTE: Ve a Meta Business → WhatsApp Manager → Plantillas de mensajes
    # y verifica que estas plantillas existen y están APROBADAS con estos parámetros.
    client_template = os.getenv("WA_TEMPLATE_NAME", "confirmacion_reserva")
    oscar_template = os.getenv("WA_OSCAR_TEMPLATE_NAME", "aviso_nueva_reserva")
    
    # PLANTILLA CLIENTE: confirmacion_reserva
    # Texto Meta: "Hola {{1}}, tu masaje a domicilio está confirmado 🌿\nFecha: {{2}} a las {{3}}\nDirección: {{4}}\n\n¡Muchas gracias por confiar en Masajes Boutique!"
    # Parámetros: 4 (¡exactos!)
    client_components = [
        {"type": "body", "parameters": [
            {"type": "text", "text": nombre_pila},        # {{1}} Nombre de pila
            {"type": "text", "text": fecha_legible},      # {{2}} Fecha legible
            {"type": "text", "text": hora_legible},       # {{3}} Hora
            {"type": "text", "text": payload.address}    # {{4}} Dirección
        ]}
    ]
    
    # PLANTILLA OSCAR: aviso_nueva_reserva
    # Texto Meta: "📥 Nueva reserva de {{1}}\nFecha: {{2}} a las {{3}}\nDirección: {{4}}\nContacto: {{5}}" 
    # Parámetros: 5 (¡exactos!)
    oscar_components = [
        {"type": "body", "parameters": [
            {"type": "text", "text": payload.full_name},  # {{1}} Nombre completo
            {"type": "text", "text": fecha_legible},      # {{2}} Fecha legible
            {"type": "text", "text": hora_legible},       # {{3}} Hora
            {"type": "text", "text": payload.address},   # {{4}} Dirección
            {"type": "text", "text": wa_me_link}          # {{5}} Link WhatsApp cliente
        ]}
    ]
    
    # 4. Enviar notificaciones (sin bloqueo: si WA falla, la reserva ya está en Calendar)
    # Notificación al cliente
    send_template_message(payload.phone, client_template, client_components)
    # vCard de Oscar al cliente
    send_contact_card(payload.phone)
    # Notificación interna a Oscar
    send_template_message(oscar_phone, oscar_template, oscar_components)
    
    return {"success": True, "message": "Reserva procesada"}
