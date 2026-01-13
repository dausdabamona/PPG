-- =============================================================================
-- RAPOR_MATERI (Subject/Material Report) Table
-- =============================================================================
-- Detailed assessment for each subject/material covered during the period
-- Tracks: status (lulus/proses/tertinggal), nilai, predikat, deskripsi
-- =============================================================================

CREATE TABLE IF NOT EXISTS rapor_materi (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,

    -- Reference to main rapor
    rapor_id TEXT NOT NULL,  -- References rapor_periode

    -- Material/Subject reference
    materi_id TEXT,  -- References materi or kelas
    kode_materi TEXT,
    nama_materi TEXT NOT NULL,
    kategori_materi TEXT,  -- e.g., 'Fiqih', 'Akidah', 'Tahsin', 'Hafalan'

    -- ==========================================================================
    -- Assessment Data
    -- ==========================================================================
    -- Numeric scores
    nilai_tugas REAL,  -- Assignment score
    nilai_ujian REAL,  -- Exam score
    nilai_praktik REAL,  -- Practice score
    nilai_hafalan REAL,  -- Memorization score
    nilai_akhir REAL,  -- Final calculated score (0-100)

    -- Status determination
    status TEXT NOT NULL DEFAULT 'proses' CHECK(status IN (
        'lulus',       -- Passed/mastered
        'proses',      -- In progress
        'tertinggal'   -- Behind/needs catch-up
    )),

    -- Predicate based on nilai_akhir
    predikat TEXT CHECK(predikat IN (
        'A',   -- 90-100: Istimewa
        'B',   -- 80-89: Sangat Baik
        'C',   -- 70-79: Baik
        'D',   -- 60-69: Cukup
        'E'    -- < 60: Perlu Bimbingan
    )),

    -- Narrative description
    deskripsi TEXT,  -- Detailed description of student's performance
    kekuatan TEXT,   -- Strengths in this subject
    kelemahan TEXT,  -- Areas needing improvement

    -- Recommendation for this subject
    rekomendasi TEXT,

    -- Progress tracking
    target_kompetensi TEXT,  -- Expected competency
    capaian_kompetensi TEXT,  -- Achieved competency
    persentase_capaian REAL,  -- Achievement percentage

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,

    -- Unique: one entry per rapor per subject
    UNIQUE(rapor_id, materi_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_rapor_materi_rapor ON rapor_materi(rapor_id);
CREATE INDEX IF NOT EXISTS idx_rapor_materi_materi ON rapor_materi(materi_id);
CREATE INDEX IF NOT EXISTS idx_rapor_materi_status ON rapor_materi(status);
CREATE INDEX IF NOT EXISTS idx_rapor_materi_predikat ON rapor_materi(predikat);
CREATE INDEX IF NOT EXISTS idx_rapor_materi_last_modified ON rapor_materi(last_modified);

-- =============================================================================
-- Trigger for auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_rapor_materi_updated_at
AFTER UPDATE ON rapor_materi
FOR EACH ROW
BEGIN
    UPDATE rapor_materi
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
