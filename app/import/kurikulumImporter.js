/**
 * =============================================================================
 * Kurikulum Importer Module (kurikulumImporter.js)
 * =============================================================================
 * Handles import of official curriculum data from signed JSON packages
 * exported from Supabase by Pusat Kurikulum.
 *
 * Features:
 * - Signature verification using ECDSA P-256
 * - Schema validation
 * - Version checking (reject older versions)
 * - UPSERT operations for curriculum tables
 * - Import history tracking
 *
 * Package Format:
 * kurikulum-ppg-vX.Y.json with structure:
 * {
 *   "meta": { version, issued_by, issued_at, signature, public_key_id },
 *   "data": { jenjang, tingkat_jenjang, kategori_materi, materi, sub_materi, kurikulum_tingkat }
 * }
 *
 * Uses Web Crypto API for production-grade cryptography.
 * =============================================================================
 */

import DB from '../db/db.js';
import {
    sha256,
    bytesToHex,
    hexToBytes,
    base64ToBytes,
    SecureStorage
} from '../security/keyManager.js';
import {
    importPublicKey,
    SIGNATURE_CONFIG
} from '../security/signatureManager.js';

/**
 * Kurikulum importer configuration
 */
const KURIKULUM_CONFIG = {
    // Expected issuer for official curriculum
    VALID_ISSUERS: ['Pusat Kurikulum', 'Kurikulum Pusat', 'PPG Pusat'],

    // Minimum required tables in curriculum package
    REQUIRED_TABLES: ['jenjang', 'tingkat_jenjang', 'materi'],

    // Optional tables
    OPTIONAL_TABLES: ['kategori_materi', 'sub_materi', 'kurikulum_tingkat'],

    // Public key ID for curriculum authority
    AUTHORITY_KEY_ID: 'kurikulum_pusat',

    // File format version
    FORMAT_VERSION: 1
};

/**
 * Storage key for Kurikulum Pusat public key
 */
const KURIKULUM_PUBLIC_KEY_STORAGE = 'kurikulum_pusat_public_key';

// =============================================================================
// Public Key Management for Kurikulum Authority
// =============================================================================

/**
 * Store the Kurikulum Pusat authority public key
 * This should be done during initial app setup or key distribution
 * @param {object} publicKeyJwk - JWK format public key
 * @returns {object} { success: boolean, error: string|null }
 */
function storeKurikulumAuthorityKey(publicKeyJwk) {
    try {
        SecureStorage.set(KURIKULUM_PUBLIC_KEY_STORAGE, {
            publicKey: publicKeyJwk,
            keyId: KURIKULUM_CONFIG.AUTHORITY_KEY_ID,
            addedAt: new Date().toISOString()
        });
        console.log('[KurikulumImporter] Authority public key stored');
        return { success: true, error: null };
    } catch (error) {
        console.error('[KurikulumImporter] Failed to store authority key:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get the Kurikulum Pusat authority public key
 * @returns {Promise<CryptoKey|null>} Public key or null
 */
async function getKurikulumAuthorityKey() {
    const stored = SecureStorage.get(KURIKULUM_PUBLIC_KEY_STORAGE);
    if (!stored || !stored.publicKey) {
        return null;
    }

    try {
        return await importPublicKey(stored.publicKey);
    } catch (error) {
        console.error('[KurikulumImporter] Failed to import authority key:', error);
        return null;
    }
}

/**
 * Check if authority key is configured
 * @returns {boolean} True if key exists
 */
function hasAuthorityKey() {
    return SecureStorage.get(KURIKULUM_PUBLIC_KEY_STORAGE) !== null;
}

/**
 * Generate a new key pair for Kurikulum Authority (for testing/setup)
 * In production, this would be done offline by the authority
 * @returns {Promise<object>} { publicKey: JWK, privateKey: JWK }
 */
async function generateAuthorityKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: SIGNATURE_CONFIG.ALGORITHM,
            namedCurve: SIGNATURE_CONFIG.CURVE
        },
        true,
        ['sign', 'verify']
    );

    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return { publicKey: publicKeyJwk, privateKey: privateKeyJwk };
}

// =============================================================================
// File Picker
// =============================================================================

/**
 * Pick kurikulum JSON file from device
 * Uses native file picker on Capacitor, input element on web
 * @returns {Promise<object>} { success: boolean, data: object|null, fileName: string, error: string|null }
 */
async function pickKurikulumFile() {
    return new Promise((resolve) => {
        // Check if running in Capacitor
        const isCapacitor = typeof window !== 'undefined' &&
                           window.Capacitor !== undefined &&
                           window.Capacitor.isNativePlatform();

        if (isCapacitor) {
            // Use Capacitor FilePicker
            pickFileCapacitor().then(resolve).catch(error => {
                resolve({ success: false, data: null, fileName: null, error: error.message });
            });
        } else {
            // Use web file input
            pickFileWeb().then(resolve);
        }
    });
}

/**
 * Pick file using web file input
 * @returns {Promise<object>}
 */
async function pickFileWeb() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';

        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) {
                resolve({ success: false, data: null, fileName: null, error: 'No file selected' });
                return;
            }

            // Validate file name pattern
            if (!file.name.match(/^kurikulum-ppg.*\.json$/i)) {
                resolve({
                    success: false,
                    data: null,
                    fileName: file.name,
                    error: 'File harus bernama kurikulum-ppg-vX.Y.json'
                });
                return;
            }

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                resolve({ success: true, data, fileName: file.name, error: null });
            } catch (error) {
                resolve({ success: false, data: null, fileName: file.name, error: 'Invalid JSON file' });
            }
        };

        input.oncancel = () => {
            resolve({ success: false, data: null, fileName: null, error: 'File selection cancelled' });
        };

        input.click();
    });
}

/**
 * Pick file using Capacitor FilePicker
 * @returns {Promise<object>}
 */
async function pickFileCapacitor() {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { FilePicker } = await import('@capawesome/capacitor-file-picker');

    const result = await FilePicker.pickFiles({
        types: ['application/json'],
        multiple: false
    });

    if (!result.files || result.files.length === 0) {
        return { success: false, data: null, fileName: null, error: 'No file selected' };
    }

    const file = result.files[0];

    // Read file content
    const content = await Filesystem.readFile({
        path: file.path,
        directory: Directory.Documents
    });

    try {
        // Decode base64 if needed
        let text = content.data;
        if (typeof text !== 'string') {
            text = new TextDecoder().decode(content.data);
        } else if (text.match(/^[A-Za-z0-9+/=]+$/)) {
            text = atob(text);
        }

        const data = JSON.parse(text);
        return { success: true, data, fileName: file.name, error: null };
    } catch (error) {
        return { success: false, data: null, fileName: file.name, error: 'Invalid JSON file' };
    }
}

// =============================================================================
// Signature Verification
// =============================================================================

/**
 * Verify kurikulum package signature
 * @param {object} kurikulumJson - Full kurikulum JSON object
 * @returns {Promise<object>} { valid: boolean, error: string|null }
 */
async function verifyKurikulumSignature(kurikulumJson) {
    const { meta, data } = kurikulumJson;

    if (!meta || !meta.signature) {
        return { valid: false, error: 'Missing signature in package' };
    }

    // Get authority public key
    let publicKey = await getKurikulumAuthorityKey();

    // If no stored key, try embedded public key
    if (!publicKey && meta.public_key) {
        try {
            publicKey = await importPublicKey(meta.public_key);
            console.log('[KurikulumImporter] Using embedded public key');
        } catch (error) {
            return { valid: false, error: 'Cannot import embedded public key' };
        }
    }

    if (!publicKey) {
        return {
            valid: false,
            error: 'Kunci publik Kurikulum Pusat tidak ditemukan. Harap import kunci terlebih dahulu.'
        };
    }

    try {
        // Create data to verify (canonical JSON of data section)
        const dataString = JSON.stringify(data);
        const dataBytes = new TextEncoder().encode(dataString);

        // Hash the data
        const dataHash = await sha256(dataBytes);

        // Decode signature
        const signatureBytes = base64ToBytes(meta.signature);

        // Verify signature
        const isValid = await crypto.subtle.verify(
            {
                name: SIGNATURE_CONFIG.ALGORITHM,
                hash: SIGNATURE_CONFIG.HASH
            },
            publicKey,
            signatureBytes,
            dataHash
        );

        if (!isValid) {
            return { valid: false, error: 'Tanda tangan tidak valid. Paket kurikulum mungkin dimodifikasi.' };
        }

        return { valid: true, error: null };
    } catch (error) {
        console.error('[KurikulumImporter] Signature verification error:', error);
        return { valid: false, error: `Verification error: ${error.message}` };
    }
}

/**
 * Sign kurikulum data (for authority use)
 * @param {object} data - Curriculum data object
 * @param {CryptoKey} privateKey - Authority private key
 * @returns {Promise<string>} Base64 encoded signature
 */
async function signKurikulumData(data, privateKey) {
    const dataString = JSON.stringify(data);
    const dataBytes = new TextEncoder().encode(dataString);
    const dataHash = await sha256(dataBytes);

    const signatureBuffer = await crypto.subtle.sign(
        {
            name: SIGNATURE_CONFIG.ALGORITHM,
            hash: SIGNATURE_CONFIG.HASH
        },
        privateKey,
        dataHash
    );

    // Convert to base64
    const signatureArray = new Uint8Array(signatureBuffer);
    let binary = '';
    signatureArray.forEach(byte => binary += String.fromCharCode(byte));
    return btoa(binary);
}

// =============================================================================
// Schema Validation
// =============================================================================

/**
 * Validate kurikulum package schema
 * @param {object} kurikulumJson - Full kurikulum JSON object
 * @returns {object} { valid: boolean, errors: string[] }
 */
function validateKurikulumSchema(kurikulumJson) {
    const errors = [];

    // Check meta section
    if (!kurikulumJson.meta) {
        errors.push('Missing "meta" section');
    } else {
        if (!kurikulumJson.meta.version) errors.push('Missing meta.version');
        if (!kurikulumJson.meta.issued_by) errors.push('Missing meta.issued_by');
        if (!kurikulumJson.meta.issued_at) errors.push('Missing meta.issued_at');
        if (!kurikulumJson.meta.signature) errors.push('Missing meta.signature');
    }

    // Check data section
    if (!kurikulumJson.data) {
        errors.push('Missing "data" section');
    } else {
        // Check required tables
        for (const table of KURIKULUM_CONFIG.REQUIRED_TABLES) {
            if (!kurikulumJson.data[table]) {
                errors.push(`Missing required table: ${table}`);
            } else if (!Array.isArray(kurikulumJson.data[table])) {
                errors.push(`Table ${table} must be an array`);
            }
        }

        // Validate optional tables if present
        for (const table of KURIKULUM_CONFIG.OPTIONAL_TABLES) {
            if (kurikulumJson.data[table] && !Array.isArray(kurikulumJson.data[table])) {
                errors.push(`Table ${table} must be an array`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validate record has required fields
 * @param {object} record - Data record
 * @param {string[]} requiredFields - Required field names
 * @param {string} tableName - Table name for error message
 * @returns {object} { valid: boolean, missing: string[] }
 */
function validateRecord(record, requiredFields, tableName) {
    const missing = requiredFields.filter(field => !record[field] && record[field] !== 0);
    return {
        valid: missing.length === 0,
        missing
    };
}

// =============================================================================
// Version Checking
// =============================================================================

/**
 * Get current kurikulum version from database
 * @returns {Promise<object|null>} Current version info or null
 */
async function getCurrentVersion() {
    try {
        const result = await DB.query(
            `SELECT * FROM kurikulum_version
             WHERE status = 'active'
             ORDER BY imported_at DESC
             LIMIT 1`
        );
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        // Table might not exist yet
        return null;
    }
}

/**
 * Compare version strings
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
}

/**
 * Check if new version is valid (not older than current)
 * @param {string} newVersion - New version string
 * @returns {Promise<object>} { valid: boolean, currentVersion: string|null, error: string|null }
 */
async function checkVersionValidity(newVersion) {
    const current = await getCurrentVersion();

    if (!current) {
        return { valid: true, currentVersion: null, error: null };
    }

    const comparison = compareVersions(newVersion, current.version);

    if (comparison < 0) {
        return {
            valid: false,
            currentVersion: current.version,
            error: `Versi ${newVersion} lebih lama dari versi saat ini (${current.version})`
        };
    }

    if (comparison === 0) {
        // Same version - might be re-import, allow but warn
        return {
            valid: true,
            currentVersion: current.version,
            error: null,
            warning: `Versi ${newVersion} sama dengan versi saat ini. Data akan diperbarui.`
        };
    }

    return { valid: true, currentVersion: current.version, error: null };
}

// =============================================================================
// Data Import Operations
// =============================================================================

/**
 * Import kurikulum data into database
 * Uses UPSERT (INSERT OR REPLACE) for idempotent imports
 * @param {object} data - Curriculum data object
 * @returns {Promise<object>} Import statistics
 */
async function importKurikulumData(data) {
    const stats = {
        jenjang: { imported: 0, updated: 0, skipped: 0 },
        tingkat_jenjang: { imported: 0, updated: 0, skipped: 0 },
        kategori_materi: { imported: 0, updated: 0, skipped: 0 },
        materi: { imported: 0, updated: 0, skipped: 0 },
        sub_materi: { imported: 0, updated: 0, skipped: 0 },
        kurikulum_tingkat: { imported: 0, updated: 0, skipped: 0 },
        errors: []
    };

    try {
        await DB.beginTransaction();

        // Import in order of dependencies
        if (data.jenjang) {
            await importJenjang(data.jenjang, stats);
        }

        if (data.tingkat_jenjang) {
            await importTingkatJenjang(data.tingkat_jenjang, stats);
        }

        if (data.kategori_materi) {
            await importKategoriMateri(data.kategori_materi, stats);
        }

        if (data.materi) {
            await importMateri(data.materi, stats);
        }

        if (data.sub_materi) {
            await importSubMateri(data.sub_materi, stats);
        }

        if (data.kurikulum_tingkat) {
            await importKurikulumTingkat(data.kurikulum_tingkat, stats);
        }

        await DB.commitTransaction();
        console.log('[KurikulumImporter] Import completed:', stats);

    } catch (error) {
        await DB.rollbackTransaction();
        stats.errors.push(`Import failed: ${error.message}`);
        console.error('[KurikulumImporter] Import failed:', error);
    }

    return stats;
}

/**
 * Import jenjang records
 */
async function importJenjang(records, stats) {
    for (const record of records) {
        const validation = validateRecord(record, ['id', 'kode', 'nama'], 'jenjang');
        if (!validation.valid) {
            stats.jenjang.skipped++;
            stats.errors.push(`Jenjang: missing ${validation.missing.join(', ')}`);
            continue;
        }

        try {
            // Check if exists
            const existing = await DB.query('SELECT id FROM jenjang WHERE id = ?', [record.id]);

            await DB.execute(
                `INSERT OR REPLACE INTO jenjang
                 (id, kode, nama, deskripsi, urutan, status, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    record.id,
                    record.kode,
                    record.nama,
                    record.deskripsi || null,
                    record.urutan || 0,
                    record.status || 'aktif'
                ]
            );

            if (existing.rows.length > 0) {
                stats.jenjang.updated++;
            } else {
                stats.jenjang.imported++;
            }
        } catch (error) {
            stats.jenjang.skipped++;
            stats.errors.push(`Jenjang ${record.id}: ${error.message}`);
        }
    }
}

/**
 * Import tingkat_jenjang records
 */
async function importTingkatJenjang(records, stats) {
    for (const record of records) {
        const validation = validateRecord(record, ['id', 'jenjang_id', 'kode', 'nama'], 'tingkat_jenjang');
        if (!validation.valid) {
            stats.tingkat_jenjang.skipped++;
            continue;
        }

        try {
            const existing = await DB.query('SELECT id FROM tingkat_jenjang WHERE id = ?', [record.id]);

            await DB.execute(
                `INSERT OR REPLACE INTO tingkat_jenjang
                 (id, jenjang_id, kode, nama, deskripsi, urutan, usia_minimal, usia_maksimal, status, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    record.id,
                    record.jenjang_id,
                    record.kode,
                    record.nama,
                    record.deskripsi || null,
                    record.urutan || 0,
                    record.usia_minimal || null,
                    record.usia_maksimal || null,
                    record.status || 'aktif'
                ]
            );

            if (existing.rows.length > 0) {
                stats.tingkat_jenjang.updated++;
            } else {
                stats.tingkat_jenjang.imported++;
            }
        } catch (error) {
            stats.tingkat_jenjang.skipped++;
            stats.errors.push(`TingkatJenjang ${record.id}: ${error.message}`);
        }
    }
}

/**
 * Import kategori_materi records
 */
async function importKategoriMateri(records, stats) {
    for (const record of records) {
        const validation = validateRecord(record, ['id', 'kode', 'nama'], 'kategori_materi');
        if (!validation.valid) {
            stats.kategori_materi.skipped++;
            continue;
        }

        try {
            const existing = await DB.query('SELECT id FROM kategori_materi WHERE id = ?', [record.id]);

            await DB.execute(
                `INSERT OR REPLACE INTO kategori_materi
                 (id, kode, nama, deskripsi, warna, icon, urutan, status, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    record.id,
                    record.kode,
                    record.nama,
                    record.deskripsi || null,
                    record.warna || null,
                    record.icon || null,
                    record.urutan || 0,
                    record.status || 'aktif'
                ]
            );

            if (existing.rows.length > 0) {
                stats.kategori_materi.updated++;
            } else {
                stats.kategori_materi.imported++;
            }
        } catch (error) {
            stats.kategori_materi.skipped++;
            stats.errors.push(`KategoriMateri ${record.id}: ${error.message}`);
        }
    }
}

/**
 * Import materi records
 */
async function importMateri(records, stats) {
    for (const record of records) {
        const validation = validateRecord(record, ['id', 'kategori_id', 'kode', 'nama'], 'materi');
        if (!validation.valid) {
            stats.materi.skipped++;
            continue;
        }

        try {
            const existing = await DB.query('SELECT id FROM materi WHERE id = ?', [record.id]);

            await DB.execute(
                `INSERT OR REPLACE INTO materi
                 (id, kategori_id, kode, nama, deskripsi, tujuan, sumber_rujukan, urutan, bobot, status, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    record.id,
                    record.kategori_id,
                    record.kode,
                    record.nama,
                    record.deskripsi || null,
                    record.tujuan || null,
                    record.sumber_rujukan || null,
                    record.urutan || 0,
                    record.bobot || 1,
                    record.status || 'aktif'
                ]
            );

            if (existing.rows.length > 0) {
                stats.materi.updated++;
            } else {
                stats.materi.imported++;
            }
        } catch (error) {
            stats.materi.skipped++;
            stats.errors.push(`Materi ${record.id}: ${error.message}`);
        }
    }
}

/**
 * Import sub_materi records
 */
async function importSubMateri(records, stats) {
    for (const record of records) {
        const validation = validateRecord(record, ['id', 'materi_id', 'kode', 'nama'], 'sub_materi');
        if (!validation.valid) {
            stats.sub_materi.skipped++;
            continue;
        }

        try {
            const existing = await DB.query('SELECT id FROM sub_materi WHERE id = ?', [record.id]);

            await DB.execute(
                `INSERT OR REPLACE INTO sub_materi
                 (id, materi_id, kode, nama, deskripsi, kompetensi_dasar, indikator, urutan, estimasi_jam, status, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    record.id,
                    record.materi_id,
                    record.kode,
                    record.nama,
                    record.deskripsi || null,
                    record.kompetensi_dasar || null,
                    record.indikator || null,
                    record.urutan || 0,
                    record.estimasi_jam || null,
                    record.status || 'aktif'
                ]
            );

            if (existing.rows.length > 0) {
                stats.sub_materi.updated++;
            } else {
                stats.sub_materi.imported++;
            }
        } catch (error) {
            stats.sub_materi.skipped++;
            stats.errors.push(`SubMateri ${record.id}: ${error.message}`);
        }
    }
}

/**
 * Import kurikulum_tingkat records
 */
async function importKurikulumTingkat(records, stats) {
    for (const record of records) {
        const validation = validateRecord(record, ['id', 'tingkat_id', 'materi_id'], 'kurikulum_tingkat');
        if (!validation.valid) {
            stats.kurikulum_tingkat.skipped++;
            continue;
        }

        try {
            const existing = await DB.query('SELECT id FROM kurikulum_tingkat WHERE id = ?', [record.id]);

            await DB.execute(
                `INSERT OR REPLACE INTO kurikulum_tingkat
                 (id, tingkat_id, materi_id, semester, target_kompetensi, jam_per_minggu, jam_total, wajib, urutan, catatan, status, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    record.id,
                    record.tingkat_id,
                    record.materi_id,
                    record.semester || null,
                    record.target_kompetensi || null,
                    record.jam_per_minggu || null,
                    record.jam_total || null,
                    record.wajib !== undefined ? record.wajib : 1,
                    record.urutan || 0,
                    record.catatan || null,
                    record.status || 'aktif'
                ]
            );

            if (existing.rows.length > 0) {
                stats.kurikulum_tingkat.updated++;
            } else {
                stats.kurikulum_tingkat.imported++;
            }
        } catch (error) {
            stats.kurikulum_tingkat.skipped++;
            stats.errors.push(`KurikulumTingkat ${record.id}: ${error.message}`);
        }
    }
}

// =============================================================================
// Version History
// =============================================================================

/**
 * Save kurikulum version history
 * @param {object} meta - Package metadata
 * @param {string} hash - Data hash
 * @param {object} stats - Import statistics
 * @param {boolean} signatureValid - Whether signature was valid
 * @returns {Promise<void>}
 */
async function saveKurikulumVersion(meta, hash, stats, signatureValid) {
    // Mark previous version as superseded
    await DB.execute(
        `UPDATE kurikulum_version SET status = 'superseded' WHERE status = 'active'`
    );

    // Calculate totals
    const totalImported = Object.values(stats)
        .filter(s => typeof s === 'object' && s.imported !== undefined)
        .reduce((sum, s) => sum + s.imported, 0);

    const totalUpdated = Object.values(stats)
        .filter(s => typeof s === 'object' && s.updated !== undefined)
        .reduce((sum, s) => sum + s.updated, 0);

    const totalSkipped = Object.values(stats)
        .filter(s => typeof s === 'object' && s.skipped !== undefined)
        .reduce((sum, s) => sum + s.skipped, 0);

    // Insert new version
    await DB.execute(
        `INSERT INTO kurikulum_version
         (id, version, issued_by, issued_at, hash, signature_valid, public_key_id,
          records_imported, records_updated, records_skipped, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
            DB.generateUUID(),
            meta.version,
            meta.issued_by,
            meta.issued_at,
            hash,
            signatureValid ? 1 : 0,
            meta.public_key_id || null,
            totalImported,
            totalUpdated,
            totalSkipped
        ]
    );

    await DB.save();
    console.log('[KurikulumImporter] Version history saved');
}

/**
 * Get kurikulum import history
 * @param {number} limit - Maximum number of records
 * @returns {Promise<Array>} Version history
 */
async function getKurikulumHistory(limit = 10) {
    try {
        const result = await DB.query(
            `SELECT * FROM kurikulum_version ORDER BY imported_at DESC LIMIT ?`,
            [limit]
        );
        return result.rows;
    } catch (error) {
        return [];
    }
}

// =============================================================================
// Main Import Flow
// =============================================================================

/**
 * Full import process: pick file, verify, validate, import
 * @param {object} options - Import options
 * @returns {Promise<object>} Import result
 */
async function importKurikulum(options = {}) {
    const result = {
        success: false,
        fileName: null,
        version: null,
        signatureValid: false,
        stats: null,
        errors: [],
        warnings: []
    };

    // Step 1: Pick file
    console.log('[KurikulumImporter] Step 1: Picking file...');
    const fileResult = await pickKurikulumFile();

    if (!fileResult.success) {
        result.errors.push(fileResult.error);
        return result;
    }

    result.fileName = fileResult.fileName;
    const kurikulumJson = fileResult.data;

    // Step 2: Validate schema
    console.log('[KurikulumImporter] Step 2: Validating schema...');
    const schemaResult = validateKurikulumSchema(kurikulumJson);

    if (!schemaResult.valid) {
        result.errors.push(...schemaResult.errors);
        return result;
    }

    result.version = kurikulumJson.meta.version;

    // Step 3: Check version
    console.log('[KurikulumImporter] Step 3: Checking version...');
    const versionResult = await checkVersionValidity(kurikulumJson.meta.version);

    if (!versionResult.valid) {
        result.errors.push(versionResult.error);
        return result;
    }

    if (versionResult.warning) {
        result.warnings.push(versionResult.warning);
    }

    // Step 4: Verify signature
    console.log('[KurikulumImporter] Step 4: Verifying signature...');
    const signatureResult = await verifyKurikulumSignature(kurikulumJson);

    result.signatureValid = signatureResult.valid;

    if (!signatureResult.valid) {
        if (options.requireSignature !== false) {
            result.errors.push(signatureResult.error);
            return result;
        } else {
            result.warnings.push(`Signature warning: ${signatureResult.error}`);
        }
    }

    // Step 5: Import data
    console.log('[KurikulumImporter] Step 5: Importing data...');
    const importStats = await importKurikulumData(kurikulumJson.data);

    result.stats = importStats;

    if (importStats.errors.length > 0) {
        result.warnings.push(...importStats.errors);
    }

    // Step 6: Save version history
    console.log('[KurikulumImporter] Step 6: Saving version history...');
    const dataString = JSON.stringify(kurikulumJson.data);
    const dataHash = bytesToHex(await sha256(dataString));

    await saveKurikulumVersion(kurikulumJson.meta, dataHash, importStats, result.signatureValid);

    result.success = true;
    console.log('[KurikulumImporter] Import completed successfully');

    return result;
}

/**
 * Import from provided JSON object (for programmatic use)
 * @param {object} kurikulumJson - Kurikulum JSON object
 * @param {object} options - Import options
 * @returns {Promise<object>} Import result
 */
async function importKurikulumFromJson(kurikulumJson, options = {}) {
    const result = {
        success: false,
        version: null,
        signatureValid: false,
        stats: null,
        errors: [],
        warnings: []
    };

    // Validate schema
    const schemaResult = validateKurikulumSchema(kurikulumJson);
    if (!schemaResult.valid) {
        result.errors.push(...schemaResult.errors);
        return result;
    }

    result.version = kurikulumJson.meta.version;

    // Check version
    const versionResult = await checkVersionValidity(kurikulumJson.meta.version);
    if (!versionResult.valid) {
        result.errors.push(versionResult.error);
        return result;
    }

    // Verify signature
    const signatureResult = await verifyKurikulumSignature(kurikulumJson);
    result.signatureValid = signatureResult.valid;

    if (!signatureResult.valid && options.requireSignature !== false) {
        result.errors.push(signatureResult.error);
        return result;
    }

    // Import data
    const importStats = await importKurikulumData(kurikulumJson.data);
    result.stats = importStats;

    // Save version
    const dataString = JSON.stringify(kurikulumJson.data);
    const dataHash = bytesToHex(await sha256(dataString));
    await saveKurikulumVersion(kurikulumJson.meta, dataHash, importStats, result.signatureValid);

    result.success = true;
    return result;
}

// =============================================================================
// Export Module
// =============================================================================

const KurikulumImporter = {
    // Configuration
    KURIKULUM_CONFIG,

    // Authority key management
    storeKurikulumAuthorityKey,
    getKurikulumAuthorityKey,
    hasAuthorityKey,
    generateAuthorityKeyPair,

    // File operations
    pickKurikulumFile,

    // Verification
    verifyKurikulumSignature,
    signKurikulumData,

    // Validation
    validateKurikulumSchema,
    checkVersionValidity,
    compareVersions,

    // Import operations
    importKurikulumData,
    saveKurikulumVersion,

    // History
    getCurrentVersion,
    getKurikulumHistory,

    // Main flows
    importKurikulum,
    importKurikulumFromJson
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KurikulumImporter;
}

// Global export
if (typeof window !== 'undefined') {
    window.KurikulumImporter = KurikulumImporter;
}

export default KurikulumImporter;
export {
    KURIKULUM_CONFIG,
    storeKurikulumAuthorityKey,
    getKurikulumAuthorityKey,
    hasAuthorityKey,
    generateAuthorityKeyPair,
    pickKurikulumFile,
    verifyKurikulumSignature,
    signKurikulumData,
    validateKurikulumSchema,
    checkVersionValidity,
    importKurikulumData,
    saveKurikulumVersion,
    getCurrentVersion,
    getKurikulumHistory,
    importKurikulum,
    importKurikulumFromJson
};
