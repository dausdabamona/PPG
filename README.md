# PPG - Pengajian Progress Guru

**Offline-First Student Management System for Islamic Education**

A Progressive Web App (PWA) designed for managing students (jamaah), classes (kelas), attendance (kehadiran), assessments (penilaian), and educational recommendations in Islamic education settings (pengajian).

---

## Table of Contents

- [Architecture](#architecture)
- [Features](#features)
- [Folder Structure](#folder-structure)
- [Database Schema](#database-schema)
- [User Roles](#user-roles)
- [Hierarchical Backup System](#hierarchical-backup-system)
- [Academic Report Engine (Rapor)](#academic-report-engine-rapor)
- [Getting Started](#getting-started)
- [Development Roadmap](#development-roadmap)
- [Offline-First Design](#offline-first-design)
- [Future: Android APK](#future-android-apk)
- [License](#license)

---

## Architecture

### Offline-First Design

PPG is built with an **offline-first architecture**, meaning:

1. **No Internet Required**: All features work completely offline
2. **Local Database**: SQLite stores all data locally on the device
3. **Sync-Ready**: Data structure supports future synchronization between devices
4. **PWA Capable**: Can be installed on any device as a Progressive Web App

### Technology Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | Vanilla HTML + CSS + JavaScript | No heavy frameworks for maximum performance |
| **Database** | SQLite | Via SQL.js (web) or Capacitor SQLite (native) |
| **Storage** | localStorage / IndexedDB | For web platform persistence |
| **Native Wrapper** | Capacitor | For Android/iOS APK generation |
| **Encryption** | SQLCipher (planned) | Database encryption for security |

### Why Offline-First?

- **Reliable**: Works in areas with poor/no internet connectivity
- **Fast**: No network latency for local operations
- **Private**: Data stays on user's device
- **Cost-Effective**: No server hosting costs

---

## Features

### Core Modules

| Module | Indonesian | Description |
|--------|------------|-------------|
| **Jamaah** | Santri/Murid | Student/participant management |
| **Kelas** | Kelas Pengajian | Class and group management |
| **Kehadiran** | Absensi | Attendance tracking per session |
| **Penilaian** | Nilai | Assessment for knowledge (materi) and character (akhlak) |
| **Kelas Mandiri** | Pembelajaran Mandiri | Parent self-learning modules |
| **Catatan Pembinaan** | Catatan Guru | Teacher/mentor notes and observations |
| **Rekomendasi Pendidikan** | Saran Pakar | Expert educational recommendations |

### Key Capabilities

- **Student Registration**: Complete student profiles with parent information
- **Class Management**: Multiple classes with schedule and instructor info
- **Attendance Tracking**: Per-session attendance with detailed status
- **Dual Assessment**: Both knowledge (materi) and character (akhlak) evaluation
- **Parent Learning**: Self-paced learning modules for parents
- **Expert Consultation**: Track consultations and recommendations
- **Progress Tracking**: Monitor implementation of recommendations

---

## Folder Structure

```
/PPG
├── /app
│   ├── /pages          # HTML pages for each feature
│   ├── /components     # Reusable UI components
│   ├── /services       # Business logic and data services
│   │   ├── jamaahService.js
│   │   └── kehadiranService.js
│   ├── /db             # Database initialization and migrations
│   │   ├── db.js       # SQLite initialization
│   │   └── migrate.js  # Schema migrations
│   ├── /backup         # Hierarchical backup system
│   │   ├── export.js   # Export to .ppg file
│   │   ├── import.js   # Import and merge
│   │   ├── hierarchy.js # Level validation
│   │   └── backup.js   # Legacy backup utilities
│   ├── /akademik       # Academic report engine
│   │   ├── kehadiranEngine.js  # Attendance calculation
│   │   ├── materiEngine.js     # Subject mastery analysis
│   │   ├── akhlaqEngine.js     # Character assessment
│   │   ├── rekomendasiEngine.js # Rule-based recommendations
│   │   └── raporEngine.js      # Main orchestrator
│   └── /roles          # Role-based access control
│       └── roles.js
├── /android            # Capacitor Android project (future)
├── /schema             # SQL schema files
│   ├── jamaah.sql
│   ├── kelas.sql
│   ├── kehadiran.sql
│   ├── penilaian.sql
│   ├── kelas_mandiri.sql
│   ├── catatan_pembinaan.sql
│   ├── rekomendasi_pendidikan.sql
│   ├── backup_sync.sql # Backup & merge logging tables
│   ├── rapor_periode.sql    # Main rapor with attendance summary
│   ├── rapor_materi.sql     # Subject mastery assessment
│   ├── rapor_akhlaq.sql     # Character assessment
│   └── rapor_rekomendasi.sql # Rule-based recommendations
├── index.html          # Main PWA entry point
└── README.md
```

---

## Database Schema

### Design Principles

Every table follows these offline-first principles:

```sql
-- Primary Key: UUID for conflict-free ID generation
id TEXT PRIMARY KEY NOT NULL

-- Audit Fields
created_at TEXT NOT NULL DEFAULT (datetime('now'))
updated_at TEXT NOT NULL DEFAULT (datetime('now'))

-- Sync Fields
last_modified TEXT NOT NULL DEFAULT (datetime('now'))  -- For conflict resolution
sync_version INTEGER NOT NULL DEFAULT 1               -- Version tracking
is_deleted INTEGER NOT NULL DEFAULT 0                 -- Soft delete for sync
device_id TEXT                                        -- Origin device tracking
```

### Tables Overview

| Table | Purpose | Related Tables |
|-------|---------|----------------|
| `jamaah` | Student records | - |
| `kelas` | Class information | `kelas_jamaah` (junction) |
| `kehadiran` | Attendance sessions | `kehadiran_detail` |
| `penilaian` | Assessment records | `penilaian_materi`, `penilaian_akhlak` |
| `kelas_mandiri` | Self-learning classes | `modul_mandiri`, `progress_mandiri` |
| `catatan_pembinaan` | Guidance notes | `catatan_tindak_lanjut` |
| `rekomendasi_pendidikan` | Expert recommendations | `rekomendasi_detail`, `rekomendasi_progress`, `konsultasi_pakar` |
| `backup_log` | Backup export/import history | - |
| `merge_log` | Record merge operations & conflicts | `backup_log` |
| `wilayah` | Regional/organizational hierarchy | - |
| `rapor_periode` | Academic report periods | `jamaah` |
| `rapor_materi` | Subject assessment per rapor | `rapor_periode` |
| `rapor_akhlaq` | Character assessment per rapor | `rapor_periode` |
| `rapor_rekomendasi` | Auto-generated recommendations | `rapor_periode` |
| `rapor_rekomendasi_progress` | Recommendation follow-up | `rapor_rekomendasi` |

---

## User Roles

PPG supports three user roles with different permissions:

### 1. Orang Tua (Parent)

- **View**: Own children's attendance, assessments, and recommendations
- **Access**: Parent self-learning modules (Kelas Mandiri)
- **Report**: Progress on implementing recommendations
- **Consult**: Request expert consultations

### 2. Mubaligh (Teacher/Instructor)

- **Manage**: Attendance for their classes
- **Assess**: Student knowledge and character
- **Notes**: Create coaching/guidance notes (Catatan Pembinaan)
- **View**: Student progress and history

### 3. Pakar (Expert/Specialist)

- **Full Access**: All student data and history
- **Recommend**: Create educational recommendations
- **Consult**: Conduct and record consultations
- **Monitor**: Track recommendation implementation

---

## Hierarchical Backup System

PPG implements a hierarchical backup and data flow system designed for organizational data aggregation without requiring internet connectivity.

### Organizational Hierarchy

Data flows upward through the following levels:

```
┌─────────────────┐
│       DPW       │  Dewan Pimpinan Wilayah (highest)
│  (Provincial)   │
└────────┬────────┘
         │ imports from
┌────────▼────────┐
│       DPD       │  Dewan Pimpinan Daerah
│   (Regional)    │
└────────┬────────┘
         │ imports from
┌────────▼────────┐
│       PC        │  Pimpinan Cabang
│    (Branch)     │
└────────┬────────┘
         │ imports from
┌────────▼────────┐
│    Mubaligh     │  Teacher/Instructor
│   (Teacher)     │
└────────┬────────┘
         │ imports from
┌────────▼────────┐
│   Orang Tua     │  Parent (lowest level)
│    (Parent)     │
└─────────────────┘
```

### Import Rules

Each level can **only** import from the level immediately below:

| Your Level | Can Import From | Cannot Import From |
|------------|-----------------|-------------------|
| Mubaligh | Orang Tua | PC, DPD, DPW |
| PC | Mubaligh | Orang Tua, DPD, DPW |
| DPD | PC | Orang Tua, Mubaligh, DPW |
| DPW | DPD | Orang Tua, Mubaligh, PC |

**Orang Tua** can only export, not import (lowest level).

### .ppg Backup File Format

Backups are exported as `.ppg` files (ZIP format internally) containing:

```
backup_file.ppg (ZIP)
├── data.json      # All database records
├── meta.json      # Backup metadata
└── hash.txt       # SHA-256 checksum
```

#### meta.json Structure

```json
{
    "backup_id": "uuid",
    "file_format": "ppg",
    "format_version": 1,
    "level": "mubaligh",
    "level_name": "Mubaligh",
    "wilayah_id": "uuid",
    "wilayah_name": "Cabang Jakarta Selatan",
    "created_by": "user_id",
    "created_by_name": "Ustadz Ahmad",
    "device_id": "device_uuid",
    "created_at": "2024-01-15T10:30:00.000Z",
    "app_version": "1.0.0",
    "table_count": 15,
    "total_records": 1250,
    "target_level": "pc",
    "target_level_name": "Pimpinan Cabang (PC)"
}
```

### Merge Strategy

PPG uses an **offline-first, last-write-wins** merge strategy with version tracking:

#### Conflict Resolution Algorithm

```
For each incoming record:
1. Check if record exists locally (by UUID)
2. If NOT exists → INSERT new record
3. If EXISTS:
   a. Compare sync_version (incoming vs local)
   b. If incoming > local → UPDATE with incoming
   c. If incoming = local → Compare last_modified
      - If incoming > local → UPDATE
      - If incoming = local → SKIP (identical)
      - If incoming < local → SKIP (local is newer)
   d. If incoming < local → SKIP & log conflict
4. Log all merge operations to merge_log table
```

#### Merge Fields Used

| Field | Purpose |
|-------|---------|
| `id` | UUID - unique identifier for matching records |
| `sync_version` | Integer - increments on each local change |
| `last_modified` | Timestamp - used as tiebreaker |
| `device_id` | Source device tracking for audit |

### Backup Logging

All backup operations are logged to `backup_log`:

```sql
-- Export operation
INSERT INTO backup_log (
    operation = 'export',
    level = 'mubaligh',
    records_exported = 500,
    status = 'completed'
);

-- Import operation
INSERT INTO backup_log (
    operation = 'import',
    level = 'pc',
    source_level = 'mubaligh',
    records_imported = 500,
    records_merged = 450,
    records_skipped = 50,
    conflicts_count = 5
);
```

### Merge Logging

Individual record merges are logged to `merge_log`:

```sql
-- Successful update
INSERT INTO merge_log (
    table_name = 'jamaah',
    record_id = 'uuid',
    action = 'updated',
    local_sync_version = 3,
    incoming_sync_version = 5,
    source_level = 'orang_tua'
);

-- Conflict detected
INSERT INTO merge_log (
    action = 'skipped',
    conflict_type = 'version_conflict',
    conflict_details = 'Local newer: v5 vs v3'
);
```

### Usage Example

```javascript
// Export backup
import BackupExport from './app/backup/export.js';

const result = await BackupExport.createBackup({
    level: 'mubaligh',
    wilayah_name: 'Cabang Jakarta Selatan',
    created_by: 'ustadz_ahmad',
    notes: 'Backup bulanan Januari 2024'
});
// Downloads: ppg_backup_mubaligh_2024-01-15.ppg

// Import backup (at PC level)
import BackupImport from './app/backup/import.js';

const importResult = await BackupImport.importBackup(file, {
    importerLevel: 'pc',
    importedBy: 'admin_pc'
});
// Result: { inserted: 100, updated: 50, skipped: 10, conflicts: 2 }
```

---

## Academic Report Engine (Rapor)

PPG includes a comprehensive academic report engine that generates student reports using **Model C: Numeric + Predicate + Narrative + Recommendation**.

### Report Components

The rapor system combines four key aspects:

| Component | Engine | Description |
|-----------|--------|-------------|
| **Kehadiran** | `kehadiranEngine.js` | Attendance analysis with percentage and predicate |
| **Akademik** | `materiEngine.js` | Subject mastery with status (lulus/proses/tertinggal) |
| **Akhlaq** | `akhlaqEngine.js` | Character assessment across 8 dimensions |
| **Rekomendasi** | `rekomendasiEngine.js` | Rule-based recommendations by role |

### Attendance Predicates

| Percentage | Predicate |
|------------|-----------|
| >= 90% | Sangat Baik |
| >= 80% | Baik |
| >= 70% | Cukup |
| < 70% | Perlu Pembinaan |

### Academic Predicates

| Score | Predicate | Description |
|-------|-----------|-------------|
| 90-100 | A | Istimewa |
| 80-89 | B | Sangat Baik |
| 70-79 | C | Baik |
| 60-69 | D | Cukup |
| < 60 | E | Perlu Bimbingan |

### Subject Status

| Status | Criteria | Description |
|--------|----------|-------------|
| `lulus` | >= 70 | Mastered/Passed |
| `proses` | >= 50 | In Progress |
| `tertinggal` | < 50 | Behind/Needs Catch-up |

### Character Dimensions (Akhlaq)

The character assessment evaluates 8 dimensions on a 1-4 scale:

| Dimension | Indonesian | English |
|-----------|------------|---------|
| Kedisiplinan | Disiplin | Discipline |
| Adab | Sopan Santun | Manners/Etiquette |
| Kemandirian | Mandiri | Independence |
| Kebersihan | Bersih | Cleanliness |
| Tanggung Jawab | Bertanggung jawab | Responsibility |
| Kejujuran | Jujur | Honesty |
| Kepedulian | Peduli | Care/Empathy |
| Kerjasama | Bekerjasama | Cooperation |

**Scoring:**
- 4: Sangat Baik
- 3: Baik
- 2: Cukup
- 1: Perlu Bimbingan

### Rule-Based Recommendations

The recommendation engine automatically generates targeted recommendations based on configurable rules:

```javascript
// Example rules
const RULES = [
  {
    id: 'kehadiran_rendah',
    kondisi: (data) => data.kehadiran.persentase < 70,
    prioritas: 'tinggi',
    targetPeran: ['orang_tua', 'mubaligh'],
    // ... generates specific recommendation
  },
  {
    id: 'materi_tertinggal',
    kondisi: (data) => data.materi.materiTertinggal > 0,
    prioritas: 'tinggi',
    // ...
  }
];
```

**Recommendation Categories:**
- `kehadiran` - Attendance-related
- `akademik` - Academic performance
- `akhlaq` - Character development
- `kelas_mandiri` - Parent self-learning
- `kesehatan` - Health/wellbeing

**Priority Levels:**
- `urgent` - Immediate attention required
- `tinggi` - High priority
- `normal` - Standard priority
- `rendah` - Low priority (appreciation)

**Target Roles:**
- `orang_tua` - Parents
- `mubaligh` - Teachers
- `pakar` - Experts
- `jamaah` - Students
- `semua` - Everyone

### Usage Example

```javascript
import RaporEngine from './app/akademik/raporEngine.js';

// Generate a complete rapor
const rapor = await RaporEngine.generateRapor(jamaahId, {
    periode: '2024-S1',
    tahunAjaran: '2024/2025',
    semester: 1,
    tanggalMulai: '2024-01-15',
    tanggalSelesai: '2024-06-30'
}, deviceId);

// rapor contains:
// - Attendance summary and predicate
// - Subject mastery breakdown
// - Character assessment scores
// - Auto-generated recommendations
// - Overall predicate and narrative

// View existing rapor
const existingRapor = await RaporEngine.getRaporById(raporId);

// Finalize rapor
await RaporEngine.finalizeRapor(raporId, 'mubaligh_name');

// Publish to parents
await RaporEngine.publishRapor(raporId);
```

### Rapor Workflow

```
┌────────────────┐
│  Draft Status  │  Initial generation
└───────┬────────┘
        │ Mubaligh reviews
┌───────▼────────┐
│  Final Status  │  Locked for editing
└───────┬────────┘
        │ Ready for parents
┌───────▼────────┐
│   Published    │  Visible to orang_tua
└────────────────┘
```

---

## Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js (optional, for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-repo/PPG.git
   cd PPG
   ```

2. **Open in browser**
   ```bash
   # Using any static file server
   npx serve .
   # Or simply open index.html in your browser
   ```

3. **Initialize database**
   ```javascript
   // In browser console or your main.js
   import DB from './app/db/db.js';
   import Migrate from './app/db/migrate.js';

   async function init() {
       await DB.init();
       await Migrate.run();
       console.log('Database ready!');
   }
   init();
   ```

### Basic Usage

```javascript
// Import services
import JamaahService from './app/services/jamaahService.js';
import KehadiranService from './app/services/kehadiranService.js';

// Create a new student
const student = await JamaahService.create({
    nama_lengkap: 'Ahmad Fauzi',
    nama_panggilan: 'Fauzi',
    jenis_kelamin: 'L',
    nama_orang_tua: 'Budi Santoso'
});

// Create attendance session
const session = await KehadiranService.createSession({
    kelas_id: 'class-uuid',
    nama_kelas: 'Fiqih Dasar',
    tanggal: '2024-01-15',
    materi_hari_ini: 'Thaharah - Wudhu'
});

// Record attendance
await KehadiranService.bulkRecordAttendance(session.id, [
    { jamaah_id: student.id, nama_jamaah: student.nama_lengkap, status: 'hadir' }
]);
```

---

## Development Roadmap

### Phase 1: Foundation (Completed)

- [x] SQLite schema design with offline-sync fields
- [x] Database initialization (db.js)
- [x] Migration system (migrate.js)
- [x] CRUD services for Jamaah and Kehadiran
- [x] Basic HTML UI with mobile-first design
- [x] Role-based access control (roles.js)

### Phase 2: Hierarchical Backup (Completed)

- [x] Export database to .ppg file (ZIP format)
- [x] Metadata and checksum generation
- [x] Organizational hierarchy validation (5 levels)
- [x] Import with level validation
- [x] Last-write-wins merge strategy
- [x] Backup and merge logging tables
- [x] UI buttons for export/import

### Phase 3: Academic Report Engine (Completed)

- [x] Rapor schema design (rapor_periode, rapor_materi, rapor_akhlaq, rapor_rekomendasi)
- [x] Attendance calculation engine (kehadiranEngine.js)
- [x] Subject mastery analysis (materiEngine.js)
- [x] Character assessment engine (akhlaqEngine.js)
- [x] Rule-based recommendation engine (rekomendasiEngine.js)
- [x] Main orchestrator (raporEngine.js)
- [x] UI for rapor generation and display
- [x] Model C: Numeric + Predicate + Narrative + Recommendation

### Phase 4: Encryption & Security (Planned)

- [ ] SQLCipher integration for database encryption
- [ ] PIN/password protection for app access
- [ ] Secure key storage
- [ ] Biometric authentication (Capacitor)
- [ ] Encrypted backup files

### Phase 5: Enhanced Features (Planned)

- [ ] Complete UI for all modules
- [ ] Automatic backup scheduling
- [ ] Backup to local storage/SD card
- [ ] Conflict resolution UI
- [ ] Reports and analytics

### Phase 6: Android APK (Planned)

- [ ] Capacitor project setup
- [ ] Native SQLite integration
- [ ] Android build configuration
- [ ] Play Store preparation

---

## Offline-First Design

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│                   (Vanilla HTML + JS)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    Service Layer                             │
│         (jamaahService.js, kehadiranService.js, etc.)       │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   Database Layer                             │
│                (db.js + migrate.js)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼───────┐         ┌────────▼────────┐
│    SQL.js     │         │ Capacitor SQLite │
│ (Web Browser) │         │ (Android/iOS)    │
└───────────────┘         └─────────────────┘
```

### Sync-Ready Data Model

Each record includes fields for future synchronization:

| Field | Purpose |
|-------|---------|
| `last_modified` | Timestamp of last change (for conflict detection) |
| `sync_version` | Incremental version number (for ordering changes) |
| `is_deleted` | Soft delete flag (preserves record for sync) |
| `device_id` | Identifies which device made the change |

### Conflict Resolution Strategy (Planned)

1. **Last-Write-Wins**: Simple strategy using `last_modified`
2. **Version Vectors**: More sophisticated using `sync_version`
3. **Manual Merge**: User-assisted conflict resolution for complex cases

---

## Future: Android APK

### Capacitor Integration

PPG is designed to be wrapped as a native Android app using Capacitor:

```bash
# Future commands (Phase 5)
npm install @capacitor/core @capacitor/cli
npm install @capacitor-community/sqlite
npx cap init PPG com.ppg.app
npx cap add android
npx cap sync
npx cap open android
```

### Native Features (Planned)

- **SQLite**: Native database via `@capacitor-community/sqlite`
- **File System**: Local backup storage
- **Biometrics**: Fingerprint/face authentication
- **Camera**: Photo capture for student profiles
- **Share**: Export reports as PDF/images

---

## Technical Notes

### UUID Generation

UUIDs are generated client-side for offline-first operation:

```javascript
// Uses crypto.randomUUID() when available, fallback for older browsers
function generateUUID() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ...);
}
```

### Database Persistence (Web)

On web platform, the database is persisted to localStorage:

```javascript
// Save database
const data = db.export();
localStorage.setItem('ppg_database', JSON.stringify(Array.from(data)));

// Load database
const saved = localStorage.getItem('ppg_database');
if (saved) db = new SQL.Database(new Uint8Array(JSON.parse(saved)));
```

### No External Dependencies

PPG has **zero runtime dependencies** on external services:
- No cloud database (Supabase, Firebase, etc.)
- No authentication service
- No API servers
- Everything runs locally on the device

---

## Contributing

Contributions are welcome! Please read the following guidelines:

1. Fork the repository
2. Create a feature branch
3. Follow existing code style
4. Test thoroughly offline
5. Submit a pull request

---

## License

MIT License - See LICENSE file for details.

---

## Contact

For questions and support, please open an issue on GitHub.

---

**PPG** - Empowering Islamic Education with Technology
