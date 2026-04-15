/**
 * Netlify Function: book-appointment
 * 
 * Este endpoint recibe (vía POST) los datos de la reserva desde el grid nativo:
 * { date, time, service, full_name, phone, address, notes }
 * 
 * Actúa como orquestador para:
 * 1. Insertar el evento en Google Calendar usando Service Account auth.
 * 2. Enviar DOS confirmaciones vía WhatsApp Cloud API (Cliente + Oscar).
 */

const { google } = require('googleapis');
const https = require('https');
require('dotenv').config();

/**
 * Envía una copia de la reserva a n8n para automatizaciones extra
 */
async function sendToN8N(payload) {
  const N8N_URL = process.env.N8N_WEBHOOK_URL;
  if (!N8N_URL) {
    console.warn('[n8n] Omitiendo: No hay N8N_WEBHOOK_URL configurado.');
    return;
  }

  const postData = JSON.stringify(payload);
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(N8N_URL, options, (res) => {
      res.on('data', () => {});
      res.on('end', () => resolve());
    });
    req.on('error', (e) => {
      console.error('[n8n-ERROR]', e.message);
      resolve();
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Convierte "YYYY-MM-DD" + "HH:MM" en textos legibles en español para WhatsApp.
 * Trabaja directamente con los valores locales del formulario (sin tocar UTC).
 * Ej: formatDateES('2024-04-15') → "Lunes, 15 de Abril"
 *     formatTimeES('18:00')      → "18:00h"
 */
function formatDateES(dateStr) {
  // Parseamos manualmente para evitar el problema de UTC: new Date('YYYY-MM-DD')
  // interpreta la fecha como medianoche UTC y puede desplazar el día.
  const [year, month, day] = dateStr.split('-').map(Number);
  // Meses en español (índice 1-12)
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  // Días de la semana en español (0 = Domingo)
  const dias  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  // Usamos Date.UTC para obtener el día de la semana correcto sin offset de timezone
  const diaSemana = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${dias[diaSemana]}, ${day} de ${meses[month - 1]}`;
}

function formatTimeES(timeStr) {
  // Simplemente añadimos la 'h' al final: '18:00' → '18:00h'
  return `${timeStr}h`;
}

function getAuth() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/calendar.events']
    });
  } else {
    // Fallback para dev local
    const path = require('path');
    return new google.auth.GoogleAuth({
      keyFile: path.resolve(__dirname, '../../google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/calendar.events']
    });
  }
}

/**
 * Envía un mensaje de WhatsApp usando la API de Meta
 */
async function sendWhatsApp(telefono, templateName, components) {
  const WA_PHONE_NUMBER_ID = process.env.META_PHONE_ID;
  const META_TOKEN = process.env.META_TOKEN;

  if (!WA_PHONE_NUMBER_ID || !META_TOKEN) {
    console.warn(`[WA] Omitiendo envío a ${telefono}: Faltan credenciales de Meta.`);
    return;
  }

  const cleanPhone = telefono.replace(/\D/g, '');
  const postData = JSON.stringify({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'es' },
      components: components
    }
  });

  const options = {
    hostname: 'graph.facebook.com',
    path: `/v17.0/${WA_PHONE_NUMBER_ID}/messages`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        const parsed = responseBody ? JSON.parse(responseBody) : {};
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[WA] Mensaje enviado a ${telefono} (Template: ${templateName})`);
        } else {
          console.error(`[WA-ERROR] Fallo al enviar a ${telefono}. Status: ${res.statusCode}`);
          console.error('[WA-DEBUG] Respuesta completa de Meta:', JSON.stringify(parsed, null, 2));
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`[WA-NET-ERROR] Error de red enviando a ${telefono}:`, e.message);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Envía la tarjeta de contacto (vCard) de Oscar al teléfono del cliente.
 * Esto añade el número personal de Oscar directamente a la agenda del cliente.
 * El cliente solo tiene que pulsar "Chatear" para abrir una conversación directa.
 */
async function sendContactCard(telefonoCliente) {
  const WA_PHONE_NUMBER_ID = process.env.META_PHONE_ID;
  const META_TOKEN         = process.env.META_TOKEN;

  if (!WA_PHONE_NUMBER_ID || !META_TOKEN) {
    console.warn('[vCard] Omitiendo: faltan credenciales de Meta.');
    return;
  }

  const cleanPhone      = telefonoCliente.replace(/\D/g, '');
  const OSCAR_REAL_PHONE = process.env.OSCAR_REAL_PHONE || '34670409550';

  const postData = JSON.stringify({
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'contacts',
    contacts: [{
      name: {
        formatted_name: 'Oscar - Masajes a Domicilio',
        first_name: 'Oscar',
        last_name: '- Masajes a Domicilio'
      },
      phones: [{
        phone: `+${OSCAR_REAL_PHONE}`,
        type: 'CELL',
        wa_id: OSCAR_REAL_PHONE
      }]
    }]
  });

  const options = {
    hostname: 'graph.facebook.com',
    path: `/v17.0/${WA_PHONE_NUMBER_ID}/messages`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_TOKEN}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const parsed = body ? JSON.parse(body) : {};
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[vCard] Tarjeta de contacto de Oscar enviada a ${telefonoCliente}`);
        } else {
          console.error(`[vCard-ERROR] Fallo enviando vCard a ${telefonoCliente}. Status: ${res.statusCode}`);
          console.error('[vCard-DEBUG]', JSON.stringify(parsed, null, 2));
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.error(`[vCard-NET-ERROR] Error de red enviando vCard:`, e.message);
      resolve(); // Nunca bloqueamos el flujo principal
    });
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const { date, time, service, full_name, phone, address, notes } = payload;

    if (!date || !time || !full_name || !phone || !address) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Faltan datos obligatorios.' }) };
    }

    // Sincronizar con n8n de forma asíncrona (no bloquea el resto)
    sendToN8N(payload).catch(e => console.error('[n8n-FAIL]', e));

    // 1. Lógica de Google Calendar
    const auth = getAuth();
    const calendar = google.calendar({ version: 'v3', auth });
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

    // La forma correcta y oficial de Google Calendar API es pasar la fecha/hora local
    // SIN offset y especificar la zona horaria por separado. La API calcula el offset.
    const [hours, mins] = time.split(':').map(Number);
    const hh = String(hours).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');

    const endTotalMins = hours * 60 + mins + 90;
    const endH = Math.floor(endTotalMins / 60) % 24;
    const endM = endTotalMins % 60;
    const ehh  = String(endH).padStart(2, '0');
    const emm  = String(endM).padStart(2, '0');

    const startLocal = `${date}T${hh}:${mm}:00`;
    const endLocal   = `${date}T${ehh}:${emm}:00`;

    console.log(`[Calendar] Creando evento: ${startLocal} → ${endLocal} (timeZone: Europe/Madrid)`);

    const eventParams = {
      summary: `💆 Masaje ${service} - ${full_name.split(' ')[0]}`,
      location: address,
      description: `Cliente: ${full_name}\nTeléfono: ${phone}\nDolencia: ${notes || 'Ninguna'}\n\nServicio: ${service}`,
      start: { dateTime: startLocal, timeZone: 'Europe/Madrid' },
      end:   { dateTime: endLocal,   timeZone: 'Europe/Madrid' },
      colorId: '5'
    };

    let calendarEvent;
    try {
      calendarEvent = await calendar.events.insert({
        calendarId,
        resource: eventParams,
      });
      console.log('[Calendar] Cita creada con éxito.');
    } catch (gErr) {
      console.error('[Calendar-ERROR]', gErr.message);
    }

    // 2. Notificación vía n8n (Orquestador principal)
    // n8n ahora se encarga de: Enviar WA a Cliente, Enviar WA a Oscar y guardar en Sheets.
    await sendToN8N(payload).catch(e => console.error('[n8n-FAIL]', e));

    /* 
    --- LOGICA LOCAL DESACTIVADA (Delegada a n8n) ---
    const nombrePila  = full_name.split(' ')[0];
    const OSCAR_PHONE = process.env.OSCAR_REAL_PHONE || '34670409550';
    ...
    */

    // Formateamos fecha y hora en español ANTES de pasarlas a WA
    const fechaLegible = formatDateES(date);   // Ej: "Lunes, 15 de Abril"
    const horaLegible  = formatTimeES(time);   // Ej: "18:00h"

    // Número limpio del cliente (sin +, sin espacios) para construir el enlace wa.me
    const cleanClientPhone = phone.replace(/\D/g, '');
    const waMeLink = `https://wa.me/${cleanClientPhone}`;

    // ── Plantilla para el CLIENTE (4 parámetros) ──────────────────────────────
    // {{1}} Nombre | {{2}} Fecha | {{3}} Hora | {{4}} Dirección
    const buildComponentsCliente = (name) => ([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name },         // {{1}} Nombre del cliente
          { type: 'text', text: fechaLegible }, // {{2}} Ej: "Lunes, 15 de Abril"
          { type: 'text', text: horaLegible },  // {{3}} Ej: "18:00h"
          { type: 'text', text: address }       // {{4}} Dirección
        ]
      }
    ]);

    // ── Plantilla para OSCAR (5 parámetros) ───────────────────────────────────
    // {{1}} Nombre | {{2}} Fecha | {{3}} Hora | {{4}} Dirección | {{5}} Enlace wa.me del cliente
    // La plantilla de Oscar debe incluir: "💬 Abrir chat: {{5}}"
    const buildComponentsOscar = (name) => ([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: name },         // {{1}} Nombre completo del cliente
          { type: 'text', text: fechaLegible }, // {{2}} Ej: "Lunes, 15 de Abril"
          { type: 'text', text: horaLegible },  // {{3}} Ej: "18:00h"
          { type: 'text', text: address },      // {{4}} Dirección
          { type: 'text', text: waMeLink }      // {{5}} Link directo: https://wa.me/346XXXXXXXX
        ]
      }
    ]);

    const clientTemplate = process.env.WA_TEMPLATE_NAME       || 'confirmacion_oscar';
    const oscarTemplate  = process.env.WA_OSCAR_TEMPLATE_NAME || clientTemplate; // plantilla de aviso a Oscar

    // FASE A: Enviar los dos templates en paralelo (sin bloquearse entre sí)
    try {
      await Promise.all([
        sendWhatsApp(phone,        clientTemplate, buildComponentsCliente(nombrePila)), // → Cliente
        sendWhatsApp(OSCAR_PHONE,  oscarTemplate,  buildComponentsOscar(full_name))    // → Oscar (con link)
      ]);
    } catch (waFail) {
      // Aunque WhatsApp eche humo, el calendario (que va primero) está a salvo
      console.error('[CRÍTICO] Fallo general disparando WhatsApp, reserva guardada en Calendar:', waFail);
    }

    // FASE B: Enviar vCard de Oscar al cliente (fire-and-forget, no bloquea el return 200)
    // El cliente recibe el contacto personal de Oscar para poder chatear directamente.
    /* 
    sendContactCard(phone).catch(e =>
      console.error('[vCard] Error no-bloqueante al enviar tarjeta de contacto:', e.message)
    );
    */

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Reserva procesada' })
    };

  } catch (error) {
    console.error('[INTERNAL-ERROR]', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
