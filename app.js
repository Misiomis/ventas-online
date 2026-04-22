// ============================================================
//  Central Variedades — Gestión de Ventas en Vivo
//  app.js — CONFIGURACIÓN FINAL PARA EL JUEVES
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── FIREBASE CONFIG (CONFIGURADA POR BRAULIO) ──────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyC185Z2bilgkUNmekIs1DeChF-tEmIgLC0", 
  authDomain:        "ventas-online-f.firebaseapp.com",
  projectId:         "ventas-online-f",
  storageBucket:     "ventas-online-f.appspot.com",
  messagingSenderId: "145548756840",
  appId:             "1:145548756840:web:ec46acb1c0139626838dd"
};
// ────────────────────────────────────────────────────────────

const USE_FIREBASE = true; // Forzamos el uso de Firebase ya que tenemos la key

// ============================================================
//  STORAGE ABSTRACTION — misma API para Firebase y localStorage
// ============================================================

class LocalDB {
  constructor(key) {
    this._key  = key;
    this._subs = new Set();
  }
  _load() {
    try {
      return (JSON.parse(localStorage.getItem(this._key)) || []).map(v => ({
        ...v, fechaCreacion: v.fechaCreacion ? new Date(v.fechaCreacion) : new Date()
      }));
    } catch { return []; }
  }
  _save(items) {
    localStorage.setItem(this._key, JSON.stringify(items));
    this._notify(items);
  }
  _notify(items) {
    const parsed = items.map(v => ({ ...v, fechaCreacion: v.fechaCreacion instanceof Date ? v.fechaCreacion : new Date(v.fechaCreacion) }));
    this._subs.forEach(cb => cb(parsed));
  }
  subscribe(cb) {
    this._subs.add(cb);
    cb(this._load());
    return () => this._subs.delete(cb);
  }
  async add(data) {
    const items = this._load();
    items.unshift({ ...data, id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, fechaCreacion: new Date() });
    this._save(items);
  }
  async update(id, changes) {
    const items = this._load();
    const i = items.findIndex(v => v.id === id);
    if (i !== -1) { items[i] = { ...items[i], ...changes }; this._save(items); }
  }
  async remove(id) { this._save(this._load().filter(v => v.id !== id)); }
}

class FirestoreDB {
  constructor(db, col) {
    this._db  = db;
    this._col = col;
  }
  subscribe(cb) {
    const q = query(collection(this._db, this._col), orderBy("fechaCreacion", "desc"));
    return onSnapshot(q, snap => {
      cb(snap.docs.map(d => ({
        id: d.id, ...d.data(),
        fechaCreacion: d.data().fechaCreacion?.toDate() ?? new Date()
      })));
    }, err => {
      console.error("Firestore:", err);
      showToast("Error de conexión con Firebase", "err");
    });
  }
  async add(data) {
    await addDoc(collection(this._db, this._col), { ...data, fechaCreacion: serverTimestamp() });
  }
  async update(id, changes) { await updateDoc(doc(this._db, this._col, id), changes); }
  async remove(id) { await deleteDoc(doc(this._db, this._col, id)); }
}

// Inicializar
let storagePedidos, storageSort;
if (USE_FIREBASE) {
  try {
    const app = initializeApp(FIREBASE_CONFIG);
    const db  = getFirestore(app);
    storagePedidos = new FirestoreDB(db, "ventas"); // Cambiado a "ventas" para coincidir con tu base
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
let allVentas  = [];
let allSorteos = [];
let editId     = null;
let activeFilter  = "todos";
let searchQuery   = "";

// ============================================================
//  DOM
// ============================================================
const $ = id => document.getElementById(id);

const formVenta        = $("form-venta");
const inpCliente       = $("inp-cliente");
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

const statTotal   = $("stat-total");
const statPending = $("stat-pending");
const statSorteos = $("stat-sorteos");

const inpSearch      = $("inp-search");
const btnSearchClear = $("btn-search-clear");
const resultsEl      = $("results");
const resumenEl      = $("resumen-container");

const formSorteo  = $("form-sorteo");
const inpGanador  = $("inp-ganador");
const inpPremio   = $("inp-premio");
const btnSorteo   = $("btn-sorteo");
const sorteoList  = $("sorteo-list");
const toastEl     = $("toast");

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

  storagePedidos.subscribe(ventas => {
    allVentas = ventas;
    updateStats();
    renderResults();
    renderDailySummary();
  });

  storageSort.subscribe(sorteos => {
    allSorteos = sorteos;
    updateStats();
    renderSorteos();
  });

  if(inpCliente) inpCliente.focus();
}

function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  document.querySelectorAll(".panel").forEach(p => {
    p.classList.toggle("active", p.id === `panel-${tabName}`);
  });
  if (tabName === "buscar")  setTimeout(() => inpSearch.focus(), 80);
  if (tabName === "sorteo")  setTimeout(() => inpGanador.focus(), 80);
}

function setupProductoChange() {
  if(selProducto) selProducto.addEventListener("change", applyProductoLogic);
}

function applyProductoLogic() {
  const p = selProducto.value;
  closeField(dynMarca); closeField(dynSegmento);
  closeField(dynAccesorio); closeField(dynAccesorioOtro);
  if (p === "Zapatillas") {
    openField(dynMarca);
  } else if (p === "Abrigo" || p === "Remera") {
    openField(dynSegmento);
  } else if (p === "Accesorio") {
    openField(dynAccesorio);
  }
}

function setupAccesorioOtro() {
  if(inpAccesorio) {
    inpAccesorio.addEventListener("change", () => {
      if (inpAccesorio.value === "Otro") {
        openField(dynAccesorioOtro);
        inpAccesorioOtro.focus();
      } else {
        closeField(dynAccesorioOtro);
      }
    });
  }
}

function openField(el)  { if(el) el.classList.add("open"); }
function closeField(el) { if(el) el.classList.remove("open"); }

function setupPayToggle() {
  document.querySelectorAll(".pay-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pay-btn").forEach(b => b.classList.remove("pay-btn--active"));
      btn.classList.add("pay-btn--active");
      inpPago.value = btn.dataset.status;
    });
  });
}

function setupForm() {
  if(formVenta) {
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

      if (selProducto.value === "Zapatillas") datos.marca = inpMarca.value.trim();
      if (selProducto.value === "Abrigo" || selProducto.value === "Remera") datos.segmento = selSegmento.value;
      if (selProducto.value === "Accesorio") {
        datos.tipoAccesorio = inpAccesorio.value === "Otro" ? inpAccesorioOtro.value.trim() : inpAccesorio.value;
      }

      try {
        if (editId) {
          await storagePedidos.update(editId, datos);
          showToast(`✓ Actualizado`, "ok");
        } else {
          await storagePedidos.add(datos);
          showToast(`✓ Venta guardada`, "ok");
        }
        resetForm();
      } catch (err) {
        showToast("Error al guardar.", "err");
      } finally {
        setLoading(btnGuardar, false);
      }
    });
  }
}

function validateForm() {
  let ok = true;
  [inpCliente, selProducto, inpTalle, inpPrecio].forEach(f => {
    if(f) {
        f.classList.remove("err");
        if (!f.value.trim()) { f.classList.add("err"); ok = false; }
    }
  });
  return ok;
}

function resetForm() {
  editId = null;
  formVenta.reset();
  inpPago.value = "pendiente";
  editBanner.hidden = true;
  formTitle.textContent = "Registrar Venta";
  btnLbl.textContent = "Guardar Venta";
  applyProductoLogic();
}

function setupEditCancel() {
  if(btnCancelEdit) btnCancelEdit.addEventListener("click", resetForm);
}

function enterEditMode(v) {
  editId = v.id;
  switchTab("nueva");
  inpCliente.value = v.nombreCliente;
  selProducto.value = v.producto;
  inpTalle.value = v.talle || "";
  inpColor.value = v.color || "";
  inpPrecio.value = v.precio || "";
  inpPago.value = v.estadoPago;
  applyProductoLogic();
  editBanner.hidden = false;
  formTitle.textContent = "Editar Pedido";
  btnLbl.textContent = "Actualizar";
}

function setLoading(btn, on) {
  if(btn) {
    btn.disabled = on;
    btn.classList.toggle("loading", on);
  }
}

function setupSearch() {
  if(inpSearch) {
    inpSearch.addEventListener("input", e => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderResults();
    });
  }
}

function updateStats() {
  if(statTotal) statTotal.textContent = allVentas.length;
  if(statPending) statPending.textContent = allVentas.filter(v => v.estadoPago === "pendiente").length;
  if(statSorteos) statSorteos.textContent = allSorteos.length;
}

function renderResults() {
  let list = [...allVentas];
  if (searchQuery) list = list.filter(v => v.nombreCliente.toLowerCase().includes(searchQuery));
  resultsEl.innerHTML = "";
  list.forEach(v => resultsEl.appendChild(buildCard(v)));
}

function buildCard(v) {
  const card = document.createElement("div");
  card.className = `card ${v.estadoPago === 'pagado' ? 'card-paid' : 'card-pending'}`;
  card.innerHTML = `
    <div class="card-head"><b>${esc(v.nombreCliente)}</b></div>
    <div class="card-body">${esc(v.producto)} - $${fmtPrice(v.precio)}</div>
    <div class="card-actions">
        <button class="act-btn" onclick="this.dataset.id='${v.id}'">✏️ Editar</button>
    </div>
  `;
  card.querySelector('.act-btn').onclick = () => enterEditMode(v);
  return card;
}

function renderDailySummary() {
  resumenEl.innerHTML = "";
  // Lógica de resumen diario simplificada para el render
  const total = allVentas.reduce((s, v) => s + (v.precio || 0), 0);
  resumenEl.innerHTML = `<div class="day-group"><h3>Total Acumulado: $${fmtPrice(total)}</h3></div>`;
}

function setupSorteoForm() {
  if(formSorteo) {
    formSorteo.addEventListener("submit", async e => {
      e.preventDefault();
      await storageSort.add({ ganador: inpGanador.value, premio: inpPremio.value });
      formSorteo.reset();
    });
  }
}

function renderSorteos() {
  sorteoList.innerHTML = allSorteos.map(s => `<li>${esc(s.ganador)} - ${esc(s.premio)}</li>`).join("");
}

function showToast(msg, type = "") {
  if(toastEl) {
      toastEl.textContent = msg;
      toastEl.className = `toast show ${type}`;
      setTimeout(() => toastEl.classList.remove("show"), 3000);
  }
}

function parsePrecio(val) { return parseFloat(String(val).replace(/\./g, "").replace(",", ".")) || 0; }
function esc(str) { return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;"); }
function fmtPrice(n) { return new Intl.NumberFormat("es-AR").format(n || 0); }

boot();