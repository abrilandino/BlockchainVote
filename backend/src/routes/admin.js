/**
 * Rutas de administración del sistema electoral (Security-Hardened).
 *
 * GET  /api/admin/padron       - Estadísticas del padrón.
 * GET  /api/admin/estadisticas - Métricas generales.
 *
 * [Seguridad BE-03] Rate limiting en todas las rutas admin.
 * [Seguridad BE-05] Autenticación JWT requerida.
 */

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { rateLimiter } = require("../middleware/rateLimiter");
const { estadisticasPadron } = require("../services/tokenService");

// Rate limiting para admin: 20 req/min por IP
const adminRateLimiter = rateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000,
  message: "Límite de solicitudes admin alcanzado.",
});

/**
 * GET /api/admin/padron
 * Devuelve estadísticas del padrón electoral.
 * [Seguridad BE-05] Requiere JWT válido.
 */
router.get("/padron", authMiddleware, adminRateLimiter, (req, res) => {
  try {
    const stats = estadisticasPadron();
    res.json({
      mensaje: "Padrón electoral consultado",
      estadisticas: stats,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al consultar el padrón" });
  }
});

/**
 * GET /api/admin/estadisticas
 * Devuelve métricas generales del sistema.
 */
router.get("/estadisticas", authMiddleware, adminRateLimiter, (req, res) => {
  try {
    const stats = estadisticasPadron();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

module.exports = router;
