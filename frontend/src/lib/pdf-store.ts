/**
 * Client-side PDF blob storage using IndexedDB.
 * Stores uploaded PDF files locally so they can be viewed
 * without a server round-trip — works reliably on Railway
 * and any deployment environment.
 */

const DB_NAME = 'contract_extractor_pdfs'
const STORE_NAME = 'pdfs'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Save a PDF blob to IndexedDB keyed by contract ID */
export async function savePdfBlob(contractId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(blob, contractId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // IndexedDB may be unavailable (private browsing, etc.) — fail silently
    console.warn('Failed to save PDF to IndexedDB')
  }
}

/** Retrieve a PDF blob from IndexedDB by contract ID */
export async function getPdfBlob(contractId: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(contractId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

/** Delete a specific PDF blob */
export async function deletePdfBlob(contractId: string): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(contractId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // fail silently
  }
}

/** Clear all stored PDFs */
export async function clearAllPdfBlobs(): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // fail silently
  }
}
