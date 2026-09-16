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

function idNuevo() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cargarItems() {
  const contenido = await invoke("cargar_items");
  items = JSON.parse(contenido);
}

async function guardarEnDisco() {
  await invoke("guardar_items", { contenido: JSON.stringify(items) });
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

function copiarConFallback(texto) {
  const textarea = document.createElement("textarea");
  textarea.value = texto;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("execCommand copy falló");
}

async function copiarAlPortapapeles(texto, boton) {
  if (!texto) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
    } else {
      copiarConFallback(texto);
    }
  } catch (err) {
    try {
      copiarConFallback(texto);
    } catch (err2) {
      console.error("No se pudo copiar:", err2);
      return;
    }
  }

  const iconoEl = boton.querySelector("i");
  const iconoOriginal = iconoEl.className;
  boton.classList.add("copiado");
  iconoEl.className = "ti ti-check";
  clearTimeout(boton._copiadoTimeout);
  boton._copiadoTimeout = setTimeout(() => {
    boton.classList.remove("copiado");
    iconoEl.className = iconoOriginal;
  }, 1200);
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

  document.getElementById("contador").textContent = `${items.length} item${items.length === 1 ? "" : "s"} guardado${items.length === 1 ? "" : "s"}`;

  listaEl.innerHTML = "";
  vacioEl.hidden = visibles.length > 0;

  for (const item of visibles) {
    const fila = document.createElement("div");
    fila.className = "item";

    const copiables = camposCopiables(item);
    const botonesCopia = copiables
      .map(
        (c) => `
      <button type="button" class="item-copiar" data-campo="${c.campo}" title="Copiar ${c.label}" aria-label="Copiar ${c.label}">
        <i class="ti ${c.icono}" aria-hidden="true"></i>
      </button>`
      )
      .join("");

    fila.innerHTML = `
      <button type="button" class="item-clic">
        <div class="item-icono ${item.tipo}"><i class="ti ${TIPOS[item.tipo].icono}" aria-hidden="true"></i></div>
        <div class="item-info">
          <p class="item-titulo">${item.titulo || "(sin título)"}</p>
          <p class="item-sub">${subtitulo(item)}</p>
        </div>
      </button>
      ${botonesCopia ? `<div class="item-acciones">${botonesCopia}</div>` : ""}
    `;

    fila.querySelector(".item-clic").addEventListener("click", () => abrirModal(item.id));
    fila.querySelectorAll(".item-copiar").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        copiarAlPortapapeles(item[btn.dataset.campo], btn);
      });
    });

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
      const campo = form.querySelector(`[name="${clave}"]`);
      if (campo) campo.value = valor;
    }
    btnEliminar.hidden = false;
  } else {
    document.getElementById("modal-titulo").textContent = "Nuevo item";
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

async function eliminarItem() {
  items = items.filter((i) => i.id !== idEditando);
  await guardarEnDisco();
  renderLista();
  cerrarModal();
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
  document.getElementById("btn-eliminar").addEventListener("click", eliminarItem);

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
