/**
 * Circuito ZKP — Verificación Anónima de Elegibilidad del Elector
 *
 * Archivo: circuits/verificarElegibilidad.circom
 *
 * Propósito:
 * Este circuito demuestra que el votante conoce un DNI que pertenece al
 * padrón electoral SIN revelar cuál es el DNI. Utiliza zk-SNARKs (Groth16)
 * para generar una prueba de conocimiento cero.
 *
 * Flujo:
 * 1. El backend genera un Merkle Tree con hashes de DNIs válidos.
 * 2. El frontend genera una prueba ZKP mostrando que:
 *    a) El votante conoce un DNI que es hoja del Merkle Tree.
 *    b) El DNI no ha sido used (nullifier hash único).
 * 3. El smart contract verifica la prueba sin ver el DNI.
 *
 * Dependencias:
 * - circomlib (MerkleTree, Poseidon hash, comparators)
 * - snarkJS (generación de proving/verification keys)
 *
 * @version 1.0.0
 * @custom:security-note Esqueleto para fase 2 — requiere auditoría antes de producción
 */

pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";
include "circomlib/circuits/bitify.circom";

/**
 * @title MerkleTreeInclusion
 * @notice Verifica que un elemento (hash del DNI) pertenece a un Merkle Tree
 *         de profundidad d, sin revelar la posición exacta.
 *
 * @param depth Profundidad del Merkle Tree (ej: 20 para ~1M de electores).
 *
 * Inputs:
 * - leaf:     Hash del DNI del votante (private).
 * - pathElements[depth]:  Elementos hermanos del camino Merkle (private).
 * - pathIndices[depth]:   Índices izq/der en cada nivel (private).
 *
 * Output:
 * - root:     Hash raíz del Merkle Tree (public) — se compara con el on-chain.
 */
template MerkleTreeInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    signal output root;

    component hashers[depth];
    component mux[depth];

    signal intermediateHashes[depth + 1];
    intermediateHashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // Verificar que pathIndices sea binario (0 o 1)
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Mux: seleccionar orden de hash según dirección
        mux[i] = Mux1();
        mux[i].s <== pathIndices[i];
        mux[i].c[0] <== intermediateHashes[i];      // izquierda
        mux[i].c[1] <== pathElements[i];             // derecha

        // Hash Poseidon de cada nivel (2 inputs → 1 output)
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out;
        hashers[i].inputs[1] <== pathElements[i];

        intermediateHashes[i + 1] <== hashers[i].out;
    }

    root <== intermediateHashes[depth];
}

/**
 * @title NullifierHash
 * @notice Genera un hash único (nullifier) para prevenir doble voto.
 *         Se calcula como Poseidon(nullifierSecret, merkleRoot).
 *
 * @dev    El nullifier se almacena en el smart contract para bloquear
 *         reintentos de voto con el mismo nullifier.
 */
template NullifierHash() {
    signal input nullifierSecret;  // private: secreto del votante
    signal input merkleRoot;       // public: raíz del árbol

    signal output nullifier;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== nullifierSecret;
    hasher.inputs[1] <== merkleRoot;

    nullifier <== hasher.out;
}

/**
 * @title VerificarElegibilidad
 * @notice Circuito principal que combina:
 *         1. Inclusión en Merkle Tree (el DNI está en el padrón).
 *         2. Generación de nullifier (prevenir doble voto).
 *
 * @param depth Profundidad del Merkle Tree (default: 20 → ~1M electores).
 *
 * Inputs Privados (conocidos solo por el votante):
 * - leaf:           Hash del DNI.
 * - nullifierSecret: Secreto aleatorio del votante.
 * - pathElements:   Camino Merkle.
 * - pathIndices:    Direcciones en el árbol.
 *
 * Inputs Públicos:
 * - merkleRoot:     Raíz del árbol (fijada por el backend/admin).
 * - nullifier:      Hash único para bloquear doble voto.
 *
 * Output:
 * - root:           Raíz calculada (debe coincidir con merkleRoot).
 */
template VerificarElegibilidad(depth) {
    // ─── Inputs Privados ─────────────────────────────────────
    signal input leaf;                    // Hash Poseidon(dni)
    signal input nullifierSecret;         // Secreto aleatorio
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // ─── Inputs Públicos ─────────────────────────────────────
    signal input merkleRoot;
    signal input nullifier;

    // ─── Output ──────────────────────────────────────────────
    signal output root;

    // 1. Verificar inclusión en Merkle Tree
    component merkle = MerkleTreeInclusion(depth);
    merkle.leaf <== leaf;
    for (var i = 0; i < depth; i++) {
        merkle.pathElements[i] <== pathElements[i];
        merkle.pathIndices[i] <== pathIndices[i];
    }

    // 2. Verificar que la raíz calculada coincide con la pública
    root <== merkle.root;
    merkleRoot === merkle.root;

    // 3. Generar nullifier único
    component nf = NullifierHash();
    nf.nullifierSecret <== nullifierSecret;
    nf.merkleRoot <== merkleRoot;

    // 4. Verificar que el nullifier calculado coincide
    nullifier === nf.nullifier;
}

// ─── INSTANCIACIÓN PRINCIPAL ─────────────────────────────────────
// Merkle Tree de profundidad 20 soporta hasta 2^20 = 1,048,576 electores.
component main {public [merkleRoot, nullifier]} = VerificarElegibilidad(20);
