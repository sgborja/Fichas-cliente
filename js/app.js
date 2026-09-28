/* ============================================================
   Lua Azul — Fichas de clientes
   Lógica de la interfaz (sin framework, DOM + localStorage)
   ============================================================ */

const app = document.getElementById('app');
const navPrincipal = document.getElementById('nav-principal');

const estado = {
  vista: 'clientes',
  clienteId: null,
  busquedaCliente: '',
  sintomasSeleccionados: new Set(),
  filtroOrigenSintomas: 'todos',
  filtroOrigenRecom: 'todos',
  modal: null // { tipo: 'nuevoCliente' | 'nuevaAtencion' | 'editarAtencion', ... }
};

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function iniciales(nombre) {
  return nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');
}

function formatearFecha(fechaISO) {
  if (!fechaISO) return '';
  const [y, m, d] = fechaISO.split('-');
  if (!y) return fechaISO;
  return `${d}/${m}/${y}`;
}

function irAVista(vista) {
  estado.vista = vista;
  if (vista === 'clientes') estado.clienteId = null;
  render();
}

navPrincipal.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-vista]');
  if (!btn) return;
  irAVista(btn.dataset.vista);
});

function actualizarNav() {
  navPrincipal.querySelectorAll('button').forEach(b => {
    b.classList.toggle('activo', b.dataset.vista === estado.vista);
  });
}

/* ============================================================
   RENDER PRINCIPAL
   ============================================================ */
function render() {
  actualizarNav();
  if (estado.vista === 'clientes') {
    app.innerHTML = vistaListaClientes();
  } else if (estado.vista === 'ficha') {
    app.innerHTML = vistaFichaCliente(estado.clienteId);
  } else if (estado.vista === 'recomendador') {
    app.innerHTML = vistaRecomendador();
  }
  renderModal();
  bindEventosGlobales();
}

/* ============================================================
   VISTA: LISTA DE CLIENTES
   ============================================================ */
function vistaListaClientes() {
  const clientes = DB.listarClientes().filter(c =>
    c.nombre.toLowerCase().includes(estado.busquedaCliente.toLowerCase())
  );

  const tarjetas = clientes.map(c => `
    <div class="ficha-cliente-card" data-abrir-cliente="${c.id}">
      <div class="avatar">${iniciales(c.nombre)}</div>
      <div class="nombre">${escapeHTML(c.nombre)}</div>
      ${c.email ? `<div class="dato">✉️ ${escapeHTML(c.email)}</div>` : ''}
      ${c.telefono ? `<div class="dato">📞 ${escapeHTML(c.telefono)}</div>` : ''}
      <div class="contador-atenciones">${c.atenciones.length} atención${c.atenciones.length === 1 ? '' : 'es'}</div>
    </div>
  `).join('');

  return `
    <div class="panel">
      <div class="barra-superior">
        <div class="buscador">
          <input type="text" id="input-buscar-cliente" placeholder="Buscar cliente por nombre..." value="${escapeHTML(estado.busquedaCliente)}">
        </div>
        <button class="btn btn-primario" id="btn-nuevo-cliente">＋ Nueva ficha de cliente</button>
      </div>
      ${clientes.length === 0 ? `
        <div class="estado-vacio">
          <div class="icono-grande">🌙</div>
          <p>${DB.listarClientes().length === 0 ? 'Todavía no hay clientes cargados. ¡Creá la primera ficha!' : 'No se encontraron clientes con ese nombre.'}</p>
        </div>
      ` : `<div class="grid-clientes">${tarjetas}</div>`}
    </div>
  `;
}

/* ============================================================
   VISTA: FICHA DE CLIENTE (detalle)
   ============================================================ */
function vistaFichaCliente(clienteId) {
  const cliente = DB.obtenerCliente(clienteId);
  if (!cliente) {
    return `<div class="panel"><p>No se encontró el cliente.</p><button class="btn btn-secundario" id="btn-volver-clientes">← Volver</button></div>`;
  }

  const edad = calcularEdad(cliente.fechaNacimiento);

  return `
    <div class="panel">
      <button class="btn btn-fantasma btn-chico" id="btn-volver-clientes">← Volver a clientes</button>

      <div class="encabezado-ficha" style="margin-top:16px;">
        <div class="avatar-grande">${iniciales(cliente.nombre)}</div>
        <div style="flex:1; min-width:200px;">
          <h2>${escapeHTML(cliente.nombre)}</h2>
          <div class="datos-contacto">
            ${cliente.email ? `<span>✉️ ${escapeHTML(cliente.email)}</span>` : ''}
            ${cliente.telefono ? `<span>📞 ${escapeHTML(cliente.telefono)}</span>` : ''}
            ${cliente.fechaNacimiento ? `<span>🎂 ${formatearFecha(cliente.fechaNacimiento)}${edad !== null ? ` (${edad} años)` : ''}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secundario btn-chico" id="btn-editar-cliente">✎ Editar datos</button>
          <button class="btn btn-peligro btn-chico" id="btn-eliminar-cliente">🗑 Eliminar</button>
        </div>
      </div>

      ${renderTabDatos(cliente)}

      <h3 style="margin:24px 0 4px; font-size:16px;">📋 Historial de atenciones</h3>
      ${renderTabHistorial(cliente)}
    </div>
  `;
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const nacimiento = new Date(fechaNacimiento);
  if (isNaN(nacimiento)) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

function renderTabDatos(cliente) {
  return `
    <div class="campo">
      <label>Observaciones generales</label>
      <div class="observaciones-box">${cliente.observaciones ? escapeHTML(cliente.observaciones) : 'Sin observaciones registradas.'}</div>
    </div>
  `;
}

function renderTabHistorial(cliente) {
  const atenciones = cliente.atenciones;
  const lista = atenciones.map(a => renderAtencionCard(cliente.id, a)).join('');

  return `
    <div style="display:flex; justify-content:flex-end; margin-bottom:14px;">
      <button class="btn btn-primario" id="btn-nueva-atencion">＋ Registrar nueva atención</button>
    </div>
    ${atenciones.length === 0 ? `
      <div class="estado-vacio">
        <div class="icono-grande">🌸</div>
        <p>Todavía no hay atenciones registradas para este cliente.</p>
      </div>
    ` : lista}
  `;
}

function renderAtencionCard(clienteId, atencion) {
  const chips = (atencion.floresIndicadas || []).map(f => {
    const flor = FLORES_DB.find(x => x.id === f.id) || { nombre: f.nombre || f.id, origen: '' };
    const claseOrigen = flor.origen === 'California' ? 'origen-california' : '';
    return `<span class="chip ${claseOrigen}">🌼 ${escapeHTML(flor.nombre)}</span>`;
  }).join('');

  return `
    <div class="atencion-card">
      <div class="acciones-atencion">
        <button class="btn btn-fantasma btn-chico" data-editar-atencion="${atencion.id}" data-cliente="${clienteId}">✎</button>
        <button class="btn btn-peligro btn-chico" data-eliminar-atencion="${atencion.id}" data-cliente="${clienteId}">🗑</button>
      </div>
      <div class="fila-fecha">
        <div class="fecha-principal">🗓️ ${formatearFecha(atencion.fecha) || 'Sin fecha'}</div>
        ${atencion.fechaProximaVisita ? `<div class="proxima-visita">Próxima visita: ${formatearFecha(atencion.fechaProximaVisita)}</div>` : ''}
      </div>
      ${atencion.notas ? `<div class="notas">${escapeHTML(atencion.notas)}</div>` : ''}
      ${chips ? `<div class="chips">${chips}</div>` : ''}
    </div>
  `;
}

/* ============================================================
   VISTA: RECOMENDADOR DE SÍNTOMAS (independiente)
   ============================================================ */
function vistaRecomendador() {
  return `
    <div class="panel">
      <h2><span class="icono">✨</span>Recomendador de flores por síntomas</h2>
      <p style="color:var(--tinta-suave); font-size:14px; margin-top:-8px;">
        Elegí los síntomas o estados emocionales que identificás y vas a ver las flores recomendadas.
      </p>
      ${renderSelectorSintomas('estado.sintomasSeleccionados', estado.filtroOrigenRecom, 'filtroOrigenRecom')}
    </div>
    <div class="panel">
      <h2 style="font-size:18px;">🌼 Flores recomendadas</h2>
      ${renderResultadosRecomendacion(Array.from(estado.sintomasSeleccionados))}
    </div>
  `;
}

function renderSelectorSintomas(origenFiltroField, origenActivo, origenStateKey) {
  const grupos = obtenerSintomasAgrupados();
  const gruposHTML = grupos.map(g => `
    <div class="grupo-sintomas">
      <h4>${escapeHTML(g.categoria)}</h4>
      <div class="lista-sintomas">
        ${g.sintomas.map(s => `
          <button type="button" class="sintoma-toggle ${estado.sintomasSeleccionados.has(s) ? 'seleccionado' : ''}" data-sintoma="${escapeHTML(s)}">${escapeHTML(s)}</button>
        `).join('')}
      </div>
    </div>
  `).join('');

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <span style="font-size:13px; color:var(--tinta-suave);">${estado.sintomasSeleccionados.size} síntoma(s) seleccionados</span>
      ${estado.sintomasSeleccionados.size > 0 ? `<button class="btn btn-fantasma btn-chico" id="btn-limpiar-sintomas">Limpiar selección</button>` : ''}
    </div>
    ${gruposHTML}
  `;
}

function renderResultadosRecomendacion(sintomasArray) {
  if (sintomasArray.length === 0) {
    return `<div class="estado-vacio"><div class="icono-grande">🌙</div><p>Seleccioná uno o más síntomas arriba para ver las flores recomendadas.</p></div>`;
  }
  const resultados = recomendarFlores(sintomasArray);
  if (resultados.length === 0) {
    return `<p style="color:var(--tinta-suave);">No se encontraron flores para esa combinación.</p>`;
  }
  return resultados.map(r => `
    <div class="resultado-flor">
      <div class="info">
        <h4>${escapeHTML(r.flor.nombre)} <span style="font-size:11px; color:var(--tinta-suave); font-weight:500;">· ${r.flor.origen} · ${escapeHTML(r.flor.categoria)}</span></h4>
        <p>${escapeHTML(r.flor.descripcion)}</p>
      </div>
      <span class="match">${r.coincidencias} coincidencia${r.coincidencias === 1 ? '' : 's'}</span>
    </div>
  `).join('');
}

/* ============================================================
   MODALES
   ============================================================ */
function renderModal() {
  const existente = document.querySelector('.overlay');
  if (existente) existente.remove();
  if (!estado.modal) return;

  const div = document.createElement('div');
  div.className = 'overlay';
  div.id = 'overlay-modal';

  if (estado.modal.tipo === 'nuevoCliente' || estado.modal.tipo === 'editarCliente') {
    div.innerHTML = modalCliente();
  } else if (estado.modal.tipo === 'nuevaAtencion' || estado.modal.tipo === 'editarAtencion') {
    div.innerHTML = modalAtencion();
  }

  document.body.appendChild(div);
  bindEventosModal();
}

function modalCliente() {
  const editando = estado.modal.tipo === 'editarCliente';
  const cliente = editando ? DB.obtenerCliente(estado.clienteId) : null;
  return `
    <div class="modal">
      <h3>${editando ? '✎ Editar datos personales' : '🌸 Nueva ficha de cliente'} <button class="cerrar" id="btn-cerrar-modal">✕</button></h3>
      <form id="form-cliente">
        <div class="form-grid">
          <div class="campo full">
            <label>Nombre completo *</label>
            <input type="text" name="nombre" required value="${editando ? escapeHTML(cliente.nombre) : ''}">
          </div>
          <div class="campo">
            <label>Email</label>
            <input type="email" name="email" value="${editando ? escapeHTML(cliente.email) : ''}">
          </div>
          <div class="campo">
            <label>Teléfono</label>
            <input type="text" name="telefono" value="${editando ? escapeHTML(cliente.telefono) : ''}">
          </div>
          <div class="campo">
            <label>Fecha de nacimiento</label>
            <input type="date" name="fechaNacimiento" value="${editando ? cliente.fechaNacimiento || '' : ''}">
          </div>
          <div class="campo full">
            <label>Observaciones</label>
            <textarea name="observaciones" placeholder="Antecedentes, contexto general, preferencias...">${editando ? escapeHTML(cliente.observaciones) : ''}</textarea>
          </div>
        </div>
        <div class="acciones-form">
          <button type="button" class="btn btn-fantasma" id="btn-cancelar-modal">Cancelar</button>
          <button type="submit" class="btn btn-primario">${editando ? 'Guardar cambios' : 'Crear ficha'}</button>
        </div>
      </form>
    </div>
  `;
}

function modalAtencion() {
  const editando = estado.modal.tipo === 'editarAtencion';
  const cliente = DB.obtenerCliente(estado.clienteId);
  const atencion = editando ? cliente.atenciones.find(a => a.id === estado.modal.atencionId) : null;

  if (!estado.modal.floresElegidas) {
    estado.modal.floresElegidas = editando ? (atencion.floresIndicadas || []).slice() : [];
  }
  if (!estado.modal.sintomasModal) {
    estado.modal.sintomasModal = new Set(editando ? (atencion.sintomasConsultados || []) : []);
  }

  const gruposSintomas = obtenerSintomasAgrupados();
  const gruposHTML = gruposSintomas.map(g => `
    <div class="grupo-sintomas">
      <h4>${escapeHTML(g.categoria)}</h4>
      <div class="lista-sintomas">
        ${g.sintomas.map(s => `
          <button type="button" class="sintoma-toggle ${estado.modal.sintomasModal.has(s) ? 'seleccionado' : ''}" data-sintoma-modal="${escapeHTML(s)}">${escapeHTML(s)}</button>
        `).join('')}
      </div>
    </div>
  `).join('');

  const sintomasArray = Array.from(estado.modal.sintomasModal);
  const recomendadas = recomendarFlores(sintomasArray).slice(0, 6);

  const chipsElegidas = estado.modal.floresElegidas.map(f => `
    <span class="chip-removible">🌼 ${escapeHTML(f.nombre)} <button type="button" data-quitar-flor="${escapeHTML(f.id)}">✕</button></span>
  `).join('');

  return `
    <div class="modal" style="max-width:720px;">
      <h3>${editando ? '✎ Editar atención' : '🌿 Nueva atención'} <button class="cerrar" id="btn-cerrar-modal">✕</button></h3>
      <form id="form-atencion">
        <div class="form-grid">
          <div class="campo">
            <label>Fecha de la sesión *</label>
            <input type="date" name="fecha" required value="${editando ? atencion.fecha || '' : new Date().toISOString().slice(0,10)}">
          </div>
          <div class="campo">
            <label>Fecha próxima visita</label>
            <input type="date" name="fechaProximaVisita" value="${editando ? atencion.fechaProximaVisita || '' : ''}">
          </div>
          <div class="campo full">
            <label>¿Qué se habló en la sesión?</label>
            <textarea name="notas" placeholder="Registrá lo conversado, estado emocional, contexto...">${editando ? escapeHTML(atencion.notas) : ''}</textarea>
          </div>

          <div class="campo full">
            <label>Buscar flor indicada</label>
            <div class="autocompletar-wrap">
              <input type="text" id="input-buscar-flor" placeholder="Escribí el nombre de una flor (Bach o California)...">
              <div id="lista-autocompletar" class="autocompletar-lista" style="display:none;"></div>
            </div>
            <div class="flores-elegidas" id="flores-elegidas-modal">${chipsElegidas}</div>
          </div>

          <div class="campo full">
            <label>Síntomas consultados en esta sesión (opcional, para sugerir flores)</label>
            <div id="sintomas-modal-wrap">${gruposHTML}</div>
          </div>

          <div class="campo full" id="sugerencias-modal-wrap">
            ${sintomasArray.length > 0 ? `
              <label>Sugerencias según los síntomas marcados</label>
              ${recomendadas.map(r => `
                <div class="resultado-flor">
                  <div class="info">
                    <h4>${escapeHTML(r.flor.nombre)} <span style="font-size:11px; color:var(--tinta-suave); font-weight:500;">· ${r.flor.origen}</span></h4>
                    <p>${escapeHTML(r.flor.descripcion)}</p>
                  </div>
                  <button type="button" class="btn btn-secundario btn-chico" data-agregar-flor="${r.flor.id}">＋ Agregar</button>
                </div>
              `).join('')}
            ` : ''}
          </div>
        </div>
        <div class="acciones-form">
          <button type="button" class="btn btn-fantasma" id="btn-cancelar-modal">Cancelar</button>
          <button type="submit" class="btn btn-primario">${editando ? 'Guardar cambios' : 'Registrar atención'}</button>
        </div>
      </form>
    </div>
  `;
}

/* ============================================================
   EVENTOS
   ============================================================ */
function bindEventosGlobales() {
  const buscarCliente = document.getElementById('input-buscar-cliente');
  if (buscarCliente) {
    buscarCliente.addEventListener('input', (e) => {
      estado.busquedaCliente = e.target.value;
      const focoAntes = document.activeElement === buscarCliente;
      render();
      if (focoAntes) {
        const nuevo = document.getElementById('input-buscar-cliente');
        nuevo.focus();
        nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
      }
    });
  }

  const btnNuevoCliente = document.getElementById('btn-nuevo-cliente');
  if (btnNuevoCliente) btnNuevoCliente.addEventListener('click', () => {
    estado.modal = { tipo: 'nuevoCliente' };
    render();
  });

  document.querySelectorAll('[data-abrir-cliente]').forEach(el => {
    el.addEventListener('click', () => {
      estado.clienteId = el.dataset.abrirCliente;
      estado.vista = 'ficha';
      render();
    });
  });

  const btnVolver = document.getElementById('btn-volver-clientes');
  if (btnVolver) btnVolver.addEventListener('click', () => irAVista('clientes'));

  const btnEditarCliente = document.getElementById('btn-editar-cliente');
  if (btnEditarCliente) btnEditarCliente.addEventListener('click', () => {
    estado.modal = { tipo: 'editarCliente' };
    render();
  });

  const btnEliminarCliente = document.getElementById('btn-eliminar-cliente');
  if (btnEliminarCliente) btnEliminarCliente.addEventListener('click', () => {
    const cliente = DB.obtenerCliente(estado.clienteId);
    if (confirm(`¿Eliminar la ficha de ${cliente.nombre}? Esta acción no se puede deshacer.`)) {
      DB.eliminarCliente(estado.clienteId);
      irAVista('clientes');
    }
  });

  const btnNuevaAtencion = document.getElementById('btn-nueva-atencion');
  if (btnNuevaAtencion) btnNuevaAtencion.addEventListener('click', () => {
    estado.modal = { tipo: 'nuevaAtencion' };
    render();
  });

  document.querySelectorAll('[data-editar-atencion]').forEach(b => {
    b.addEventListener('click', () => {
      estado.modal = { tipo: 'editarAtencion', atencionId: b.dataset.editarAtencion };
      render();
    });
  });

  document.querySelectorAll('[data-eliminar-atencion]').forEach(b => {
    b.addEventListener('click', () => {
      if (confirm('¿Eliminar esta atención registrada?')) {
        DB.eliminarAtencion(b.dataset.cliente, b.dataset.eliminarAtencion);
        render();
      }
    });
  });

  // Recomendador standalone: toggles de síntomas
  document.querySelectorAll('.sintoma-toggle[data-sintoma]').forEach(b => {
    b.addEventListener('click', () => {
      const s = b.dataset.sintoma;
      if (estado.sintomasSeleccionados.has(s)) estado.sintomasSeleccionados.delete(s);
      else estado.sintomasSeleccionados.add(s);
      render();
    });
  });

  const btnLimpiarSintomas = document.getElementById('btn-limpiar-sintomas');
  if (btnLimpiarSintomas) btnLimpiarSintomas.addEventListener('click', () => {
    estado.sintomasSeleccionados.clear();
    render();
  });
}

function bindEventosModal() {
  const btnCerrar = document.getElementById('btn-cerrar-modal');
  const btnCancelar = document.getElementById('btn-cancelar-modal');
  const cerrar = () => { estado.modal = null; render(); };
  if (btnCerrar) btnCerrar.addEventListener('click', cerrar);
  if (btnCancelar) btnCancelar.addEventListener('click', cerrar);

  const overlay = document.getElementById('overlay-modal');
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); });

  const formCliente = document.getElementById('form-cliente');
  if (formCliente) {
    formCliente.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(formCliente);
      const datos = {
        nombre: fd.get('nombre').trim(),
        email: fd.get('email').trim(),
        telefono: fd.get('telefono').trim(),
        fechaNacimiento: fd.get('fechaNacimiento'),
        observaciones: fd.get('observaciones').trim()
      };
      if (!datos.nombre) return;
      if (estado.modal.tipo === 'editarCliente') {
        DB.actualizarCliente(estado.clienteId, datos);
      } else {
        const nuevo = DB.crearCliente(datos);
        estado.clienteId = nuevo.id;
        estado.vista = 'ficha';
      }
      estado.modal = null;
      render();
    });
  }

  const formAtencion = document.getElementById('form-atencion');
  if (formAtencion) {
    // Autocompletar de flores
    const inputBuscarFlor = document.getElementById('input-buscar-flor');
    const listaAuto = document.getElementById('lista-autocompletar');
    inputBuscarFlor.addEventListener('input', () => {
      const resultados = buscarFlorPorNombre(inputBuscarFlor.value).slice(0, 8);
      if (resultados.length === 0 || !inputBuscarFlor.value.trim()) {
        listaAuto.style.display = 'none';
        listaAuto.innerHTML = '';
        return;
      }
      listaAuto.innerHTML = resultados.map(f => `<div data-elegir-flor="${f.id}">${escapeHTML(f.nombre)} <small style="color:var(--tinta-suave)">· ${f.origen}</small></div>`).join('');
      listaAuto.style.display = 'block';
    });
    listaAuto.addEventListener('click', (e) => {
      const div = e.target.closest('[data-elegir-flor]');
      if (!div) return;
      agregarFlorAModal(div.dataset.elegirFlor);
      inputBuscarFlor.value = '';
      listaAuto.style.display = 'none';
      listaAuto.innerHTML = '';
      render();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocompletar-wrap') && listaAuto) {
        listaAuto.style.display = 'none';
      }
    }, { once: true });

    document.querySelectorAll('[data-quitar-flor]').forEach(b => {
      b.addEventListener('click', () => {
        estado.modal.floresElegidas = estado.modal.floresElegidas.filter(f => f.id !== b.dataset.quitarFlor);
        render();
      });
    });

    document.querySelectorAll('[data-agregar-flor]').forEach(b => {
      b.addEventListener('click', () => {
        agregarFlorAModal(b.dataset.agregarFlor);
        render();
      });
    });

    document.querySelectorAll('[data-sintoma-modal]').forEach(b => {
      b.addEventListener('click', () => {
        const s = b.dataset.sintomaModal;
        if (estado.modal.sintomasModal.has(s)) estado.modal.sintomasModal.delete(s);
        else estado.modal.sintomasModal.add(s);
        render();
      });
    });

    formAtencion.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(formAtencion);
      const datos = {
        fecha: fd.get('fecha'),
        fechaProximaVisita: fd.get('fechaProximaVisita'),
        notas: fd.get('notas').trim(),
        floresIndicadas: estado.modal.floresElegidas,
        sintomasConsultados: Array.from(estado.modal.sintomasModal)
      };
      if (estado.modal.tipo === 'editarAtencion') {
        DB.actualizarAtencion(estado.clienteId, estado.modal.atencionId, datos);
      } else {
        DB.agregarAtencion(estado.clienteId, datos);
      }
      estado.modal = null;
      render();
    });
  }
}

function agregarFlorAModal(florId) {
  if (estado.modal.floresElegidas.some(f => f.id === florId)) return;
  const flor = FLORES_DB.find(f => f.id === florId);
  if (!flor) return;
  estado.modal.floresElegidas.push({ id: flor.id, nombre: flor.nombre });
}

/* Mantiene el scroll del modal al re-renderizar mientras se interactúa dentro de él */
const _renderOriginal = render;
render = function() {
  const modalAbierto = document.getElementById('overlay-modal');
  const scrollModal = modalAbierto ? modalAbierto.scrollTop : 0;
  _renderOriginal();
  const modalNuevo = document.getElementById('overlay-modal');
  if (modalNuevo) modalNuevo.scrollTop = scrollModal;
};

render();
