const ENDPOINT = 'https://jsonplaceholder.typicode.com/posts';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

function actualizarIndicadorRed() {
  const badge = document.getElementById('badge-red');
  if (navigator.onLine) {
    badge.textContent = 'En Línea';
    badge.className = 'badge online';
  } else {
    badge.textContent = 'Sin Conexión';
    badge.className = 'badge offline';
  }
}

// READ
function renderizarColaOutbox() {
  return obtenerTodosLosRegistros().then((registros) => {
    const lista = document.getElementById('lista-outbox');
    lista.innerHTML = '';
    registros.forEach((item) => {
      const li = document.createElement('li');
      const hora = new Date(item.fechaCreacion).toLocaleTimeString();
      li.textContent = `${item.titulo} - ${item.estado} - ${hora}`;
      lista.appendChild(li);
    });
  });
}

// CREATE
function procesarEnvioReporte(datosFormulario) {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datosFormulario)
  })
    .then((respuesta) => {
      if (!respuesta.ok) throw new Error('Error HTTP del servidor');
      return respuesta.json();
    })
    .then(() => {
      return guardarRegistro({
        ...datosFormulario,
        estado: 'sincronizado',
        fechaCreacion: Date.now()
      });
    })
    .catch(() => {
      console.warn('[Outbox] Sin conexión. Encolando transacción localmente...');
      return guardarRegistro({
        ...datosFormulario,
        estado: 'pendiente',
        fechaCreacion: Date.now()
      });
    })
    .then(() => {
      return renderizarColaOutbox();
    });
}

// UPDATE
function sincronizarPendientes() {
  console.log('[Outbox] Conexión detectada. Buscando registros pendientes...');

  return obtenerTodosLosRegistros()
    .then((registros) => {
      const pendientes = registros.filter((item) => item.estado === 'pendiente');

      if (pendientes.length === 0) {
        console.log('[Outbox] No hay transacciones pendientes por sincronizar.');
        return;
      }

      const promesasDeEnvio = pendientes.map((item) => {
        return fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: item.titulo, body: item.descripcion })
        })
          .then((res) => {
            if (!res.ok) throw new Error('Falla al reintentar envío');
            return actualizarEstadoRegistro(item.id, 'sincronizado');
          });
      });

      return Promise.all(promesasDeEnvio);
    })
    .then(() => {
      return renderizarColaOutbox();
    })
    .catch((error) => {
      console.error('[Outbox] Error durante la sincronización masiva:', error);
    });
}

window.addEventListener('online', () => {
  actualizarIndicadorRed();
  sincronizarPendientes();
});

window.addEventListener('offline', actualizarIndicadorRed);

document.getElementById('form-incidencia').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const datos = {
    titulo: document.getElementById('titulo').value,
    descripcion: document.getElementById('descripcion').value
  };
  procesarEnvioReporte(datos);
  form.reset();
});

// DELETE
document.getElementById('btn-purgar').addEventListener('click', () => {
  obtenerTodosLosRegistros()
    .then((registros) => {
      const sincronizados = registros.filter((item) => item.estado === 'sincronizado');
      return Promise.all(sincronizados.map((item) => eliminarRegistro(item.id)));
    })
    .then(() => {
      return renderizarColaOutbox();
    })
    .catch((error) => {
      console.error('[Outbox] Error al purgar:', error);
    });
});

actualizarIndicadorRed();
renderizarColaOutbox();
