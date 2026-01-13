/**
 * =============================================================================
 * File System Service (fileService.js)
 * =============================================================================
 * Handles file operations for backup import/export across platforms:
 * - Web: Uses File API and Blob downloads
 * - Android: Uses Capacitor Filesystem plugin
 *
 * Supports reading from:
 * - Downloads folder
 * - WhatsApp/Media/WhatsApp Documents folder
 * - Custom file picker
 * =============================================================================
 */

let Filesystem = null;
let FilePicker = null;
let isCapacitor = false;

/**
 * Directory constants for Android
 */
const ANDROID_DIRS = {
    DOCUMENTS: 'Documents',
    DOWNLOADS: 'Download',
    EXTERNAL: 'ExternalStorage',
    WHATSAPP: 'WhatsApp/Media/WhatsApp Documents',
    PPG_BACKUP: 'PPG_Backup'
};

/**
 * Initialize the file service
 * Loads Capacitor plugins if available
 */
async function init() {
    isCapacitor = typeof window !== 'undefined' &&
                  window.Capacitor !== undefined &&
                  window.Capacitor.isNativePlatform();

    if (isCapacitor) {
        try {
            const { Filesystem: FS, Directory, Encoding } = await import('@capacitor/filesystem');
            Filesystem = { FS, Directory, Encoding };
            console.log('[FileService] Capacitor Filesystem loaded');

            // Create PPG backup directory if it doesn't exist
            await ensureBackupDirectory();
        } catch (error) {
            console.error('[FileService] Failed to load Capacitor Filesystem:', error);
        }
    } else {
        console.log('[FileService] Running in web mode');
    }
}

/**
 * Ensure the PPG backup directory exists
 */
async function ensureBackupDirectory() {
    if (!isCapacitor || !Filesystem) return;

    try {
        await Filesystem.FS.mkdir({
            path: ANDROID_DIRS.PPG_BACKUP,
            directory: Filesystem.Directory.Documents,
            recursive: true
        });
        console.log('[FileService] Backup directory ready');
    } catch (error) {
        // Directory might already exist
        if (!error.message?.includes('exists')) {
            console.warn('[FileService] Could not create backup directory:', error);
        }
    }
}

/**
 * Save backup file
 * @param {Blob|Uint8Array|string} data - File data
 * @param {string} fileName - File name
 * @returns {Promise<object>} Result with path
 */
async function saveBackupFile(data, fileName) {
    if (isCapacitor && Filesystem) {
        return saveBackupFileNative(data, fileName);
    } else {
        return saveBackupFileWeb(data, fileName);
    }
}

/**
 * Save backup file on web platform
 * @param {Blob|Uint8Array} data - File data
 * @param {string} fileName - File name
 */
async function saveBackupFileWeb(data, fileName) {
    try {
        let blob;
        if (data instanceof Blob) {
            blob = data;
        } else if (data instanceof Uint8Array) {
            blob = new Blob([data], { type: 'application/octet-stream' });
        } else if (typeof data === 'string') {
            blob = new Blob([data], { type: 'application/json' });
        } else {
            throw new Error('Unsupported data type');
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return {
            success: true,
            path: fileName,
            message: 'File downloaded to your default download location'
        };
    } catch (error) {
        console.error('[FileService] Web save error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Save backup file on Android
 * @param {Blob|Uint8Array|string} data - File data
 * @param {string} fileName - File name
 */
async function saveBackupFileNative(data, fileName) {
    try {
        let base64Data;

        if (data instanceof Blob) {
            base64Data = await blobToBase64(data);
        } else if (data instanceof Uint8Array) {
            base64Data = uint8ArrayToBase64(data);
        } else if (typeof data === 'string') {
            // Assume it's already base64 or we need to encode
            base64Data = btoa(data);
        } else {
            throw new Error('Unsupported data type');
        }

        // Save to Documents/PPG_Backup/
        const result = await Filesystem.FS.writeFile({
            path: `${ANDROID_DIRS.PPG_BACKUP}/${fileName}`,
            data: base64Data,
            directory: Filesystem.Directory.Documents,
            recursive: true
        });

        console.log('[FileService] File saved:', result.uri);

        return {
            success: true,
            path: result.uri,
            message: `Backup saved to Documents/${ANDROID_DIRS.PPG_BACKUP}/${fileName}`
        };
    } catch (error) {
        console.error('[FileService] Native save error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Pick and read a backup file
 * @returns {Promise<object>} File content and metadata
 */
async function pickBackupFile() {
    if (isCapacitor) {
        return pickBackupFileNative();
    } else {
        return pickBackupFileWeb();
    }
}

/**
 * Pick backup file on web using file input
 */
async function pickBackupFileWeb() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ppg,.json';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) {
                resolve({ success: false, error: 'No file selected' });
                return;
            }

            try {
                resolve({
                    success: true,
                    file: file,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            } catch (error) {
                resolve({ success: false, error: error.message });
            }
        };

        input.oncancel = () => {
            resolve({ success: false, error: 'File selection cancelled' });
        };

        input.click();
    });
}

/**
 * Pick backup file on Android
 * First tries common locations, then opens file picker
 */
async function pickBackupFileNative() {
    // First, list available .ppg files from common locations
    const availableFiles = await listBackupFiles();

    if (availableFiles.length > 0) {
        // Return the list for user selection
        return {
            success: true,
            files: availableFiles,
            needsSelection: true
        };
    }

    // No files found in common locations, use system picker
    // Note: For full file picker, you'd need @capawesome/capacitor-file-picker
    return {
        success: false,
        error: 'No backup files found. Place .ppg files in Documents/PPG_Backup/ or Downloads/',
        files: []
    };
}

/**
 * List available backup files from common locations
 * @returns {Promise<Array>} List of backup files
 */
async function listBackupFiles() {
    if (!isCapacitor || !Filesystem) return [];

    const files = [];
    const locations = [
        { path: ANDROID_DIRS.PPG_BACKUP, dir: Filesystem.Directory.Documents, label: 'PPG Backup' },
        { path: '', dir: Filesystem.Directory.Documents, label: 'Documents' },
        // Note: External storage access may require additional permissions
    ];

    for (const location of locations) {
        try {
            const result = await Filesystem.FS.readdir({
                path: location.path,
                directory: location.dir
            });

            const ppgFiles = result.files.filter(f =>
                f.name.endsWith('.ppg') || f.name.endsWith('.json')
            );

            for (const file of ppgFiles) {
                files.push({
                    name: file.name,
                    path: location.path ? `${location.path}/${file.name}` : file.name,
                    directory: location.dir,
                    location: location.label,
                    size: file.size || 0,
                    modified: file.mtime || null
                });
            }
        } catch (error) {
            // Directory might not exist or not accessible
            console.log(`[FileService] Could not read ${location.label}:`, error.message);
        }
    }

    return files;
}

/**
 * Read a specific backup file
 * @param {string} path - File path
 * @param {string} directory - Directory constant
 * @returns {Promise<object>} File content
 */
async function readBackupFile(path, directory = null) {
    if (isCapacitor && Filesystem) {
        return readBackupFileNative(path, directory);
    } else {
        // For web, we expect a File object
        return { success: false, error: 'Use pickBackupFile() for web' };
    }
}

/**
 * Read backup file on Android
 */
async function readBackupFileNative(path, directory) {
    try {
        const result = await Filesystem.FS.readFile({
            path: path,
            directory: directory || Filesystem.Directory.Documents
        });

        // Result.data is base64 encoded
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return {
            success: true,
            data: bytes,
            path: path
        };
    } catch (error) {
        console.error('[FileService] Read error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Delete a backup file
 * @param {string} path - File path
 * @param {string} directory - Directory constant
 */
async function deleteBackupFile(path, directory = null) {
    if (!isCapacitor || !Filesystem) {
        return { success: false, error: 'Not supported on web' };
    }

    try {
        await Filesystem.FS.deleteFile({
            path: path,
            directory: directory || Filesystem.Directory.Documents
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get file info
 * @param {string} path - File path
 * @param {string} directory - Directory constant
 */
async function getFileInfo(path, directory = null) {
    if (!isCapacitor || !Filesystem) {
        return { success: false, error: 'Not supported on web' };
    }

    try {
        const stat = await Filesystem.FS.stat({
            path: path,
            directory: directory || Filesystem.Directory.Documents
        });

        return {
            success: true,
            info: {
                size: stat.size,
                modified: stat.mtime,
                created: stat.ctime,
                type: stat.type,
                uri: stat.uri
            }
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Share a backup file (Android)
 * @param {string} path - File path
 */
async function shareBackupFile(path) {
    if (!isCapacitor) {
        return { success: false, error: 'Not supported on web' };
    }

    try {
        // Would require @capacitor/share plugin
        const { Share } = await import('@capacitor/share');

        await Share.share({
            title: 'PPG Backup',
            text: 'PPG backup file',
            url: path,
            dialogTitle: 'Share backup file'
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert Blob to base64
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Convert Uint8Array to base64
 */
function uint8ArrayToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert base64 to Uint8Array
 */
function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Check if running on Capacitor
 */
function isNative() {
    return isCapacitor;
}

// =============================================================================
// Export Module
// =============================================================================

const FileService = {
    init,
    saveBackupFile,
    pickBackupFile,
    listBackupFiles,
    readBackupFile,
    deleteBackupFile,
    getFileInfo,
    shareBackupFile,
    isNative,
    ANDROID_DIRS,
    // Helpers
    blobToBase64,
    uint8ArrayToBase64,
    base64ToUint8Array
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileService;
}

// Global export
if (typeof window !== 'undefined') {
    window.FileService = FileService;
}

export default FileService;
export {
    init,
    saveBackupFile,
    pickBackupFile,
    listBackupFiles,
    readBackupFile,
    deleteBackupFile,
    getFileInfo,
    shareBackupFile,
    isNative,
    ANDROID_DIRS
};
