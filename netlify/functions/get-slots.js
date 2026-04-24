/**
 * Netlify Function: get-slots
 * 
 * Este endpoint recibe una fecha (?date=YYYY-MM-DD) y devolverá 
 * las horas disponibles consultando a la API de Google Calendar.
 */

const { google } = require('googleapis');
require('dotenv').config();

function getAuth() {
  // En Producción (Netlify), lee de las variables de entorno inyectadas
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // Netlify a veces escapa los saltos de línea, esto lo corrige
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/calendar.events.readonly']
    });
  } else {
    // Fallback para pruebas locales previas a mandar a repo
    const path = require('path');
    return new google.auth.GoogleAuth({
      keyFile: path.resolve(__dirname, '../../google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/calendar.events.readonly']
    });
  }
}

/**
 * Deduce el offset en milisegundos de 'Europe/Madrid' para una fecha UTC nominal.
 * Esto asegura que detectamos el cambio de hora (Daylight Saving Time) exactamente
 * cuando ocurre sin asumir el mismo offset para todo el mes.
 */
function getMadridOffsetMs(dateUTC) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'shortOffset' });
  const parts = formatter.formatToParts(dateUTC);
  const offsetPart = parts.find(p => p.type === 'timeZoneName').value; // Ej: "GMT", "GMT+2", "GMT+02:00"
  
  if (offsetPart === 'GMT') return 0;
  
  const match = offsetPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const mins = match[3] ? parseInt(match[3], 10) : 0;
  
  return sign * (hours * 3600000 + mins * 60000);
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const dateStr = event.queryStringParameters.date;
  const monthStr = event.queryStringParameters.month;
  if (!dateStr && !monthStr) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Falta parámetro ?date= o ?month=' }) };
  }

  try {
    const auth = getAuth();
    const calendar = google.calendar({ version: 'v3', auth });
    
    // El ID de tu calendario. Recomiendo pasarlo por variable de entorno.
    // Ej: oscar@gmail.com (Asegúrate de haberle dado permisos de escritura al email del Service Account)
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    // ----------------------------------------------------------------------
    // BRANCH A: Consulta de un MES COMPLETO (?month=YYYY-MM)
    // ----------------------------------------------------------------------
    if (monthStr) {
      const [yyyy, mm] = monthStr.split('-').map(Number);
      
      const daysInMonth = new Date(yyyy, mm, 0).getDate();
      
      // Limites del mes holgados: -2 horas para cubrir UTC de Madrid 00:00
      const maxOffsetMs = 2 * 60 * 60 * 1000;
      const timeMin = new Date(Date.UTC(yyyy, mm - 1, 1, 0, 0, 0) - maxOffsetMs);
      const timeMax = new Date(Date.UTC(yyyy, mm - 1, daysInMonth, 23, 59, 59));

      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        maxResults: 2500,
        orderBy: 'startTime',
      });
      const events = response.data.items || [];

      const availableDates = [];
      const todayMs = new Date().getTime();

      // Recorrer todos los días del mes y calcular slots
      for (let dd = 1; dd <= daysInMonth; dd++) {
        const targetDateUTC = new Date(Date.UTC(yyyy, mm - 1, dd));
        const dayOfWeek = targetDateUTC.getUTCDay();

        // Solo L-S
        if (dayOfWeek < 1 || dayOfWeek > 6) continue;

        const baseSlots = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];
        let busyCount = 0;

        for (const slotTime of baseSlots) {
          const [hours, mins] = slotTime.split(':').map(Number);
          
          // Calculamos offset dinámicamente para la fecha nominal
          const nominalLocal = new Date(Date.UTC(yyyy, mm - 1, dd, hours, mins, 0));
          const offsetMs = getMadridOffsetMs(nominalLocal);
          
          const slotStartMs = nominalLocal.getTime() - offsetMs;
          const slotStart = new Date(slotStartMs);
          const slotEnd = new Date(slotStartMs + 90 * 60 * 1000);

          let isBusy = false;
          if (slotStart.getTime() < todayMs) {
            isBusy = true;
          } else {
            for (const ev of events) {
              if (!ev.start.dateTime || !ev.end.dateTime) continue;
              const evStart = new Date(ev.start.dateTime);
              const evEnd = new Date(ev.end.dateTime);
              if (slotStart < evEnd && slotEnd > evStart) {
                isBusy = true;
                break;
              }
            }
          }
          if (isBusy) busyCount++;
        }

        // Si NO todos los slots están ocupados, el día está disponible
        if (busyCount < baseSlots.length) {
          availableDates.push(`${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`);
        }
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableDates })
      };
    }

    // ----------------------------------------------------------------------
    // BRANCH B: Consulta de un DÍA ESPECÍFICO (?date=YYYY-MM-DD)
    // ----------------------------------------------------------------------
    const [yyyy, mm, dd] = dateStr.split('-').map(Number);
    
    // Limites de búsqueda holgados en Google Calendar (-2h max offset de España)
    const maxOffsetMs = 2 * 60 * 60 * 1000;
    const timeMin = new Date(Date.UTC(yyyy, mm - 1, dd,  0, 0, 0) - maxOffsetMs);
    const timeMax = new Date(Date.UTC(yyyy, mm - 1, dd, 23, 59, 59));

    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    let baseSlots = [];
    const targetDateUTC = new Date(Date.UTC(yyyy, mm - 1, dd));
    const dayOfWeek = targetDateUTC.getUTCDay();

    if (dayOfWeek >= 1 && dayOfWeek <= 6) {
      baseSlots = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];
    } else {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: [], taken: [] })
      };
    }

    const available = [];
    const taken = [];

    for (const slotTime of baseSlots) {
      const [hours, mins] = slotTime.split(':').map(Number);
      
      const nominalLocal = new Date(Date.UTC(yyyy, mm - 1, dd, hours, mins, 0));
      const offsetMs = getMadridOffsetMs(nominalLocal);
      
      const slotStartMs = nominalLocal.getTime() - offsetMs;
      const slotStart = new Date(slotStartMs);
      const slotEnd = new Date(slotStartMs + 90 * 60 * 1000);

      let isBusy = false;
      for (const ev of events) {
        if (!ev.start.dateTime || !ev.end.dateTime) continue;
        const evStart = new Date(ev.start.dateTime);
        const evEnd = new Date(ev.end.dateTime);
        if (slotStart < evEnd && slotEnd > evStart) {
          isBusy = true;
          break;
        }
      }

      if (slotStart < new Date()) {
        isBusy = true;
      }

      if (isBusy) taken.push(slotTime);
      else available.push(slotTime);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available, taken })
    };

  } catch (error) {
    console.error('Error al obtener slots:', error.message);
    
    // Fallback de demostración local si falla la auth por permisos, no colapsa el front
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        available: ['10:00', '11:30', '13:00', '16:00', '17:30', '19:00'],
        taken: ['14:30']
      })
    };
  }
};
