# Planificador Service Desk UCEN - Version Python local

Aplicacion local para planificar turnos del equipo Service Desk de la Universidad Central de Chile.

Esta es la version oficial del proyecto. Se ejecuta con Python en el computador donde se va a trabajar y guarda los datos en archivos locales dentro de `local_data`.

## Que permite

- Login separado en `login.html`, con redireccion automatica al calendario.
- Perfil administrador para editar, generar, bloquear, registrar ausencias y resetear contrasenas.
- Perfiles tutor para consultar turnos sin editar configuracion.
- Cambio de contrasena para cada usuario.
- Panel de administracion separado del calendario.
- Persistencia local en `local_data/state.json` y `local_data/users.json`.
- Reglas de turnos, ausencias, feriados, bloqueos recurrentes y validacion visual.
- Exportacion semanal en PDF desde el navegador.
- Estado `salida anticipada sindicato`: toma las dos ultimas horas de una jornada y mantiene el conteo dentro del turno asignado.

## Requisitos

- Windows 10/11.
- Python 3.10 o superior.
- No requiere instalar paquetes con `pip`.
- No requiere Node para ejecutar la app.

El archivo `requirements.txt` queda incluido solo como referencia; no hay dependencias externas.

## Iniciar

Opcion simple:

```bat
iniciar_app_python.bat
```

Opcion por consola:

```bat
python local_server.py
```

Luego abrir:

```text
http://127.0.0.1:4174
```

Si necesitas otro puerto:

```bat
set PORT=4175
python local_server.py
```

## Usuarios iniciales

```text
Administrador:
cristopher.calabran@ucentral.cl
Cambiar.2026!

Tutor ejemplo:
fernando.garcia@ucentral.cl
Tutor.2026!
```

Los usuarios iniciales se crean automaticamente la primera vez que se inicia la app.

## Datos locales

La carpeta `local_data` se crea automaticamente y contiene:

```text
local_data/state.json
local_data/users.json
```

Estos archivos guardan calendario, usuarios, fotos y contrasenas. Para respaldar la app basta copiar la carpeta completa, incluyendo `local_data`.

`local_data` no se sube a GitHub para evitar publicar datos operativos o contrasenas.

## Continuar desde otro computador

En el computador de la oficina:

```bat
git clone https://github.com/fernandogarciadtde/Horarios-v2.0.git
cd Horarios-v2.0
iniciar_app_python.bat
```

Si ya existe la carpeta:

```bat
git pull origin main
iniciar_app_python.bat
```

## Reiniciar datos

Desde la app, el administrador puede usar el boton de restaurar estado. Eso reinicia calendario y configuracion de turnos, pero conserva usuarios guardados.

Para partir completamente desde cero, cerrar el servidor y borrar la carpeta:

```text
local_data
```

Al volver a abrir, se recrean usuarios y estado inicial.

## Nota operativa

Por defecto el servidor queda disponible solo en el equipo local:

```text
127.0.0.1:4174
```

Si la universidad necesita abrirlo en red interna para varios equipos, conviene definir antes una configuracion adicional de red y seguridad.
