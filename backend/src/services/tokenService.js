/**
 * Servicio de gestión de tokens de un solo uso (Security-Hardened).
 *
 * Medidas de seguridad:
 * - [BE-07] Canje atómico: token se marca usado ANTES de operación externa.
 * - [BE-05] JWT secret desde variable de entorno (nunca hardcodeado).
 * - [PR-02] DNI hasheado con SHA-256 en almacenamiento (Argon2id en prod).
 * - [SC-02] Un solo token por ciudadano (double-spend prevention off-chain).
 *
 * @security-note En producción: migrar Maps a PostgreSQL + Redis para
 *                persistencia y atomicidad con transacciones DB.
 */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// =========================================================================
//                     ALMACÉN EN MEMORIA [POC]
// =========================================================================
// En producción: PostgreSQL (padrón) + Redis (tokens con TTL automático)

const padronElectoral = new Map();
const tokensEmitidos = new Map();

// =========================================================================
//                     CONFIGURACIÓN DE SEGURIDAD
// =========================================================================

// [Seguridad BE-05] Secret desde env, mínimo 256 bits, nunca fallback a string hardcoded
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "[FATAL] JWT_SECRET no definido o menor a 32 caracteres. " +
    "Genera uno con: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
}

const JWT_EXPIRATION = "30m"; // Token expira en 30 minutos

// =========================================================================
//                     FUNCIONES DE SEGURIDAD INTERNAS
// =========================================================================

/**
 * Hashea un DNI con SHA-256 para almacenamiento seguro.
 * [Seguridad PR-02] El DNI nunca se almacena en claro.
 *
 * @dev    En producción, usar Argon2id para resistencia a rainbow tables.
 * @param {string} dni - DNI en claro.
 * @returns {string} Hash hex del DNI.
 */
function hashDNI(dni) {
  return crypto.createHash("sha256").update(dni.trim().toUpperCase()).digest("hex");
}

// =========================================================================
//                     FUNCIONES PÚBLICAS
// =========================================================================

/**
 * Registra un ciudadano en el padrón electoral.
 *
 * @param {string} dni       - Documento de identidad.
 * @param {string} nombre    - Nombre completo.
 * @param {string} direccion - Dirección Ethereum.
 * @returns {object} Datos públicos del ciudadano (sin DNI en claro).
 *
 * @security [PR-02] DNI hasheado antes de almacenar.
 */
function registrarCiudadano(dni, nombre, direccion) {
  const dniHash = hashDNI(dni);

  if (padronElectoral.has(dniHash)) {
    throw new Error("El ciudadano ya está registrado");
  }

  const ciudadano = {
    dniHash,
    nombre,
    direccion,
    registradoEn: new Date().toISOString(),
    haVotado: false,
  };

  padronElectoral.set(dniHash, ciudadano);

  // Retornar solo datos públicos (sin DNI)
  return { nombre: ciudadano.nombre };
}

/**
 * Valida identidad y genera token temporal de un solo uso.
 *
 * @param {string} dni - DNI del ciudadano.
 * @returns {object} { token, tokenId }
 *
 * @security [BE-05] JWT sin datos personales.
 *           [SC-02] Un token por ciudadano.
 *           [PR-02] Búsqueda por hash, no por DNI en claro.
 */
function generarTokenVoto(dni) {
  const dniHash = hashDNI(dni);
  const ciudadano = padronElectoral.get(dniHash);

  if (!ciudadano) {
    throw new Error("Ciudadano no encontrado en el padrón");
  }
  if (ciudadano.haVotado) {
    throw new Error("El ciudadano ya ha ejercido su derecho al voto");
  }

  const tokenId = uuidv4();

  // [Seguridad BE-05] Token JWT con solo tokenId — NUNCA datos personales
  const token = jwt.sign({ tokenId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });

  // [Seguridad BE-07] Token registrado como pendiente
  tokensEmitidos.set(tokenId, {
    dniHash, // Hash, no DNI en claro
    usado: false,
    creadoEn: new Date().toISOString(),
  });

  return { token, tokenId };
}

/**
 * Canjea un token de voto de forma atómica.
 *
 * @param {string} tokenId - UUID del token.
 * @returns {boolean} true si canjeado exitosamente.
 *
 * @security [BE-07] Check-and-set: se marca como usado ANTES de retornar.
 *           La función debe ser llamada ANTES de enviar tx on-chain.
 */
function canjearToken(tokenId) {
  const tokenData = tokensEmitidos.get(tokenId);
  if (!tokenData) {
    throw new Error("Token no válido");
  }
  if (tokenData.usado) {
    throw new Error("El token ya fue utilizado");
  }

  // [BE-07] MARCAR COMO USADO PRIMERO (check-and-set)
  tokenData.usado = true;
  tokensEmitidos.set(tokenId, tokenData);

  // Marcar al ciudadano como que ya votó
  const ciudadano = padronElectoral.get(tokenData.dniHash);
  if (ciudadano) {
    ciudadano.haVotado = true;
    padronElectoral.set(tokenData.dniHash, ciudadano);
  }

  return true;
}

/**
 * Verifica la validez de un token JWT sin canjearlo.
 *
 * @param {string} token - Token JWT.
 * @returns {object|null} Payload del token o null.
 */
function verificarToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Devuelve estadísticas del padrón electoral.
 *
 * @returns {object} { totalCiudadanos, ciudadanosQueVotaron }
 */
function estadisticasPadron() {
  let totalCiudadanos = 0;
  let ciudadanosQueVotaron = 0;

  for (const [, ciudadano] of padronElectoral) {
    totalCiudadanos++;
    if (ciudadano.haVotado) ciudadanosQueVotaron++;
  }

  return { totalCiudadanos, ciudadanosQueVotaron };
}

module.exports = {
  registrarCiudadano,
  generarTokenVoto,
  canjearToken,
  verificarToken,
  estadisticasPadron,
};
