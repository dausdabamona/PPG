/**
 * =============================================================================
 * Cryptographic Utilities Module (cryptoUtils.js)
 * =============================================================================
 * Provides AES-256-GCM encryption/decryption and utility functions for PPG.
 *
 * Features:
 * - AES-256-GCM authenticated encryption
 * - Secure random IV generation
 * - Data integrity verification via GCM tag
 * - Binary and text data support
 *
 * Uses Web Crypto API for production-grade cryptography.
 * =============================================================================
 */

import {
    generateRandomBytes,
    bytesToHex,
    hexToBytes,
    bytesToBase64,
    base64ToBytes,
    sha256
} from './keyManager.js';

/**
 * Cryptographic constants
 */
const CRYPTO_CONSTANTS = {
    // AES-GCM settings
    AES_KEY_LENGTH: 256,       // bits
    AES_IV_LENGTH: 12,         // bytes (96 bits recommended for GCM)
    AES_TAG_LENGTH: 128,       // bits

    // Format markers
    FORMAT_VERSION: 1,
    MAGIC_BYTES: new Uint8Array([0x50, 0x50, 0x47, 0x45]),  // "PPGE" (PPG Encrypted)
};

// =============================================================================
// AES-256-GCM Encryption
// =============================================================================

/**
 * Import raw key bytes as CryptoKey for AES-GCM
 * @param {Uint8Array} keyBytes - 32-byte key
 * @returns {Promise<CryptoKey>} AES-GCM key
 */
async function importAESKey(keyBytes) {
    if (keyBytes.length !== 32) {
        throw new Error(`Invalid key length: expected 32 bytes, got ${keyBytes.length}`);
    }

    return crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM', length: CRYPTO_CONSTANTS.AES_KEY_LENGTH },
        false,  // not extractable
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt data using AES-256-GCM
 * @param {Uint8Array|string} data - Data to encrypt
 * @param {Uint8Array} keyBytes - 32-byte encryption key
 * @param {Uint8Array} additionalData - Optional AAD (Additional Authenticated Data)
 * @returns {Promise<object>} { ciphertext: Uint8Array, iv: Uint8Array, tag: included in ciphertext }
 */
async function encryptAES256GCM(data, keyBytes, additionalData = null) {
    // Convert string to bytes if needed
    const plaintext = typeof data === 'string'
        ? new TextEncoder().encode(data)
        : data;

    // Generate random IV
    const iv = generateRandomBytes(CRYPTO_CONSTANTS.AES_IV_LENGTH);

    // Import key
    const cryptoKey = await importAESKey(keyBytes);

    // Encrypt
    const encryptParams = {
        name: 'AES-GCM',
        iv: iv,
        tagLength: CRYPTO_CONSTANTS.AES_TAG_LENGTH
    };

    if (additionalData) {
        encryptParams.additionalData = additionalData;
    }

    const ciphertext = await crypto.subtle.encrypt(
        encryptParams,
        cryptoKey,
        plaintext
    );

    return {
        ciphertext: new Uint8Array(ciphertext),
        iv: iv
    };
}

/**
 * Decrypt data using AES-256-GCM
 * @param {Uint8Array} ciphertext - Encrypted data (includes GCM tag)
 * @param {Uint8Array} keyBytes - 32-byte encryption key
 * @param {Uint8Array} iv - Initialization vector
 * @param {Uint8Array} additionalData - Optional AAD (must match encryption)
 * @returns {Promise<Uint8Array>} Decrypted data
 */
async function decryptAES256GCM(ciphertext, keyBytes, iv, additionalData = null) {
    // Import key
    const cryptoKey = await importAESKey(keyBytes);

    // Decrypt
    const decryptParams = {
        name: 'AES-GCM',
        iv: iv,
        tagLength: CRYPTO_CONSTANTS.AES_TAG_LENGTH
    };

    if (additionalData) {
        decryptParams.additionalData = additionalData;
    }

    try {
        const plaintext = await crypto.subtle.decrypt(
            decryptParams,
            cryptoKey,
            ciphertext
        );

        return new Uint8Array(plaintext);
    } catch (error) {
        // GCM authentication failed - data was tampered with
        throw new Error('Decryption failed: data integrity check failed');
    }
}

// =============================================================================
// Encrypted Data Format
// =============================================================================

/**
 * Pack encrypted data into a portable format
 * Format: MAGIC(4) | VERSION(1) | IV_LENGTH(1) | IV(12) | CIPHERTEXT(...)
 * @param {Uint8Array} ciphertext - Encrypted data
 * @param {Uint8Array} iv - Initialization vector
 * @returns {Uint8Array} Packed data
 */
function packEncryptedData(ciphertext, iv) {
    const totalLength = 4 + 1 + 1 + iv.length + ciphertext.length;
    const packed = new Uint8Array(totalLength);

    let offset = 0;

    // Magic bytes
    packed.set(CRYPTO_CONSTANTS.MAGIC_BYTES, offset);
    offset += 4;

    // Version
    packed[offset] = CRYPTO_CONSTANTS.FORMAT_VERSION;
    offset += 1;

    // IV length
    packed[offset] = iv.length;
    offset += 1;

    // IV
    packed.set(iv, offset);
    offset += iv.length;

    // Ciphertext
    packed.set(ciphertext, offset);

    return packed;
}

/**
 * Unpack encrypted data from portable format
 * @param {Uint8Array} packed - Packed encrypted data
 * @returns {object} { ciphertext: Uint8Array, iv: Uint8Array, version: number }
 */
function unpackEncryptedData(packed) {
    let offset = 0;

    // Check magic bytes
    const magic = packed.slice(0, 4);
    if (!arraysEqual(magic, CRYPTO_CONSTANTS.MAGIC_BYTES)) {
        throw new Error('Invalid encrypted data format: wrong magic bytes');
    }
    offset += 4;

    // Version
    const version = packed[offset];
    if (version !== CRYPTO_CONSTANTS.FORMAT_VERSION) {
        throw new Error(`Unsupported format version: ${version}`);
    }
    offset += 1;

    // IV length
    const ivLength = packed[offset];
    offset += 1;

    // IV
    const iv = packed.slice(offset, offset + ivLength);
    offset += ivLength;

    // Ciphertext (rest of data)
    const ciphertext = packed.slice(offset);

    return { ciphertext, iv, version };
}

/**
 * Check if two arrays are equal
 * @param {Uint8Array} a - First array
 * @param {Uint8Array} b - Second array
 * @returns {boolean} True if equal
 */
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// =============================================================================
// High-Level Encryption API
// =============================================================================

/**
 * Encrypt data and pack into portable format
 * @param {Uint8Array|string} data - Data to encrypt
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Promise<Uint8Array>} Packed encrypted data
 */
async function encrypt(data, key) {
    const { ciphertext, iv } = await encryptAES256GCM(data, key);
    return packEncryptedData(ciphertext, iv);
}

/**
 * Unpack and decrypt data
 * @param {Uint8Array} encryptedData - Packed encrypted data
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Promise<Uint8Array>} Decrypted data
 */
async function decrypt(encryptedData, key) {
    const { ciphertext, iv } = unpackEncryptedData(encryptedData);
    return decryptAES256GCM(ciphertext, key, iv);
}

/**
 * Encrypt string to Base64
 * @param {string} plaintext - String to encrypt
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Promise<string>} Base64 encoded encrypted data
 */
async function encryptToBase64(plaintext, key) {
    const encrypted = await encrypt(plaintext, key);
    return bytesToBase64(encrypted);
}

/**
 * Decrypt from Base64 to string
 * @param {string} base64Ciphertext - Base64 encoded encrypted data
 * @param {Uint8Array} key - 32-byte encryption key
 * @returns {Promise<string>} Decrypted string
 */
async function decryptFromBase64(base64Ciphertext, key) {
    const encrypted = base64ToBytes(base64Ciphertext);
    const decrypted = await decrypt(encrypted, key);
    return new TextDecoder().decode(decrypted);
}

// =============================================================================
// File Encryption for Backups
// =============================================================================

/**
 * Encrypt file data for backup
 * @param {Uint8Array} fileData - Raw file data
 * @param {Uint8Array} key - 32-byte encryption key
 * @param {object} metadata - Metadata to include in AAD
 * @returns {Promise<object>} { encryptedData: Uint8Array, checksum: string }
 */
async function encryptBackupData(fileData, key, metadata = {}) {
    // Create AAD from metadata
    const aadString = JSON.stringify({
        timestamp: new Date().toISOString(),
        format: 'ppg_backup',
        ...metadata
    });
    const aad = new TextEncoder().encode(aadString);

    // Encrypt with AAD
    const { ciphertext, iv } = await encryptAES256GCM(fileData, key, aad);

    // Create checksum of encrypted data
    const checksum = bytesToHex(await sha256(ciphertext));

    // Pack with additional header for backup format
    const header = {
        version: CRYPTO_CONSTANTS.FORMAT_VERSION,
        algorithm: 'AES-256-GCM',
        iv: bytesToHex(iv),
        aadHash: bytesToHex(await sha256(aad)),
        checksum: checksum,
        originalSize: fileData.length,
        encryptedSize: ciphertext.length,
        timestamp: new Date().toISOString()
    };

    return {
        encryptedData: ciphertext,
        iv: iv,
        header: header,
        aad: aadString
    };
}

/**
 * Decrypt backup file data
 * @param {Uint8Array} encryptedData - Encrypted file data
 * @param {Uint8Array} key - 32-byte encryption key
 * @param {object} header - Encryption header
 * @param {string} aadString - AAD string used during encryption
 * @returns {Promise<Uint8Array>} Decrypted file data
 */
async function decryptBackupData(encryptedData, key, header, aadString) {
    // Verify checksum
    const checksum = bytesToHex(await sha256(encryptedData));
    if (checksum !== header.checksum) {
        throw new Error('Backup integrity check failed: checksum mismatch');
    }

    // Verify AAD hash
    const aad = new TextEncoder().encode(aadString);
    const aadHash = bytesToHex(await sha256(aad));
    if (aadHash !== header.aadHash) {
        throw new Error('Backup integrity check failed: metadata mismatch');
    }

    // Get IV
    const iv = hexToBytes(header.iv);

    // Decrypt
    const decrypted = await decryptAES256GCM(encryptedData, key, iv, aad);

    // Verify original size
    if (decrypted.length !== header.originalSize) {
        throw new Error('Backup integrity check failed: size mismatch');
    }

    return decrypted;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate secure random string (for tokens, etc.)
 * @param {number} length - Length of string
 * @returns {string} Random hex string
 */
function generateSecureToken(length = 32) {
    const bytes = generateRandomBytes(Math.ceil(length / 2));
    return bytesToHex(bytes).substring(0, length);
}

/**
 * Compute HMAC-SHA256
 * @param {Uint8Array} key - HMAC key
 * @param {Uint8Array} data - Data to authenticate
 * @returns {Promise<Uint8Array>} HMAC result
 */
async function hmacSHA256(key, data) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
    return new Uint8Array(signature);
}

/**
 * Verify HMAC-SHA256
 * @param {Uint8Array} key - HMAC key
 * @param {Uint8Array} data - Data that was authenticated
 * @param {Uint8Array} signature - HMAC to verify
 * @returns {Promise<boolean>} True if valid
 */
async function verifyHMAC(key, data, signature) {
    const computed = await hmacSHA256(key, data);

    // Constant-time comparison
    if (computed.length !== signature.length) return false;

    let result = 0;
    for (let i = 0; i < computed.length; i++) {
        result |= computed[i] ^ signature[i];
    }
    return result === 0;
}

/**
 * Check if Web Crypto API is available
 * @returns {boolean} True if available
 */
function isCryptoAvailable() {
    return typeof crypto !== 'undefined' &&
           typeof crypto.subtle !== 'undefined' &&
           typeof crypto.getRandomValues !== 'undefined';
}

// =============================================================================
// Export Module
// =============================================================================

const CryptoUtils = {
    // Constants
    CRYPTO_CONSTANTS,

    // AES-GCM
    encryptAES256GCM,
    decryptAES256GCM,
    importAESKey,

    // Packed format
    packEncryptedData,
    unpackEncryptedData,

    // High-level API
    encrypt,
    decrypt,
    encryptToBase64,
    decryptFromBase64,

    // Backup encryption
    encryptBackupData,
    decryptBackupData,

    // Utilities
    generateSecureToken,
    hmacSHA256,
    verifyHMAC,
    isCryptoAvailable,
    arraysEqual
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoUtils;
}

// Global export
if (typeof window !== 'undefined') {
    window.CryptoUtils = CryptoUtils;
}

export default CryptoUtils;
export {
    CRYPTO_CONSTANTS,
    encryptAES256GCM,
    decryptAES256GCM,
    encrypt,
    decrypt,
    encryptToBase64,
    decryptFromBase64,
    encryptBackupData,
    decryptBackupData,
    generateSecureToken,
    hmacSHA256,
    verifyHMAC,
    isCryptoAvailable
};
