-- =============================================================================
-- KEHADIRAN (Attendance) Table
-- Tracks attendance records for pengajian sessions
-- =============================================================================
-- Offline-first design: UUID primary key, sync fields for conflict resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS kehadiran (
    -- Primary identifier (UUID for offline-first conflict-free generation)
    id TEXT PRIMARY KEY NOT NULL,

    -- Session Reference
    kelas_id TEXT NOT NULL,  -- References kelas table
    tanggal TEXT NOT NULL,  -- ISO 8601 format: YYYY-MM-DD

    -- Session Details (denormalized for offline access)
    nama_kelas TEXT,
    materi_hari_ini TEXT,  -- Topic covered in this session

    -- Session Time
    waktu_mulai TEXT,  -- Actual start time HH:MM
    waktu_selesai TEXT,  -- Actual end time HH:MM

    -- Session Metadata
    mubaligh_hadir TEXT,  -- Name of mubaligh who conducted the session
    jumlah_hadir INTEGER DEFAULT 0,
    jumlah_tidak_hadir INTEGER DEFAULT 0,
    jumlah_izin INTEGER DEFAULT 0,
    jumlah_sakit INTEGER DEFAULT 0,

    -- Session Notes
    catatan_sesi TEXT,

    -- ==========================================================================
    -- Sync & Audit Fields (Required for offline-first architecture)
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);

-- =============================================================================
-- KEHADIRAN_DETAIL (Individual Attendance Records)
-- Per-student attendance for each session
-- =============================================================================

CREATE TABLE IF NOT EXISTS kehadiran_detail (
    id TEXT PRIMARY KEY NOT NULL,
    kehadiran_id TEXT NOT NULL,  -- References kehadiran (session) table
    jamaah_id TEXT NOT NULL,  -- References jamaah table

    -- Attendance Status
    status TEXT NOT NULL DEFAULT 'hadir' CHECK(status IN ('hadir', 'tidak_hadir', 'izin', 'sakit', 'terlambat')),

    -- Time Details (for tracking punctuality)
    waktu_datang TEXT,  -- HH:MM format
    waktu_pulang TEXT,  -- HH:MM format

    -- Additional Info (denormalized for offline reports)
    nama_jamaah TEXT,

    -- Notes
    keterangan TEXT,  -- Reason for absence, late arrival notes, etc.

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,

    -- Ensure one record per student per session
    UNIQUE(kehadiran_id, jamaah_id)
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_kehadiran_kelas ON kehadiran(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kehadiran_tanggal ON kehadiran(tanggal);
CREATE INDEX IF NOT EXISTS idx_kehadiran_last_modified ON kehadiran(last_modified);

CREATE INDEX IF NOT EXISTS idx_kehadiran_detail_kehadiran ON kehadiran_detail(kehadiran_id);
CREATE INDEX IF NOT EXISTS idx_kehadiran_detail_jamaah ON kehadiran_detail(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_kehadiran_detail_status ON kehadiran_detail(status);
CREATE INDEX IF NOT EXISTS idx_kehadiran_detail_last_modified ON kehadiran_detail(last_modified);

-- =============================================================================
-- Triggers to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_kehadiran_updated_at
AFTER UPDATE ON kehadiran
FOR EACH ROW
BEGIN
    UPDATE kehadiran
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_kehadiran_detail_updated_at
AFTER UPDATE ON kehadiran_detail
FOR EACH ROW
BEGIN
    UPDATE kehadiran_detail
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
