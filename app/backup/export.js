/**
 * =============================================================================
 * Backup Export Module
 * =============================================================================
 * Exports the SQLite database into a .ppg backup file (zip format) containing:
 * - data.json: The database content
 * - meta.json: Backup metadata (level, wilayah, creator, timestamp, version)
 * - hash.txt: SHA-256 checksum for integrity verification
 *
 * Supports hierarchical backup flow:
 * OrangTua -> Mubaligh -> PC -> DPD -> DPW
 * =============================================================================
 */

import DB from '../db/db.js';
import { LEVELS, getLevelName, isValidLevel, getTargetLevel } from './hierarchy.js';

/**
 * Application version for backup compatibility
 */
const APP_VERSION = '1.0.0';

/**
 * Tables to include in backup (in dependency order)
 */
const EXPORT_TABLES = [
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
    'wilayah',
    'backup_log',
    'merge_log'
];

/**
 * Calculate SHA-256 hash of a string
 * @param {string} content - Content to hash
 * @returns {Promise<string>} Hex-encoded hash
 */
async function calculateChecksum(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);

    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback: Simple hash for older browsers (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

/**
 * Export all data from database tables
 * @returns {Promise<object>} Data object with all tables
 */
async function exportAllData() {
    const data = {};
    let totalRecords = 0;

    for (const tableName of EXPORT_TABLES) {
        try {
            const result = await DB.query(`SELECT * FROM ${tableName} WHERE is_deleted = 0`);
            data[tableName] = result.rows;
            totalRecords += result.rows.length;
            console.log(`[Export] ${tableName}: ${result.rows.length} records`);
        } catch (error) {
            // Table might not exist yet
            console.warn(`[Export] Skipping ${tableName}: ${error.message}`);
            data[tableName] = [];
        }
    }

    return { data, totalRecords };
}

/**
 * Create backup metadata
 * @param {object} options - Metadata options
 * @returns {object} Metadata object
 */
function createMetadata(options) {
    const now = new Date().toISOString();

    return {
        // Backup identification
        backup_id: DB.generateUUID(),
        file_format: 'ppg',
        format_version: 1,

        // Hierarchy information
        level: options.level,
        level_name: getLevelName(options.level),
        wilayah_id: options.wilayah_id || null,
        wilayah_name: options.wilayah_name || null,

        // Creator information
        created_by: options.created_by || 'unknown',
        created_by_name: options.created_by_name || 'Unknown User',
        device_id: DB.getDeviceId(),

        // Timestamps
        created_at: now,
        exported_at: now,

        // App information
        app_name: 'PPG',
        app_version: APP_VERSION,

        // Statistics (to be filled after data export)
        table_count: 0,
        total_records: 0,

        // Target information
        target_level: getTargetLevel(options.level),
        target_level_name: getTargetLevel(options.level) ?
            getLevelName(getTargetLevel(options.level)) : null,

        // Notes
        notes: options.notes || ''
    };
}

/**
 * Create a zip file containing backup data
 * Uses JSZip library or fallback to plain JSON
 * @param {object} dataJson - Database data
 * @param {object} metaJson - Metadata
 * @param {string} checksum - Data checksum
 * @returns {Promise<Blob>} Zip file as Blob
 */
async function createZipFile(dataJson, metaJson, checksum) {
    // Check if JSZip is available
    if (typeof JSZip !== 'undefined') {
        const zip = new JSZip();

        // Add files to zip
        zip.file('data.json', JSON.stringify(dataJson, null, 2));
        zip.file('meta.json', JSON.stringify(metaJson, null, 2));
        zip.file('hash.txt', checksum);

        // Generate zip
        return await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
    }

    // Fallback: Create a combined JSON file
    console.warn('[Export] JSZip not available, using fallback format');

    const combined = {
        _format: 'ppg_combined',
        _version: 1,
        data: dataJson,
        meta: metaJson,
        hash: checksum
    };

    return new Blob(
        [JSON.stringify(combined, null, 2)],
        { type: 'application/json' }
    );
}

/**
 * Log backup operation to database
 * @param {object} metadata - Backup metadata
 * @param {string} fileName - Output file name
 * @param {string} checksum - File checksum
 * @returns {Promise<void>}
 */
async function logBackupOperation(metadata, fileName, checksum) {
    const id = DB.generateUUID();
    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    try {
        await DB.execute(`
            INSERT INTO backup_log (
                id, file_name, checksum, operation, level, wilayah_id,
                created_at, created_by, records_exported, app_version,
                status, device_id, updated_at, last_modified, sync_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, fileName, checksum, 'export', metadata.level,
            metadata.wilayah_id, now, metadata.created_by,
            metadata.total_records, APP_VERSION, 'completed',
            deviceId, now, now, 1
        ]);
        await DB.save();
        console.log('[Export] Backup logged:', id);
    } catch (error) {
        console.warn('[Export] Failed to log backup:', error.message);
    }
}

/**
 * Generate backup filename
 * @param {object} metadata - Backup metadata
 * @returns {string} Filename
 */
function generateFilename(metadata) {
    const date = new Date().toISOString().split('T')[0];
    const level = metadata.level.replace(/_/g, '-');
    const wilayah = metadata.wilayah_id ?
        `_${metadata.wilayah_id.substring(0, 8)}` : '';

    return `ppg_backup_${level}${wilayah}_${date}.ppg`;
}

/**
 * Create and download a backup file
 * @param {object} options - Export options
 * @param {string} options.level - Organizational level
 * @param {string} options.wilayah_id - Region/area ID
 * @param {string} options.wilayah_name - Region/area name
 * @param {string} options.created_by - Creator user ID
 * @param {string} options.created_by_name - Creator name
 * @param {string} options.notes - Optional notes
 * @returns {Promise<object>} Export result
 */
async function createBackup(options) {
    console.log('[Export] Starting backup export...');

    // Validate level
    if (!isValidLevel(options.level)) {
        throw new Error(`Invalid level: ${options.level}`);
    }

    const result = {
        success: false,
        fileName: null,
        checksum: null,
        metadata: null,
        error: null
    };

    try {
        // Create metadata
        const metadata = createMetadata(options);

        // Export data
        console.log('[Export] Exporting database...');
        const { data, totalRecords } = await exportAllData();

        // Update metadata with statistics
        metadata.table_count = Object.keys(data).filter(k => data[k].length > 0).length;
        metadata.total_records = totalRecords;

        // Calculate checksum
        const dataString = JSON.stringify(data);
        const checksum = await calculateChecksum(dataString);
        console.log('[Export] Checksum:', checksum);

        // Generate filename
        const fileName = generateFilename(metadata);

        // Create zip file
        console.log('[Export] Creating backup file...');
        const zipBlob = await createZipFile(data, metadata, checksum);

        // Log operation
        await logBackupOperation(metadata, fileName, checksum);

        // Create download link
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        result.success = true;
        result.fileName = fileName;
        result.checksum = checksum;
        result.metadata = metadata;

        console.log('[Export] Backup complete:', fileName);

    } catch (error) {
        console.error('[Export] Backup failed:', error);
        result.error = error.message;
    }

    return result;
}

/**
 * Get backup file info without downloading
 * @param {object} options - Same as createBackup
 * @returns {Promise<object>} Backup preview info
 */
async function previewBackup(options) {
    const metadata = createMetadata(options);
    const { data, totalRecords } = await exportAllData();

    metadata.table_count = Object.keys(data).filter(k => data[k].length > 0).length;
    metadata.total_records = totalRecords;

    // Calculate estimated size
    const dataString = JSON.stringify(data);
    metadata.estimated_size = dataString.length;
    metadata.estimated_size_formatted = formatFileSize(dataString.length);

    // Generate preview filename
    metadata.suggested_filename = generateFilename(metadata);

    return metadata;
}

/**
 * Format file size for display
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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

const ExportModule = {
    createBackup,
    previewBackup,
    exportAllData,
    createMetadata,
    calculateChecksum,
    generateFilename,
    loadJSZip,
    formatFileSize,
    APP_VERSION,
    EXPORT_TABLES
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportModule;
}

if (typeof window !== 'undefined') {
    window.BackupExport = ExportModule;
}

export default ExportModule;
export {
    createBackup,
    previewBackup,
    exportAllData,
    calculateChecksum,
    loadJSZip,
    APP_VERSION
};
