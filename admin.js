// ============================================
// ALPINESTORES — Admin dashboard logic
// Security = Appwrite permissions (label "admin").
// This file only controls what is shown.
// ============================================

const $ = (id) => document.getElementById(id);
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect width="200" height="140" fill="#111"/></svg>');

let cars = [];
let reqs = [];
let editing = null; // { id, mainImageId, gallery:[ids], removed:[ids] }
let subscribed = false;

const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// ---------- AUTH ----------
function isAdmin(user) {
  return user && Array.isArray(user.labels) && user.labels.includes("admin");
}

async function showApp(user) {
  if (!isAdmin(user)) {
    $("loginError").textContent = "This account does not have admin access.";
    try { await account.deleteSession("current"); } catch (e) {}
    $("loginView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    return;
  }
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  await Promise.all([loadCars(), loadRequests()]);
  startRealtime();
}

async function checkSession() {
  try {
    const user = await account.get();
    await showApp(user);
  } catch (e) {
    $("loginView").classList.remove("hidden");
  }
}

$("loginBtn").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();
  const pass = $("loginPass").value;
  const err = $("loginError");
  err.textContent = "";
  if (!email || !pass) { err.textContent = "Enter email and password."; return; }
  $("loginBtn").disabled = true;
  try {
    try { await account.deleteSession("current"); } catch (e) {}
    await account.createEmailPasswordSession(email, pass);
    const user = await account.get();
    await showApp(user);
  } catch (e) {
    err.textContent = "Login failed: " + e.message;
  }
  $("loginBtn").disabled = false;
});
$("loginPass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("loginBtn").click(); });

$("logoutBtn").addEventListener("click", async () => {
  try { await account.deleteSession("current"); } catch (e) {}
  location.reload();
});

// ---------- TABS ----------
document.querySelectorAll(".tab").forEach((t) =>
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
    $(t.dataset.tab).classList.remove("hidden");
  })
);

// ---------- CARS ----------
async function loadCars() {
  try {
    const res = await databases.listDocuments(CONFIG.databaseId, CONFIG.carsCollectionId, [
      Query.orderAsc("sortOrder"),
      Query.limit(200),
    ]);
    cars = res.documents;
    renderCars();
  } catch (e) {
    toast("Could not load cars: " + e.message);
  }
}

function renderCars() {
  const box = $("carList");
  box.innerHTML = "";
  if (!cars.length) { box.appendChild(el("p", "hint", "No cars yet. Click “+ Add Car”.")); return; }

  cars.forEach((car, i) => {
    const row = el("div", "row");
    const img = el("img");
    img.src = car.mainImageId ? imageUrl(car.mainImageId) : PLACEHOLDER;
    img.onerror = () => { img.src = PLACEHOLDER; };
    row.appendChild(img);

    const meta = el("div", "meta");
    meta.appendChild(el("div", "name", (i + 1) + ". " + car.name));
    meta.appendChild(el("div", "price", inr(car.price)));
    meta.appendChild(el("span", "tag " + (car.status === "sold" ? "sold" : "available"), car.status === "sold" ? "SOLD" : "AVAILABLE"));
    row.appendChild(meta);

    const act = el("div", "actions");
    const up = el("button", "mini", "▲"); up.disabled = i === 0;
    up.onclick = () => moveCar(i, -1);
    const dn = el("button", "mini", "▼"); dn.disabled = i === cars.length - 1;
    dn.onclick = () => moveCar(i, 1);
    const tg = el("button", "mini", car.status === "sold" ? "Mark Available" : "Mark Sold");
    tg.onclick = () => toggleStatus(car);
    const ed = el("button", "mini", "Edit");
    ed.onclick = () => openEditor(car);
    const de = el("button", "mini danger", "Delete");
    de.onclick = () => deleteCar(car);
    [up, dn, tg, ed, de].forEach((b) => act.appendChild(b));
    row.appendChild(act);
    box.appendChild(row);
  });
}

async function moveCar(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= cars.length) return;
  const arr = cars.slice();
  [arr[i], arr[j]] = [arr[j], arr[i]];
  try {
    for (let k = 0; k < arr.length; k++) {
      if (arr[k].sortOrder !== k + 1) {
        await databases.updateDocument(CONFIG.databaseId, CONFIG.carsCollectionId, arr[k].$id, { sortOrder: k + 1 });
      }
    }
    await loadCars();
  } catch (e) { toast("Reorder failed: " + e.message); }
}

async function toggleStatus(car) {
  const status = car.status === "sold" ? "available" : "sold";
  try {
    await databases.updateDocument(CONFIG.databaseId, CONFIG.carsCollectionId, car.$id, { status });
    toast("Marked " + status);
    await loadCars();
  } catch (e) { toast("Failed: " + e.message); }
}

async function deleteCar(car) {
  if (!confirm("Delete “" + car.name + "” permanently, including its images?")) return;
  try {
    await databases.deleteDocument(CONFIG.databaseId, CONFIG.carsCollectionId, car.$id);
    const ids = [car.mainImageId, ...(car.galleryImageIds || [])].filter(Boolean);
    for (const id of ids) { try { await deleteImage(id); } catch (e) {} }
    toast("Car deleted");
    await loadCars();
  } catch (e) { toast("Delete failed: " + e.message); }
}

// ---------- EDITOR ----------
function openEditor(car) {
  editing = car
    ? { id: car.$id, mainImageId: car.mainImageId, gallery: (car.galleryImageIds || []).slice(), removed: [] }
    : { id: null, mainImageId: null, gallery: [], removed: [] };

  $("editorTitle").textContent = car ? "Edit Car" : "Add Car";
  $("fName").value = car ? car.name : "";
  $("fPrice").value = car ? car.price : "";
  $("fDesc").value = car ? car.description || "" : "";
  $("fCustom").value = car ? car.customization || "" : "";
  $("fStatus").value = car ? car.status || "available" : "available";
  $("fMain").value = "";
  $("fGallery").value = "";
  $("mainHint").textContent = car ? "(leave empty to keep current)" : "(required)";
  $("editorError").textContent = "";
  $("editorProgress").textContent = "";
  $("editorSave").disabled = false;
  renderEditorThumbs();
  $("editorModal").classList.add("open");
}
function closeEditor() { $("editorModal").classList.remove("open"); editing = null; }

function thumb(src, onRemove) {
  const t = el("div", "thumb");
  const im = el("img");
  im.src = src;
  im.onerror = () => { im.src = PLACEHOLDER; };
  t.appendChild(im);
  if (onRemove) {
    const x = el("button", "", "×");
    x.type = "button";
    x.onclick = onRemove;
    t.appendChild(x);
  }
  return t;
}

function renderEditorThumbs() {
  const m = $("mainPreview");
  m.innerHTML = "";
  if (editing.mainImageId) m.appendChild(thumb(imageUrl(editing.mainImageId)));
  const g = $("galleryPreview");
  g.innerHTML = "";
  editing.gallery.forEach((id) =>
    g.appendChild(thumb(imageUrl(id), () => {
      editing.gallery = editing.gallery.filter((x) => x !== id);
      editing.removed.push(id);
      renderEditorThumbs();
    }))
  );
}

$("addCarBtn").addEventListener("click", () => openEditor(null));
$("editorClose").addEventListener("click", closeEditor);
$("editorCancel").addEventListener("click", closeEditor);

// Uploads one image to Pronto and returns the reference saved in the database
async function uploadFile(file) {
  return await uploadImage(file);
}

$("editorSave").addEventListener("click", async () => {
  const err = $("editorError");
  const prog = $("editorProgress");
  err.textContent = "";

  const name = $("fName").value.trim();
  const price = parseInt($("fPrice").value, 10);
  const mainFile = $("fMain").files[0];
  const galleryFiles = Array.from($("fGallery").files);

  if (!name) { err.textContent = "Enter the car name."; return; }
  if (isNaN(price) || price < 0) { err.textContent = "Enter a valid price."; return; }
  if (!editing.id && !mainFile) { err.textContent = "Please choose a main image."; return; }
  const all = [mainFile, ...galleryFiles].filter(Boolean);
  for (const f of all) {
    if (f.size > 10 * 1024 * 1024) { err.textContent = f.name + " is larger than 10 MB."; return; }
  }

  $("editorSave").disabled = true;
  const uploaded = []; // so we can clean up if saving fails
  try {
    let mainImageId = editing.mainImageId;
    let oldMain = null;
    if (mainFile) {
      prog.textContent = "Uploading main image...";
      const id = await uploadFile(mainFile);
      uploaded.push(id);
      oldMain = editing.mainImageId;
      mainImageId = id;
    }
    const gallery = editing.gallery.slice();
    for (let i = 0; i < galleryFiles.length; i++) {
      prog.textContent = "Uploading image " + (i + 1) + " of " + galleryFiles.length + "...";
      const id = await uploadFile(galleryFiles[i]);
      uploaded.push(id);
      gallery.push(id);
    }

    prog.textContent = "Saving...";
    const data = {
      name,
      price,
      description: $("fDesc").value.trim(),
      customization: $("fCustom").value.trim(),
      status: $("fStatus").value,
      mainImageId,
      galleryImageIds: gallery,
    };

    if (editing.id) {
      await databases.updateDocument(CONFIG.databaseId, CONFIG.carsCollectionId, editing.id, data);
    } else {
      data.sortOrder = cars.reduce((m, c) => Math.max(m, c.sortOrder || 0), 0) + 1;
      await databases.createDocument(CONFIG.databaseId, CONFIG.carsCollectionId, ID.unique(), data);
    }

    // clean up replaced / removed images
    const toDelete = editing.removed.slice();
    if (oldMain) toDelete.push(oldMain);
    for (const id of toDelete) { try { await deleteImage(id); } catch (e) {} }

    toast("Car saved");
    closeEditor();
    await loadCars();
  } catch (e) {
    for (const id of uploaded) { try { await deleteImage(id); } catch (x) {} }
    err.textContent = "Save failed: " + e.message;
    prog.textContent = "";
    $("editorSave").disabled = false;
  }
});

// ---------- PURCHASE REQUESTS ----------
async function loadRequests() {
  try {
    const res = await databases.listDocuments(CONFIG.databaseId, CONFIG.requestsCollectionId, [
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
    reqs = res.documents;
    renderRequests();
  } catch (e) {
    toast("Could not load requests: " + e.message);
  }
}

function renderRequests() {
  const newCount = reqs.filter((r) => r.status === "new").length;
  const badge = $("reqBadge");
  badge.textContent = newCount;
  badge.classList.toggle("hidden", newCount === 0);

  const box = $("reqList");
  box.innerHTML = "";
  if (!reqs.length) { box.appendChild(el("p", "hint", "No purchase requests yet.")); return; }

  reqs.forEach((r) => {
    const row = el("div", "row req" + (r.status === "new" ? " is-new" : ""));

    const top = el("div", "req-top");
    top.appendChild(el("div", "name", r.carName + " — " + inr(r.price)));
    top.appendChild(el("small", "", new Date(r.$createdAt).toLocaleString()));
    row.appendChild(top);

    const grid = el("div", "req-grid");
    [["Customer", r.customerName], ["CPM ID", r.cpmId], ["Contact", r.contact]].forEach(([k, v]) => {
      const d = el("div");
      d.appendChild(el("small", "", k));
      d.appendChild(el("span", "", v));
      grid.appendChild(d);
    });
    row.appendChild(grid);

    const act = el("div", "actions");
    const sel = el("select");
    ["new", "contacted", "completed", "rejected"].forEach((s) => {
      const o = el("option", "", s.toUpperCase());
      o.value = s;
      if (r.status === s) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = async () => {
      try {
        await databases.updateDocument(CONFIG.databaseId, CONFIG.requestsCollectionId, r.$id, { status: sel.value });
        await loadRequests();
      } catch (e) { toast("Failed: " + e.message); }
    };
    const del = el("button", "mini danger", "Delete");
    del.onclick = async () => {
      if (!confirm("Delete this request?")) return;
      try {
        await databases.deleteDocument(CONFIG.databaseId, CONFIG.requestsCollectionId, r.$id);
        await loadRequests();
      } catch (e) { toast("Failed: " + e.message); }
    };
    act.appendChild(sel);
    act.appendChild(del);
    row.appendChild(act);
    box.appendChild(row);
  });
}

// ---------- REALTIME: new purchase request alert ----------
function startRealtime() {
  if (subscribed) return;
  subscribed = true;
  try {
    client.subscribe(
      "databases." + CONFIG.databaseId + ".collections." + CONFIG.requestsCollectionId + ".documents",
      (resp) => {
        const isCreate = (resp.events || []).some((e) => e.endsWith(".create"));
        if (isCreate) {
          beep();
          const p = resp.payload || {};
          toast("🔔 New request: " + (p.customerName || "") + " → " + (p.carName || ""));
        }
        loadRequests();
      }
    );
  } catch (e) {}
}

checkSession();
