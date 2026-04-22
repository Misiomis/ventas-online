// ============================================================
//  Central Variedades — Sync en Tiempo Real
//  Google Apps Script — Web App + Trigger periódico
//
//  SETUP (una sola vez):
//  1. Seleccioná todo (Ctrl+A) y pegá este código
//  2. Guardá con Ctrl+S  →  dale un nombre al proyecto
//  3. Clic "Implementar" → "Nueva implementación"
//       • Tipo:           Aplicación web
//       • Ejecutar como:  Yo (tu cuenta Google)
//       • Acceso:         Cualquier usuario
//  4. Clic "Implementar" → aceptá permisos → copiá la URL
//  5. Pegá esa URL en app.js → const SHEETS_WEBAPP_URL = "..."
//  6. Ejecutá setupTrigger() para sync automático cada 5 min
// ============================================================

// ─── CONFIGURACIÓN ─────────────────────────────────────────
var SPREADSHEET_ID = "1d263ewAQkCeAubXwn-xg9R2iEgFIFSIN-DY_qd2kWeQ";
var SHEET_VENTAS   = "Ventas";
var SHEET_SORTEOS  = "Sorteos";

// Credenciales Firebase (para syncNow completo)
var SA_EMAIL       = "firebase-adminsdk-fbsvc@ventas-online-f.iam.gserviceaccount.com";
var PROJECT_ID     = "ventas-online-f";
var SA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDHrxawFLpbSS8v\n0a6j/u7We3PIwyEdSlJ8fq2RXwtoLvx8eVi1XJCE5mKw/ia1tssf0M1N5RElZPVl\ncxEU4bsFu4IHPPcXp64lM7fv30xGuGdTlmleKLf+UzdNkhvXRd9St+xPl1SvyNaG\nI4wRBk8G84BCG/5knHmK8lw5B42s0BzDLRObgQYrOADAC/D+/gKr1h8Qas9wbGJ8\nkL3HwdkS9hYgNwRHNSpxBddwTxfIXwRapJ0BuUFlnifl5M7c1So1cl3OnugTbSiG\nMX6+M/0WiJTqw0oD+ZyWT4rvq+PePocFPu7O/0x4nUM9YUC07lweKwowMKllbb78\njbJ9rynjAgMBAAECggEARMRJ6mrBANXzv6KU45pUUx3hsmZsnYMuY/xWNsWGDqN7\nxTwe7hpKFNKocy6bUyH30uWcBnLYFEov7neRjuDsAN3hui9nIsjWwq4Mbrm2MXao\n8tLOR6R7NMUguwCRwPGppnl7kq9ZdU4Tfs94GZbUGV87MMkmMyzl+JFdbDBrPHM1\ncE7bCYrzditxs0XOrL0Y+c5WzMkchPUPVYNOc4pywUsEWHgBYAb3aQRpZuzUGq7M\nWHSenZOuUm/qK6WY7wLmj6SkEI1hWrYbYP4ylvqx1xezbGC+ZLLcNxpGa69nUlD3\n7Htb9k23BjC6kzDeyBalTOUylU6QprV5erqbjJg6jQKBgQDkdeuoZnz/GyhTU9me\neUzpK+VhCrJIwX0Ulurupe3oI+ZB63jPPKytYN5K5QsmURPnLQVDAq8iShKaocj8\nOVyGglOpwdtxLw20ltuofYg5Mo3RCGCOXD5tZTXV3lV6GSBBxmMNkAezaraU3Dss\nUC/+VUmmJHx1swmYtnavyLNn3wKBgQDfwSWLtfubBZH9cANozIHSFM9wVC33I+Ia\njDJ+WF7gAfp69iTjne2fAaYuJszVMDt0evxscWewXfigyUT5LhHxAuWVp6BpJjk8\n94M2bm+Ji7/j92P6R3TwkaZiqFEtrHSxm+ZzsigIiCZ5tGe0EknTnNS3LTbgYCkb\nwEdQ74DOfQKBgQC0xb33nUkQzttku/d5VwANjKdO1xjlSvz/Gr/AoFkUk7txs7H/\nQUJdWkXquzvMUOFPzibYtDoCBtybsKKJOZZF9L/glj1eXN4aZDhhJRtyLtdabKeC\nXekjxK8JkIjQOSt2AFWGeM4vIKRiO7UyxiyDsda5+SrmMwnH5bEaPNQAvwKBgFKM\nPT/HyaUtbuijFH7rQ9GvX8A/Lh4JHPdSVaaLD6Vw1WnbuUxIDUwmHZrVMahM/QJC\nBTI0vF4yrPEUj9+mAXR67xxBFUr1kRRO9Bd2sqt55TdDI51IE3pVIZ8wHZLOFtcX\nfvOb/Gz5Xch0p/Wk8ZuiNk/F3IL2tvPIAgd39Hs5AoGAPjm84/d/Lw+1bKW98aFe\nmxYfRwNQoJiSCJu5jW4kIuXI0g11LiXYfzWWuJFeH+UCDjDAKGjq0hR9Fm5C2xAq\nUoWv4gZNb70offbc9G0B1Aj9Y8T6F17LnMoL792fKAchxG0G4zhDm1UEf9nGG288\nR7H4Qag8NU7stsipRaJ5Rk4=\n-----END PRIVATE KEY-----\n";
// ────────────────────────────────────────────────────────────

var H_VENTAS  = ["ID","Cliente","Producto","Tipo Accesorio","Marca","Segmento","Talle","Color","Precio ($)","Estado Pago","Entregado","Fecha y Hora"];
var H_SORTEOS = ["ID","Ganador","Premio","Estado","Fecha y Hora"];


// ============================================================
//  WEB APP — recibe eventos en tiempo real desde la app
// ============================================================
function doPost(e) {
  try {
    var p      = JSON.parse(e.postData.contents);
    var col    = p.col;      // "pedidos" | "sorteos"
    var action = p.action;   // "add" | "update" | "delete"
    var id     = p.id;
    var data   = p.data || {};

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    if      (col === "pedidos") handlePedido_(ss, action, id, data);
    else if (col === "sorteos") handleSorteo_(ss, action, id, data);

    return json_({ok: true});
  } catch (err) {
    Logger.log("doPost error: " + err);
    return json_({ok: false, error: err.message});
  }
}

function doGet() {
  return ContentService.createTextOutput("Central Variedades Sync — OK ✓");
}


// ============================================================
//  PEDIDOS — alta / baja / modificación de fila
// ============================================================
function handlePedido_(ss, action, id, d) {
  var sheet = sheet_(ss, SHEET_VENTAS, H_VENTAS);
  if (action === "delete") { del_(sheet, id); return; }

  var row = [
    id,
    d.nombreCliente || "",
    d.producto      || "",
    d.tipoAccesorio || "",
    d.marca         || "",
    d.segmento      || "",
    d.talle         || "",
    d.color         || "",
    d.precio        || 0,
    d.estadoPago    || "pendiente",
    d.entregado ? "Sí" : "No",
    d.fechaCreacion ? new Date(d.fechaCreacion) : new Date()
  ];

  var r = find_(sheet, id);
  if (r > 0) {
    sheet.getRange(r, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    r = sheet.getLastRow();
  }
  colorPedido_(sheet, r, d.estadoPago, d.entregado);
  sheet.getRange(r, 8).setNumberFormat("$#,##0.00");
}


// ============================================================
//  SORTEOS — alta / baja / modificación de fila
// ============================================================
function handleSorteo_(ss, action, id, d) {
  var sheet = sheet_(ss, SHEET_SORTEOS, H_SORTEOS);
  if (action === "delete") { del_(sheet, id); return; }

  var row = [
    id,
    d.ganador  || "",
    d.premio   || "",
    d.entregado ? "Entregado ✓" : "Pendiente",
    d.fechaCreacion ? new Date(d.fechaCreacion) : new Date()
  ];

  var r = find_(sheet, id);
  if (r > 0) {
    sheet.getRange(r, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    r = sheet.getLastRow();
  }
  var bg = d.entregado ? "#dbeafe" : "#f3e8ff";
  sheet.getRange(r, 1, 1, H_SORTEOS.length).setBackground(bg);
}


// ============================================================
//  SYNC COMPLETO DESDE FIRESTORE (backup / trigger periódico)
// ============================================================
function syncNow() {
  var ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheetV = sheet_(ss, SHEET_VENTAS,  H_VENTAS);
  var sheetS = sheet_(ss, SHEET_SORTEOS, H_SORTEOS);

  var token;
  try { token = token_(); } catch(e) {
    Logger.log("Auth error: " + e);
    ss.toast("Error de autenticación: " + e.message, "Central Variedades", 8);
    return;
  }

  // ── Pedidos ──────────────────────────────────────────────
  var pedidos = fetchCol_(token, "pedidos");
  var rowsV   = pedidos.map(function(doc) {
    var f = doc.fields || {};
    return [
      doc.name.split("/").pop(),
      str_(f,"nombreCliente"), str_(f,"producto"), str_(f,"tipoAccesorio"),
      str_(f,"marca"),         str_(f,"segmento"),  str_(f,"talle"),
      str_(f,"color"),         num_(f,"precio"),    str_(f,"estadoPago"),
      bool_(f,"entregado") ? "Sí" : "No",           date_(f,"fechaCreacion")
    ];
  });
  writeSheet_(sheetV, H_VENTAS, rowsV);
  for (var i = 0; i < rowsV.length; i++) {
    colorPedido_(sheetV, i+2, rowsV[i][9], rowsV[i][10] === "Sí");
    sheetV.getRange(i+2, 8).setNumberFormat("$#,##0.00");
  }

  // ── Sorteos ──────────────────────────────────────────────
  var sorteos = fetchCol_(token, "sorteos");
  var rowsS   = sorteos.map(function(doc) {
    var f = doc.fields || {};
    return [
      doc.name.split("/").pop(),
      str_(f,"ganador"), str_(f,"premio"),
      bool_(f,"entregado") ? "Entregado ✓" : "Pendiente",
      date_(f,"fechaCreacion")
    ];
  });
  writeSheet_(sheetS, H_SORTEOS, rowsS);
  for (var j = 0; j < rowsS.length; j++) {
    var bg = rowsS[j][3] === "Entregado ✓" ? "#dbeafe" : "#f3e8ff";
    sheetS.getRange(j+2, 1, 1, H_SORTEOS.length).setBackground(bg);
  }

  // ── Resumen ──────────────────────────────────────────────
  var pendientes = pedidos.filter(function(d){ return str_(d.fields||{},"estadoPago")==="pendiente" && !bool_(d.fields||{},"entregado"); }).length;
  var totalPesos = pedidos.reduce(function(s,d){ return s + num_(d.fields||{},"precio"); }, 0);
  var col = H_VENTAS.length + 2;
  sheetV.getRange(1,col).setValue("📊 Resumen").setFontWeight("bold").setBackground("#f3f4f6");
  sheetV.getRange(2,col).setValue("Total ventas: "  + pedidos.length);
  sheetV.getRange(3,col).setValue("🟡 Pendientes: " + pendientes).setBackground("#fef3c7");
  sheetV.getRange(4,col).setValue("🏆 Sorteos: "    + sorteos.length).setBackground("#f3e8ff");
  sheetV.getRange(5,col).setValue("💰 Total: $"     + totalPesos.toLocaleString()).setFontWeight("bold");
  sheetV.getRange(6,col).setValue("🕐 " + new Date().toLocaleString("es-AR")).setFontColor("#888888");
  sheetV.autoResizeColumn(col);

  var msg = "✓ " + pedidos.length + " pedidos | " + sorteos.length + " sorteos | $" + totalPesos.toLocaleString();
  Logger.log(msg);
  ss.toast(msg, "Central Variedades ✓", 5);
}

function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("syncNow").timeBased().everyMinutes(5).create();
  Logger.log("✓ Trigger creado: syncNow() cada 5 minutos.");
  syncNow();
}

function pauseTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ ScriptApp.deleteTrigger(t); });
  Logger.log("Sync automático pausado.");
  SpreadsheetApp.openById(SPREADSHEET_ID).toast("Sincronización pausada.", "Central Variedades", 4);
}


// ============================================================
//  HELPERS — hoja / búsqueda / color
// ============================================================
function sheet_(ss, name, headers) {
  var s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1,1,1,headers.length).setValues([headers])
     .setBackground("#6366f1").setFontColor("#ffffff")
     .setFontWeight("bold").setHorizontalAlignment("center");
    s.setFrozenRows(1);
  }
  return s;
}

function writeSheet_(sheet, headers, rows) {
  sheet.clearContents();
  sheet.clearFormats();
  var all = [headers].concat(rows);
  sheet.getRange(1,1,all.length,headers.length).setValues(all);
  sheet.getRange(1,1,1,headers.length)
    .setBackground("#6366f1").setFontColor("#ffffff")
    .setFontWeight("bold").setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

function find_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function del_(sheet, id) {
  var r = find_(sheet, id);
  if (r > 0) sheet.deleteRow(r);
}

function colorPedido_(sheet, r, estadoPago, entregado) {
  var bg;
  if      (entregado)                    bg = "#dbeafe";
  else if (estadoPago === "pagado")      bg = "#d1fae5";
  else                                   bg = "#fef3c7";
  sheet.getRange(r, 1, 1, H_VENTAS.length).setBackground(bg);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
//  FIREBASE — autenticación y lectura REST
// ============================================================
function token_() {
  var hdr   = {alg:"RS256",typ:"JWT"};
  var now   = Math.floor(Date.now()/1000);
  var claim = {iss:SA_EMAIL, scope:"https://www.googleapis.com/auth/datastore",
               aud:"https://oauth2.googleapis.com/token", exp:now+3600, iat:now};
  var enc   = function(o){ return Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/,""); };
  var inp   = enc(hdr)+"."+enc(claim);
  var sig   = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(inp, SA_PRIVATE_KEY)).replace(/=+$/,"");
  var resp  = UrlFetchApp.fetch("https://oauth2.googleapis.com/token",{
    method:"post", muteHttpExceptions:true,
    payload:{grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer", assertion:inp+"."+sig}
  });
  var data  = JSON.parse(resp.getContentText());
  if (!data.access_token) throw new Error("Auth error: "+resp.getContentText());
  return data.access_token;
}

function fetchCol_(token, col) {
  var url  = "https://firestore.googleapis.com/v1/projects/"+PROJECT_ID+"/databases/(default)/documents/"+col+"?pageSize=500";
  var all  = [];
  var next = null;
  do {
    var u    = next ? url+"&pageToken="+next : url;
    var resp = UrlFetchApp.fetch(u,{method:"get",muteHttpExceptions:true,headers:{Authorization:"Bearer "+token}});
    if (resp.getResponseCode() !== 200) throw new Error("Firestore "+resp.getResponseCode()+": "+resp.getContentText());
    var data = JSON.parse(resp.getContentText());
    if (data.documents) all = all.concat(data.documents);
    next = data.nextPageToken || null;
  } while(next);
  return all;
}

function str_(f,k)  { var v=f[k]; if(!v) return ""; return v.stringValue!=null?String(v.stringValue):v.integerValue!=null?String(v.integerValue):""; }
function num_(f,k)  { var v=f[k]; if(!v) return 0;  return parseFloat(v.integerValue!=null?v.integerValue:v.doubleValue!=null?v.doubleValue:0); }
function bool_(f,k) { var v=f[k]; return v&&(v.booleanValue===true||v.booleanValue==="true"); }
function date_(f,k) {
  var v=f[k]; if(!v||!v.timestampValue) return "";
  try { return Utilities.formatDate(new Date(v.timestampValue),Session.getScriptTimeZone(),"dd/MM/yyyy HH:mm"); } catch(e){ return ""; }
}
