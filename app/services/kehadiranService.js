/**
 * =============================================================================
 * Kehadiran (Attendance) Service
 * =============================================================================
 * CRUD operations for attendance session and individual attendance management
 *
 * Features:
 * - Session management (kehadiran)
 * - Individual attendance records (kehadiran_detail)
 * - Attendance statistics and reports
 * - Bulk attendance recording
 * - Offline-first with sync field management
 * =============================================================================
 */

import DB from '../db/db.js';

// =============================================================================
// Session (Kehadiran) Operations
// =============================================================================

/**
 * Create a new attendance session
 * @param {object} data - Session data
 * @returns {Promise<object>} Created session record
 */
async function createSession(data) {
    const id = DB.generateUUID();
    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    const session = {
        id,
        kelas_id: data.kelas_id,
        tanggal: data.tanggal || now.split(' ')[0],
        nama_kelas: data.nama_kelas || null,
        materi_hari_ini: data.materi_hari_ini || null,
        waktu_mulai: data.waktu_mulai || null,
        waktu_selesai: data.waktu_selesai || null,
        mubaligh_hadir: data.mubaligh_hadir || null,
        jumlah_hadir: data.jumlah_hadir || 0,
        jumlah_tidak_hadir: data.jumlah_tidak_hadir || 0,
        jumlah_izin: data.jumlah_izin || 0,
        jumlah_sakit: data.jumlah_sakit || 0,
        catatan_sesi: data.catatan_sesi || null,
        created_at: now,
        updated_at: now,
        last_modified: now,
        sync_version: 1,
        is_deleted: 0,
        device_id: deviceId
    };

    const sql = `
        INSERT INTO kehadiran (
            id, kelas_id, tanggal, nama_kelas, materi_hari_ini,
            waktu_mulai, waktu_selesai, mubaligh_hadir,
            jumlah_hadir, jumlah_tidak_hadir, jumlah_izin, jumlah_sakit,
            catatan_sesi, created_at, updated_at, last_modified,
            sync_version, is_deleted, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        session.id, session.kelas_id, session.tanggal, session.nama_kelas,
        session.materi_hari_ini, session.waktu_mulai, session.waktu_selesai,
        session.mubaligh_hadir, session.jumlah_hadir, session.jumlah_tidak_hadir,
        session.jumlah_izin, session.jumlah_sakit, session.catatan_sesi,
        session.created_at, session.updated_at, session.last_modified,
        session.sync_version, session.is_deleted, session.device_id
    ];

    await DB.execute(sql, params);
    await DB.save();

    console.log('[KehadiranService] Session created:', session.tanggal, session.nama_kelas);
    return session;
}

/**
 * Get session by ID
 * @param {string} id - Session UUID
 * @returns {Promise<object|null>} Session record or null
 */
async function getSessionById(id) {
    const result = await DB.query(
        'SELECT * FROM kehadiran WHERE id = ? AND is_deleted = 0',
        [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get all sessions with filters
 * @param {object} options - Query options
 * @returns {Promise<Array>} List of session records
 */
async function getAllSessions(options = {}) {
    let sql = 'SELECT * FROM kehadiran WHERE is_deleted = 0';
    const params = [];

    // Filter by kelas
    if (options.kelas_id) {
        sql += ' AND kelas_id = ?';
        params.push(options.kelas_id);
    }

    // Filter by date range
    if (options.tanggal_dari) {
        sql += ' AND tanggal >= ?';
        params.push(options.tanggal_dari);
    }
    if (options.tanggal_sampai) {
        sql += ' AND tanggal <= ?';
        params.push(options.tanggal_sampai);
    }

    // Order by
    const orderBy = options.orderBy || 'tanggal';
    const order = options.order || 'DESC';
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
 * Update session record
 * @param {string} id - Session UUID
 * @param {object} data - Updated data
 * @returns {Promise<object|null>} Updated session record
 */
async function updateSession(id, data) {
    const current = await getSessionById(id);
    if (!current) {
        return null;
    }

    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    const updates = [];
    const params = [];

    const allowedFields = [
        'kelas_id', 'tanggal', 'nama_kelas', 'materi_hari_ini',
        'waktu_mulai', 'waktu_selesai', 'mubaligh_hadir',
        'jumlah_hadir', 'jumlah_tidak_hadir', 'jumlah_izin', 'jumlah_sakit',
        'catatan_sesi'
    ];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(data[field]);
        }
    }

    if (updates.length === 0) {
        return current;
    }

    updates.push('updated_at = ?', 'last_modified = ?', 'sync_version = ?', 'device_id = ?');
    params.push(now, now, current.sync_version + 1, deviceId);
    params.push(id);

    const sql = `UPDATE kehadiran SET ${updates.join(', ')} WHERE id = ?`;
    await DB.execute(sql, params);
    await DB.save();

    console.log('[KehadiranService] Session updated:', id);
    return await getSessionById(id);
}

/**
 * Soft delete session
 * @param {string} id - Session UUID
 * @returns {Promise<boolean>} Success status
 */
async function removeSession(id) {
    const current = await getSessionById(id);
    if (!current) {
        return false;
    }

    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    await DB.execute(
        `UPDATE kehadiran SET
            is_deleted = 1,
            updated_at = ?,
            last_modified = ?,
            sync_version = ?,
            device_id = ?
        WHERE id = ?`,
        [now, now, current.sync_version + 1, deviceId, id]
    );

    await DB.save();
    console.log('[KehadiranService] Session deleted:', id);
    return true;
}

// =============================================================================
// Individual Attendance (Kehadiran_Detail) Operations
// =============================================================================

/**
 * Record individual attendance
 * @param {object} data - Attendance data
 * @returns {Promise<object>} Created attendance record
 */
async function recordAttendance(data) {
    const id = DB.generateUUID();
    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    const attendance = {
        id,
        kehadiran_id: data.kehadiran_id,
        jamaah_id: data.jamaah_id,
        status: data.status || 'hadir',
        waktu_datang: data.waktu_datang || null,
        waktu_pulang: data.waktu_pulang || null,
        nama_jamaah: data.nama_jamaah || null,
        keterangan: data.keterangan || null,
        created_at: now,
        updated_at: now,
        last_modified: now,
        sync_version: 1,
        is_deleted: 0,
        device_id: deviceId
    };

    const sql = `
        INSERT INTO kehadiran_detail (
            id, kehadiran_id, jamaah_id, status, waktu_datang, waktu_pulang,
            nama_jamaah, keterangan, created_at, updated_at, last_modified,
            sync_version, is_deleted, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        attendance.id, attendance.kehadiran_id, attendance.jamaah_id,
        attendance.status, attendance.waktu_datang, attendance.waktu_pulang,
        attendance.nama_jamaah, attendance.keterangan,
        attendance.created_at, attendance.updated_at, attendance.last_modified,
        attendance.sync_version, attendance.is_deleted, attendance.device_id
    ];

    await DB.execute(sql, params);
    await DB.save();

    console.log('[KehadiranService] Attendance recorded:', attendance.nama_jamaah, attendance.status);
    return attendance;
}

/**
 * Bulk record attendance for a session
 * @param {string} sessionId - Session UUID
 * @param {Array} attendances - Array of {jamaah_id, nama_jamaah, status, keterangan}
 * @returns {Promise<object>} Results summary
 */
async function bulkRecordAttendance(sessionId, attendances) {
    const results = { recorded: 0, updated: 0, errors: 0 };

    for (const att of attendances) {
        try {
            // Check if record exists
            const existing = await DB.query(
                'SELECT id, sync_version FROM kehadiran_detail WHERE kehadiran_id = ? AND jamaah_id = ?',
                [sessionId, att.jamaah_id]
            );

            if (existing.rows.length > 0) {
                // Update existing
                await updateAttendance(existing.rows[0].id, att);
                results.updated++;
            } else {
                // Create new
                await recordAttendance({
                    kehadiran_id: sessionId,
                    jamaah_id: att.jamaah_id,
                    nama_jamaah: att.nama_jamaah,
                    status: att.status,
                    keterangan: att.keterangan,
                    waktu_datang: att.waktu_datang,
                    waktu_pulang: att.waktu_pulang
                });
                results.recorded++;
            }
        } catch (error) {
            console.error('[KehadiranService] Bulk record error:', error);
            results.errors++;
        }
    }

    // Update session counts
    await updateSessionCounts(sessionId);

    return results;
}

/**
 * Update individual attendance record
 * @param {string} id - Attendance detail UUID
 * @param {object} data - Updated data
 * @returns {Promise<object|null>} Updated record
 */
async function updateAttendance(id, data) {
    const result = await DB.query(
        'SELECT * FROM kehadiran_detail WHERE id = ? AND is_deleted = 0',
        [id]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const current = result.rows[0];
    const now = DB.getCurrentTimestamp();
    const deviceId = DB.getDeviceId();

    const updates = [];
    const params = [];

    const allowedFields = ['status', 'waktu_datang', 'waktu_pulang', 'nama_jamaah', 'keterangan'];

    for (const field of allowedFields) {
        if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            params.push(data[field]);
        }
    }

    if (updates.length === 0) {
        return current;
    }

    updates.push('updated_at = ?', 'last_modified = ?', 'sync_version = ?', 'device_id = ?');
    params.push(now, now, current.sync_version + 1, deviceId);
    params.push(id);

    const sql = `UPDATE kehadiran_detail SET ${updates.join(', ')} WHERE id = ?`;
    await DB.execute(sql, params);
    await DB.save();

    // Update session counts if status changed
    if (data.status !== undefined) {
        await updateSessionCounts(current.kehadiran_id);
    }

    const updated = await DB.query('SELECT * FROM kehadiran_detail WHERE id = ?', [id]);
    return updated.rows[0];
}

/**
 * Get attendance records for a session
 * @param {string} sessionId - Session UUID
 * @returns {Promise<Array>} List of attendance records
 */
async function getAttendanceBySession(sessionId) {
    const result = await DB.query(
        'SELECT * FROM kehadiran_detail WHERE kehadiran_id = ? AND is_deleted = 0 ORDER BY nama_jamaah',
        [sessionId]
    );
    return result.rows;
}

/**
 * Get attendance history for a jamaah
 * @param {string} jamaahId - Jamaah UUID
 * @param {object} options - Query options
 * @returns {Promise<Array>} Attendance history
 */
async function getAttendanceByJamaah(jamaahId, options = {}) {
    let sql = `
        SELECT kd.*, k.tanggal, k.nama_kelas, k.materi_hari_ini
        FROM kehadiran_detail kd
        JOIN kehadiran k ON kd.kehadiran_id = k.id
        WHERE kd.jamaah_id = ? AND kd.is_deleted = 0 AND k.is_deleted = 0
    `;
    const params = [jamaahId];

    if (options.kelas_id) {
        sql += ' AND k.kelas_id = ?';
        params.push(options.kelas_id);
    }

    sql += ' ORDER BY k.tanggal DESC';

    if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
    }

    const result = await DB.query(sql, params);
    return result.rows;
}

/**
 * Update session attendance counts
 * @param {string} sessionId - Session UUID
 * @returns {Promise<void>}
 */
async function updateSessionCounts(sessionId) {
    const counts = await DB.query(`
        SELECT
            COUNT(CASE WHEN status = 'hadir' OR status = 'terlambat' THEN 1 END) as hadir,
            COUNT(CASE WHEN status = 'tidak_hadir' THEN 1 END) as tidak_hadir,
            COUNT(CASE WHEN status = 'izin' THEN 1 END) as izin,
            COUNT(CASE WHEN status = 'sakit' THEN 1 END) as sakit
        FROM kehadiran_detail
        WHERE kehadiran_id = ? AND is_deleted = 0
    `, [sessionId]);

    if (counts.rows.length > 0) {
        const c = counts.rows[0];
        await updateSession(sessionId, {
            jumlah_hadir: c.hadir || 0,
            jumlah_tidak_hadir: c.tidak_hadir || 0,
            jumlah_izin: c.izin || 0,
            jumlah_sakit: c.sakit || 0
        });
    }
}

// =============================================================================
// Statistics and Reports
// =============================================================================

/**
 * Get attendance statistics for a jamaah
 * @param {string} jamaahId - Jamaah UUID
 * @param {object} options - Filter options
 * @returns {Promise<object>} Statistics
 */
async function getJamaahStats(jamaahId, options = {}) {
    let sql = `
        SELECT
            COUNT(*) as total_sesi,
            COUNT(CASE WHEN kd.status = 'hadir' THEN 1 END) as hadir,
            COUNT(CASE WHEN kd.status = 'terlambat' THEN 1 END) as terlambat,
            COUNT(CASE WHEN kd.status = 'tidak_hadir' THEN 1 END) as tidak_hadir,
            COUNT(CASE WHEN kd.status = 'izin' THEN 1 END) as izin,
            COUNT(CASE WHEN kd.status = 'sakit' THEN 1 END) as sakit
        FROM kehadiran_detail kd
        JOIN kehadiran k ON kd.kehadiran_id = k.id
        WHERE kd.jamaah_id = ? AND kd.is_deleted = 0 AND k.is_deleted = 0
    `;
    const params = [jamaahId];

    if (options.kelas_id) {
        sql += ' AND k.kelas_id = ?';
        params.push(options.kelas_id);
    }

    if (options.tanggal_dari) {
        sql += ' AND k.tanggal >= ?';
        params.push(options.tanggal_dari);
    }

    if (options.tanggal_sampai) {
        sql += ' AND k.tanggal <= ?';
        params.push(options.tanggal_sampai);
    }

    const result = await DB.query(sql, params);
    const stats = result.rows[0] || {};

    // Calculate percentage
    const total = stats.total_sesi || 0;
    const kehadiranEfektif = (stats.hadir || 0) + (stats.terlambat || 0);
    stats.persentase_kehadiran = total > 0 ? Math.round((kehadiranEfektif / total) * 100) : 0;

    return stats;
}

/**
 * Get attendance statistics for a class
 * @param {string} kelasId - Kelas UUID
 * @param {object} options - Filter options
 * @returns {Promise<object>} Statistics
 */
async function getKelasStats(kelasId, options = {}) {
    let sql = `
        SELECT
            COUNT(DISTINCT k.id) as total_sesi,
            SUM(k.jumlah_hadir) as total_hadir,
            SUM(k.jumlah_tidak_hadir) as total_tidak_hadir,
            SUM(k.jumlah_izin) as total_izin,
            SUM(k.jumlah_sakit) as total_sakit,
            AVG(k.jumlah_hadir) as rata_rata_hadir
        FROM kehadiran k
        WHERE k.kelas_id = ? AND k.is_deleted = 0
    `;
    const params = [kelasId];

    if (options.tanggal_dari) {
        sql += ' AND k.tanggal >= ?';
        params.push(options.tanggal_dari);
    }

    if (options.tanggal_sampai) {
        sql += ' AND k.tanggal <= ?';
        params.push(options.tanggal_sampai);
    }

    const result = await DB.query(sql, params);
    return result.rows[0] || {};
}

// =============================================================================
// Sync Operations
// =============================================================================

/**
 * Get sessions modified since timestamp
 * @param {string} since - ISO timestamp
 * @returns {Promise<Array>} Modified sessions
 */
async function getSessionsModifiedSince(since) {
    const result = await DB.query(
        'SELECT * FROM kehadiran WHERE last_modified > ? ORDER BY last_modified ASC',
        [since]
    );
    return result.rows;
}

/**
 * Get attendance details modified since timestamp
 * @param {string} since - ISO timestamp
 * @returns {Promise<Array>} Modified records
 */
async function getDetailsModifiedSince(since) {
    const result = await DB.query(
        'SELECT * FROM kehadiran_detail WHERE last_modified > ? ORDER BY last_modified ASC',
        [since]
    );
    return result.rows;
}

// =============================================================================
// Export module
// =============================================================================

const KehadiranService = {
    // Session operations
    createSession,
    getSessionById,
    getAllSessions,
    updateSession,
    removeSession,

    // Individual attendance operations
    recordAttendance,
    bulkRecordAttendance,
    updateAttendance,
    getAttendanceBySession,
    getAttendanceByJamaah,
    updateSessionCounts,

    // Statistics
    getJamaahStats,
    getKelasStats,

    // Sync
    getSessionsModifiedSince,
    getDetailsModifiedSince
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KehadiranService;
}

if (typeof window !== 'undefined') {
    window.KehadiranService = KehadiranService;
}

export default KehadiranService;
export {
    createSession,
    getSessionById,
    getAllSessions,
    updateSession,
    removeSession,
    recordAttendance,
    bulkRecordAttendance,
    updateAttendance,
    getAttendanceBySession,
    getAttendanceByJamaah,
    updateSessionCounts,
    getJamaahStats,
    getKelasStats,
    getSessionsModifiedSince,
    getDetailsModifiedSince
};
