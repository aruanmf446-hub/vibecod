@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado.
  echo Instale Node.js LTS em https://nodejs.org/
  echo Depois abra novamente INICIAR.bat
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 (
    echo Falha na instalacao. Confira sua conexao com a internet.
    pause
    exit /b 1
  )
)
echo Iniciando jogo em http://localhost:3000
start "TOWER BATTLE - SERVIDOR" cmd /k "npm start"
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"
