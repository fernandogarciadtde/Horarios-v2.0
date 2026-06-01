# Contexto para Codex

## Proyecto

Planificador Service Desk UCEN.

Repositorio:

```text
https://github.com/fernandogarciadtde/Horarios-v2.0
```

## Estado actual

La version oficial actual es la version Python local.

Netlify fue descartado y eliminado del proyecto. No retomar el camino de Netlify salvo que Fernando lo pida explicitamente.

## Como ejecutar

En Windows:

```bat
iniciar_app_python.bat
```

O por consola:

```bat
python local_server.py
```

Luego abrir:

```text
http://127.0.0.1:4174
```

El puerto se puede cambiar con la variable `PORT`.

## Archivos principales

- `local_server.py`: servidor Python local y API.
- `index.html`: pantalla principal del planificador.
- `login.html`: pantalla de acceso.
- `app.js`: logica principal del calendario y administracion.
- `login.js`: logica de inicio de sesion.
- `styles.css`: estilos.
- `iniciar_app_python.bat`: acceso rapido para Windows.
- `README.md`: instrucciones generales.
- `INSTALACION_LOCAL_PYTHON.md`: guia local resumida.

## Datos locales

Los datos se guardan en:

```text
local_data/state.json
local_data/users.json
```

`local_data` no se sube a GitHub porque puede contener calendario real, usuarios, fotos y contrasenas.

Si se necesita continuar exactamente con los mismos datos en otro computador, copiar `local_data` aparte por un medio privado.

## Usuarios iniciales

Administrador:

```text
cristopher.calabran@ucentral.cl
Cambiar.2026!
```

Tutor ejemplo:

```text
fernando.garcia@ucentral.cl
Tutor.2026!
```

## Flujo entre casa y oficina

Antes de trabajar en un computador:

```bat
git pull origin main
```

Despues de cambios importantes:

```bat
git add .
git commit -m "descripcion del cambio"
git push origin main
```

No agregar `local_data` al commit.

## Validaciones utiles

Validar Python:

```bat
python -m py_compile local_server.py
```

Validar JavaScript:

```bat
npm.cmd run check
```

La app debe responder en:

```text
http://127.0.0.1:4174
```

## Pendientes conversados

- Evaluar generar un `.exe` o paquete instalable para instalarlo mas facil en el PC de Cristopher.
- Si se genera `.exe`, cuidar que `local_data` quede fuera del ejecutable y editable junto al programa.
- Mantener el proyecto simple y local mientras no exista una decision institucional sobre servidor o red interna.

## Archivos locales no publicados

Estos archivos quedaron fuera del repositorio porque no son necesarios para ejecutar la app y deben revisarse antes de publicarlos:

```text
Informe_Tecnico_Planificador_Service_Desk.docx
generar_informe_tecnico.py
```
