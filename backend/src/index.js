/**
 * Servidor Backend — Sistema Electoral Web3 (Security-Hardened)
 *
 * Medidas de seguridad implementadas:
 * - [BE-04] Helmet.js con CSP, HSTS, X-Frame-Options
 * - [BE-03] Rate limiting por IP y endpoint
 * - [BE-08] CORS whitelist (no wildcard)
 * - [BE-06] Error handling genérico (sin leak de stack traces)
 * - [INF-02] HSTS y headers de seguridad
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const relayerRoutes = require("./routes/relayer");
const { securityHeaders, customSecurityHeaders } = require("./middleware/security");
const { globalRateLimiter } = require("./middleware/rateLimiter");

const app = express();
const PORT = process.env.PORT || 4000;

// =========================================================================
//                     SECURITY MIDDLEWARES (orden crítico)
// =========================================================================

// 1. Security headers (Helmet) — DEBE ir antes de rutas
app.use(securityHeaders);
app.use(customSecurityHeaders);

// 2. Rate limiting global — DEBE ir antes de rutas
app.use(globalRateLimiter);

// 3. CORS — [Seguridad BE-08] Whitelist estricta
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origen no permitido por CORS policy"));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400, // Prefetch cache 24h
  })
);

// 4. Body parsing con límites — [Seguridad BE-04] Anti payload oversized
app.use(express.json({ limit: "10kb" }));

// 5. Deshabilitar header X-Powered-By
app.disable("x-powered-by");

// =========================================================================
//                             RUTAS
// =========================================================================

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/relay", relayerRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Configuración pública (dirección del contrato)
app.get("/api/config", (req, res) => {
  let contractAddress = process.env.CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";
  try {
    const fs = require("fs");
    const addrData = JSON.parse(fs.readFileSync(
      require("path").join(__dirname, "contractAddress.json"), "utf8"
    ));
    if (addrData.address) contractAddress = addrData.address;
  } catch {}
  res.json({ contractAddress });
});

// =========================================================================
//              MANEJO CENTRALIZADO DE ERRORES [BE-06]
// =========================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Recurso no encontrado" });
});

// Global error handler — nunca expone stack traces
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.message}`);

  // [Seguridad BE-06] En producción, nunca enviar err.message al cliente
  const isProduction = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    error: isProduction
      ? "Error interno del servidor"
      : err.message,
  });
});

// =========================================================================
//                         INICIAR SERVIDOR
// =========================================================================

app.listen(PORT, () => {
  console.log(`[Backend] Servidor corriendo en puerto ${PORT}`);
  console.log(`[Backend] NODE_ENV: ${process.env.NODE_ENV || "development"}`);
});
