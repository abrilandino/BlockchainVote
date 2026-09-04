# ============================================================================
#  ChainBallot — Inicio Rápido (Un solo comando)
# ============================================================================
#  Uso:  .\start.ps1
#
#  Levanta todo: Blockchain + Backend + Frontend en una sola ejecución.
#  Si es la primera vez, instala dependencias y configura .env automáticamente.
# ============================================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║         ChainBallot — Starting...        ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── 1. INSTALAR DEPENDENCIAS (solo la primera vez) ────────────────────────
if (-not (Test-Path "$root\node_modules")) {
    Write-Host "[1/4] Instalando dependencias raiz..." -ForegroundColor Yellow
    Push-Location $root
    npm install --silent 2>$null
    Pop-Location
} else {
    Write-Host "[1/4] Dependencias raiz ya instaladas" -ForegroundColor DarkGray
}

if (-not (Test-Path "$root\backend\node_modules")) {
    Write-Host "[2/4] Instalando dependencias del backend..." -ForegroundColor Yellow
    Push-Location "$root\backend"
    npm install --silent 2>$null
    Pop-Location
} else {
    Write-Host "[2/4] Dependencias del backend ya instaladas" -ForegroundColor DarkGray
}

if (-not (Test-Path "$root\frontend\node_modules")) {
    Write-Host "[3/4] Instalando dependencias del frontend..." -ForegroundColor Yellow
    Push-Location "$root\frontend"
    npm install --silent 2>$null
    Pop-Location
} else {
    Write-Host "[3/4] Dependencias del frontend ya instaladas" -ForegroundColor DarkGray
}

# ─── 2. CONFIGURAR .ENV (solo la primera vez) ──────────────────────────────
$envPath = "$root\backend\.env"
if (-not (Test-Path $envPath)) {
    Write-Host "[4/4] Generando archivo .env..." -ForegroundColor Yellow

    $jwtSecret = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

    @"
PORT=4000
NODE_ENV=development
JWT_SECRET=$jwtSecret
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
CORS_ORIGINS=http://localhost:3000
"@ | Out-File -FilePath $envPath -Encoding utf8

    Write-Host "  .env creado con JWT_SECRET aleatorio" -ForegroundColor Green
} else {
    Write-Host "[4/4] .env ya existe" -ForegroundColor DarkGray
}

# ─── 3. COMPILAR EL CONTRATO ──────────────────────────────────────────────
Write-Host ""
Write-Host "Compilando smart contract..." -ForegroundColor Yellow
Push-Location $root
npx hardhat compile 2>$null
Pop-Location

# ─── 4. LANZAR NODO BLOCKCHAIN ────────────────────────────────────────────
Write-Host ""
Write-Host "Iniciando nodo blockchain local..." -ForegroundColor Yellow
$hardhatJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npx hardhat node 2>&1 | Out-Null
} -ArgumentList $root

Start-Sleep -Seconds 4

# ─── 5. DESPLEGAR CONTRATO ────────────────────────────────────────────────
Write-Host "Desplegando Votacion.sol..." -ForegroundColor Yellow
Push-Location $root
$deployOutput = npx hardhat run scripts/deploy.js --network localhost 2>&1
Pop-Location

# Extraer direccion del contrato
$deployLine = $deployOutput | Select-String "Votacion desplegado en: (.+)"
if ($deployLine) {
    $contractAddr = $deployLine.Matches[0].Groups[1].Value.Trim()
    Write-Host "  Contrato desplegado: $contractAddr" -ForegroundColor Green

    # Actualizar .env con la direccion real
    $envContent = Get-Content $envPath -Raw
    $envContent = $envContent -replace "CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000", "CONTRACT_ADDRESS=$contractAddr"
    $envContent | Out-File -FilePath $envPath -Encoding utf8
} else {
    Write-Host "  Warning: No se pudo extraer la direccion" -ForegroundColor Red
}

# ─── 6. LANZAR BACKEND ────────────────────────────────────────────────────
Write-Host "Iniciando backend..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    node src/index.js 2>&1 | Out-Null
} -ArgumentList "$root\backend"

Start-Sleep -Seconds 2

# ─── 7. LANZAR FRONTEND ──────────────────────────────────────────────────
Write-Host "Iniciando frontend..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npx vite --host 2>&1 | Out-Null
} -ArgumentList "$root\frontend"

Start-Sleep -Seconds 3

# ─── 8. ABRIR NAVEGADOR ──────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║       ChainBallot is running!            ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:   http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:    http://localhost:4000" -ForegroundColor White
Write-Host "  Blockchain: http://127.0.0.1:8545" -ForegroundColor White
Write-Host ""
Write-Host "  Presiona Ctrl+C para detener todo." -ForegroundColor DarkGray
Write-Host ""

Start-Process "http://localhost:3000"

# Mantener vivo hasta Ctrl+C
try {
    while ($true) { Start-Sleep -Seconds 5 }
} finally {
    Write-Host ""
    Write-Host "Deteniendo servicios..." -ForegroundColor Yellow
    Stop-Job $hardhatJob -ErrorAction SilentlyContinue
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $hardhatJob -Force -ErrorAction SilentlyContinue
    Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "ChainBallot detenido." -ForegroundColor DarkGray
}
