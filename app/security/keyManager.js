/**
 * =============================================================================
 * Key Management Module (keyManager.js)
 * =============================================================================
 * Handles PIN management, key derivation, and secure storage for PPG.
 *
 * Security Model:
 * - User PIN: Personal authentication factor
 * - Wilayah Master Key: Regional/organizational key
 * - Device Salt: Unique per-device randomness
 * - Derived Key: Combined key for database encryption
 *
 * All sensitive data is stored as salted hashes, never in plain text.
 * Uses Web Crypto API for production-grade cryptography.
 * =============================================================================
 */

/**
 * Constants for cryptographic operations
 */
const CRYPTO_CONFIG = {
    // PBKDF2 settings
    PBKDF2_ITERATIONS: 100000,  // High iteration count for security
    PBKDF2_HASH: 'SHA-256',

    // Key sizes
    SALT_LENGTH: 32,           // 256 bits
    DERIVED_KEY_LENGTH: 32,    // 256 bits for AES-256

    // Storage keys
    STORAGE_PREFIX: 'ppg_security_',

    // PIN constraints
    MIN_PIN_LENGTH: 4,
    MAX_PIN_LENGTH: 8,
};

/**
 * Storage abstraction for security data
 * Uses localStorage with fallback
 */
const SecureStorage = {
    set(key, value) {
        const fullKey = CRYPTO_CONFIG.STORAGE_PREFIX + key;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(fullKey, JSON.stringify(value));
        }
    },

    get(key) {
        const fullKey = CRYPTO_CONFIG.STORAGE_PREFIX + key;
        if (typeof localStorage !== 'undefined') {
            const value = localStorage.getItem(fullKey);
            return value ? JSON.parse(value) : null;
        }
        return null;
    },

    remove(key) {
        const fullKey = CRYPTO_CONFIG.STORAGE_PREFIX + key;
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(fullKey);
        }
    },

    clear() {
        if (typeof localStorage !== 'undefined') {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(CRYPTO_CONFIG.STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
    }
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate cryptographically secure random bytes
 * @param {number} length - Number of bytes
 * @returns {Uint8Array} Random bytes
 */
function generateRandomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes - Byte array
 * @returns {string} Hex string
 */
function bytesToHex(bytes) {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Convert hex string to Uint8Array
 * @param {string} hex - Hex string
 * @returns {Uint8Array} Byte array
 */
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Convert string to Uint8Array (UTF-8)
 * @param {string} str - Input string
 * @returns {Uint8Array} Byte array
 */
function stringToBytes(str) {
    return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to Base64
 * @param {Uint8Array} bytes - Byte array
 * @returns {string} Base64 string
 */
function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 to Uint8Array
 * @param {string} base64 - Base64 string
 * @returns {Uint8Array} Byte array
 */
function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Concatenate multiple Uint8Arrays
 * @param {...Uint8Array} arrays - Arrays to concatenate
 * @returns {Uint8Array} Combined array
 */
function concatBytes(...arrays) {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// =============================================================================
// Core Cryptographic Functions
// =============================================================================

/**
 * Hash data using SHA-256
 * @param {Uint8Array|string} data - Data to hash
 * @returns {Promise<Uint8Array>} Hash result
 */
async function sha256(data) {
    const bytes = typeof data === 'string' ? stringToBytes(data) : data;
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return new Uint8Array(hashBuffer);
}

/**
 * Derive key using PBKDF2
 * @param {string} password - Password/PIN
 * @param {Uint8Array} salt - Salt bytes
 * @param {number} iterations - Iteration count
 * @param {number} keyLength - Output key length in bytes
 * @returns {Promise<Uint8Array>} Derived key
 */
async function pbkdf2(password, salt, iterations = CRYPTO_CONFIG.PBKDF2_ITERATIONS, keyLength = CRYPTO_CONFIG.DERIVED_KEY_LENGTH) {
    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        stringToBytes(password),
        'PBKDF2',
        false,
        ['deriveBits']
    );

    // Derive bits
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: CRYPTO_CONFIG.PBKDF2_HASH
        },
        keyMaterial,
        keyLength * 8  // bits
    );

    return new Uint8Array(derivedBits);
}

/**
 * Create salted hash of a value (for PIN storage)
 * @param {string} value - Value to hash
 * @param {Uint8Array} salt - Salt (optional, will generate if not provided)
 * @returns {Promise<object>} { hash: hex, salt: hex }
 */
async function createSaltedHash(value, salt = null) {
    if (!salt) {
        salt = generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);
    }

    // Use PBKDF2 for PIN hashing (more secure than simple SHA-256)
    const hash = await pbkdf2(value, salt, CRYPTO_CONFIG.PBKDF2_ITERATIONS, 32);

    return {
        hash: bytesToHex(hash),
        salt: bytesToHex(salt)
    };
}

/**
 * Verify a value against its salted hash
 * @param {string} value - Value to verify
 * @param {string} storedHash - Stored hash (hex)
 * @param {string} storedSalt - Stored salt (hex)
 * @returns {Promise<boolean>} True if match
 */
async function verifySaltedHash(value, storedHash, storedSalt) {
    const salt = hexToBytes(storedSalt);
    const computed = await pbkdf2(value, salt, CRYPTO_CONFIG.PBKDF2_ITERATIONS, 32);
    const computedHex = bytesToHex(computed);

    // Constant-time comparison to prevent timing attacks
    if (computedHex.length !== storedHash.length) {
        return false;
    }

    let result = 0;
    for (let i = 0; i < computedHex.length; i++) {
        result |= computedHex.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return result === 0;
}

// =============================================================================
// Device Salt Management
// =============================================================================

/**
 * Get or create device-specific salt
 * @returns {Uint8Array} Device salt
 */
function getDeviceSalt() {
    let saltHex = SecureStorage.get('device_salt');

    if (!saltHex) {
        const salt = generateRandomBytes(CRYPTO_CONFIG.SALT_LENGTH);
        saltHex = bytesToHex(salt);
        SecureStorage.set('device_salt', saltHex);
        console.log('[KeyManager] Generated new device salt');
    }

    return hexToBytes(saltHex);
}

/**
 * Export device salt (for backup/recovery)
 * @returns {string} Device salt as hex
 */
function exportDeviceSalt() {
    const saltHex = SecureStorage.get('device_salt');
    return saltHex || null;
}

/**
 * Import device salt (for restore)
 * @param {string} saltHex - Device salt as hex
 */
function importDeviceSalt(saltHex) {
    if (saltHex && saltHex.length === CRYPTO_CONFIG.SALT_LENGTH * 2) {
        SecureStorage.set('device_salt', saltHex);
        console.log('[KeyManager] Imported device salt');
    } else {
        throw new Error('Invalid device salt format');
    }
}

// =============================================================================
// PIN Management
// =============================================================================

/**
 * Validate PIN format
 * @param {string} pin - PIN to validate
 * @returns {object} { valid: boolean, error: string|null }
 */
function validatePIN(pin) {
    if (!pin || typeof pin !== 'string') {
        return { valid: false, error: 'PIN harus diisi' };
    }

    if (pin.length < CRYPTO_CONFIG.MIN_PIN_LENGTH) {
        return { valid: false, error: `PIN minimal ${CRYPTO_CONFIG.MIN_PIN_LENGTH} digit` };
    }

    if (pin.length > CRYPTO_CONFIG.MAX_PIN_LENGTH) {
        return { valid: false, error: `PIN maksimal ${CRYPTO_CONFIG.MAX_PIN_LENGTH} digit` };
    }

    if (!/^\d+$/.test(pin)) {
        return { valid: false, error: 'PIN hanya boleh berisi angka' };
    }

    // Check for weak PINs
    const weakPatterns = ['1234', '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999'];
    if (weakPatterns.some(p => pin.includes(p))) {
        return { valid: false, error: 'PIN terlalu mudah ditebak' };
    }

    return { valid: true, error: null };
}

/**
 * Set user PIN
 * @param {string} userId - User identifier
 * @param {string} pin - New PIN
 * @returns {Promise<object>} Result { success: boolean, error: string|null }
 */
async function setUserPIN(userId, pin) {
    console.log('[KeyManager] Setting PIN for user:', userId);

    // Validate PIN
    const validation = validatePIN(pin);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    try {
        // Create salted hash
        const { hash, salt } = await createSaltedHash(pin);

        // Store PIN data
        const pinData = {
            hash: hash,
            salt: salt,
            createdAt: new Date().toISOString(),
            version: 1
        };

        SecureStorage.set(`pin_${userId}`, pinData);
        console.log('[KeyManager] PIN set successfully');

        return { success: true, error: null };
    } catch (error) {
        console.error('[KeyManager] Failed to set PIN:', error);
        return { success: false, error: 'Gagal menyimpan PIN' };
    }
}

/**
 * Verify user PIN
 * @param {string} userId - User identifier
 * @param {string} pin - PIN to verify
 * @returns {Promise<object>} Result { success: boolean, error: string|null }
 */
async function verifyPIN(userId, pin) {
    console.log('[KeyManager] Verifying PIN for user:', userId);

    const pinData = SecureStorage.get(`pin_${userId}`);

    if (!pinData) {
        return { success: false, error: 'PIN belum diatur' };
    }

    try {
        const isValid = await verifySaltedHash(pin, pinData.hash, pinData.salt);

        if (isValid) {
            console.log('[KeyManager] PIN verified successfully');
            return { success: true, error: null };
        } else {
            console.log('[KeyManager] PIN verification failed');
            return { success: false, error: 'PIN salah' };
        }
    } catch (error) {
        console.error('[KeyManager] PIN verification error:', error);
        return { success: false, error: 'Gagal memverifikasi PIN' };
    }
}

/**
 * Check if user has PIN set
 * @param {string} userId - User identifier
 * @returns {boolean} True if PIN is set
 */
function hasPIN(userId) {
    return SecureStorage.get(`pin_${userId}`) !== null;
}

/**
 * Change user PIN
 * @param {string} userId - User identifier
 * @param {string} currentPin - Current PIN
 * @param {string} newPin - New PIN
 * @returns {Promise<object>} Result { success: boolean, error: string|null }
 */
async function changePIN(userId, currentPin, newPin) {
    // Verify current PIN first
    const verifyResult = await verifyPIN(userId, currentPin);
    if (!verifyResult.success) {
        return { success: false, error: 'PIN lama salah' };
    }

    // Set new PIN
    return setUserPIN(userId, newPin);
}

/**
 * Remove user PIN (reset)
 * @param {string} userId - User identifier
 */
function removePIN(userId) {
    SecureStorage.remove(`pin_${userId}`);
    console.log('[KeyManager] PIN removed for user:', userId);
}

// =============================================================================
// Wilayah Key Management
// =============================================================================

/**
 * Set wilayah (regional) master key
 * @param {string} wilayahId - Wilayah identifier
 * @param {string} masterKey - Master key (will be hashed)
 * @returns {Promise<object>} Result { success: boolean, error: string|null }
 */
async function setWilayahKey(wilayahId, masterKey) {
    console.log('[KeyManager] Setting wilayah key:', wilayahId);

    if (!masterKey || masterKey.length < 8) {
        return { success: false, error: 'Master key minimal 8 karakter' };
    }

    try {
        // Create salted hash of the master key
        const { hash, salt } = await createSaltedHash(masterKey);

        // Also derive a key that can be used for encryption
        const derivedKey = await pbkdf2(masterKey, hexToBytes(salt));

        const keyData = {
            hash: hash,
            salt: salt,
            derivedKeyHash: bytesToHex(await sha256(derivedKey)),
            wilayahId: wilayahId,
            createdAt: new Date().toISOString(),
            version: 1
        };

        SecureStorage.set(`wilayah_key_${wilayahId}`, keyData);

        // Store the derived key temporarily in memory (not in storage)
        // This will be used for key derivation
        _wilayahKeyCache[wilayahId] = {
            key: derivedKey,
            timestamp: Date.now()
        };

        console.log('[KeyManager] Wilayah key set successfully');
        return { success: true, error: null };
    } catch (error) {
        console.error('[KeyManager] Failed to set wilayah key:', error);
        return { success: false, error: 'Gagal menyimpan master key' };
    }
}

/**
 * Verify and load wilayah key into memory
 * @param {string} wilayahId - Wilayah identifier
 * @param {string} masterKey - Master key to verify
 * @returns {Promise<object>} Result { success: boolean, key: Uint8Array|null, error: string|null }
 */
async function loadWilayahKey(wilayahId, masterKey) {
    const keyData = SecureStorage.get(`wilayah_key_${wilayahId}`);

    if (!keyData) {
        return { success: false, key: null, error: 'Wilayah key belum diatur' };
    }

    try {
        // Verify the master key
        const isValid = await verifySaltedHash(masterKey, keyData.hash, keyData.salt);

        if (!isValid) {
            return { success: false, key: null, error: 'Master key salah' };
        }

        // Derive the key
        const derivedKey = await pbkdf2(masterKey, hexToBytes(keyData.salt));

        // Cache in memory
        _wilayahKeyCache[wilayahId] = {
            key: derivedKey,
            timestamp: Date.now()
        };

        return { success: true, key: derivedKey, error: null };
    } catch (error) {
        console.error('[KeyManager] Failed to load wilayah key:', error);
        return { success: false, key: null, error: 'Gagal memuat master key' };
    }
}

/**
 * Get cached wilayah key (from memory)
 * @param {string} wilayahId - Wilayah identifier
 * @returns {Uint8Array|null} Derived key or null
 */
function getCachedWilayahKey(wilayahId) {
    const cached = _wilayahKeyCache[wilayahId];
    if (cached) {
        // Check if cache is still valid (1 hour)
        if (Date.now() - cached.timestamp < 3600000) {
            return cached.key;
        }
        // Expired, remove from cache
        delete _wilayahKeyCache[wilayahId];
    }
    return null;
}

/**
 * Check if wilayah key is set
 * @param {string} wilayahId - Wilayah identifier
 * @returns {boolean} True if key is set
 */
function hasWilayahKey(wilayahId) {
    return SecureStorage.get(`wilayah_key_${wilayahId}`) !== null;
}

// In-memory cache for wilayah keys (never persisted to storage)
const _wilayahKeyCache = {};

// =============================================================================
// Database Key Derivation
// =============================================================================

/**
 * Derive database encryption key
 * Combines: user_pin + wilayah_key + device_salt
 * @param {string} userPin - User's PIN
 * @param {Uint8Array} wilayahKey - Wilayah derived key
 * @param {Uint8Array} deviceSalt - Device-specific salt (optional)
 * @returns {Promise<Uint8Array>} 256-bit encryption key
 */
async function deriveDBKey(userPin, wilayahKey, deviceSalt = null) {
    if (!deviceSalt) {
        deviceSalt = getDeviceSalt();
    }

    // Combine all inputs
    const pinBytes = stringToBytes(userPin);
    const combined = concatBytes(pinBytes, wilayahKey, deviceSalt);

    // Use PBKDF2 for final key derivation
    const finalSalt = await sha256(concatBytes(deviceSalt, wilayahKey));
    const dbKey = await pbkdf2(
        bytesToHex(combined),
        finalSalt,
        CRYPTO_CONFIG.PBKDF2_ITERATIONS,
        CRYPTO_CONFIG.DERIVED_KEY_LENGTH
    );

    console.log('[KeyManager] Database key derived');
    return dbKey;
}

/**
 * Derive database key with simplified inputs
 * @param {string} userId - User identifier
 * @param {string} userPin - User's PIN
 * @param {string} wilayahId - Wilayah identifier
 * @param {string} wilayahMasterKey - Wilayah master key
 * @returns {Promise<object>} { success: boolean, key: Uint8Array|null, error: string|null }
 */
async function deriveDBKeyFull(userId, userPin, wilayahId, wilayahMasterKey) {
    try {
        // Verify PIN
        const pinResult = await verifyPIN(userId, userPin);
        if (!pinResult.success) {
            return { success: false, key: null, error: pinResult.error };
        }

        // Load/verify wilayah key
        const keyResult = await loadWilayahKey(wilayahId, wilayahMasterKey);
        if (!keyResult.success) {
            return { success: false, key: null, error: keyResult.error };
        }

        // Derive final key
        const dbKey = await deriveDBKey(userPin, keyResult.key);

        return { success: true, key: dbKey, error: null };
    } catch (error) {
        console.error('[KeyManager] Failed to derive DB key:', error);
        return { success: false, key: null, error: 'Gagal membuat kunci database' };
    }
}

/**
 * Quick derive for unlocking (PIN + cached wilayah key)
 * @param {string} userId - User identifier
 * @param {string} userPin - User's PIN
 * @param {string} wilayahId - Wilayah identifier
 * @returns {Promise<object>} { success: boolean, key: Uint8Array|null, error: string|null }
 */
async function deriveDBKeyQuick(userId, userPin, wilayahId) {
    try {
        // Verify PIN
        const pinResult = await verifyPIN(userId, userPin);
        if (!pinResult.success) {
            return { success: false, key: null, error: pinResult.error };
        }

        // Get cached wilayah key
        const wilayahKey = getCachedWilayahKey(wilayahId);
        if (!wilayahKey) {
            return { success: false, key: null, error: 'Wilayah key tidak tersedia. Silakan login ulang.' };
        }

        // Derive final key
        const dbKey = await deriveDBKey(userPin, wilayahKey);

        return { success: true, key: dbKey, error: null };
    } catch (error) {
        console.error('[KeyManager] Failed to derive DB key:', error);
        return { success: false, key: null, error: 'Gagal membuat kunci database' };
    }
}

// =============================================================================
// Key Export/Import for Backup
// =============================================================================

/**
 * Export key metadata for backup (no actual keys!)
 * @param {string} wilayahId - Wilayah identifier
 * @returns {object} Key metadata
 */
function exportKeyMetadata(wilayahId) {
    const keyData = SecureStorage.get(`wilayah_key_${wilayahId}`);

    return {
        wilayahId: wilayahId,
        keyVersion: keyData ? keyData.version : null,
        hasKey: keyData !== null,
        deviceSaltHash: bytesToHex(sha256(getDeviceSalt())).substring(0, 16),
        exportedAt: new Date().toISOString()
    };
}

/**
 * Get security info for current session
 * @param {string} userId - User identifier
 * @param {string} wilayahId - Wilayah identifier
 * @returns {object} Security status
 */
function getSecurityStatus(userId, wilayahId) {
    return {
        hasPIN: hasPIN(userId),
        hasWilayahKey: hasWilayahKey(wilayahId),
        wilayahKeyLoaded: getCachedWilayahKey(wilayahId) !== null,
        deviceSaltExists: SecureStorage.get('device_salt') !== null,
        securityLevel: calculateSecurityLevel(userId, wilayahId)
    };
}

/**
 * Calculate security level based on configuration
 * @param {string} userId - User identifier
 * @param {string} wilayahId - Wilayah identifier
 * @returns {string} Security level: 'none', 'basic', 'standard', 'high'
 */
function calculateSecurityLevel(userId, wilayahId) {
    const hasPinSet = hasPIN(userId);
    const hasWilayah = hasWilayahKey(wilayahId);
    const hasDevice = SecureStorage.get('device_salt') !== null;

    if (hasPinSet && hasWilayah && hasDevice) {
        return 'high';
    } else if (hasPinSet && hasWilayah) {
        return 'standard';
    } else if (hasPinSet) {
        return 'basic';
    }
    return 'none';
}

// =============================================================================
// Cleanup and Session Management
// =============================================================================

/**
 * Clear all cached keys from memory (on app background/lock)
 */
function clearKeyCache() {
    for (const key of Object.keys(_wilayahKeyCache)) {
        // Securely clear the key data
        if (_wilayahKeyCache[key].key) {
            _wilayahKeyCache[key].key.fill(0);
        }
        delete _wilayahKeyCache[key];
    }
    console.log('[KeyManager] Key cache cleared');
}

/**
 * Clear all security data (factory reset)
 */
function clearAllSecurityData() {
    clearKeyCache();
    SecureStorage.clear();
    console.log('[KeyManager] All security data cleared');
}

// =============================================================================
// Export Module
// =============================================================================

const KeyManager = {
    // Configuration
    CRYPTO_CONFIG,

    // Utilities
    generateRandomBytes,
    bytesToHex,
    hexToBytes,
    stringToBytes,
    bytesToBase64,
    base64ToBytes,
    sha256,
    pbkdf2,

    // Device salt
    getDeviceSalt,
    exportDeviceSalt,
    importDeviceSalt,

    // PIN management
    validatePIN,
    setUserPIN,
    verifyPIN,
    hasPIN,
    changePIN,
    removePIN,

    // Wilayah key management
    setWilayahKey,
    loadWilayahKey,
    getCachedWilayahKey,
    hasWilayahKey,

    // Key derivation
    deriveDBKey,
    deriveDBKeyFull,
    deriveDBKeyQuick,

    // Export/status
    exportKeyMetadata,
    getSecurityStatus,
    calculateSecurityLevel,

    // Cleanup
    clearKeyCache,
    clearAllSecurityData,

    // Storage (for advanced use)
    SecureStorage
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyManager;
}

// Global export
if (typeof window !== 'undefined') {
    window.KeyManager = KeyManager;
}

export default KeyManager;
export {
    CRYPTO_CONFIG,
    generateRandomBytes,
    bytesToHex,
    hexToBytes,
    sha256,
    pbkdf2,
    getDeviceSalt,
    setUserPIN,
    verifyPIN,
    hasPIN,
    changePIN,
    setWilayahKey,
    loadWilayahKey,
    hasWilayahKey,
    deriveDBKey,
    deriveDBKeyFull,
    deriveDBKeyQuick,
    getSecurityStatus,
    clearKeyCache,
    clearAllSecurityData
};
