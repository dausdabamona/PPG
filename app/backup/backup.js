/**
 * =============================================================================
 * Backup & Restore Module
 * =============================================================================
 * Handles database backup and restore functionality for offline use
 *
 * Features:
 * - Export database to JSON file
 * - Import database from JSON file
 * - Backup metadata and versioning
 * - Future: Encrypted backups with SQLCipher
 * =============================================================================
 */

import DB from '../db/db.js';

/**
 * Backup configuration
 */
const BACKUP_CONFIG = {
    version: 1,
    appName: 'PPG',
    fileExtension: '.ppg.json'
};

/**
 * Tables to include in backup (in order)
 */
const BACKUP_TABLES = [
    'jamaah',
    'kelas',
    'kelas_jamaah',
    'kehadiran',
    'kehadiran_detail',
    'penilaian',
    'penilaian_materi',
    'penilaian_akhlak',
    'kelas_mandiri',
    'modul_mandiri',
    'progress_mandiri',
    'catatan_pembinaan',
    'catatan_tindak_lanjut',
    'rekomendasi_pendidikan',
    'rekomendasi_detail',
    'rekomendasi_progress',
    'konsultasi_pakar'
];

/**
 * Create a backup of the entire database
 * @returns {Promise<object>} Backup data object
 */
async function createBackup() {
    console.log('[Backup] Creating backup...');

    const backup = {
        metadata: {
            version: BACKUP_CONFIG.version,
            appName: BACKUP_CONFIG.appName,
            createdAt: new Date().toISOString(),
            deviceId: DB.getDeviceId(),
            tableCount: 0,
            totalRecords: 0
        },
        data: {}
    };

    for (const tableName of BACKUP_TABLES) {
        try {
            const result = await DB.query(`SELECT * FROM ${tableName}`);
            backup.data[tableName] = result.rows;
            backup.metadata.totalRecords += result.rows.length;
            backup.metadata.tableCount++;
            console.log(`[Backup] ${tableName}: ${result.rows.length} records`);
        } catch (error) {
            // Table might not exist yet
            console.warn(`[Backup] Skipping ${tableName}: ${error.message}`);
            backup.data[tableName] = [];
        }
    }

    console.log('[Backup] Complete:', backup.metadata);
    return backup;
}

/**
 * Export backup to downloadable file
 * @param {string} filename - Optional custom filename
 * @returns {Promise<void>}
 */
async function exportToFile(filename) {
    const backup = await createBackup();

    // Generate filename if not provided
    if (!filename) {
        const date = new Date().toISOString().split('T')[0];
        filename = `ppg_backup_${date}${BACKUP_CONFIG.fileExtension}`;
    }

    // Convert to JSON string
    const jsonString = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup
    URL.revokeObjectURL(url);

    console.log('[Backup] Exported to:', filename);
}

/**
 * Import backup from file
 * @param {File} file - Backup file
 * @returns {Promise<object>} Import results
 */
async function importFromFile(file) {
    console.log('[Backup] Importing from:', file.name);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                const result = await restoreBackup(backup);
                resolve(result);
            } catch (error) {
                reject(new Error('Invalid backup file: ' + error.message));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Restore database from backup object
 * @param {object} backup - Backup data object
 * @returns {Promise<object>} Restore results
 */
async function restoreBackup(backup) {
    console.log('[Backup] Restoring backup...');

    // Validate backup format
    if (!backup.metadata || !backup.data) {
        throw new Error('Invalid backup format');
    }

    if (backup.metadata.appName !== BACKUP_CONFIG.appName) {
        throw new Error('Backup is not from PPG application');
    }

    const results = {
        success: true,
        tablesRestored: 0,
        recordsRestored: 0,
        errors: []
    };

    // Begin transaction
    await DB.beginTransaction();

    try {
        for (const tableName of BACKUP_TABLES) {
            const records = backup.data[tableName] || [];

            if (records.length === 0) {
                continue;
            }

            try {
                // Clear existing data
                await DB.execute(`DELETE FROM ${tableName}`);

                // Insert backup data
                for (const record of records) {
                    const columns = Object.keys(record);
                    const placeholders = columns.map(() => '?').join(', ');
                    const values = columns.map(col => record[col]);

                    await DB.execute(
                        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
                        values
                    );
                    results.recordsRestored++;
                }

                results.tablesRestored++;
                console.log(`[Backup] Restored ${tableName}: ${records.length} records`);
            } catch (error) {
                results.errors.push(`${tableName}: ${error.message}`);
                console.error(`[Backup] Error restoring ${tableName}:`, error);
            }
        }

        // Commit transaction
        await DB.commitTransaction();
        console.log('[Backup] Restore complete:', results);

    } catch (error) {
        // Rollback on error
        await DB.rollbackTransaction();
        results.success = false;
        results.errors.push(error.message);
        throw error;
    }

    return results;
}

/**
 * Get backup info without importing
 * @param {File} file - Backup file
 * @returns {Promise<object>} Backup metadata
 */
async function getBackupInfo(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                resolve(backup.metadata);
            } catch (error) {
                reject(new Error('Invalid backup file'));
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };

        reader.readAsText(file);
    });
}

/**
 * Create a file input element for selecting backup files
 * @param {Function} onSelect - Callback when file is selected
 * @returns {HTMLInputElement} File input element
 */
function createFileInput(onSelect) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.ppg.json';

    input.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file && onSelect) {
            onSelect(file);
        }
    });

    return input;
}

/**
 * Show file picker and import
 * @returns {Promise<object>} Import results
 */
async function showImportDialog() {
    return new Promise((resolve, reject) => {
        const input = createFileInput(async (file) => {
            try {
                const result = await importFromFile(file);
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });

        input.click();
    });
}

// =============================================================================
// Export module
// =============================================================================

const BackupModule = {
    createBackup,
    exportToFile,
    importFromFile,
    restoreBackup,
    getBackupInfo,
    showImportDialog,
    BACKUP_TABLES,
    BACKUP_CONFIG
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackupModule;
}

if (typeof window !== 'undefined') {
    window.Backup = BackupModule;
}

export default BackupModule;
export {
    createBackup,
    exportToFile,
    importFromFile,
    restoreBackup,
    getBackupInfo,
    showImportDialog
};
