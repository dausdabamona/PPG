/**
 * =============================================================================
 * Jamaah (Student) Service
 * =============================================================================
 * CRUD operations for jamaah (student/participant) management
 *
 * Features:
 * - Full CRUD operations (Create, Read, Update, Delete)
 * - Soft delete support for sync
 * - Search and filter capabilities
 * - Offline-first with sync field management
 * =============================================================================
 */

import DB from '../db/db.js';

/**
 * Create a new jamaah record
 * @param {object} data - Jamaah data
 * @returns {Promise<object>} Created jamaah record
 */
async function create(data) {
    const id = DB.generateUUID();
    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    const jamaah = {
        id,
        nama_lengkap: data.nama_lengkap,
        nama_panggilan: data.nama_panggilan || null,
        tanggal_lahir: data.tanggal_lahir || null,
        jenis_kelamin: data.jenis_kelamin || null,
        alamat: data.alamat || null,
        nomor_telepon: data.nomor_telepon || null,
        email: data.email || null,
        nama_orang_tua: data.nama_orang_tua || null,
        telepon_orang_tua: data.telepon_orang_tua || null,
        tanggal_daftar: data.tanggal_daftar || now.split(' ')[0],
        status: data.status || 'aktif',
        foto: data.foto || null,
        catatan: data.catatan || null,
        created_at: now,
        updated_at: now,
        last_modified: now,
        sync_version: 1,
        is_deleted: 0,
        device_id: deviceId
    };

    const sql = `
        INSERT INTO jamaah (
            id, nama_lengkap, nama_panggilan, tanggal_lahir, jenis_kelamin,
            alamat, nomor_telepon, email, nama_orang_tua, telepon_orang_tua,
            tanggal_daftar, status, foto, catatan,
            created_at, updated_at, last_modified, sync_version, is_deleted, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        jamaah.id, jamaah.nama_lengkap, jamaah.nama_panggilan, jamaah.tanggal_lahir,
        jamaah.jenis_kelamin, jamaah.alamat, jamaah.nomor_telepon, jamaah.email,
        jamaah.nama_orang_tua, jamaah.telepon_orang_tua, jamaah.tanggal_daftar,
        jamaah.status, jamaah.foto, jamaah.catatan,
        jamaah.created_at, jamaah.updated_at, jamaah.last_modified,
        jamaah.sync_version, jamaah.is_deleted, jamaah.device_id
    ];

    await DB.execute(sql, params);
    await DB.save();

    console.log('[JamaahService] Created:', jamaah.nama_lengkap);
    return jamaah;
}

/**
 * Get jamaah by ID
 * @param {string} id - Jamaah UUID
 * @returns {Promise<object|null>} Jamaah record or null
 */
async function getById(id) {
    const result = await DB.query(
        'SELECT * FROM jamaah WHERE id = ? AND is_deleted = 0',
        [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get all jamaah records
 * @param {object} options - Query options
 * @param {string} options.status - Filter by status
 * @param {string} options.search - Search term for name
 * @param {number} options.limit - Max records to return
 * @param {number} options.offset - Skip records
 * @param {string} options.orderBy - Column to order by
 * @param {string} options.order - ASC or DESC
 * @returns {Promise<Array>} List of jamaah records
 */
async function getAll(options = {}) {
    let sql = 'SELECT * FROM jamaah WHERE is_deleted = 0';
    const params = [];

    // Filter by status
    if (options.status) {
        sql += ' AND status = ?';
        params.push(options.status);
    }

    // Search by name
    if (options.search) {
        sql += ' AND (nama_lengkap LIKE ? OR nama_panggilan LIKE ?)';
        const searchTerm = `%${options.search}%`;
        params.push(searchTerm, searchTerm);
    }

    // Order by
    const orderBy = options.orderBy || 'nama_lengkap';
    const order = options.order || 'ASC';
    sql += ` ORDER BY ${orderBy} ${order}`;

    // Pagination
    if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
    }
    if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
    }

    const result = await DB.query(sql, params);
    return result.rows;
}

/**
 * Update jamaah record
 * @param {string} id - Jamaah UUID
 * @param {object} data - Updated data
 * @returns {Promise<object|null>} Updated jamaah record
 */
async function update(id, data) {
    // Get current record
    const current = await getById(id);
    if (!current) {
        console.warn('[JamaahService] Update failed: not found', id);
        return null;
    }

    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    // Build update query dynamically
    const updates = [];
    const params = [];

    const allowedFields = [
        'nama_lengkap', 'nama_panggilan', 'tanggal_lahir', 'jenis_kelamin',
        'alamat', 'nomor_telepon', 'email', 'nama_orang_tua', 'telepon_orang_tua',
        'tanggal_daftar', 'status', 'foto', 'catatan'
    ];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(data[field]);
        }
    }

    if (updates.length === 0) {
        return current;  // No changes
    }

    // Add sync fields
    updates.push('updated_at = ?', 'last_modified = ?', 'sync_version = ?', 'device_id = ?');
    params.push(now, now, current.sync_version + 1, deviceId);

    // Add WHERE clause
    params.push(id);

    const sql = `UPDATE jamaah SET ${updates.join(', ')} WHERE id = ?`;
    await DB.execute(sql, params);
    await DB.save();

    console.log('[JamaahService] Updated:', id);
    return await getById(id);
}

/**
 * Soft delete jamaah record
 * @param {string} id - Jamaah UUID
 * @returns {Promise<boolean>} Success status
 */
async function remove(id) {
    const current = await getById(id);
    if (!current) {
        return false;
    }

    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    await DB.execute(
        `UPDATE jamaah SET
            is_deleted = 1,
            updated_at = ?,
            last_modified = ?,
            sync_version = ?,
            device_id = ?
        WHERE id = ?`,
        [now, now, current.sync_version + 1, deviceId, id]
    );

    await DB.save();
    console.log('[JamaahService] Deleted:', id);
    return true;
}

/**
 * Hard delete jamaah record (permanent)
 * Use with caution - only for local cleanup
 * @param {string} id - Jamaah UUID
 * @returns {Promise<boolean>} Success status
 */
async function hardDelete(id) {
    await DB.execute('DELETE FROM jamaah WHERE id = ?', [id]);
    await DB.save();
    console.log('[JamaahService] Hard deleted:', id);
    return true;
}

/**
 * Count jamaah records
 * @param {object} options - Filter options
 * @returns {Promise<number>} Count
 */
async function count(options = {}) {
    let sql = 'SELECT COUNT(*) as count FROM jamaah WHERE is_deleted = 0';
    const params = [];

    if (options.status) {
        sql += ' AND status = ?';
        params.push(options.status);
    }

    const result = await DB.query(sql, params);
    return result.rows[0]?.count || 0;
}

/**
 * Get jamaah records modified after a timestamp
 * Used for sync operations
 * @param {string} since - ISO timestamp
 * @returns {Promise<Array>} Modified records
 */
async function getModifiedSince(since) {
    const result = await DB.query(
        'SELECT * FROM jamaah WHERE last_modified > ? ORDER BY last_modified ASC',
        [since]
    );
    return result.rows;
}

/**
 * Get deleted jamaah records after a timestamp
 * Used for sync operations
 * @param {string} since - ISO timestamp
 * @returns {Promise<Array>} Deleted records
 */
async function getDeletedSince(since) {
    const result = await DB.query(
        'SELECT id, last_modified, sync_version FROM jamaah WHERE is_deleted = 1 AND last_modified > ?',
        [since]
    );
    return result.rows;
}

/**
 * Bulk upsert for sync
 * @param {Array} records - Array of jamaah records
 * @returns {Promise<object>} Sync results
 */
async function bulkUpsert(records) {
    const results = { inserted: 0, updated: 0, skipped: 0 };

    for (const record of records) {
        const existing = await DB.query(
            'SELECT sync_version FROM jamaah WHERE id = ?',
            [record.id]
        );

        if (existing.rows.length === 0) {
            // Insert new record
            await create(record);
            results.inserted++;
        } else if (record.sync_version > existing.rows[0].sync_version) {
            // Update if incoming version is higher
            await update(record.id, record);
            results.updated++;
        } else {
            results.skipped++;
        }
    }

    return results;
}

// =============================================================================
// Export module
// =============================================================================

const JamaahService = {
    create,
    getById,
    getAll,
    update,
    remove,
    hardDelete,
    count,
    getModifiedSince,
    getDeletedSince,
    bulkUpsert
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = JamaahService;
}

if (typeof window !== 'undefined') {
    window.JamaahService = JamaahService;
}

export default JamaahService;
export {
    create,
    getById,
    getAll,
    update,
    remove,
    hardDelete,
    count,
    getModifiedSince,
    getDeletedSince,
    bulkUpsert
};
