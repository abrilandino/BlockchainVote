/**
 * Relayer — Transacciones Relámpago sin firma manual.
 *
 * El backend posee la private key de una wallet gas-payer (relayer) y
 * ejecuta TODAS las transacciones on-chain en nombre del usuario:
 *   - Votar / cambiar voto    → emitirVotoRelayer
 *   - Agregar candidato       → agregarCandidato
 *   - Abrir / cerrar votación → abrirVotacion / cerrarVotacion
 *
 * Así NINGUNA acción abre MetaMask ni pide firma manual.
 *
 * Medidas de seguridad:
 * - [BE-03] Rate limiting por IP.
 * - [BE-01] Validación Zod estricta.
 * - [BE-09] Private key solo desde variables de entorno (nunca hardcodeada).
 * - [RLY-01] El contrato restringe emitirVotoRelayer al owner (relayer).
 * - [RLY-02] Las acciones admin solo las acepta el owner del contrato
             (que es quien firma con el relayer).
 */

const express = require("express");
const router = express.Router();
const { ethers } = require("ethers");
const { rateLimiter } = require("../middleware/rateLimiter");
const {
  validateBody,
  votarRelayerSchema,
  agregarCandidatoRelayerSchema,
} = require("../middleware/validation");

// =========================================================================
//                     CONFIGURACIÓN BLOCKCHAIN [BE-09]
// =========================================================================

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const RELAYER_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const VOTACION_ABI = [
  "function emitirVotoRelayer(address _votante, uint256 _candidatoId) external",
  "function estado() view returns (uint8)",
  "function abrirVotacion() external",
  "function cerrarVotacion() external",
  "function agregarCandidato(string _nombre) external",
  "function owner() view returns (address)",
];

function crearRelayer() {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === ethers.ZeroAddress) {
    const err = new Error("Contrato no desplegado");
    err.status = 500;
    throw err;
  }
  if (!RELAYER_PRIVATE_KEY) {
    const err = new Error("Relayer no configurado");
    err.status = 500;
    throw err;
  }
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  return new ethers.Contract(CONTRACT_ADDRESS, VOTACION_ABI, signer);
}

// Rate limiting: 10 req/min por IP
const relayerRateLimiter = rateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000,
  message: "Límite de solicitudes por minuto alcanzado. Intenta de nuevo.",
});

// =========================================================================
//                 POST /api/relay/votar  —  Voto relámpago
// =========================================================================

/**
 * Ejecuta la transacción de voto on-chain en nombre del ciudadano.
 *
 * Body: { walletAddress, candidatoId }
 *   - walletAddress: dirección del votante (quién ejerce el voto).
 *   - candidatoId:   ID del candidato (1..100).
 *
 * Respuesta exitosa: { txHash, bloque }
 */
router.post(
  "/votar",
  relayerRateLimiter,
  validateBody(votarRelayerSchema),
  async (req, res) => {
    try {
      const { walletAddress, candidatoId } = req.body;
      const contract = crearRelayer();

      // Verificar que la votación esté abierta antes de gastar gas
      const estado = await contract.estado();
      if (Number(estado) !== 1) {
        return res.status(400).json({ error: "La votación no está abierta" });
      }

      // [RLY-01] Transacción firmada por el relayer (gas-payer)
      const tx = await contract.emitirVotoRelayer(walletAddress, candidatoId);
      const receipt = await tx.wait();

      res.json({
        mensaje: "Voto registrado en la blockchain",
        txHash: receipt.hash,
        bloque: receipt.blockNumber,
      });
    } catch (err) {
      console.error(`[RELAYER] Error: ${err.message}`);
      res.status(err.status || 500).json({
        error: err.message || "No se pudo registrar el voto",
      });
    }
  }
);

// =========================================================================
//               POST /api/relay/agregar-candidato  —  Admin
// =========================================================================

/**
 * Registra un candidato en nombre del admin (owner).
 * Body: { nombre }
 */
router.post(
  "/agregar-candidato",
  relayerRateLimiter,
  validateBody(agregarCandidatoRelayerSchema),
  async (req, res) => {
    try {
      const { nombre } = req.body;
      const contract = crearRelayer();

      const tx = await contract.agregarCandidato(nombre);
      const receipt = await tx.wait();

      res.json({
        mensaje: "Candidato agregado en la blockchain",
        txHash: receipt.hash,
        bloque: receipt.blockNumber,
      });
    } catch (err) {
      console.error(`[RELAYER] Error: ${err.message}`);
      res.status(err.status || 500).json({
        error: err.message || "No se pudo agregar el candidato",
      });
    }
  }
);

// =========================================================================
//               POST /api/relay/abrir-votacion  —  Admin
// =========================================================================

router.post(
  "/abrir-votacion",
  relayerRateLimiter,
  async (req, res) => {
    try {
      const contract = crearRelayer();
      const tx = await contract.abrirVotacion();
      const receipt = await tx.wait();

      res.json({
        mensaje: "Votación abierta en la blockchain",
        txHash: receipt.hash,
        bloque: receipt.blockNumber,
      });
    } catch (err) {
      console.error(`[RELAYER] Error: ${err.message}`);
      res.status(err.status || 500).json({
        error: err.message || "No se pudo abrir la votación",
      });
    }
  }
);

// =========================================================================
//              POST /api/relay/cerrar-votacion  —  Admin
// =========================================================================

router.post(
  "/cerrar-votacion",
  relayerRateLimiter,
  async (req, res) => {
    try {
      const contract = crearRelayer();
      const tx = await contract.cerrarVotacion();
      const receipt = await tx.wait();

      res.json({
        mensaje: "Votación cerrada en la blockchain",
        txHash: receipt.hash,
        bloque: receipt.blockNumber,
      });
    } catch (err) {
      console.error(`[RELAYER] Error: ${err.message}`);
      res.status(err.status || 500).json({
        error: err.message || "No se pudo cerrar la votación",
      });
    }
  }
);

module.exports = router;