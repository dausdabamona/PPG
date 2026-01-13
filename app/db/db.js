/**
 * =============================================================================
 * Database Initialization Module (db.js)
 * =============================================================================
 * Offline-first SQLite database for PPG (Pengajian Progress Guru) application
 *
 * This module provides:
 * - Database initialization for both web (SQL.js) and Capacitor (native SQLite)
 * - Unified API that works across platforms
 * - Connection management and error handling
 * - Ready for SQLCipher encryption upgrade
 *
 * Platform Detection:
 * - Web/PWA: Uses SQL.js (WebAssembly SQLite)
 * - Android/iOS: Uses @capacitor-community/sqlite
 * =============================================================================
 */

// Database singleton instance
let db = null;
let isCapacitor = false;
let sqlitePlugin = null;

/**
 * Configuration for database
 */
const DB_CONFIG = {
    name: 'ppg_database',
    version: 1,
    // For future SQLCipher encryption
    encrypted: false,
    encryptionKey: null,  // Will be set when encryption is enabled
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
 * @returns {Promise<object>} Capacitor SQLite connection
 */
async function initCapacitorDatabase() {
    // Import Capacitor SQLite plugin
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');

    sqlitePlugin = CapacitorSQLite;
    const sqlite = new SQLiteConnection(CapacitorSQLite);

    // Create connection
    const connection = await sqlite.createConnection(
        DB_CONFIG.name,
        DB_CONFIG.encrypted,
        'no-encryption',  // Will be changed to 'encryption' when enabled
        DB_CONFIG.version,
        false  // readonly
    );

    await connection.open();
    return connection;
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
 * @returns {Promise<object>} Database instance
 */
async function initDatabase() {
    if (db) {
        console.log('[DB] Database already initialized');
        return db;
    }

    console.log('[DB] Initializing database...');

    isCapacitor = detectCapacitor();
    console.log(`[DB] Platform: ${isCapacitor ? 'Capacitor (Native)' : 'Web (SQL.js)'}`);

    try {
        if (isCapacitor) {
            db = await initCapacitorDatabase();
        } else {
            db = await initWebDatabase();
        }

        console.log('[DB] Database initialized successfully');
        return db;
    } catch (error) {
        console.error('[DB] Failed to initialize database:', error);
        throw error;
    }
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
    init: initDatabase,
    query: executeQuery,
    execute: executeStatement,
    executeMultiple,
    save: saveDatabase,
    close: closeDatabase,
    generateUUID,
    getDeviceId,
    getCurrentTimestamp,
    isInitialized,
    getDatabase,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
    config: DB_CONFIG
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
    executeQuery,
    executeStatement,
    executeMultiple,
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
