-- =============================================================================
-- KELAS (Class) Table
-- Stores pengajian class/group information
-- =============================================================================
-- Offline-first design: UUID primary key, sync fields for conflict resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS kelas (
    -- Primary identifier (UUID for offline-first conflict-free generation)
    id TEXT PRIMARY KEY NOT NULL,

    -- Class Information
    nama_kelas TEXT NOT NULL,
    deskripsi TEXT,
    tingkat TEXT,  -- e.g., 'Dasar', 'Menengah', 'Lanjut'

    -- Schedule Information
    hari TEXT,  -- e.g., 'Senin', 'Selasa', etc. or comma-separated
    waktu_mulai TEXT,  -- HH:MM format
    waktu_selesai TEXT,  -- HH:MM format
    lokasi TEXT,

    -- Instructor/Mubaligh Information
    mubaligh_id TEXT,  -- References jamaah or separate mubaligh table
    nama_mubaligh TEXT,  -- Denormalized for offline access

    -- Curriculum/Material
    materi_utama TEXT,  -- Main subject/material being taught
    kitab_rujukan TEXT,  -- Reference books used

    -- Class Status
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif', 'selesai')),
    tanggal_mulai TEXT,  -- ISO 8601 format
    tanggal_selesai TEXT,  -- ISO 8601 format (if applicable)

    -- Capacity
    kapasitas_maksimal INTEGER,

    -- Additional Notes
    catatan TEXT,

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
-- KELAS_JAMAAH (Class-Student Junction Table)
-- Many-to-many relationship between classes and students
-- =============================================================================

CREATE TABLE IF NOT EXISTS kelas_jamaah (
    id TEXT PRIMARY KEY NOT NULL,
    kelas_id TEXT NOT NULL,
    jamaah_id TEXT NOT NULL,

    -- Enrollment details
    tanggal_bergabung TEXT NOT NULL DEFAULT (date('now')),
    tanggal_keluar TEXT,
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif', 'lulus', 'keluar')),

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,

    -- Foreign key constraints (enforced at application level for flexibility)
    UNIQUE(kelas_id, jamaah_id)
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_kelas_nama ON kelas(nama_kelas);
CREATE INDEX IF NOT EXISTS idx_kelas_status ON kelas(status);
CREATE INDEX IF NOT EXISTS idx_kelas_mubaligh ON kelas(mubaligh_id);
CREATE INDEX IF NOT EXISTS idx_kelas_last_modified ON kelas(last_modified);

CREATE INDEX IF NOT EXISTS idx_kelas_jamaah_kelas ON kelas_jamaah(kelas_id);
CREATE INDEX IF NOT EXISTS idx_kelas_jamaah_jamaah ON kelas_jamaah(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_kelas_jamaah_last_modified ON kelas_jamaah(last_modified);

-- =============================================================================
-- Triggers to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_kelas_updated_at
AFTER UPDATE ON kelas
FOR EACH ROW
BEGIN
    UPDATE kelas
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_kelas_jamaah_updated_at
AFTER UPDATE ON kelas_jamaah
FOR EACH ROW
BEGIN
    UPDATE kelas_jamaah
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
