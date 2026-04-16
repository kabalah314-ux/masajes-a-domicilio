"""
booking_router.py — Maneja las peticiones de reservas del frontend
"""
import logging
import os
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from src.services.calendar_service import get_slots_for_month, get_slots_for_date, insert_appointment
from src.services.whatsapp_service import send_template_message, send_contact_card

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

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
    
    # 1. Guardar en Google Calendar
    cal_success = insert_appointment(
        date_str=payload.date,
        time_str=payload.time,
        service_name=payload.service,
        full_name=payload.full_name,
        phone=payload.phone,
        address=payload.address,
        notes=payload.notes
    )
    
    # Aunque el calendario falle localmente, continuamos con la reserva (o depende del nivel de rigidez deseado)
    if not cal_success:
        logger.warning("[BOOKING-API] Aviso: no se ha grabado en Google Calendar, puede que falle la auteticación local, pero seguimos el flujo.")
    
    # 2. Enviar WhatsApps
    nombre_pila = payload.full_name.split(' ')[0]
    oscar_phone = os.getenv("OSCAR_REAL_PHONE", "34670409550")
    
    # Reconstruímos el formato español legible
    # Python std no parsea nombres en español de forma fácil con strftime, 
    # usar un array básico
    yyyy, mm, dd = map(int, payload.date.split('-'))
    meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado', 'Domingo']
    import datetime
    dia_semana = datetime.datetime(yyyy, mm, dd).weekday()
    
    fecha_legible = f"{dias[dia_semana]}, {dd} de {meses[mm-1]}"
    hora_legible = f"{payload.time}h"
    
    clean_client_phone = "".join(filter(str.isdigit, payload.phone))
    wa_me_link = f"https://wa.me/{clean_client_phone}"
    
    # Parametros esperados por las plantillas Meta (asegurar el número correcto de param)
    # Plantilla de cliente: {{1}} Nombre, {{2}} Fecha, {{3}} Hora, {{4}} Direccion
    client_components = [
        {"type": "body", "parameters": [
            {"type": "text", "text": nombre_pila},
            {"type": "text", "text": fecha_legible},
            {"type": "text", "text": hora_legible},
            {"type": "text", "text": payload.address}
        ]}
    ]
    
    # Plantilla de Oscar: {{1}} Nombre completo, {{2}} Fecha, {{3}} Hora, {{4}} Direccion, {{5}} Link wa.me
    oscar_components = [
        {"type": "body", "parameters": [
            {"type": "text", "text": payload.full_name},
            {"type": "text", "text": fecha_legible},
            {"type": "text", "text": hora_legible},
            {"type": "text", "text": payload.address},
            {"type": "text", "text": wa_me_link}
        ]}
    ]
    
    client_template = os.getenv("WA_TEMPLATE_NAME", "confirmacion_oscar")
    oscar_template = os.getenv("WA_OSCAR_TEMPLATE_NAME", client_template)
    
    # Enviar al cliente
    send_template_message(payload.phone, client_template, client_components)
    # Enviar la vCard de oscar al cliente (opcional y sin bloqueo)
    send_contact_card(payload.phone)
    
    # Enviar a oscar
    send_template_message(oscar_phone, oscar_template, oscar_components)
    
    return {"success": True, "message": "Reserva procesada"}
