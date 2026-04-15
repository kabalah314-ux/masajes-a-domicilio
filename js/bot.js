/**
 * bot.js — Asistente de Reservas Conversacional
 * Bot determinista con árbol de decisiones para guiar al usuario
 * a reservar en menos de 3 interacciones sin necesidad de IA externa.
 */

(function () {
  'use strict';

  /* ── Elementos del DOM ── */
  const toggle   = document.getElementById('botToggle');
  const window_  = document.getElementById('botWindow');
  const closeBtn = document.getElementById('botClose');
  const messages = document.getElementById('botMessages');
  const options  = document.getElementById('botOptions');
  const input    = document.getElementById('botInput');
  const sendBtn  = document.getElementById('botSend');

  // Si el bot no está en la página (sin el HTML), salimos sin errores
  if (!toggle || !window_) return;

  /* ── Estado interno del bot ── */
  const state = {
    step: 'welcome',    // paso actual del árbol de decisiones
    tipo: null,         // tipo de masaje elegido
    fecha: null,        // fecha elegida
    hora: null,         // hora elegida
  };

  /* ═══════════════════════════════════════
     ÁRBOL DE DECISIONES DEL BOT
     Cada nodo tiene: message, options (array de {label, value, next}),
     y opcionalmente action (fn a ejecutar al llegar al nodo)
  ═══════════════════════════════════════ */
  const tree = {
    welcome: {
      message: '¡Hola! 👋 Soy Oscar, tu terapeuta personal de masajes a domicilio en Barcelona. En menos de 1 minuto te ayudo a reservar tu sesión. ¿Por dónde empezamos?',
      options: [
        { label: '📅 Ver horarios y Reservar', value: 'ir_calendly',   next: 'ir_calendly' },
        { label: '💰 Ver precios',            value: 'precios',    next: 'mostrar_precios' },
        { label: '📍 ¿Llegáis a mi zona?',   value: 'zona',       next: 'preguntar_zona' },
        { label: '⏰ ¿Con cuánta antelación?', value: 'tiempo',   next: 'info_tiempo' },
      ]
    },
    elegir_tipo: {
      message: 'Perfecto 🌿 ¿Qué tipo de masaje te interesa?',
      options: [
        { label: '💆 Descontracturante (65€)',  value: 'descontracturante', next: 'elegir_cuando' },
        { label: '🪷 Ayurveda (75€)',            value: 'ayurveda',          next: 'elegir_cuando' },
        { label: '🌊 Relajante (55€)',           value: 'relajante',         next: 'elegir_cuando' },
        { label: '👫 En pareja (120€)',          value: 'parejas',            next: 'elegir_cuando' },
      ]
    },
    elegir_cuando: {
      message: '¡Excelente elección! 🎉 ¿Cuándo lo quieres?',
      options: [
        { label: '📅 Hoy mismo',       value: 'hoy',    next: 'elegir_hora' },
        { label: '📅 Mañana',          value: 'manana', next: 'elegir_hora' },
        { label: '📅 Esta semana',     value: 'semana', next: 'elegir_hora' },
        { label: '📅 Fecha concreta',  value: 'otra',   next: 'ir_reservas' },
      ]
    },
    elegir_hora: {
      message: '¿A qué hora prefieres la sesión?',
      options: [
        { label: '🌅 Mañana (9h–13h)',    value: 'manana_hora', next: 'confirmar_bot' },
        { label: '☀️ Mediodía (13h–16h)', value: 'medio',       next: 'confirmar_bot' },
        { label: '🌇 Tarde (16h–19h)',    value: 'tarde',        next: 'confirmar_bot' },
        { label: '🌆 Noche (19h–21h)',    value: 'noche',        next: 'confirmar_bot' },
      ]
    },
    confirmar_bot: {
      message: '¡Perfecto! Ya tengo todo lo que necesito. Me desplazo a tu domicilio, trabajo en tu sofá o cama, y pagas al finalizar en efectivo o Bizum. ¿Reservamos?',
      options: [
        { label: '✅ ¡Sí, reservar ahora!', value: 'ir_reservas', next: 'ir_reservas' },
        { label: '🔄 Cambiar algo',          value: 'cambiar',    next: 'elegir_tipo' },
      ]
    },
    mostrar_precios: {
      message: 'Aquí tienes nuestras tarifas con desplazamiento incluido:\n\n🌊 Relajante → desde **55€** (60 min)\n💆 Descontracturante → desde **65€** (60 min)\n🪷 Ayurveda → desde **75€** (75 min)\n👫 Pareja → desde **120€** (los dos, 60 min)\n\n¿Te gustaría reservar alguno?',
      options: [
        { label: '✨ Sí, quiero reservar', value: 'reservar', next: 'elegir_tipo' },
        { label: '❓ Tengo más preguntas', value: 'mas',      next: 'welcome' },
      ]
    },
    preguntar_zona: {
      message: '📍 Cubro Barcelona ciudad y el área metropolitana: Hospitalet, Badalona, Cornellà, Sant Cugat, Terrassa, Sabadell y más. ¿Estás en alguna de estas zonas?',
      options: [
        { label: '✅ Sí, estoy en esa zona', value: 'si_zona',  next: 'elegir_tipo' },
        { label: '❓ No estoy seguro/a',      value: 'no_zona',  next: 'contacto_zona' },
      ]
    },
    contacto_zona: {
      message: '¡No hay problema! Escríbeme tu dirección por WhatsApp y te confirmo cobertura al momento. ¿Quieres contactarme?',
      options: [
        { label: '💬 Abrir WhatsApp', value: 'whatsapp', next: 'abrir_whatsapp' },
        { label: '🔙 Volver',         value: 'back',     next: 'welcome' },
      ]
    },
    info_tiempo: {
      message: '⚡ Puedes reservar con tan solo **3 horas de antelación** para el mismo día (sujeto a disponibilidad). También puedes programarlo hasta con 30 días de anticipación para elegir tu horario favorito.',
      options: [
        { label: '✅ Perfecto, quiero reservar', value: 'reservar', next: 'elegir_tipo' },
        { label: '🔙 Más preguntas',             value: 'mas',      next: 'welcome' },
      ]
    },
    ir_reservas: {
      message: null, // acción: redirigir
      action: (tipo) => {
        appendBotMessage('🚀 ¡Genial! Te llevo al sistema de reservas. Ya he preseleccionado tu masaje para que solo tengas que confirmar los detalles…', 'bot');
        setTimeout(() => {
          const url = tipo
            ? `reservas.html?tipo=${tipo}`
            : (window.location.pathname.includes('landing') ? '../reservas.html' : 'reservas.html');
          window.location.href = url;
        }, 1800);
      }
    },
    ir_calendly: {
      message: null, // acción directa
      action: () => {
        appendBotMessage('🚀 Te llevo directamente al calendario para que elijas tu horario...', 'bot');
        setTimeout(() => {
          if (window.location.pathname.includes('reservas.html')) {
             const panel2 = document.getElementById('panel-2');
             if(panel2) {
                 // Forzar paso 2
                 document.querySelectorAll('.booking-panel').forEach(p => p.classList.remove('is-active'));
                 panel2.classList.add('is-active');
                 
                 document.querySelectorAll('.booking-step-tab').forEach(t => {
                    t.classList.toggle('is-active', t.dataset.step === '2');
                 });
                 // Hacer scroll
                 const widget = document.getElementById('calendly-widget');
                 if(widget) widget.scrollIntoView({ behavior: 'smooth' });
                 
                 // Cerrar bot
                 const bw = document.getElementById('botWindow');
                 if(bw) bw.classList.remove('is-open');
             }
          } else {
             // Redirigir a reservas.html e indicar ir directo a step 2
             const basePath = window.location.pathname.includes('landing') ? '../' : '';
             window.location.href = basePath + 'reservas.html?step=2';
          }
        }, 1500);
      }
    },
    abrir_whatsapp: {
      action: () => {
        window.open('https://wa.me/34670409550?text=Hola%2C%20quisiera%20saber%20si%20cubr%C3%ADs%20mi%20zona', '_blank');
      }
    }
  };

  /* ═══════════════════════════════════════
     FUNCIONES CORE DEL BOT
  ═══════════════════════════════════════ */

  /**
   * Añade un mensaje al chat
   * @param {string} text - Texto del mensaje (soporta **negrita**)
   * @param {'bot'|'user'} who - Quién habla
   */
  function appendBotMessage(text, who = 'bot') {
    const div = document.createElement('div');
    div.className = `bot-msg bot-msg--${who}`;
    // Soporte simple para **negrita** y saltos de línea
    div.innerHTML = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    messages.appendChild(div);
    // Scroll al último mensaje
    messages.scrollTop = messages.scrollHeight;
  }

  /**
   * Muestra el indicador "escribiendo..." antes del mensaje del bot
   */
  function showTyping(callback, delay = 900) {
    const typing = document.createElement('div');
    typing.className = 'bot-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    typing.id = 'botTyping';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    setTimeout(() => {
      const t = document.getElementById('botTyping');
      if (t) t.remove();
      callback();
    }, delay);
  }

  /**
   * Renderiza las opciones rápidas para el nodo actual
   * @param {Array} opts - Array de {label, value, next}
   */
  function renderOptions(opts) {
    options.innerHTML = '';
    if (!opts || opts.length === 0) return;

    opts.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'bot-option-btn';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => handleOption(opt));
      options.appendChild(btn);
    });
  }

  /**
   * Gestiona la selección de una opción del usuario
   */
  function handleOption(opt) {
    // Mostrar respuesta del usuario
    appendBotMessage(opt.label, 'user');
    options.innerHTML = ''; // Limpiar opciones

    // Guardar en estado si es relevante
    if (state.step === 'elegir_tipo') state.tipo = opt.value;

    // Navegar al siguiente nodo
    goToNode(opt.next, opt.value);
  }

  /**
   * Navega a un nodo del árbol de decisiones
   */
  function goToNode(nodeKey, value) {
    state.step = nodeKey;
    const node = tree[nodeKey];

    if (!node) {
      console.error(`[Bot] Nodo desconocido: ${nodeKey}`);
      return;
    }

    // Si el nodo tiene solo una acción (sin mensaje)
    if (node.action) {
      node.action(state.tipo || value);
      return;
    }

    // Mostrar el mensaje del bot con delay de "escritura"
    showTyping(() => {
      appendBotMessage(node.message, 'bot');
      renderOptions(node.options);
    }, 700 + Math.random() * 300); // delay natural entre 700–1000ms
  }

  /**
   * Procesa texto libre del usuario (respuesta básica + fuzzy matching)
   */
  function processUserText(text) {
    const t = text.toLowerCase().trim();

    appendBotMessage(text, 'user');
    input.value = '';
    options.innerHTML = '';

    // Fuzzy: detectar intenciones básicas en el texto libre
    if (/reserv|masaje|quiero|necesito|cita|hora|book/i.test(t)) {
      goToNode('elegir_tipo');
    } else if (/precio|cuánto|cost|tarifa|dinero|€/i.test(t)) {
      goToNode('mostrar_precios');
    } else if (/zona|barrio|llega|domicilio|donde|lugar/i.test(t)) {
      goToNode('preguntar_zona');
    } else if (/tiempo|rato|cuando|hoy|urgente|mañana|rápid/i.test(t)) {
      goToNode('info_tiempo');
    } else if (/hola|hi|buenas|hey/i.test(t)) {
      goToNode('welcome');
    } else {
      // Respuesta genérica: no entendió
      showTyping(() => {
        appendBotMessage('Entiendo 😊 Puedo ayudarte con reservas, precios o zonas de cobertura. ¿Con qué te ayudo?', 'bot');
        renderOptions(tree.welcome.options);
      }, 600);
    }
  }

  /* ═══════════════════════════════════════
     EVENTOS DE UI
  ═══════════════════════════════════════ */

  // Abrir/cerrar ventana del bot
  toggle.addEventListener('click', () => {
    const isOpen = window_.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);

    // Ocultar badge al abrir
    const badge = toggle.querySelector('.bot-toggle__badge');
    if (badge && isOpen) badge.style.display = 'none';

    // Iniciar conversación la primera vez
    if (isOpen && messages.children.length === 0) {
      showTyping(() => {
        appendBotMessage(tree.welcome.message, 'bot');
        renderOptions(tree.welcome.options);
      }, 600);
    }
  });

  closeBtn.addEventListener('click', () => {
    window_.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  });

  // Enviar mensaje de texto
  sendBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (text) processUserText(text);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = input.value.trim();
      if (text) processUserText(text);
    }
  });

  /* El bot NO se abre automáticamente para no interrumpir la lectura.
     Solo se abre cuando el usuario hace clic en el botón flotante.
     Para contacto directo, el usuario puede usar el botón de WhatsApp verde. */

})();
