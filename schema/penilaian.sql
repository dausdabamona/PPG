-- =============================================================================
-- PENILAIAN (Assessment) Table
-- Tracks assessments for materi (material/knowledge) and akhlak (character/behavior)
-- =============================================================================
-- Offline-first design: UUID primary key, sync fields for conflict resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS penilaian (
    -- Primary identifier (UUID for offline-first conflict-free generation)
    id TEXT PRIMARY KEY NOT NULL,

    -- Assessment Reference
    jamaah_id TEXT NOT NULL,  -- References jamaah table
    kelas_id TEXT,  -- References kelas table (optional, can be general assessment)

    -- Assessment Details
    tanggal_penilaian TEXT NOT NULL,  -- ISO 8601 format
    periode TEXT,  -- e.g., '2024-Q1', 'Ramadhan 1445', 'Semester 1'

    -- Assessment Type
    jenis_penilaian TEXT NOT NULL CHECK(jenis_penilaian IN ('materi', 'akhlak', 'hafalan', 'praktek', 'komprehensif')),

    -- Denormalized Fields (for offline reports)
    nama_jamaah TEXT,
    nama_kelas TEXT,

    -- Assessor Information
    penilai_id TEXT,  -- Who conducted the assessment
    nama_penilai TEXT,
    peran_penilai TEXT,  -- 'Mubaligh', 'Pakar', 'Orang Tua'

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
-- PENILAIAN_MATERI (Material/Knowledge Assessment Details)
-- Specific scores for material comprehension
-- =============================================================================

CREATE TABLE IF NOT EXISTS penilaian_materi (
    id TEXT PRIMARY KEY NOT NULL,
    penilaian_id TEXT NOT NULL,  -- References penilaian table

    -- Material Assessment
    aspek TEXT NOT NULL,  -- e.g., 'Pemahaman Fiqih', 'Hafalan Al-Quran', 'Tajwid'
    materi TEXT,  -- Specific material being assessed

    -- Scoring (flexible scale: 1-100, 1-10, or letter grades stored as text)
    nilai TEXT NOT NULL,
    nilai_numerik REAL,  -- Numeric equivalent for calculations
    nilai_maksimal REAL DEFAULT 100,

    -- Qualitative Assessment
    keterangan TEXT,
    kekuatan TEXT,  -- Strengths observed
    kelemahan TEXT,  -- Areas for improvement

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
-- PENILAIAN_AKHLAK (Character/Behavior Assessment Details)
-- Assessment for moral and behavioral development
-- =============================================================================

CREATE TABLE IF NOT EXISTS penilaian_akhlak (
    id TEXT PRIMARY KEY NOT NULL,
    penilaian_id TEXT NOT NULL,  -- References penilaian table

    -- Akhlak Assessment Categories
    aspek TEXT NOT NULL,  -- e.g., 'Kedisiplinan', 'Adab', 'Kejujuran', 'Kepedulian'

    -- Scoring (typically qualitative: 'Sangat Baik', 'Baik', 'Cukup', 'Perlu Bimbingan')
    nilai TEXT NOT NULL,
    nilai_numerik REAL,  -- Optional numeric equivalent

    -- Qualitative Observations
    deskripsi TEXT,  -- Detailed description of behavior observed
    contoh_perilaku TEXT,  -- Specific examples observed

    -- Progress Tracking
    perkembangan TEXT CHECK(perkembangan IN ('meningkat', 'stabil', 'menurun', 'baru')),

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
CREATE INDEX IF NOT EXISTS idx_penilaian_jamaah ON penilaian(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_kelas ON penilaian(kelas_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_tanggal ON penilaian(tanggal_penilaian);
CREATE INDEX IF NOT EXISTS idx_penilaian_jenis ON penilaian(jenis_penilaian);
CREATE INDEX IF NOT EXISTS idx_penilaian_last_modified ON penilaian(last_modified);

CREATE INDEX IF NOT EXISTS idx_penilaian_materi_penilaian ON penilaian_materi(penilaian_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_materi_last_modified ON penilaian_materi(last_modified);

CREATE INDEX IF NOT EXISTS idx_penilaian_akhlak_penilaian ON penilaian_akhlak(penilaian_id);
CREATE INDEX IF NOT EXISTS idx_penilaian_akhlak_last_modified ON penilaian_akhlak(last_modified);

-- =============================================================================
-- Triggers to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_penilaian_updated_at
AFTER UPDATE ON penilaian
FOR EACH ROW
BEGIN
    UPDATE penilaian
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_penilaian_materi_updated_at
AFTER UPDATE ON penilaian_materi
FOR EACH ROW
BEGIN
    UPDATE penilaian_materi
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_penilaian_akhlak_updated_at
AFTER UPDATE ON penilaian_akhlak
FOR EACH ROW
BEGIN
    UPDATE penilaian_akhlak
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
