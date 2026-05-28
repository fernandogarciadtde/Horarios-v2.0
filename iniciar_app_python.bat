@echo off
cd /d "%~dp0"
py -3 local_server.py
if errorlevel 1 (
  echo.
  echo No se pudo iniciar con py -3. Intentando con python...
  python local_server.py
)
pause
