/**
 * Rutas de autenticación y gestión del padrón electoral (Security-Hardened).
 *
 * Medidas de seguridad por endpoint:
 * - [BE-01] Validación Zod en TODOS los campos de entrada.
 * - [BE-03] Rate limiting por IP (5 req/min en endpoints auth).
 * - [BE-07] Token de uso atómico (check-and-set antes de tx on-chain).
 * - [BE-09] Private key solo desde variables de entorno.
 *
 * POST /api/auth/registrar   - Registra ciudadano en padrón.
 * POST /api/auth/validar     - Valida identidad y genera token.
 * POST /api/auth/canjear     - Canjea token y emite voto on-chain.
 */

const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const authMiddleware = require("../middleware/auth");
const { authRateLimiter } = require("../middleware/rateLimiter");
const {
  validateBody,
  registrarCiudadanoSchema,
  validarIdentidadSchema,
  canjearTokenSchema,
} = require("../middleware/validation");
const {
  registrarCiudadano,
  generarTokenVoto,
  canjearToken,
} = require("../services/tokenService");

// =========================================================================
//                     CONFIGURACIÓN BLOCKCHAIN [BE-09]
// =========================================================================

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// Timeout para transacciones on-chain (30 segundos)
const TX_TIMEOUT_MS = 30_000;

const VOTACION_ABI = [
  "function emitirVoto(uint256 candidatoId) external",
  "function hasVotado(address) view returns (bool)",
];

// =========================================================================
//                     POST /api/auth/registrar
// =========================================================================

/**
 * Registra un ciudadano en el padrón electoral.
 *
 * [Seguridad BE-01] Validación Zod: DNI (5-20 chars, alphanumeric + -.)
 *                   Nombre (2-100 chars, solo letras/espacios).
 *                   Dirección (0x + 40 hex chars exactos).
 * [Seguridad BE-02] Sanitización: trim() automático de Zod.
 * [Seguridad BE-03] Rate limit: authRateLimiter (5 req/min).
 */
router.post(
  "/registrar",
  authRateLimiter,
  validateBody(registrarCiudadanoSchema),
  (req, res) => {
    try {
      const { dni, nombre, direccion } = req.body;

      const ciudadano = registrarCiudadano(dni, nombre, direccion);
      res.status(201).json({
        mensaje: "Ciudadano registrado exitosamente",
        ciudadano,
      });
    } catch (err) {
      // [Seguridad BE-06] Error genérico — no exponer causa raíz al cliente
      res.status(400).json({ error: "No se pudo registrar el ciudadano" });
    }
  }
);

// =========================================================================
//                     POST /api/auth/validar
// =========================================================================

/**
 * Valida identidad y genera token temporal de un solo uso.
 *
 * [Seguridad BE-01] Validación Zod: DNI (5-20 chars).
 * [Seguridad BE-03] Rate limit estricto: authRateLimiter (5 req/min).
 * [Seguridad BE-05] Token JWT sin datos personales (solo tokenId).
 */
router.post(
  "/validar",
  authRateLimiter,
  validateBody(validarIdentidadSchema),
  (req, res) => {
    try {
      const { dni } = req.body;
      const resultado = generarTokenVoto(dni);

      res.json({
        mensaje: "Identidad verificada. Token de voto generado.",
        token: resultado.token,
        tokenId: resultado.tokenId,
      });
    } catch (err) {
      // [Seguridad BE-06] Mensaje genérico; no revelar si el DNI existe o no
      res.status(400).json({ error: "No se pudo validar la identidad" });
    }
  }
);

// =========================================================================
//                     POST /api/auth/canjear
// =========================================================================

/**
 * Canjea un token de voto y envía la transacción on-chain.
 *
 * [Seguridad BE-07] Token canjeado atómicamente ANTES de la tx on-chain.
 * [Seguridad SC-01] Relayer envía tx; usuario no firma (gas-free).
 * [Seguridad BE-09] Private key solo desde process.env.
 * [Seguridad BE-01] Validación Zod: UUID + entero positivo + address.
 */
router.post(
  "/canjear",
  authMiddleware,
  validateBody(canjearTokenSchema),
  async (req, res) => {
    try {
      const { tokenId, candidatoId, walletAddress } = req.body;

      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === ethers.ZeroAddress) {
        return res.status(500).json({
          error: "Contrato no desplegado",
        });
      }

      // [Seguridad BE-07] Check-and-set atómico del token
      canjearToken(tokenId);

      // Enviar transacción on-chain con timeout
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const signer = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        VOTACION_ABI,
        signer
      );

      const tx = await contract.emitirVoto(candidatoId);

      // [Seguridad INF-01] Timeout en transacción
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout en transacción")), TX_TIMEOUT_MS)
        ),
      ]);

      res.json({
        mensaje: "Voto emitido exitosamente en la blockchain",
        txHash: receipt.hash,
        bloque: receipt.blockNumber,
      });
    } catch (err) {
      console.error(`[CANJEAR] Error: ${err.message}`);
      res.status(500).json({ error: "Error al procesar el voto" });
    }
  }
);

module.exports = router;
