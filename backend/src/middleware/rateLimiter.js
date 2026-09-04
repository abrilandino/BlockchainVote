/**
 * Rate Limiter — Mitigación de DDoS y fuerza bruta.
 *
 * [Seguridad BE-03] Limita requests por IP y por endpoint.
 * [Seguridad BE-04] Previene saturación del backend.
 *
 * Implementación: En-memory store para PoC.
 * Producción: Redis-backed (ioredis + rate-limiter-flexible).
 */

/**
 * Almacén en memoria de contadores por IP.
 * En producción, reemplazar con Redis:
 *   const RedisStore = require("rate-limiter-flexible").RedisStore;
 */
const requestCounts = new Map();

/**
 * Limpia contadores expirados cada 5 minutos.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts) {
    if (now - data.windowStart > 10 * 60 * 1000) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter configurable por endpoint.
 *
 * @param {object} options
 * @param {number} options.maxRequests  - Máximo de requests por ventana (default: 30)
 * @param {number} options.windowMs     - Ventana de tiempo en ms (default: 60000 = 1 min)
 * @param {string} options.message      - Mensaje de error personalizado
 *
 * @returns {Function} Middleware de Express.
 */
function rateLimiter({
  maxRequests = 30,
  windowMs = 60 * 1000,
  message = "Demasiadas solicitudes. Intenta de nuevo más tarde.",
} = {}) {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const key = `${clientIP}:${req.baseUrl}${req.path}`;

    let record = requestCounts.get(key);

    if (!record || now - record.windowStart > windowMs) {
      record = { count: 1, windowStart: now };
      requestCounts.set(key, record);
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/**
 * Rate limiter estricto para endpoints sensibles (autenticación).
 * Máximo 5 requests por minuto por IP.
 */
const authRateLimiter = rateLimiter({
  maxRequests: 5,
  windowMs: 60 * 1000,
  message:
    "Demasiadas solicitudes de autenticación. Bloqueado por 1 minuto.",
});

/**
 * Rate limiter general para la API.
 * Máximo 100 requests por minuto por IP.
 */
const globalRateLimiter = rateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000,
  message: "Límite de solicitudes alcanzado.",
});

module.exports = { rateLimiter, authRateLimiter, globalRateLimiter };
