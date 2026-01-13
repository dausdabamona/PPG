/**
 * =============================================================================
 * Database Migration Module (migrate.js)
 * =============================================================================
 * Handles schema migrations for the PPG database
 *
 * This module:
 * - Loads and executes SQL schema files in order
 * - Tracks migration versions
 * - Supports incremental migrations
 * - Works offline without any server dependency
 * =============================================================================
 */

import DB from './db.js';

/**
 * Schema files in execution order
 * Order matters for foreign key dependencies
 */
const SCHEMA_FILES = [
    'jamaah',
    'kelas',
    'kehadiran',
    'penilaian',
    'kelas_mandiri',
    'catatan_pembinaan',
    'rekomendasi_pendidikan',
    'backup_sync'  // Backup & sync tables (backup_log, merge_log, wilayah)
];

/**
 * Migration tracking table schema
 */
const MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    version INTEGER NOT NULL,
    executed_at TEXT NOT NULL DEFAULT (datetime('now')),
    checksum TEXT
);
`;

/**
 * All schema definitions embedded for offline use
 * These are loaded at build time or defined inline
 */
const SCHEMAS = {};

/**
 * Initialize migration tracking table
 * @returns {Promise<void>}
 */
async function initMigrationTable() {
    await DB.executeMultiple(MIGRATION_TABLE_SQL);
    console.log('[Migrate] Migration tracking table initialized');
}

/**
 * Check if a migration has been executed
 * @param {string} name - Migration name
 * @returns {Promise<boolean>}
 */
async function isMigrationExecuted(name) {
    const result = await DB.query(
        'SELECT id FROM _migrations WHERE name = ?',
        [name]
    );
    return result.rows.length > 0;
}

/**
 * Record migration execution
 * @param {string} name - Migration name
 * @param {number} version - Schema version
 * @param {string} checksum - Optional checksum for validation
 * @returns {Promise<void>}
 */
async function recordMigration(name, version, checksum = null) {
    await DB.execute(
        'INSERT INTO _migrations (name, version, checksum) VALUES (?, ?, ?)',
        [name, version, checksum]
    );
}

/**
 * Load schema SQL from embedded definitions or fetch from file
 * @param {string} schemaName - Schema name (without .sql extension)
 * @returns {Promise<string>} SQL content
 */
async function loadSchema(schemaName) {
    // Check if schema is embedded
    if (SCHEMAS[schemaName]) {
        return SCHEMAS[schemaName];
    }

    // Try to fetch from file (works in development)
    try {
        const response = await fetch(`../schema/${schemaName}.sql`);
        if (response.ok) {
            const sql = await response.text();
            SCHEMAS[schemaName] = sql;  // Cache for future use
            return sql;
        }
    } catch (error) {
        console.warn(`[Migrate] Could not fetch ${schemaName}.sql:`, error.message);
    }

    // Return embedded schema (will be populated at build time)
    throw new Error(`Schema not found: ${schemaName}`);
}

/**
 * Execute a single schema migration
 * @param {string} schemaName - Schema name
 * @returns {Promise<boolean>} Success status
 */
async function executeMigration(schemaName) {
    // Check if already executed
    if (await isMigrationExecuted(schemaName)) {
        console.log(`[Migrate] Skipping ${schemaName} (already executed)`);
        return true;
    }

    console.log(`[Migrate] Executing migration: ${schemaName}`);

    try {
        const sql = await loadSchema(schemaName);
        await DB.executeMultiple(sql);
        await recordMigration(schemaName, 1);
        console.log(`[Migrate] Completed: ${schemaName}`);
        return true;
    } catch (error) {
        console.error(`[Migrate] Failed: ${schemaName}`, error);
        return false;
    }
}

/**
 * Run all migrations
 * @returns {Promise<object>} Migration results
 */
async function runAllMigrations() {
    console.log('[Migrate] Starting database migrations...');

    // Ensure database is initialized
    if (!DB.isInitialized()) {
        await DB.init();
    }

    // Initialize migration tracking
    await initMigrationTable();

    const results = {
        total: SCHEMA_FILES.length,
        executed: 0,
        skipped: 0,
        failed: 0,
        errors: []
    };

    // Execute each migration in order
    for (const schemaName of SCHEMA_FILES) {
        try {
            const wasExecuted = !(await isMigrationExecuted(schemaName));
            const success = await executeMigration(schemaName);

            if (success) {
                if (wasExecuted) {
                    results.executed++;
                } else {
                    results.skipped++;
                }
            } else {
                results.failed++;
                results.errors.push(schemaName);
            }
        } catch (error) {
            results.failed++;
            results.errors.push(`${schemaName}: ${error.message}`);
        }
    }

    // Save database after migrations
    await DB.save();

    console.log('[Migrate] Migration complete:', results);
    return results;
}

/**
 * Get migration status
 * @returns {Promise<Array>} List of executed migrations
 */
async function getMigrationStatus() {
    if (!DB.isInitialized()) {
        await DB.init();
    }

    try {
        const result = await DB.query(
            'SELECT name, version, executed_at FROM _migrations ORDER BY executed_at'
        );
        return result.rows;
    } catch (error) {
        // Table might not exist yet
        return [];
    }
}

/**
 * Reset all migrations (WARNING: destroys all data)
 * Only for development use
 * @returns {Promise<void>}
 */
async function resetMigrations() {
    console.warn('[Migrate] RESETTING ALL MIGRATIONS - ALL DATA WILL BE LOST');

    // Drop all tables (in reverse dependency order)
    const tables = [
        '_migrations',
        'merge_log',
        'backup_log',
        'wilayah',
        'konsultasi_pakar',
        'rekomendasi_progress',
        'rekomendasi_detail',
        'rekomendasi_pendidikan',
        'catatan_tindak_lanjut',
        'catatan_pembinaan',
        'progress_mandiri',
        'modul_mandiri',
        'kelas_mandiri',
        'penilaian_akhlak',
        'penilaian_materi',
        'penilaian',
        'kehadiran_detail',
        'kehadiran',
        'kelas_jamaah',
        'kelas',
        'jamaah'
    ];

    for (const table of tables) {
        try {
            await DB.execute(`DROP TABLE IF EXISTS ${table}`);
        } catch (error) {
            // Ignore errors
        }
    }

    await DB.save();
    console.log('[Migrate] All tables dropped');
}

/**
 * Embed schema SQL for offline use
 * Call this during build process to inline schemas
 * @param {object} schemas - Object with schema name keys and SQL values
 */
function embedSchemas(schemas) {
    Object.assign(SCHEMAS, schemas);
}

// =============================================================================
// Embedded Schemas (populated for offline use)
// =============================================================================

// These will be populated by the build process or can be set manually
// For now, we'll inline the essential parts for standalone operation

SCHEMAS.jamaah = `
CREATE TABLE IF NOT EXISTS jamaah (
    id TEXT PRIMARY KEY NOT NULL,
    nama_lengkap TEXT NOT NULL,
    nama_panggilan TEXT,
    tanggal_lahir TEXT,
    jenis_kelamin TEXT CHECK(jenis_kelamin IN ('L', 'P')),
    alamat TEXT,
    nomor_telepon TEXT,
    email TEXT,
    nama_orang_tua TEXT,
    telepon_orang_tua TEXT,
    tanggal_daftar TEXT NOT NULL,
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif', 'lulus', 'pindah')),
    foto TEXT,
    catatan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_jamaah_nama ON jamaah(nama_lengkap);
CREATE INDEX IF NOT EXISTS idx_jamaah_status ON jamaah(status);
CREATE INDEX IF NOT EXISTS idx_jamaah_last_modified ON jamaah(last_modified);
`;

SCHEMAS.kelas = `
CREATE TABLE IF NOT EXISTS kelas (
    id TEXT PRIMARY KEY NOT NULL,
    nama_kelas TEXT NOT NULL,
    deskripsi TEXT,
    tingkat TEXT,
    hari TEXT,
    waktu_mulai TEXT,
    waktu_selesai TEXT,
    lokasi TEXT,
    mubaligh_id TEXT,
    nama_mubaligh TEXT,
    materi_utama TEXT,
    kitab_rujukan TEXT,
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif', 'selesai')),
    tanggal_mulai TEXT,
    tanggal_selesai TEXT,
    kapasitas_maksimal INTEGER,
    catatan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS kelas_jamaah (
    id TEXT PRIMARY KEY NOT NULL,
    kelas_id TEXT NOT NULL,
    jamaah_id TEXT NOT NULL,
    tanggal_bergabung TEXT NOT NULL DEFAULT (date('now')),
    tanggal_keluar TEXT,
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif', 'lulus', 'keluar')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,
    UNIQUE(kelas_id, jamaah_id)
);
CREATE INDEX IF NOT EXISTS idx_kelas_nama ON kelas(nama_kelas);
CREATE INDEX IF NOT EXISTS idx_kelas_status ON kelas(status);
`;

SCHEMAS.kehadiran = `
CREATE TABLE IF NOT EXISTS kehadiran (
    id TEXT PRIMARY KEY NOT NULL,
    kelas_id TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    nama_kelas TEXT,
    materi_hari_ini TEXT,
    waktu_mulai TEXT,
    waktu_selesai TEXT,
    mubaligh_hadir TEXT,
    jumlah_hadir INTEGER DEFAULT 0,
    jumlah_tidak_hadir INTEGER DEFAULT 0,
    jumlah_izin INTEGER DEFAULT 0,
    jumlah_sakit INTEGER DEFAULT 0,
    catatan_sesi TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS kehadiran_detail (
    id TEXT PRIMARY KEY NOT NULL,
    kehadiran_id TEXT NOT NULL,
    jamaah_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'hadir' CHECK(status IN ('hadir', 'tidak_hadir', 'izin', 'sakit', 'terlambat')),
    waktu_datang TEXT,
    waktu_pulang TEXT,
    nama_jamaah TEXT,
    keterangan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,
    UNIQUE(kehadiran_id, jamaah_id)
);
CREATE INDEX IF NOT EXISTS idx_kehadiran_kelas ON kehadiran(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kehadiran_tanggal ON kehadiran(tanggal);
`;

SCHEMAS.penilaian = `
CREATE TABLE IF NOT EXISTS penilaian (
    id TEXT PRIMARY KEY NOT NULL,
    jamaah_id TEXT NOT NULL,
    kelas_id TEXT,
    tanggal_penilaian TEXT NOT NULL,
    periode TEXT,
    jenis_penilaian TEXT NOT NULL CHECK(jenis_penilaian IN ('materi', 'akhlak', 'hafalan', 'praktek', 'komprehensif')),
    nama_jamaah TEXT,
    nama_kelas TEXT,
    penilai_id TEXT,
    nama_penilai TEXT,
    peran_penilai TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS penilaian_materi (
    id TEXT PRIMARY KEY NOT NULL,
    penilaian_id TEXT NOT NULL,
    aspek TEXT NOT NULL,
    materi TEXT,
    nilai TEXT NOT NULL,
    nilai_numerik REAL,
    nilai_maksimal REAL DEFAULT 100,
    keterangan TEXT,
    kekuatan TEXT,
    kelemahan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS penilaian_akhlak (
    id TEXT PRIMARY KEY NOT NULL,
    penilaian_id TEXT NOT NULL,
    aspek TEXT NOT NULL,
    nilai TEXT NOT NULL,
    nilai_numerik REAL,
    deskripsi TEXT,
    contoh_perilaku TEXT,
    perkembangan TEXT CHECK(perkembangan IN ('meningkat', 'stabil', 'menurun', 'baru')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
`;

SCHEMAS.kelas_mandiri = `
CREATE TABLE IF NOT EXISTS kelas_mandiri (
    id TEXT PRIMARY KEY NOT NULL,
    nama_kelas TEXT NOT NULL,
    deskripsi TEXT,
    tujuan TEXT,
    target_peserta TEXT DEFAULT 'orang_tua',
    tingkat_kesulitan TEXT CHECK(tingkat_kesulitan IN ('pemula', 'menengah', 'lanjut')),
    estimasi_durasi TEXT,
    jumlah_modul INTEGER DEFAULT 0,
    materi_utama TEXT,
    sumber_rujukan TEXT,
    status TEXT DEFAULT 'aktif' CHECK(status IN ('draft', 'aktif', 'nonaktif', 'arsip')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS modul_mandiri (
    id TEXT PRIMARY KEY NOT NULL,
    kelas_mandiri_id TEXT NOT NULL,
    urutan INTEGER NOT NULL,
    judul TEXT NOT NULL,
    deskripsi TEXT,
    konten TEXT,
    materi_bacaan TEXT,
    video_path TEXT,
    aktivitas TEXT,
    pertanyaan_refleksi TEXT,
    estimasi_waktu TEXT,
    status TEXT DEFAULT 'aktif' CHECK(status IN ('draft', 'aktif', 'nonaktif')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS progress_mandiri (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    nama_user TEXT,
    kelas_mandiri_id TEXT NOT NULL,
    modul_mandiri_id TEXT NOT NULL,
    status TEXT DEFAULT 'belum_mulai' CHECK(status IN ('belum_mulai', 'sedang_dipelajari', 'selesai')),
    tanggal_mulai TEXT,
    tanggal_selesai TEXT,
    pemahaman TEXT CHECK(pemahaman IN ('sangat_paham', 'paham', 'cukup', 'perlu_ulang')),
    catatan_pribadi TEXT,
    jawaban_refleksi TEXT,
    waktu_belajar INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,
    UNIQUE(user_id, modul_mandiri_id)
);
`;

SCHEMAS.catatan_pembinaan = `
CREATE TABLE IF NOT EXISTS catatan_pembinaan (
    id TEXT PRIMARY KEY NOT NULL,
    jamaah_id TEXT NOT NULL,
    nama_jamaah TEXT,
    kelas_id TEXT,
    nama_kelas TEXT,
    tanggal TEXT NOT NULL,
    kategori TEXT NOT NULL CHECK(kategori IN ('akademik', 'akhlak', 'ibadah', 'sosial', 'kesehatan', 'keluarga', 'prestasi', 'perhatian_khusus', 'umum')),
    prioritas TEXT DEFAULT 'normal' CHECK(prioritas IN ('rendah', 'normal', 'tinggi', 'urgent')),
    judul TEXT,
    isi TEXT NOT NULL,
    observasi TEXT,
    konteks TEXT,
    penulis_id TEXT NOT NULL,
    nama_penulis TEXT,
    peran_penulis TEXT,
    perlu_tindak_lanjut INTEGER DEFAULT 0,
    tindak_lanjut TEXT,
    tanggal_tindak_lanjut TEXT,
    status_tindak_lanjut TEXT DEFAULT 'pending' CHECK(status_tindak_lanjut IN ('pending', 'in_progress', 'selesai', 'dibatalkan')),
    visible_to_parent INTEGER DEFAULT 0,
    lampiran TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS catatan_tindak_lanjut (
    id TEXT PRIMARY KEY NOT NULL,
    catatan_pembinaan_id TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    tindakan TEXT NOT NULL,
    hasil TEXT,
    pelaksana_id TEXT,
    nama_pelaksana TEXT,
    status TEXT DEFAULT 'selesai' CHECK(status IN ('selesai', 'perlu_lanjutan')),
    catatan_lanjutan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
`;

SCHEMAS.rekomendasi_pendidikan = `
CREATE TABLE IF NOT EXISTS rekomendasi_pendidikan (
    id TEXT PRIMARY KEY NOT NULL,
    jamaah_id TEXT NOT NULL,
    nama_jamaah TEXT,
    pakar_id TEXT NOT NULL,
    nama_pakar TEXT,
    keahlian_pakar TEXT,
    tanggal_rekomendasi TEXT NOT NULL,
    periode_berlaku TEXT,
    jenis_rekomendasi TEXT NOT NULL CHECK(jenis_rekomendasi IN ('jalur_pendidikan', 'intervensi', 'pengayaan', 'remedial', 'rujukan', 'pendampingan_khusus', 'metode_belajar', 'umum')),
    prioritas TEXT DEFAULT 'normal' CHECK(prioritas IN ('rendah', 'normal', 'tinggi', 'kritis')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS rekomendasi_detail (
    id TEXT PRIMARY KEY NOT NULL,
    rekomendasi_id TEXT NOT NULL,
    urutan INTEGER NOT NULL,
    judul TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    ditujukan_kepada TEXT NOT NULL CHECK(ditujukan_kepada IN ('orang_tua', 'mubaligh', 'jamaah', 'semua')),
    langkah_implementasi TEXT,
    sumber_daya TEXT,
    frekuensi TEXT,
    hasil_diharapkan TEXT,
    indikator_keberhasilan TEXT,
    tanggal_mulai TEXT,
    tanggal_target TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'selesai', 'dibatalkan', 'ditunda')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS rekomendasi_progress (
    id TEXT PRIMARY KEY NOT NULL,
    rekomendasi_detail_id TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    pelapor_id TEXT,
    nama_pelapor TEXT,
    peran_pelapor TEXT,
    deskripsi_progress TEXT NOT NULL,
    pencapaian TEXT,
    kendala TEXT,
    tingkat_kemajuan TEXT CHECK(tingkat_kemajuan IN ('sangat_baik', 'baik', 'cukup', 'kurang', 'belum_ada')),
    bukti_lampiran TEXT,
    langkah_selanjutnya TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS konsultasi_pakar (
    id TEXT PRIMARY KEY NOT NULL,
    jamaah_id TEXT,
    nama_jamaah TEXT,
    pakar_id TEXT NOT NULL,
    nama_pakar TEXT,
    konsultan_id TEXT,
    nama_konsultan TEXT,
    peran_konsultan TEXT,
    tanggal TEXT NOT NULL,
    durasi_menit INTEGER,
    metode TEXT CHECK(metode IN ('tatap_muka', 'telepon', 'chat', 'video')),
    topik TEXT NOT NULL,
    ringkasan TEXT,
    saran_pakar TEXT,
    perlu_konsultasi_lanjutan INTEGER DEFAULT 0,
    tanggal_lanjutan TEXT,
    rekomendasi_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
`;

SCHEMAS.backup_sync = `
CREATE TABLE IF NOT EXISTS backup_log (
    id TEXT PRIMARY KEY NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    checksum TEXT,
    operation TEXT NOT NULL CHECK(operation IN ('export', 'import')),
    level TEXT NOT NULL CHECK(level IN ('orang_tua', 'mubaligh', 'pc', 'dpd', 'dpw')),
    source_level TEXT,
    wilayah_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    imported_at TEXT,
    created_by TEXT,
    imported_by TEXT,
    records_exported INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_merged INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    conflicts_count INTEGER DEFAULT 0,
    app_version TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
    error_message TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS merge_log (
    id TEXT PRIMARY KEY NOT NULL,
    backup_log_id TEXT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('inserted', 'updated', 'skipped', 'conflict', 'deleted')),
    local_sync_version INTEGER,
    incoming_sync_version INTEGER,
    local_last_modified TEXT,
    incoming_last_modified TEXT,
    source_level TEXT NOT NULL,
    source_device_id TEXT,
    conflict_type TEXT,
    conflict_details TEXT,
    resolution TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE TABLE IF NOT EXISTS wilayah (
    id TEXT PRIMARY KEY NOT NULL,
    level TEXT NOT NULL CHECK(level IN ('orang_tua', 'mubaligh', 'pc', 'dpd', 'dpw', 'pusat')),
    parent_id TEXT,
    kode TEXT UNIQUE,
    nama TEXT NOT NULL,
    alamat TEXT,
    kota TEXT,
    provinsi TEXT,
    telepon TEXT,
    email TEXT,
    ketua_id TEXT,
    nama_ketua TEXT,
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_backup_log_operation ON backup_log(operation);
CREATE INDEX IF NOT EXISTS idx_backup_log_level ON backup_log(level);
CREATE INDEX IF NOT EXISTS idx_backup_log_created_at ON backup_log(created_at);
CREATE INDEX IF NOT EXISTS idx_merge_log_backup ON merge_log(backup_log_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_table ON merge_log(table_name);
CREATE INDEX IF NOT EXISTS idx_merge_log_action ON merge_log(action);
CREATE INDEX IF NOT EXISTS idx_wilayah_level ON wilayah(level);
CREATE INDEX IF NOT EXISTS idx_wilayah_parent ON wilayah(parent_id);
`;

// =============================================================================
// Export module
// =============================================================================

const Migrate = {
    run: runAllMigrations,
    status: getMigrationStatus,
    reset: resetMigrations,
    embedSchemas,
    SCHEMA_FILES
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Migrate;
}

if (typeof window !== 'undefined') {
    window.Migrate = Migrate;
}

export default Migrate;
export {
    runAllMigrations,
    getMigrationStatus,
    resetMigrations,
    embedSchemas
};
