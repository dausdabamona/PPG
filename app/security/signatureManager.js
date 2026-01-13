/**
 * =============================================================================
 * Digital Signature Manager (signatureManager.js)
 * =============================================================================
 * Handles digital signatures for backup authenticity and non-repudiation.
 *
 * Features:
 * - ECDSA P-256 key pair generation per organizational level
 * - Backup signing with private key
 * - Signature verification with public key
 * - Hierarchical trust chain enforcement
 *
 * Trust Chain:
 * OrangTua -> Mubaligh -> PC -> DPD -> DPW
 * Each level can only verify signatures from the level below.
 *
 * Uses Web Crypto API for production-grade cryptography.
 * =============================================================================
 */

import {
    bytesToHex,
    hexToBytes,
    bytesToBase64,
    base64ToBytes,
    sha256,
    SecureStorage
} from './keyManager.js';

/**
 * Signature configuration
 */
const SIGNATURE_CONFIG = {
    ALGORITHM: 'ECDSA',
    CURVE: 'P-256',
    HASH: 'SHA-256',
    FORMAT_VERSION: 1
};

/**
 * Organizational hierarchy levels
 */
const HIERARCHY_LEVELS = {
    ORANG_TUA: 'orang_tua',
    MUBALIGH: 'mubaligh',
    PC: 'pc',
    DPD: 'dpd',
    DPW: 'dpw'
};

/**
 * Authority levels (non-hierarchical, trusted signers)
 */
const AUTHORITY_LEVELS = {
    KURIKULUM_PUSAT: 'kurikulum_pusat',
    ADMIN_PUSAT: 'admin_pusat'
};

/**
 * Level order for hierarchy validation
 */
const LEVEL_ORDER = [
    HIERARCHY_LEVELS.ORANG_TUA,
    HIERARCHY_LEVELS.MUBALIGH,
    HIERARCHY_LEVELS.PC,
    HIERARCHY_LEVELS.DPD,
    HIERARCHY_LEVELS.DPW
];

// =============================================================================
// Key Generation
// =============================================================================

/**
 * Generate ECDSA P-256 key pair
 * @returns {Promise<object>} { publicKey: CryptoKey, privateKey: CryptoKey }
 */
async function generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: SIGNATURE_CONFIG.ALGORITHM,
            namedCurve: SIGNATURE_CONFIG.CURVE
        },
        true,  // extractable for export
        ['sign', 'verify']
    );

    return keyPair;
}

/**
 * Export public key to JWK format
 * @param {CryptoKey} publicKey - Public key
 * @returns {Promise<object>} JWK format
 */
async function exportPublicKey(publicKey) {
    return crypto.subtle.exportKey('jwk', publicKey);
}

/**
 * Export private key to JWK format (encrypted storage)
 * @param {CryptoKey} privateKey - Private key
 * @returns {Promise<object>} JWK format
 */
async function exportPrivateKey(privateKey) {
    return crypto.subtle.exportKey('jwk', privateKey);
}

/**
 * Import public key from JWK format
 * @param {object} jwk - JWK format public key
 * @returns {Promise<CryptoKey>} Public key
 */
async function importPublicKey(jwk) {
    return crypto.subtle.importKey(
        'jwk',
        jwk,
        {
            name: SIGNATURE_CONFIG.ALGORITHM,
            namedCurve: SIGNATURE_CONFIG.CURVE
        },
        true,
        ['verify']
    );
}

/**
 * Import private key from JWK format
 * @param {object} jwk - JWK format private key
 * @returns {Promise<CryptoKey>} Private key
 */
async function importPrivateKey(jwk) {
    return crypto.subtle.importKey(
        'jwk',
        jwk,
        {
            name: SIGNATURE_CONFIG.ALGORITHM,
            namedCurve: SIGNATURE_CONFIG.CURVE
        },
        true,
        ['sign']
    );
}

// =============================================================================
// Level Key Management
// =============================================================================

/**
 * Generate and store key pair for a specific level
 * @param {string} level - Organizational level
 * @param {string} entityId - Entity identifier (wilayah_id, user_id, etc.)
 * @returns {Promise<object>} { success: boolean, publicKey: object, error: string|null }
 */
async function generateLevelKeyPair(level, entityId) {
    if (!LEVEL_ORDER.includes(level)) {
        return { success: false, publicKey: null, error: 'Invalid level' };
    }

    try {
        console.log(`[SignatureManager] Generating key pair for ${level}:${entityId}`);

        const keyPair = await generateKeyPair();

        // Export keys
        const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
        const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);

        // Store keys
        const keyData = {
            level: level,
            entityId: entityId,
            publicKey: publicKeyJwk,
            privateKey: privateKeyJwk,  // In production, this should be encrypted
            createdAt: new Date().toISOString(),
            version: SIGNATURE_CONFIG.FORMAT_VERSION
        };

        SecureStorage.set(`signing_key_${level}_${entityId}`, keyData);

        console.log(`[SignatureManager] Key pair generated for ${level}`);

        return {
            success: true,
            publicKey: publicKeyJwk,
            error: null
        };
    } catch (error) {
        console.error('[SignatureManager] Key generation failed:', error);
        return { success: false, publicKey: null, error: error.message };
    }
}

/**
 * Get stored key pair for a level
 * @param {string} level - Organizational level
 * @param {string} entityId - Entity identifier
 * @returns {object|null} Key data or null
 */
function getLevelKeyData(level, entityId) {
    return SecureStorage.get(`signing_key_${level}_${entityId}`);
}

/**
 * Get private key for signing
 * @param {string} level - Organizational level
 * @param {string} entityId - Entity identifier
 * @returns {Promise<CryptoKey|null>} Private key or null
 */
async function getPrivateKey(level, entityId) {
    const keyData = getLevelKeyData(level, entityId);
    if (!keyData || !keyData.privateKey) {
        return null;
    }

    try {
        return await importPrivateKey(keyData.privateKey);
    } catch (error) {
        console.error('[SignatureManager] Failed to import private key:', error);
        return null;
    }
}

/**
 * Get public key for verification
 * @param {string} level - Organizational level
 * @param {string} entityId - Entity identifier
 * @returns {Promise<CryptoKey|null>} Public key or null
 */
async function getPublicKey(level, entityId) {
    const keyData = getLevelKeyData(level, entityId);
    if (!keyData || !keyData.publicKey) {
        return null;
    }

    try {
        return await importPublicKey(keyData.publicKey);
    } catch (error) {
        console.error('[SignatureManager] Failed to import public key:', error);
        return null;
    }
}

/**
 * Check if level has signing key
 * @param {string} level - Organizational level
 * @param {string} entityId - Entity identifier
 * @returns {boolean} True if key exists
 */
function hasSigningKey(level, entityId) {
    return getLevelKeyData(level, entityId) !== null;
}

// =============================================================================
// Trusted Public Keys (Upper Levels)
// =============================================================================

/**
 * Store trusted public key from upper level
 * Used for verifying signatures from authorized sources
 * @param {string} level - Source level
 * @param {string} entityId - Entity identifier
 * @param {object} publicKeyJwk - Public key in JWK format
 * @returns {object} { success: boolean, error: string|null }
 */
function storeTrustedPublicKey(level, entityId, publicKeyJwk) {
    try {
        const trustedKeys = SecureStorage.get('trusted_public_keys') || {};

        if (!trustedKeys[level]) {
            trustedKeys[level] = {};
        }

        trustedKeys[level][entityId] = {
            publicKey: publicKeyJwk,
            addedAt: new Date().toISOString()
        };

        SecureStorage.set('trusted_public_keys', trustedKeys);

        console.log(`[SignatureManager] Stored trusted key for ${level}:${entityId}`);
        return { success: true, error: null };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get trusted public key for verification
 * @param {string} level - Source level
 * @param {string} entityId - Entity identifier
 * @returns {Promise<CryptoKey|null>} Public key or null
 */
async function getTrustedPublicKey(level, entityId) {
    const trustedKeys = SecureStorage.get('trusted_public_keys') || {};

    if (!trustedKeys[level] || !trustedKeys[level][entityId]) {
        return null;
    }

    try {
        return await importPublicKey(trustedKeys[level][entityId].publicKey);
    } catch (error) {
        console.error('[SignatureManager] Failed to import trusted key:', error);
        return null;
    }
}

/**
 * List all trusted public keys
 * @returns {object} Map of trusted keys by level
 */
function listTrustedKeys() {
    return SecureStorage.get('trusted_public_keys') || {};
}

// =============================================================================
// Signing Operations
// =============================================================================

/**
 * Sign data with level's private key
 * @param {Uint8Array|string} data - Data to sign
 * @param {string} level - Signer's level
 * @param {string} entityId - Signer's entity ID
 * @returns {Promise<object>} { success: boolean, signature: object, error: string|null }
 */
async function signData(data, level, entityId) {
    const privateKey = await getPrivateKey(level, entityId);

    if (!privateKey) {
        return { success: false, signature: null, error: 'Private key not found' };
    }

    try {
        // Convert data to bytes
        const dataBytes = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : data;

        // Hash the data first
        const dataHash = await sha256(dataBytes);

        // Sign the hash
        const signatureBuffer = await crypto.subtle.sign(
            {
                name: SIGNATURE_CONFIG.ALGORITHM,
                hash: SIGNATURE_CONFIG.HASH
            },
            privateKey,
            dataHash
        );

        const signatureBytes = new Uint8Array(signatureBuffer);

        // Create signature object
        const signature = {
            version: SIGNATURE_CONFIG.FORMAT_VERSION,
            algorithm: SIGNATURE_CONFIG.ALGORITHM,
            curve: SIGNATURE_CONFIG.CURVE,
            hash: SIGNATURE_CONFIG.HASH,
            signerLevel: level,
            signerEntityId: entityId,
            signature: bytesToBase64(signatureBytes),
            dataHash: bytesToHex(dataHash),
            timestamp: new Date().toISOString()
        };

        return { success: true, signature, error: null };
    } catch (error) {
        console.error('[SignatureManager] Signing failed:', error);
        return { success: false, signature: null, error: error.message };
    }
}

/**
 * Sign backup data and create signature file
 * @param {Uint8Array} backupData - Backup data to sign
 * @param {object} metadata - Backup metadata
 * @param {string} level - Signer's level
 * @param {string} entityId - Signer's entity ID
 * @returns {Promise<object>} Signature file content
 */
async function signBackup(backupData, metadata, level, entityId) {
    // Create hash of backup data + metadata
    const metadataString = JSON.stringify(metadata);
    const combinedData = new Uint8Array([
        ...backupData,
        ...new TextEncoder().encode(metadataString)
    ]);

    const result = await signData(combinedData, level, entityId);

    if (!result.success) {
        throw new Error(result.error);
    }

    // Get public key for verification
    const keyData = getLevelKeyData(level, entityId);

    return {
        ...result.signature,
        publicKey: keyData.publicKey,
        metadata: {
            backupSize: backupData.length,
            metadataHash: bytesToHex(await sha256(metadataString))
        }
    };
}

// =============================================================================
// Verification Operations
// =============================================================================

/**
 * Verify signature using public key
 * @param {Uint8Array|string} data - Original data
 * @param {object} signature - Signature object
 * @param {CryptoKey} publicKey - Public key for verification
 * @returns {Promise<boolean>} True if valid
 */
async function verifySignatureWithKey(data, signature, publicKey) {
    try {
        // Convert data to bytes
        const dataBytes = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : data;

        // Hash the data
        const dataHash = await sha256(dataBytes);

        // Verify hash matches
        if (bytesToHex(dataHash) !== signature.dataHash) {
            console.warn('[SignatureManager] Data hash mismatch');
            return false;
        }

        // Decode signature
        const signatureBytes = base64ToBytes(signature.signature);

        // Verify
        const isValid = await crypto.subtle.verify(
            {
                name: SIGNATURE_CONFIG.ALGORITHM,
                hash: SIGNATURE_CONFIG.HASH
            },
            publicKey,
            signatureBytes,
            dataHash
        );

        return isValid;
    } catch (error) {
        console.error('[SignatureManager] Verification error:', error);
        return false;
    }
}

/**
 * Verify signature using stored trusted key
 * @param {Uint8Array|string} data - Original data
 * @param {object} signature - Signature object
 * @returns {Promise<object>} { valid: boolean, error: string|null }
 */
async function verifySignature(data, signature) {
    // Try to get trusted public key
    let publicKey = await getTrustedPublicKey(signature.signerLevel, signature.signerEntityId);

    // If not in trusted keys, try embedded public key
    if (!publicKey && signature.publicKey) {
        try {
            publicKey = await importPublicKey(signature.publicKey);
            console.log('[SignatureManager] Using embedded public key');
        } catch (error) {
            return { valid: false, error: 'Cannot import embedded public key' };
        }
    }

    if (!publicKey) {
        return { valid: false, error: 'Public key not found for signer' };
    }

    const isValid = await verifySignatureWithKey(data, signature, publicKey);

    return {
        valid: isValid,
        error: isValid ? null : 'Signature verification failed'
    };
}

/**
 * Verify backup signature
 * @param {Uint8Array} backupData - Backup data
 * @param {object} metadata - Backup metadata
 * @param {object} signatureFile - Signature file content
 * @returns {Promise<object>} { valid: boolean, signerLevel: string, error: string|null }
 */
async function verifyBackupSignature(backupData, metadata, signatureFile) {
    // Recreate combined data
    const metadataString = JSON.stringify(metadata);
    const combinedData = new Uint8Array([
        ...backupData,
        ...new TextEncoder().encode(metadataString)
    ]);

    // Verify metadata hash
    const metadataHash = bytesToHex(await sha256(metadataString));
    if (metadataHash !== signatureFile.metadata.metadataHash) {
        return { valid: false, signerLevel: null, error: 'Metadata hash mismatch' };
    }

    // Verify signature
    const result = await verifySignature(combinedData, signatureFile);

    return {
        valid: result.valid,
        signerLevel: result.valid ? signatureFile.signerLevel : null,
        signerEntityId: result.valid ? signatureFile.signerEntityId : null,
        error: result.error
    };
}

// =============================================================================
// Hierarchy Trust Chain
// =============================================================================

/**
 * Validate that import is from allowed level
 * @param {string} importerLevel - Level of the importer
 * @param {string} signerLevel - Level of the signer/exporter
 * @returns {object} { valid: boolean, error: string|null }
 */
function validateHierarchyTrust(importerLevel, signerLevel) {
    const importerIndex = LEVEL_ORDER.indexOf(importerLevel);
    const signerIndex = LEVEL_ORDER.indexOf(signerLevel);

    if (importerIndex === -1) {
        return { valid: false, error: `Invalid importer level: ${importerLevel}` };
    }

    if (signerIndex === -1) {
        return { valid: false, error: `Invalid signer level: ${signerLevel}` };
    }

    // Importer must be one level above signer
    // e.g., Mubaligh (index 1) can import from OrangTua (index 0)
    if (importerIndex !== signerIndex + 1) {
        const expectedLevel = LEVEL_ORDER[importerIndex - 1] || 'none';
        return {
            valid: false,
            error: `Level ${importerLevel} hanya dapat mengimpor dari ${expectedLevel}, bukan ${signerLevel}`
        };
    }

    return { valid: true, error: null };
}

/**
 * Get level name in Indonesian
 * @param {string} level - Level code
 * @returns {string} Level name
 */
function getLevelName(level) {
    const names = {
        [HIERARCHY_LEVELS.ORANG_TUA]: 'Orang Tua',
        [HIERARCHY_LEVELS.MUBALIGH]: 'Mubaligh',
        [HIERARCHY_LEVELS.PC]: 'Pimpinan Cabang (PC)',
        [HIERARCHY_LEVELS.DPD]: 'Dewan Pimpinan Daerah (DPD)',
        [HIERARCHY_LEVELS.DPW]: 'Dewan Pimpinan Wilayah (DPW)'
    };
    return names[level] || level;
}

/**
 * Get target level (who receives from this level)
 * @param {string} level - Source level
 * @returns {string|null} Target level or null
 */
function getTargetLevel(level) {
    const index = LEVEL_ORDER.indexOf(level);
    if (index === -1 || index >= LEVEL_ORDER.length - 1) {
        return null;
    }
    return LEVEL_ORDER[index + 1];
}

/**
 * Get source level (who sends to this level)
 * @param {string} level - Target level
 * @returns {string|null} Source level or null
 */
function getSourceLevel(level) {
    const index = LEVEL_ORDER.indexOf(level);
    if (index <= 0) {
        return null;
    }
    return LEVEL_ORDER[index - 1];
}

// =============================================================================
// Export Module
// =============================================================================

const SignatureManager = {
    // Configuration
    SIGNATURE_CONFIG,
    HIERARCHY_LEVELS,
    AUTHORITY_LEVELS,
    LEVEL_ORDER,

    // Key generation
    generateKeyPair,
    exportPublicKey,
    exportPrivateKey,
    importPublicKey,
    importPrivateKey,

    // Level key management
    generateLevelKeyPair,
    getLevelKeyData,
    getPrivateKey,
    getPublicKey,
    hasSigningKey,

    // Trusted keys
    storeTrustedPublicKey,
    getTrustedPublicKey,
    listTrustedKeys,

    // Signing
    signData,
    signBackup,

    // Verification
    verifySignature,
    verifySignatureWithKey,
    verifyBackupSignature,

    // Hierarchy
    validateHierarchyTrust,
    getLevelName,
    getTargetLevel,
    getSourceLevel
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SignatureManager;
}

// Global export
if (typeof window !== 'undefined') {
    window.SignatureManager = SignatureManager;
}

export default SignatureManager;
export {
    SIGNATURE_CONFIG,
    HIERARCHY_LEVELS,
    AUTHORITY_LEVELS,
    LEVEL_ORDER,
    generateKeyPair,
    generateLevelKeyPair,
    hasSigningKey,
    signData,
    signBackup,
    verifySignature,
    verifyBackupSignature,
    validateHierarchyTrust,
    storeTrustedPublicKey,
    getTrustedPublicKey,
    importPublicKey,
    exportPublicKey,
    getLevelName,
    getTargetLevel,
    getSourceLevel
};
