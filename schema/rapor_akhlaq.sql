-- =============================================================================
-- RAPOR_AKHLAQ (Character/Behavior Report) Table
-- =============================================================================
-- Comprehensive character assessment covering multiple dimensions
-- Each dimension scored 1-4 scale with predicate
-- =============================================================================

CREATE TABLE IF NOT EXISTS rapor_akhlaq (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,

    -- Reference to main rapor
    rapor_id TEXT NOT NULL,  -- References rapor_periode

    -- ==========================================================================
    -- Character Dimensions (scored 1-4)
    -- 4: Sangat Baik, 3: Baik, 2: Cukup, 1: Perlu Bimbingan
    -- ==========================================================================

    -- Kedisiplinan (Discipline)
    kedisiplinan_nilai INTEGER CHECK(kedisiplinan_nilai BETWEEN 1 AND 4),
    kedisiplinan_predikat TEXT,
    kedisiplinan_deskripsi TEXT,

    -- Adab (Manners/Etiquette)
    adab_nilai INTEGER CHECK(adab_nilai BETWEEN 1 AND 4),
    adab_predikat TEXT,
    adab_deskripsi TEXT,

    -- Kemandirian (Independence)
    kemandirian_nilai INTEGER CHECK(kemandirian_nilai BETWEEN 1 AND 4),
    kemandirian_predikat TEXT,
    kemandirian_deskripsi TEXT,

    -- Kebersihan (Cleanliness)
    kebersihan_nilai INTEGER CHECK(kebersihan_nilai BETWEEN 1 AND 4),
    kebersihan_predikat TEXT,
    kebersihan_deskripsi TEXT,

    -- Tanggung Jawab (Responsibility)
    tanggung_jawab_nilai INTEGER CHECK(tanggung_jawab_nilai BETWEEN 1 AND 4),
    tanggung_jawab_predikat TEXT,
    tanggung_jawab_deskripsi TEXT,

    -- Kejujuran (Honesty)
    kejujuran_nilai INTEGER CHECK(kejujuran_nilai BETWEEN 1 AND 4),
    kejujuran_predikat TEXT,
    kejujuran_deskripsi TEXT,

    -- Kepedulian (Care/Empathy)
    kepedulian_nilai INTEGER CHECK(kepedulian_nilai BETWEEN 1 AND 4),
    kepedulian_predikat TEXT,
    kepedulian_deskripsi TEXT,

    -- Kerjasama (Cooperation)
    kerjasama_nilai INTEGER CHECK(kerjasama_nilai BETWEEN 1 AND 4),
    kerjasama_predikat TEXT,
    kerjasama_deskripsi TEXT,

    -- ==========================================================================
    -- Overall Character Summary
    -- ==========================================================================
    nilai_rata_rata REAL,  -- Average of all dimensions
    predikat_keseluruhan TEXT CHECK(predikat_keseluruhan IN (
        'Sangat Baik',   -- avg >= 3.5
        'Baik',          -- avg >= 2.5
        'Cukup',         -- avg >= 1.5
        'Perlu Bimbingan' -- avg < 1.5
    )),

    -- Narrative descriptions
    deskripsi_keseluruhan TEXT,  -- Overall character description
    kekuatan_karakter TEXT,      -- Character strengths
    area_pengembangan TEXT,      -- Areas for development

    -- Comparison with previous period
    perkembangan TEXT CHECK(perkembangan IN (
        'meningkat',     -- Improved
        'stabil',        -- Stable
        'menurun',       -- Declined
        'baru'           -- First assessment
    )),
    perkembangan_catatan TEXT,

    -- Expert notes
    catatan_pakar TEXT,
    tanggal_evaluasi_pakar TEXT,
    nama_pakar TEXT,

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,

    -- One akhlaq record per rapor
    UNIQUE(rapor_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_rapor_akhlaq_rapor ON rapor_akhlaq(rapor_id);
CREATE INDEX IF NOT EXISTS idx_rapor_akhlaq_predikat ON rapor_akhlaq(predikat_keseluruhan);
CREATE INDEX IF NOT EXISTS idx_rapor_akhlaq_perkembangan ON rapor_akhlaq(perkembangan);
CREATE INDEX IF NOT EXISTS idx_rapor_akhlaq_last_modified ON rapor_akhlaq(last_modified);

-- =============================================================================
-- Trigger for auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_rapor_akhlaq_updated_at
AFTER UPDATE ON rapor_akhlaq
FOR EACH ROW
BEGIN
    UPDATE rapor_akhlaq
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
