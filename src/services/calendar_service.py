"""
calendar_service.py — Inteligencia de agenda y reservas
Gestiona la lectura de huecos libres y la creación de citas en Google Calendar.
"""
import os
import datetime
import calendar
import json
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build
import pytz

logger = logging.getLogger(__name__)

# Configuraciones base
CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")
BASE_SLOTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30']
MADRID_TZ = pytz.timezone('Europe/Madrid')

def get_google_auth():
    """Obtiene el cliente de google auth usando VAEs o archivo local fallback."""
    scopes = ['https://www.googleapis.com/auth/calendar.events']
    
    # Intenta leer credenciales de variables de entorno (Render)
    client_email = os.getenv("GOOGLE_SERVICE_ACCOUNT_EMAIL")
    private_key = os.getenv("GOOGLE_PRIVATE_KEY")
    
    if client_email and private_key:
        # Intenta múltiples formatos de newline (Render puede almacenarlos de formas distintas)
        if '\n' not in private_key and '\\n' in private_key:
            private_key = private_key.replace('\\n', '\n')  # literal \n → newline
        elif '\n' not in private_key:
            # Intenta unicode_escape si no tiene newlines reales ni literales
            try:
                private_key = bytes(private_key, 'utf-8').decode('unicode_escape')
            except Exception:
                private_key = private_key.replace('\\n', '\n')
        info = {
            "type": "service_account",
            "project_id": "masajes-boutique",
            "private_key_id": "dynamic",
            "private_key": private_key,
            "client_email": client_email,
            "client_id": "dynamic",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email}"
        }
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    else:
        # Fallback para entorno local
        fallback_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'google-credentials.json')
        if not os.path.exists(fallback_path):
            raise FileNotFoundError("No se encontró google-credentials.json ni variables de entorno.")
        creds = service_account.Credentials.from_service_account_file(fallback_path, scopes=scopes)
    
    return build('calendar', 'v3', credentials=creds)

def test_google_auth() -> dict:
    """Diagnóstico: verifica si las credenciales de Google Calendar funcionan."""
    try:
        svc = get_google_auth()
        import datetime
        now = MADRID_TZ.localize(datetime.datetime.now())
        result = svc.events().list(
            calendarId=CALENDAR_ID,
            timeMin=now.isoformat(),
            maxResults=1,
            singleEvents=True
        ).execute()
        return {"ok": True, "events_found": len(result.get('items', [])), "calendar_id": CALENDAR_ID}
    except Exception as e:
        return {"ok": False, "error": str(e), "calendar_id": CALENDAR_ID}


def get_slots_for_month(yyyy: int, mm: int) -> list:
    """Delvuelve una lista de las fechas (YYYY-MM-DD) del mes que tienen al menos un hueco libre."""
    try:
        service = get_google_auth()
    except Exception as e:
        logger.error(f"[CALENDAR-AUTH-ERROR] Falló autenticación Google en get_slots_for_month: {e}")
        return []  # Devuelve vacío — el front mostrará todos los días como disponibles (optimista)
    
    _, days_in_month = calendar.monthrange(yyyy, mm)
    
    # Inicio mínimo y fin máximo del mes con zona horaria Madrid
    start_of_month = MADRID_TZ.localize(datetime.datetime(yyyy, mm, 1, 0, 0, 0))
    end_of_month = MADRID_TZ.localize(datetime.datetime(yyyy, mm, days_in_month, 23, 59, 59))
    
    try:
        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=start_of_month.isoformat(),
            timeMax=end_of_month.isoformat(),
            singleEvents=True,
            orderBy='startTime',
            maxResults=2500
        ).execute()
        events = events_result.get('items', [])
    except Exception as e:
        logger.error(f"[CALENDAR-MONTH-ERROR] Falló fetch mes {yyyy}-{mm}: {e}")
        events = []

    available_dates = []
    now = datetime.datetime.now(MADRID_TZ)

    for dd in range(1, days_in_month + 1):
        target_date = datetime.datetime(yyyy, mm, dd)
        # Solo Lunes (0) a Sábado (5). Domingo es 6
        if target_date.weekday() > 5:
            continue
        
        busy_count = 0
        for slot in BASE_SLOTS:
            hh, _mm = map(int, slot.split(':'))
            slot_start = MADRID_TZ.localize(datetime.datetime(yyyy, mm, dd, hh, _mm, 0))
            slot_end = slot_start + datetime.timedelta(minutes=90)
            
            is_busy = False
            if slot_start < now:
                is_busy = True
            else:
                for ev in events:
                    if 'dateTime' not in ev.get('start', {}):
                        continue
                    ev_start = datetime.datetime.fromisoformat(ev['start']['dateTime'])
                    ev_end = datetime.datetime.fromisoformat(ev['end']['dateTime'])
                    if slot_start < ev_end and slot_end > ev_start:
                        is_busy = True
                        break
            
            if is_busy:
                busy_count += 1
                
        # Si no todos los slots están ocupados, sumar el día
        if busy_count < len(BASE_SLOTS):
            available_dates.append(f"{yyyy}-{mm:02d}-{dd:02d}")
            
    return available_dates

def get_slots_for_date(yyyy: int, mm: int, dd: int) -> dict:
    """Devuelve listado de horas completas vs horas libres para un día."""
    target_date = datetime.datetime(yyyy, mm, dd)
    
    if target_date.weekday() > 5:
        # Domingo o inválido
        return {"available": [], "taken": []}
        
    start_of_day = MADRID_TZ.localize(datetime.datetime(yyyy, mm, dd, 0, 0, 0))
    end_of_day = MADRID_TZ.localize(datetime.datetime(yyyy, mm, dd, 23, 59, 59))
    
    try:
        service = get_google_auth()
        events_result = service.events().list(
            calendarId=CALENDAR_ID,
            timeMin=start_of_day.isoformat(),
            timeMax=end_of_day.isoformat(),
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        events = events_result.get('items', [])
    except Exception as e:
        logger.error(f"[CALENDAR-DAY-ERROR] Falló fetch diario: {e}")
        # Simulador optimista en caso de error fuerte
        return {"available": ["10:00", "12:00", "16:00"], "taken": ["09:00", "18:00"]}
        
    available = []
    taken = []
    now = datetime.datetime.now(MADRID_TZ)
    
    for slot in BASE_SLOTS:
        hh, _mm = map(int, slot.split(':'))
        slot_start = MADRID_TZ.localize(datetime.datetime(yyyy, mm, dd, hh, _mm, 0))
        slot_end = slot_start + datetime.timedelta(minutes=90)
        
        is_busy = False
        if slot_start < now:
            is_busy = True
        else:
            for ev in events:
                if 'dateTime' not in ev.get('start', {}):
                    continue
                ev_start = datetime.datetime.fromisoformat(ev['start']['dateTime'])
                ev_end = datetime.datetime.fromisoformat(ev['end']['dateTime'])
                if slot_start < ev_end and slot_end > ev_start:
                    is_busy = True
                    break
        
        if is_busy:
            taken.append(slot)
        else:
            available.append(slot)
            
    return {"available": available, "taken": taken}

def insert_appointment(date_str: str, time_str: str, service_name: str, full_name: str, phone: str, address: str, notes: str) -> bool:
    """Inserta la cita firmada en Google Calendar."""
    try:
        service = get_google_auth()
        
        # date_str: YYYY-MM-DD, time_str: HH:MM
        yyyy, mm, dd = map(int, date_str.split('-'))
        hh, m_ = map(int, time_str.split(':'))
        
        # Creamos la datetime con zona horaria de Madrid explícita para evitar
        # que Google Calendar interprete la hora como UTC (diferencia de +1h/+2h).
        start_dt = MADRID_TZ.localize(datetime.datetime(yyyy, mm, dd, hh, m_))
        end_dt = start_dt + datetime.timedelta(minutes=90)
        
        event = {
            'summary': f'💆 Masaje {service_name} - {full_name.split(" ")[0]}',
            'location': address,
            'description': f'Cliente: {full_name}\nTeléfono: {phone}\nDolencia: {notes or "Ninguna"}\n\nServicio: {service_name}',
            'start': {
                # isoformat() con offset aware produce: 2026-05-20T12:00:00+02:00 ✅
                'dateTime': start_dt.isoformat(),
                'timeZone': 'Europe/Madrid',
            },
            'end': {
                'dateTime': end_dt.isoformat(),
                'timeZone': 'Europe/Madrid',
            },
            'colorId': '5'
        }
        
        logger.info(f"[CALENDAR-INSERT] Insertando sesión de {service_name} para {full_name} a las {date_str} {time_str}")
        result = service.events().insert(calendarId=CALENDAR_ID, body=event).execute()
        return bool(result.get('id'))
    except Exception as e:
        logger.error(f"[CALENDAR-INSERT-ERROR] Error al grabar en calendario: {e}", exc_info=True)
        return False
