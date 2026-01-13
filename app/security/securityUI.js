/**
 * =============================================================================
 * Security UI Module (securityUI.js)
 * =============================================================================
 * Provides UI components for PIN setup, login, and security status display.
 *
 * Components:
 * - PIN Setup Screen (first-time setup)
 * - PIN Login Screen (unlock)
 * - Security Status Badge
 * - Backup Security Info
 *
 * Events:
 * - security:unlocked - Database unlocked successfully
 * - security:locked - Database locked
 * - security:setup-complete - PIN setup completed
 * =============================================================================
 */

import KeyManager from './keyManager.js';
import { generateLevelKeyPair, hasSigningKey } from './signatureManager.js';

/**
 * UI Configuration
 */
const UI_CONFIG = {
    maxAttempts: 5,
    lockoutDuration: 5 * 60 * 1000,  // 5 minutes
    pinLength: 6,
};

// State
let failedAttempts = 0;
let lockoutUntil = null;

// =============================================================================
// PIN Setup Screen
// =============================================================================

/**
 * Show PIN setup screen
 * @param {string} userId - User identifier
 * @param {object} options - Setup options
 * @returns {Promise<object>} Setup result
 */
function showPINSetup(userId, options = {}) {
    return new Promise((resolve) => {
        const overlay = createOverlay();

        const content = document.createElement('div');
        content.className = 'security-dialog';
        content.innerHTML = `
            <div class="security-header">
                <h2>Buat PIN Keamanan</h2>
                <p>PIN digunakan untuk mengamankan data Anda</p>
            </div>

            <div class="pin-setup-form">
                <div class="pin-input-group">
                    <label>PIN Baru (${UI_CONFIG.pinLength} digit)</label>
                    <input type="password"
                           id="pin-new"
                           inputmode="numeric"
                           pattern="[0-9]*"
                           maxlength="${UI_CONFIG.pinLength}"
                           placeholder="Masukkan PIN">
                    <div class="pin-dots" id="dots-new"></div>
                </div>

                <div class="pin-input-group">
                    <label>Konfirmasi PIN</label>
                    <input type="password"
                           id="pin-confirm"
                           inputmode="numeric"
                           pattern="[0-9]*"
                           maxlength="${UI_CONFIG.pinLength}"
                           placeholder="Ulangi PIN">
                    <div class="pin-dots" id="dots-confirm"></div>
                </div>

                <div class="pin-error" id="pin-setup-error"></div>

                <div class="pin-requirements">
                    <p>Persyaratan PIN:</p>
                    <ul>
                        <li>Minimal ${KeyManager.CRYPTO_CONFIG.MIN_PIN_LENGTH} digit</li>
                        <li>Hanya angka</li>
                        <li>Hindari pola mudah (1234, 0000)</li>
                    </ul>
                </div>
            </div>

            <div class="security-actions">
                <button class="btn-secondary" id="btn-cancel">Batal</button>
                <button class="btn-primary" id="btn-setup-pin">Simpan PIN</button>
            </div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // Setup PIN dots visualization
        const pinNewInput = content.querySelector('#pin-new');
        const pinConfirmInput = content.querySelector('#pin-confirm');
        setupPINDots(pinNewInput, content.querySelector('#dots-new'));
        setupPINDots(pinConfirmInput, content.querySelector('#dots-confirm'));

        // Event handlers
        content.querySelector('#btn-cancel').onclick = () => {
            document.body.removeChild(overlay);
            resolve({ success: false, cancelled: true });
        };

        content.querySelector('#btn-setup-pin').onclick = async () => {
            const pin = pinNewInput.value;
            const confirmPin = pinConfirmInput.value;
            const errorEl = content.querySelector('#pin-setup-error');

            // Validate
            if (pin !== confirmPin) {
                errorEl.textContent = 'PIN tidak cocok';
                return;
            }

            const validation = KeyManager.validatePIN(pin);
            if (!validation.valid) {
                errorEl.textContent = validation.error;
                return;
            }

            // Set PIN
            const result = await KeyManager.setUserPIN(userId, pin);

            if (result.success) {
                document.body.removeChild(overlay);

                // Dispatch event
                window.dispatchEvent(new CustomEvent('security:setup-complete', {
                    detail: { userId }
                }));

                resolve({ success: true });
            } else {
                errorEl.textContent = result.error;
            }
        };

        // Auto-focus
        pinNewInput.focus();
    });
}

// =============================================================================
// PIN Login Screen
// =============================================================================

/**
 * Show PIN login screen
 * @param {string} userId - User identifier
 * @param {string} wilayahId - Wilayah identifier
 * @param {string} wilayahMasterKey - Wilayah master key (if known)
 * @returns {Promise<object>} Login result with derived key
 */
function showPINLogin(userId, wilayahId, wilayahMasterKey = null) {
    return new Promise((resolve) => {
        // Check lockout
        if (lockoutUntil && Date.now() < lockoutUntil) {
            const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
            resolve({
                success: false,
                error: `Terlalu banyak percobaan. Coba lagi dalam ${remaining} detik.`
            });
            return;
        }

        const overlay = createOverlay();

        const content = document.createElement('div');
        content.className = 'security-dialog';
        content.innerHTML = `
            <div class="security-header">
                <div class="lock-icon">
                    <svg viewBox="0 0 24 24" width="48" height="48">
                        <path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                    </svg>
                </div>
                <h2>Masukkan PIN</h2>
                <p>Buka kunci untuk mengakses data</p>
            </div>

            <div class="pin-login-form">
                <div class="pin-input-group">
                    <input type="password"
                           id="pin-login"
                           inputmode="numeric"
                           pattern="[0-9]*"
                           maxlength="${UI_CONFIG.pinLength}"
                           placeholder="PIN"
                           autocomplete="off">
                    <div class="pin-dots" id="dots-login"></div>
                </div>

                <div class="pin-error" id="pin-login-error"></div>

                <div class="attempts-info" id="attempts-info">
                    ${failedAttempts > 0 ? `Percobaan tersisa: ${UI_CONFIG.maxAttempts - failedAttempts}` : ''}
                </div>
            </div>

            <div class="security-actions">
                <button class="btn-primary btn-full" id="btn-unlock">Buka Kunci</button>
            </div>

            <div class="pin-forgot">
                <a href="#" id="btn-forgot">Lupa PIN?</a>
            </div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // Setup PIN dots
        const pinInput = content.querySelector('#pin-login');
        setupPINDots(pinInput, content.querySelector('#dots-login'));

        // Auto-submit on complete PIN
        pinInput.addEventListener('input', () => {
            if (pinInput.value.length === UI_CONFIG.pinLength) {
                content.querySelector('#btn-unlock').click();
            }
        });

        // Event handlers
        content.querySelector('#btn-unlock').onclick = async () => {
            const pin = pinInput.value;
            const errorEl = content.querySelector('#pin-login-error');

            if (!pin) {
                errorEl.textContent = 'Masukkan PIN';
                return;
            }

            // Verify PIN
            const verifyResult = await KeyManager.verifyPIN(userId, pin);

            if (verifyResult.success) {
                // Reset failed attempts
                failedAttempts = 0;

                // Derive key
                let derivedKey = null;
                if (wilayahMasterKey) {
                    const keyResult = await KeyManager.deriveDBKeyFull(
                        userId, pin, wilayahId, wilayahMasterKey
                    );
                    if (keyResult.success) {
                        derivedKey = keyResult.key;
                    }
                } else {
                    const keyResult = await KeyManager.deriveDBKeyQuick(
                        userId, pin, wilayahId
                    );
                    if (keyResult.success) {
                        derivedKey = keyResult.key;
                    }
                }

                document.body.removeChild(overlay);

                // Dispatch event
                window.dispatchEvent(new CustomEvent('security:unlocked', {
                    detail: { userId, wilayahId }
                }));

                resolve({ success: true, key: derivedKey });
            } else {
                failedAttempts++;

                if (failedAttempts >= UI_CONFIG.maxAttempts) {
                    lockoutUntil = Date.now() + UI_CONFIG.lockoutDuration;
                    document.body.removeChild(overlay);
                    resolve({
                        success: false,
                        error: 'Terlalu banyak percobaan. Coba lagi dalam 5 menit.'
                    });
                    return;
                }

                errorEl.textContent = verifyResult.error;
                content.querySelector('#attempts-info').textContent =
                    `Percobaan tersisa: ${UI_CONFIG.maxAttempts - failedAttempts}`;
                pinInput.value = '';
                pinInput.focus();

                // Shake animation
                content.classList.add('shake');
                setTimeout(() => content.classList.remove('shake'), 500);
            }
        };

        content.querySelector('#btn-forgot').onclick = (e) => {
            e.preventDefault();
            showForgotPINDialog();
        };

        // Auto-focus
        pinInput.focus();
    });
}

/**
 * Show forgot PIN dialog
 */
function showForgotPINDialog() {
    alert(
        'Untuk mereset PIN:\n\n' +
        '1. Hapus data aplikasi di pengaturan perangkat\n' +
        '2. Atau hubungi administrator wilayah Anda\n\n' +
        'Peringatan: Mereset PIN akan menghapus semua data lokal.'
    );
}

// =============================================================================
// Security Status Display
// =============================================================================

/**
 * Create security status badge
 * @param {object} status - Security status from getSecurityStatus
 * @returns {HTMLElement} Status badge element
 */
function createSecurityBadge(status) {
    const badge = document.createElement('div');
    badge.className = `security-badge security-${status.securityLevel}`;

    const icons = {
        high: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>',
        standard: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>',
        basic: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" opacity="0.5"/></svg>',
        none: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" opacity="0.3"/></svg>'
    };

    const labels = {
        high: 'Keamanan Tinggi',
        standard: 'Keamanan Standar',
        basic: 'Keamanan Dasar',
        none: 'Tidak Terenkripsi'
    };

    badge.innerHTML = `
        ${icons[status.securityLevel]}
        <span>${labels[status.securityLevel]}</span>
    `;

    return badge;
}

/**
 * Create backup security info panel
 * @param {object} backup - Backup metadata
 * @returns {HTMLElement} Security info panel
 */
function createBackupSecurityInfo(backup) {
    const panel = document.createElement('div');
    panel.className = 'backup-security-info';

    const isEncrypted = backup.encrypted || backup.meta?.security?.encrypted;
    const isSigned = backup.signature || backup.meta?.security?.signed;

    panel.innerHTML = `
        <h4>Status Keamanan Backup</h4>

        <div class="security-item ${isEncrypted ? 'secure' : 'insecure'}">
            <span class="icon">${isEncrypted ? '&#x1F512;' : '&#x1F513;'}</span>
            <span class="label">Enkripsi</span>
            <span class="status">${isEncrypted ? 'Terenkripsi (AES-256)' : 'Tidak Terenkripsi'}</span>
        </div>

        <div class="security-item ${isSigned ? 'secure' : 'warning'}">
            <span class="icon">${isSigned ? '&#x2714;' : '&#x26A0;'}</span>
            <span class="label">Tanda Tangan</span>
            <span class="status">${isSigned ? 'Ditandatangani' : 'Tidak Ditandatangani'}</span>
        </div>

        ${backup.verificationResult ? `
        <div class="security-item ${backup.verificationResult.verified ? 'secure' : 'error'}">
            <span class="icon">${backup.verificationResult.verified ? '&#x2705;' : '&#x274C;'}</span>
            <span class="label">Verifikasi</span>
            <span class="status">${backup.verificationResult.message}</span>
        </div>
        ` : ''}

        ${backup.meta?.security ? `
        <div class="security-meta">
            <small>Versi Keamanan: ${backup.meta.security.version}</small>
            <small>Level: ${backup.meta.security.security_level}</small>
        </div>
        ` : ''}
    `;

    return panel;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create overlay element
 * @returns {HTMLElement} Overlay element
 */
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'security-overlay';
    return overlay;
}

/**
 * Setup PIN dots visualization
 * @param {HTMLInputElement} input - PIN input element
 * @param {HTMLElement} dotsContainer - Dots container element
 */
function setupPINDots(input, dotsContainer) {
    const maxLength = parseInt(input.maxLength) || UI_CONFIG.pinLength;

    // Create dots
    dotsContainer.innerHTML = '';
    for (let i = 0; i < maxLength; i++) {
        const dot = document.createElement('span');
        dot.className = 'pin-dot';
        dotsContainer.appendChild(dot);
    }

    // Update dots on input
    input.addEventListener('input', () => {
        const dots = dotsContainer.querySelectorAll('.pin-dot');
        const length = input.value.length;

        dots.forEach((dot, i) => {
            dot.classList.toggle('filled', i < length);
        });
    });
}

/**
 * Inject security styles
 */
function injectStyles() {
    if (document.querySelector('#security-ui-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'security-ui-styles';
    styles.textContent = `
        .security-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
        }

        .security-dialog {
            background: white;
            border-radius: 16px;
            padding: 24px;
            max-width: 360px;
            width: 90%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .security-header {
            text-align: center;
            margin-bottom: 24px;
        }

        .security-header h2 {
            margin: 16px 0 8px;
            color: #1a5f2a;
        }

        .security-header p {
            color: #666;
            font-size: 14px;
        }

        .lock-icon {
            color: #1a5f2a;
        }

        .pin-input-group {
            margin-bottom: 16px;
        }

        .pin-input-group label {
            display: block;
            font-size: 14px;
            color: #333;
            margin-bottom: 8px;
        }

        .pin-input-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 18px;
            text-align: center;
            letter-spacing: 8px;
        }

        .pin-input-group input:focus {
            outline: none;
            border-color: #1a5f2a;
        }

        .pin-dots {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-top: 12px;
        }

        .pin-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ddd;
            transition: background 0.2s;
        }

        .pin-dot.filled {
            background: #1a5f2a;
        }

        .pin-error {
            color: #dc3545;
            font-size: 14px;
            text-align: center;
            min-height: 20px;
            margin: 8px 0;
        }

        .pin-requirements {
            background: #f5f5f5;
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            color: #666;
            margin-top: 16px;
        }

        .pin-requirements ul {
            margin: 8px 0 0 16px;
        }

        .security-actions {
            display: flex;
            gap: 12px;
            margin-top: 24px;
        }

        .security-actions button {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .btn-primary {
            background: #1a5f2a;
            color: white;
        }

        .btn-primary:hover {
            background: #0d3d18;
        }

        .btn-secondary {
            background: #f5f5f5;
            color: #333;
        }

        .btn-secondary:hover {
            background: #ddd;
        }

        .btn-full {
            flex: 1 !important;
        }

        .pin-forgot {
            text-align: center;
            margin-top: 16px;
        }

        .pin-forgot a {
            color: #666;
            font-size: 14px;
        }

        .attempts-info {
            text-align: center;
            font-size: 12px;
            color: #dc3545;
            min-height: 16px;
        }

        .shake {
            animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-10px); }
            75% { transform: translateX(10px); }
        }

        /* Security Badge */
        .security-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 500;
        }

        .security-high {
            background: #d4edda;
            color: #155724;
        }

        .security-standard {
            background: #cce5ff;
            color: #004085;
        }

        .security-basic {
            background: #fff3cd;
            color: #856404;
        }

        .security-none {
            background: #f8d7da;
            color: #721c24;
        }

        /* Backup Security Info */
        .backup-security-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
        }

        .backup-security-info h4 {
            margin: 0 0 12px;
            font-size: 14px;
            color: #333;
        }

        .security-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 8px;
        }

        .security-item.secure {
            background: #d4edda;
        }

        .security-item.insecure {
            background: #f8d7da;
        }

        .security-item.warning {
            background: #fff3cd;
        }

        .security-item.error {
            background: #f8d7da;
        }

        .security-item .icon {
            font-size: 16px;
        }

        .security-item .label {
            flex: 1;
            font-size: 14px;
            font-weight: 500;
        }

        .security-item .status {
            font-size: 12px;
            color: #666;
        }

        .security-meta {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            padding-top: 12px;
            border-top: 1px solid #ddd;
        }

        .security-meta small {
            color: #999;
            font-size: 11px;
        }
    `;

    document.head.appendChild(styles);
}

// Inject styles on load
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }
}

// =============================================================================
// Export Module
// =============================================================================

const SecurityUI = {
    // Screens
    showPINSetup,
    showPINLogin,
    showForgotPINDialog,

    // Components
    createSecurityBadge,
    createBackupSecurityInfo,

    // Configuration
    UI_CONFIG
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUI;
}

// Global export
if (typeof window !== 'undefined') {
    window.SecurityUI = SecurityUI;
}

export default SecurityUI;
export {
    showPINSetup,
    showPINLogin,
    createSecurityBadge,
    createBackupSecurityInfo,
    UI_CONFIG
};
