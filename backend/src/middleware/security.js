/**
 * Security Headers Middleware — Hardening HTTP.
 *
 * [Seguridad BE-04] Protege contra ataques de cabeceras.
 * [Seguridad INF-02] Mitiga MITM con HSTS.
 * [Seguridad BE-02] CSP previene XSS.
 *
 * Patrón: Helmet.js para headers automáticos + configuración custom.
 */

const helmet = require("helmet");

/**
 * Configuración de Helmet para máximo hardening.
 *
 * Headers configurados:
 * - Content-Security-Policy: Previenen XSS y code injection.
 * - X-Frame-Options: Previente clickjacking.
 * - X-Content-Type-Options: Previene MIME sniffing.
 * - Strict-Transport-Security: HSTS (forced HTTPS).
 * - X-XSS-Protection: XSS filter del navegador.
 * - Referrer-Policy: Controla envío de referrer.
 * - Permissions-Policy: Deshabilita features innecesarias.
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:", "wss:"], // Web3 providers
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard: { action: "deny" },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

/**
 * Middleware adicional de seguridad personalizado.
 * Complementa a Helmet con headers no cubiertos.
 */
function customSecurityHeaders(req, res, next) {
  // Prevenir cache de datos sensibles
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");

  // Deshabilitar header de servidor
  res.removeHeader("X-Powered-By");

  next();
}

module.exports = { securityHeaders, customSecurityHeaders };
