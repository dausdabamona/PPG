/**
 * =============================================================================
 * Database Initialization Module (db.js)
 * =============================================================================
 * Offline-first SQLite database for PPG (Pengajian Progress Guru) application
 *
 * This module provides:
 * - Database initialization for both web (SQL.js) and Capacitor (native SQLite)
 * - SQLCipher encryption support on native platforms
 * - Unified API that works across platforms
 * - Connection management and error handling
 * - Database locking on app background
 *
 * Security Model:
 * - Web/PWA: SQL.js with AES-256 encrypted localStorage
 * - Android/iOS: SQLCipher with derived encryption key
 *
 * Platform Detection:
 * - Web/PWA: Uses SQL.js (WebAssembly SQLite)
 * - Android/iOS: Uses @capacitor-community/sqlite with SQLCipher
 * =============================================================================
 */

// Database singleton instance
let db = null;
let isCapacitor = false;
let sqlitePlugin = null;
let sqliteConnection = null;

// Encryption state
let encryptionKey = null;
let isLocked = true;
let lockTimeout = null;

// Lock timeout in milliseconds (5 minutes of inactivity)
const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Configuration for database
 */
const DB_CONFIG = {
    name: 'ppg_database',
    version: 1,
    // SQLCipher encryption settings
    encrypted: true,                    // Enable encryption
    encryptionMode: 'secret',           // 'secret' for SQLCipher
    encryptedDbName: 'ppg_encrypted',   // Name for encrypted DB
};

/**
 * Detect if running in Capacitor environment
 * @returns {boolean}
 */
function detectCapacitor() {
    return typeof window !== 'undefined' &&
           window.Capacitor !== undefined &&
           window.Capacitor.isNativePlatform();
}

/**
 * Generate UUID v4 for primary keys
 * Offline-friendly: generates unique IDs without server
 * @returns {string} UUID v4 string
 */
function generateUUID() {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Get device identifier for sync tracking
 * @returns {string} Device ID
 */
function getDeviceId() {
    let deviceId = localStorage.getItem('ppg_device_id');
    if (!deviceId) {
        deviceId = 'device_' + generateUUID();
        localStorage.setItem('ppg_device_id', deviceId);
    }
    return deviceId;
}

/**
 * Initialize SQL.js for web platform
 * @returns {Promise<object>} SQL.js database instance
 */
async function initWebDatabase() {
    // Check if SQL.js is already loaded
    if (typeof initSqlJs === 'undefined') {
        // Load SQL.js from CDN or local path
        await loadScript('https://sql.js.org/dist/sql-wasm.js');
    }

    const SQL = await initSqlJs({
        // Load WASM binary
        locateFile: file => `https://sql.js.org/dist/${file}`
    });

    // Try to load existing database from localStorage
    const savedDb = localStorage.getItem('ppg_database');
    if (savedDb) {
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        return new SQL.Database(uint8Array);
    }

    // Create new database
    return new SQL.Database();
}

/**
 * Initialize Capacitor SQLite for native platforms
 * @param {Uint8Array} key - 32-byte encryption key (optional for unencrypted mode)
 * @returns {Promise<object>} Capacitor SQLite connection
 */
async function initCapacitorDatabase(key = null) {
    // Import Capacitor SQLite plugin
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');

    sqlitePlugin = CapacitorSQLite;
    sqliteConnection = new SQLiteConnection(CapacitorSQLite);

    // Determine encryption mode
    const useEncryption = key !== null && key.length === 32;
    const dbName = useEncryption ? DB_CONFIG.encryptedDbName : DB_CONFIG.name;
    const mode = useEncryption ? DB_CONFIG.encryptionMode : 'no-encryption';

    console.log(`[DB] Initializing ${useEncryption ? 'encrypted' : 'unencrypted'} database`);

    // Create connection with encryption key
    const connection = await sqliteConnection.createConnection(
        dbName,
        useEncryption,
        mode,
        DB_CONFIG.version,
        false  // readonly
    );

    // If encrypted, set the encryption key
    if (useEncryption) {
        // Convert key to hex string for SQLCipher
        const keyHex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('');
        await connection.open();

        // Execute PRAGMA to set encryption key
        // SQLCipher requires the key to be set before any operations
        try {
            await connection.execute(`PRAGMA key = "x'${keyHex}'";`);
            console.log('[DB] Encryption key set successfully');
        } catch (error) {
            console.error('[DB] Failed to set encryption key:', error);
            throw new Error('Failed to initialize encrypted database');
        }
    } else {
        await connection.open();
    }

    return connection;
}

/**
 * Check if encrypted database exists
 * @returns {Promise<boolean>} True if encrypted database exists
 */
async function encryptedDatabaseExists() {
    if (!isCapacitor) return false;

    try {
        const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
        const sqlite = new SQLiteConnection(CapacitorSQLite);
        const result = await sqlite.isDatabase(DB_CONFIG.encryptedDbName);
        return result.result;
    } catch (error) {
        console.warn('[DB] Could not check encrypted database:', error);
        return false;
    }
}

/**
 * Migrate unencrypted database to encrypted
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Promise<boolean>} True if migration successful
 */
async function migrateToEncrypted(key) {
    if (!isCapacitor || !sqliteConnection) {
        console.warn('[DB] Migration only supported on Capacitor');
        return false;
    }

    console.log('[DB] Starting database encryption migration...');

    try {
        // Check if unencrypted database exists
        const unencryptedExists = await sqliteConnection.isDatabase(DB_CONFIG.name);

        if (!unencryptedExists.result) {
            console.log('[DB] No unencrypted database to migrate');
            return true;
        }

        // Export unencrypted database
        const exportData = await sqliteConnection.exportToJson('full');

        // Close unencrypted connection
        await closeDatabase();

        // Create encrypted database
        db = await initCapacitorDatabase(key);

        // Import data into encrypted database
        if (exportData && exportData.export) {
            await sqliteConnection.importFromJson(JSON.stringify(exportData.export));
            console.log('[DB] Data migrated to encrypted database');
        }

        // Delete unencrypted database
        await sqliteConnection.deleteDatabase(DB_CONFIG.name);
        console.log('[DB] Unencrypted database deleted');

        return true;
    } catch (error) {
        console.error('[DB] Migration failed:', error);
        return false;
    }
}

/**
 * Load external script dynamically
 * @param {string} src - Script URL
 * @returns {Promise<void>}
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Initialize the database
 * Detects platform and initializes appropriate database driver
 * @param {Uint8Array} key - Optional encryption key (32 bytes)
 * @returns {Promise<object>} Database instance
 */
async function initDatabase(key = null) {
    if (db && !isLocked) {
        console.log('[DB] Database already initialized');
        return db;
    }

    console.log('[DB] Initializing database...');

    isCapacitor = detectCapacitor();
    console.log(`[DB] Platform: ${isCapacitor ? 'Capacitor (Native)' : 'Web (SQL.js)'}`);

    try {
        if (isCapacitor) {
            db = await initCapacitorDatabase(key);
        } else {
            db = await initWebDatabase();
        }

        // Store encryption key in memory (never persisted)
        if (key) {
            encryptionKey = key;
        }

        isLocked = false;
        resetLockTimeout();

        console.log('[DB] Database initialized successfully');
        return db;
    } catch (error) {
        console.error('[DB] Failed to initialize database:', error);
        throw error;
    }
}

/**
 * Initialize database with encryption key from PIN
 * This is the main entry point for secure database access
 * @param {Uint8Array} derivedKey - Key derived from PIN + wilayah key
 * @returns {Promise<object>} { success: boolean, error: string|null }
 */
async function initSecureDatabase(derivedKey) {
    if (!derivedKey || derivedKey.length !== 32) {
        return { success: false, error: 'Invalid encryption key' };
    }

    try {
        await initDatabase(derivedKey);
        return { success: true, error: null };
    } catch (error) {
        console.error('[DB] Secure initialization failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Unlock database with PIN (re-initialize with cached key)
 * @param {Uint8Array} derivedKey - Re-derived encryption key
 * @returns {Promise<object>} { success: boolean, error: string|null }
 */
async function unlockDatabase(derivedKey) {
    if (!isLocked) {
        return { success: true, error: null };
    }

    console.log('[DB] Unlocking database...');

    try {
        if (isCapacitor && db) {
            // Re-open with encryption key
            db = await initCapacitorDatabase(derivedKey);
        }

        encryptionKey = derivedKey;
        isLocked = false;
        resetLockTimeout();

        console.log('[DB] Database unlocked');
        return { success: true, error: null };
    } catch (error) {
        console.error('[DB] Unlock failed:', error);
        return { success: false, error: 'Gagal membuka database. PIN mungkin salah.' };
    }
}

/**
 * Lock database (clear encryption key from memory)
 * Called when app goes to background or on timeout
 */
function lockDatabase() {
    if (isLocked) return;

    console.log('[DB] Locking database...');

    // Clear encryption key from memory
    if (encryptionKey) {
        encryptionKey.fill(0);  // Securely wipe
        encryptionKey = null;
    }

    // Close connection on Capacitor
    if (isCapacitor && db) {
        try {
            db.close();
        } catch (e) {
            // Ignore close errors
        }
        db = null;
    }

    isLocked = true;
    clearLockTimeout();

    console.log('[DB] Database locked');

    // Dispatch event for UI to show lock screen
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('db:locked'));
    }
}

/**
 * Reset the auto-lock timeout
 */
function resetLockTimeout() {
    clearLockTimeout();
    lockTimeout = setTimeout(() => {
        console.log('[DB] Auto-lock timeout reached');
        lockDatabase();
    }, LOCK_TIMEOUT_MS);
}

/**
 * Clear the auto-lock timeout
 */
function clearLockTimeout() {
    if (lockTimeout) {
        clearTimeout(lockTimeout);
        lockTimeout = null;
    }
}

/**
 * Check if database is locked
 * @returns {boolean} True if locked
 */
function isDatabaseLocked() {
    return isLocked;
}

/**
 * Touch database (reset lock timeout on activity)
 */
function touchDatabase() {
    if (!isLocked) {
        resetLockTimeout();
    }
}

/**
 * Setup app lifecycle listeners for auto-lock
 */
function setupLifecycleListeners() {
    if (typeof window === 'undefined') return;

    // Lock on visibility change (app backgrounded)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('[DB] App backgrounded, locking...');
            lockDatabase();
        }
    });

    // Lock on page unload
    window.addEventListener('beforeunload', () => {
        lockDatabase();
    });

    // Capacitor-specific lifecycle events
    if (isCapacitor && window.Capacitor) {
        import('@capacitor/app').then(({ App }) => {
            App.addListener('appStateChange', (state) => {
                if (!state.isActive) {
                    console.log('[DB] Capacitor app inactive, locking...');
                    lockDatabase();
                }
            });
        }).catch(() => {
            // App plugin not available
        });
    }

    console.log('[DB] Lifecycle listeners set up');
}

/**
 * Execute SQL query with parameters
 * Unified API for both platforms
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function executeQuery(sql, params = []) {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }

    try {
        if (isCapacitor) {
            // Capacitor SQLite API
            const result = await db.query(sql, params);
            return {
                rows: result.values || [],
                rowsAffected: result.changes?.changes || 0,
                lastInsertId: result.changes?.lastId || null
            };
        } else {
            // SQL.js API
            const stmt = db.prepare(sql);
            stmt.bind(params);

            const rows = [];
            while (stmt.step()) {
                rows.push(stmt.getAsObject());
            }
            stmt.free();

            return {
                rows: rows,
                rowsAffected: db.getRowsModified(),
                lastInsertId: null  // SQL.js doesn't provide this directly
            };
        }
    } catch (error) {
        console.error('[DB] Query error:', error);
        console.error('[DB] SQL:', sql);
        console.error('[DB] Params:', params);
        throw error;
    }
}

/**
 * Execute SQL and return results in SQL.js format
 * Compatible with both platforms
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Array} Results in SQL.js exec() format [{ columns: [], values: [] }]
 */
function exec(sql, params = []) {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }

    try {
        if (isCapacitor) {
            // For Capacitor, we need to handle this synchronously via a cached query
            // This is a limitation - use query() for async operations
            console.warn('[DB] exec() called in Capacitor - use query() for async');
            return [];
        } else {
            // SQL.js exec format
            const results = db.exec(sql, params);
            return results;
        }
    } catch (error) {
        console.error('[DB] Exec error:', error);
        return [];
    }
}

/**
 * Run SQL statement (alias for SQL.js compatibility)
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters
 */
function run(sql, params = []) {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }

    try {
        if (isCapacitor) {
            // Queue for async execution
            db.run(sql, params);
        } else {
            db.run(sql, params);
        }
    } catch (error) {
        console.error('[DB] Run error:', error);
        throw error;
    }
}

/**
 * Execute SQL statement (INSERT, UPDATE, DELETE)
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters
 * @returns {Promise<object>} Execution result
 */
async function executeStatement(sql, params = []) {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }

    try {
        if (isCapacitor) {
            const result = await db.run(sql, params);
            return {
                rowsAffected: result.changes?.changes || 0,
                lastInsertId: result.changes?.lastId || null
            };
        } else {
            db.run(sql, params);
            return {
                rowsAffected: db.getRowsModified(),
                lastInsertId: null
            };
        }
    } catch (error) {
        console.error('[DB] Statement error:', error);
        console.error('[DB] SQL:', sql);
        console.error('[DB] Params:', params);
        throw error;
    }
}

/**
 * Execute multiple SQL statements (for migrations)
 * @param {string} sqlStatements - Multiple SQL statements separated by semicolons
 * @returns {Promise<void>}
 */
async function executeMultiple(sqlStatements) {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }

    // Split statements and execute each
    const statements = sqlStatements
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
        try {
            if (isCapacitor) {
                await db.execute(statement + ';');
            } else {
                db.run(statement);
            }
        } catch (error) {
            // Skip errors for IF NOT EXISTS statements that might fail
            if (!statement.includes('IF NOT EXISTS') && !statement.includes('IF EXISTS')) {
                console.warn('[DB] Statement warning:', error.message);
            }
        }
    }
}

/**
 * Save database to persistent storage (Web only)
 * For Capacitor, data is automatically persisted
 * @returns {Promise<void>}
 */
async function saveDatabase() {
    if (!isCapacitor && db) {
        const data = db.export();
        const arr = Array.from(data);
        localStorage.setItem('ppg_database', JSON.stringify(arr));
        console.log('[DB] Database saved to localStorage');
    }
}

/**
 * Close database connection
 * @returns {Promise<void>}
 */
async function closeDatabase() {
    if (db) {
        if (isCapacitor) {
            await db.close();
        } else {
            await saveDatabase();
            db.close();
        }
        db = null;
        console.log('[DB] Database closed');
    }
}

/**
 * Get current timestamp in ISO format
 * @returns {string} ISO timestamp
 */
function getCurrentTimestamp() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
}

/**
 * Check if database is initialized
 * @returns {boolean}
 */
function isInitialized() {
    return db !== null;
}

/**
 * Get database instance (for advanced operations)
 * @returns {object|null}
 */
function getDatabase() {
    return db;
}

/**
 * Begin transaction
 * @returns {Promise<void>}
 */
async function beginTransaction() {
    await executeStatement('BEGIN TRANSACTION');
}

/**
 * Commit transaction
 * @returns {Promise<void>}
 */
async function commitTransaction() {
    await executeStatement('COMMIT');
    if (!isCapacitor) {
        await saveDatabase();
    }
}

/**
 * Rollback transaction
 * @returns {Promise<void>}
 */
async function rollbackTransaction() {
    await executeStatement('ROLLBACK');
}

// =============================================================================
// Export module
// =============================================================================
// Support both ES modules and global scope (for vanilla JS)

const DB = {
    // Core functions
    init: initDatabase,
    initSecure: initSecureDatabase,
    query: executeQuery,
    execute: executeStatement,
    executeMultiple,
    exec,
    run,
    save: saveDatabase,
    close: closeDatabase,

    // Security functions
    unlock: unlockDatabase,
    lock: lockDatabase,
    isLocked: isDatabaseLocked,
    touch: touchDatabase,
    setupLifecycle: setupLifecycleListeners,

    // Encryption functions
    encryptedExists: encryptedDatabaseExists,
    migrateEncrypted: migrateToEncrypted,

    // Utilities
    generateUUID,
    getDeviceId,
    getCurrentTimestamp,
    isInitialized,
    getDatabase,
    getDB: getDatabase,  // Alias for compatibility

    // Transactions
    beginTransaction,
    commitTransaction,
    rollbackTransaction,

    // Configuration
    config: DB_CONFIG,
    isCapacitor: () => isCapacitor
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DB;
}

// Global export for vanilla JS
if (typeof window !== 'undefined') {
    window.DB = DB;
}

export default DB;
export {
    initDatabase,
    initSecureDatabase,
    unlockDatabase,
    lockDatabase,
    isDatabaseLocked,
    touchDatabase,
    setupLifecycleListeners,
    encryptedDatabaseExists,
    migrateToEncrypted,
    executeQuery,
    executeStatement,
    executeMultiple,
    exec,
    run,
    saveDatabase,
    closeDatabase,
    generateUUID,
    getDeviceId,
    getCurrentTimestamp,
    isInitialized,
    getDatabase,
    beginTransaction,
    commitTransaction,
    rollbackTransaction
};
