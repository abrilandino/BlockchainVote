# Sistema Electoral Transparente y Descentralizado — PoC Web3

Sistema de votación electrónica donde la **Blockchain actúa como base de datos principal** para el registro e inmutabilidad de los votos. Arquitectura Fullstack con Smart Contracts, Backend API y Frontend Web3.

---

## Arquitectura General

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Portal Votante     │    │   Dashboard Administración      │ │
│  │  - Conectar wallet   │    │  - Agregar candidatos           │ │
│  │  - Ver candidatos    │    │  - Abrir/cerrar votación        │ │
│  │  - Emitir voto       │    │  - Resultados en tiempo real    │ │
│  └─────────┬───────────┘    └──────────────┬──────────────────┘ │
│            │          ethers.js             │                    │
└────────────┼───────────────────────────────┼────────────────────┘
             │                               │
             ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                  BLOCKCHAIN LAYER (Solidity)                    │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Votacion.sol                          │   │
│  │  - agregarCandidato()    [Solo Admin]                    │   │
│  │  - abrirVotacion()       [Solo Admin]                    │   │
│  │  - cerrarVotacion()      [Solo Admin]                    │   │
│  │  - emitirVoto()          [Público, 1 voto/dirección]    │   │
│  │  - obtenerResultados()   [Público]                       │   │
│  │                                                          │   │
│  │  Red: Polygon Amoy / Arbitrum Sepolia / Hardhat Local    │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────────────────┐
│                BACKEND API (Express.js)                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Padrón Electoral │  │  Token Service   │  │   Relayer     │ │
│  │  - Registrar      │  │  - JWT un uso    │  │  - Gas relay   │ │
│  │  - Validar DNI    │  │  - Anonimato     │  │  - Batching    │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Arquitectura de Datos

### Smart Contract (On-Chain)

| Elemento           | Tipo                      | Descripción                                  |
| ------------------ | ------------------------- | -------------------------------------------- |
| `admin`            | `address`                 | Dirección del deployer (administrador)       |
| `estado`           | `enum {Cerrada, Abierta}` | Estado de la elección                        |
| `candidatos`       | `mapping(uint256 => Struct)` | Mapa ID → {id, nombre, votos}            |
| `totalCandidatos`  | `uint256`                 | Contador de candidatos                       |
| `haVotado`         | `mapping(address => bool)` | Control de unicidad por dirección           |

### Backend (Off-Chain)

| Entidad           | Almacén      | Descripción                                           |
| ----------------- | ------------ | ----------------------------------------------------- |
| Padrón Electoral  | En memoria*  | DNI → {nombre, dirección, haVotado}                   |
| Tokens de Voto    | En memoria*  | tokenId → {dni, usado, creadoEn}                      |
| JWT               | Stateless    | Firma HMAC con expiración de 30 minutos               |

> *En producción, migrar a PostgreSQL o MongoDB.

### Flujo de Anonimato

```
Ciudadano                  Backend                   Blockchain
   │                          │                          │
   │  1. Envía DNI            │                          │
   │─────────────────────────>│                          │
   │                          │ 2. Verifica en padrón    │
   │  3. Recibe token (sin    │                          │
   │     datos personales)    │                          │
   │<─────────────────────────│                          │
   │                          │                          │
   │  4. Firma tx con token   │                          │
   │─────────────────────────────────────────────────────>│
   │                          │  5. emitirVoto() on-chain│
   │                          │                          │
   ▲ Identidad física         ▲ Token temporal          ▲ Solo dirección
     NO vinculada                de un solo uso            anónima
```

## Stack Tecnológico

| Capa         | Tecnología                                   |
| ------------ | -------------------------------------------- |
| Frontend     | React 18, Vite, TailwindCSS, ethers.js       |
| Backend      | Node.js, Express, JWT, ethers.js              |
| Smart Contract | Solidity 0.8.24, Hardhat                    |
| Red Objetivo | Polygon Amoy / Arbitrum Sepolia / Local      |

---

## Requisitos Previos

- [Node.js](https://nodejs.org/) v18+
- [MetaMask](https://metamask.io/) (extensión del navegador)
- Git

## Instalación y Configuración

### 1. Clonar e instalar dependencias

```bash
# Dependencias raíz (Hardhat)
npm install

# Backend
cd backend
npm install
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 2. Configurar variables de entorno

```bash
cd backend
cp .env.example .env
# Editar .env con tu clave privada y RPC URL
```

### 3. Compilar el contrato

```bash
npm run compile
```

### 4. Ejecutar pruebas unitarias

```bash
npm run test
```

Salida esperada:
```
Votacion
  Despliegue
    ✓ debe establecer al deployer como administrador
    ✓ debe iniciar con estado Cerrada
    ✓ debe iniciar con 0 candidatos
  agregarCandidato
    ✓ debe agregar un candidato correctamente (solo admin)
    ✓ debe revertir si un usuario no admin intenta agregar candidato
    ✓ debe revertir si el nombre está vacío
    ✓ debe agregar múltiples candidatos con IDs secuenciales
  abrirVotacion / cerrarVotacion
    ✓ debe revertir si no hay candidatos al abrir
    ✓ debe abrir la votación correctamente
    ✓ debe revertir si se intenta abrir dos veces
    ✓ debe cerrar la votación correctamente
    ✓ debe revertir si se intenta cerrar sin estar abierta
    ✓ no se pueden agregar candidatos con votación abierta
  emitirVoto
    ✓ debe emitir un voto correctamente
    ✓ debe revertir si la dirección ya votó
    ✓ debe revertir si el candidato no es válido
    ✓ debe revertir si la votación está cerrada
    ✓ múltiples votantes pueden votar por diferentes candidatos
  obtenerResultados
    ✓ debe devolver resultados vacíos sin candidatos
    ✓ debe reflejar correctamente los votos emitidos
  totalVotos
    ✓ debe contar correctamente el total de votos
  verificarVoto
    ✓ debe indicar correctamente si una dirección votó
```

### 5. Iniciar nodo local de Hardhat

```bash
npm run node
```

### 6. Desplegar el contrato

En otra terminal:
```bash
npm run deploy:local
```

### 7. Iniciar el Backend

```bash
cd backend
npm run dev
```

### 8. Iniciar el Frontend

```bash
cd frontend
npm run dev
```

Abrir http://localhost:3000 en el navegador.

---

## Uso del Sistema

### Flujo del Administrador

1. Conectar wallet de administrador (la que desplegó el contrato).
2. Agregar candidatos (solo con votación cerrada).
3. Abrir la votación cuando todos los candidatos estén registrados.
4. Observar resultados en tiempo real.
5. Cerrar la votación al finalizar el periodo.

### Flujo del Votante

1. Conectar wallet MetaMask.
2. El sistema verifica si la votación está abierta.
3. Seleccionar candidato y confirmar transacción.
4. El voto se registra inmutablemente en la blockchain.
5. El sistema confirma que la dirección no ha votado previamente.

### API REST Endpoints

| Método | Ruta                    | Descripción                          |
| ------ | ----------------------- | ------------------------------------ |
| POST   | `/api/auth/registrar`   | Registrar ciudadano en padrón        |
| POST   | `/api/auth/validar`     | Validar DNI y generar token de voto  |
| POST   | `/api/auth/canjear`     | Canjear token y emitir voto on-chain |
| GET    | `/api/admin/padron`     | Consultar padrón electoral           |
| GET    | `/api/admin/estadisticas`| Estadísticas del padrón             |
| GET    | `/api/health`           | Health check                         |

---

## Garantías de Seguridad

| Requisito               | Implementación                                                    |
| ----------------------- | ----------------------------------------------------------------- |
| Un solo voto por elector| `mapping(address => bool) haVotado` — bloquea reintentos         |
| Control de estados      | Modifier `votacionAbierta` en `emitirVoto()`                     |
| Privacidad / Anonimato  | Token JWT sin datos personales; identidad física ≠ dirección on-chain |
| Inmutabilidad           | Los votos se almacenan en blockchain; nadie puede modificarlos   |
| Gas-free para el usuario| Backend actúa como relayer enviando transacciones en lote        |

---

## Estructura del Proyecto

```
sistema-electoral-web3/
├── contracts/
│   ├── Votacion.sol              # Smart Contract principal
│   └── test/
│       └── Votacion.test.js      # Pruebas unitarias (22 tests)
├── backend/
│   ├── src/
│   │   ├── index.js              # Servidor Express
│   │   ├── routes/
│   │   │   ├── auth.js           # Registro, validación, canje
│   │   │   └── admin.js          # Consulta padrón
│   │   ├── middleware/
│   │   │   └── auth.js           # JWT middleware
│   │   └── services/
│   │       └── tokenService.js   # Lógica de tokens de un solo uso
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Router principal
│   │   ├── main.jsx              # Entry point
│   │   ├── pages/
│   │   │   ├── VoterPortal.jsx   # Portal del votante
│   │   │   └── AdminDashboard.jsx# Dashboard de administración
│   │   ├── components/
│   │   │   ├── ConnectWallet.jsx # Conexión MetaMask
│   │   │   └── CandidateCard.jsx # Tarjeta de candidato
│   │   ├── hooks/
│   │   │   └── useVotacion.js    # Hook de interacción con contrato
│   │   └── abis/
│   │       └── Votacion.json     # ABI del contrato
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── scripts/
│   └── deploy.js                 # Script de despliegue
├── hardhat.config.js
├── package.json
└── README.md                     # Este archivo
```

---

## Licencia

MIT
