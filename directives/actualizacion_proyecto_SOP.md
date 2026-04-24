# SOP: Actualización de Proyecto desde GitHub

## Objetivo
Mantener el repositorio local sincronizado con las últimas novedades del repositorio remoto en GitHub.

## Entradas
- URL del repositorio de GitHub.
- Rama (branch) a actualizar (por defecto: `main` o `master`).

## Lógica y Pasos
1. **Verificar Git**: Comprobar si el directorio actual es un repositorio Git (`git status`).
2. **Inicializar Git (si es necesario)**: Si no es un repo, inicializarlo (`git init`).
3. **Configurar Remoto**: Asegurarse de que el `origin` apunta a la URL correcta.
4. **Resguardar Cambios Locales**: Antes de actualizar, hacer un commit de los cambios locales o usar `git stash` para evitar conflictos.
5. **Sincronizar**: Ejecutar `git pull origin [branch]`.
6. **Instalar Dependencias**: Si hay cambios en `requirements.txt` o `package.json`, ejecutar `pip install -r requirements.txt` o `npm install`.

## Trampas Conocidas (Restricciones)
- **Conflictos de Fusión**: Si hay cambios locales no guardados, `git pull` fallará. Siempre hacer commit o stash antes.
- **Repositorio no inicializado**: Si el proyecto se descargó como ZIP, no tendrá la carpeta `.git`. Es necesario inicializar y conectar el remoto manualmente.
- **Variables de Entorno**: Al actualizar, verificar si hay nuevas variables requeridas en `.env`.
