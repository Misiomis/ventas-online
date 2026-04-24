// ============================================================
//  Central Variedades — Gestión de Ventas en Vivo
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── FIREBASE CONFIG ────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC185Z2bilgkUNmekIs1DeChF-tEmIgLC0",
  authDomain:        "ventas-online-f.firebaseapp.com",
  projectId:         "ventas-online-f",
  storageBucket:     "ventas-online-f.appspot.com",
  messagingSenderId: "145548756840",
  appId:             "1:145548756840:web:ec46acb1c0139626838dd"
};
// ── Pegá la URL del Web App de Apps Script para sync inmediato ──
const SHEETS_WEBAPP_URL = "";
// ────────────────────────────────────────────────────────────

const USE_FIREBASE = true;

// ============================================================
//  STORAGE ABSTRACTION
// ============================================================
class LocalDB {
  constructor(key) { this._key = key; this._subs = new Set(); }
  _load() {
    try {
      return (JSON.parse(localStorage.getItem(this._key)) || []).map(v => ({
        ...v, fechaCreacion: v.fechaCreacion ? new Date(v.fechaCreacion) : new Date()
      }));
    } catch { return []; }
  }
  _save(items) { localStorage.setItem(this._key, JSON.stringify(items)); this._notify(items); }
  _notify(items) {
    const parsed = items.map(v => ({ ...v, fechaCreacion: v.fechaCreacion instanceof Date ? v.fechaCreacion : new Date(v.fechaCreacion) }));
    this._subs.forEach(cb => cb(parsed));
  }
  subscribe(cb) { this._subs.add(cb); cb(this._load()); return () => this._subs.delete(cb); }
  async add(data) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const items = this._load();
    items.unshift({ ...data, id, fechaCreacion: new Date() });
    this._save(items);
    return id;
  }
  async update(id, changes) {
    const items = this._load();
    const i = items.findIndex(v => v.id === id);
    if (i !== -1) { items[i] = { ...items[i], ...changes }; this._save(items); }
  }
  async remove(id) { this._save(this._load().filter(v => v.id !== id)); }
}

class FirestoreDB {
  constructor(db, col) { this._db = db; this._col = col; }
  subscribe(cb) {
    const q = query(collection(this._db, this._col), orderBy("fechaCreacion", "desc"));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({ id: d.id, ...d.data(), fechaCreacion: d.data().fechaCreacion?.toDate() ?? new Date() })));
    }, err => { console.error("Firestore:", err); showToast("Error de conexión con Firebase", "err"); });
  }
  async add(data) {
    const ref = await addDoc(collection(this._db, this._col), { ...data, fechaCreacion: serverTimestamp() });
    return ref.id;
  }
  async update(id, changes) { await updateDoc(doc(this._db, this._col, id), changes); }
  async remove(id) { await deleteDoc(doc(this._db, this._col, id)); }
}

let storagePedidos, storageSort;
if (USE_FIREBASE) {
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    const db  = getFirestore(app);
    storagePedidos = new FirestoreDB(db, "ventas");   // colección existente
    storageSort    = new FirestoreDB(db, "sorteos");
  } catch (e) {
    console.warn("Firebase error, modo local:", e);
    storagePedidos = new LocalDB("cv_pedidos");
    storageSort    = new LocalDB("cv_sorteos");
  }
} else {
  storagePedidos = new LocalDB("cv_pedidos");
  storageSort    = new LocalDB("cv_sorteos");
}

// ============================================================
//  ESTADO
// ============================================================
let allVentas    = [];
let allSorteos   = [];
let editId       = null;
let activeFilter = "todos";
let searchQuery  = "";

// ============================================================
//  DOM
// ============================================================
const $ = id => document.getElementById(id);

const formVenta        = $("form-venta");
const inpCliente       = $("inp-cliente");
const inpTelefono      = $("inp-telefono");
const selProducto      = $("sel-producto");
const inpMarca         = $("inp-marca");
const selSegmento      = $("sel-segmento");
const inpAccesorio     = $("inp-accesorio");
const inpAccesorioOtro = $("inp-accesorio-otro");
const inpTalle         = $("inp-talle");
const inpColor         = $("inp-color");
const inpPrecio        = $("inp-precio");
const inpPago          = $("inp-pago");
const inpEditId        = $("inp-edit-id");
const dynMarca         = $("dyn-marca");
const dynSegmento      = $("dyn-segmento");
const dynAccesorio     = $("dyn-accesorio");
const dynAccesorioOtro = $("dyn-accesorio-otro");
const btnGuardar       = $("btn-guardar");
const btnLbl           = btnGuardar.querySelector(".btn-lbl");
const editBanner       = $("edit-banner");
const formTitle        = $("form-title");
const btnCancelEdit    = $("btn-cancel-edit");

const statTotal      = $("stat-total");
const statPending    = $("stat-pending");
const statEntregados = $("stat-entregados");

const inpSearch      = $("inp-search");
const btnSearchClear = $("btn-search-clear");
const resultsEl      = $("results");
const resumenEl      = $("resumen-container");
const entregadosEl   = $("entregados-list");

const formSorteo = $("form-sorteo");
const inpGanador = $("inp-ganador");
const inpPremio  = $("inp-premio");
const btnSorteo  = $("btn-sorteo");
const sorteoList = $("sorteo-list");

const btnPdf  = $("btn-pdf");
const toastEl = $("toast");

// Sorteo en Vivo
const inpVivoNombre  = $("inp-vivo-nombre");
const btnVivoAdd     = $("btn-vivo-add");
const btnLimpiarVivo = $("btn-limpiar-vivo");
const vivoLista      = $("vivo-lista");
const vivoCount      = $("vivo-count");
const btnVivoStart   = $("btn-vivo-start");
const vivoRuletaBox  = $("vivo-ruleta-box");
const vivoRuletaNom  = $("vivo-ruleta-nombre");
const vivoRuletaTot  = $("vivo-ruleta-total");
const vivoGanadorBox = $("vivo-ganador-box");
const vivoGanadorNom = $("vivo-ganador-nombre");
const btnRepetirVivo = $("btn-repetir-vivo");
const btnResetVivo   = $("btn-reset-vivo");

// ============================================================
//  BOOT
// ============================================================
function boot() {
  setupTabs();
  setupProductoChange();
  setupAccesorioOtro();
  setupPayToggle();
  setupForm();
  setupSearch();
  setupSorteoForm();
  setupEditCancel();
  if (btnPdf) btnPdf.addEventListener("click", generatePDF);
  setupSorteoVivo();

  storagePedidos.subscribe(ventas => {
    allVentas = ventas;
    updateStats();
    renderResults();
    renderDailySummary();
    renderEntregados();
  });

  storageSort.subscribe(sorteos => {
    allSorteos = sorteos;
    renderSorteos();
  });

  if (inpCliente) inpCliente.focus();
}

// ============================================================
//  TABS
// ============================================================
function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
    b.setAttribute("aria-selected", b.dataset.tab === tabName ? "true" : "false");
  });
  document.querySelectorAll(".panel").forEach(p => {
    p.classList.toggle("active", p.id === `panel-${tabName}`);
  });
  if (tabName === "buscar")  setTimeout(() => inpSearch.focus(), 80);
  if (tabName === "sorteo")  setTimeout(() => inpGanador.focus(), 80);
}

// ============================================================
//  CAMPOS DINÁMICOS
// ============================================================
function setupProductoChange() {
  if (selProducto) selProducto.addEventListener("change", applyProductoLogic);
}

function applyProductoLogic() {
  const p = selProducto.value;
  closeField(dynMarca); closeField(dynSegmento);
  closeField(dynAccesorio); closeField(dynAccesorioOtro);
  if (p === "Zapatillas") {
    openField(dynMarca);
    if (selSegmento) selSegmento.value = "";
    if (inpAccesorio) inpAccesorio.value = "";
    if (inpAccesorioOtro) inpAccesorioOtro.value = "";
  } else if (p === "Abrigo" || p === "Remera") {
    openField(dynSegmento);
    if (inpMarca) inpMarca.value = "";
    if (inpAccesorio) inpAccesorio.value = "";
    if (inpAccesorioOtro) inpAccesorioOtro.value = "";
  } else if (p === "Accesorio") {
    openField(dynAccesorio);
    if (inpMarca) inpMarca.value = "";
    if (selSegmento) selSegmento.value = "";
  } else {
    if (inpMarca) inpMarca.value = "";
    if (selSegmento) selSegmento.value = "";
    if (inpAccesorio) inpAccesorio.value = "";
    if (inpAccesorioOtro) inpAccesorioOtro.value = "";
  }
}

function setupAccesorioOtro() {
  if (inpAccesorio) {
    inpAccesorio.addEventListener("change", () => {
      if (inpAccesorio.value === "Otro") {
        openField(dynAccesorioOtro);
        if (inpAccesorioOtro) inpAccesorioOtro.focus();
      } else {
        closeField(dynAccesorioOtro);
        if (inpAccesorioOtro) { inpAccesorioOtro.value = ""; inpAccesorioOtro.classList.remove("err"); }
      }
    });
  }
}

function openField(el)  { if (el) el.classList.add("open"); }
function closeField(el) { if (el) el.classList.remove("open"); }

// ============================================================
//  PAYMENT TOGGLE
// ============================================================
function setupPayToggle() {
  document.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pay-btn").forEach(b => b.classList.remove("pay-btn--active"));
      btn.classList.add("pay-btn--active");
      inpPago.value = btn.dataset.status;
    });
  });
}

// ============================================================
//  FORMULARIO
// ============================================================
function setupForm() {
  if (!formVenta) return;
  formVenta.addEventListener("submit", async e => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(btnGuardar, true);

    const datos = {
      nombreCliente: inpCliente.value.trim(),
      producto:      selProducto.value,
      talle:         inpTalle.value.trim(),
      color:         inpColor.value.trim(),
      precio:        parsePrecio(inpPrecio.value),
      estadoPago:    inpPago.value,
      entregado:     false
    };
    if (inpTelefono && inpTelefono.value.trim()) datos.telefono = inpTelefono.value.trim();
    if (selProducto.value === "Zapatillas" && inpMarca.value.trim())
      datos.marca = inpMarca.value.trim();
    if ((selProducto.value === "Abrigo" || selProducto.value === "Remera") && selSegmento.value)
      datos.segmento = selSegmento.value;
    if (selProducto.value === "Accesorio" && inpAccesorio.value) {
      datos.tipoAccesorio = inpAccesorio.value === "Otro"
        ? inpAccesorioOtro.value.trim() : inpAccesorio.value;
    }

    try {
      if (editId) {
        const original = allVentas.find(v => v.id === editId);
        if (original?.entregado) datos.entregado = true;
        await storagePedidos.update(editId, datos);
        notifySheets("ventas", "update", editId, { ...original, ...datos, fechaCreacion: toISO(original?.fechaCreacion) });
        showToast(`✓ Pedido de ${datos.nombreCliente} actualizado`, "ok");
      } else {
        const newId = await storagePedidos.add(datos);
        notifySheets("ventas", "add", newId, { ...datos, fechaCreacion: new Date().toISOString() });
        showToast(`✓ Venta guardada para ${datos.nombreCliente}`, "ok");
      }
      resetForm();
    } catch (err) {
      console.error(err);
      showToast("Error al guardar. Revisá la conexión.", "err");
    } finally {
      setLoading(btnGuardar, false);
    }
  });
}

function validateForm() {
  let ok = true;
  [inpCliente, selProducto, inpTalle, inpPrecio].forEach(f => {
    if (f) {
      f.classList.remove("err");
      if (!f.value.trim()) { f.classList.add("err"); ok = false; }
    }
  });
  if (selProducto.value === "Accesorio") {
    if (inpAccesorio) {
      inpAccesorio.classList.remove("err");
      if (!inpAccesorio.value) { inpAccesorio.classList.add("err"); ok = false; }
      if (inpAccesorio.value === "Otro" && inpAccesorioOtro) {
        inpAccesorioOtro.classList.remove("err");
        if (!inpAccesorioOtro.value.trim()) { inpAccesorioOtro.classList.add("err"); ok = false; }
      }
    }
  }
  if (!ok) showToast("Completá los campos obligatorios", "err");
  return ok;
}

function resetForm() {
  editId = null;
  formVenta.reset();
  if (inpEditId) inpEditId.value = "";
  inpPago.value = "pendiente";
  document.querySelectorAll(".pay-btn").forEach(b => b.classList.remove("pay-btn--active"));
  const pendBtn = document.querySelector('[data-status="pendiente"]');
  if (pendBtn) pendBtn.classList.add("pay-btn--active");
  closeField(dynMarca); closeField(dynSegmento);
  closeField(dynAccesorio); closeField(dynAccesorioOtro);
  document.querySelectorAll(".inp.err, .sel.err").forEach(f => f.classList.remove("err"));
  editBanner.hidden     = true;
  formTitle.textContent = "Registrar Venta";
  btnLbl.textContent    = "Guardar Venta";
  if (inpCliente) inpCliente.focus();
}

function setupEditCancel() {
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", resetForm);
}

function enterEditMode(v) {
  editId = v.id;
  switchTab("nueva");
  if (inpCliente)   inpCliente.value   = v.nombreCliente;
  if (inpTelefono)  inpTelefono.value  = v.telefono || "";
  if (selProducto)  selProducto.value  = v.producto;
  if (inpTalle)     inpTalle.value     = v.talle || "";
  if (inpColor)     inpColor.value     = v.color || "";
  if (inpPrecio)    inpPrecio.value    = v.precio ? String(v.precio) : "";
  if (inpPago)      inpPago.value      = v.estadoPago || "pendiente";
  document.querySelectorAll(".pay-btn").forEach(b => {
    b.classList.toggle("pay-btn--active", b.dataset.status === v.estadoPago);
  });
  applyProductoLogic();
  if (v.marca    && inpMarca)    { inpMarca.value    = v.marca;    openField(dynMarca); }
  if (v.segmento && selSegmento) { selSegmento.value = v.segmento; openField(dynSegmento); }
  if (v.tipoAccesorio && inpAccesorio) {
    const opt = [...inpAccesorio.options].find(o => o.value === v.tipoAccesorio);
    if (opt) { inpAccesorio.value = v.tipoAccesorio; }
    else     { inpAccesorio.value = "Otro"; if (inpAccesorioOtro) { inpAccesorioOtro.value = v.tipoAccesorio; openField(dynAccesorioOtro); } }
    openField(dynAccesorio);
  }
  editBanner.hidden     = false;
  formTitle.textContent = "Editar Pedido";
  btnLbl.textContent    = "Actualizar Pedido";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLoading(btn, on) {
  if (btn) { btn.disabled = on; btn.classList.toggle("loading", on); }
}

// ============================================================
//  SHEETS NOTIFY
// ============================================================
function notifySheets(col, action, id, data) {
  if (!SHEETS_WEBAPP_URL) return;
  try {
    fetch(SHEETS_WEBAPP_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ col, action, id, data }) });
  } catch(e) { /* silencioso */ }
}

// ============================================================
//  BÚSQUEDA
// ============================================================
function setupSearch() {
  if (inpSearch) {
    inpSearch.addEventListener("input", e => {
      searchQuery = e.target.value.trim().toLowerCase();
      if (btnSearchClear) btnSearchClear.hidden = !searchQuery;
      renderResults();
    });
  }
  if (btnSearchClear) {
    btnSearchClear.addEventListener("click", () => {
      if (inpSearch) inpSearch.value = "";
      searchQuery = "";
      btnSearchClear.hidden = true;
      if (inpSearch) inpSearch.focus();
      renderResults();
    });
  }
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("chip--active"));
      chip.classList.add("chip--active");
      activeFilter = chip.dataset.filter;
      renderResults();
    });
  });
}

// ============================================================
//  STATS
// ============================================================
function updateStats() {
  if (statTotal)      statTotal.textContent      = allVentas.length;
  if (statPending)    statPending.textContent    = allVentas.filter(v => v.estadoPago === "pendiente" && !v.entregado).length;
  if (statEntregados) statEntregados.textContent = allVentas.filter(v => v.entregado).length;
}

// ============================================================
//  RENDER PEDIDOS
// ============================================================
function renderResults() {
  if (!resultsEl) return;
  let list = [...allVentas];
  if (searchQuery) list = list.filter(v => v.nombreCliente?.toLowerCase().includes(searchQuery));
  if (activeFilter === "pendiente") list = list.filter(v => v.estadoPago === "pendiente" && !v.entregado);
  else if (activeFilter === "pagado") list = list.filter(v => v.estadoPago === "pagado" && !v.entregado);

  resultsEl.innerHTML = "";
  if (list.length === 0) {
    const msg = searchQuery
      ? `Sin resultados para "<strong>${esc(searchQuery)}</strong>"`
      : activeFilter !== "todos" ? "No hay pedidos con este estado."
      : "Buscá por nombre para ver los pedidos";
    resultsEl.innerHTML = `<div class="empty"><div class="empty-ico">${searchQuery ? "😕" : "🔍"}</div><p>${msg}</p></div>`;
    return;
  }
  const cnt = document.createElement("p");
  cnt.className = "results-count";
  cnt.innerHTML = `<strong>${list.length}</strong> pedido${list.length !== 1 ? "s" : ""}`;
  resultsEl.appendChild(cnt);
  list.forEach(v => resultsEl.appendChild(buildCard(v)));
}

function buildCard(v) {
  const card = document.createElement("div");
  const statusCls = v.entregado ? "card-delivered" : v.estadoPago === "pagado" ? "card-paid" : "card-pending";
  card.className = `card ${statusCls}`;
  card.setAttribute("role", "listitem");

  const badge = v.entregado
    ? `<span class="badge badge--delivered"><span class="badge-dot"></span>Entregado</span>`
    : v.estadoPago === "pagado"
      ? `<span class="badge badge--paid"><span class="badge-dot"></span>Pagado</span>`
      : `<span class="badge badge--pending"><span class="badge-dot"></span>Pendiente</span>`;

  let prod = esc(v.producto || "");
  if (v.segmento)      prod += ` · ${esc(v.segmento)}`;
  if (v.marca)         prod += ` · ${esc(v.marca)}`;
  if (v.tipoAccesorio) prod += ` · ${esc(v.tipoAccesorio)}`;

  let talleCol = esc(v.talle || "");
  if (v.color) talleCol += ` · ${esc(v.color)}`;

  let actions = "";
  if (!v.entregado) {
    if (v.estadoPago === "pendiente")
      actions += `<button class="act-btn act-btn--pay" data-action="pay" data-id="${v.id}">💳 Cobrar</button>`;
    else
      actions += `<button class="act-btn" data-action="unpay" data-id="${v.id}">↩ Revertir</button>`;
    actions += `<button class="act-btn act-btn--deliver" data-action="deliver" data-id="${v.id}">📦 Entregar</button>`;
  } else {
    actions += `<button class="act-btn" data-action="undeliver" data-id="${v.id}" style="flex:1">↩ Deshacer entrega</button>`;
  }
  actions += `<button class="act-btn act-btn--edit" data-action="edit" data-id="${v.id}" title="Editar">✏️</button>`;
  actions += `<button class="act-btn act-btn--del"  data-action="delete" data-id="${v.id}" title="Eliminar">🗑</button>`;

  const phoneRow = v.telefono ? `<div class="card-phone">📞 ${esc(v.telefono)}</div>` : "";

  card.innerHTML = `
    <div class="card-head">
      <div>
        <span class="card-name">${esc(v.nombreCliente || "")}</span>
        ${phoneRow}
      </div>
      ${badge}
    </div>
    <div class="card-body">
      <div class="detail"><span class="detail-lbl">Producto</span><span class="detail-val">${prod}</span></div>
      <div class="detail"><span class="detail-lbl">Talle${v.color ? " · Color" : ""}</span><span class="detail-val">${talleCol}</span></div>
      <div class="detail"><span class="detail-lbl">Precio</span><span class="detail-val detail-val--price">$${fmtPrice(v.precio)}</span></div>
    </div>
    <div class="card-actions">${actions}</div>
    <div class="card-time">${fmtTime(v.fechaCreacion)}</div>`;

  card.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); handleCardAction(btn.dataset.action, btn.dataset.id, v); });
  });
  return card;
}

async function handleCardAction(action, id, v) {
  try {
    switch (action) {
      case "pay":
        await storagePedidos.update(id, { estadoPago: "pagado" });
        notifySheets("ventas", "update", id, { ...v, estadoPago: "pagado", fechaCreacion: toISO(v.fechaCreacion) });
        showToast(`✓ ${v.nombreCliente} — marcado como Pagado`, "ok");
        break;
      case "unpay":
        await storagePedidos.update(id, { estadoPago: "pendiente" });
        notifySheets("ventas", "update", id, { ...v, estadoPago: "pendiente", fechaCreacion: toISO(v.fechaCreacion) });
        showToast("↩ Revertido a Pendiente");
        break;
      case "deliver":
        await storagePedidos.update(id, { entregado: true });
        notifySheets("ventas", "update", id, { ...v, entregado: true, fechaCreacion: toISO(v.fechaCreacion) });
        showToast(`📦 Entregado a ${v.nombreCliente}`, "ok");
        break;
      case "undeliver":
        await storagePedidos.update(id, { entregado: false });
        notifySheets("ventas", "update", id, { ...v, entregado: false, fechaCreacion: toISO(v.fechaCreacion) });
        showToast("↩ Entrega deshecha");
        break;
      case "edit":
        enterEditMode(v);
        break;
      case "delete":
        if (confirm(`¿Eliminar el pedido de ${v.nombreCliente}?`)) {
          await storagePedidos.remove(id);
          notifySheets("ventas", "delete", id, null);
          showToast("🗑 Pedido eliminado");
        }
        break;
    }
  } catch (err) {
    console.error(err);
    showToast("Error al actualizar. Intentá de nuevo.", "err");
  }
}

// ============================================================
//  PRODUCTOS ENTREGADOS
// ============================================================
function renderEntregados() {
  if (!entregadosEl) return;
  const list = allVentas.filter(v => v.entregado);
  entregadosEl.innerHTML = "";

  if (list.length === 0) {
    entregadosEl.innerHTML = `<div class="empty"><div class="empty-ico">📦</div><p>Todavía no se entregó ningún producto</p></div>`;
    return;
  }
  const cnt = document.createElement("p");
  cnt.className = "results-count";
  cnt.innerHTML = `<strong>${list.length}</strong> producto${list.length !== 1 ? "s" : ""} entregado${list.length !== 1 ? "s" : ""}`;
  entregadosEl.appendChild(cnt);
  list.forEach(v => entregadosEl.appendChild(buildEntregadoCard(v)));
}

function buildEntregadoCard(v) {
  const card = document.createElement("div");
  card.className = "card card-delivered";
  card.setAttribute("role", "listitem");

  let prod = esc(v.producto || "");
  if (v.segmento)      prod += ` · ${esc(v.segmento)}`;
  if (v.marca)         prod += ` · ${esc(v.marca)}`;
  if (v.tipoAccesorio) prod += ` · ${esc(v.tipoAccesorio)}`;
  if (v.talle)         prod += ` T:${esc(v.talle)}`;

  const phoneRow   = v.telefono ? `<div class="card-phone">📞 ${esc(v.telefono)}</div>` : "";
  const pagoLabel  = v.estadoPago === "pagado" ? "✓ Pagado" : "⏳ Pendiente";

  card.innerHTML = `
    <div class="card-head">
      <div>
        <span class="card-name">${esc(v.nombreCliente || "")}</span>
        ${phoneRow}
      </div>
      <span class="badge badge--delivered"><span class="badge-dot"></span>Entregado</span>
    </div>
    <div class="card-body">
      <div class="detail"><span class="detail-lbl">Producto</span><span class="detail-val">${prod}</span></div>
      <div class="detail"><span class="detail-lbl">Precio</span><span class="detail-val detail-val--price">$${fmtPrice(v.precio)}</span></div>
      <div class="detail"><span class="detail-lbl">Pago</span><span class="detail-val">${pagoLabel}</span></div>
    </div>
    <div class="card-actions">
      <button class="act-btn" data-action="undeliver" data-id="${v.id}" style="flex:1">↩ Deshacer entrega</button>
      <button class="act-btn act-btn--del" data-action="delete" data-id="${v.id}" title="Eliminar">🗑</button>
    </div>
    <div class="card-time">${fmtTime(v.fechaCreacion)}</div>`;

  card.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); handleCardAction(btn.dataset.action, btn.dataset.id, v); });
  });
  return card;
}

// ============================================================
//  RESUMEN DIARIO
// ============================================================
function renderDailySummary() {
  if (!resumenEl) return;
  resumenEl.innerHTML = "";
  if (allVentas.length === 0) {
    resumenEl.innerHTML = `<div class="empty"><div class="empty-ico">📅</div><p>Todavía no hay pedidos registrados</p></div>`;
    return;
  }
  const groups = {};
  allVentas.forEach(v => {
    const d   = v.fechaCreacion instanceof Date ? v.fechaCreacion : new Date(v.fechaCreacion);
    const key = dateKey(d);
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  });

  Object.keys(groups).sort((a,b) => b.localeCompare(a)).forEach(key => {
    const pedidos = groups[key];
    const [y,m,d] = key.split("-").map(Number);
    const titulo = new Date(y,m-1,d).toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
    const cap = titulo.charAt(0).toUpperCase() + titulo.slice(1);

    const total     = pedidos.reduce((s,v) => s+(v.precio||0), 0);
    const cobrado   = pedidos.filter(v => v.estadoPago==="pagado"||v.entregado).reduce((s,v)=>s+(v.precio||0),0);
    const pendiente = pedidos.filter(v => v.estadoPago==="pendiente"&&!v.entregado).reduce((s,v)=>s+(v.precio||0),0);

    const rows = pedidos.map(v => {
      let prod = esc(v.producto || "");
      if (v.segmento)      prod += ` · ${esc(v.segmento)}`;
      if (v.marca)         prod += ` · ${esc(v.marca)}`;
      if (v.tipoAccesorio) prod += ` · ${esc(v.tipoAccesorio)}`;
      if (v.talle)         prod += ` T:${esc(v.talle)}`;
      const bc = v.entregado ? "row-badge--delivered" : v.estadoPago==="pagado" ? "row-badge--paid" : "row-badge--pending";
      const bt = v.entregado ? "Entregado" : v.estadoPago==="pagado" ? "Pagado" : "Pendiente";
      return `<div class="day-row"><span class="row-name">${esc(v.nombreCliente||"")}</span><span class="row-product">${prod}</span><span class="row-price">$${fmtPrice(v.precio)}</span><span class="row-badge ${bc}">${bt}</span></div>`;
    }).join("");

    const g = document.createElement("div");
    g.className = "day-group";
    g.setAttribute("role","listitem");
    g.innerHTML = `
      <div class="day-header"><span class="day-title">📅 ${cap}</span><span class="day-count">${pedidos.length} pedido${pedidos.length!==1?"s":""}</span></div>
      <div class="day-rows">${rows}</div>
      <div class="day-footer">
        <div class="day-stat"><span class="day-stat-lbl">Total</span><span class="day-stat-val day-stat-val--default">$${fmtPrice(total)}</span></div>
        <div class="day-stat"><span class="day-stat-lbl">💰 Cobrado</span><span class="day-stat-val day-stat-val--green">$${fmtPrice(cobrado)}</span></div>
        <div class="day-stat"><span class="day-stat-lbl">⏳ Pendiente</span><span class="day-stat-val day-stat-val--amber">$${fmtPrice(pendiente)}</span></div>
      </div>`;
    resumenEl.appendChild(g);
  });
}

// ============================================================
//  SORTEOS
// ============================================================
function setupSorteoForm() {
  if (!formSorteo) return;
  formSorteo.addEventListener("submit", async e => {
    e.preventDefault();
    const ganador = inpGanador.value.trim();
    const premio  = inpPremio.value.trim();
    if (!ganador || !premio) { showToast("Completá ganador y premio", "err"); return; }
    setLoading(btnSorteo, true);
    try {
      const newId = await storageSort.add({ ganador, premio, entregado: false });
      notifySheets("sorteos", "add", newId, { ganador, premio, entregado: false, fechaCreacion: new Date().toISOString() });
      showToast(`🏆 ¡${ganador} ganó ${premio}!`, "ok");
      inpGanador.value = ""; inpPremio.value = "";
      if (inpGanador) inpGanador.focus();
    } catch (err) {
      console.error(err);
      showToast("Error al registrar sorteo.", "err");
    } finally {
      setLoading(btnSorteo, false);
    }
  });
}

function renderSorteos() {
  if (!sorteoList) return;
  sorteoList.innerHTML = "";
  if (allSorteos.length === 0) {
    sorteoList.innerHTML = `<div class="empty"><div class="empty-ico">🏆</div><p>Todavía no se registraron sorteos</p></div>`;
    return;
  }
  allSorteos.forEach(s => sorteoList.appendChild(buildSorteoCard(s)));
}

function buildSorteoCard(s) {
  const card = document.createElement("div");
  card.className = `sorteo-card${s.entregado ? " entregado" : ""}`;
  card.setAttribute("role","listitem");

  const badge  = s.entregado
    ? `<span class="sorteo-badge sorteo-badge--entregado">✓ Premio entregado</span>`
    : `<span class="sorteo-badge sorteo-badge--pendiente">⏳ Por entregar</span>`;
  const accion = s.entregado
    ? `<button class="sorteo-btn" data-action="undeliver-sorteo" data-id="${s.id}">↩ Deshacer</button>`
    : `<button class="sorteo-btn sorteo-btn--deliver" data-action="deliver-sorteo" data-id="${s.id}">🎁 Premio Entregado</button>`;

  card.innerHTML = `
    <div class="sorteo-head">
      <span class="sorteo-ganador">🏆 ${esc(s.ganador||"")}</span>${badge}
    </div>
    <div class="sorteo-premio"><span class="sorteo-trophy">🎁</span>${esc(s.premio||"")}</div>
    <div class="sorteo-actions">
      ${accion}
      <button class="sorteo-btn sorteo-btn--del" data-action="delete-sorteo" data-id="${s.id}" title="Eliminar">🗑</button>
    </div>
    <div class="sorteo-time">${fmtTime(s.fechaCreacion)}</div>`;

  card.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", e => { e.stopPropagation(); handleSorteoAction(btn.dataset.action, btn.dataset.id, s); });
  });
  return card;
}

async function handleSorteoAction(action, id, s) {
  try {
    switch (action) {
      case "deliver-sorteo":
        await storageSort.update(id, { entregado: true });
        notifySheets("sorteos", "update", id, { ...s, entregado: true, fechaCreacion: toISO(s.fechaCreacion) });
        showToast(`🎁 Premio entregado a ${s.ganador}`, "ok");
        break;
      case "undeliver-sorteo":
        await storageSort.update(id, { entregado: false });
        notifySheets("sorteos", "update", id, { ...s, entregado: false, fechaCreacion: toISO(s.fechaCreacion) });
        showToast("↩ Deshecho");
        break;
      case "delete-sorteo":
        if (confirm(`¿Eliminar el sorteo de ${s.ganador}?`)) {
          await storageSort.remove(id);
          notifySheets("sorteos", "delete", id, null);
          showToast("🗑 Sorteo eliminado");
        }
        break;
    }
  } catch (err) {
    console.error(err);
    showToast("Error al actualizar sorteo.", "err");
  }
}

// ============================================================
//  SORTEO EN VIVO — ruleta animada
// ============================================================
function setupSorteoVivo() {
  if (!btnVivoAdd) return;

  let participantes = [];
  let spinTimer     = null;

  // ── Agregar participante ──
  function addParticipante() {
    const nombre = inpVivoNombre.value.trim();
    if (!nombre) return;
    participantes.push(nombre);
    inpVivoNombre.value = "";
    renderParticipantes();
    inpVivoNombre.focus();
  }

  btnVivoAdd.addEventListener("click", addParticipante);
  inpVivoNombre.addEventListener("keypress", e => {
    if (e.key === "Enter") { e.preventDefault(); addParticipante(); }
  });

  // ── Limpiar todo ──
  if (btnLimpiarVivo) {
    btnLimpiarVivo.addEventListener("click", () => {
      participantes = [];
      renderParticipantes();
      resetVivoUI();
    });
  }

  // ── Renderizar chips ──
  function renderParticipantes() {
    if (!vivoLista) return;
    if (participantes.length === 0) {
      vivoLista.innerHTML = `<p class="vivo-empty-hint">Agregá al menos 2 participantes para sortear</p>`;
    } else {
      vivoLista.innerHTML = participantes.map((n, i) => `
        <div class="vivo-chip">
          ${esc(n)}
          <button class="vivo-chip-del" data-idx="${i}" title="Quitar">×</button>
        </div>`).join("");
      vivoLista.querySelectorAll(".vivo-chip-del").forEach(btn => {
        btn.addEventListener("click", () => {
          participantes.splice(Number(btn.dataset.idx), 1);
          renderParticipantes();
          if (participantes.length < 2) resetVivoUI();
        });
      });
    }
    if (vivoCount) vivoCount.textContent = participantes.length;
    if (btnVivoStart) btnVivoStart.disabled = participantes.length < 2;
  }

  // ── Resetear UI ──
  function resetVivoUI() {
    if (vivoRuletaBox)  vivoRuletaBox.hidden  = true;
    if (vivoGanadorBox) vivoGanadorBox.hidden = true;
    if (spinTimer)      clearTimeout(spinTimer);
    if (btnVivoStart)   setLoading(btnVivoStart, false);
  }

  // ── Iniciar sorteo ──
  if (btnVivoStart) {
    btnVivoStart.addEventListener("click", () => {
      if (participantes.length < 2) return;
      setLoading(btnVivoStart, true);

      // Ocultar resultado anterior
      if (vivoGanadorBox) vivoGanadorBox.hidden = true;

      // Mostrar ruleta
      if (vivoRuletaBox)  vivoRuletaBox.hidden  = false;
      if (vivoRuletaTot)  vivoRuletaTot.textContent = participantes.length;

      // Elegir ganador desde el inicio (aleatorio real)
      const ganador = participantes[Math.floor(Math.random() * participantes.length)];

      const duracion = 3000;
      const inicio   = Date.now();

      function spin() {
        const transcurrido = Date.now() - inicio;
        const progreso     = Math.min(transcurrido / duracion, 1);

        if (progreso >= 1) {
          // Revelar ganador
          if (vivoRuletaBox)  vivoRuletaBox.hidden  = true;
          if (vivoGanadorBox) {
            vivoGanadorBox.hidden = false;
            // Forzar re-animación
            vivoGanadorBox.style.animation = "none";
            void vivoGanadorBox.offsetHeight;
            vivoGanadorBox.style.animation = "";
          }
          if (vivoGanadorNom) vivoGanadorNom.textContent = ganador;
          setLoading(btnVivoStart, false);
          showToast(`🏆 ¡${ganador} es el ganador!`, "ok");
          return;
        }

        // Mostrar nombre aleatorio durante el spin
        if (vivoRuletaNom) {
          vivoRuletaNom.textContent = participantes[Math.floor(Math.random() * participantes.length)];
        }

        // Velocidad: arranca rápido (40ms) y frena progresivamente hasta 380ms
        const delay = 40 + Math.pow(progreso, 2) * 340;
        spinTimer = setTimeout(spin, delay);
      }

      spin();
    });
  }

  // ── Repetir con los mismos participantes ──
  if (btnRepetirVivo) {
    btnRepetirVivo.addEventListener("click", () => {
      if (vivoGanadorBox) vivoGanadorBox.hidden = true;
      if (btnVivoStart) btnVivoStart.click();
    });
  }

  // ── Nuevo sorteo (vaciar) ──
  if (btnResetVivo) {
    btnResetVivo.addEventListener("click", () => {
      participantes = [];
      renderParticipantes();
      resetVivoUI();
      if (inpVivoNombre) inpVivoNombre.focus();
    });
  }
}

// ============================================================
//  PDF — reporte del día actual
// ============================================================
function generatePDF() {
  const today   = new Date();
  const key     = dateKey(today);
  const ventas  = allVentas.filter(v => dateKey(v.fechaCreacion instanceof Date ? v.fechaCreacion : new Date(v.fechaCreacion)) === key);
  const sorteos = allSorteos.filter(s => dateKey(s.fechaCreacion instanceof Date ? s.fechaCreacion : new Date(s.fechaCreacion)) === key);

  if (ventas.length === 0 && sorteos.length === 0) {
    showToast("No hay ventas registradas hoy para exportar", "err");
    return;
  }

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) { showToast("Habilitá los popups del navegador para generar el PDF", "err"); return; }
  win.document.write(buildPDFHtml(ventas, sorteos, today));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 500);
}

function buildPDFHtml(ventas, sorteos, date) {
  const titulo = date.toLocaleDateString("es-AR", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
  const cap    = titulo.charAt(0).toUpperCase() + titulo.slice(1);

  const total     = ventas.reduce((s,v) => s+(v.precio||0), 0);
  const cobrado   = ventas.filter(v => v.estadoPago==="pagado"||v.entregado).reduce((s,v)=>s+(v.precio||0),0);
  const pendiente = ventas.filter(v => v.estadoPago==="pendiente"&&!v.entregado).reduce((s,v)=>s+(v.precio||0),0);
  const nPending  = ventas.filter(v => v.estadoPago==="pendiente"&&!v.entregado).length;
  const nPaid     = ventas.filter(v => v.estadoPago==="pagado"&&!v.entregado).length;
  const nDel      = ventas.filter(v => v.entregado).length;

  const rows = ventas.map(v => {
    let prod = v.producto || "";
    if (v.segmento)      prod += ` · ${v.segmento}`;
    if (v.marca)         prod += ` · ${v.marca}`;
    if (v.tipoAccesorio) prod += ` · ${v.tipoAccesorio}`;
    if (v.talle)         prod += `  T:${v.talle}`;
    if (v.color)         prod += ` (${v.color})`;

    const estado = v.entregado ? "Entregado" : v.estadoPago === "pagado" ? "Pagado" : "Pendiente";
    const eBg    = v.entregado ? "#dbeafe" : v.estadoPago === "pagado" ? "#dcfce7" : "#fee2e2";
    const eColor = v.entregado ? "#1e40af" : v.estadoPago === "pagado" ? "#166534" : "#991b1b";
    const d      = v.fechaCreacion instanceof Date ? v.fechaCreacion : new Date(v.fechaCreacion);
    const hora   = d.toLocaleTimeString("es-AR", {hour:"2-digit", minute:"2-digit"});

    return `<tr>
      <td><strong>${v.nombreCliente||""}</strong>${v.telefono?`<br><small style="color:#666">📞 ${v.telefono}</small>`:""}</td>
      <td>${prod}</td>
      <td style="text-align:right;font-weight:700;color:#166534">$${fmtPrice(v.precio)}</td>
      <td style="text-align:center"><span style="background:${eBg};color:${eColor};padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">${estado}</span></td>
      <td style="text-align:center;color:#666;font-size:12px">${hora}</td>
    </tr>`;
  }).join("");

  const sorteoRows = sorteos.map(s => `<tr>
    <td>🏆 ${s.ganador||""}</td>
    <td>${s.premio||""}</td>
    <td style="text-align:center"><span style="background:${s.entregado?"#dbeafe":"#f3e8ff"};color:${s.entregado?"#1e40af":"#6d28d9"};padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700">${s.entregado?"Entregado":"Pendiente"}</span></td>
  </tr>`).join("");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Reporte ${cap}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:28px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px;padding-bottom:14px;border-bottom:3px solid #8DC63F}
.brand{font-size:24px;font-weight:900;color:#2BBFBF}.brand span{color:#8DC63F}
.sub{font-size:12px;color:#777;margin-top:4px}
.date-block{text-align:right;font-size:13px;color:#555}
.date-block strong{display:block;font-size:15px;color:#111;margin-bottom:2px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
.stat{background:#f8fafc;border-radius:8px;padding:12px;text-align:center;border:1px solid #e5e7eb}
.stat-n{font-size:26px;font-weight:900;color:#111}.stat-l{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
h2{font-size:14px;font-weight:800;color:#2BBFBF;border-left:4px solid #8DC63F;padding-left:10px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;margin-bottom:22px;font-size:12px}
th{background:#8DC63F;color:#fff;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
tr:nth-child(even) td{background:#fafafa}
.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}
.tbox{padding:11px 14px;border-radius:8px;border:1px solid #e5e7eb}
.tbox.all{background:#f1f5f9}.tbox.cob{background:#dcfce7}.tbox.pen{background:#fee2e2}
.tl{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#555}
.tv{font-size:20px;font-weight:900;color:#111;margin-top:3px}
.footer{margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#aaa;text-align:center}
@media print{body{padding:14px}}
</style></head><body>
<div class="hdr">
  <div><div class="brand">Central <span>Variedades</span></div><div class="sub">Reporte de Ventas en Vivo</div></div>
  <div class="date-block"><strong>${cap}</strong>Generado: ${new Date().toLocaleString("es-AR")}</div>
</div>
<div class="stats">
  <div class="stat"><div class="stat-n">${ventas.length}</div><div class="stat-l">Total ventas</div></div>
  <div class="stat"><div class="stat-n" style="color:#dc2626">${nPending}</div><div class="stat-l">Pendientes</div></div>
  <div class="stat"><div class="stat-n" style="color:#16a34a">${nPaid}</div><div class="stat-l">Pagados</div></div>
  <div class="stat"><div class="stat-n" style="color:#1d4ed8">${nDel}</div><div class="stat-l">Entregados</div></div>
</div>
${ventas.length > 0 ? `
<h2>📋 Detalle de Pedidos</h2>
<table>
  <thead><tr><th>Cliente</th><th>Producto</th><th>Precio</th><th>Estado</th><th>Hora</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div class="tbox all"><div class="tl">Total general</div><div class="tv">$${fmtPrice(total)}</div></div>
  <div class="tbox cob"><div class="tl">💰 Cobrado</div><div class="tv">$${fmtPrice(cobrado)}</div></div>
  <div class="tbox pen"><div class="tl">⏳ Pendiente</div><div class="tv">$${fmtPrice(pendiente)}</div></div>
</div>` : `<p style="text-align:center;color:#999;padding:30px">No hay pedidos registrados hoy.</p>`}
${sorteos.length > 0 ? `
<h2 style="margin-top:24px">🏆 Sorteos del Día</h2>
<table>
  <thead><tr><th>Ganador</th><th>Premio</th><th>Estado</th></tr></thead>
  <tbody>${sorteoRows}</tbody>
</table>` : ""}
<div class="footer">Central Variedades — Ventas en Vivo &nbsp;·&nbsp; ${new Date().toLocaleDateString("es-AR")}</div>
</body></html>`;
}

// ============================================================
//  TOAST
// ============================================================
let toastTimer;
function showToast(msg, type = "") {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.className   = `toast show ${type}`;
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

// ============================================================
//  UTILS
// ============================================================
function parsePrecio(val) {
  const clean = String(val ?? "").trim().replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function fmtPrice(n) {
  return new Intl.NumberFormat("es-AR").format(n ?? 0);
}

function fmtTime(date) {
  if (!date) return "";
  const d    = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - d;
  if (diff < 60_000)     return "Hace un momento";
  if (diff < 3_600_000)  return `Hace ${Math.floor(diff/60_000)} min`;
  if (diff < 86_400_000) return `Hace ${Math.floor(diff/3_600_000)} h`;
  return d.toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});
}

function dateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function toISO(d) {
  if (!d) return new Date().toISOString();
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

// ============================================================
//  START
// ============================================================
boot();
