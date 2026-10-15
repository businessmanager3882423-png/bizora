import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, sendEmailVerification, sendPasswordResetEmail, deleteUser } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, writeBatch, onSnapshot, increment, arrayUnion, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { t, LANGS, getLang, setLang } from "./i18n.js";
import { MODS, CATS, CHARTS, FONTS, CURRENCIES, parse, getCat } from "./categories.js";

/* ===================== helpers ===================== */
const $ = (s) => document.querySelector(s), root = $("#app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LOC = { en: "en", ur: "ur-PK", ar: "ar", hi: "hi", es: "es", fr: "fr" };
let user, biz, bid, cat, role, mod = "dash", mode = "login", MY = [], S = {}, unsubs = [], charts = [], V = null, FS = [], ed = null, qv = "", PB = false, B, tcur, cd, ad, rng = "today", rf = "", rt = "", tm, pick = "", lastSale;
const newC = () => ({ lines: [], cid: "", sid: "", pay: "", disc: 0, paid: "", note: "", tid: "" });
let cart = newC(), pcart = newC();

const ms = (x) => x?.toMillis?.() ?? (x ? +new Date(x) : 0);
const tz = () => biz?.tz || undefined;
const ymd = (d = new Date()) => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(d); } catch { return new Date(d).toISOString().slice(0, 10); } };
const dkey = (m) => ymd(new Date(m));
const loc = () => LOC[getLang()] + (biz?.hijri ? "-u-ca-islamic" : "");
const fdt = (x) => new Date(ms(x) || Date.now()).toLocaleString(loc(), { timeZone: tz() });
const fd = (x) => { try { return new Date(x?.toMillis ? ms(x) : x + "T12:00:00").toLocaleDateString(loc(), { timeZone: tz() }); } catch { return x; } };
const rnd = (n) => +(+n || 0).toFixed(biz?.dec ?? 2);
const fm = (n, c) => { const d = biz?.dec ?? 2; try { return new Intl.NumberFormat(LOC[getLang()], { style: "currency", currency: c, minimumFractionDigits: d, maximumFractionDigits: d }).format(+n || 0); } catch { return c + " " + rnd(n); } };
const money = (n) => fm(n, biz?.currency || "USD");
const sum = (a, f) => (a || []).reduce((n, x) => n + (+x[f] || 0), 0);
const g = (a, k, v) => { const m = {}; (a || []).forEach((x) => { const key = k(x); m[key] = (m[key] || 0) + (+v(x) || 0); }); return Object.entries(m); };
const desc = (a, b) => b[1] - a[1];
const W = (p) => { p.catch((e) => alert(e.message)); return Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, 600))]); };
const col = (k) => collection(db, "businesses", bid, k), dr = (k, id) => doc(db, "businesses", bid, k, id);
const log = (a, d = "") => { if (bid) addDoc(col("logs"), { u: user.email || user.uid, a, d, createdAt: serverTimestamp() }).catch(() => {}); };
const title = (m) => { const o = cat?.L?.[m]; return o ? (cat.custom ? o : t(o)) : t(m); };
const methods = () => (biz.methods || "cash,card,bank,wallet").split(",").map((s) => s.trim()).filter(Boolean);
const modal = (h) => { $("#ov").innerHTML = `<div class="ovl" onclick="if(event.target===this)A.x()"><div class="mdl">${h}</div></div>`; };
const cg = (s) => (s.lines || []).reduce((n, l) => n + (+l.cost || 0) * l.qty * (l.mult || 1), 0);
const okS = () => (S.sales || []).filter((s) => s.status !== "returned");

// roles: staff sirf sales/customers waghera; manager aur owner sab kuch (rules mein bhi yahi lagu hai)
const SR = ["products", "sales", "customers", "payments", "appointments", "tables", "repairs", "orders", "quotes"];
const SC = ["sales", "customers", "payments", "appointments", "tables", "repairs", "orders", "quotes", "logs"];
const SU = ["customers", "appointments", "tables", "repairs", "orders"];
const isM = () => role !== "staff", canR = (c) => isM() || SR.includes(c), canC = (c) => isM() || SC.includes(c), canU = (c) => isM() || SU.includes(c);

const startOf = (k) => { const n = new Date(); if (k === "today") n.setHours(0, 0, 0, 0); else if (k === "week") { n.setDate(n.getDate() - 6); n.setHours(0, 0, 0, 0); } else if (k === "month") { n.setDate(1); n.setHours(0, 0, 0, 0); } else return 0; return +n; };
const inR = (x) => { const m = ms(x.createdAt); return rng === "custom" ? (!rf || m >= +new Date(rf)) && (!rt || m <= +new Date(rt) + 864e5 - 1) : m >= startOf(rng); };
const rangeTabs = () => ["today", "week", "month", "all"].map((k) => `<button class="${rng === k ? "on" : ""}" onclick="A.rng('${k}')">${t(k)}</button>`).join("");

function paint(h) { charts.forEach((c) => c.destroy()); charts = []; root.innerHTML = h; }
function theme(th) { ["p", "a", "bg", "ink", "r", "font"].forEach((k) => th ? root.style.setProperty("--" + k, k === "font" ? `'${th.font}'` : th[k]) : root.style.removeProperty("--" + k)); }
const langSel = (c = "lang") => `<select class="${c}" onchange="A.lang(this.value)">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === getLang() ? "selected" : ""}>${v}</option>`).join("")}</select>`;
const fld = (f, v = "") => `<label class="fld"><small>${esc(t(f.k))}</small>${f.opts ? `<select name="${f.k}">${f.opts.map((o) => `<option value="${esc(o)}" ${v === o ? "selected" : ""}>${esc(t(o))}</option>`).join("")}</select>` : `<input name="${f.k}" type="${f.type}" ${f.type === "number" ? 'step="any"' : ""} value="${esc(v)}">`}</label>`;
const MONEYK = ["price", "cost", "amount", "budget", "spent", "salary", "balance", "due", "total", "limit", "packPrice"];
const cell = (f, v) => v === undefined || v === "" ? "" : f.type === "number" ? (MONEYK.includes(f.k) ? money(v) : esc(v)) : f.type === "date" ? esc(fd(v)) : f.opts ? `<span class="badge">${esc(t(v))}</span>` : esc(v);

/* ===================== auth ===================== */
function authView(err = "") {
  theme();
  paint(`<div class="page narrow">${langSel()}<h1>Bizora</h1><form class="card" onsubmit="A.auth(event)">
  <input id="em" type="email" placeholder="${t("email")}" required><input id="pw" type="password" placeholder="${t("pass")}" minlength="6" required style="margin-top:10px">
  <p class="err">${esc(err)}</p><button class="full">${t(mode)}</button><button type="button" class="ghost full" onclick="A.google()">${t("google")}</button>
  <p class="c"><a href="#" onclick="A.toggle();return false">${t(mode === "login" ? "swapL" : "swapS")}</a> · <a href="#" onclick="A.reset();return false">${t("forgot")}</a></p></form></div>`);
}
const mapEmail = () => { if (user.emailVerified && user.email) setDoc(doc(db, "userByEmail", user.email.toLowerCase()), { uid: user.uid }).catch(() => {}); };
const unwatch = () => { unsubs.forEach((u) => u()); unsubs = []; biz = null; bid = null; };

/* ===================== business list ===================== */
const catCard = (k, i, n, p, r) => `<button type="button" class="cat" data-k="${k}" style="background:${p};--rr:${r}" onclick="A.pick('${k}')"><span>${i}</span><b>${esc(n)}</b></button>`;
async function bizView(err = "") {
  theme(); pick = ""; cart = newC(); pcart = newC();
  try { MY = (await getDocs(query(collection(db, "businesses"), where("memberIds", "array-contains", user.uid)))).docs.map((d) => ({ id: d.id, ...d.data() })); } catch (x) { MY = []; err = err || x.message; }
  const mine = MY.map((b) => { const c = getCat(b); return c ? `<button class="cat" style="background:${c.theme.p};--rr:${c.theme.r}" onclick="A.open('${b.id}')"><span>${c.icon}</span><b>${esc(b.name)}</b></button>` : ""; }).join("");
  const cats = Object.entries(CATS).map(([k, c]) => catCard(k, c.icon, c.name, c.theme.p, c.theme.r)).join("") + catCard("custom", "✨", t("custom"), "#444", "12px");
  const unver = !user.emailVerified && user.providerData[0]?.providerId === "password";
  paint(`<div class="page"><div class="top"><h1>${t("mine")}</h1><div class="row">${langSel("")}<button class="ghost" onclick="A.out()">${t("logout")}</button></div></div>
  ${unver ? `<div class="card mb">${t("verifyMsg")} <button class="sm" onclick="A.resend()">${t("resend")}</button> <button class="sm ghost" onclick="A.chk()">${t("verified")}</button></div>` : ""}
  <div class="grid mb">${mine}</div>${MY.length > 1 ? `<button class="ghost mb" onclick="A.combo()">${t("combo")}</button>` : ""}
  <h2>${t("newBiz")}</h2><form class="mt" onsubmit="A.create(event)"><div class="grid">
    <input name="bn" placeholder="${t("bizName")}" required><input name="bc" placeholder="${t("country")}" required>
    <select name="bu">${CURRENCIES.map((c) => `<option>${c}</option>`).join("")}</select><input name="bt" type="number" min="0" step="any" placeholder="${t("tax")}">
    <label class="row"><input type="checkbox" name="bs" checked> ${t("seed")}</label></div>
  <h2 class="mt">${t("category")}</h2><div class="grid mt">${cats}</div><div id="bd"></div>
  <p class="err">${esc(err)}</p><button class="mt">${t("create")}</button></form>
  <p class="mt"><button class="ghost sm" onclick="A.delacc()">${t("delAcc")}</button></p></div>`);
}

/* ---- custom category builder ---- */
const toB = (c) => ({ name: c.name || "", icon: c.icon || "🏪", color: c.theme?.p || "#0E7490", font: c.theme?.font || "Inter", r: c.theme?.r || "14px", nav: c.nav || "side", pos: c.pos || "list",
  mods: [...c.mods.map((k) => ({ k, on: 1, label: c.custom ? c.L?.[k] || "" : c.L?.[k] ? t(c.L[k]) : "", extra: c.extra?.[k] || "" })), ...Object.keys(MODS).filter((k) => !c.mods.includes(k)).map((k) => ({ k, on: 0, label: "", extra: "" }))],
  charts: c.charts.map((x) => x[0]) });
function bSync() {
  if (!$("#b_n")) return;
  B.name = $("#b_n").value; B.icon = $("#b_i").value; B.color = $("#b_c").value; B.font = $("#b_f").value; B.r = $("#b_r").value; B.nav = $("#b_nv").value; B.pos = $("#b_p").value;
  B.mods.forEach((m, i) => { m.on = $("#b_on" + i).checked; m.label = $("#b_l" + i).value; m.extra = $("#b_x" + i).value; });
  B.charts = [...document.querySelectorAll(".b_ch:checked")].map((x) => x.value);
}
const fromB = () => { bSync(); const mods = B.mods.filter((m) => m.on), L = {}, extra = {}; mods.forEach((m) => { if (m.label) L[m.k] = m.label; if (m.extra) extra[m.k] = m.extra.replace(/\s/g, ""); }); return { name: B.name || "Custom", icon: B.icon || "🏪", color: B.color, font: B.font, r: B.r, nav: B.nav, pos: B.pos, mods: mods.map((m) => m.k), L, extra, charts: B.charts.map((s) => [s, CHARTS[s]]) }; };
const sel = (id, opts, v) => `<select id="${id}">${opts.map(([val, lab]) => `<option value="${val}" ${val === v ? "selected" : ""}>${lab}</option>`).join("")}</select>`;
function bRender() {
  $("#bd").innerHTML = `<div class="card mt"><select onchange="A.btpl(this.value)"><option value="">${t("copyFrom")}</option>${Object.entries(CATS).map(([k, c]) => `<option value="${k}">${esc(c.name)}</option>`).join("")}</select>
  <div class="grid mt"><input id="b_n" value="${esc(B.name)}" placeholder="${t("catName")}"><input id="b_i" value="${esc(B.icon)}"><input id="b_c" type="color" value="${B.color}">
  ${sel("b_f", FONTS.map((f) => [f, f]), B.font)}${sel("b_r", ["4px", "10px", "14px", "22px", "28px"].map((r) => [r, "◻ " + r]), B.r)}${sel("b_nv", [["side", "Sidebar"], ["top", "Top bar"]], B.nav)}${sel("b_p", [["list", "POS: list"], ["tiles", "POS: tiles"]], B.pos)}</div>
  <h3 class="mt">${t("modsOrder")}</h3>${B.mods.map((m, i) => `<div class="row mrow"><input type="checkbox" id="b_on${i}" ${m.on ? "checked" : ""}><b style="min-width:110px">${t(m.k)}</b><input id="b_l${i}" value="${esc(m.label)}" placeholder="${t("rename")}"><input id="b_x${i}" value="${esc(m.extra)}" placeholder="${t("extraF")}"><button type="button" class="ghost sm" onclick="A.bmv(${i},-1)">↑</button><button type="button" class="ghost sm" onclick="A.bmv(${i},1)">↓</button></div>`).join("")}
  <h3 class="mt">${t("widgets")}</h3><div class="chips">${Object.keys(CHARTS).map((k) => `<label><input type="checkbox" class="b_ch" value="${k}" ${B.charts.includes(k) ? "checked" : ""}> ${t("c_" + k)}</label>`).join("")}</div></div>`;
}

/* ===================== business shell ===================== */
function watch() {
  unsubs.forEach((u) => u()); unsubs = []; S = {};
  const want = [...new Set([...cat.mods, "sales", "products", "customers", "expenses", "payments", "closings", "logs"])].filter(canR); want.push("members");
  want.forEach((c) => { S[c] = []; unsubs.push(onSnapshot(col(c), (s) => { S[c] = s.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt)); clearTimeout(tm); tm = setTimeout(() => V?.fill?.(), 120); }, () => {})); });
}
function shell() {
  theme(cat.theme);
  const items = ["dash", ...cat.mods.filter(canR), ...(isM() ? ["reports"] : []), ...(role === "owner" ? ["team", "settings"] : [])];
  paint(`<div class="shell ${cat.nav}"><nav><div class="brand">${cat.icon} ${esc(biz.name)}</div>${items.map((m) => `<button class="${m === mod ? "on" : ""}" onclick="A.nav('${m}')">${esc(title(m))}</button>`).join("")}${langSel("")}<button class="ghost" onclick="A.home()">${t("switch")}</button></nav><main id="main"></main></div>`);
  render();
}
function render() {
  charts.forEach((c) => c.destroy()); charts = []; qv = ""; ed = null;
  V = getV(mod); $("#main").innerHTML = `<h1>${esc(title(mod))}</h1>` + V.frame; V.init?.(); V.fill?.();
}
function getV(m) {
  if (m === "dash") return dashV(); if (m === "reports") return repV(); if (m === "team") return teamV(); if (m === "settings") return setV();
  if (m === "sales") return posV(false); if (m === "purchases") return posV(true);
  if (m === "attendance") return attV(); if (m === "tables") return tblV(); if (m === "appointments") return calV();
  return MODS[m]?.k ? kanV(m) : genV(m);
}

/* ===================== dashboard ===================== */
const lowList = () => (S.products || []).filter((p) => (+p.stock || 0) <= (+p.minStock || 5));
const SRC = {
  salesDay: (D) => g(D.ss, (s) => dkey(ms(s.createdAt)), (s) => s.total).sort().slice(-14).map(([k, v]) => [k.slice(5), rnd(v)]),
  profitDay: (D) => { const m = {}; D.ss.forEach((s) => { const k = dkey(ms(s.createdAt)); m[k] = (m[k] || 0) + s.total - cg(s); }); D.ex.forEach((e) => { const k = dkey(ms(e.createdAt)); m[k] = (m[k] || 0) - e.amount; }); return Object.entries(m).sort().slice(-14).map(([k, v]) => [k.slice(5), rnd(v)]); },
  topItems: (D) => g(D.L, (l) => l.name, (l) => l.qty * l.price).sort(desc).slice(0, 6),
  payMix: (D) => g(D.ss, (s) => t(s.pay), (s) => s.total),
  expenseSplit: (D) => g(D.ex, (e) => t(e.type || "other"), (e) => e.amount),
  lowStock: () => lowList().sort((a, b) => a.stock - b.stock).slice(0, 6).map((p) => [p.name, +p.stock || 0]),
  hourly: (D) => g(D.ss, (s) => String(new Date(ms(s.createdAt)).getHours()).padStart(2, "0"), () => 1).sort(),
  topCustomers: (D) => g(D.ss.filter((s) => s.customer), (s) => s.customer, (s) => s.total).sort(desc).slice(0, 6),
  siteBudget: () => (S.sites || []).map((x) => [x.name, x.budget ? Math.round(100 * (+x.spent || 0) / x.budget) : 0]),
  seasonYield: () => (S.seasons || []).map((x) => [x.crop, +x.actualYield || +x.expectedYield || 0]),
  projectStatus: () => g(S.projects, (x) => t(x.status), () => 1),
  repairStatus: () => g(S.repairs, (x) => t(x.status), () => 1),
  orderStatus: () => g(S.orders, (x) => t(x.status), () => 1),
  apptDay: () => g((S.appointments || []).filter((a) => a.date >= ymd()), (a) => a.date.slice(5), () => 1).sort().slice(0, 7),
  expiry: () => { const b = [0, 0, 0, 0]; (S.products || []).forEach((p) => { if (!p.expiry) return; const d = (new Date(p.expiry) - Date.now()) / 864e5; if (d < 0) b[0]++; else if (d <= 30) b[1]++; else if (d <= 60) b[2]++; else if (d <= 90) b[3]++; }); return [[t("expired"), b[0]], ["≤30d", b[1]], ["≤60d", b[2]], ["≤90d", b[3]]]; }
};
function mkChart(host, ti, ty, d) {
  const { p, a } = cat.theme, pie = ty === "pie", c = document.createElement("div");
  c.className = "card"; c.innerHTML = `<h2>${esc(ti)}</h2>${d.length ? '<div class="cv"><canvas></canvas></div>' : `<p class="muted">${t("empty")}</p>`}`; host.append(c);
  if (!d.length) return;
  charts.push(new Chart(c.querySelector("canvas"), { type: pie ? "doughnut" : ty === "area" ? "line" : ty,
    data: { labels: d.map((x) => x[0]), datasets: [{ data: d.map((x) => x[1]), borderColor: p, backgroundColor: pie ? [p, a, p + "bb", a + "bb", p + "77", a + "77"] : ty === "line" ? a : ty === "area" ? a + "88" : p, fill: ty === "area", borderWidth: pie ? 0 : 3, tension: 0.35, borderRadius: ty === "bar" ? 4 : 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: pie } } } }));
}
function dashV() {
  return { frame: `<div class="tabs mb">${rangeTabs()}</div><div id="ob"></div><div id="ds" class="grid mb"></div><div id="al"></div><div id="dc" class="grid g2"></div>`, fill() {
    const ss = okS().filter(inR), ex = (S.expenses || []).filter(inR), L = ss.flatMap((s) => s.lines || []), rev = sum(ss, "total"), E = sum(ex, "amount"), cogs = ss.reduce((n, s) => n + cg(s), 0);
    const cards = [[t("sales"), money(rev)], [t("orders_n"), ss.length]];
    if (isM()) cards.push([t("expenses"), money(E)], [t("profit"), money(rev - cogs - E)]);
    if (S.customers?.length) cards.push([t("owed"), money(sum(S.customers, "balance"))]);
    if (S.products?.length) cards.push([t("low"), lowList().length]);
    if (isM() && S.suppliers?.length) cards.push([t("supDue"), money(sum(S.suppliers, "due"))]);
    $("#ds").innerHTML = cards.map(([k, v]) => `<div class="card stat">${esc(k)}<b>${v}</b></div>`).join("");
    const exp = (S.products || []).filter((p) => p.expiry && (new Date(p.expiry) - Date.now()) / 864e5 <= 60), td = (S.appointments || []).filter((a) => a.date === ymd() && a.status === "booked");
    $("#al").innerHTML = lowList().length || exp.length || td.length ? `<div class="card mb"><h2>⚠ ${t("alerts")}</h2>${lowList().length ? `<div><b>${t("low")}:</b> ${lowList().slice(0, 6).map((p) => esc(p.name) + " (" + (+p.stock || 0) + ")").join(", ")}</div>` : ""}${exp.length ? `<div><b>${t("expiring")}:</b> ${exp.slice(0, 6).map((p) => esc(p.name) + " " + fd(p.expiry)).join(", ")}</div>` : ""}${td.length ? `<div><b>${t("appointments")}:</b> ${td.length}</div>` : ""}</div>` : "";
    const ob = $("#ob"), steps = [["products", (S.products || []).length], ["customers", (S.customers || []).length], ["sales", (S.sales || []).length]].filter(([m]) => cat.mods.includes(m));
    ob.innerHTML = !localStorage["ob" + bid] && steps.some(([, n]) => !n) ? `<div class="card mb"><h2>${t("start")}</h2>${steps.map(([m, n]) => `<div>${n ? "✅" : "⬜"} <a href="#" onclick="A.nav('${m}');return false">${t("add")} → ${esc(title(m))}</a></div>`).join("")}<button class="ghost sm" onclick="A.hideOb()">${t("hide")}</button></div>` : "";
    charts.forEach((c) => c.destroy()); charts = []; $("#dc").innerHTML = "";
    const D = { ss, ex, L };
    cat.charts.forEach(([src, ty]) => { if (!isM() && ["expenseSplit", "profitDay", "siteBudget"].includes(src)) return; mkChart($("#dc"), t("c_" + src), ty, (SRC[src] || (() => []))(D)); });
  } };
}

/* ===================== POS (sales) + purchases ===================== */
const calc = (lines, disc) => { const sub = lines.reduce((n, l) => n + l.qty * l.price, 0), net = sub * (1 - disc / 100), r = (biz.tax || 0) / 100, tax = biz.taxInc ? net - net / (1 + r) : net * r; return { sub: rnd(sub), tax: rnd(tax), total: rnd(biz.taxInc ? net : net + tax) }; };
function posV(buy) {
  PB = buy;
  const frame = `<div class="grid g2"><div class="card"><div class="row"><input id="ps" placeholder="${t("searchScan")}" oninput="A.ps()" onkeydown="A.pk(event)" autocomplete="off"><button type="button" onclick="A.scan()">📷</button></div><div id="pm" class="tiles mt"></div>
  ${buy ? "" : `<details class="mt"><summary>${t("customItem")}</summary><div class="grid mt"><input id="ci_n" placeholder="${t("name")}"><input id="ci_q" type="number" step="any" value="1"><input id="ci_p" type="number" step="any" placeholder="${t("price")}"><button type="button" onclick="A.cadd()">${t("add")}</button></div></details>`}</div>
  <div class="card"><div id="cl"></div><div class="grid mt">${buy ? "" : `<input id="c_d" type="number" min="0" max="100" step="any" placeholder="${t("discount")} %" oninput="A.ctl()"><select id="c_p" onchange="A.ctl()">${[...methods(), ...(cat.mods.includes("customers") ? ["udhaar"] : [])].map((m) => `<option value="${esc(m)}">${esc(t(m))}</option>`).join("")}</select>`}
  <select id="c_c" onchange="A.ctl()"></select><input id="c_a" type="number" min="0" step="any" placeholder="${t("paidNow")}" oninput="A.ctl()"><input id="c_n" placeholder="${t("note")}" oninput="A.ctl()"></div>
  <div id="ct" class="tot"></div><button class="full" onclick="A.checkout()">${t(buy ? "savePurchase" : "checkout")}</button></div></div>
  <h2 class="mt">${t("history")}</h2><div class="tabs">${rangeTabs()}</div><input class="mt" placeholder="${t("search")}" oninput="A.q(this.value)"><div id="st" class="card mt"></div>`;
  return { frame, init() { pSel(); setCtl(); cartUI(); pmFill(); }, fill() { pSel(); pmFill(); histFill(); } };
}
const C = () => (PB ? pcart : cart);
function pSel() { const s = $("#c_c"); if (!s) return; const c = C(), list = PB ? S.suppliers || [] : S.customers || []; s.innerHTML = `<option value="">${t(PB ? "supplier" : "customer")}</option>` + list.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join(""); s.value = (PB ? c.sid : c.cid) || ""; }
function setCtl() { const c = C(); if ($("#c_d")) $("#c_d").value = c.disc || ""; if ($("#c_p")) $("#c_p").value = c.pay || methods()[0]; $("#c_a").value = c.paid; $("#c_n").value = c.note; }
function pmFill() {
  const v = ($("#ps")?.value || "").toLowerCase(), list = (S.products || []).filter((p) => !v || (p.name || "").toLowerCase().includes(v) || (p.barcode || "") === v), show = v || cat.pos === "tiles" ? list.slice(0, 48) : [];
  $("#pm").innerHTML = show.map((p) => `<button type="button" class="tile" onclick="A.add('${p.id}')"><b>${esc(p.name)}</b><small>${money(PB ? p.cost : p.price)} · ${+p.stock || 0}</small></button>`).join("") || `<p class="muted">${t(v ? "noMatch" : "typeToSearch")}</p>`;
}
function cartUI() {
  const c = C();
  $("#cl").innerHTML = c.lines.length ? `<table><tr><th>${t("item")}</th><th>${t("qty")}</th><th>${t("unit")}</th><th>${t(PB ? "cost" : "price")}</th><th></th></tr>${c.lines.map((l, i) => `<tr><td>${esc(l.name)}</td><td><input class="n" type="number" min="0" step="any" value="${l.qty}" onchange="A.lq(${i},this.value)"></td><td>${l.pn ? `<select onchange="A.lu(${i},this.value)"><option value="0">${esc(l.unit)}</option><option value="1" ${l.mult > 1 ? "selected" : ""}>${esc(l.pn)}</option></select>` : esc(l.unit || "")}</td><td><input class="n" type="number" min="0" step="any" value="${l.price}" ${role === "staff" && l.pid && !PB ? "disabled" : ""} onchange="A.lp(${i},this.value)"></td><td><button class="ghost sm" onclick="A.lr(${i})">✕</button></td></tr>`).join("")}</table>` : `<p class="muted">${t("cartEmpty")}</p>`;
  totUI();
}
function totUI() { const c = C(); $("#ct").innerHTML = PB ? `<b>${t("total")}: ${money(rnd(c.lines.reduce((n, l) => n + l.qty * l.price, 0)))}</b>` : (() => { const x = calc(c.lines, c.disc); return `<div>${t("subtotal")}: ${money(x.sub)}</div><div>${t("tax")}: ${money(x.tax)}</div><b>${t("total")}: ${money(x.total)}</b>`; })(); }
function histFill() {
  const k = PB ? "purchases" : "sales", v = qv.toLowerCase(), rows = (S[k] || []).filter((x) => inR(x) && (!v || (x.customer || x.supplier || "").toLowerCase().includes(v) || (x.lines || []).some((l) => (l.name || "").toLowerCase().includes(v))));
  $("#st").innerHTML = rows.length ? `<table><tr><th>${t("date")}</th><th>#</th><th>${t(PB ? "supplier" : "customer")}</th><th>${t("item")}</th><th>${t("total")}</th><th>${t(PB ? "paidNow" : "method")}</th><th></th></tr>${rows.map((x) => `<tr class="${x.status === "returned" ? "ret" : ""}"><td>${fdt(x.createdAt)}</td><td>${esc(x.no)}</td><td>${esc(x.customer || x.supplier || "")}</td><td>${esc((x.lines || []).map((l) => l.name + "×" + l.qty).join(", "))}</td><td>${money(x.total)}</td><td>${PB ? money(x.paid) : esc(t(x.pay))}</td><td class="act">${PB ? "" : `<button class="ghost sm" onclick="A.rc('${x.id}')">${t("receipt")}</button><button class="ghost sm" onclick="A.wa('${x.id}')">${t("wa")}</button>${isM() && x.status !== "returned" ? `<button class="ghost sm" onclick="A.ret('${x.id}')">${t("ret")}</button>` : ""}`}</td></tr>`).join("")}</table>` : `<p>${t("empty")}</p>`;
}
const rcText = (s) => [biz.name, biz.taxId ? "Tax ID: " + biz.taxId : "", fdt(s.createdAt), "#" + s.no, "————————", ...(s.lines || []).map((l) => `${l.name} ${l.qty}${l.mult > 1 ? " pack" : ""} × ${l.price} = ${rnd(l.qty * l.price)}`), "————————", `${t("subtotal")}: ${s.sub}`, s.disc ? `${t("discount")}: ${s.disc}%` : "", `${t("tax")}: ${s.tax}`, `${t("total")}: ${money(s.total)}`, `${t("method")}: ${t(s.pay)}`, s.customer ? `${t("customer")}: ${s.customer}` : "", biz.footer || ""].filter(Boolean).join("\n");
const findSale = (id) => (S.sales || []).find((x) => x.id === id) || lastSale;
const pw = (txt) => { const w = window.open("", "_blank"); if (!w) return alert("Popup blocked"); w.document.write(`<pre style="font:15px monospace;padding:16px;max-width:380px;white-space:pre-wrap">${esc(txt)}</pre>`); w.document.close(); w.print(); };

async function scan(cb) {
  if (!("BarcodeDetector" in window) || !navigator.mediaDevices) return cb(prompt(t("barcode")));
  const ov = document.createElement("div"); ov.className = "ovl"; ov.innerHTML = `<div class="mdl"><video playsinline muted style="width:100%"></video><button class="full ghost">${t("cancel")}</button></div>`; document.body.appendChild(ov);
  const v = ov.querySelector("video"); let stream, stop = false;
  const end = (c) => { stop = true; stream?.getTracks().forEach((x) => x.stop()); ov.remove(); if (c) cb(c); };
  ov.querySelector("button").onclick = () => end();
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); v.srcObject = stream; await v.play(); const d = new BarcodeDetector();
    (async function loop() { while (!stop) { try { const r = await d.detect(v); if (r.length) return end(r[0].rawValue); } catch {} await new Promise((r) => setTimeout(r, 300)); } })();
  } catch { end(); cb(prompt(t("barcode"))); }
}

/* ===================== generic module (table + form) ===================== */
const acts = (m, r) => (m === "customers" ? `<button class="ghost sm" onclick="A.rcv('${r.id}')">${t("payRcv")}</button><button class="ghost sm" onclick="A.led('${r.id}')">${t("ledger")}</button>${r.phone ? `<button class="ghost sm" onclick="A.rem('${r.id}')">${t("remind")}</button>` : ""}` : m === "suppliers" && isM() ? `<button class="ghost sm" onclick="A.pays('${r.id}')">${t("paySup")}</button>` : "") + (canU(m) ? `<button class="ghost sm" onclick="A.gedit('${r.id}')">${t("edit")}</button>` : "") + (isM() ? `<button class="ghost sm" onclick="A.gdel('${r.id}')">${t("del")}</button>` : "");
const formHTML = () => `<form id="gf" class="card grid" onsubmit="A.gsave(event)">${FS.map((f) => fld(f)).join("")}<button>${t("save")}</button><button type="button" class="ghost" onclick="A.gclr()">${t("cancel")}</button></form>`;
const fieldsOf = (m) => parse(MODS[m].f + (cat.extra?.[m] ? "," + cat.extra[m] : ""));
function genV(m) {
  FS = fieldsOf(m);
  return { frame: (canC(m) ? formHTML() : "") + `<input class="mt" placeholder="${t("search")}" oninput="A.q(this.value)"><div id="gt" class="card mt"></div>`, fill() {
    const v = qv.toLowerCase(), rows = (S[m] || []).filter((r) => !v || FS.some((f) => String(r[f.k] ?? "").toLowerCase().includes(v))), cols = FS.slice(0, 7);
    $("#gt").innerHTML = rows.length ? `<table><tr>${cols.map((f) => `<th>${esc(t(f.k))}</th>`).join("")}<th></th></tr>${rows.map((r) => `<tr>${cols.map((f) => `<td>${cell(f, r[f.k])}</td>`).join("")}<td class="act">${acts(m, r)}</td></tr>`).join("")}</table>` : `<p>${t("empty")}</p>`;
  } };
}

/* ===================== restaurant tables ===================== */
function tblV() {
  return { frame: `${isM() ? `<form class="card grid" onsubmit="A.tadd2(event)"><input name="n" placeholder="${t("name")}" required><input name="s" type="number" placeholder="${t("seats")}"><button>${t("add")}</button></form>` : ""}<div id="tb" class="grid mt"></div>`, fill() {
    $("#tb").innerHTML = (S.tables || []).map((x) => { const tot = (x.lines || []).reduce((n, l) => n + l.qty * l.price, 0); return `<button class="card tb ${x.status || "free"}" onclick="A.tbo('${x.id}')"><b>${esc(x.name)}</b><small>${x.seats || ""} 👥</small><span class="badge">${t(x.status || "free")}</span>${tot ? `<div>${money(tot)}</div>` : ""}</button>`; }).join("") || `<p>${t("empty")}</p>`;
  } };
}
function tmodal() {
  const tot = (tcur.lines || []).reduce((n, l) => n + l.qty * l.price, 0);
  modal(`<h2>${esc(tcur.name)}</h2><div class="tiles">${(S.products || []).slice(0, 60).map((p) => `<button type="button" class="tile" onclick="A.tl('${p.id}')"><b>${esc(p.name)}</b><small>${money(p.price)}</small></button>`).join("")}</div><div class="mt">${(tcur.lines || []).map((l, i) => `<div class="row"><span style="flex:1">${esc(l.name)}</span><button class="ghost sm" onclick="A.tq(${i},-1)">−</button><b>${l.qty}</b><button class="ghost sm" onclick="A.tq(${i},1)">+</button></div>`).join("")}</div><p><b>${money(tot)}</b></p>
  <div class="row"><button onclick="A.tsave('busy')">${t("save")}</button><button onclick="A.tbill()">${t("checkout")}</button><button class="ghost" onclick="A.tsave('free')">${t("free")}</button><button class="ghost" onclick="A.tsave('reserved')">${t("reserved")}</button>${isM() ? `<button class="ghost" onclick="A.tdel()">${t("del")}</button>` : ""}</div>`);
}

/* ===================== appointments calendar ===================== */
function calV() {
  FS = fieldsOf("appointments"); cd = cd || ymd();
  return { frame: `<datalist id="dl_c">${(S.customers || []).map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist><datalist id="dl_s">${(S.products || []).map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist><datalist id="dl_t">${(S.staff || []).map((c) => `<option value="${esc(c.name)}">`).join("")}</datalist>${formHTML()}<div id="cw" class="tabs mt"></div><div id="cl2" class="mt"></div>`,
    init() { const f = $("#gf").elements; f.namedItem("client").setAttribute("list", "dl_c"); f.namedItem("service").setAttribute("list", "dl_s"); f.namedItem("staff").setAttribute("list", "dl_t"); f.namedItem("date").value = cd; },
    fill() {
      const days = [...Array(7)].map((_, i) => { const d = new Date(cd + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() - (biz.weekStart ?? 1) + 7) % 7) + i); return ymd(d); });
      $("#cw").innerHTML = days.map((d) => `<button class="${d === cd ? "on" : ""}" onclick="A.cday('${d}')">${new Date(d + "T12:00:00").toLocaleDateString(loc(), { weekday: "short", day: "numeric" })} (${(S.appointments || []).filter((a) => a.date === d).length})</button>`).join("");
      $("#cl2").innerHTML = (S.appointments || []).filter((a) => a.date === cd).sort((a, b) => ((a.time || "") < (b.time || "") ? -1 : 1)).map((a) => `<div class="card ap ${a.status}"><b>${esc(a.time || "")}</b> ${esc(a.client)} — ${esc(a.service || "")} <small>${esc(a.staff || "")}</small><span class="badge">${t(a.status)}</span><div class="act"><button class="ghost sm" onclick="A.ast('${a.id}','done')">✔</button><button class="ghost sm" onclick="A.ast('${a.id}','cancelled')">✖</button><button class="ghost sm" onclick="A.gedit('${a.id}')">${t("edit")}</button>${isM() ? `<button class="ghost sm" onclick="A.gdel('${a.id}')">${t("del")}</button>` : ""}</div></div>`).join("") || `<p>${t("empty")}</p>`;
    } };
}

/* ===================== kanban (projects, repairs) ===================== */
function kanV(m) {
  FS = fieldsOf(m); const st = FS.find((f) => f.k === "status").opts;
  return { frame: (canC(m) ? formHTML() : "") + `<div class="kan mt" id="kb" style="grid-template-columns:repeat(${st.length},minmax(210px,1fr))"></div>`, fill() {
    $("#kb").innerHTML = st.map((s, si) => `<div class="kc" ondragover="event.preventDefault()" ondrop="A.kdrop(event,'${s}')"><h3>${t(s)}</h3>${(S[m] || []).filter((x) => (x.status || st[0]) === s).map((x) => `<div class="card k" draggable="true" ondragstart="event.dataTransfer.setData('text','${x.id}')"><b>${esc(x[FS[0].k])}</b><div>${esc(x[FS[1].k] || "")}</div>${x.budget || x.cost ? `<div>${money(x.budget || x.cost)}</div>` : ""}${x.deadline ? `<small>${fd(x.deadline)}</small>` : ""}<div class="act">${si > 0 ? `<button class="ghost sm" onclick="A.kmv('${x.id}','${st[si - 1]}')">◀</button>` : ""}${si < st.length - 1 ? `<button class="ghost sm" onclick="A.kmv('${x.id}','${st[si + 1]}')">▶</button>` : ""}${canU(m) ? `<button class="ghost sm" onclick="A.gedit('${x.id}')">${t("edit")}</button>` : ""}${isM() ? `<button class="ghost sm" onclick="A.gdel('${x.id}')">${t("del")}</button>` : ""}</div></div>`).join("")}</div>`).join("");
  } };
}

/* ===================== attendance + salary ===================== */
function attV() {
  ad = ad || ymd();
  return { frame: `<input type="date" id="ad" value="${ad}" onchange="A.ad(this.value)" style="width:auto"><div id="at" class="card mt"></div><h2 class="mt">${t("salary")}</h2><div id="sl" class="card"></div>`, fill() {
    const st = S.staff || [], att = S.attendance || [], mon = ad.slice(0, 7);
    $("#at").innerHTML = st.length ? `<table>${st.map((s) => { const a = att.find((x) => x.id === ad + "_" + s.id); return `<tr><td>${esc(s.name)}</td><td>${["present", "late", "absent", "leave"].map((k) => `<button class="sm ${a?.status === k ? "" : "ghost"}" onclick="A.att('${s.id}','${k}')">${t(k)}</button>`).join("")}</td></tr>`; }).join("")}</table>` : `<p>${t("empty")}</p>`;
    $("#sl").innerHTML = `<table><tr><th>${t("name")}</th><th>${t("present")}</th><th>${t("salary")}</th><th>${t("due")}</th><th></th></tr>${st.map((s) => { const d = att.filter((x) => x.sid === s.id && (x.date || "").startsWith(mon) && ["present", "late"].includes(x.status)).length, due = rnd((+s.salary || 0) * d / (biz.workDays || 26)); return `<tr><td>${esc(s.name)}</td><td>${d}</td><td>${money(s.salary)}</td><td>${money(due)}</td><td><button class="ghost sm" onclick="A.paysal('${s.id}',${due})">${t("paySal")}</button></td></tr>`; }).join("")}</table>`;
  } };
}

/* ===================== reports + cash closing + import/export ===================== */
function repV() {
  return { frame: `<div class="tabs">${rangeTabs()}<input type="date" value="${rf}" onchange="A.rd('f',this.value)"><input type="date" value="${rt}" onchange="A.rd('t',this.value)"><button class="ghost" onclick="A.prep()">${t("print")}</button></div><div id="rs" class="card mt"></div><div id="rd" class="card mt"></div><div id="cc" class="card mt"></div><div class="card mt"><h2>${t("export")}</h2><div class="chips" id="ex"></div></div>
  <div class="card mt"><h2>${t("import")}</h2><div class="row"><select id="im">${cat.mods.filter((k) => MODS[k]?.f).map((k) => `<option value="${k}">${esc(title(k))}</option>`).join("")}</select><input id="if" type="file" accept=".csv"><button onclick="A.imp()">${t("import").split(" ")[0]}</button></div></div>`, fill() {
    const ss = okS().filter(inR), ex = (S.expenses || []).filter(inR), rev = sum(ss, "total"), cogs = ss.reduce((n, s) => n + cg(s), 0), E = sum(ex, "amount"), ret = (S.sales || []).filter((s) => s.status === "returned" && inR(s));
    const row = (k, v) => `<tr><td>${t(k)}</td><td><b>${money(v)}</b></td></tr>`;
    $("#rs").innerHTML = `<table>${row("revenue", rev)}${row("cogs", cogs)}${row("gross", rev - cogs)}${row("expenses", E)}${row("net", rev - cogs - E)}${row("taxCol", sum(ss, "tax"))}${row("returns", sum(ret, "total"))}${row("paymentsIn", sum((S.payments || []).filter((p) => p.cid && inR(p)), "amount"))}${row("purchasesT", sum((S.purchases || []).filter(inR), "total"))}${row("owed", sum(S.customers, "balance"))}</table>`;
    const days = {}; ss.forEach((s) => { const k = dkey(ms(s.createdAt)); (days[k] = days[k] || [0, 0])[0] += s.total - cg(s); }); ex.forEach((e) => { const k = dkey(ms(e.createdAt)); (days[k] = days[k] || [0, 0])[1] += +e.amount; });
    $("#rd").innerHTML = `<table><tr><th>${t("date")}</th><th>${t("gross")}</th><th>${t("expenses")}</th><th>${t("net")}</th></tr>${Object.entries(days).sort().reverse().map(([k, [a, b]]) => `<tr><td>${esc(k)}</td><td>${money(a)}</td><td>${money(b)}</td><td>${money(a - b)}</td></tr>`).join("")}</table>`;
    const td = ymd(), isT = (x) => dkey(ms(x.createdAt)) === td;
    const cin = okS().filter(isT).reduce((n, s) => n + (s.pay === "cash" ? s.total : s.pay === "udhaar" ? s.paid : 0), 0) + sum((S.payments || []).filter((p) => p.cid && isT(p) && p.method === "cash"), "amount");
    const cout = sum((S.expenses || []).filter(isT), "amount") + sum((S.purchases || []).filter(isT), "paid") + sum((S.payments || []).filter((p) => p.sid && isT(p)), "amount");
    $("#cc").innerHTML = `<h2>${t("closing")}</h2><p>${t("expected")}: <b>${money(rnd(cin - cout))}</b></p><div class="row"><input id="cc_n" type="number" step="any" placeholder="${t("counted")}"><button onclick="A.close(${rnd(cin - cout)})">${t("save")}</button></div>${(S.closings || []).slice(0, 5).map((c) => `<div class="row"><span>${esc(c.date)}</span><span>${t("expected")} ${money(c.expected)}</span><span>${t("counted")} ${money(c.counted)}</span><b>${t("diff")} ${money(c.diff)}</b></div>`).join("")}`;
    $("#ex").innerHTML = [...new Set([...cat.mods, "payments", "closings"])].filter((k) => canR(k) && S[k]).map((k) => `<button class="ghost" onclick="A.csv('${k}')">${esc(title(k) === k ? t(k) : title(k))}</button>`).join("");
  } };
}
const parseCSV = (s) => { const r = []; let row = [], v = "", q = false; s = s.replace(/^\ufeff/, ""); for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { v += '"'; i++; } else q = false; } else v += c; } else if (c === '"') q = true; else if (c === ",") { row.push(v); v = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(v); r.push(row); row = []; v = ""; } else v += c; } if (v || row.length) { row.push(v); r.push(row); } return r.filter((x) => x.some((y) => y.trim())); };
const cellv = (v) => v == null ? "" : v.toMillis ? new Date(v.toMillis()).toISOString() : Array.isArray(v) ? v.map((x) => typeof x === "object" ? Object.values(x).filter((y) => y !== "").join(" ") : x).join("; ") : typeof v === "object" ? JSON.stringify(v) : v;

/* ===================== team ===================== */
function teamV() {
  return { frame: `<form class="card grid" onsubmit="A.invite(event)"><input name="e" type="email" placeholder="${t("email")}" required><select name="r"><option value="staff">${t("r_staff")}</option><option value="manager">${t("r_manager")}</option></select><button>${t("invite")}</button></form><p class="muted">${t("inviteHint")}</p><div id="tm" class="card mt"></div><h2 class="mt">${t("activity")}</h2><div id="lg" class="card"></div>`, fill() {
    $("#tm").innerHTML = `<table>${(S.members || []).map((m) => `<tr><td>${esc(m.email || m.id)}</td><td>${m.role === "owner" ? t("r_owner") : `<select onchange="A.mrole('${m.id}',this.value)"><option value="staff" ${m.role === "staff" ? "selected" : ""}>${t("r_staff")}</option><option value="manager" ${m.role === "manager" ? "selected" : ""}>${t("r_manager")}</option></select>`}</td><td>${m.role === "owner" ? "" : `<button class="ghost sm" onclick="A.mdel('${m.id}')">${t("remove")}</button>`}</td></tr>`).join("")}</table>`;
    $("#lg").innerHTML = `<table>${(S.logs || []).slice(0, 40).map((l) => `<tr><td>${fdt(l.createdAt)}</td><td>${esc(l.u)}</td><td>${esc(l.a)}</td><td>${esc(l.d)}</td></tr>`).join("")}</table>`;
  } };
}

/* ===================== settings ===================== */
const ALLC = [...Object.keys(MODS), "payments", "closings", "logs"];
async function wipe(id) {
  for (const c of ALLC) { const s = await getDocs(collection(db, "businesses", id, c)).catch(() => null); if (!s) continue; for (let i = 0; i < s.docs.length; i += 400) { const b = writeBatch(db); s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); } }
  const m = await getDocs(collection(db, "businesses", id, "members")), b = writeBatch(db); m.docs.forEach((d) => b.delete(d.ref)); await b.commit();
  await deleteDoc(doc(db, "businesses", id));
}
function setV() {
  const inp = (k, v, type = "text") => `<label class="fld"><small>${t(k)}</small><input name="${k}" type="${type}" step="any" value="${esc(v ?? "")}"></label>`, chk = (k, v) => `<label class="row"><input type="checkbox" name="${k}" ${v ? "checked" : ""}> ${t(k)}</label>`;
  const tzs = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [];
  return { frame: `<form class="card grid" onsubmit="A.ssave(event)">${inp("name", biz.name).replace(t("name"), t("bizName"))}${inp("country", biz.country)}<label class="fld"><small>${t("currency")}</small><select name="currency">${CURRENCIES.map((c) => `<option ${c === biz.currency ? "selected" : ""}>${c}</option>`).join("")}</select></label>${inp("tax", biz.tax, "number")}${inp("taxId", biz.taxId)}
  <label class="fld"><small>${t("tz")}</small><input name="tz" list="tzl" value="${esc(biz.tz || "")}"><datalist id="tzl">${tzs.map((z) => `<option value="${z}">`).join("")}</datalist></label>
  <label class="fld"><small>${t("weekStart")}</small><select name="weekStart">${[[1, "Mon"], [0, "Sun"], [6, "Sat"]].map(([v, l]) => `<option value="${v}" ${+(biz.weekStart ?? 1) === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
  <label class="fld"><small>${t("decimals")}</small><select name="dec">${[0, 2, 3].map((v) => `<option ${+(biz.dec ?? 2) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>${inp("workDays", biz.workDays || 26, "number")}${inp("methods", biz.methods || "cash,card,bank,wallet")}${inp("footer", biz.footer)}${inp("ptsPer", biz.ptsPer || 100, "number")}${chk("taxInc", biz.taxInc)}${chk("hijri", biz.hijri)}${chk("loyalty", biz.loyalty)}<button>${t("save")}</button></form>
  <div id="bd"></div><div class="card mt row"><button class="ghost" onclick="A.backup()">${t("backup")}</button><button class="ghost" onclick="A.delbiz()">${t("delBiz")}</button></div>`,
    init() { if (biz.category === "custom") { B = toB(cat); bRender(); } } };
}

/* ===================== actions ===================== */
window.A = {
  x: () => { $("#ov").innerHTML = ""; },
  lang: (l) => { setLang(l); user ? (biz ? shell() : bizView()) : authView(); },
  toggle: () => { mode = mode === "login" ? "signup" : "login"; authView(); },
  auth: async (e) => { e.preventDefault(); try { if (mode === "login") await signInWithEmailAndPassword(auth, $("#em").value, $("#pw").value); else { const c = await createUserWithEmailAndPassword(auth, $("#em").value, $("#pw").value); sendEmailVerification(c.user).catch(() => {}); } } catch (x) { authView(x.message); } },
  google: async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (x) { authView(x.message); } },
  reset: async () => { const e = $("#em").value; if (!e) return; try { await sendPasswordResetEmail(auth, e); alert(t("resetSent")); } catch (x) { alert(x.message); } },
  resend: () => sendEmailVerification(user).then(() => alert(t("resetSent"))).catch((x) => alert(x.message)),
  chk: async () => { await user.reload(); await user.getIdToken(true); mapEmail(); bizView(); },
  out: () => { unwatch(); signOut(auth); },
  home: () => { unwatch(); bizView(); },
  nav: (m) => { mod = m; shell(); },
  rng: (k) => { rng = k; render(); },
  rd: (k, v) => { rng = "custom"; k === "f" ? (rf = v) : (rt = v); render(); },
  q: (v) => { qv = v; V.fill(); },
  hideOb: () => { localStorage["ob" + bid] = 1; V.fill(); },
  pick: (k) => { pick = k; document.querySelectorAll(".cat[data-k]").forEach((b) => b.classList.toggle("on", b.dataset.k === k)); if (k === "custom") { B = toB(CATS.grocery); B.name = ""; bRender(); } else $("#bd").innerHTML = ""; },
  btpl: (k) => { if (!k) return; bSync(); const n = B.name; B = toB(CATS[k]); B.name = n; bRender(); },
  bmv: (i, d) => { bSync(); const j = i + d; if (j < 0 || j >= B.mods.length) return; [B.mods[i], B.mods[j]] = [B.mods[j], B.mods[i]]; bRender(); },

  create: async (e) => {
    e.preventDefault(); if (!pick) return bizView(t("pickCat"));
    const f = e.target.elements, d = { name: f.bn.value.trim(), country: f.bc.value.trim(), currency: f.bu.value, tax: +f.bt.value || 0, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, methods: "cash,card,bank,wallet", category: pick, ownerId: user.uid, memberIds: [user.uid], createdAt: serverTimestamp() };
    if (pick === "custom") d.custom = fromB();
    const ref = doc(collection(db, "businesses")), b = writeBatch(db);
    b.set(ref, d); b.set(doc(db, "businesses", ref.id, "members", user.uid), { role: "owner", email: user.email || "" });
    await W(b.commit());
    const sm = (CATS[pick]?.samples || "").split(";").filter(Boolean);
    if (f.bs.checked && sm.length) { const b2 = writeBatch(db); sm.forEach((s) => { const [name, price, cost, stock] = s.split(","); b2.set(doc(collection(db, "businesses", ref.id, "products")), { name, price: +price, cost: +cost, stock: +stock, unit: "pcs", minStock: 5, barcode: "", createdAt: serverTimestamp() }); }); await W(b2.commit()); }
    A.open(ref.id);
  },
  open: async (id) => {
    bid = id; biz = (await getDoc(doc(db, "businesses", id))).data();
    role = (await getDoc(doc(db, "businesses", id, "members", user.uid))).data()?.role || "staff";
    cat = getCat(biz); mod = "dash"; cart = newC(); pcart = newC(); watch(); shell();
  },
  ssave: async (e) => {
    e.preventDefault(); const f = e.target.elements, o = { name: f.name.value.trim(), country: f.country.value, currency: f.currency.value, tax: +f.tax.value || 0, taxId: f.taxId.value, tz: f.tz.value.trim(), weekStart: +f.weekStart.value, dec: +f.dec.value, workDays: +f.workDays.value || 26, methods: f.methods.value, footer: f.footer.value, ptsPer: +f.ptsPer.value || 100, taxInc: f.taxInc.checked, hijri: f.hijri.checked, loyalty: f.loyalty.checked };
    try { if (o.tz) new Intl.DateTimeFormat("en", { timeZone: o.tz }); } catch { return alert("Invalid timezone"); }
    if (biz.category === "custom") o.custom = fromB();
    await W(updateDoc(doc(db, "businesses", bid), o)); biz = { ...biz, ...o }; cat = getCat(biz); log("settings"); shell();
  },
  backup: async () => { const o = { business: biz }; for (const c of ALLC) { const s = await getDocs(col(c)).catch(() => null); if (s) o[c] = s.docs.map((d) => ({ id: d.id, ...d.data() })); } const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(o, null, 1)], { type: "application/json" })); a.download = biz.name + "-backup.json"; a.click(); },
  delbiz: async () => { if (prompt(t("typeName")) !== biz.name) return; await wipe(bid); A.home(); },
  delacc: async () => { if (!confirm(t("sure"))) return; try { for (const b of MY.filter((x) => x.ownerId === user.uid)) await wipe(b.id); await deleteDoc(doc(db, "userByEmail", (user.email || "").toLowerCase())).catch(() => {}); await deleteUser(auth.currentUser); } catch (x) { alert(x.code === "auth/requires-recent-login" ? t("relogin") : x.message); } },
  combo: async () => {
    const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
    const out = await Promise.all(MY.map(async (b) => { const q = (c) => getDocs(query(collection(db, "businesses", b.id, c), where("createdAt", ">=", from))).then((s) => s.docs.map((d) => d.data())).catch(() => null); const [ss, ex] = await Promise.all([q("sales"), q("expenses")]), sl = (ss || []).filter((x) => x.status !== "returned"), rev = sum(sl, "total"); return { n: b.name, cur: b.currency, rev, p: rev - sl.reduce((n, x) => n + cg(x), 0) - sum(ex, "amount") }; }));
    const tot = {}; out.forEach((o) => { tot[o.cur] = tot[o.cur] || [0, 0]; tot[o.cur][0] += o.rev; tot[o.cur][1] += o.p; });
    modal(`<h2>${t("combo")}</h2><table><tr><th></th><th>${t("sales")}</th><th>${t("profit")}</th></tr>${out.map((o) => `<tr><td>${esc(o.n)}</td><td>${fm(o.rev, o.cur)}</td><td>${fm(o.p, o.cur)}</td></tr>`).join("")}${Object.entries(tot).map(([c, [r, p]]) => `<tr><th>Σ ${c}</th><th>${fm(r, c)}</th><th>${fm(p, c)}</th></tr>`).join("")}</table><button class="ghost full" onclick="A.x()">OK</button>`);
  },

  /* ---- generic forms ---- */
  gsave: async (e) => {
    e.preventDefault(); const o = {}; FS.forEach((f) => { const v = e.target.elements.namedItem(f.k).value; o[f.k] = f.type === "number" ? +v || 0 : v; });
    if (ed) await W(updateDoc(dr(mod, ed), o)); else await W(addDoc(col(mod), { ...o, createdAt: serverTimestamp() }));
    log(ed ? "edit" : "add", mod + ": " + (o.name || o.title || o.device || o.client || "")); A.gclr();
  },
  gclr: () => { ed = null; const f = $("#gf"); f?.reset(); if (mod === "appointments" && f) f.elements.namedItem("date").value = cd; },
  gedit: (id) => { ed = id; const r = S[mod].find((x) => x.id === id); FS.forEach((f) => { $("#gf").elements.namedItem(f.k).value = r[f.k] ?? ""; }); scrollTo(0, 0); },
  gdel: async (id) => { if (!confirm(t("sure"))) return; await W(deleteDoc(dr(mod, id))); log("delete", mod + " " + id); },
  kmv: (id, s) => W(updateDoc(dr(mod, id), { status: s })),
  kdrop: (e, s) => { e.preventDefault(); const id = e.dataTransfer.getData("text"); if (id) W(updateDoc(dr(mod, id), { status: s })); },
  ast: (id, s) => W(updateDoc(dr("appointments", id), { status: s })),
  cday: (d) => { cd = d; V.fill(); $("#gf").elements.namedItem("date").value = d; },

  /* ---- POS ---- */
  ps: () => pmFill(),
  pk: (e) => { if (e.key !== "Enter") return; e.preventDefault(); const v = e.target.value.trim(), l = (S.products || []).filter((p) => p.barcode === v || (p.name || "").toLowerCase() === v.toLowerCase()); const one = l[0] || ((S.products || []).filter((p) => (p.name || "").toLowerCase().includes(v.toLowerCase())).length === 1 ? (S.products || []).find((p) => (p.name || "").toLowerCase().includes(v.toLowerCase())) : null); if (one) { A.add(one.id); e.target.value = ""; pmFill(); } },
  scan: () => scan((code) => { if (!code) return; const p = (S.products || []).find((x) => x.barcode === code); if (p) A.add(p.id); else { $("#ps").value = code; pmFill(); } }),
  add: (id) => { const p = S.products.find((x) => x.id === id); if (!p) return; const c = C(), bp = PB ? +p.cost || 0 : +p.price || 0, ex = c.lines.find((l) => l.pid === id && l.mult === 1); if (ex) ex.qty++; else c.lines.push({ pid: id, name: p.name, qty: 1, price: bp, bp, cost: +p.cost || 0, mult: 1, unit: p.unit || "", pn: p.packName && +p.packQty > 0 ? p.packName : "", pq: +p.packQty || 1, pp: +p.packPrice || 0 }); cartUI(); },
  cadd: () => { const n = $("#ci_n").value.trim(), q = +$("#ci_q").value || 1, p = +$("#ci_p").value || 0; if (!n) return; cart.lines.push({ pid: "", name: n, qty: q, price: p, bp: p, cost: 0, mult: 1, unit: "", pn: "" }); $("#ci_n").value = ""; cartUI(); },
  lq: (i, v) => { C().lines[i].qty = +v || 0; totUI(); },
  lp: (i, v) => { C().lines[i].price = +v || 0; totUI(); },
  lu: (i, v) => { const l = C().lines[i]; if (v === "1") { l.mult = l.pq; l.price = PB ? l.bp * l.pq : l.pp || l.bp * l.pq; } else { l.mult = 1; l.price = l.bp; } cartUI(); },
  lr: (i) => { C().lines.splice(i, 1); cartUI(); },
  ctl: () => { const c = C(); if ($("#c_d")) c.disc = Math.min(100, +$("#c_d").value || 0); if ($("#c_p")) c.pay = $("#c_p").value; const s = $("#c_c").value; PB ? (c.sid = s) : (c.cid = s); c.paid = $("#c_a").value; c.note = $("#c_n").value; totUI(); },
  checkout: async () => {
    A.ctl(); const c = C(); if (!c.lines.length) return; if (c.lines.some((l) => !(l.qty > 0))) return alert(t("badQty"));
    const no = Date.now().toString(36).toUpperCase().slice(-6), by = user.email || user.uid, b = writeBatch(db);
    if (PB) {
      const total = rnd(c.lines.reduce((n, l) => n + l.qty * l.price, 0)), paid = c.paid === "" ? total : Math.min(total, +c.paid || 0), sup = (S.suppliers || []).find((x) => x.id === c.sid);
      b.set(doc(col("purchases")), { no, lines: c.lines.map((l) => ({ pid: l.pid, name: l.name, qty: l.qty, price: l.price, cost: l.price / (l.mult || 1), mult: l.mult || 1, unit: l.unit || "" })), total, paid, sid: c.sid, supplier: sup?.name || "", note: c.note, by, createdAt: serverTimestamp() });
      c.lines.forEach((l) => b.update(dr("products", l.pid), { stock: increment(l.qty * (l.mult || 1)), cost: l.price / (l.mult || 1) }));
      if (sup && total - paid > 0) b.update(dr("suppliers", sup.id), { due: increment(rnd(total - paid)) });
      await W(b.commit()); log("purchase", no + " " + money(total)); pcart = newC(); setCtl(); cartUI(); return;
    }
    const pay = c.pay || methods()[0], x = calc(c.lines, c.disc), total = x.total, cu = (S.customers || []).find((y) => y.id === c.cid), paid = pay === "udhaar" ? Math.min(total, +c.paid || 0) : total;
    if (pay === "udhaar") { if (!cu) return alert(t("needCust")); if (+cu.limit > 0 && (+cu.balance || 0) + (total - paid) > +cu.limit && !confirm(t("overLimit"))) return; }
    const need = {}; c.lines.forEach((l) => l.pid && (need[l.pid] = (need[l.pid] || 0) + l.qty * (l.mult || 1)));
    if (Object.entries(need).some(([id, n]) => { const p = (S.products || []).find((y) => y.id === id); return p && (+p.stock || 0) < n; }) && !confirm(t("stockLow"))) return;
    const ref = doc(col("sales")), sale = { no, lines: c.lines.map((l) => ({ pid: l.pid || "", name: l.name, qty: l.qty, price: l.price, cost: l.cost || 0, mult: l.mult || 1, unit: l.unit || "" })), sub: x.sub, disc: c.disc, tax: x.tax, total, pay, paid, cid: cu?.id || "", customer: cu?.name || "", note: c.note, status: "ok", by };
    b.set(ref, { ...sale, createdAt: serverTimestamp() });
    Object.entries(need).forEach(([id, n]) => { if ((S.products || []).some((p) => p.id === id)) b.update(dr("products", id), { stock: increment(-n) }); });
    if (cu) { const u = {}; if (pay === "udhaar") u.balance = increment(rnd(total - paid)); if (biz.loyalty) { const pts = Math.floor(total / (biz.ptsPer || 100)); if (pts) u.points = increment(pts); } if (Object.keys(u).length) b.update(dr("customers", cu.id), u); }
    if (c.tid) b.update(dr("tables", c.tid), { status: "free", lines: [] });
    lastSale = { ...sale, id: ref.id, createdAt: Date.now() };
    await W(b.commit()); log("sale", no + " " + money(total)); cart = newC(); setCtl(); cartUI();
    modal(`<h2>✔ ${t("saved")}</h2><pre>${esc(rcText(lastSale))}</pre><div class="row"><button onclick="A.rc('${ref.id}')">${t("print")}</button><button onclick="A.wa('${ref.id}')">${t("wa")}</button><button class="ghost" onclick="A.x()">OK</button></div>`);
  },
  rc: (id) => pw(rcText(findSale(id))),
  wa: (id) => { const s = findSale(id), cu = (S.customers || []).find((x) => x.id === s.cid); window.open("https://wa.me/" + (cu?.phone || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(rcText(s))); },
  ret: async (id) => {
    const s = S.sales.find((x) => x.id === id); if (!s || s.status === "returned" || !confirm(t("sure"))) return; const b = writeBatch(db), need = {};
    b.update(dr("sales", id), { status: "returned", returnedAt: serverTimestamp() });
    (s.lines || []).forEach((l) => l.pid && (need[l.pid] = (need[l.pid] || 0) + l.qty * (l.mult || 1)));
    Object.entries(need).forEach(([pid, n]) => { if (S.products.some((p) => p.id === pid)) b.update(dr("products", pid), { stock: increment(n) }); });
    if (s.pay === "udhaar" && S.customers.some((c) => c.id === s.cid)) b.update(dr("customers", s.cid), { balance: increment(-rnd(s.total - s.paid)) });
    await W(b.commit()); log("return", s.no);
  },

  /* ---- customers / suppliers money ---- */
  rcv: (id) => { const c = S.customers.find((x) => x.id === id); modal(`<h2>${esc(c.name)}</h2><p>${t("owed")}: <b>${money(c.balance)}</b></p><input id="m_a" type="number" step="any" placeholder="${t("amount")}"><select id="m_m" class="mt">${methods().map((m) => `<option value="${esc(m)}">${esc(t(m))}</option>`).join("")}</select><button class="full" onclick="A.rcv2('${id}')">${t("save")}</button>`); },
  rcv2: async (id) => { const a = +$("#m_a").value, c = S.customers.find((x) => x.id === id); if (!a) return; const b = writeBatch(db); b.set(doc(col("payments")), { cid: id, customer: c.name, amount: a, method: $("#m_m").value, by: user.email || user.uid, createdAt: serverTimestamp() }); b.update(dr("customers", id), { balance: increment(-a) }); A.x(); await W(b.commit()); log("payment", c.name + " " + money(a)); },
  pays: (id) => { const c = S.suppliers.find((x) => x.id === id); modal(`<h2>${esc(c.name)}</h2><p>${t("due")}: <b>${money(c.due)}</b></p><input id="m_a" type="number" step="any" placeholder="${t("amount")}"><select id="m_m" class="mt">${methods().map((m) => `<option value="${esc(m)}">${esc(t(m))}</option>`).join("")}</select><button class="full" onclick="A.pays2('${id}')">${t("save")}</button>`); },
  pays2: async (id) => { const a = +$("#m_a").value, c = S.suppliers.find((x) => x.id === id); if (!a) return; const b = writeBatch(db); b.set(doc(col("payments")), { sid: id, supplier: c.name, amount: a, method: $("#m_m").value, by: user.email || user.uid, createdAt: serverTimestamp() }); b.update(dr("suppliers", id), { due: increment(-a) }); A.x(); await W(b.commit()); log("pay-supplier", c.name + " " + money(a)); },
  led: (id) => {
    const c = S.customers.find((x) => x.id === id), ev = [...(S.sales || []).filter((s) => s.cid === id && s.status !== "returned" && s.pay === "udhaar").map((s) => ({ at: ms(s.createdAt), d: "#" + s.no, v: s.total - s.paid })), ...(S.payments || []).filter((p) => p.cid === id).map((p) => ({ at: ms(p.createdAt), d: t("payRcv") + " (" + t(p.method) + ")", v: -p.amount }))].sort((a, b) => a.at - b.at); let run = 0;
    modal(`<h2>${esc(c.name)}</h2><table>${ev.map((e) => { run += e.v; return `<tr><td>${fdt(e.at)}</td><td>${esc(e.d)}</td><td>${money(e.v)}</td><td>${money(run)}</td></tr>`; }).join("")}</table><p><b>${t("owed")}: ${money(c.balance)}</b></p><button class="ghost" onclick="A.x()">OK</button>`);
  },
  rem: (id) => { const c = S.customers.find((x) => x.id === id); window.open("https://wa.me/" + (c.phone || "").replace(/\D/g, "") + "?text=" + encodeURIComponent(t("remindMsg").replace("{n}", c.name).replace("{a}", money(c.balance)).replace("{b}", biz.name))); },

  /* ---- tables ---- */
  tadd2: async (e) => { e.preventDefault(); const f = e.target.elements; await W(addDoc(col("tables"), { name: f.n.value, seats: +f.s.value || 0, status: "free", lines: [], createdAt: serverTimestamp() })); e.target.reset(); },
  tbo: (id) => { tcur = JSON.parse(JSON.stringify(S.tables.find((x) => x.id === id))); tcur.lines = tcur.lines || []; tmodal(); },
  tl: (pid) => { const p = S.products.find((x) => x.id === pid), l = tcur.lines.find((x) => x.pid === pid); l ? l.qty++ : tcur.lines.push({ pid, name: p.name, qty: 1, price: +p.price || 0, cost: +p.cost || 0, mult: 1, unit: p.unit || "" }); tmodal(); },
  tq: (i, d) => { tcur.lines[i].qty += d; if (tcur.lines[i].qty <= 0) tcur.lines.splice(i, 1); tmodal(); },
  tsave: async (st) => { await W(updateDoc(dr("tables", tcur.id), { status: st, lines: st === "free" ? [] : tcur.lines })); A.x(); },
  tdel: async () => { if (!confirm(t("sure"))) return; await W(deleteDoc(dr("tables", tcur.id))); A.x(); },
  tbill: async () => { await W(updateDoc(dr("tables", tcur.id), { status: "busy", lines: tcur.lines })); cart = newC(); cart.lines = tcur.lines.map((l) => ({ ...l, bp: l.price, pn: "" })); cart.tid = tcur.id; mod = "sales"; A.x(); shell(); },

  /* ---- attendance ---- */
  ad: (v) => { ad = v; V.fill(); },
  att: (sid, k) => { const s = S.staff.find((x) => x.id === sid); W(setDoc(doc(db, "businesses", bid, "attendance", ad + "_" + sid), { sid, name: s.name, date: ad, status: k, createdAt: serverTimestamp() })); },
  paysal: async (sid, due) => { const s = S.staff.find((x) => x.id === sid), a = +prompt(s.name + " — " + t("paySal"), due); if (!a) return; await W(addDoc(col("expenses"), { title: "Salary - " + s.name, type: "salary", amount: a, date: ymd(), createdAt: serverTimestamp() })); log("salary", s.name + " " + money(a)); },

  /* ---- reports ---- */
  close: async (exp) => { const n = +$("#cc_n").value; if (isNaN(n) || $("#cc_n").value === "") return; await W(addDoc(col("closings"), { date: ymd(), expected: exp, counted: n, diff: rnd(n - exp), by: user.email || user.uid, createdAt: serverTimestamp() })); },
  prep: () => pw(`${biz.name}\n${t("reports")} (${rng === "custom" ? rf + " → " + rt : t(rng)})\n\n` + [...document.querySelectorAll("#rs tr")].map((tr) => [...tr.cells].map((c) => c.textContent).join(": ")).join("\n")),
  csv: (k) => { const r = S[k] || [], h = [...new Set(r.flatMap((x) => Object.keys(x)))].filter((x) => x !== "id"), s = "\ufeff" + [h, ...r.map((x) => h.map((y) => `"${String(cellv(x[y])).replace(/"/g, '""')}"`))].map((x) => x.join(",")).join("\n"), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([s], { type: "text/csv" })); a.download = k + ".csv"; a.click(); },
  imp: async () => {
    const m = $("#im").value, file = $("#if").files[0]; if (!file) return; const rows = parseCSV(await file.text()), h = rows.shift().map((x) => x.trim()), fs = fieldsOf(m);
    for (let i = 0; i < rows.length; i += 400) { const b = writeBatch(db); rows.slice(i, i + 400).forEach((r) => { const o = {}; h.forEach((k, j) => { const f = fs.find((x) => x.k === k); if (f) o[k] = f.type === "number" ? +r[j] || 0 : r[j]; }); b.set(doc(col(m)), { ...o, createdAt: serverTimestamp() }); }); await b.commit(); }
    alert(t("importDone") + ": " + rows.length);
  },

  /* ---- team ---- */
  invite: async (e) => {
    e.preventDefault(); const em = e.target.elements.e.value.trim().toLowerCase(), r = e.target.elements.r.value, s = await getDoc(doc(db, "userByEmail", em));
    if (!s.exists()) return alert(t("noUser")); const uid = s.data().uid, b = writeBatch(db);
    b.set(doc(db, "businesses", bid, "members", uid), { role: r, email: em }); b.update(doc(db, "businesses", bid), { memberIds: arrayUnion(uid) });
    await W(b.commit()); log("invite", em + " " + r); e.target.reset();
  },
  mrole: (uid, r) => W(updateDoc(doc(db, "businesses", bid, "members", uid), { role: r })),
  mdel: async (uid) => { if (!confirm(t("sure"))) return; const b = writeBatch(db); b.delete(doc(db, "businesses", bid, "members", uid)); b.update(doc(db, "businesses", bid), { memberIds: arrayRemove(uid) }); await W(b.commit()); }
};

/* ===================== start ===================== */
onAuthStateChanged(auth, (u) => { user = u; if (u) { mapEmail(); bizView(); } else { unwatch(); authView(); } });
const off = () => { document.body.dataset.off = t("offline"); document.body.classList.toggle("off", !navigator.onLine); };
addEventListener("online", off); addEventListener("offline", off); off();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
