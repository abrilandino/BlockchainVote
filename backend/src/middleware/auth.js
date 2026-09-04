/**
 * JWT Authentication Middleware (Security-Hardened).
 *
 * [Seguridad BE-05] JWT secret desde variable de entorno.
 * [Seguridad INF-02] Token validado con verificación estricta.
 */

const jwt = require("jsonwebtoken");

// [Seguridad BE-05] Secret desde env, sin fallback a valor hardcodeado
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticación requerido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"], // [Seguridad] Forzar algoritmo específico
    });
    req.user = decoded;
    next();
  } catch (err) {
    // [Seguridad BE-06] No revelar detalles del error JWT
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

module.exports = authMiddleware;
