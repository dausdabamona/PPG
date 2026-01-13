-- =============================================================================
-- CATATAN_PEMBINAAN (Coaching/Guidance Notes) Table
-- Records notes and observations from mentors, teachers, and experts
-- =============================================================================
-- Used by Mubaligh and Pakar to document student progress, concerns, and guidance
-- =============================================================================
-- Offline-first design: UUID primary key, sync fields for conflict resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS catatan_pembinaan (
    -- Primary identifier (UUID for offline-first conflict-free generation)
    id TEXT PRIMARY KEY NOT NULL,

    -- Subject Reference
    jamaah_id TEXT NOT NULL,  -- References jamaah table (student being noted)
    nama_jamaah TEXT,  -- Denormalized for offline access

    -- Context Reference (optional)
    kelas_id TEXT,
    nama_kelas TEXT,

    -- Note Details
    tanggal TEXT NOT NULL,  -- ISO 8601 format

    -- Note Type/Category
    kategori TEXT NOT NULL CHECK(kategori IN (
        'akademik',       -- Academic/learning progress
        'akhlak',         -- Character/behavior
        'ibadah',         -- Worship practices
        'sosial',         -- Social interactions
        'kesehatan',      -- Health concerns
        'keluarga',       -- Family-related
        'prestasi',       -- Achievements
        'perhatian_khusus', -- Concerns requiring attention
        'umum'            -- General notes
    )),

    -- Priority/Urgency
    prioritas TEXT DEFAULT 'normal' CHECK(prioritas IN ('rendah', 'normal', 'tinggi', 'urgent')),

    -- Note Content
    judul TEXT,
    isi TEXT NOT NULL,  -- Main content of the note

    -- Observations
    observasi TEXT,  -- What was observed
    konteks TEXT,  -- Context/situation when observed

    -- Author Information
    penulis_id TEXT NOT NULL,
    nama_penulis TEXT,
    peran_penulis TEXT,  -- 'Mubaligh', 'Pakar', 'Admin'

    -- Follow-up
    perlu_tindak_lanjut INTEGER DEFAULT 0,  -- Boolean: 1 = needs follow-up
    tindak_lanjut TEXT,  -- What follow-up is needed
    tanggal_tindak_lanjut TEXT,  -- When to follow up
    status_tindak_lanjut TEXT DEFAULT 'pending' CHECK(status_tindak_lanjut IN ('pending', 'in_progress', 'selesai', 'dibatalkan')),

    -- Visibility/Sharing
    visible_to_parent INTEGER DEFAULT 0,  -- Can parent see this note?

    -- Attachments (stored as JSON array of local file paths)
    lampiran TEXT,  -- JSON: ["path/to/file1.jpg", "path/to/file2.pdf"]

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
-- CATATAN_TINDAK_LANJUT (Follow-up Records)
-- Tracks follow-up actions taken on guidance notes
-- =============================================================================

CREATE TABLE IF NOT EXISTS catatan_tindak_lanjut (
    id TEXT PRIMARY KEY NOT NULL,
    catatan_pembinaan_id TEXT NOT NULL,  -- References parent note

    -- Follow-up Details
    tanggal TEXT NOT NULL,

    -- Action Taken
    tindakan TEXT NOT NULL,  -- What action was taken
    hasil TEXT,  -- Result/outcome of the action

    -- Author
    pelaksana_id TEXT,
    nama_pelaksana TEXT,

    -- Status
    status TEXT DEFAULT 'selesai' CHECK(status IN ('selesai', 'perlu_lanjutan')),
    catatan_lanjutan TEXT,  -- Notes for further follow-up if needed

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_jamaah ON catatan_pembinaan(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_kelas ON catatan_pembinaan(kelas_id);
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_tanggal ON catatan_pembinaan(tanggal);
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_kategori ON catatan_pembinaan(kategori);
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_prioritas ON catatan_pembinaan(prioritas);
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_penulis ON catatan_pembinaan(penulis_id);
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_tindak_lanjut ON catatan_pembinaan(perlu_tindak_lanjut);
CREATE INDEX IF NOT EXISTS idx_catatan_pembinaan_last_modified ON catatan_pembinaan(last_modified);

CREATE INDEX IF NOT EXISTS idx_catatan_tindak_lanjut_catatan ON catatan_tindak_lanjut(catatan_pembinaan_id);
CREATE INDEX IF NOT EXISTS idx_catatan_tindak_lanjut_tanggal ON catatan_tindak_lanjut(tanggal);
CREATE INDEX IF NOT EXISTS idx_catatan_tindak_lanjut_last_modified ON catatan_tindak_lanjut(last_modified);

-- =============================================================================
-- Triggers to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_catatan_pembinaan_updated_at
AFTER UPDATE ON catatan_pembinaan
FOR EACH ROW
BEGIN
    UPDATE catatan_pembinaan
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_catatan_tindak_lanjut_updated_at
AFTER UPDATE ON catatan_tindak_lanjut
FOR EACH ROW
BEGIN
    UPDATE catatan_tindak_lanjut
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
