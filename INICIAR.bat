@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/
  echo Depois feche e abra novamente este arquivo.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)
echo.
echo Jogo: http://localhost:3000
echo Para usar TikTok, configure o arquivo .env
echo.
start "" "http://localhost:3000"
call npm start
pause
