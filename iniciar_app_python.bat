@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==============================================
echo  Planificador Service Desk UCEN
echo ==============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo Git no esta disponible. Se iniciara sin sincronizacion automatica.
  goto iniciar_app
)

echo Sincronizando avances desde GitHub...
git pull --ff-only origin main
if errorlevel 1 (
  echo.
  echo No se pudo traer cambios automaticamente.
  echo Revisa si hay cambios pendientes o conflictos antes de continuar.
  pause
)

:iniciar_app
echo.
echo Iniciando app local en http://127.0.0.1:4174
echo Para cerrar el servidor usa Ctrl+C en esta ventana.
echo.
python local_server.py
if errorlevel 1 (
  echo.
  echo No se pudo iniciar con python. Intentando con py -3...
  py -3 local_server.py
)

where git >nul 2>nul
if errorlevel 1 goto fin

echo.
echo Revisando cambios para publicar en GitHub...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Sincronizacion automatica %date% %time%"
  if errorlevel 1 goto fin
  git push origin main
  if errorlevel 1 (
    echo.
    echo No se pudo publicar automaticamente. Revisa la conexion o credenciales de GitHub.
  )
) else (
  echo No hay cambios de codigo para publicar.
)

:fin
pause
