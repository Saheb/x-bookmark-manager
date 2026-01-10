// IndexedDB wrapper for bookmark storage

const DB_NAME = 'TwitterBookmarkManager';
const DB_VERSION = 1;
const STORE_NAME = 'bookmarks';

let db = null;

/**
 * Initialize the IndexedDB database
 */
export async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'tweetId' });
        store.createIndex('author', 'authorHandle', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
  });
}

/**
 * Save a bookmark (upsert)
 */
export async function saveBookmark(bookmark) {
  await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Add savedAt timestamp if not exists
    bookmark.savedAt = bookmark.savedAt || new Date().toISOString();

    const request = store.put(bookmark);
    request.onsuccess = () => resolve(bookmark);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save multiple bookmarks
 */
/**
 * Save multiple bookmarks
 * Returns { total: number, added: number }
 */
export async function saveBookmarks(bookmarks) {
  await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let added = 0;

    // We need to check existence first
    // This isn't atomic per se but fine for this use case
    const checkRequest = store.getAllKeys();

    checkRequest.onsuccess = () => {
      const existingIds = new Set(checkRequest.result);

      bookmarks.forEach(bookmark => {
        if (!existingIds.has(bookmark.tweetId)) {
          added++;
          bookmark.savedAt = bookmark.savedAt || new Date().toISOString();
        } else {
          // Preserve original savedAt if already exists, or update if we want to track 'last seen'?
          // For now, let's keep original savedAt effectively by not overwriting if we fetched the old one
          // But since we didn't fetch the old object, we might overwrite savedAt with new date if we set it above
          // Actually, if it exists, we probably just want to update metadata but keep first savedAt?
          // Simplest is to just put it. The returning 'added' count is what matters.
        }

        // Ensure savedAt exists
        if (!bookmark.savedAt) {
          bookmark.savedAt = new Date().toISOString();
        }

        store.put(bookmark);
      });
    };

    transaction.oncomplete = () => resolve({ total: bookmarks.length, added });
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get all bookmarks
 */
export async function getAllBookmarks() {
  await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by savedAt descending (newest first)
      const bookmarks = request.result.sort((a, b) =>
        new Date(b.savedAt) - new Date(a.savedAt)
      );
      resolve(bookmarks);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get bookmark count
 */
export async function getBookmarkCount() {
  await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all bookmark IDs (for checking duplicates during sync)
 */
export async function getBookmarkIds() {
  await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAllKeys();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Search bookmarks by text
 */
export async function searchBookmarks(query) {
  const bookmarks = await getAllBookmarks();
  const lowerQuery = query.toLowerCase();

  return bookmarks.filter(b =>
    b.text?.toLowerCase().includes(lowerQuery) ||
    b.authorName?.toLowerCase().includes(lowerQuery) ||
    b.authorHandle?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Delete a bookmark
 */
export async function deleteBookmark(tweetId) {
  await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(tweetId);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all bookmarks
 */
export async function clearAllBookmarks() {
  await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Export bookmarks as JSON
 */
export async function exportAsJSON() {
  const bookmarks = await getAllBookmarks();
  return JSON.stringify(bookmarks, null, 2);
}

/**
 * Export bookmarks as CSV
 */
export async function exportAsCSV() {
  const bookmarks = await getAllBookmarks();

  const headers = ['Tweet ID', 'Author', 'Handle', 'Text', 'Timestamp', 'URL', 'Saved At'];
  const rows = bookmarks.map(b => [
    b.tweetId,
    `"${(b.authorName || '').replace(/"/g, '""')}"`,
    b.authorHandle,
    `"${(b.text || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    b.timestamp,
    b.url,
    b.savedAt
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
