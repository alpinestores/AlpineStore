// ============================================
// ALPINESTORES — Shared configuration
// Safe to be public. NEVER put a secret key (pronto_sk_...) or Appwrite API key here.
// ============================================

const CONFIG = {
  endpoint: "https://sgp.cloud.appwrite.io/v1",
  projectId: "6aff0407002b1385b31a",
  databaseId: "6aff04570017a7cf674b",
  carsCollectionId: "6aff047b002b57f0c201",
  requestsCollectionId: "6aff05f20007cbe12cc2",

  // OLD images (kept so existing cars still show their pictures)
  bucketId: "6aff06b9000f706f409b",

  // NEW images are stored on Pronto (GetPronto)
  prontoPublicKey: "pronto_pk__vbQ7hczsHkaAj8AbC8_S0RdI7d9G",
  prontoSdkUrl: "https://esm.sh/getpronto-sdk@1.3.1",

  // EmailJS — PUBLIC values only. Never put a private key here.
  // Leave a value "" to switch that email off.
  emailjs: {
    publicKey: "",           // EmailJS > Account > Public Key
    serviceId: "",           // EmailJS > Email Services > Service ID
    adminTemplateId: "",     // template that emails YOU about a new request
    customerTemplateId: "",  // template that emails the CUSTOMER a confirmation
  },
};

// Appwrite SDK is loaded from a <script> tag before this file
const { Client, Account, Databases, Storage, ID, Query, Permission, Role } = Appwrite;

const client = new Client()
  .setEndpoint(CONFIG.endpoint)
  .setProject(CONFIG.projectId);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

// ---------- Image storage ----------
// A stored image reference is either:
//   - an old Appwrite file ID            -> "6aff..."
//   - a new Pronto image                 -> "pronto:<fileId>|<url>"
// Both work, so no migration is needed.

// Returns the image URL (original, never resized or distorted)
function imageUrl(ref) {
  ref = String(ref || "");
  if (ref.startsWith("pronto:")) return ref.slice(ref.indexOf("|") + 1);
  return String(storage.getFileView(CONFIG.bucketId, ref));
}

let _pronto = null;
async function getPronto() {
  if (!_pronto) {
    const mod = await import(CONFIG.prontoSdkUrl);
    const ProntoClient = mod.default || mod.GetProntoClient;
    _pronto = new ProntoClient({ apiKey: CONFIG.prontoPublicKey });
  }
  return _pronto;
}

// Uploads to Pronto, returns the reference to save in the database
async function uploadImage(file) {
  const pronto = await getPronto();
  const res = await pronto.files.upload(file, { filename: file.name, mimeType: file.type });
  console.log("Pronto upload result:", res);
  const f = (res && (res.file || res.data)) || res || {};
  const id = f.id || f.fileId || f._id;
  const url = f.rawUrl || f.secureUrl || f.url || f.fileUrl || f.publicUrl;
  if (!id || !url) {
    let shown = "";
    try { shown = JSON.stringify(res); } catch (e) { shown = String(res); }
    throw new Error("Pronto replied with: " + shown.slice(0, 600));
  }
  return "pronto:" + id + "|" + url;
}

// Deletes from Pronto (new images) or Appwrite (old images)
async function deleteImage(ref) {
  ref = String(ref || "");
  if (ref.startsWith("pronto:")) {
    const id = ref.slice(7, ref.indexOf("|"));
    const pronto = await getPronto();
    await pronto.files.delete(id);
    return;
  }
  await storage.deleteFile(CONFIG.bucketId, ref);
}
