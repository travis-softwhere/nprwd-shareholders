/** Chromium File System Access API (folder picker + permission helpers). */

export {}

declare global {
    interface Window {
        showDirectoryPicker(options?: {
            id?: string
            mode?: "read" | "readwrite"
            startIn?: FileSystemHandle
        }): Promise<FileSystemDirectoryHandle>
    }

    interface FileSystemHandle {
        queryPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>
        requestPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>
    }
}
