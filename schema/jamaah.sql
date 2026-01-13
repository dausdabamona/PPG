-- =============================================================================
-- JAMAAH (Student) Table
-- Stores student/participant information for pengajian (Islamic study sessions)
-- =============================================================================
-- Offline-first design: UUID primary key, sync fields for conflict resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS jamaah (
    -- Primary identifier (UUID for offline-first conflict-free generation)
    id TEXT PRIMARY KEY NOT NULL,

    -- Personal Information
    nama_lengkap TEXT NOT NULL,
    nama_panggilan TEXT,
    tanggal_lahir TEXT,  -- ISO 8601 format: YYYY-MM-DD
    jenis_kelamin TEXT CHECK(jenis_kelamin IN ('L', 'P')),  -- L=Laki-laki, P=Perempuan
    alamat TEXT,

    -- Contact Information
    nomor_telepon TEXT,
    email TEXT,

    -- Parent/Guardian Information (for children)
    nama_orang_tua TEXT,
    telepon_orang_tua TEXT,

    -- Enrollment Information
    tanggal_daftar TEXT NOT NULL,  -- ISO 8601 format
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif', 'lulus', 'pindah')),

    -- Photo (stored as base64 or file path for offline access)
    foto TEXT,

    -- Additional Notes
    catatan TEXT,

    -- ==========================================================================
    -- Sync & Audit Fields (Required for offline-first architecture)
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),  -- For sync conflict resolution
    sync_version INTEGER NOT NULL DEFAULT 1,  -- Incremented on each local change
    is_deleted INTEGER NOT NULL DEFAULT 0,  -- Soft delete for sync (0=active, 1=deleted)
    device_id TEXT  -- Identifies which device made the last change
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_jamaah_nama ON jamaah(nama_lengkap);
CREATE INDEX IF NOT EXISTS idx_jamaah_status ON jamaah(status);
CREATE INDEX IF NOT EXISTS idx_jamaah_last_modified ON jamaah(last_modified);
CREATE INDEX IF NOT EXISTS idx_jamaah_sync_version ON jamaah(sync_version);

-- =============================================================================
-- Trigger to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_jamaah_updated_at
AFTER UPDATE ON jamaah
FOR EACH ROW
BEGIN
    UPDATE jamaah
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
