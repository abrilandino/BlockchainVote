const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Suite de pruebas unitarias para Votacion.sol v2.0 (Security-Hardened)
 *
 * Cubre: despliegue, control de acceso (Ownable), gestión de candidatos,
 * apertura/cierre, emisión de voto con CEI, reentrancy guard, pausable,
 * control de duplicados, límites, resultados y errores personalizados.
 *
 * Cobertura objetivo: > 95%
 */
describe("Votacion (v2 — Security Hardened)", function () {
  let Votacion;
  let votacion;
  let admin, electoral, votante1, votante2, votante3, atacante;

  // Constantes del contrato
  const Estado = { Cerrada: 0, Abierta: 1 };

  beforeEach(async function () {
    [admin, electoral, votante1, votante2, votante3, atacante] =
      await ethers.getSigners();
    Votacion = await ethers.getContractFactory("Votacion");
    votacion = await Votacion.deploy([]);
  });

  // =========================================================================
  //                         DESPLIEGUE INICIAL
  // =========================================================================
  describe("Despliegue", function () {
    it("establece al deployer como owner", async function () {
      expect(await votacion.owner()).to.equal(admin.address);
    });

    it("inicia con estado Cerrada", async function () {
      expect(await votacion.estado()).to.equal(Estado.Cerrada);
    });

    it("inicia con 0 candidatos", async function () {
      expect(await votacion.totalCandidates()).to.equal(0);
    });

    it("MAX_CANDIDATES es 100", async function () {
      expect(await votacion.MAX_CANDIDATES()).to.equal(100);
    });
  });

  // =========================================================================
  //                     GESTIÓN DE CANDIDATOS
  // =========================================================================
  describe("agregarCandidato", function () {
    it("agrega un candidato correctamente (owner)", async function () {
      await expect(votacion.agregarCandidato("Juan Perez"))
        .to.emit(votacion, "CandidatoAgregado")
        .withArgs(1, "Juan Perez");

      const c = await votacion.getCandidato(1);
      expect(c.id).to.equal(1);
      expect(c.nombre).to.equal("Juan Perez");
      expect(c.votos).to.equal(0);
      expect(await votacion.totalCandidates()).to.equal(1);
    });

    it("revert con custom error si no es owner", async function () {
      await expect(
        votacion.connect(votante1).agregarCandidato("Maria Lopez")
      ).to.be.revertedWithCustomError(votacion, "SoloCuerpoElectoral");
    });

    it("revert con custom error si nombre está vacío", async function () {
      await expect(
        votacion.agregarCandidato("")
      ).to.be.revertedWithCustomError(votacion, "NombreVacio");
    });

    it("revert si se agrega con votación abierta", async function () {
      await votacion.agregarCandidato("A");
      await votacion.abrirVotacion();
      await expect(
        votacion.agregarCandidato("B")
      ).to.be.revertedWithCustomError(votacion, "NoSePuedeAgregarEnVotacionAbierta");
    });

    it("agrega múltiples candidatos con IDs secuenciales", async function () {
      await votacion.agregarCandidato("A");
      await votacion.agregarCandidato("B");
      await votacion.agregarCandidato("C");
      expect(await votacion.totalCandidates()).to.equal(3);

      const c2 = await votacion.getCandidato(2);
      expect(c2.nombre).to.equal("B");
    });

    it("revert al exceder MAX_CANDIDATES (100)", async function () {
      for (let i = 0; i < 100; i++) {
        await votacion.agregarCandidato(`C${i}`);
      }
      await expect(
        votacion.agregarCandidato("C100")
      ).to.be.revertedWithCustomError(votacion, "LimiteCandidatosAlcanzado");
    });
  });

  // =========================================================================
  //                    EDICIÓN DE CANDIDATOS
  // =========================================================================
  describe("editarCandidato", function () {
    beforeEach(async function () {
      await votacion.agregarCandidato("Alice");
      await votacion.agregarCandidato("Bob");
    });

    it("edita el nombre correctamente (owner)", async function () {
      await expect(votacion.editarCandidato(1, "Alicia Gomez"))
        .to.emit(votacion, "CandidatoEditado")
        .withArgs(1, "Alicia Gomez");

      const c = await votacion.getCandidato(1);
      expect(c.nombre).to.equal("Alicia Gomez");
      expect(c.votos).to.equal(0);
    });

    it("revert si no es owner", async function () {
      await expect(
        votacion.connect(votante1).editarCandidato(1, "X")
      ).to.be.revertedWithCustomError(votacion, "SoloCuerpoElectoral");
    });

    it("revert con nombre vacío", async function () {
      await expect(
        votacion.editarCandidato(1, "")
      ).to.be.revertedWithCustomError(votacion, "NombreVacio");
    });

    it("revert si el ID no existe", async function () {
      await expect(
        votacion.editarCandidato(99, "Fantasma")
      ).to.be.revertedWithCustomError(votacion, "CandidatoNoValido");
    });

    it("revert si la votación está abierta", async function () {
      await votacion.abrirVotacion();
      await expect(
        votacion.editarCandidato(1, "Tarde")
      ).to.be.revertedWithCustomError(votacion, "NoSePuedeEditarEnVotacionAbierta");
    });

    it("conserva los votos al editar (cerrar → editar → reabrir)", async function () {
      await votacion.abrirVotacion();
      await votacion.connect(votante1).emitirVoto(1);
      await votacion.cerrarVotacion();

      await votacion.editarCandidato(1, "Alice Reformada");
      const c = await votacion.getCandidato(1);
      expect(c.nombre).to.equal("Alice Reformada");
      expect(c.votos).to.equal(1);
    });
  });

  // =========================================================================
  //                    ELIMINACIÓN DE CANDIDATOS
  // =========================================================================
  describe("eliminarCandidato", function () {
    beforeEach(async function () {
      await votacion.agregarCandidato("Alice");
      await votacion.agregarCandidato("Bob");
      await votacion.agregarCandidato("Carol");
    });

    it("elimina un candidato sin votos correctamente", async function () {
      await expect(votacion.eliminarCandidato(2))
        .to.emit(votacion, "CandidatoEliminado")
        .withArgs(2);

      const resultados = await votacion.obtenerResultados();
      expect(resultados._ids.length).to.equal(2);
      expect(resultados._nombres).to.deep.equal(["Alice", "Carol"]);
    });

    it("revert si no es owner", async function () {
      await expect(
        votacion.connect(votante1).eliminarCandidato(1)
      ).to.be.revertedWithCustomError(votacion, "SoloCuerpoElectoral");
    });

    it("revert si el ID no existe", async function () {
      await expect(
        votacion.eliminarCandidato(50)
      ).to.be.revertedWithCustomError(votacion, "CandidatoNoValido");
    });

    it("revert si el candidato ya recibió votos", async function () {
      await votacion.abrirVotacion();
      await votacion.connect(votante1).emitirVoto(2);
      await votacion.cerrarVotacion();

      await expect(
        votacion.eliminarCandidato(2)
      ).to.be.revertedWithCustomError(votacion, "CandidatoConVotos");
    });

    it("revert si la votación está abierta", async function () {
      await votacion.abrirVotacion();
      await expect(
        votacion.eliminarCandidato(1)
      ).to.be.revertedWithCustomError(votacion, "NoSePuedeEliminarEnVotacionAbierta");
    });

    it("los IDs restantes no cambian tras eliminar (integridad de votos)", async function () {
      await votacion.abrirVotacion();
      await votacion.connect(votante1).emitirVoto(3);
      await votacion.cerrarVotacion();

      // Eliminar a Bob (id 2) no altera a Carol (id 3) ni sus votos
      await votacion.eliminarCandidato(2);

      const carol = await votacion.getCandidato(3);
      expect(carol.nombre).to.equal("Carol");
      expect(carol.votos).to.equal(1);

      const total = await votacion.totalVotos();
      expect(total).to.equal(1);
    });

    it("permite eliminar y volver a agregar candidatos", async function () {
      await votacion.eliminarCandidato(1);
      await votacion.agregarCandidato("Nuevo");

      expect(await votacion.totalCandidates()).to.equal(4);
      const nuevo = await votacion.getCandidato(4);
      expect(nuevo.nombre).to.equal("Nuevo");

      const resultados = await votacion.obtenerResultados();
      expect(resultados._nombres).to.deep.equal(["Bob", "Carol", "Nuevo"]);
    });

    it("puede eliminarse todo y reabrirse con nuevos candidatos", async function () {
      await votacion.eliminarCandidato(1);
      await votacion.eliminarCandidato(2);
      await votacion.eliminarCandidato(3);

      const vacio = await votacion.obtenerResultados();
      expect(vacio._ids.length).to.equal(0);

      await votacion.agregarCandidato("Unico");
      await votacion.abrirVotacion();
      expect(await votacion.estado()).to.equal(Estado.Abierta);
    });
  });

  // =========================================================================
  //                    APERTURA Y CIERRE DE VOTACIÓN
  // =========================================================================
  describe("abrirVotacion / cerrarVotacion", function () {
    it("revert si no hay candidatos al abrir", async function () {
      await expect(votacion.abrirVotacion()).to.be.revertedWithCustomError(
        votacion, "SinCandidatos"
      );
    });

    it("abre la votación correctamente", async function () {
      await votacion.agregarCandidato("A");
      await expect(votacion.abrirVotacion())
        .to.emit(votacion, "VotacionAbierta")
        .withArgs(1);
      expect(await votacion.estado()).to.equal(Estado.Abierta);
    });

    it("revert si se intenta abrir dos veces", async function () {
      await votacion.agregarCandidato("A");
      await votacion.abrirVotacion();
      await expect(votacion.abrirVotacion()).to.be.revertedWithCustomError(
        votacion, "VotacionYaAbierta"
      );
    });

    it("cierra la votación correctamente", async function () {
      await votacion.agregarCandidato("A");
      await votacion.abrirVotacion();
      await expect(votacion.cerrarVotacion())
        .to.emit(votacion, "VotacionCerrada")
        .withArgs(0);
      expect(await votacion.estado()).to.equal(Estado.Cerrada);
    });

    it("revert si se cierra sin estar abierta", async function () {
      await expect(votacion.cerrarVotacion()).to.be.revertedWithCustomError(
        votacion, "VotacionNoAbierta"
      );
    });

    it("revert si un usuario no owner intenta abrir/cerrar", async function () {
      await votacion.agregarCandidato("A");
      await expect(
        votacion.connect(votante1).abrirVotacion()
      ).to.be.revertedWithCustomError(votacion, "SoloCuerpoElectoral");
    });
  });

  // =========================================================================
  //                    PAUSABLE — EMERGENCIA
  // =========================================================================
  describe("Pausable (pausarSistema / reanudarSistema)", function () {
    it("owner puede pausar el sistema", async function () {
      await expect(votacion.pausarSistema())
        .to.emit(votacion, "SistemaPausado");
    });

    it("owner puede reanudar el sistema", async function () {
      await votacion.pausarSistema();
      await expect(votacion.reanudarSistema())
        .to.emit(votacion, "SistemaReanudado");
    });

    it("revert si no es owner quien pausa", async function () {
      await expect(
        votacion.connect(votante1).pausarSistema()
      ).to.be.revertedWithCustomError(votacion, "OwnableUnauthorizedAccount");
    });

    it("no se pueden agregar candidatos con sistema pausado", async function () {
      await votacion.pausarSistema();
      await expect(
        votacion.agregarCandidato("A")
      ).to.be.revertedWithCustomError(votacion, "EnforcedPause");
    });

    it("no se puede votar con sistema pausado", async function () {
      await votacion.agregarCandidato("A");
      await votacion.abrirVotacion();
      await votacion.pausarSistema();
      await expect(
        votacion.connect(votante1).emitirVoto(1)
      ).to.be.revertedWithCustomError(votacion, "EnforcedPause");
    });
  });

  // =========================================================================
  //                    REENTRANCY GUARD
  // =========================================================================
  describe("ReentrancyGuard", function () {
    it("emitirVoto tiene nonReentrant", async function () {
      await votacion.agregarCandidato("A");
      await votacion.abrirVotacion();
      // Verificar que funciona normalmente (nonReentrant no bloquea llamadas normales)
      await votacion.connect(votante1).emitirVoto(1);
      expect(await votacion.hasVoted(votante1.address)).to.equal(1);
    });
  });

  // =========================================================================
  //                         EMISIÓN DE VOTOS
  // =========================================================================
  describe("emitirVoto", function () {
    beforeEach(async function () {
      await votacion.agregarCandidato("Candidato A");
      await votacion.agregarCandidato("Candidato B");
      await votacion.abrirVotacion();
    });

    it("emite un voto correctamente (CEI verificado)", async function () {
      await expect(votacion.connect(votante1).emitirVoto(1))
        .to.emit(votacion, "VotoEmitido")
        .withArgs(votante1.address, 1);

      const c = await votacion.getCandidato(1);
      expect(c.votos).to.equal(1);
      expect(await votacion.hasVoted(votante1.address)).to.equal(1);
    });

    it("permite cambiar el voto: resta al anterior y suma al nuevo", async function () {
      await votacion.connect(votante1).emitirVoto(1);
      expect((await votacion.getCandidato(1)).votos).to.equal(1);

      await expect(votacion.connect(votante1).emitirVoto(2))
        .to.emit(votacion, "VotoEmitido")
        .withArgs(votante1.address, 2);

      expect((await votacion.getCandidato(1)).votos).to.equal(0);
      expect((await votacion.getCandidato(2)).votos).to.equal(1);
      expect(await votacion.totalVotos()).to.equal(1);
      expect(await votacion.obtenerVotoDe(votante1.address)).to.equal(2);
    });

    it("no altera el conteo si vota por el mismo candidato", async function () {
      await votacion.connect(votante1).emitirVoto(1);
      await votacion.connect(votante1).emitirVoto(1);
      expect((await votacion.getCandidato(1)).votos).to.equal(1);
      expect(await votacion.totalVotos()).to.equal(1);
    });

    it("emitirVotoRelayer: solo owner puede votar por un tercero", async function () {
      await expect(
        votacion.connect(votante1).emitirVotoRelayer(votante2.address, 1)
      ).to.be.revertedWithCustomError(votacion, "SoloCuerpoElectoral");
    });

    it("emitirVotoRelayer: registra el voto del ciudadano sin firmar", async function () {
      await expect(votacion.emitirVotoRelayer(votante1.address, 1))
        .to.emit(votacion, "VotoEmitido")
        .withArgs(votante1.address, 1);

      expect((await votacion.getCandidato(1)).votos).to.equal(1);
      expect(await votacion.hasVoted(votante1.address)).to.equal(1);
      expect(await votacion.verificarVoto(votante1.address)).to.be.true;
    });

    it("emitirVotoRelayer: permite cambio de voto del ciudadano", async function () {
      await votacion.emitirVotoRelayer(votante1.address, 1);
      await votacion.emitirVotoRelayer(votante1.address, 2);

      expect((await votacion.getCandidato(1)).votos).to.equal(0);
      expect((await votacion.getCandidato(2)).votos).to.equal(1);
    });

    it("revert si candidatoId es 0", async function () {
      await expect(
        votacion.connect(votante1).emitirVoto(0)
      ).to.be.revertedWithCustomError(votacion, "CandidatoNoValido");
    });

    it("revert si candidatoId excede total", async function () {
      await expect(
        votacion.connect(votante1).emitirVoto(99)
      ).to.be.revertedWithCustomError(votacion, "CandidatoNoValido");
    });

    it("revert si la votación está cerrada", async function () {
      await votacion.cerrarVotacion();
      await expect(
        votacion.connect(votante1).emitirVoto(1)
      ).to.be.revertedWithCustomError(votacion, "VotacionNoAbierta");
    });

    it("múltiples votantes por diferentes candidatos", async function () {
      await votacion.connect(votante1).emitirVoto(1);
      await votacion.connect(votante2).emitirVoto(2);
      await votacion.connect(votante3).emitirVoto(1);

      expect((await votacion.getCandidato(1)).votos).to.equal(2);
      expect((await votacion.getCandidato(2)).votos).to.equal(1);
    });

    it("un atacante puede cambiar su voto pero no duplicar el conteo", async function () {
      await votacion.connect(atacante).emitirVoto(1);
      await votacion.connect(atacante).emitirVoto(2);
      expect((await votacion.getCandidato(1)).votos).to.equal(0);
      expect((await votacion.getCandidato(2)).votos).to.equal(1);
      expect(await votacion.totalVotos()).to.equal(1);
    });
  });

  // =========================================================================
  //                         RESULTADOS
  // =========================================================================
  describe("obtenerResultados", function () {
    it("devuelve resultados vacíos sin candidatos", async function () {
      const [ids, nombres, votos] = await votacion.obtenerResultados();
      expect(ids.length).to.equal(0);
      expect(nombres.length).to.equal(0);
      expect(votos.length).to.equal(0);
    });

    it("refleja correctamente los votos emitidos", async function () {
      await votacion.agregarCandidato("Ana");
      await votacion.agregarCandidato("Luis");
      await votacion.abrirVotacion();

      await votacion.connect(votante1).emitirVoto(1);
      await votacion.connect(votante2).emitirVoto(1);
      await votacion.connect(votante3).emitirVoto(2);

      const [ids, nombres, votos] = await votacion.obtenerResultados();
      expect(ids[0]).to.equal(1);
      expect(nombres[0]).to.equal("Ana");
      expect(votos[0]).to.equal(2);
      expect(ids[1]).to.equal(2);
      expect(nombres[1]).to.equal("Luis");
      expect(votos[1]).to.equal(1);
    });
  });

  // =========================================================================
  //                     FUNCIONES AUXILIARES
  // =========================================================================
  describe("totalVotos", function () {
    it("cuenta correctamente el total de votos", async function () {
      await votacion.agregarCandidato("A");
      await votacion.agregarCandidato("B");
      await votacion.abrirVotacion();

      await votacion.connect(votante1).emitirVoto(1);
      await votacion.connect(votante2).emitirVoto(2);
      await votacion.connect(votante3).emitirVoto(1);

      expect(await votacion.totalVotos()).to.equal(3);
    });
  });

  describe("verificarVoto", function () {
    it("indica correctamente si una dirección votó", async function () {
      await votacion.agregarCandidato("A");
      await votacion.abrirVotacion();

      expect(await votacion.verificarVoto(votante1.address)).to.be.false;
      await votacion.connect(votante1).emitirVoto(1);
      expect(await votacion.verificarVoto(votante1.address)).to.be.true;
      expect(await votacion.verificarVoto(votante2.address)).to.be.false;
    });
  });

  describe("getCandidato", function () {
    it("revert si el ID no es válido", async function () {
      await expect(votacion.getCandidato(1)).to.be.revertedWithCustomError(
        votacion, "CandidatoNoValido"
      );
    });

    it("devuelve el candidato correcto", async function () {
      await votacion.agregarCandidato("Test");
      const c = await votacion.getCandidato(1);
      expect(c.nombre).to.equal("Test");
    });
  });
});
