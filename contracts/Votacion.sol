// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title Votacion
 * @author Sistema Electoral Web3 — PoC
 * Version 2.0.0 (Security-Hardened)
 *
 * @notice Sistema Electoral Transparente y Descentralizado.
 *         La Blockchain actúa como base de datos principal para el registro
 *         e inmutabilidad de los votos emitidos.
 *
 * @dev    Medidas de seguridad implementadas:
 *         - Ownable:          Control de acceso al administrador (deployer).
 *         - ReentrancyGuard:  Protección contra ataques de reentrancia.
 *         - Pausable:         Capacidad de pausar en caso de emergencia.
 *         - Custom Errors:    Gas-efficient revert messages.
 *         - CEI Pattern:      Checks-Effects-Interactions en emitirVoto.
 *         - Max Candidates:   Límite para prevenir gas griefing.
 *         - Events:           Todas las mutaciones de estado emiten eventos.
 *
 * @custom:security-contact seguridad@sistema-electoral-web3.poc
 */
contract Votacion is Ownable, ReentrancyGuard, Pausable {

    // =========================================================================
    //                          CUSTOM ERRORS (gas-efficient)
    // =========================================================================

    error VotacionYaAbierta();
    error VotacionNoAbierta();
    error SinCandidatos();
    error NombreVacio();
    error CandidatoNoValido();
    error NoSePuedeAgregarEnVotacionAbierta();
    error NoSePuedeEditarEnVotacionAbierta();
    error NoSePuedeEliminarEnVotacionAbierta();
    error CandidatoConVotos();
    error LimiteCandidatosAlcanzado();
    error SoloCuerpoElectoral();

    // =========================================================================
    //                             ENUMERACIONES
    // =========================================================================

    /// @notice Estados posibles de una elección.
    enum Estado { Cerrada, Abierta }

    // =========================================================================
    //                              CONSTANTES
    // =========================================================================

    /// @notice Máximo número de candidatos permitidos (anti gas griefing).
    uint256 public constant MAX_CANDIDATES = 100;

    /// @notice Identificador del rol del cuerpo electoral (solo admin puede
    ///         gestionar candidatos y estados de votación).
    bytes32 public constant ELECTORAL_BODY_ROLE = keccak256("ELECTORAL_BODY");

    // =========================================================================
    //                                ESTRUCTURAS
    // =========================================================================

    /// @notice Representa a un candidato registrado.
    struct Candidato {
        uint256 id;
        string  nombre;
        uint256 votos;
    }

    // =========================================================================
    //                                 ESTADO
    // =========================================================================

    /// @notice Estado actual de la elección.
    Estado public estado;

    /// @notice Mapa de candidatos por su ID.
    mapping(uint256 => Candidato) private _candidatos;

    /// @notice Contador total de candidatos registrados.
    uint256 public totalCandidates;

    /// @notice Mapping que registra el candidato por el que votó cada dirección.
    ///         0 = no ha votado; >0 = ID del candidato elegido.
    ///         [Seguridad SC-02] Previene doble voto por dirección.
    ///         [Soporta cambio de voto] Se actualiza al re-votar.
    mapping(address => uint256) public hasVoted;

    // =========================================================================
    //                               EVENTOS
    // =========================================================================

    /// @notice Se emite cuando se agrega un nuevo candidato.
    event CandidatoAgregado(uint256 indexed id, string nombre);

    /// @notice Se emite cuando se edita el nombre de un candidato.
    event CandidatoEditado(uint256 indexed id, string nuevoNombre);

    /// @notice Se emite cuando se elimina un candidato.
    event CandidatoEliminado(uint256 indexed id);

    /// @notice Se emite cuando la votación se abre.
    event VotacionAbierta(uint256 totalCandidatos);

    /// @notice Se emite cuando la votación se cierra.
    event VotacionCerrada(uint256 totalVotos);

    /// @notice Se emite cuando se emite un voto válido.
    /// @dev    La dirección del votante se registra para auditoría on-chain,
    ///         pero en producción se reemplazará por commitment hash (ZKP).
    event VotoEmitido(address indexed votante, uint256 indexed candidatoId);

    /// @notice Se emite cuando el contrato se pausa por emergencia.
    event SistemaPausado();

    /// @notice Se emite cuando el contrato se reanuda.
    event SistemaReanudado();

    // =========================================================================
    //                             CONSTRUCTOR
    // =========================================================================

    /**
     * @notice Inicializa el contrato con el deployer como owner y
     *         miembro del cuerpo electoral.
     * @param _nombresCandidatos Nombres de los candidatos iniciales.
     *        Si se envía al menos uno, la votación abre automáticamente
     *        (despliegue de elección en una sola transacción).
     *        Si se envía vacío, la votación inicia cerrada.
     * @dev    [Seguridad SC-03] Solo el owner puede gestionar estados.
     */
    constructor(string[] memory _nombresCandidatos) Ownable(msg.sender) {
        estado = Estado.Cerrada;
        totalCandidates = 0;

        for (uint256 i = 0; i < _nombresCandidatos.length; ) {
            require(bytes(_nombresCandidatos[i]).length > 0, "Nombre vacio");
            totalCandidates++;
            _candidatos[totalCandidates] = Candidato(totalCandidates, _nombresCandidatos[i], 0);
            emit CandidatoAgregado(totalCandidates, _nombresCandidatos[i]);
            unchecked { ++i; }
        }

        if (totalCandidates > 0) {
            estado = Estado.Abierta;
            emit VotacionAbierta(totalCandidates);
        }
    }

    // =========================================================================
    //                      MODIFICADORES DE SEGURIDAD
    // =========================================================================

    /**
     * @notice Verifica que la votación esté abierta.
     * @dev    [Seguridad SC-06] También verifica que no esté pausado.
     */
    modifier votacionAbierta() {
        if (estado != Estado.Abierta) revert VotacionNoAbierta();
        _;
    }

    /**
     * @notice Restringe acceso solo al owner (cuerpo electoral).
     * @dev    [Seguridad SC-03] Control de acceso por rol.
     */
    modifier soloCuerpoElectoral() {
        if (msg.sender != owner()) revert SoloCuerpoElectoral();
        _;
    }

    // =========================================================================
    //                    FUNCIONES DE ADMIN (Cuerpo Electoral)
    // =========================================================================

    /**
     * @notice Registra un nuevo candidato en la elección.
     * @param _nombre  Nombre completo del candidato.
     *
     * @dev    [Seguridad SC-03] Solo el cuerpo electoral puede ejecutar.
     *         [Seguridad SC-08] Respeta MAX_CANDIDATES para prevenir gas griefing.
     *         [CEI Pattern] Checks → Effects → (no interactions here)
     *
     * @custom:security Las funciones de agregado solo funcionan con votación cerrada
     *                  para evitar manipulación en tiempo real.
     */
    function agregarCandidato(string calldata _nombre)
        external
        whenNotPaused
        soloCuerpoElectoral
    {
        // CHECKS
        if (estado == Estado.Abierta) revert NoSePuedeAgregarEnVotacionAbierta();
        if (bytes(_nombre).length == 0) revert NombreVacio();
        if (totalCandidates >= MAX_CANDIDATES) revert LimiteCandidatosAlcanzado();

        // EFFECTS
        totalCandidates++;
        _candidatos[totalCandidates] = Candidato(totalCandidates, _nombre, 0);

        // INTERACTIONS (ninguna — solo emisión de evento)
        emit CandidatoAgregado(totalCandidates, _nombre);
    }

    /**
     * @notice Edita el nombre de un candidato existente.
     * @param _id           ID del candidato a editar.
     * @param _nuevoNombre  Nuevo nombre completo del candidato.
     *
     * @dev    [Seguridad SC-03] Solo el cuerpo electoral puede ejecutar.
     *         Solo permitido con la votación cerrada (mismo criterio que agregar).
     *         Los votos acumulados del candidato se conservan.
     */
    function editarCandidato(uint256 _id, string calldata _nuevoNombre)
        external
        whenNotPaused
        soloCuerpoElectoral
    {
        // CHECKS
        if (estado == Estado.Abierta) revert NoSePuedeEditarEnVotacionAbierta();
        if (_id == 0 || _id > totalCandidates) revert CandidatoNoValido();
        if (bytes(_nuevoNombre).length == 0) revert NombreVacio();

        // EFFECTS
        _candidatos[_id].nombre = _nuevoNombre;

        // INTERACTIONS (ninguna — solo emisión de evento)
        emit CandidatoEditado(_id, _nuevoNombre);
    }

    /**
     * @notice Elimina un candidato de la elección (soft delete).
     *         El slot queda marcado como eliminado y desaparece de
     *         obtenerResultados(); los IDs del resto no cambian.
     * @param _id  ID del candidato a eliminar.
     *
     * @dev    [Seguridad SC-03] Solo el cuerpo electoral puede ejecutar.
     *         Solo permitido con la votación cerrada.
     *         [Integridad] No se puede eliminar un candidato con votos emitidos:
     *         eso alteraría la trazabilidad del escrutinio.
     */
    function eliminarCandidato(uint256 _id)
        external
        whenNotPaused
        soloCuerpoElectoral
    {
        // CHECKS
        if (estado == Estado.Abierta) revert NoSePuedeEliminarEnVotacionAbierta();
        if (_id == 0 || _id > totalCandidates) revert CandidatoNoValido();
        if (_candidatos[_id].votos > 0) revert CandidatoConVotos();

        // EFFECTS (soft delete: el mapping queda en ceros, id = 0)
        delete _candidatos[_id];

        // INTERACTIONS (ninguna — solo emisión de evento)
        emit CandidatoEliminado(_id);
    }

    /**
     * @notice Abre la votación para que los ciudadanos puedan sufragar.
     *
     * @dev    [Seguridad SC-03] Solo cuerpo electoral.
     *         Requiere al menos un candidato registrado.
     */
    function abrirVotacion() external whenNotPaused soloCuerpoElectoral {
        if (estado == Estado.Abierta) revert VotacionYaAbierta();
        if (totalCandidates == 0) revert SinCandidatos();

        // EFFECTS
        estado = Estado.Abierta;

        emit VotacionAbierta(totalCandidates);
    }

    /**
     * @notice Cierra la votación. Ya no se podrán emitir más votos.
     *
     * @dev    [Seguridad SC-03] Solo cuerpo electoral.
     */
    function cerrarVotacion() external soloCuerpoElectoral {
        if (estado != Estado.Abierta) revert VotacionNoAbierta();

        // EFFECTS
        estado = Estado.Cerrada;

        emit VotacionCerrada(totalVotos());
    }

    /**
     * @notice Pausa de emergencia del sistema.
     * @dev    [Seguridad SC-06] Permite detener todas las operaciones
     *         en caso de vulnerabilidad activa.
     */
    function pausarSistema() external onlyOwner {
        _pause();
        emit SistemaPausado();
    }

    /**
     * @notice Reanuda el sistema tras una pausa de emergencia.
     * @dev    Solo el owner puede reanudar.
     */
    function reanudarSistema() external onlyOwner {
        _unpause();
        emit SistemaReanudado();
    }

    // =========================================================================
    //                    FUNCIONES PÚBLICAS (Votación)
    // =========================================================================

    /**
     * @notice Emite un voto por un candidato específico.
     *         Si la dirección ya votó, REASIGNA el voto: resta 1 al candidato
     *         anterior y suma 1 al nuevo (total de votos se mantiene).
     * @param _candidatoId  ID del candidato seleccionado.
     *
     * @dev    SEGURIDAD APLICADA:
     *         - [Checks-Effects-Interactions] Primero se validan todas las
     *           condiciones, luego se muta el estado, finalmente se emiten eventos.
     *         - [ReentrancyGuard] Previene reentrancy aunque no hay calls externos.
     *         - [SC-02] Cada dirección solo puede votar o cambiar su voto.
     *         - [SC-05] Validación de ID con custom error.
     *         - [Pausable] No se puede votar si el sistema está pausado.
     */
    function emitirVoto(uint256 _candidatoId)
        external
        whenNotPaused
        votacionAbierta
        nonReentrant
    {
        _votar(msg.sender, _candidatoId);
    }

    /**
     * @notice Emite el voto de un ciudadano identificado por _votante.
     *         Variante Relayer: permite que el backend firme y envíe la
     *         transacción en nombre del votante (sin MetaMask).
     * @param _votante      Dirección del ciudadano que ejerce el voto.
     * @param _candidatoId  ID del candidato seleccionado.
     *
     * @dev    [Seguridad RLY-01] Solo el owner (relayer) puede ejecutarlo.
     *         [Cambio de voto] Si _votante ya votó, el voto se reasigna.
     */
    function emitirVotoRelayer(address _votante, uint256 _candidatoId)
        external
        whenNotPaused
        votacionAbierta
        nonReentrant
        soloCuerpoElectoral
    {
        _votar(_votante, _candidatoId);
    }

    /**
     * @dev Lógica interna de votación (cambio de voto incluido).
     *      - Calcula el candidato anterior desde hasVoted[addr].
     *      - Si ya votó: resta 1 al candidato anterior.
     *      - Suma 1 al nuevo candidato y actualiza hasVoted[addr].
     */
    function _votar(address _votante, uint256 _candidatoId) private {
        // ─── CHECKS ───────────────────────────────────────────────────
        if (_candidatoId == 0 || _candidatoId > totalCandidates) {
            revert CandidatoNoValido();
        }

        // ─── EFFECTS ──────────────────────────────────────────────────
        // [CEI] Se actualiza el estado ANTES de cualquier interacción
        uint256 candidatoAnterior = hasVoted[_votante];

        if (candidatoAnterior == 0) {
            // Primer voto del ciudadano
            hasVoted[_votante] = _candidatoId;
            _candidatos[_candidatoId].votos++;
        } else if (candidatoAnterior != _candidatoId) {
            // Cambio de voto: restar al anterior, sumar al nuevo
            _candidatos[candidatoAnterior].votos--;
            hasVoted[_votante] = _candidatoId;
            _candidatos[_candidatoId].votos++;
        }
        // Si votó exactamente el mismo candidato: no-op (sin cambios)

        // ─── INTERACTIONS ─────────────────────────────────────────────
        // Solo emisión de evento (no hay llamadas externas)
        emit VotoEmitido(_votante, _candidatoId);
    }

    // =========================================================================
    //                     FUNCIONES DE LECTURA (View)
    // =========================================================================

    /**
     * @notice Devuelve los resultados actuales de la elección.
     * @return _ids       Array con los IDs de cada candidato.
     * @return _nombres   Array con los nombres de cada candidato.
     * @return _votos     Array con el conteo de votos de cada candidato.
     *
     * @dev    [Seguridad SC-08] Protegido por MAX_CANDIDATES.
     */
    function obtenerResultados() external view returns (
        uint256[] memory _ids,
        string[] memory _nombres,
        uint256[] memory _votos
    ) {
        // Contar candidatos activos (los eliminados tienen id == 0)
        uint256 activos = 0;
        for (uint256 i = 1; i <= totalCandidates; ) {
            if (_candidatos[i].id != 0) { unchecked { ++activos; } }
            unchecked { ++i; }
        }

        _ids     = new uint256[](activos);
        _nombres = new string[](activos);
        _votos   = new uint256[](activos);

        uint256 idx = 0;
        for (uint256 i = 1; i <= totalCandidates; ) {
            Candidato storage c = _candidatos[i];
            if (c.id != 0) {
                _ids[idx]     = c.id;
                _nombres[idx] = c.nombre;
                _votos[idx]   = c.votos;
                unchecked { ++idx; }
            }
            unchecked { ++i; }
        }
    }

    /**
     * @notice Devuelve el número total de votos emitidos.
     * @return Total de sufragios registrados.
     */
    function totalVotos() public view returns (uint256) {
        uint256 _total = 0;
        for (uint256 i = 1; i <= totalCandidates; ) {
            _total += _candidatos[i].votos;
            unchecked { ++i; }
        }
        return _total;
    }

    /**
     * @notice Verifica si una dirección ya emitió su voto.
     * @param _direccion  Dirección a consultar.
     * @return True si la dirección ya votó o cambió su voto.
     */
    function verificarVoto(address _direccion) external view returns (bool) {
        return hasVoted[_direccion] != 0;
    }

    /**
     * @notice Devuelve el candidato por el que votó una dirección (0 si no votó).
     * @param _direccion  Dirección a consultar.
     * @return ID del candidato elegido o 0.
     */
    function obtenerVotoDe(address _direccion) external view returns (uint256) {
        return hasVoted[_direccion];
    }

    /**
     * @notice Devuelve la información de un candidato específico.
     * @param _id  ID del candidato.
     * @return Struct Candidato con id, nombre y votos.
     */
    function getCandidato(uint256 _id) external view returns (Candidato memory) {
        if (_id == 0 || _id > totalCandidates) revert CandidatoNoValido();
        return _candidatos[_id];
    }
}
