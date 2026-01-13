-- =============================================================================
-- KELAS_MANDIRI (Parent Self-Learning Class) Table
-- Tracks parent/guardian self-study activities and progress
-- =============================================================================
-- This module enables parents to learn independently with structured materials
-- and track their own progress in supporting their children's education
-- =============================================================================
-- Offline-first design: UUID primary key, sync fields for conflict resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS kelas_mandiri (
    -- Primary identifier (UUID for offline-first conflict-free generation)
    id TEXT PRIMARY KEY NOT NULL,

    -- Class Information
    nama_kelas TEXT NOT NULL,
    deskripsi TEXT,
    tujuan TEXT,  -- Learning objectives

    -- Target Audience
    target_peserta TEXT DEFAULT 'orang_tua',  -- 'orang_tua', 'mubaligh', 'umum'
    tingkat_kesulitan TEXT CHECK(tingkat_kesulitan IN ('pemula', 'menengah', 'lanjut')),

    -- Duration & Structure
    estimasi_durasi TEXT,  -- e.g., '4 minggu', '2 bulan'
    jumlah_modul INTEGER DEFAULT 0,

    -- Materials
    materi_utama TEXT,
    sumber_rujukan TEXT,  -- References, books, links (stored locally)

    -- Status
    status TEXT DEFAULT 'aktif' CHECK(status IN ('draft', 'aktif', 'nonaktif', 'arsip')),

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
-- MODUL_MANDIRI (Self-Learning Module)
-- Individual learning modules within a self-learning class
-- =============================================================================

CREATE TABLE IF NOT EXISTS modul_mandiri (
    id TEXT PRIMARY KEY NOT NULL,
    kelas_mandiri_id TEXT NOT NULL,  -- References kelas_mandiri

    -- Module Information
    urutan INTEGER NOT NULL,  -- Order within the class
    judul TEXT NOT NULL,
    deskripsi TEXT,

    -- Content (stored as text/markdown for offline access)
    konten TEXT,
    materi_bacaan TEXT,
    video_path TEXT,  -- Local path to video file

    -- Learning Activities
    aktivitas TEXT,  -- Instructions for practice activities
    pertanyaan_refleksi TEXT,  -- Reflection questions

    -- Duration
    estimasi_waktu TEXT,  -- e.g., '30 menit', '1 jam'

    -- Status
    status TEXT DEFAULT 'aktif' CHECK(status IN ('draft', 'aktif', 'nonaktif')),

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
-- PROGRESS_MANDIRI (Self-Learning Progress Tracker)
-- Tracks individual user progress through self-learning materials
-- =============================================================================

CREATE TABLE IF NOT EXISTS progress_mandiri (
    id TEXT PRIMARY KEY NOT NULL,

    -- User Reference (parent/guardian)
    user_id TEXT NOT NULL,  -- Can reference jamaah or separate user table
    nama_user TEXT,  -- Denormalized for offline

    -- Module Reference
    kelas_mandiri_id TEXT NOT NULL,
    modul_mandiri_id TEXT NOT NULL,

    -- Progress Tracking
    status TEXT DEFAULT 'belum_mulai' CHECK(status IN ('belum_mulai', 'sedang_dipelajari', 'selesai')),
    tanggal_mulai TEXT,
    tanggal_selesai TEXT,

    -- Self-Assessment
    pemahaman TEXT CHECK(pemahaman IN ('sangat_paham', 'paham', 'cukup', 'perlu_ulang')),

    -- Notes & Reflections
    catatan_pribadi TEXT,
    jawaban_refleksi TEXT,  -- User's answers to reflection questions

    -- Time Spent (in minutes)
    waktu_belajar INTEGER DEFAULT 0,

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,

    -- Unique progress per user per module
    UNIQUE(user_id, modul_mandiri_id)
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_kelas_mandiri_status ON kelas_mandiri(status);
CREATE INDEX IF NOT EXISTS idx_kelas_mandiri_last_modified ON kelas_mandiri(last_modified);

CREATE INDEX IF NOT EXISTS idx_modul_mandiri_kelas ON modul_mandiri(kelas_mandiri_id);
CREATE INDEX IF NOT EXISTS idx_modul_mandiri_urutan ON modul_mandiri(urutan);
CREATE INDEX IF NOT EXISTS idx_modul_mandiri_last_modified ON modul_mandiri(last_modified);

CREATE INDEX IF NOT EXISTS idx_progress_mandiri_user ON progress_mandiri(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_mandiri_kelas ON progress_mandiri(kelas_mandiri_id);
CREATE INDEX IF NOT EXISTS idx_progress_mandiri_modul ON progress_mandiri(modul_mandiri_id);
CREATE INDEX IF NOT EXISTS idx_progress_mandiri_status ON progress_mandiri(status);
CREATE INDEX IF NOT EXISTS idx_progress_mandiri_last_modified ON progress_mandiri(last_modified);

-- =============================================================================
-- Triggers to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_kelas_mandiri_updated_at
AFTER UPDATE ON kelas_mandiri
FOR EACH ROW
BEGIN
    UPDATE kelas_mandiri
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_modul_mandiri_updated_at
AFTER UPDATE ON modul_mandiri
FOR EACH ROW
BEGIN
    UPDATE modul_mandiri
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_progress_mandiri_updated_at
AFTER UPDATE ON progress_mandiri
FOR EACH ROW
BEGIN
    UPDATE progress_mandiri
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
