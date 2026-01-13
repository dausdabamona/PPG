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
- [Security Architecture](#security-architecture)
- [Official Curriculum Import](#official-curriculum-import)
- [Hierarchical Backup System](#hierarchical-backup-system)
- [Academic Report Engine (Rapor)](#academic-report-engine-rapor)
- [Getting Started](#getting-started)
- [Development Roadmap](#development-roadmap)
- [Offline-First Design](#offline-first-design)
- [Android APK Build](#android-apk-build)
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
| **Encryption** | SQLCipher | AES-256 database encryption (active) |
| **Crypto** | Web Crypto API | AES-256-GCM, ECDSA P-256, PBKDF2 |

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
├── /app                    # Web application source
│   ├── index.html          # Main entry point (for Capacitor)
│   ├── /pages              # HTML pages for each feature
│   ├── /components         # Reusable UI components
│   ├── /services           # Business logic and data services
│   │   ├── jamaahService.js
│   │   ├── kehadiranService.js
│   │   └── fileService.js  # Cross-platform file operations
│   ├── /db                 # Database initialization and migrations
│   │   ├── db.js           # SQLite initialization (web + native)
│   │   └── migrate.js      # Schema migrations
│   ├── /backup             # Hierarchical backup system
│   │   ├── export.js       # Export to .ppg file (with encryption)
│   │   ├── import.js       # Import and merge (with decryption)
│   │   ├── hierarchy.js    # Level validation
│   │   └── backup.js       # Legacy backup utilities
│   ├── /security           # Security and encryption modules
│   │   ├── keyManager.js   # PIN management, key derivation
│   │   ├── cryptoUtils.js  # AES-256-GCM encryption
│   │   ├── signatureManager.js # ECDSA digital signatures
│   │   └── securityUI.js   # PIN screens, security status
│   ├── /import             # Official data import modules
│   │   ├── kurikulumImporter.js  # Curriculum package import
│   │   └── kurikulumUI.js        # Import UI components
│   ├── /akademik           # Academic report engine
│   │   ├── kehadiranEngine.js  # Attendance calculation
│   │   ├── materiEngine.js     # Subject mastery analysis
│   │   ├── akhlaqEngine.js     # Character assessment
│   │   ├── rekomendasiEngine.js # Rule-based recommendations
│   │   └── raporEngine.js      # Main orchestrator
│   └── /roles              # Role-based access control
│       └── roles.js
├── /android                # Capacitor Android project
│   ├── /app                # Android app module
│   │   └── /src/main
│   │       ├── /assets     # Web assets (auto-copied)
│   │       ├── /res        # Android resources (icons, splash)
│   │       └── AndroidManifest.xml
│   ├── build.gradle
│   └── gradlew
├── /resources              # Source assets for customization
│   └── README.md           # Asset generation instructions
├── /schema                 # SQL schema files
│   ├── jamaah.sql
│   ├── kelas.sql
│   ├── kehadiran.sql
│   ├── penilaian.sql
│   ├── kelas_mandiri.sql
│   ├── catatan_pembinaan.sql
│   ├── rekomendasi_pendidikan.sql
│   ├── backup_sync.sql     # Backup & merge logging tables
│   ├── rapor_periode.sql   # Main rapor with attendance summary
│   ├── rapor_materi.sql    # Subject mastery assessment
│   ├── rapor_akhlaq.sql    # Character assessment
│   └── rapor_rekomendasi.sql # Rule-based recommendations
├── index.html              # Root entry (redirects to /app)
├── package.json            # NPM dependencies and scripts
├── capacitor.config.json   # Capacitor configuration
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

## Security Architecture

PPG implements production-grade security for offline data protection. All cryptographic operations use the Web Crypto API with no external dependencies.

### Security Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database Encryption** | SQLCipher (AES-256) | Encrypt all local data at rest |
| **Key Derivation** | PBKDF2-SHA256 (100k iterations) | Derive encryption keys from PIN |
| **Backup Encryption** | AES-256-GCM | Encrypt backup file contents |
| **Digital Signatures** | ECDSA P-256 | Verify backup authenticity |
| **Integrity Check** | SHA-256 | Detect data tampering |

### Key Hierarchy

PPG uses a three-component key derivation system:

```
┌─────────────────────────────────────────────────────────────┐
│                    User PIN (4-8 digits)                     │
│                         (secret)                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    PBKDF2-SHA256                             │
│                  (100,000 iterations)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
┌─────────▼─────────┐   ┌────────▼────────┐
│   Device Salt     │   │  Wilayah Key    │
│ (auto-generated)  │   │ (organizational)│
└─────────┬─────────┘   └────────┬────────┘
          │                       │
          └───────────┬───────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Database Encryption Key (32 bytes)              │
│                    (AES-256-GCM key)                         │
└─────────────────────────────────────────────────────────────┘
```

**Key Components:**

| Component | Storage | Purpose |
|-----------|---------|---------|
| User PIN | Never stored (only hash) | User authentication |
| Device Salt | Secure storage | Unique per device |
| Wilayah Key | Secure storage | Organizational key |
| DB Key | Memory only | Encrypts SQLCipher database |

### PIN Security

- **Minimum Length**: 4 digits
- **Maximum Length**: 8 digits
- **Storage**: Salted PBKDF2 hash only (PIN never stored)
- **Lockout**: 5 failed attempts = 5 minute lockout
- **Auto-Lock**: Database locks when app is backgrounded

### Database Encryption

PPG uses SQLCipher for transparent database encryption:

```javascript
// Database unlock flow
import { verifyPIN, deriveDBKeyQuick } from './security/keyManager.js';

// 1. User enters PIN
const isValid = await verifyPIN(userId, enteredPIN);

// 2. Derive encryption key
const dbKey = await deriveDBKeyQuick(userId);

// 3. Unlock SQLCipher database
await unlockDatabase(dbKey);
```

**Encryption Details:**
- Algorithm: AES-256 in GCM mode
- Key Size: 256 bits (32 bytes)
- IV Size: 96 bits (12 bytes)
- Authentication Tag: 128 bits

### Backup Encryption

Encrypted backups use a layered security approach:

```
┌────────────────────────────────────────┐
│         Encrypted .ppg File            │
├────────────────────────────────────────┤
│  1. data.enc (AES-256-GCM encrypted)   │
│  2. encryption.json (crypto metadata)   │
│  3. signature.sig (ECDSA signature)     │
│  4. meta.json (backup metadata)         │
│  5. hash.txt (SHA-256 checksum)         │
└────────────────────────────────────────┘
```

#### encryption.json Structure

```json
{
    "version": 1,
    "algorithm": "AES-256-GCM",
    "iv": "hex-encoded-iv",
    "aadHash": "hex-encoded-sha256",
    "checksum": "hex-encoded-sha256",
    "originalSize": 123456,
    "encryptedSize": 123472,
    "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Digital Signatures

Each organizational level has its own ECDSA P-256 key pair:

```
┌─────────────────────────────────────────────────────────────┐
│                    Key Hierarchy                             │
├─────────────────────────────────────────────────────────────┤
│  DPW  ────► Public key embedded (trusted root)              │
│    ↓                                                         │
│  DPD  ────► Signs backups, public key shared to children    │
│    ↓                                                         │
│  PC   ────► Signs backups, public key shared to children    │
│    ↓                                                         │
│  Mubaligh ─► Signs backups, public key shared to parents    │
│    ↓                                                         │
│  Orang Tua ► Signs backups for upload                       │
└─────────────────────────────────────────────────────────────┘
```

**Signature Verification:**

```javascript
import { verifyBackupSignature, validateHierarchyTrust } from './security/signatureManager.js';

// Verify backup signature
const result = await verifyBackupSignature(backupData, signatureBytes, publicKey);
// result: { valid: true, signedAt: "2024-01-15T10:30:00Z", level: "mubaligh" }

// Validate hierarchy trust chain
const trustResult = await validateHierarchyTrust(sourceLevel, targetLevel, publicKey);
// result: { trusted: true, chain: ["orang_tua", "mubaligh"] }
```

### Trust Chain Validation

Import operations validate the trust chain:

| Importer Level | Valid Source | Trust Validation |
|----------------|--------------|------------------|
| Mubaligh | Orang Tua | Verify parent's signature |
| PC | Mubaligh | Verify teacher's signature |
| DPD | PC | Verify branch signature |
| DPW | DPD | Verify regional signature |

### Security Modules

PPG security is implemented across these modules:

| File | Purpose |
|------|---------|
| `/app/security/keyManager.js` | PIN management, key derivation, secure storage |
| `/app/security/cryptoUtils.js` | AES-256-GCM encryption, packed format handling |
| `/app/security/signatureManager.js` | ECDSA key pairs, signing, verification |
| `/app/security/securityUI.js` | PIN setup/login screens, security status display |

### Disaster Recovery

#### Lost PIN

If a user forgets their PIN:

1. **Data Loss Warning**: Cannot recover encrypted data without PIN
2. **Reset Option**: Clear app data and restore from backup
3. **Prevention**: Encourage regular encrypted backups with stored encryption key

#### Device Loss

1. **Data Protected**: SQLCipher encryption prevents unauthorized access
2. **Recovery**: Import encrypted backup on new device
3. **Key Requirement**: Need original encryption key and backup file

#### Backup Recovery Process

```
1. Install PPG on new device
2. Set up new PIN (creates new device salt)
3. Import encrypted .ppg backup file
4. Enter backup encryption key (if different from current)
5. Verify signature (validates authenticity)
6. Merge data into new database
```

### Security Best Practices

1. **Choose Strong PIN**: Use 6-8 digits, avoid patterns
2. **Regular Backups**: Export encrypted backups periodically
3. **Secure Key Storage**: Keep backup encryption keys safe (offline)
4. **Verify Signatures**: Always check backup signatures before import
5. **Update Keys**: Rotate wilayah keys periodically

---

## Official Curriculum Import

PPG supports importing official curriculum data from Supabase as signed JSON packages. This enables centralized curriculum management while maintaining offline-first operation.

### Curriculum Package Format

Official curriculum files follow the naming convention `kurikulum-ppg-vX.Y.json`:

```json
{
    "meta": {
        "version": "1.0",
        "issued_by": "Pusat Kurikulum",
        "issued_at": "2026-01-15",
        "signature": "<base64-ecdsa-signature>",
        "public_key_id": "kurikulum_pusat",
        "public_key": { /* JWK format public key (optional) */ }
    },
    "data": {
        "jenjang": [...],
        "tingkat_jenjang": [...],
        "kategori_materi": [...],
        "materi": [...],
        "sub_materi": [...],
        "kurikulum_tingkat": [...]
    }
}
```

### Curriculum Tables

| Table | Description |
|-------|-------------|
| `jenjang` | Education levels (e.g., Paud, TK, SD, SMP) |
| `tingkat_jenjang` | Grade levels within each jenjang |
| `kategori_materi` | Subject categories (e.g., Aqidah, Fiqih, Akhlaq) |
| `materi` | Subjects/courses within categories |
| `sub_materi` | Sub-topics within subjects |
| `kurikulum_tingkat` | Links grades to subjects with hours allocation |
| `kurikulum_version` | Import history and version tracking |

### Import Process

1. **Pick File**: User selects `kurikulum-ppg-vX.Y.json`
2. **Validate Schema**: Verify required tables and fields
3. **Check Version**: Reject if older than current installed version
4. **Verify Signature**: ECDSA P-256 signature verification
5. **Import Data**: UPSERT all records into database
6. **Save History**: Record version and import statistics

### Security Features

- **ECDSA P-256 Signatures**: All packages signed by Kurikulum Authority
- **Version Control**: Cannot import older versions
- **Schema Validation**: Strict field validation before import
- **Audit Trail**: Full import history with checksums

### Supabase Export Helper

To export curriculum data from Supabase, use this SQL query:

```sql
SELECT json_build_object(
    'jenjang', (SELECT json_agg(j) FROM (
        SELECT id, kode, nama, deskripsi, urutan, status
        FROM jenjang ORDER BY urutan
    ) j),
    'tingkat_jenjang', (SELECT json_agg(t) FROM (
        SELECT id, jenjang_id, kode, nama, deskripsi, urutan, usia_minimal, usia_maksimal, status
        FROM tingkat_jenjang ORDER BY jenjang_id, urutan
    ) t),
    'kategori_materi', (SELECT json_agg(k) FROM (
        SELECT id, kode, nama, deskripsi, warna, icon, urutan, status
        FROM kategori_materi ORDER BY urutan
    ) k),
    'materi', (SELECT json_agg(m) FROM (
        SELECT id, kategori_id, kode, nama, deskripsi, tujuan, sumber_rujukan, urutan, bobot, status
        FROM materi ORDER BY kategori_id, urutan
    ) m),
    'sub_materi', (SELECT json_agg(s) FROM (
        SELECT id, materi_id, kode, nama, deskripsi, kompetensi_dasar, indikator, urutan, estimasi_jam, status
        FROM sub_materi ORDER BY materi_id, urutan
    ) s),
    'kurikulum_tingkat', (SELECT json_agg(kt) FROM (
        SELECT id, tingkat_id, materi_id, semester, target_kompetensi, jam_per_minggu, jam_total, wajib, urutan, catatan, status
        FROM kurikulum_tingkat ORDER BY tingkat_id, urutan
    ) kt)
) AS kurikulum;
```

### Signing the Curriculum Package

1. **Generate Authority Key Pair** (one-time setup):

```javascript
import { generateAuthorityKeyPair } from './app/import/kurikulumImporter.js';

// Generate ECDSA P-256 key pair
const { publicKey, privateKey } = await generateAuthorityKeyPair();

// Store publicKey in app distribution
// Store privateKey securely offline (never share!)
console.log('Public Key:', JSON.stringify(publicKey, null, 2));
```

2. **Sign the curriculum data**:

```javascript
import { signKurikulumData } from './app/import/kurikulumImporter.js';

// Your curriculum data from Supabase
const data = { jenjang: [...], tingkat_jenjang: [...], ... };

// Import private key
const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
);

// Sign the data
const signature = await signKurikulumData(data, privateKey);

// Create final package
const kurikulumPackage = {
    meta: {
        version: '1.0',
        issued_by: 'Pusat Kurikulum',
        issued_at: new Date().toISOString().split('T')[0],
        signature: signature,
        public_key_id: 'kurikulum_pusat',
        public_key: publicKeyJwk  // Optional: embed for standalone verification
    },
    data: data
};

// Save as kurikulum-ppg-v1.0.json
```

3. **Distribute public key** to all PPG installations:

```javascript
import { storeKurikulumAuthorityKey } from './app/import/kurikulumImporter.js';

// Run once during app setup or first import
storeKurikulumAuthorityKey(publicKeyJwk);
```

### Usage in App

1. Open PPG app
2. Tap **Kurikulum** menu or **Import Kurikulum Pusat**
3. Select `kurikulum-ppg-vX.Y.json` file
4. Review metadata (version, issuer, date)
5. Tap **Verifikasi & Import**
6. View import summary

### Curriculum Import Module

| File | Purpose |
|------|---------|
| `/app/import/kurikulumImporter.js` | Core import logic, signature verification, database operations |
| `/app/import/kurikulumUI.js` | Import modal UI, file picker, progress display |

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

#### Standard Backup (Unencrypted)
```
backup_file.ppg (ZIP)
├── data.json      # All database records
├── meta.json      # Backup metadata
└── hash.txt       # SHA-256 checksum
```

#### Secure Backup (Encrypted + Signed)
```
backup_file.ppg (ZIP)
├── data.enc           # AES-256-GCM encrypted database
├── encryption.json    # Encryption metadata (IV, checksums)
├── signature.sig      # ECDSA P-256 digital signature
├── meta.json          # Backup metadata (includes security_level)
└── hash.txt           # SHA-256 checksum
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

### Phase 4: Encryption & Security (Completed)

- [x] SQLCipher integration for database encryption
- [x] PIN protection for app access (4-8 digit)
- [x] Secure key storage (PBKDF2 key derivation)
- [x] AES-256-GCM encrypted backup files
- [x] ECDSA P-256 digital signatures
- [x] Hierarchy trust chain validation
- [x] Auto-lock on app background
- [x] PIN lockout after failed attempts
- [ ] Biometric authentication (future enhancement)

### Phase 5: Enhanced Features (Planned)

- [ ] Complete UI for all modules
- [ ] Automatic backup scheduling
- [ ] Backup to local storage/SD card
- [ ] Conflict resolution UI
- [ ] Reports and analytics

### Phase 6: Android APK (Completed)

- [x] Capacitor project setup
- [x] Native SQLite integration (@capacitor-community/sqlite)
- [x] File system access for backup import/export
- [x] Android build configuration
- [ ] Play Store preparation (future)

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

## Android APK Build

PPG can be built as a native Android APK using Capacitor. The app is fully offline and requires no internet connection.

### Prerequisites

1. **Node.js** (v18 or later)
2. **Android Studio** (with Android SDK)
3. **Java JDK** (v17 recommended)

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Sync Capacitor with Android
npx cap sync android

# 3. Build debug APK
cd android && ./gradlew assembleDebug

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

### Building Release APK

For production release:

```bash
# Build release APK (unsigned)
cd android && ./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release-unsigned.apk
```

#### Signing for Play Store

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore ppg-release.keystore -alias ppg -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add to `android/app/build.gradle`:
   ```groovy
   android {
       signingConfigs {
           release {
               storeFile file('ppg-release.keystore')
               storePassword 'your-password'
               keyAlias 'ppg'
               keyPassword 'your-key-password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

3. Build signed APK:
   ```bash
   cd android && ./gradlew assembleRelease
   ```

### Install on Phone

#### Using ADB (Debug Mode)
```bash
# Enable USB debugging on your phone
# Connect phone via USB
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Manual Installation
1. Copy the APK to your phone
2. Enable "Install from unknown sources" in Settings
3. Open the APK file to install

### Development Workflow

```bash
# Make changes to web code in /app directory

# Sync changes to Android
npx cap sync android

# Run on connected device
npx cap run android

# Open in Android Studio (for debugging)
npx cap open android
```

### NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run cap:sync` | Sync web assets to Android |
| `npm run cap:open:android` | Open in Android Studio |
| `npm run android:build` | Build debug APK |
| `npm run android:build:release` | Build release APK |
| `npm run android:run` | Run on connected device |

### Native Features

PPG Android includes these native capabilities:

| Feature | Plugin | Status |
|---------|--------|--------|
| **Native SQLite** | @capacitor-community/sqlite | Active |
| **SQLCipher** | @capacitor-community/sqlite | Active |
| **File System** | @capacitor/filesystem | Active |
| **Splash Screen** | @capacitor/splash-screen | Active |
| **Status Bar** | @capacitor/status-bar | Active |
| **AES-256-GCM** | Web Crypto API | Active |
| **ECDSA Signatures** | Web Crypto API | Active |
| **Biometrics** | @capacitor-community/sqlite | Future |

### Backup Files on Android

PPG saves backup files to `Documents/PPG_Backup/`:
- **Export**: Creates `.ppg` file in Documents/PPG_Backup/
- **Import**: Reads from Documents/PPG_Backup/ or Downloads/

### App Information

| Property | Value |
|----------|-------|
| App ID | com.ppg.offline |
| App Name | PPG Offline |
| Min SDK | 22 (Android 5.1) |
| Target SDK | 34 (Android 14) |
| Web Directory | /app |

### Customizing App Icon

See `/resources/README.md` for instructions on generating app icons.

### Troubleshooting

**Build fails with SDK error:**
- Ensure Android SDK is installed via Android Studio
- Set ANDROID_HOME environment variable

**App crashes on launch:**
- Check logcat: `adb logcat -s "Capacitor"`
- Ensure all plugins are properly synced

**Database not persisting:**
- Native SQLite stores in app's internal storage
- Check file permissions for backup folder

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
