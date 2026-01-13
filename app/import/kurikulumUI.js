/**
 * =============================================================================
 * Kurikulum Import UI (kurikulumUI.js)
 * =============================================================================
 * User interface for importing official curriculum packages.
 *
 * Features:
 * - File picker trigger
 * - Metadata display before import
 * - Progress indicator
 * - Import result summary
 * - Version history display
 *
 * Integrates with kurikulumImporter.js for all import operations.
 * =============================================================================
 */

import KurikulumImporter from './kurikulumImporter.js';
import { sha256, bytesToHex } from '../security/keyManager.js';

/**
 * UI Configuration
 */
const UI_CONFIG = {
    modalId: 'kurikulum-import-modal',
    containerId: 'kurikulum-import-container'
};

/**
 * Current import state
 */
let importState = {
    file: null,
    data: null,
    step: 'idle',  // idle, preview, importing, complete
    result: null
};

// =============================================================================
// CSS Styles
// =============================================================================

const KURIKULUM_UI_STYLES = `
.kurikulum-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease;
}

.kurikulum-modal {
    background: white;
    border-radius: 16px;
    max-width: 500px;
    width: 90%;
    max-height: 85vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.3s ease;
}

.kurikulum-modal-header {
    background: linear-gradient(135deg, #1a5f2a 0%, #2d8a3e 100%);
    color: white;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.kurikulum-modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
}

.kurikulum-modal-header .icon {
    font-size: 24px;
}

.kurikulum-modal-close {
    margin-left: auto;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.kurikulum-modal-close:hover {
    background: rgba(255, 255, 255, 0.3);
}

.kurikulum-modal-body {
    padding: 24px;
    overflow-y: auto;
    flex: 1;
}

.kurikulum-modal-footer {
    padding: 16px 24px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.kurikulum-btn {
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
}

.kurikulum-btn-primary {
    background: #1a5f2a;
    color: white;
}

.kurikulum-btn-primary:hover:not(:disabled) {
    background: #2d8a3e;
}

.kurikulum-btn-primary:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.kurikulum-btn-secondary {
    background: #f5f5f5;
    color: #333;
}

.kurikulum-btn-secondary:hover {
    background: #e0e0e0;
}

.kurikulum-file-picker {
    border: 2px dashed #ccc;
    border-radius: 12px;
    padding: 40px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.kurikulum-file-picker:hover {
    border-color: #1a5f2a;
    background: #f8fdf9;
}

.kurikulum-file-picker .icon {
    font-size: 48px;
    color: #1a5f2a;
    margin-bottom: 12px;
}

.kurikulum-file-picker h3 {
    margin: 0 0 8px 0;
    color: #333;
}

.kurikulum-file-picker p {
    margin: 0;
    color: #666;
    font-size: 14px;
}

.kurikulum-preview {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 20px;
}

.kurikulum-preview-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e0e0e0;
}

.kurikulum-preview-icon {
    width: 48px;
    height: 48px;
    background: #1a5f2a;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 24px;
}

.kurikulum-preview-title h3 {
    margin: 0 0 4px 0;
    font-size: 16px;
}

.kurikulum-preview-title p {
    margin: 0;
    color: #666;
    font-size: 13px;
}

.kurikulum-meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.kurikulum-meta-item {
    background: white;
    padding: 12px;
    border-radius: 8px;
}

.kurikulum-meta-item label {
    display: block;
    font-size: 11px;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 4px;
}

.kurikulum-meta-item span {
    font-size: 14px;
    font-weight: 600;
    color: #333;
}

.kurikulum-data-summary {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
}

.kurikulum-data-summary h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #333;
}

.kurikulum-data-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.kurikulum-data-count {
    background: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
}

.kurikulum-data-count strong {
    color: #1a5f2a;
}

.kurikulum-progress {
    text-align: center;
    padding: 40px 20px;
}

.kurikulum-progress .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e0e0e0;
    border-top-color: #1a5f2a;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
}

.kurikulum-progress p {
    color: #666;
    margin: 0;
}

.kurikulum-result {
    text-align: center;
    padding: 20px;
}

.kurikulum-result-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
    font-size: 32px;
}

.kurikulum-result-icon.success {
    background: #e8f5e9;
    color: #2e7d32;
}

.kurikulum-result-icon.error {
    background: #ffebee;
    color: #c62828;
}

.kurikulum-result h3 {
    margin: 0 0 8px 0;
}

.kurikulum-result p {
    color: #666;
    margin: 0 0 16px 0;
}

.kurikulum-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    text-align: left;
    background: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
    margin-top: 16px;
}

.kurikulum-stat-item {
    text-align: center;
}

.kurikulum-stat-item .number {
    font-size: 24px;
    font-weight: 700;
    color: #1a5f2a;
}

.kurikulum-stat-item .label {
    font-size: 11px;
    color: #666;
    text-transform: uppercase;
}

.kurikulum-errors {
    margin-top: 16px;
    padding: 12px;
    background: #fff3e0;
    border-radius: 8px;
    text-align: left;
}

.kurikulum-errors h4 {
    margin: 0 0 8px 0;
    font-size: 13px;
    color: #e65100;
}

.kurikulum-errors ul {
    margin: 0;
    padding-left: 20px;
    font-size: 12px;
    color: #bf360c;
}

.kurikulum-signature-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
}

.kurikulum-signature-badge.valid {
    background: #e8f5e9;
    color: #2e7d32;
}

.kurikulum-signature-badge.invalid {
    background: #ffebee;
    color: #c62828;
}

.kurikulum-history {
    margin-top: 20px;
}

.kurikulum-history h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #333;
}

.kurikulum-history-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 8px;
    margin-bottom: 8px;
}

.kurikulum-history-version {
    background: #1a5f2a;
    color: white;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}

.kurikulum-history-info {
    flex: 1;
}

.kurikulum-history-info .date {
    font-size: 12px;
    color: #666;
}

.kurikulum-history-info .issuer {
    font-size: 14px;
    font-weight: 500;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
`;

// =============================================================================
// UI Functions
// =============================================================================

/**
 * Inject CSS styles
 */
function injectStyles() {
    if (document.getElementById('kurikulum-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'kurikulum-ui-styles';
    style.textContent = KURIKULUM_UI_STYLES;
    document.head.appendChild(style);
}

/**
 * Show kurikulum import modal
 */
async function showKurikulumImportModal() {
    injectStyles();

    // Reset state
    importState = {
        file: null,
        data: null,
        step: 'idle',
        result: null
    };

    // Create modal
    const modal = document.createElement('div');
    modal.id = UI_CONFIG.modalId;
    modal.className = 'kurikulum-modal-overlay';
    modal.innerHTML = `
        <div class="kurikulum-modal">
            <div class="kurikulum-modal-header">
                <span class="icon">&#128218;</span>
                <h2>Import Kurikulum Pusat</h2>
                <button class="kurikulum-modal-close" onclick="closeKurikulumModal()">&times;</button>
            </div>
            <div class="kurikulum-modal-body" id="kurikulum-modal-content">
                ${renderFilePickerView()}
            </div>
            <div class="kurikulum-modal-footer" id="kurikulum-modal-footer">
                <button class="kurikulum-btn kurikulum-btn-secondary" onclick="closeKurikulumModal()">Batal</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeKurikulumModal();
        }
    });
}

/**
 * Close modal
 */
function closeKurikulumModal() {
    const modal = document.getElementById(UI_CONFIG.modalId);
    if (modal) {
        modal.remove();
    }
}

/**
 * Render file picker view
 */
function renderFilePickerView() {
    return `
        <div class="kurikulum-file-picker" onclick="triggerKurikulumFilePicker()">
            <div class="icon">&#128196;</div>
            <h3>Pilih File Kurikulum</h3>
            <p>kurikulum-ppg-vX.Y.json</p>
        </div>
        ${renderHistorySection()}
    `;
}

/**
 * Render history section
 */
function renderHistorySection() {
    return `
        <div class="kurikulum-history" id="kurikulum-history">
            <h4>Versi Terinstall</h4>
            <div id="kurikulum-history-list">
                <p style="color: #666; font-size: 13px;">Memuat...</p>
            </div>
        </div>
    `;
}

/**
 * Load and display version history
 */
async function loadKurikulumHistory() {
    const container = document.getElementById('kurikulum-history-list');
    if (!container) return;

    try {
        const current = await KurikulumImporter.getCurrentVersion();

        if (!current) {
            container.innerHTML = '<p style="color: #666; font-size: 13px;">Belum ada kurikulum terinstall</p>';
            return;
        }

        const importedDate = new Date(current.imported_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        container.innerHTML = `
            <div class="kurikulum-history-item">
                <span class="kurikulum-history-version">v${current.version}</span>
                <div class="kurikulum-history-info">
                    <div class="issuer">${current.issued_by}</div>
                    <div class="date">Diimport: ${importedDate}</div>
                </div>
                ${current.signature_valid ?
                    '<span class="kurikulum-signature-badge valid">&#10004; Terverifikasi</span>' :
                    '<span class="kurikulum-signature-badge invalid">&#10006; Tidak Terverifikasi</span>'
                }
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<p style="color: #666; font-size: 13px;">Belum ada kurikulum terinstall</p>';
    }
}

/**
 * Trigger file picker
 */
async function triggerKurikulumFilePicker() {
    const result = await KurikulumImporter.pickKurikulumFile();

    if (!result.success) {
        if (result.error && result.error !== 'File selection cancelled') {
            showKurikulumError(result.error);
        }
        return;
    }

    importState.file = result.fileName;
    importState.data = result.data;
    importState.step = 'preview';

    renderPreviewView();
}

/**
 * Render preview view
 */
function renderPreviewView() {
    const content = document.getElementById('kurikulum-modal-content');
    const footer = document.getElementById('kurikulum-modal-footer');

    if (!content || !importState.data) return;

    const { meta, data } = importState.data;

    // Count records
    const counts = {
        jenjang: data.jenjang?.length || 0,
        tingkat: data.tingkat_jenjang?.length || 0,
        kategori: data.kategori_materi?.length || 0,
        materi: data.materi?.length || 0,
        subMateri: data.sub_materi?.length || 0,
        kurikulum: data.kurikulum_tingkat?.length || 0
    };

    const issuedDate = new Date(meta.issued_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    content.innerHTML = `
        <div class="kurikulum-preview">
            <div class="kurikulum-preview-header">
                <div class="kurikulum-preview-icon">&#128218;</div>
                <div class="kurikulum-preview-title">
                    <h3>Kurikulum PPG v${meta.version}</h3>
                    <p>${importState.file}</p>
                </div>
            </div>

            <div class="kurikulum-meta-grid">
                <div class="kurikulum-meta-item">
                    <label>Versi</label>
                    <span>${meta.version}</span>
                </div>
                <div class="kurikulum-meta-item">
                    <label>Penerbit</label>
                    <span>${meta.issued_by}</span>
                </div>
                <div class="kurikulum-meta-item">
                    <label>Tanggal Terbit</label>
                    <span>${issuedDate}</span>
                </div>
                <div class="kurikulum-meta-item">
                    <label>Tanda Tangan</label>
                    <span>${meta.signature ? '&#128274; Ada' : '&#10060; Tidak Ada'}</span>
                </div>
            </div>

            <div class="kurikulum-data-summary">
                <h4>Data yang akan diimport:</h4>
                <div class="kurikulum-data-counts">
                    ${counts.jenjang > 0 ? `<div class="kurikulum-data-count"><strong>${counts.jenjang}</strong> Jenjang</div>` : ''}
                    ${counts.tingkat > 0 ? `<div class="kurikulum-data-count"><strong>${counts.tingkat}</strong> Tingkat</div>` : ''}
                    ${counts.kategori > 0 ? `<div class="kurikulum-data-count"><strong>${counts.kategori}</strong> Kategori</div>` : ''}
                    ${counts.materi > 0 ? `<div class="kurikulum-data-count"><strong>${counts.materi}</strong> Materi</div>` : ''}
                    ${counts.subMateri > 0 ? `<div class="kurikulum-data-count"><strong>${counts.subMateri}</strong> Sub-Materi</div>` : ''}
                    ${counts.kurikulum > 0 ? `<div class="kurikulum-data-count"><strong>${counts.kurikulum}</strong> Kurikulum Tingkat</div>` : ''}
                </div>
            </div>
        </div>
    `;

    footer.innerHTML = `
        <button class="kurikulum-btn kurikulum-btn-secondary" onclick="resetKurikulumImport()">Kembali</button>
        <button class="kurikulum-btn kurikulum-btn-primary" onclick="executeKurikulumImport()">
            &#128274; Verifikasi & Import
        </button>
    `;
}

/**
 * Reset to file picker view
 */
function resetKurikulumImport() {
    importState = {
        file: null,
        data: null,
        step: 'idle',
        result: null
    };

    const content = document.getElementById('kurikulum-modal-content');
    const footer = document.getElementById('kurikulum-modal-footer');

    if (content) {
        content.innerHTML = renderFilePickerView();
        loadKurikulumHistory();
    }

    if (footer) {
        footer.innerHTML = `
            <button class="kurikulum-btn kurikulum-btn-secondary" onclick="closeKurikulumModal()">Batal</button>
        `;
    }
}

/**
 * Execute import
 */
async function executeKurikulumImport() {
    if (!importState.data) return;

    importState.step = 'importing';

    const content = document.getElementById('kurikulum-modal-content');
    const footer = document.getElementById('kurikulum-modal-footer');

    // Show progress
    content.innerHTML = `
        <div class="kurikulum-progress">
            <div class="spinner"></div>
            <p>Memverifikasi dan mengimport kurikulum...</p>
        </div>
    `;

    footer.innerHTML = '';

    try {
        // Import using the importer
        const result = await KurikulumImporter.importKurikulumFromJson(importState.data, {
            requireSignature: false  // Allow import even without valid signature (with warning)
        });

        importState.result = result;
        importState.step = 'complete';

        renderResultView();
    } catch (error) {
        importState.result = {
            success: false,
            errors: [error.message]
        };
        importState.step = 'complete';

        renderResultView();
    }
}

/**
 * Render result view
 */
function renderResultView() {
    const content = document.getElementById('kurikulum-modal-content');
    const footer = document.getElementById('kurikulum-modal-footer');
    const result = importState.result;

    if (!content || !result) return;

    // Calculate totals
    let totalImported = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    if (result.stats) {
        Object.values(result.stats).forEach(stat => {
            if (typeof stat === 'object' && stat.imported !== undefined) {
                totalImported += stat.imported || 0;
                totalUpdated += stat.updated || 0;
                totalSkipped += stat.skipped || 0;
            }
        });
    }

    if (result.success) {
        content.innerHTML = `
            <div class="kurikulum-result">
                <div class="kurikulum-result-icon success">&#10004;</div>
                <h3>Import Berhasil!</h3>
                <p>Kurikulum v${result.version} telah berhasil diimport.</p>

                ${result.signatureValid ?
                    '<span class="kurikulum-signature-badge valid">&#128274; Tanda Tangan Valid</span>' :
                    '<span class="kurikulum-signature-badge invalid">&#9888; Tanda Tangan Tidak Terverifikasi</span>'
                }

                <div class="kurikulum-stats-grid">
                    <div class="kurikulum-stat-item">
                        <div class="number">${totalImported}</div>
                        <div class="label">Ditambahkan</div>
                    </div>
                    <div class="kurikulum-stat-item">
                        <div class="number">${totalUpdated}</div>
                        <div class="label">Diperbarui</div>
                    </div>
                    <div class="kurikulum-stat-item">
                        <div class="number">${totalSkipped}</div>
                        <div class="label">Dilewati</div>
                    </div>
                </div>

                ${result.warnings && result.warnings.length > 0 ? `
                    <div class="kurikulum-errors">
                        <h4>&#9888; Peringatan:</h4>
                        <ul>
                            ${result.warnings.map(w => `<li>${w}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;
    } else {
        content.innerHTML = `
            <div class="kurikulum-result">
                <div class="kurikulum-result-icon error">&#10006;</div>
                <h3>Import Gagal</h3>
                <p>Kurikulum tidak dapat diimport.</p>

                <div class="kurikulum-errors">
                    <h4>&#10006; Error:</h4>
                    <ul>
                        ${result.errors.map(e => `<li>${e}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    footer.innerHTML = `
        <button class="kurikulum-btn kurikulum-btn-primary" onclick="closeKurikulumModal()">Tutup</button>
    `;
}

/**
 * Show error toast
 */
function showKurikulumError(message) {
    const content = document.getElementById('kurikulum-modal-content');
    if (!content) return;

    // Insert error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'kurikulum-errors';
    errorDiv.style.marginTop = '16px';
    errorDiv.innerHTML = `
        <h4>&#10006; Error:</h4>
        <ul><li>${message}</li></ul>
    `;

    // Remove existing error
    const existing = content.querySelector('.kurikulum-errors');
    if (existing) existing.remove();

    content.appendChild(errorDiv);
}

/**
 * Create menu item for navigation
 * @returns {HTMLElement} Menu item element
 */
function createKurikulumMenuItem() {
    const menuItem = document.createElement('div');
    menuItem.className = 'menu-item';
    menuItem.innerHTML = `
        <span class="menu-icon">&#128218;</span>
        <span class="menu-text">Import Kurikulum Pusat</span>
    `;
    menuItem.addEventListener('click', showKurikulumImportModal);
    return menuItem;
}

/**
 * Create floating action button
 * @returns {HTMLElement} FAB element
 */
function createKurikulumFAB() {
    const fab = document.createElement('button');
    fab.id = 'kurikulum-fab';
    fab.innerHTML = '&#128218;';
    fab.title = 'Import Kurikulum Pusat';
    fab.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1a5f2a 0%, #2d8a3e 100%);
        color: white;
        border: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        font-size: 24px;
        cursor: pointer;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    fab.addEventListener('click', showKurikulumImportModal);
    return fab;
}

// =============================================================================
// Global Functions (for inline onclick handlers)
// =============================================================================

if (typeof window !== 'undefined') {
    window.showKurikulumImportModal = showKurikulumImportModal;
    window.closeKurikulumModal = closeKurikulumModal;
    window.triggerKurikulumFilePicker = triggerKurikulumFilePicker;
    window.resetKurikulumImport = resetKurikulumImport;
    window.executeKurikulumImport = executeKurikulumImport;
}

// =============================================================================
// Export Module
// =============================================================================

const KurikulumUI = {
    showKurikulumImportModal,
    closeKurikulumModal,
    createKurikulumMenuItem,
    createKurikulumFAB,
    loadKurikulumHistory
};

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KurikulumUI;
}

// Global export
if (typeof window !== 'undefined') {
    window.KurikulumUI = KurikulumUI;
}

export default KurikulumUI;
export {
    showKurikulumImportModal,
    closeKurikulumModal,
    createKurikulumMenuItem,
    createKurikulumFAB,
    loadKurikulumHistory
};
