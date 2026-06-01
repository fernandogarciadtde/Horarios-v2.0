# Instalacion local Python

Esta version permite ejecutar la app en un computador local de la universidad sin Node, servicios externos ni internet.

## Requisitos

- Windows 10/11.
- Python 3.10 o superior instalado.
- La carpeta completa del proyecto.

No requiere instalar paquetes con `pip`: usa solo librerias incluidas en Python.

El archivo `requirements.txt` se incluye como referencia y no instala dependencias externas.

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

## Usuarios iniciales

```text
Administrador:
cristopher.calabran@ucentral.cl
Cambiar.2026!

Tutor ejemplo:
fernando.garcia@ucentral.cl
Tutor.2026!
```

## Datos locales

Al iniciar por primera vez se crea la carpeta:

```text
local_data
```

Dentro quedan:

```text
local_data/state.json
local_data/users.json
```

Estos archivos guardan calendario, usuarios, fotos y contrasenas. Para respaldar la app basta copiar la carpeta completa, incluyendo `local_data`.

`local_data` no se sube a GitHub para evitar publicar datos operativos.

## Reiniciar datos

Desde la app, Cristopher puede usar el boton de restaurar estado. Eso reinicia calendario y configuracion de turnos, pero conserva los usuarios guardados.

Si se quiere partir completamente desde cero, cerrar el servidor y borrar:

```text
local_data
```

Al volver a abrir, se recrean usuarios y estado inicial.

## Nota operativa

El servidor queda disponible solo en el equipo local por defecto:

```text
127.0.0.1:4174
```

Si la universidad necesita abrirlo en red interna para varios equipos, conviene definir una configuracion adicional de red y seguridad antes de usarlo en produccion.
