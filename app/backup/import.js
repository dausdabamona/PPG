/**
 * =============================================================================
 * Backup Import Module
 * =============================================================================
 * Imports .ppg backup files and merges data into local database using
 * offline-first merge strategy with conflict detection and logging.
 *
 * Import validation enforces hierarchy:
 * OrangTua -> Mubaligh -> PC -> DPD -> DPW
 *
 * Merge Strategy:
 * - Uses id, last_modified, and sync_version for conflict resolution
 * - Last-write-wins with version tracking
 * - All conflicts logged to merge_log table
 * =============================================================================
 */

import DB from '../db/db.js';
import { validateImportPermission, getLevelName, isValidLevel } from './hierarchy.js';
import { calculateChecksum, EXPORT_TABLES, APP_VERSION } from './export.js';
import FileService from '../services/fileService.js';

/**
 * Tables that should be merged (order matters for foreign keys)
 */
const MERGE_TABLES = [
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
    'konsultasi_pakar',
    'wilayah'
];

/**
 * Parse .ppg backup file
 * @param {File|Uint8Array} fileOrData - Backup file or raw data (from Android)
 * @param {string} fileName - File name (required when passing Uint8Array)
 * @returns {Promise<object>} Parsed backup contents
 */
async function parseBackupFile(fileOrData, fileName = null) {
    const isRawData = fileOrData instanceof Uint8Array;
    const name = isRawData ? fileName : fileOrData.name;
    console.log('[Import] Parsing backup file:', name);

    // Handle raw Uint8Array data (from Android FileService)
    if (isRawData) {
        return parseBackupData(fileOrData, name);
    }

    // Handle File object (web)
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const content = event.target.result;
                const result = await parseBackupData(
                    new Uint8Array(content),
                    fileOrData.name
                );
                resolve(result);
            } catch (error) {
                reject(new Error('Failed to parse backup: ' + error.message));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(fileOrData);
    });
}

/**
 * Parse backup data from Uint8Array
 * @param {Uint8Array} data - Raw backup data
 * @param {string} fileName - File name
 * @returns {Promise<object>} Parsed backup contents
 */
async function parseBackupData(data, fileName) {
    // Try to parse as zip first (if JSZip available)
    if (typeof JSZip !== 'undefined') {
        try {
            const zip = await JSZip.loadAsync(data);

            const dataFile = zip.file('data.json');
            const metaFile = zip.file('meta.json');
            const hashFile = zip.file('hash.txt');

            if (!dataFile || !metaFile) {
                throw new Error('Invalid backup: missing required files');
            }

            const parsedData = JSON.parse(await dataFile.async('string'));
            const meta = JSON.parse(await metaFile.async('string'));
            const hash = hashFile ? (await hashFile.async('string')).trim() : null;

            return { data: parsedData, meta, hash, format: 'zip' };
        } catch (zipError) {
            console.log('[Import] Not a zip file, trying JSON format...');
        }
    }

    // Try as combined JSON format (fallback)
    const jsonContent = new TextDecoder().decode(data);
    const parsed = JSON.parse(jsonContent);

    if (parsed._format === 'ppg_combined') {
        return {
            data: parsed.data,
            meta: parsed.meta,
            hash: parsed.hash,
            format: 'json'
        };
    } else if (parsed.data && parsed.metadata) {
        // Legacy format support
        return {
            data: parsed.data,
            meta: parsed.metadata,
            hash: null,
            format: 'legacy'
        };
    } else {
        throw new Error('Unknown backup format');
    }
}

/**
 * Pick a backup file using platform-appropriate method
 * On web: Opens file input dialog
 * On Android: Lists available .ppg files from Documents and Downloads
 * @returns {Promise<object>} Pick result with file info
 */
async function pickFile() {
    return FileService.pickBackupFile();
}

/**
 * List available backup files (Android only)
 * @returns {Promise<Array>} List of backup files
 */
async function listAvailableBackups() {
    return FileService.listBackupFiles();
}

/**
 * Read a specific backup file by path (Android)
 * @param {string} path - File path
 * @param {string} directory - Directory constant
 * @returns {Promise<object>} File data
 */
async function readBackupFromPath(path, directory) {
    return FileService.readBackupFile(path, directory);
}

/**
 * Validate backup metadata and checksum
 * @param {object} backup - Parsed backup
 * @param {string} importerLevel - Level of the importing user
 * @returns {object} Validation result
 */
async function validateBackup(backup, importerLevel) {
    const result = {
        valid: false,
        errors: [],
        warnings: [],
        meta: backup.meta
    };

    // Check required metadata fields
    if (!backup.meta) {
        result.errors.push('Missing metadata');
        return result;
    }

    if (!backup.meta.level) {
        result.errors.push('Missing level in metadata');
        return result;
    }

    // Validate source level
    if (!isValidLevel(backup.meta.level)) {
        result.errors.push(`Invalid source level: ${backup.meta.level}`);
        return result;
    }

    // Validate hierarchy permission
    const permissionCheck = validateImportPermission(importerLevel, backup.meta.level);
    if (!permissionCheck.valid) {
        result.errors.push(permissionCheck.message);
        return result;
    }

    // Validate checksum if present
    if (backup.hash && backup.data) {
        const dataString = JSON.stringify(backup.data);
        const calculatedHash = await calculateChecksum(dataString);

        if (calculatedHash !== backup.hash) {
            result.errors.push('Checksum mismatch - file may be corrupted');
            return result;
        }
        console.log('[Import] Checksum verified');
    } else {
        result.warnings.push('No checksum found - cannot verify file integrity');
    }

    // Check app version compatibility
    if (backup.meta.app_version && backup.meta.app_version !== APP_VERSION) {
        result.warnings.push(`Version mismatch: backup=${backup.meta.app_version}, current=${APP_VERSION}`);
    }

    // Check data presence
    if (!backup.data || Object.keys(backup.data).length === 0) {
        result.errors.push('No data in backup');
        return result;
    }

    result.valid = true;
    return result;
}

/**
 * Merge a single record into local database
 * @param {string} tableName - Table name
 * @param {object} incomingRecord - Record from backup
 * @param {string} sourceLevel - Source level of backup
 * @param {string} backupLogId - ID of backup_log entry
 * @returns {Promise<object>} Merge result
 */
async function mergeRecord(tableName, incomingRecord, sourceLevel, backupLogId) {
    const result = {
        action: null,
        conflict: false,
        details: null
    };

    const recordId = incomingRecord.id;
    if (!recordId) {
        result.action = 'skipped';
        result.details = 'Missing ID';
        return result;
    }

    try {
        // Check if record exists locally
        const localResult = await DB.query(
            `SELECT * FROM ${tableName} WHERE id = ?`,
            [recordId]
        );

        const localRecord = localResult.rows.length > 0 ? localResult.rows[0] : null;

        if (!localRecord) {
            // Insert new record
            await insertRecord(tableName, incomingRecord);
            result.action = 'inserted';
        } else {
            // Compare versions for conflict resolution
            const localVersion = localRecord.sync_version || 0;
            const incomingVersion = incomingRecord.sync_version || 0;
            const localModified = localRecord.last_modified || '';
            const incomingModified = incomingRecord.last_modified || '';

            if (incomingVersion > localVersion ||
                (incomingVersion === localVersion && incomingModified > localModified)) {
                // Incoming is newer - update
                await updateRecord(tableName, incomingRecord, localRecord);
                result.action = 'updated';
            } else if (incomingVersion === localVersion && incomingModified === localModified) {
                // Same version - skip
                result.action = 'skipped';
                result.details = 'Same version';
            } else {
                // Local is newer - skip but log conflict
                result.action = 'skipped';
                result.conflict = true;
                result.details = `Local newer: v${localVersion} vs v${incomingVersion}`;
            }

            // Log merge operation
            await logMergeOperation({
                backupLogId,
                tableName,
                recordId,
                action: result.action,
                localVersion,
                incomingVersion,
                localModified,
                incomingModified,
                sourceLevel,
                sourceDeviceId: incomingRecord.device_id,
                conflict: result.conflict,
                conflictDetails: result.details
            });
        }
    } catch (error) {
        result.action = 'error';
        result.details = error.message;
        console.error(`[Import] Error merging ${tableName}/${recordId}:`, error);
    }

    return result;
}

/**
 * Insert a new record into table
 * @param {string} tableName - Table name
 * @param {object} record - Record to insert
 */
async function insertRecord(tableName, record) {
    const columns = Object.keys(record);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map(col => record[col]);

    await DB.execute(
        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
    );
}

/**
 * Update an existing record
 * @param {string} tableName - Table name
 * @param {object} incomingRecord - New data
 * @param {object} localRecord - Existing data
 */
async function updateRecord(tableName, incomingRecord, localRecord) {
    const columns = Object.keys(incomingRecord).filter(col => col !== 'id');
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = columns.map(col => incomingRecord[col]);
    values.push(incomingRecord.id);

    await DB.execute(
        `UPDATE ${tableName} SET ${setClause} WHERE id = ?`,
        values
    );
}

/**
 * Log merge operation to merge_log table
 * @param {object} params - Log parameters
 */
async function logMergeOperation(params) {
    const id = DB.generateUUID();
    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    try {
        await DB.execute(`
            INSERT INTO merge_log (
                id, backup_log_id, table_name, record_id, action,
                local_sync_version, incoming_sync_version,
                local_last_modified, incoming_last_modified,
                source_level, source_device_id,
                conflict_type, conflict_details,
                timestamp, created_at, updated_at, last_modified,
                sync_version, device_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, params.backupLogId, params.tableName, params.recordId,
            params.action, params.localVersion, params.incomingVersion,
            params.localModified, params.incomingModified,
            params.sourceLevel, params.sourceDeviceId,
            params.conflict ? 'version_conflict' : null,
            params.conflictDetails,
            now, now, now, now, 1, deviceId
        ]);
    } catch (error) {
        console.warn('[Import] Failed to log merge:', error.message);
    }
}

/**
 * Create backup_log entry for import operation
 * @param {object} meta - Backup metadata
 * @param {string} fileName - File name
 * @param {string} importerLevel - Importer's level
 * @param {string} importedBy - Importer's ID
 * @returns {Promise<string>} Backup log ID
 */
async function createBackupLogEntry(meta, fileName, importerLevel, importedBy) {
    const id = DB.generateUUID();
    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    await DB.execute(`
        INSERT INTO backup_log (
            id, file_name, checksum, operation, level, source_level,
            wilayah_id, created_at, imported_at, created_by, imported_by,
            app_version, status, device_id, updated_at, last_modified, sync_version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id, fileName, meta.checksum || null, 'import', importerLevel,
        meta.level, meta.wilayah_id, meta.created_at, now,
        meta.created_by, importedBy, APP_VERSION, 'in_progress',
        deviceId, now, now, 1
    ]);

    return id;
}

/**
 * Update backup_log entry with results
 * @param {string} logId - Backup log ID
 * @param {object} stats - Import statistics
 * @param {string} status - Final status
 * @param {string} errorMessage - Error message if failed
 */
async function updateBackupLogEntry(logId, stats, status, errorMessage = null) {
    const now = DB.getCurrentTimestamp();

    await DB.execute(`
        UPDATE backup_log SET
            records_imported = ?,
            records_merged = ?,
            records_skipped = ?,
            conflicts_count = ?,
            status = ?,
            error_message = ?,
            updated_at = ?,
            last_modified = ?
        WHERE id = ?
    `, [
        stats.inserted, stats.updated, stats.skipped, stats.conflicts,
        status, errorMessage, now, now, logId
    ]);

    await DB.save();
}

/**
 * Import and merge backup file
 * @param {File} file - Backup file
 * @param {object} options - Import options
 * @param {string} options.importerLevel - Level of the importing user
 * @param {string} options.importedBy - User ID of importer
 * @param {string} options.importedByName - Name of importer
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<object>} Import result
 */
async function importBackup(file, options) {
    console.log('[Import] Starting backup import...');

    const result = {
        success: false,
        stats: {
            inserted: 0,
            updated: 0,
            skipped: 0,
            conflicts: 0,
            errors: 0,
            tables: 0
        },
        validation: null,
        meta: null,
        error: null
    };

    let backupLogId = null;

    try {
        // Parse backup file
        const backup = await parseBackupFile(file);
        result.meta = backup.meta;

        // Validate backup
        console.log('[Import] Validating backup...');
        const validation = await validateBackup(backup, options.importerLevel);
        result.validation = validation;

        if (!validation.valid) {
            result.error = validation.errors.join('; ');
            return result;
        }

        // Create backup log entry
        backupLogId = await createBackupLogEntry(
            backup.meta,
            file.name,
            options.importerLevel,
            options.importedBy
        );

        // Begin merge process
        console.log('[Import] Starting merge...');
        await DB.beginTransaction();

        try {
            // Process each table
            for (const tableName of MERGE_TABLES) {
                const tableData = backup.data[tableName];
                if (!tableData || tableData.length === 0) {
                    continue;
                }

                console.log(`[Import] Merging ${tableName}: ${tableData.length} records`);
                result.stats.tables++;

                // Merge each record
                for (let i = 0; i < tableData.length; i++) {
                    const record = tableData[i];
                    const mergeResult = await mergeRecord(
                        tableName,
                        record,
                        backup.meta.level,
                        backupLogId
                    );

                    // Update statistics
                    switch (mergeResult.action) {
                        case 'inserted':
                            result.stats.inserted++;
                            break;
                        case 'updated':
                            result.stats.updated++;
                            break;
                        case 'skipped':
                            result.stats.skipped++;
                            if (mergeResult.conflict) {
                                result.stats.conflicts++;
                            }
                            break;
                        case 'error':
                            result.stats.errors++;
                            break;
                    }

                    // Report progress
                    if (options.onProgress) {
                        options.onProgress({
                            table: tableName,
                            current: i + 1,
                            total: tableData.length,
                            stats: result.stats
                        });
                    }
                }
            }

            // Commit transaction
            await DB.commitTransaction();

            // Update backup log with results
            await updateBackupLogEntry(backupLogId, result.stats, 'completed');

            result.success = true;
            console.log('[Import] Import complete:', result.stats);

        } catch (mergeError) {
            // Rollback on error
            await DB.rollbackTransaction();
            throw mergeError;
        }

    } catch (error) {
        console.error('[Import] Import failed:', error);
        result.error = error.message;

        // Update backup log with failure
        if (backupLogId) {
            await updateBackupLogEntry(backupLogId, result.stats, 'failed', error.message);
        }
    }

    return result;
}

/**
 * Get backup file info without importing
 * @param {File} file - Backup file
 * @param {string} importerLevel - Level of the importing user
 * @returns {Promise<object>} Backup info with validation
 */
async function previewImport(file, importerLevel) {
    const backup = await parseBackupFile(file);
    const validation = await validateBackup(backup, importerLevel);

    // Count records per table
    const tableCounts = {};
    let totalRecords = 0;

    if (backup.data) {
        for (const [table, records] of Object.entries(backup.data)) {
            if (Array.isArray(records) && records.length > 0) {
                tableCounts[table] = records.length;
                totalRecords += records.length;
            }
        }
    }

    return {
        meta: backup.meta,
        validation,
        tableCounts,
        totalRecords,
        format: backup.format
    };
}

/**
 * Get merge conflict log for a backup
 * @param {string} backupLogId - Backup log ID
 * @returns {Promise<Array>} Conflict records
 */
async function getConflicts(backupLogId) {
    const result = await DB.query(`
        SELECT * FROM merge_log
        WHERE backup_log_id = ? AND action = 'conflict'
        ORDER BY timestamp DESC
    `, [backupLogId]);

    return result.rows;
}

/**
 * Get import history
 * @param {object} options - Query options
 * @returns {Promise<Array>} Import log records
 */
async function getImportHistory(options = {}) {
    let sql = `
        SELECT * FROM backup_log
        WHERE operation = 'import'
    `;
    const params = [];

    if (options.level) {
        sql += ' AND level = ?';
        params.push(options.level);
    }

    sql += ' ORDER BY imported_at DESC';

    if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
    }

    const result = await DB.query(sql, params);
    return result.rows;
}

/**
 * Load JSZip library dynamically
 * @returns {Promise<void>}
 */
async function loadJSZip() {
    if (typeof JSZip !== 'undefined') {
        return;
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load JSZip'));
        document.head.appendChild(script);
    });
}

// =============================================================================
// Export module
// =============================================================================

const ImportModule = {
    importBackup,
    previewImport,
    parseBackupFile,
    parseBackupData,
    validateBackup,
    getConflicts,
    getImportHistory,
    loadJSZip,
    // FileService integration
    pickFile,
    listAvailableBackups,
    readBackupFromPath,
    MERGE_TABLES
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportModule;
}

if (typeof window !== 'undefined') {
    window.BackupImport = ImportModule;
}

export default ImportModule;
export {
    importBackup,
    previewImport,
    parseBackupFile,
    parseBackupData,
    validateBackup,
    getConflicts,
    getImportHistory,
    loadJSZip,
    pickFile,
    listAvailableBackups,
    readBackupFromPath
};
