const { invoke } = window.__TAURI__.core;

const TIPOS = {
  password: { icono: "ti-key", campos: "campos-password", label: "Contraseña" },
  nota: { icono: "ti-notes", campos: "campos-nota", label: "Nota" },
  vpn: { icono: "ti-shield-lock", campos: "campos-vpn", label: "VPN" },
};

let items = [];
let filtroActivo = "todos";
let terminoBusqueda = "";
let tipoSeleccionado = "password";
let idEditando = null;
let idEliminar = null;
let eliminando = false;
let focoEliminar = null;

function idNuevo() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cargarItems() {
  const contenido = await invoke("cargar_items");
  items = JSON.parse(contenido);
}

async function guardarEnDisco(contenido = items) {
  await invoke("guardar_items", { contenido: JSON.stringify(contenido) });
}

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
}

function subtitulo(item) {
  if (item.tipo === "password") return `${item.usuario || "sin usuario"} · ••••••••`;
  if (item.tipo === "nota") return "Nota privada";
  if (item.tipo === "vpn") return `${item.servidor || "sin servidor"} · ${item.usuario || "sin usuario"}`;
  return "";
}

function camposCopiables(item) {
  if (item.tipo === "password") {
    return [
      { campo: "usuario", label: "usuario", icono: "ti-user" },
      { campo: "password", label: "contraseña", icono: "ti-key" },
    ];
  }
  if (item.tipo === "vpn") {
    return [
      { campo: "servidor", label: "servidor", icono: "ti-server" },
      { campo: "usuario", label: "usuario", icono: "ti-user" },
      { campo: "password", label: "contraseña", icono: "ti-key" },
    ];
  }
  return [];
}

async function copiarAlPortapapeles(texto, boton) {
  const status = document.getElementById("copy-status");
  if (!texto) { status.textContent = "El campo está vacío."; return; }
  try {
    await invoke("copiar_texto", { texto });
  } catch {
    status.textContent = "No se pudo copiar. Intentá nuevamente.";
    return;
  }
  status.textContent = "Copiado. El portapapeles se limpia en 1 minuto.";
  boton.classList.add("copiado");
  const etiqueta = boton.querySelector("span");
  if (!boton.dataset.etiqueta) boton.dataset.etiqueta = etiqueta.textContent;
  etiqueta.textContent = "Copiado";
  clearTimeout(boton._copiadoTimeout);
  boton._copiadoTimeout = setTimeout(() => {
    boton.classList.remove("copiado");
    etiqueta.textContent = boton.dataset.etiqueta;
  }, 1600);
}

function itemsFiltrados() {
  return items.filter((item) => {
    const pasaTipo = filtroActivo === "todos" || item.tipo === filtroActivo;
    const texto = terminoBusqueda.trim().toLowerCase();
    const pasaBusqueda = !texto || (item.titulo || "").toLowerCase().includes(texto);
    return pasaTipo && pasaBusqueda;
  });
}

function renderLista() {
  const listaEl = document.getElementById("lista");
  const vacioEl = document.getElementById("vacio");
  const visibles = itemsFiltrados();

  document.getElementById("contador").textContent = `${items.length} elemento${items.length === 1 ? "" : "s"} guardado${items.length === 1 ? "" : "s"}`;

  listaEl.innerHTML = "";
  vacioEl.hidden = visibles.length > 0;
  vacioEl.textContent = items.length ? "No hay resultados. Probá con otro título o filtro." : "Tu bóveda está vacía. Agregá tu primer elemento.";

  for (const item of visibles) {
    const fila = document.createElement("div");
    fila.className = "item";

    const copiables = camposCopiables(item);
    const botonesCopia = copiables
      .map(
        (c) => `
      <button type="button" class="item-copiar" data-campo="${c.campo}" title="Copiar ${c.label}" aria-label="Copiar ${c.label}">
        <i class="ti ${c.icono}" aria-hidden="true"></i><span>Copiar ${c.label}</span>
      </button>`
      )
      .join("");

    fila.innerHTML = `
      <div class="item-heading"><button type="button" class="item-clic">
        <div class="item-icono ${item.tipo}"><i class="ti ${TIPOS[item.tipo].icono}" aria-hidden="true"></i></div>
        <div class="item-info">
          <p class="item-titulo">${escaparHtml(item.titulo || "(sin título)")}</p>
          <p class="item-sub">${escaparHtml(subtitulo(item))}</p>
        </div>
      </button><button type="button" class="item-editar" title="Editar"><i class="ti ti-pencil" aria-hidden="true"></i></button></div>
      <div class="item-acciones">${botonesCopia}<button type="button" class="item-eliminar"><i class="ti ti-trash" aria-hidden="true"></i><span>Eliminar</span></button></div>
    `;

    fila.querySelector(".item-clic").addEventListener("click", () => abrirModal(item.id));
    const editar = fila.querySelector(".item-editar");
    editar.setAttribute("aria-label", "Editar " + (item.titulo || "elemento sin título"));
    editar.addEventListener("click", () => abrirModal(item.id));
    fila.querySelectorAll(".item-copiar").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        copiarAlPortapapeles(item[btn.dataset.campo], btn);
      });
    });

    const eliminar = fila.querySelector(".item-eliminar");
    eliminar.setAttribute("aria-label", "Eliminar " + (item.titulo || "elemento sin título"));
    eliminar.addEventListener("click", () => solicitarEliminar(item.id));
    listaEl.appendChild(fila);
  }
}

function mostrarCampos(tipo) {
  for (const clave of Object.keys(TIPOS)) {
    document.getElementById(TIPOS[clave].campos).hidden = clave !== tipo;
  }
  document.querySelectorAll(".tipo-opcion").forEach((btn) => {
    btn.classList.toggle("activo", btn.dataset.tipo === tipo);
  });
  tipoSeleccionado = tipo;
}

function limpiarFormulario() {
  document.getElementById("form-item").reset();
  document.getElementById("form-error").hidden = true;
}

function abrirModal(id) {
  idEditando = id ?? null;
  limpiarFormulario();
  const overlay = document.getElementById("overlay");
  const form = document.getElementById("form-item");
  const btnEliminar = document.getElementById("btn-eliminar");

  if (idEditando) {
    const item = items.find((i) => i.id === idEditando);
    document.getElementById("modal-titulo").textContent = TIPOS[item.tipo].label;
    mostrarCampos(item.tipo);
    for (const [clave, valor] of Object.entries(item)) {
      const campo = document.getElementById(TIPOS[item.tipo].campos).querySelector(`[name="${clave}"]`);
      if (campo) campo.value = valor;
    }
    btnEliminar.hidden = false;
  } else {
    document.getElementById("modal-titulo").textContent = "Nuevo elemento";
    mostrarCampos("password");
    btnEliminar.hidden = true;
  }

  overlay.hidden = false;
}

function cerrarModal() {
  document.getElementById("overlay").hidden = true;
  idEditando = null;
}

function datosFormulario() {
  const form = document.getElementById("form-item");
  const contenedor = document.getElementById(TIPOS[tipoSeleccionado].campos);
  const datos = { tipo: tipoSeleccionado };
  contenedor.querySelectorAll("input, textarea").forEach((campo) => {
    datos[campo.name] = campo.value.trim();
  });
  return datos;
}

async function guardarItem(ev) {
  ev.preventDefault();
  if (eliminando) return;
  const errorEl = document.getElementById("form-error");
  const datos = datosFormulario();

  if (!datos.titulo) {
    errorEl.textContent = "Completá el título antes de guardar.";
    errorEl.hidden = false;
    return;
  }

  if (idEditando) {
    const idx = items.findIndex((i) => i.id === idEditando);
    items[idx] = { ...items[idx], ...datos };
  } else {
    items.push({ id: idNuevo(), ...datos });
  }

  await guardarEnDisco();
  renderLista();
  cerrarModal();
}

function solicitarEliminar(id = idEditando) {
  if (eliminando) return;
  const item = items.find((i) => i.id === id);
  if (!item) return;
  idEliminar = id;
  focoEliminar = document.activeElement;
  document.getElementById("eliminar-nombre").textContent = item.titulo || "el elemento sin título";
  document.getElementById("eliminar-error").hidden = true;
  document.getElementById("confirmar-eliminar").showModal();
}

async function eliminarItem() {
  if (eliminando || idEliminar === null) return;
  const id = idEliminar;
  const restantes = items.filter((i) => i.id !== id);
  if (restantes.length === items.length) return;
  eliminando = true;
  const confirmar = document.getElementById("btn-confirmar-eliminar");
  const cancelar = document.getElementById("btn-cancelar-eliminar");
  confirmar.disabled = cancelar.disabled = true;
  confirmar.textContent = "Eliminando…";
  try {
    await guardarEnDisco(restantes);
    items = restantes;
    if (idEditando === id) cerrarModal();
    renderLista();
    document.getElementById("confirmar-eliminar").close();
    document.getElementById("copy-status").textContent = "Elemento eliminado.";
  } catch {
    const error = document.getElementById("eliminar-error");
    error.textContent = "No se pudo eliminar. Tus datos se conservaron. Intentá de nuevo.";
    error.hidden = false;
  } finally {
    eliminando = false;
    confirmar.disabled = cancelar.disabled = false;
    confirmar.textContent = "Sí, eliminar";
  }
}

function abrirImportar() {
  document.getElementById("importar-textarea").value = "";
  document.getElementById("importar-error").hidden = true;
  document.getElementById("overlay-importar").hidden = false;
}

function cerrarImportar() {
  document.getElementById("overlay-importar").hidden = true;
}

async function importarItems() {
  if (eliminando) return;
  const errorEl = document.getElementById("importar-error");
  const texto = document.getElementById("importar-textarea").value.trim();
  errorEl.hidden = true;

  let nuevos;
  try {
    nuevos = JSON.parse(texto);
    if (!Array.isArray(nuevos)) throw new Error("El JSON debe ser una lista");
  } catch (err) {
    errorEl.textContent = `JSON inválido: ${err.message}`;
    errorEl.hidden = false;
    return;
  }

  for (const item of nuevos) {
    items.push({ id: idNuevo(), ...item });
  }

  await guardarEnDisco();
  renderLista();
  cerrarImportar();
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    await cargarItems();
  } catch (err) {
    document.getElementById("vacio").textContent = `Error al cargar: ${err.message || err}`;
  }
  renderLista();

  document.getElementById("btn-nuevo").addEventListener("click", () => abrirModal(null));
  document.getElementById("btn-importar").addEventListener("click", abrirImportar);
  document.getElementById("btn-cerrar-importar").addEventListener("click", cerrarImportar);
  document.getElementById("overlay-importar").addEventListener("click", (ev) => {
    if (ev.target.id === "overlay-importar") cerrarImportar();
  });
  document.getElementById("btn-importar-confirmar").addEventListener("click", importarItems);
  document.getElementById("btn-cerrar").addEventListener("click", cerrarModal);
  document.getElementById("overlay").addEventListener("click", (ev) => {
    if (ev.target.id === "overlay") cerrarModal();
  });
  document.getElementById("form-item").addEventListener("submit", guardarItem);
  document.getElementById("btn-eliminar").addEventListener("click", () => solicitarEliminar());
  const confirmacion = document.getElementById("confirmar-eliminar");
  document.getElementById("btn-confirmar-eliminar").addEventListener("click", eliminarItem);
  document.getElementById("btn-cancelar-eliminar").addEventListener("click", () => { if (!eliminando) confirmacion.close(); });
  confirmacion.addEventListener("cancel", (ev) => { if (eliminando) ev.preventDefault(); });
  confirmacion.addEventListener("close", () => {
    idEliminar = null;
    if (focoEliminar?.isConnected && !focoEliminar.closest("[hidden]")) focoEliminar.focus();
    else document.getElementById("btn-nuevo").focus();
  });

  document.getElementById("form-item").addEventListener("click", (ev) => {
    const boton = ev.target.closest(".campo-copiar");
    if (!boton) return;
    ev.preventDefault();
    const campo = boton.parentElement.querySelector("input, textarea");
    if (campo) copiarAlPortapapeles(campo.value, boton);
  });

  document.querySelectorAll(".tipo-opcion").forEach((btn) => {
    btn.addEventListener("click", () => mostrarCampos(btn.dataset.tipo));
  });

  document.querySelectorAll(".filtro").forEach((btn) => {
    btn.addEventListener("click", () => {
      filtroActivo = btn.dataset.tipo;
      document.querySelectorAll(".filtro").forEach((b) => b.classList.toggle("activo", b === btn));
      renderLista();
    });
  });

  document.getElementById("buscar-input").addEventListener("input", (ev) => {
    terminoBusqueda = ev.target.value;
    renderLista();
  });
});
