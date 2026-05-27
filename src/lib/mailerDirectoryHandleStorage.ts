/**
 * Persist the last-used mailer output folder handle (Chrome/Edge) so the picker can reopen faster.
 * Permission may need re-verification after reload.
 */

const DB_NAME = "nprwd-shareholders-mailers"
const STORE = "handles"
const KEY = "local-mailer-root"

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1)
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE)) {
                req.result.createObjectStore(STORE)
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

export async function saveMailerOutputDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite")
        tx.objectStore(STORE).put(handle, KEY)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

export async function loadMailerOutputDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
        const db = await openDb()
        const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
            const tx = db.transaction(STORE, "readonly")
            const req = tx.objectStore(STORE).get(KEY)
            req.onsuccess = () => resolve(req.result as FileSystemDirectoryHandle | undefined)
            req.onerror = () => reject(req.error)
        })
        if (!handle) return null
        if (typeof handle.queryPermission !== "function") return handle
        const perm = await handle.queryPermission({ mode: "readwrite" })
        if (perm === "granted") return handle
        if (typeof handle.requestPermission !== "function") return null
        const reqPerm = await handle.requestPermission({ mode: "readwrite" })
        return reqPerm === "granted" ? handle : null
    } catch {
        return null
    }
}

export async function clearStoredMailerOutputDirectoryHandle(): Promise<void> {
    try {
        const db = await openDb()
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE, "readwrite")
            tx.objectStore(STORE).delete(KEY)
            tx.oncomplete = () => resolve()
            tx.onerror = () => reject(tx.error)
        })
    } catch {
        /* ignore */
    }
}
