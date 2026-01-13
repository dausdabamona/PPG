-- =============================================================================
-- REKOMENDASI_PENDIDIKAN (Educational Recommendations) Table
-- Expert recommendations for student educational paths and interventions
-- =============================================================================
-- Used by Pakar (experts) to provide personalized educational recommendations
-- for students based on assessments, observations, and consultations
-- =============================================================================
-- Offline-first design: UUID primary key, sync fields for conflict resolution
-- =============================================================================

CREATE TABLE IF NOT EXISTS rekomendasi_pendidikan (
    -- Primary identifier (UUID for offline-first conflict-free generation)
    id TEXT PRIMARY KEY NOT NULL,

    -- Subject Reference
    jamaah_id TEXT NOT NULL,  -- References jamaah table
    nama_jamaah TEXT,  -- Denormalized for offline access

    -- Expert/Author Information
    pakar_id TEXT NOT NULL,
    nama_pakar TEXT,
    keahlian_pakar TEXT,  -- Area of expertise: 'Psikologi', 'Pendidikan', 'Agama', etc.

    -- Recommendation Context
    tanggal_rekomendasi TEXT NOT NULL,
    periode_berlaku TEXT,  -- e.g., '6 bulan', '1 tahun', 'sampai evaluasi berikutnya'

    -- Recommendation Type
    jenis_rekomendasi TEXT NOT NULL CHECK(jenis_rekomendasi IN (
        'jalur_pendidikan',     -- Educational path recommendations
        'intervensi',          -- Intervention needs
        'pengayaan',           -- Enrichment activities
        'remedial',            -- Remedial support
        'rujukan',             -- Referral to other specialists
        'pendampingan_khusus', -- Special assistance
        'metode_belajar',      -- Learning method adjustments
        'umum'                 -- General recommendations
    )),

    -- Priority
    prioritas TEXT DEFAULT 'normal' CHECK(prioritas IN ('rendah', 'normal', 'tinggi', 'kritis')),

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
-- REKOMENDASI_DETAIL (Recommendation Details)
-- Specific actionable recommendations within a recommendation record
-- =============================================================================

CREATE TABLE IF NOT EXISTS rekomendasi_detail (
    id TEXT PRIMARY KEY NOT NULL,
    rekomendasi_id TEXT NOT NULL,  -- References rekomendasi_pendidikan

    -- Recommendation Content
    urutan INTEGER NOT NULL,  -- Order of recommendations
    judul TEXT NOT NULL,
    deskripsi TEXT NOT NULL,

    -- Target Audience for Implementation
    ditujukan_kepada TEXT NOT NULL CHECK(ditujukan_kepada IN (
        'orang_tua',    -- For parents to implement at home
        'mubaligh',     -- For teachers to implement in class
        'jamaah',       -- For the student themselves
        'semua'         -- For everyone involved
    )),

    -- Implementation Details
    langkah_implementasi TEXT,  -- Step-by-step implementation guide
    sumber_daya TEXT,  -- Resources needed
    frekuensi TEXT,  -- How often: 'harian', 'mingguan', 'bulanan'

    -- Expected Outcomes
    hasil_diharapkan TEXT,
    indikator_keberhasilan TEXT,  -- Success indicators

    -- Timeline
    tanggal_mulai TEXT,
    tanggal_target TEXT,

    -- Status Tracking
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'selesai', 'dibatalkan', 'ditunda')),

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
-- REKOMENDASI_PROGRESS (Recommendation Progress Tracking)
-- Tracks implementation progress of recommendations
-- =============================================================================

CREATE TABLE IF NOT EXISTS rekomendasi_progress (
    id TEXT PRIMARY KEY NOT NULL,
    rekomendasi_detail_id TEXT NOT NULL,  -- References rekomendasi_detail

    -- Progress Entry
    tanggal TEXT NOT NULL,

    -- Who is reporting
    pelapor_id TEXT,
    nama_pelapor TEXT,
    peran_pelapor TEXT,  -- 'Orang Tua', 'Mubaligh', 'Pakar'

    -- Progress Details
    deskripsi_progress TEXT NOT NULL,
    pencapaian TEXT,  -- What was achieved
    kendala TEXT,  -- Obstacles encountered

    -- Progress Rating
    tingkat_kemajuan TEXT CHECK(tingkat_kemajuan IN (
        'sangat_baik',
        'baik',
        'cukup',
        'kurang',
        'belum_ada'
    )),

    -- Evidence (local file paths)
    bukti_lampiran TEXT,  -- JSON array of file paths

    -- Next Steps
    langkah_selanjutnya TEXT,

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
-- KONSULTASI_PAKAR (Expert Consultation Records)
-- Records of consultations between parents/teachers and experts
-- =============================================================================

CREATE TABLE IF NOT EXISTS konsultasi_pakar (
    id TEXT PRIMARY KEY NOT NULL,

    -- Participants
    jamaah_id TEXT,  -- Student being discussed (optional)
    nama_jamaah TEXT,

    pakar_id TEXT NOT NULL,
    nama_pakar TEXT,

    konsultan_id TEXT,  -- Parent or teacher seeking consultation
    nama_konsultan TEXT,
    peran_konsultan TEXT,  -- 'Orang Tua', 'Mubaligh'

    -- Consultation Details
    tanggal TEXT NOT NULL,
    durasi_menit INTEGER,
    metode TEXT CHECK(metode IN ('tatap_muka', 'telepon', 'chat', 'video')),

    -- Content
    topik TEXT NOT NULL,
    ringkasan TEXT,  -- Summary of discussion
    saran_pakar TEXT,  -- Expert's advice

    -- Follow-up
    perlu_konsultasi_lanjutan INTEGER DEFAULT 0,
    tanggal_lanjutan TEXT,

    -- Linked Recommendation (if consultation resulted in formal recommendation)
    rekomendasi_id TEXT,

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
CREATE INDEX IF NOT EXISTS idx_rekomendasi_jamaah ON rekomendasi_pendidikan(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_pakar ON rekomendasi_pendidikan(pakar_id);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_tanggal ON rekomendasi_pendidikan(tanggal_rekomendasi);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_jenis ON rekomendasi_pendidikan(jenis_rekomendasi);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_prioritas ON rekomendasi_pendidikan(prioritas);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_last_modified ON rekomendasi_pendidikan(last_modified);

CREATE INDEX IF NOT EXISTS idx_rekomendasi_detail_rekomendasi ON rekomendasi_detail(rekomendasi_id);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_detail_status ON rekomendasi_detail(status);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_detail_ditujukan ON rekomendasi_detail(ditujukan_kepada);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_detail_last_modified ON rekomendasi_detail(last_modified);

CREATE INDEX IF NOT EXISTS idx_rekomendasi_progress_detail ON rekomendasi_progress(rekomendasi_detail_id);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_progress_tanggal ON rekomendasi_progress(tanggal);
CREATE INDEX IF NOT EXISTS idx_rekomendasi_progress_last_modified ON rekomendasi_progress(last_modified);

CREATE INDEX IF NOT EXISTS idx_konsultasi_jamaah ON konsultasi_pakar(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_konsultasi_pakar ON konsultasi_pakar(pakar_id);
CREATE INDEX IF NOT EXISTS idx_konsultasi_tanggal ON konsultasi_pakar(tanggal);
CREATE INDEX IF NOT EXISTS idx_konsultasi_last_modified ON konsultasi_pakar(last_modified);

-- =============================================================================
-- Triggers to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_rekomendasi_pendidikan_updated_at
AFTER UPDATE ON rekomendasi_pendidikan
FOR EACH ROW
BEGIN
    UPDATE rekomendasi_pendidikan
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_rekomendasi_detail_updated_at
AFTER UPDATE ON rekomendasi_detail
FOR EACH ROW
BEGIN
    UPDATE rekomendasi_detail
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_rekomendasi_progress_updated_at
AFTER UPDATE ON rekomendasi_progress
FOR EACH ROW
BEGIN
    UPDATE rekomendasi_progress
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_konsultasi_pakar_updated_at
AFTER UPDATE ON konsultasi_pakar
FOR EACH ROW
BEGIN
    UPDATE konsultasi_pakar
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
