@echo off
echo Iniciando aplicação frontend...
echo A aplicação estará disponível em http://192.168.0.52:
npx next dev -p 80 -H 0.0.0.0
pause
