# Directiva: SEO y Configuración de Seguridad en Netlify

## Objetivo
Establecer las reglas y procesos para mantener el proyecto optimizado para motores de búsqueda (SEO) y protegido mediante cabeceras de seguridad web a nivel de servidor usando Netlify.

## Despliegue y Hosting (Netlify)
El frontend de la aplicación se aloja en Netlify. Cualquier cambio en la rama `main` de GitHub dispara un despliegue automático.

### Cabeceras de Seguridad (Security Headers)
Netlify permite inyectar cabeceras HTTP directamente a través del archivo `netlify.toml`. 
Siempre deben mantenerse las siguientes protecciones activas:

- **X-Frame-Options: DENY**: Evita que la página sea incrustada en un iframe en otro dominio (protección contra clickjacking).
- **X-XSS-Protection: 1; mode=block**: Obliga a los navegadores antiguos a bloquear ataques XSS.
- **X-Content-Type-Options: nosniff**: Previene que el navegador "adivine" el tipo de contenido, forzando a que respete el tipo MIME declarado.
- **Strict-Transport-Security (HSTS)**: Obliga a las conexiones futuras a realizarse únicamente por HTTPS.

## SEO y Google Search Console (GSC)
Para que el negocio sea visible en Google orgánicamente, la estructura base debe seguir estrictamente estas reglas:

### 1. Dominio Único y Canónico
- **Dominio Principal:** `masajesadomicilio.site`
- Todas las páginas HTML (`index.html`, `reservas.html`, landings) DEBEN incluir una etiqueta `<link rel="canonical" href="...">` apuntando exactamente a su URL en el dominio principal para evitar contenido duplicado.

### 2. Sitemap XML
- El archivo `sitemap.xml` debe reflejar la estructura exacta de la web.
- Cada vez que se añade una landing, debe añadirse al `sitemap.xml`.
- **Acción Manual Crítica:** Al cambiar de dominio o estructura, se debe enviar la URL del sitemap en Google Search Console (`https://masajesadomicilio.site/sitemap.xml`) para forzar el rastreo por parte del Googlebot.

### 3. Robots.txt
- El archivo `robots.txt` debe permitir el rastreo a todos los User-agents.
- Debe apuntar al sitemap: `Sitemap: https://masajesadomicilio.site/sitemap.xml`
- Se pueden bloquear directorios internos (como `/js/` o `/css/` de forma genérica) pero se DEBE permitir acceso expresamente a `Googlebot` para que pueda renderizar la página correctamente y entender su contenido semántico.

## Restricciones y Casos Borde
- **Cambio de Dominio:** Si el dominio vuelve a cambiar en el futuro, no basta con editar los archivos HTML. Se requiere un reemplazo global (usar un regex o script) para actualizar los OG-Tags (`og:url`, `og:image`), Schemas JSON-LD y canonicals.
- **Redirecciones:** Si se abandona el dominio antiguo y se controla, es imperativo configurar una redirección 301 del dominio antiguo al nuevo para conservar la "autoridad" SEO. En este proyecto se asume que el dominio `.es` anterior no es controlable o se abandona.
