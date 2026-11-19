// ============================================
// ALPINESTORES — Shared Appwrite configuration
// Safe to be public. NEVER put an API key here.
// ============================================

const CONFIG = {
  endpoint: "https://sgp.cloud.appwrite.io/v1",
  projectId: "6aff0407002b1385b31a",
  databaseId: "6aff04570017a7cf674b",
  carsCollectionId: "6aff048d00226c21027a",
  requestsCollectionId: "6aff05f20007cbe12cc2",
  bucketId: "6aff06b9000f706f409b",
};

// Appwrite SDK is loaded from a <script> tag before this file
const { Client, Account, Databases, Storage, ID, Query, Permission, Role } = Appwrite;

const client = new Client()
  .setEndpoint(CONFIG.endpoint)
  .setProject(CONFIG.projectId);

const account = new Account(client);
const databases = new Databases(client);
const storage = new Storage(client);

// Returns the ORIGINAL uploaded image (not resized, never distorted)
function imageUrl(fileId) {
  return String(storage.getFileView(CONFIG.bucketId, fileId));
}
