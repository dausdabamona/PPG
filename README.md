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
│   ├── /db             # Database initialization and migrations
│   ├── /backup         # Backup/restore functionality
│   └── /roles          # Role-based access control
├── /android            # Capacitor Android project (future)
├── /schema             # SQL schema files
│   ├── jamaah.sql
│   ├── kelas.sql
│   ├── kehadiran.sql
│   ├── penilaian.sql
│   ├── kelas_mandiri.sql
│   ├── catatan_pembinaan.sql
│   └── rekomendasi_pendidikan.sql
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

### Phase 1: Foundation (Current)

- [x] SQLite schema design with offline-sync fields
- [x] Database initialization (db.js)
- [x] Migration system (migrate.js)
- [x] CRUD services for Jamaah and Kehadiran
- [ ] Basic HTML UI pages
- [ ] Role-based navigation

### Phase 2: Encryption & Security

- [ ] SQLCipher integration for database encryption
- [ ] PIN/password protection for app access
- [ ] Secure key storage
- [ ] Biometric authentication (Capacitor)

### Phase 3: Backup & Restore

- [ ] Export database to encrypted file
- [ ] Import/restore from backup file
- [ ] Automatic backup scheduling
- [ ] Backup to local storage/SD card

### Phase 4: Multi-Device Sync (Optional)

- [ ] Manual file-based sync between devices
- [ ] Conflict resolution strategies
- [ ] Merge algorithms for concurrent edits
- [ ] Sync history and audit log

### Phase 5: Android APK

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
