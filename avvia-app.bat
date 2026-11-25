@echo off
setlocal
cd /d "%~dp0"

set "APP_URL=http://localhost:8080/"

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker non e' raggiungibile.
  echo Avvia Docker Desktop, attendi che sia pronto e rilancia questo file.
  pause
  exit /b 1
)

docker compose up -d --build
if errorlevel 1 (
  echo Errore durante l'avvio del container Docker.
  pause
  exit /b 1
)

for /l %%i in (1,1,30) do (
  powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -Uri '%APP_URL%' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; if ($response.StatusCode -eq 200 -and $response.Content -match '<title>Atlante del mondo') { exit 0 } } catch {}; exit 1" >nul 2>&1
  if not errorlevel 1 goto openApp
  timeout /t 1 /nobreak >nul
)

echo Il container e' stato avviato, ma l'app non risponde su %APP_URL%.
echo Controlla i log con: docker compose logs
pause
exit /b 1

:openApp
echo App disponibile su %APP_URL%
start "" "%APP_URL%"
exit /b 0
