/* Capa de persistencia simple sobre localStorage */

const DB_KEY = 'luaazul_fichas_clientes_v1';

function generarId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function cargarDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return { clientes: [] };
    const data = JSON.parse(raw);
    if (!data.clientes) data.clientes = [];
    return data;
  } catch (e) {
    console.error('Error leyendo la base de datos local', e);
    return { clientes: [] };
  }
}

function guardarDB(data) {
  localStorage.setItem(DB_KEY, JSON.stringify(data));
}

const DB = {
  listarClientes() {
    const data = cargarDB();
    return data.clientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  },

  obtenerCliente(id) {
    const data = cargarDB();
    return data.clientes.find(c => c.id === id) || null;
  },

  crearCliente(cliente) {
    const data = cargarDB();
    const nuevo = {
      id: generarId(),
      nombre: cliente.nombre || '',
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      fechaNacimiento: cliente.fechaNacimiento || '',
      observaciones: cliente.observaciones || '',
      creadoEn: new Date().toISOString(),
      atenciones: []
    };
    data.clientes.push(nuevo);
    guardarDB(data);
    return nuevo;
  },

  actualizarCliente(id, cambios) {
    const data = cargarDB();
    const cliente = data.clientes.find(c => c.id === id);
    if (!cliente) return null;
    Object.assign(cliente, cambios);
    guardarDB(data);
    return cliente;
  },

  eliminarCliente(id) {
    const data = cargarDB();
    data.clientes = data.clientes.filter(c => c.id !== id);
    guardarDB(data);
  },

  agregarAtencion(clienteId, atencion) {
    const data = cargarDB();
    const cliente = data.clientes.find(c => c.id === clienteId);
    if (!cliente) return null;
    const nueva = {
      id: generarId(),
      fecha: atencion.fecha || '',
      notas: atencion.notas || '',
      floresIndicadas: atencion.floresIndicadas || [],
      fechaProximaVisita: atencion.fechaProximaVisita || '',
      sintomasConsultados: atencion.sintomasConsultados || [],
      creadoEn: new Date().toISOString()
    };
    cliente.atenciones.unshift(nueva);
    guardarDB(data);
    return nueva;
  },

  actualizarAtencion(clienteId, atencionId, cambios) {
    const data = cargarDB();
    const cliente = data.clientes.find(c => c.id === clienteId);
    if (!cliente) return null;
    const atencion = cliente.atenciones.find(a => a.id === atencionId);
    if (!atencion) return null;
    Object.assign(atencion, cambios);
    guardarDB(data);
    return atencion;
  },

  eliminarAtencion(clienteId, atencionId) {
    const data = cargarDB();
    const cliente = data.clientes.find(c => c.id === clienteId);
    if (!cliente) return null;
    cliente.atenciones = cliente.atenciones.filter(a => a.id !== atencionId);
    guardarDB(data);
  },

  exportarJSON() {
    const data = cargarDB();
    return JSON.stringify(data, null, 2);
  },

  importarJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!data.clientes) throw new Error('Formato inválido');
    guardarDB(data);
  }
};
