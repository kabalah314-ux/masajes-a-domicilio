# 🤖 Guía de Automatización: Webhook Calendly ➔ WhatsApp

Hemos configurado un motor backend en tu propia página web (usando **Netlify Functions**) para que actúe como puente entre Calendly y WhatsApp Cloud API. 

Esto te permite enviar confirmaciones de cita automáticas **100% gratis** sin usar software de terceros pagos como Zapier o Make.

## 🔗 1. Configurar la URL en Calendly
Debes decirle a Calendly a dónde enviar los datos cada vez que alguien hace una reserva. 
Una vez que subas tu web a Netlify, tu URL pública será algo parecido a esto:

**👉 URL del Webhook:** 
`https://TU-DOMINIO.netlify.app/.netlify/functions/whatsapp-sender`

>(Asegúrate de cambiar `TU-DOMINIO.netlify.app` por el dominio real de tu web).

Pega esta URL exacta en el apartado de integraciones/API de Calendly (o usando Postman hacia la API de Calendly para crear la suscripción al webhook).

---

## 🔐 2. Variables de Entorno (.env) en Netlify
Para que este script remoto pueda comunicarse con Calendly y con Facebook (Meta) de manera segura, debes configurar **Variables de Entorno**. 

Ve al panel de control de tu proyecto en **Netlify ➔ Site configuration ➔ Environment variables** y añade las siguientes claves (respeta exactamente el nombre en mayúsculas):

### 🛡️ Clave de Calendly
* **`CALENDLY_SIGNATURE`** (o *`CALENDLY_WEBHOOK_SECRET`*)
  - **Qué es:** La clave secreta que Calendly te da tras crear el webhook.
  - **Para qué sirve:** Evita que hackers envíen datos falsos a tu web haciéndose pasar por Calendly.

### 💬 Claves de WhatsApp Cloud API (Meta)
Para enviar los mensajes de confirmación sin usar tu teléfono personal físico, Meta te provee acceso a su API oficial en *[developers.facebook.com](https://developers.facebook.com)*.

* **`META_TOKEN`**
  - **Qué es:** El token de acceso permanente que te da Meta para enviar mensajes.
  - **Ejemplo:** `EAAOxxxxxxxxxxx...`

* **`META_PHONE_ID`**
  - **Qué es:** El identificador numérico interno del número de teléfono remitente en WhatsApp Business. *(No tu número directamente, sino el ID largo que te sale en la consola de Meta).*
  - **Ejemplo:** `103893325603819`

* **`WA_TEMPLATE_NAME`** *(Opcional)*
  - **Qué es:** El nombre interno de la plantilla preaprobada en Meta.
  - **Ejemplo:** `reserva_confirmada`
  - *(Si no pones nada, el código usará `reserva_confirmada` por defecto).*

---

### ¿Cómo funciona la plantilla?
En tu consola de WhatsApp en Meta, asegúrate de tener una plantilla pre-aprobada llamada `reserva_confirmada` que tenga uno o varios marcadores dinámicos `{{1}}` para inyectar información. 
Por ejemplo:
> *"Hola {{1}}, tu masaje a domicilio está confirmado. Nos vemos el día acordado en {{2}} para tu sesión con Oscar. ¡Relájate que ya queda poco!"*

Nuestro código extrae el nombre e la dirección de los datos que envía Calendly y los rellena en `{{1}}` y `{{2}}`.
