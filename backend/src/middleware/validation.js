/**
 * Middleware de validación de entrada con Zod.
 *
 * [Seguridad BE-01] Previene SQL/NoSQL Injection mediante validación estricta.
 * [Seguridad BE-02] Previene XSS mediante sanitización y límites de longitud.
 *
 * Patrón: Todos los endpoints DEBEN usar estos schemas antes de procesar datos.
 * Nunca confiar en req.body sin validar.
 */

const { z } = require("zod");

/**
 * Schema de validación para registro de ciudadano.
 * [Seguridad BE-01] Límites estrictos en longitud y formato.
 */
const registrarCiudadanoSchema = z.object({
  dni: z
    .string()
    .min(5, "DNI demasiado corto")
    .max(20, "DNI demasiado largo")
    .regex(
      /^[a-zA-Z0-9\-\.]+$/,
      "DNI solo puede contener letras, números, guiones y puntos"
    )
    .trim(),

  nombre: z
    .string()
    .min(2, "Nombre demasiado corto")
    .max(100, "Nombre demasiado largo")
    .regex(
      /^[a-zA-ZáéíóúñÁÉÍÓÚÑüÜ\s\.\-']+$/,
      "Nombre contiene caracteres no válidos"
    )
    .trim(),

  direccion: z
    .string()
    .length(42, "Dirección Ethereum debe tener 42 caracteres (0x + 40 hex)")
    .regex(
      /^0x[0-9a-fA-F]{40}$/,
      "Dirección no es un formato Ethereum válido"
    ),
});

/**
 * Schema de validación para validación de identidad.
 */
const validarIdentidadSchema = z.object({
  dni: z
    .string()
    .min(5, "DNI demasiado corto")
    .max(20, "DNI demasiado largo")
    .regex(
      /^[a-zA-Z0-9\-\.]+$/,
      "DNI solo puede contener letras, números, guiones y puntos"
    )
    .trim(),
});

/**
 * Schema de validación para canje de token.
 */
const canjearTokenSchema = z.object({
  tokenId: z
    .string()
    .uuid("tokenId debe ser un UUID válido"),

  candidatoId: z
    .number()
    .int("candidatoId debe ser un entero")
    .positive("candidatoId debe ser positivo")
    .max(100, "candidatoId no puede exceder 100"),

  walletAddress: z
    .string()
    .length(42, "Dirección Ethereum debe tener 42 caracteres")
    .regex(
      /^0x[0-9a-fA-F]{40}$/,
      "Dirección no es un formato Ethereum válido"
    ),
});

/**
 * Schema de validación para voto del relayer.
 * [Seguridad BE-01] Dirección Ethereum válida + candidato en rango.
 */
const votarRelayerSchema = z.object({
  walletAddress: z
    .string()
    .length(42, "Dirección Ethereum debe tener 42 caracteres")
    .regex(
      /^0x[0-9a-fA-F]{40}$/,
      "Dirección no es un formato Ethereum válido"
    ),

  candidatoId: z
    .number()
    .int("candidatoId debe ser un entero")
    .positive("candidatoId debe ser positivo")
    .max(100, "candidatoId no puede exceder 100"),
});

/**
 * Schema de validación para agregar candidato vía relayer.
 */
const agregarCandidatoRelayerSchema = z.object({
  nombre: z
    .string()
    .min(2, "Nombre demasiado corto")
    .max(100, "Nombre demasiado largo")
    .trim(),
});

/**
 * Middleware factory que valida req.body contra un schema Zod.
 *
 * Uso:
 *   router.post("/registrar", validateBody(registrarCiudadanoSchema), handler);
 *
 * @param {z.ZodSchema} schema - Schema de Zod a validar.
 * @returns {Function} Middleware de Express.
 */
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errores = result.error.errors.map((e) => ({
        campo: e.path.join("."),
        mensaje: e.message,
      }));

      return res.status(400).json({
        error: "Datos de entrada inválidos",
        detalles: errores,
      });
    }

    // Reemplazar req.body con los datos sanitizados por Zod
    req.body = result.data;
    next();
  };
}

module.exports = {
  registrarCiudadanoSchema,
  validarIdentidadSchema,
  canjearTokenSchema,
  votarRelayerSchema,
  agregarCandidatoRelayerSchema,
  validateBody,
};
