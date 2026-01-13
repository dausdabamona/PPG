-- =============================================================================
-- RAPOR_PERIODE (Academic Report Period) Table
-- =============================================================================
-- Main rapor record containing attendance summary and period information
-- Model C: Numeric + Predicate + Narrative + Recommendation
-- =============================================================================

CREATE TABLE IF NOT EXISTS rapor_periode (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,

    -- Student reference
    jamaah_id TEXT NOT NULL,
    nama_jamaah TEXT,  -- Denormalized for offline reports

    -- Period information
    periode TEXT NOT NULL,  -- e.g., '2024-S1', '2024-Q1'
    tahun_ajaran TEXT NOT NULL,  -- e.g., '2024/2025'
    semester INTEGER CHECK(semester IN (1, 2)),  -- 1=Ganjil, 2=Genap
    tanggal_mulai TEXT,  -- Period start date
    tanggal_selesai TEXT,  -- Period end date

    -- Class/Level reference
    tingkat_id TEXT,  -- References kelas or tingkat
    nama_tingkat TEXT,

    -- ==========================================================================
    -- Attendance Summary (Kehadiran)
    -- ==========================================================================
    total_hadir INTEGER DEFAULT 0,
    total_tidak_hadir INTEGER DEFAULT 0,
    total_izin INTEGER DEFAULT 0,
    total_sakit INTEGER DEFAULT 0,
    total_pertemuan INTEGER DEFAULT 0,
    persentase_hadir REAL DEFAULT 0,  -- Percentage 0-100

    -- Attendance Predicate & Description
    predikat_kehadiran TEXT CHECK(predikat_kehadiran IN (
        'Sangat Baik',   -- >= 90%
        'Baik',          -- >= 80%
        'Cukup',         -- >= 70%
        'Perlu Pembinaan' -- < 70%
    )),
    deskripsi_kehadiran TEXT,  -- Narrative description

    -- ==========================================================================
    -- Overall Summary
    -- ==========================================================================
    predikat_keseluruhan TEXT CHECK(predikat_keseluruhan IN (
        'Istimewa',
        'Sangat Baik',
        'Baik',
        'Cukup',
        'Perlu Pembinaan'
    )),
    deskripsi_keseluruhan TEXT,

    -- Status
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'final', 'published')),
    tanggal_finalisasi TEXT,
    difinalisasi_oleh TEXT,

    -- Notes
    catatan_mubaligh TEXT,
    catatan_pakar TEXT,

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT,

    -- Unique constraint: one rapor per student per period
    UNIQUE(jamaah_id, periode)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_rapor_periode_jamaah ON rapor_periode(jamaah_id);
CREATE INDEX IF NOT EXISTS idx_rapor_periode_periode ON rapor_periode(periode);
CREATE INDEX IF NOT EXISTS idx_rapor_periode_tahun ON rapor_periode(tahun_ajaran);
CREATE INDEX IF NOT EXISTS idx_rapor_periode_status ON rapor_periode(status);
CREATE INDEX IF NOT EXISTS idx_rapor_periode_last_modified ON rapor_periode(last_modified);

-- =============================================================================
-- Trigger for auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_rapor_periode_updated_at
AFTER UPDATE ON rapor_periode
FOR EACH ROW
BEGIN
    UPDATE rapor_periode
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
