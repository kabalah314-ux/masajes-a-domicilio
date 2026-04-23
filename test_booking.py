import requests
import datetime
import datetime

url = "https://masajes-a-domicilio.onrender.com/api/bookings"
payload = {
  "date": "2026-05-20",
  "time": "12:00",
  "service": "Prueba en Vivo",
  "full_name": "Prueba IA Render",
  "phone": "670409550",
  "address": "Prueba Render 123",
  "notes": "Test desde el backend de Render"
}
try:
    res = requests.post(url, json=payload)
    print("Status:", res.status_code)
    print("Response:", res.json())
except Exception as e:
    print("Error:", e)
