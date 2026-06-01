@echo off
cd /d "%~dp0"
python local_server.py
if errorlevel 1 (
  echo.
  echo No se pudo iniciar con python. Intentando con py -3...
  py -3 local_server.py
)
pause
