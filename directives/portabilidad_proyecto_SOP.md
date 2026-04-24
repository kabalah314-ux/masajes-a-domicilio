# SOP: Portabilidad y Sincronización de Proyecto

## Objetivo
Garantizar que el proyecto pueda ser clonado y ejecutado en cualquier entorno (otra PC, otra cuenta) de forma segura y determinista, manteniendo los secretos fuera del control de versiones.

## Entradas
- Archivo `.env` actual.
- Archivo `google-credentials.json` actual.
- Estructura de dependencias (`requirements.txt`, `package.json`).

## Salidas
- Archivo `.env.example`.
- Archivo `google-credentials.json.example`.
- `README.md` actualizado con instrucciones de setup.
- Repositorio de GitHub actualizado.

## Lógica y Pasos
1. **Protección de Secretos**: Verificar que `.gitignore` incluya `.env`, `google-credentials.json`, `logs/` y carpetas temporales.
2. **Plantillas de Configuración**:
   - Crear `.env.example` extrayendo las claves del `.env` original pero borrando los valores. Asegurarse de incluir `CORS_ORIGINS`, `GOOGLE_PROJECT_ID` y `GOOGLE_CLIENT_ID`.
   - Crear `google-credentials.json.example` con la estructura JSON básica pero valores vacíos.
3. **Documentación de Instalación**:
   - Detallar los pasos de `git clone`.
   - Explicar la instalación de dependencias Python (`pip install -r requirements.txt`) y Node (`npm install`).
   - Indicar cómo configurar los archivos de secretos a partir de las plantillas.
   - **Nota**: Si el frontend se despliega en una nueva URL, esta debe añadirse a `CORS_ORIGINS` en el backend.
4. **Sincronización**:
   - Realizar `git add .`, `git commit` y `git push`.

## Restricciones y Advertencias
- **NUNCA** subir el archivo `.env` o `google-credentials.json` real. Si se suben por error, deben ser eliminados del historial de git inmediatamente usando `git filter-branch` o similar, y las claves deben ser rotadas.
- Asegurarse de que el `README.md` sea lo suficientemente claro para alguien que no conoce el proyecto.
