// ============================================
// ALPINESTORES — Public showcase logic
// ============================================

// ---- EDIT THIS: your support contacts (leave "" to hide one) ----
const SUPPORT = {
  whatsapp: "",   // digits only with country code, e.g. "919876543210"
  telegram: "",   // username without @, e.g. "alpinestores"
  instagram: "",  // username without @
  email: "",      // e.g. "support@example.com"
};
const NEW_DAYS = 7; // a car shows "NEW" for this many days

const $ = (id) => document.getElementById(id);
const PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#111"/><text x="400" y="235" fill="#F5C518" font-family="Arial" font-size="26" text-anchor="middle" letter-spacing="4">NO IMAGE</text></svg>'
  );

let cars = [];
let index = 0;
let busy = false;
let buyCar = null;

// ---------- helpers ----------
const pad2 = (n) => String(n).padStart(2, "0");
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const isSold = (c) => c.status === "sold";
const isNew = (c) => Date.now() - new Date(c.$createdAt).getTime() < NEW_DAYS * 86400000;

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function preload(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(PLACEHOLDER);
    img.src = url;
  });
}

function carImageUrl(car) {
  return car.mainImageId ? imageUrl(car.mainImageId) : PLACEHOLDER;
}

// ---------- wishlist (saved in this browser) ----------
const WL_KEY = "alpine_wishlist";
function getWish() {
  try { return JSON.parse(localStorage.getItem(WL_KEY)) || []; } catch (e) { return []; }
}
function setWish(list) {
  try { localStorage.setItem(WL_KEY, JSON.stringify(list)); } catch (e) {}
}
function updateWishUI() {
  const ids = getWish().filter((id) => cars.some((c) => c.$id === id));
  const badge = $("wishCount");
  badge.textContent = ids.length;
  badge.classList.toggle("hidden", ids.length === 0);
  const car = cars[index];
  $("heartBtn").classList.toggle("on", !!car && ids.includes(car.$id));
}
function toggleWish() {
  const car = cars[index];
  if (!car) return;
  let ids = getWish();
  if (ids.includes(car.$id)) {
    ids = ids.filter((id) => id !== car.$id);
    toast("Removed from wishlist");
  } else {
    ids.push(car.$id);
    toast("Added to wishlist");
  }
  setWish(ids);
  updateWishUI();
}

// ---------- modals ----------
function openModal(id) { $(id).classList.add("open"); }
function closeModals() { document.querySelectorAll(".modal.open").forEach((m) => m.classList.remove("open")); }
const modalOpen = () => !!document.querySelector(".modal.open");

document.querySelectorAll(".modal").forEach((m) =>
  m.addEventListener("click", (e) => { if (e.target === m) closeModals(); })
);
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModals));

// ---------- showcase rendering ----------
const carImg = $("carImg");
const info = $("info");
let bgToggle = false;

function setBackground(url) {
  const next = bgToggle ? $("bgA") : $("bgB");
  const prev = bgToggle ? $("bgB") : $("bgA");
  next.style.backgroundImage = 'url("' + url + '")';
  next.classList.add("active");
  prev.classList.remove("active");
  bgToggle = !bgToggle;
}

function fillInfo(car, url) {
  carImg.src = url;
  carImg.alt = car.name;
  $("carName").textContent = car.name;
  $("carPrice").textContent = inr(car.price);
  $("carDesc").textContent = car.description || "";
  $("counterNow").textContent = pad2(index + 1);
  $("counterTotal").textContent = pad2(cars.length);

  const sold = isSold(car);
  const st = $("statusBadge");
  st.textContent = sold ? "SOLD OUT" : "AVAILABLE";
  st.classList.toggle("sold", sold);
  $("newBadge").classList.toggle("hidden", !isNew(car) || sold);

  const buy = $("buyBtn");
  buy.disabled = sold;
  buy.textContent = sold ? "SOLD OUT" : "BUY NOW";
  updateWishUI();
}

async function showInstant() {
  const car = cars[index];
  const url = await preload(carImageUrl(car));
  fillInfo(car, url);
  setBackground(url);
}

function go(newIndex, dir) {
  if (busy || !cars.length) return;
  newIndex = (newIndex + cars.length) % cars.length;
  if (newIndex === index && cars.length === 1) return;
  busy = true;
  const out = dir >= 0 ? "out-left" : "out-right";
  const inn = dir >= 0 ? "out-right" : "out-left";
  carImg.classList.add(out);
  info.classList.add("fade");

  const car = cars[newIndex];
  const loading = preload(carImageUrl(car));

  setTimeout(async () => {
    const url = await loading;
    index = newIndex;
    fillInfo(car, url);
    setBackground(url);
    carImg.classList.add("no-anim");
    carImg.classList.remove(out);
    carImg.classList.add(inn);
    void carImg.offsetWidth; // restart animation
    carImg.classList.remove("no-anim");
    carImg.classList.remove(inn);
    info.classList.remove("fade");
    setTimeout(() => { busy = false; }, 500);
  }, 380);
}

const next = () => go(index + 1, 1);
const prev = () => go(index - 1, -1);

function jumpTo(i) {
  if (i === index) return;
  go(i, i > index ? 1 : -1);
}

// ---------- navigation: arrows, keyboard, swipe ----------
$("nextBtn").addEventListener("click", next);
$("prevBtn").addEventListener("click", prev);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModals(); return; }
  if (modalOpen()) return;
  const tag = (document.activeElement && document.activeElement.tagName) || "";
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.key === "ArrowRight") next();
  if (e.key === "ArrowLeft") prev();
});

let sx = 0, sy = 0;
const showcase = $("showcase");
showcase.addEventListener("touchstart", (e) => {
  sx = e.touches[0].clientX; sy = e.touches[0].clientY;
}, { passive: true });
showcase.addEventListener("touchend", (e) => {
  if (modalOpen()) return;
  const dx = e.changedTouches[0].clientX - sx;
  const dy = e.changedTouches[0].clientY - sy;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); }
}, { passive: true });

// ---------- details modal ----------
function openDetails() {
  const car = cars[index];
  if (!car) return;
  const main = $("detMainImg");
  const ids = [car.mainImageId, ...(car.galleryImageIds || [])].filter(Boolean);
  main.src = ids.length ? imageUrl(ids[0]) : PLACEHOLDER;
  main.onerror = () => { main.src = PLACEHOLDER; };

  const thumbs = $("detThumbs");
  thumbs.innerHTML = "";
  if (ids.length > 1) {
    ids.forEach((id, i) => {
      const t = document.createElement("img");
      t.src = imageUrl(id);
      t.alt = "Photo " + (i + 1);
      if (i === 0) t.classList.add("active");
      t.addEventListener("click", () => {
        main.src = imageUrl(id);
        thumbs.querySelectorAll("img").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
      });
      thumbs.appendChild(t);
    });
  }

  $("detName").textContent = car.name;
  $("detPrice").textContent = inr(car.price);
  $("detDesc").textContent = car.description || "No description provided.";
  $("detCustom").textContent = car.customization || "No customization details provided.";
  const st = $("detStatus");
  st.textContent = isSold(car) ? "SOLD OUT" : "AVAILABLE";
  st.classList.toggle("sold", isSold(car));
  const b = $("detBuyBtn");
  b.disabled = isSold(car);
  b.textContent = isSold(car) ? "SOLD OUT" : "BUY NOW";
  openModal("detailsModal");
}
$("detailsBtn").addEventListener("click", openDetails);

// ---------- buy flow ----------
function openBuy() {
  const car = cars[index];
  if (!car || isSold(car)) return;
  buyCar = car;
  $("buyCarName").textContent = car.name;
  $("buyCarPrice").textContent = inr(car.price);
  $("buyError").textContent = "";
  $("buyFormWrap").classList.remove("hidden");
  $("buyDone").classList.add("hidden");
  $("buySubmit").disabled = false;
  $("buySubmit").textContent = "SUBMIT REQUEST";
  closeModals();
  openModal("buyModal");
}
$("buyBtn").addEventListener("click", openBuy);
$("detBuyBtn").addEventListener("click", openBuy);

$("buySubmit").addEventListener("click", async () => {
  const name = $("buyName").value.trim();
  const cpm = $("buyCpm").value.trim();
  const contact = $("buyContact").value.trim();
  const err = $("buyError");
  err.textContent = "";

  if (!name || !cpm || !contact) { err.textContent = "Please fill in all fields."; return; }
  const last = Number(localStorage.getItem("alpine_last_req") || 0);
  if (Date.now() - last < 30000) { err.textContent = "Please wait a few seconds before sending another request."; return; }

  const btn = $("buySubmit");
  btn.disabled = true;
  btn.textContent = "SENDING...";
  try {
    await databases.createDocument(CONFIG.databaseId, CONFIG.requestsCollectionId, ID.unique(), {
      carId: buyCar.$id,
      carName: buyCar.name,
      price: buyCar.price,
      customerName: name,
      cpmId: cpm,
      contact: contact,
      status: "new",
    });
    try { localStorage.setItem("alpine_last_req", String(Date.now())); } catch (e) {}
    $("buyFormWrap").classList.add("hidden");
    $("buyDone").classList.remove("hidden");
    $("buyName").value = ""; $("buyCpm").value = ""; $("buyContact").value = "";
  } catch (e) {
    err.textContent = "Could not send request: " + e.message;
    btn.disabled = false;
    btn.textContent = "SUBMIT REQUEST";
  }
});

// ---------- list helper (search + wishlist) ----------
function carRow(car, onClick) {
  const b = document.createElement("button");
  b.className = "list-item";
  const im = document.createElement("img");
  im.src = carImageUrl(car);
  im.alt = "";
  im.onerror = () => { im.src = PLACEHOLDER; };
  const box = document.createElement("div");
  const n = document.createElement("div");
  n.className = "li-name";
  n.textContent = car.name;
  const p = document.createElement("div");
  p.className = "li-price";
  p.textContent = inr(car.price);
  box.appendChild(n); box.appendChild(p);
  if (isSold(car)) {
    const s = document.createElement("div");
    s.className = "li-sold";
    s.textContent = "SOLD OUT";
    box.appendChild(s);
  }
  b.appendChild(im); b.appendChild(box);
  b.addEventListener("click", onClick);
  return b;
}
function emptyMsg(text) {
  const d = document.createElement("div");
  d.className = "list-empty";
  d.textContent = text;
  return d;
}

// ---------- search ----------
function renderSearch() {
  const q = $("searchInput").value.trim().toLowerCase();
  const box = $("searchResults");
  box.innerHTML = "";
  const found = cars
    .map((c, i) => ({ c, i }))
    .filter((x) => !q || x.c.name.toLowerCase().includes(q));
  if (!found.length) { box.appendChild(emptyMsg("No cars found.")); return; }
  found.forEach((x) => box.appendChild(carRow(x.c, () => { closeModals(); jumpTo(x.i); })));
}
$("searchBtn").addEventListener("click", () => {
  $("searchInput").value = "";
  renderSearch();
  openModal("searchModal");
  setTimeout(() => $("searchInput").focus(), 300);
});
$("searchInput").addEventListener("input", renderSearch);

// ---------- wishlist modal ----------
$("heartBtn").addEventListener("click", toggleWish);
$("wishBtn").addEventListener("click", () => {
  const box = $("wishList");
  box.innerHTML = "";
  const ids = getWish();
  const items = cars.map((c, i) => ({ c, i })).filter((x) => ids.includes(x.c.$id));
  if (!items.length) box.appendChild(emptyMsg("Your wishlist is empty. Tap the heart on any car."));
  items.forEach((x) => box.appendChild(carRow(x.c, () => { closeModals(); jumpTo(x.i); })));
  openModal("wishModal");
});

// ---------- support ----------
function buildSupport() {
  const box = $("supportLinks");
  box.innerHTML = "";
  const links = [];
  if (SUPPORT.whatsapp) links.push(["WhatsApp", "https://wa.me/" + SUPPORT.whatsapp.replace(/\D/g, "")]);
  if (SUPPORT.telegram) links.push(["Telegram", "https://t.me/" + SUPPORT.telegram.replace("@", "")]);
  if (SUPPORT.instagram) links.push(["Instagram", "https://instagram.com/" + SUPPORT.instagram.replace("@", "")]);
  if (SUPPORT.email) links.push(["Email", "mailto:" + SUPPORT.email]);
  if (!links.length) { box.appendChild(emptyMsg("Support contacts will be added soon.")); return; }
  links.forEach(([label, href]) => {
    const a = document.createElement("a");
    a.className = "list-item";
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    const n = document.createElement("div");
    n.className = "li-name"; n.textContent = label;
    a.appendChild(n);
    box.appendChild(a);
  });
  if (SUPPORT.email) $("footerContact").textContent = SUPPORT.email;
}
$("supportBtn").addEventListener("click", () => openModal("supportModal"));

// ---------- load cars from Appwrite ----------
async function loadCars(keepId) {
  const res = await databases.listDocuments(CONFIG.databaseId, CONFIG.carsCollectionId, [
    Query.orderAsc("sortOrder"),
    Query.limit(100),
  ]);
  cars = res.documents;
  if (keepId) {
    const i = cars.findIndex((c) => c.$id === keepId);
    index = i >= 0 ? i : 0;
  } else {
    index = 0;
  }
  if (index >= cars.length) index = 0;
}

function toggleStates() {
  const has = cars.length > 0;
  $("stage").classList.toggle("hidden", !has);
  $("emptyState").classList.toggle("hidden", has);
  const multi = cars.length > 1;
  $("prevBtn").style.visibility = multi ? "visible" : "hidden";
  $("nextBtn").style.visibility = multi ? "visible" : "hidden";
}

async function init() {
  $("year").textContent = new Date().getFullYear();
  buildSupport();
  const started = Date.now();
  try {
    await loadCars();
    toggleStates();
    if (cars.length) await showInstant();
  } catch (e) {
    $("emptyState").classList.remove("hidden");
    $("emptyState").querySelector("h2").textContent = "Showroom unavailable";
    $("emptyState").querySelector("p").textContent = e.message;
  }
  const wait = Math.max(0, 1300 - (Date.now() - started));
  setTimeout(() => $("loader").classList.add("done"), wait);

  // Live updates: when admin changes cars, the showcase refreshes itself
  try {
    client.subscribe(
      "databases." + CONFIG.databaseId + ".collections." + CONFIG.carsCollectionId + ".documents",
      async () => {
        const currentId = cars[index] && cars[index].$id;
        try {
          await loadCars(currentId);
          toggleStates();
          if (cars.length) await showInstant();
        } catch (e) {}
      }
    );
  } catch (e) {}
}
init();
