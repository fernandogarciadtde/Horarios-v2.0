# Planificador Service Desk UCEN - Versión Netlify

Versión autónoma para desplegar en Netlify con frontend estático, Netlify Functions y Netlify Blobs como almacenamiento compartido.

## Qué permite

- Login de administrador y consulta.
- Login separado en `login.html`, con redirección automática al calendario después de iniciar sesión.
- Cuentas persistentes con perfiles `admin`, `tutor` y `cafe_digital`.
- Cambio de contraseña para cada usuario.
- Reset de contraseña desde el perfil administrador.
- Cristopher edita y todos los usuarios autenticados ven el mismo calendario.
- Persistencia compartida en Netlify Blobs.
- Exportación a Excel `.xls`.
- Reglas de turnos, ausencias, feriados, bloqueos y validación visual.
- Estado `salida anticipada sindicato`: toma las dos últimas horas de cualquier jornada y sigue contando dentro del total del turno/modalidad asignados.

## Importante

Esta versión no usa SQLite ni servidor propio. Está pensada para Netlify.

## Variables de entorno en Netlify

Configurar en:

```text
Site configuration -> Environment variables
```

Variables:

```env
ADMIN_NAME=Nombre Administrador
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=contraseña_segura_definida_en_netlify

DEFAULT_TUTOR_PASSWORD=contraseña_temporal_tutores
TUTOR_MONSERRAT_EMAIL=monserrat@example.com
TUTOR_VIVIANA_EMAIL=viviana@example.com
TUTOR_FERNANDO_EMAIL=fernando@example.com
TUTOR_DENISSE_BRAVO_EMAIL=denisse.bravo@example.com
TUTOR_DENISSE_ROSSEL_EMAIL=denisse.rossel@example.com

CAFE_DIGITAL_NAME=Cafe Digital
CAFE_DIGITAL_EMAIL=cafe@example.com
DEFAULT_CAFE_PASSWORD=contraseña_temporal_cafe

SESSION_DAYS=7
SESSION_SECRET=texto_largo_aleatorio_definido_en_netlify
RECOVERY_TOKEN=token_temporal_para_reinicializar_usuarios
NETLIFY_BLOBS_SITE_ID=project_id_de_netlify
NETLIFY_BLOBS_TOKEN=personal_access_token_de_netlify
COOKIE_SECURE=true
```

## Despliegue conectado a GitHub

1. Subir esta carpeta como repositorio GitHub.
2. En Netlify seleccionar **Add new site -> Import an existing project**.
3. Conectar con GitHub.
4. Build command: dejar vacío o usar:

```bash
npm install
```

5. Publish directory:

```text
.
```

6. Functions directory:

```text
netlify/functions
```

Netlify también lee estas rutas desde `netlify.toml`.

## Despliegue manual

También se puede arrastrar esta carpeta en Netlify, pero para usar funciones y dependencias es más confiable conectar el repositorio GitHub.

## Usuarios

- `admin`: puede editar, generar, bloquear, registrar ausencias y resetear.
- `tutor`: Monserrat Vargas, Viviana Briceño, Fernando García, Denisse Bravo y Denisse Rossel. Pueden ver y exportar, sin editar.
- `cafe_digital`: perfil de visita para ver y exportar, sin editar.

Los usuarios iniciales se crean automáticamente en el primer uso. Cada usuario queda marcado con cambio de contraseña pendiente.

## Recuperar acceso

Si las contraseñas no funcionan porque los usuarios se crearon antes de configurar las variables correctas, define `RECOVERY_TOKEN` en Netlify y visita:

```text
https://TU-SITIO.netlify.app/api/reset-users?token=VALOR_DE_RECOVERY_TOKEN
```

Luego ingresa con `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Después de recuperar el acceso, cambia o elimina `RECOVERY_TOKEN` en Netlify.

## Configurar Netlify Blobs manualmente

Si Netlify muestra `MissingBlobsEnvironmentError`, agrega estas variables:

```text
NETLIFY_BLOBS_SITE_ID
NETLIFY_BLOBS_TOKEN
```

El `NETLIFY_BLOBS_SITE_ID` es el `Project ID` del sitio. Está en:

```text
Project configuration -> General -> Project information -> Project ID
```

El `NETLIFY_BLOBS_TOKEN` es un Personal Access Token de Netlify. Se crea en:

```text
User settings -> Applications -> Personal access tokens -> New access token
```

## Bloqueo de días pasados

Los días vencidos quedan bloqueados automáticamente después de las `23:59`. Si Cristopher recalcula a mitad de semana, el sistema conserva esos bloques y no los mueve.

## Exportación Excel

La exportación replica la estructura mensual/semanal del archivo de referencia:

- Tabla superior de turnos.
- Semana agrupada en columna lateral.
- Encabezados grises.
- Teletrabajo en morado.
- Administrativo en celeste.
- Sábado y feriados en gris.
- Bordes negros.

## Seguridad

- No subir `.env` a GitHub.
- Cambiar `ADMIN_PASSWORD`, `DEFAULT_TUTOR_PASSWORD`, `DEFAULT_CAFE_PASSWORD` y `SESSION_SECRET` antes de usar.
- Usar siempre HTTPS. Netlify lo entrega por defecto.

## Limitación técnica

Netlify Blobs funciona como almacenamiento compartido simple. Para auditoría avanzada, historial de cambios o integración SSO institucional, conviene migrar luego a una base como Supabase/PostgreSQL o a un servidor institucional.
