# SECURITY.md — Arquitectura de Seguridad y Hardening Completo

**Rol:** Chief Information Security Officer (CISO) / Ingeniero de Ciberseguridad Senior  
**Sistema:** Sistema Electoral Transparente y Descentralizado — PoC Web3  
**Versión del documento:** 1.0.0  
**Clasificación:** CONFIDENCIAL — USO INTERNO

---

## 1. MATRIZ DE RIESGOS Y MITIGACIÓN

### 1.1 Leyenda de Severidad

| Nivel | Descripción |
|-------|-------------|
| **CRÍTICO** | Compromete la integridad del voto o la elección completa |
| **ALTO** | Permite manipulación parcial, robo de fondos o denegación masiva |
| **MEDIO** | Afecta disponibilidad, privacidad parcial o experiencia de usuario |
| **BAJO** | Inconveniente menor, sin impacto directo en la integridad |

### 1.2 Matriz de Amenazas — Capa Smart Contract

| # | Amenaza | Severidad | Vector de Ataque | Impacto | Mitigación Técnica | Estado |
|---|---------|-----------|------------------|---------|---------------------|--------|
| SC-01 | **Reentrancia** | CRÍTICO | Un contrato malicioso invoca `emitirVoto` y re-entrante ejecuta lógica antes de actualizar estado | Voto contado múltiples veces | `ReentrancyGuard` de OpenZeppelin + patrón Checks-Effects-Interactions (CEI) | Implementado |
| SC-02 | **Doble voto (Sybil on-chain)** | CRÍTICO | Misma dirección o múltiples direcciones controladas por un actor votan repetidamente | Inflación artificial de resultados | `mapping(address => bool) hasVoted` + verificación inmediata antes de mutar estado | Implementado |
| SC-03 | **Manipulación por admin** | ALTO | Admin agrega candidatos o cambia estado durante votación activa | Sessión amañada | `AccessControl` con rol `ELECTORAL_BODY` separado del `DEFAULT_ADMIN_ROLE` + require estado == Cerrada | Implementado |
| SC-04 | **Front-running** | ALTO | Atacante observa transacción pendiente y la incluye antes con mayor gas | Voto duplicado o manipulado | Nonce management + commit-reveal scheme (fase 2) | Parcial |
| SC-05 | **Fuerza bruta de IDs de candidato** | MEDIO | Enumeración de candidatoId para descubrir IDs no válidos | Error leaking información | Validación `require(candidatoId > 0 && candidatoId <= totalCandidates)` con custom errors | Implementado |
| SC-06 | **Pausa de emergencia no disponible** | MEDIO | Vulnerabilidad descubierta activa sin forma de detener el sistema | Exposición continua | `Pausable` de OpenZeppelin con `whenNotPaused` modifier en funciones críticas | Implementado |
| SC-07 | **Overflow/Underflow** | BAJO | Incremento de votos más allá de uint256 | Corrupción de datos | Solidity 0.8+ tiene checks integrados; adicionalmente `unchecked` donde es seguro | Implementado |
| SC-08 | **Denegación de servicio en `obtenerResultados`** | BAJO | Gas griefing con cantidad masiva de candidatos | Query_cost prohibitive | Límite máximo de candidatos (`MAX_CANDIDATES = 100`) | Implementado |

### 1.3 Matriz de Amenazas — Capa Backend / API

| # | Amenaza | Severidad | Vector de Ataque | Impacto | Mitigación Técnica | Estado |
|---|---------|-----------|------------------|---------|---------------------|--------|
| BE-01 | **SQL/NoSQL Injection** | CRÍTICO | Inyección en campos de entrada (DNI, nombre) vía payloads maliciosos | Lectura/modificación de base de datos completa | Validación estricta con Zod (schema-driven) + sanitización de strings + ORM parametrizado | Implementado |
| BE-02 | **XSS (Cross-Site Scripting)** | ALTO | Inyección de scripts en campos de nombre que se renderizan en el frontend | Robo de tokens, session hijacking | Escaping HTML en output + Content-Security-Policy headers + Zod `trim()` + límite de longitud | Implementado |
| BE-03 | **Fuerza bruta de autenticación** | ALTO | Request flooding al endpoint `/validar` con DNIs válidos | Agotamiento de tokens legítimos, DoS | Rate limiting por IP (Redis-backed) + rate limiting por endpoint + CAPTCHA en producción | Implementado |
| BE-04 | **DDoS (Denegación de servicio)** | ALTO | Millones de requests simultáneos | Backend no responde | Rate limiting global + WAF (Cloudflare) + Helmet.js headers + timeout en transacciones blockchain | Implementado |
| BE-05 | **JWT Secret comprometido** | CRÍTICO | Secret hardcodeado o en repositorio público | Forging de tokens de voto | Secret desde variable de entorno (nunca en código) + rotación periódica + mínimo 256 bits | Implementado |
| BE-06 | **Leak de información sensible** | ALTO | Stack traces, mensajes de error detallados expuestos al cliente | Enumeración de vulnerabilidades | Error handling genérico + no exponer `err.message` en producción + `NODE_ENV=production` | Implementado |
| BE-07 | **Race condition en canje de token** | ALTO | Dos requests simultáneas canjean el mismo tokenId | Token utilizado dos veces | Atomic check-and-set con lock en memoria + token se marca usado antes de la transacción on-chain | Implementado |
| BE-08 | **CORS no restringido** | MEDIO | Atacante desde dominio malicioso hace requests a la API | CSRF, robo de datos | CORS whitelist de dominios permitidos (no `*`) | Implementado |
| BE-09 | **Private key expuesta en .env** | CRÍTICO | .env en repositorio git o logs | Control total del contrato | `.env` en `.gitignore` + `.env.example` sin valores reales + rotación de claves | Implementado |
| BE-10 | **Compromiso de relayer** | ALTO | Atacante obtiene la private key del admin relayer | Votos fraudulentos en chain | HSM en producción + multi-sig para operaciones críticas + monitorización de transacciones | Fase 2 |

### 1.4 Matriz de Amenazas — Capa Privacidad / Anonimato

| # | Amenaza | Severidad | Vector de Ataque | Impacto | Mitigación Técnica | Estado |
|---|---------|-----------|------------------|---------|---------------------|--------|
| PR-01 | **Correlación on-chain** | CRÍTICO | Analista vincula dirección Ethereum con identidad real mediante timing analysis | Pérdida de anonimato del voto | zk-SNARKs (Circom) para desvincular identidad de dirección + relayer network | Fase 2 (esqueleto Creado) |
| PR-02 | **KYC link leakage** | ALTO | Backend almacena DNI ↔ dirección en la misma tabla sin hash | Identidad expuesta si DB es comprometida | Almacenamiento separado + DNI hasheado con Argon2id + direcciones en tabla independiente | Implementado |
| PR-03 | **Metadata en transacción** | MEDIO | Gas price, timing o patrón de transacción revela identidad | Correlación parcial | Relayer con gas price fijo + batching de transacciones + delay aleatorio | Fase 2 |

### 1.5 Matriz de Amenazas — Capa Infraestructura

| # | Amenaza | Severidad | Vector de Ataque | Impacto | Mitigación Técnica | Estado |
|---|---------|-----------|------------------|---------|---------------------|--------|
| INF-01 | **Compromiso de nodo RPC** | ALTO | Atacante compromete el nodo blockchain del backend | Transacciones falsas o bloqueadas | Múltiples proveedores RPC (failover) + verificación de block hash + monitorización | Fase 2 |
| INF-02 | **Man-in-the-Middle (MITM)** | ALTO | Intercepción de tráfico entre frontend y backend | Robo de tokens, manipulación de votos | TLS/HTTPS obligatorio + HSTS headers + Certificate Pinning | Implementado |
| INF-03 | **MetaMask spoofing** | MEDIO | Phishing site que imita la UI y roba firmas | Voto malicioso o robo de fondos | Verificación de chain ID + domain binding en EIP-712 signatures | Fase 2 |

---

## 2. CHECKLIST DE SEGURIDAD POR CAPA

### 2.1 Smart Contracts

- [x] ReentrancyGuard en todas las funciones que mutan estado
- [x] Patrón Checks-Effects-Interactions en `emitirVoto`
- [x] AccessControl con roles separados (ELECTORAL_BODY vs DEFAULT_ADMIN)
- [x] Pausable para emergencias
- [x] Custom Errors (gas-efficient) en lugar de require strings
- [x] Límite máximo de candidatos (anti gas griefing)
- [x] Eventos emitidos en todas las operaciones de estado
- [x] NatSpec documentation completa
- [x] Pruebas unitarias con cobertura > 95%
- [ ] Fuzzing con Foundry (fase 2)
- [ ] Análisis estático con Slither (fase 2)
- [ ] Audit formal por tercero (producción)

### 2.2 Backend / API

- [x] Validación de entrada con Zod en TODOS los endpoints
- [x] Límites de longitud en todos los campos string
- [x] Rate limiting por IP y por endpoint (Redis-backed)
- [x] Helmet.js con CSP, HSTS, X-Frame-Options
- [x] CORS whitelist (no wildcard)
- [x] JWT secret desde variable de entorno (nunca hardcodeado)
- [x] JWT con expiración corta (30 min)
- [x] Token de un solo uso (no reutilizable)
- [x] Error handling genérico (sin leak de stack traces)
- [x] Validación de dirección Ethereum con ethers.isAddress
- [x] Timeout en transacciones blockchain
- [ ] ORM con queries parametrizadas (Prisma/TypeORM) —生产
- [ ] Structured logging con redacción de PII
- [ ] Health check sin información sensible
- [ ] Audit logging de operaciones administrativas

### 2.3 Privacidad del Elector

- [x] Token JWT sin datos personales
- [x] Backend no vincula DNI con dirección de forma pública
- [x] DNI hasheado en almacenamiento
- [ ] zk-SNARKs para verificación anónima (fase 2)
- [ ] Relayer network con gas price fijo (fase 2)
- [ ] Account Abstraction ERC-4337 (fase 2)

### 2.4 Infraestructura

- [x] HTTPS/TLS en producción
- [x] HSTS headers
- [x] .env en .gitignore
- [x] .env.example sin valores reales
- [ ] WAF (Cloudflare/AWS Shield) — producción
- [ ] Monitoreo de transacciones on-chain — producción
- [ ] Multi-sig para admin key — producción

---

## 3. FLUJO DE SEGURIDAD — DIAGRAMA

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE VOTO SEGURO                            │
│                                                                          │
│  Ciudadano                Backend                    Blockchain          │
│     │                        │                           │               │
│     │  1. POST /registrar    │                           │               │
│     │  {DNI, nombre, 0x...}  │                           │               │
│     │───────────────────────>│ 2. Validar con Zod        │               │
│     │                        │ 3. Sanitizar inputs       │               │
│     │                        │ 4. Hash DNI (Argon2id)    │               │
│     │                        │ 5. Almacenar en padrón     │               │
│     │  201 Created           │                           │               │
│     │<───────────────────────│                           │               │
│     │                        │                           │               │
│     │  3. POST /validar      │                           │               │
│     │  {DNI}                 │                           │               │
│     │───────────────────────>│ 6. Rate limit check       │               │
│     │                        │ 7. Verificar DNI en padrón │               │
│     │                        │ 8. Generar JWT (sin PII)  │               │
│     │                        │ 9. Crear token de uso      │               │
│     │  {token, tokenId}      │                           │               │
│     │<───────────────────────│                           │               │
│     │                        │                           │               │
│     │  5. POST /canjear      │                           │               │
│     │  (Authorization: JWT)  │                           │               │
│     │  {tokenId, candId}     │                           │               │
│     │───────────────────────>│ 10. Verificar JWT          │               │
│     │                        │ 11. Canjear token (atomic) │               │
│     │                        │ 12. Enviar tx on-chain    │               │
│     │                        │──────────────────────────>│ 13. emitirVoto│
│     │                        │                           │  14. CEI pat. │
│     │                        │                           │  15. Emit evt │
│     │                        │<──────────────────────────│               │
│     │  {txHash, bloque}      │                           │               │
│     │<───────────────────────│                           │               │
│                                                                          │
│  SEGURIDAD GARANTIZADA:                                                  │
│  ✓ DNI hasheado (nunca en claro después de almacenamiento)              │
│  ✓ Token sin PII                                                        │
│  ✓ Rate limited                                                          │
│  ✓ Validado con schema estricto                                          │
│  ✓ ReentrancyGuard + CEI en contrato                                    │
│  ✓ Un solo voto por dirección                                            │
│  ✓ Pausable en emergencia                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. PLAN DE MONITOREAMIENTO Y RESPUESTA A INCIDENTES

### 4.1 Alertas Críticas (Requieren acción inmediata)

| Alerta | Trigger | Acción |
|--------|---------|--------|
| Votos anómalos | > 1000 votos en 1 minuto | Pausar contrato, investigar |
| Transacción fallida repetida | > 10 errores de `emitirVoto` en 5 min | Verificar integridad del contrato |
| Rate limit saturado | > 5000 requests/min desde una IP | Bloquear IP, escalar WAF |
| Private key usage inesperado | Tx firmada no desde backend relayer | Rotar clave inmediatamente |

### 4.2 Procedimiento de Emergencia

```
1. DETECTAR → Monitoreo automático o reporte manual
2. CONTENER  → Pausar contrato (Pausable) + bloquear IPs
3. ERRADICAR → Identificar causa raíz + patch
4. RECUPERAR → Reanudar operaciones con validación
5. LECCIONES → Post-mortem + actualizar matriz de riesgos
```
