# Masajes a Domicilio - Plataforma de Reservas

Esta plataforma permite gestionar reservas de masajes a domicilio, integrando notificaciones de WhatsApp, Google Calendar y un chatbot de IA para la atención al cliente.

## 🚀 Portabilidad y Configuración Rápida

Para clonar y ejecutar este proyecto en otra máquina o con otra cuenta, sigue estos pasos:

### 1. Requisitos Previos
- **Python 3.10+**
- **Node.js 18+** (para despliegue en Netlify/backend local)
- Git instalado.

### 2. Clonar el Repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd "web masajes a domicilio"
```

### 3. Configuración de Secretos (IMPORTANTE)
Los archivos de secretos no se suben al repositorio. Debes crearlos a partir de las plantillas:

1. **Variables de Entorno**:
   - Copia `.env.example` a un nuevo archivo `.env`.
   - Rellena los valores con tus credenciales de Meta (WhatsApp), Google Cloud y Gemini.
2. **Credenciales de Google**:
   - Copia `google-credentials.json.example` a `google-credentials.json`.
   - Pega el contenido JSON de tu cuenta de servicio de Google Cloud.

### 4. Instalación de Dependencias

#### Backend (Python/FastAPI)
```bash
pip install -r requirements.txt
```

#### Frontend / Netlify functions
```bash
npm install
```

### 5. Ejecución en Local

#### Servidor Backend
```bash
uvicorn src.main:app --reload
```

#### Frontend
Puedes abrir `index.html` directamente en el navegador o usar un servidor local como `Live Server`.

## 🛠 Estructura del Proyecto
- `src/`: Lógica del backend (API, servicios de WhatsApp, Calendario, IA).
- `directives/`: Documentación de procedimientos operativos estándar (SOPs).
- `js/` y `css/`: Activos del frontend.
- `reservas.html`: Interfaz de usuario para el sistema de reservas.

## 📄 Licencia
Privado - Todos los derechos reservados.
