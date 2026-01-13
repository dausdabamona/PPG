-- =============================================================================
-- BACKUP & SYNC Tables
-- =============================================================================
-- Tables for tracking backup operations and merge conflicts
-- Used by the hierarchical backup system:
-- OrangTua -> Mubaligh -> PC -> DPD -> DPW
-- =============================================================================

-- =============================================================================
-- BACKUP_LOG Table
-- Records all backup export and import operations
-- =============================================================================

CREATE TABLE IF NOT EXISTS backup_log (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,

    -- Backup file information
    file_name TEXT NOT NULL,
    file_size INTEGER,  -- Size in bytes
    checksum TEXT,  -- SHA-256 hash of the backup

    -- Operation type
    operation TEXT NOT NULL CHECK(operation IN ('export', 'import')),

    -- Hierarchy level information
    level TEXT NOT NULL CHECK(level IN ('orang_tua', 'mubaligh', 'pc', 'dpd', 'dpw')),
    source_level TEXT,  -- For imports: the level of the backup source
    wilayah_id TEXT,  -- Regional/area identifier

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    imported_at TEXT,  -- Only for import operations

    -- User information
    created_by TEXT,  -- User who created the backup
    imported_by TEXT,  -- User who imported the backup

    -- Statistics
    records_exported INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_merged INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    conflicts_count INTEGER DEFAULT 0,

    -- App version for compatibility checking
    app_version TEXT,

    -- Status
    status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')),
    error_message TEXT,

    -- Notes
    notes TEXT,

    -- ==========================================================================
    -- Sync & Audit Fields
    -- ==========================================================================
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_modified TEXT NOT NULL DEFAULT (datetime('now')),
    sync_version INTEGER NOT NULL DEFAULT 1,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    device_id TEXT
);

-- =============================================================================
-- MERGE_LOG Table
-- Records individual record merge operations and conflicts
-- =============================================================================

CREATE TABLE IF NOT EXISTS merge_log (
    -- Primary identifier
    id TEXT PRIMARY KEY NOT NULL,

    -- Reference to backup operation
    backup_log_id TEXT,  -- References backup_log

    -- Record identification
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,  -- The UUID of the merged record

    -- Merge action taken
    action TEXT NOT NULL CHECK(action IN (
        'inserted',     -- New record inserted
        'updated',      -- Existing record updated
        'skipped',      -- Record skipped (local is newer)
        'conflict',     -- Conflict detected, manual resolution needed
        'deleted'       -- Record marked as deleted
    )),

    -- Version information for conflict resolution
    local_sync_version INTEGER,
    incoming_sync_version INTEGER,
    local_last_modified TEXT,
    incoming_last_modified TEXT,

    -- Source information
    source_level TEXT NOT NULL,  -- Level of the incoming data
    source_device_id TEXT,

    -- Conflict details (if any)
    conflict_type TEXT,  -- 'version_conflict', 'data_conflict', etc.
    conflict_details TEXT,  -- JSON with conflict specifics
    resolution TEXT,  -- How the conflict was resolved

    -- Timestamp
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),

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
-- WILAYAH (Region/Area) Table
-- Stores organizational hierarchy information
-- =============================================================================

CREATE TABLE IF NOT EXISTS wilayah (
    id TEXT PRIMARY KEY NOT NULL,

    -- Hierarchy information
    level TEXT NOT NULL CHECK(level IN ('orang_tua', 'mubaligh', 'pc', 'dpd', 'dpw', 'pusat')),
    parent_id TEXT,  -- References parent wilayah

    -- Identification
    kode TEXT UNIQUE,  -- Unique code for the region
    nama TEXT NOT NULL,

    -- Address/Location
    alamat TEXT,
    kota TEXT,
    provinsi TEXT,

    -- Contact
    telepon TEXT,
    email TEXT,

    -- Admin information
    ketua_id TEXT,  -- Head of region
    nama_ketua TEXT,

    -- Status
    status TEXT DEFAULT 'aktif' CHECK(status IN ('aktif', 'nonaktif')),

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
CREATE INDEX IF NOT EXISTS idx_backup_log_operation ON backup_log(operation);
CREATE INDEX IF NOT EXISTS idx_backup_log_level ON backup_log(level);
CREATE INDEX IF NOT EXISTS idx_backup_log_created_at ON backup_log(created_at);
CREATE INDEX IF NOT EXISTS idx_backup_log_status ON backup_log(status);

CREATE INDEX IF NOT EXISTS idx_merge_log_backup ON merge_log(backup_log_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_table ON merge_log(table_name);
CREATE INDEX IF NOT EXISTS idx_merge_log_record ON merge_log(record_id);
CREATE INDEX IF NOT EXISTS idx_merge_log_action ON merge_log(action);
CREATE INDEX IF NOT EXISTS idx_merge_log_timestamp ON merge_log(timestamp);

CREATE INDEX IF NOT EXISTS idx_wilayah_level ON wilayah(level);
CREATE INDEX IF NOT EXISTS idx_wilayah_parent ON wilayah(parent_id);
CREATE INDEX IF NOT EXISTS idx_wilayah_kode ON wilayah(kode);

-- =============================================================================
-- Triggers to auto-update timestamps
-- =============================================================================
CREATE TRIGGER IF NOT EXISTS trg_backup_log_updated_at
AFTER UPDATE ON backup_log
FOR EACH ROW
BEGIN
    UPDATE backup_log
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_merge_log_updated_at
AFTER UPDATE ON merge_log
FOR EACH ROW
BEGIN
    UPDATE merge_log
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_wilayah_updated_at
AFTER UPDATE ON wilayah
FOR EACH ROW
BEGIN
    UPDATE wilayah
    SET updated_at = datetime('now'),
        last_modified = datetime('now'),
        sync_version = OLD.sync_version + 1
    WHERE id = NEW.id;
END;
