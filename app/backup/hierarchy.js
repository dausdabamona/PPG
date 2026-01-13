/**
 * =============================================================================
 * Organizational Hierarchy Module
 * =============================================================================
 * Defines the hierarchical structure for backup flow:
 * OrangTua -> Mubaligh -> PC -> DPD -> DPW
 *
 * This module handles:
 * - Level definitions and ordering
 * - Import permission validation
 * - Level relationship checks
 * =============================================================================
 */

/**
 * Organizational levels in hierarchical order (lowest to highest)
 */
const LEVELS = {
    ORANG_TUA: 'orang_tua',
    MUBALIGH: 'mubaligh',
    PC: 'pc',         // Pimpinan Cabang
    DPD: 'dpd',       // Dewan Pimpinan Daerah
    DPW: 'dpw'        // Dewan Pimpinan Wilayah
};

/**
 * Level display names (Indonesian)
 */
const LEVEL_NAMES = {
    [LEVELS.ORANG_TUA]: 'Orang Tua',
    [LEVELS.MUBALIGH]: 'Mubaligh',
    [LEVELS.PC]: 'Pimpinan Cabang (PC)',
    [LEVELS.DPD]: 'Dewan Pimpinan Daerah (DPD)',
    [LEVELS.DPW]: 'Dewan Pimpinan Wilayah (DPW)'
};

/**
 * Level descriptions
 */
const LEVEL_DESCRIPTIONS = {
    [LEVELS.ORANG_TUA]: 'Orang tua/wali jamaah, mengekspor data anak',
    [LEVELS.MUBALIGH]: 'Pengajar/guru pengajian, mengumpulkan data dari orang tua',
    [LEVELS.PC]: 'Pimpinan Cabang, mengumpulkan data dari mubaligh',
    [LEVELS.DPD]: 'Dewan Pimpinan Daerah, mengumpulkan data dari PC',
    [LEVELS.DPW]: 'Dewan Pimpinan Wilayah, mengumpulkan data dari DPD'
};

/**
 * Hierarchical order (index represents level rank, 0 = lowest)
 */
const LEVEL_ORDER = [
    LEVELS.ORANG_TUA,  // 0
    LEVELS.MUBALIGH,   // 1
    LEVELS.PC,         // 2
    LEVELS.DPD,        // 3
    LEVELS.DPW         // 4
];

/**
 * Valid import paths: which level can import from which
 * Key = importer level, Value = array of valid source levels
 */
const VALID_IMPORT_SOURCES = {
    [LEVELS.MUBALIGH]: [LEVELS.ORANG_TUA],
    [LEVELS.PC]: [LEVELS.MUBALIGH],
    [LEVELS.DPD]: [LEVELS.PC],
    [LEVELS.DPW]: [LEVELS.DPD]
};

/**
 * Get the rank/order of a level (0 = lowest)
 * @param {string} level - Level code
 * @returns {number} Level rank (-1 if invalid)
 */
function getLevelRank(level) {
    return LEVEL_ORDER.indexOf(level);
}

/**
 * Check if a level can import from another level
 * @param {string} importerLevel - Level of the user importing
 * @param {string} sourceLevel - Level of the backup source
 * @returns {boolean} Whether import is allowed
 */
function canImportFrom(importerLevel, sourceLevel) {
    const validSources = VALID_IMPORT_SOURCES[importerLevel];
    if (!validSources) {
        return false;
    }
    return validSources.includes(sourceLevel);
}

/**
 * Validate import permission and return detailed result
 * @param {string} importerLevel - Level of the user importing
 * @param {string} sourceLevel - Level of the backup source
 * @returns {object} Validation result with details
 */
function validateImportPermission(importerLevel, sourceLevel) {
    const result = {
        valid: false,
        importerLevel,
        sourceLevel,
        importerName: LEVEL_NAMES[importerLevel] || importerLevel,
        sourceName: LEVEL_NAMES[sourceLevel] || sourceLevel,
        message: '',
        expectedSource: null
    };

    // Check if importer level is valid
    if (!LEVEL_ORDER.includes(importerLevel)) {
        result.message = `Level "${importerLevel}" tidak dikenali`;
        return result;
    }

    // Check if source level is valid
    if (!LEVEL_ORDER.includes(sourceLevel)) {
        result.message = `Level sumber "${sourceLevel}" tidak dikenali`;
        return result;
    }

    // Orang Tua cannot import (lowest level)
    if (importerLevel === LEVELS.ORANG_TUA) {
        result.message = 'Orang Tua tidak dapat mengimpor backup';
        return result;
    }

    // Check valid import path
    const validSources = VALID_IMPORT_SOURCES[importerLevel];
    result.expectedSource = validSources ? validSources[0] : null;

    if (canImportFrom(importerLevel, sourceLevel)) {
        result.valid = true;
        result.message = `Import diizinkan: ${result.sourceName} -> ${result.importerName}`;
    } else {
        const importerRank = getLevelRank(importerLevel);
        const sourceRank = getLevelRank(sourceLevel);

        if (sourceRank >= importerRank) {
            result.message = `Tidak dapat mengimpor dari level yang sama atau lebih tinggi (${result.sourceName})`;
        } else if (sourceRank < importerRank - 1) {
            result.message = `Harus mengimpor dari level tepat di bawah. ` +
                `${result.importerName} hanya dapat mengimpor dari ${LEVEL_NAMES[result.expectedSource]}`;
        } else {
            result.message = `Import tidak diizinkan: ${result.sourceName} -> ${result.importerName}`;
        }
    }

    return result;
}

/**
 * Get the level that can import from the given level
 * @param {string} sourceLevel - Source level
 * @returns {string|null} Target level that can import, or null
 */
function getTargetLevel(sourceLevel) {
    const sourceRank = getLevelRank(sourceLevel);
    if (sourceRank < 0 || sourceRank >= LEVEL_ORDER.length - 1) {
        return null;
    }
    return LEVEL_ORDER[sourceRank + 1];
}

/**
 * Get the level that can export to the given level
 * @param {string} targetLevel - Target/importer level
 * @returns {string|null} Source level, or null
 */
function getSourceLevel(targetLevel) {
    const validSources = VALID_IMPORT_SOURCES[targetLevel];
    return validSources ? validSources[0] : null;
}

/**
 * Get all levels as an array of objects
 * @returns {Array} Array of level objects
 */
function getAllLevels() {
    return LEVEL_ORDER.map((level, index) => ({
        code: level,
        name: LEVEL_NAMES[level],
        description: LEVEL_DESCRIPTIONS[level],
        rank: index,
        canExport: index < LEVEL_ORDER.length - 1,
        canImport: index > 0,
        validImportSources: VALID_IMPORT_SOURCES[level] || []
    }));
}

/**
 * Check if level is valid
 * @param {string} level - Level code
 * @returns {boolean}
 */
function isValidLevel(level) {
    return LEVEL_ORDER.includes(level);
}

/**
 * Get level name
 * @param {string} level - Level code
 * @returns {string} Display name
 */
function getLevelName(level) {
    return LEVEL_NAMES[level] || level;
}

// =============================================================================
// Export module
// =============================================================================

const HierarchyModule = {
    LEVELS,
    LEVEL_NAMES,
    LEVEL_DESCRIPTIONS,
    LEVEL_ORDER,
    VALID_IMPORT_SOURCES,
    getLevelRank,
    canImportFrom,
    validateImportPermission,
    getTargetLevel,
    getSourceLevel,
    getAllLevels,
    isValidLevel,
    getLevelName
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HierarchyModule;
}

if (typeof window !== 'undefined') {
    window.Hierarchy = HierarchyModule;
}

export default HierarchyModule;
export {
    LEVELS,
    LEVEL_NAMES,
    LEVEL_ORDER,
    getLevelRank,
    canImportFrom,
    validateImportPermission,
    getTargetLevel,
    getSourceLevel,
    getAllLevels,
    isValidLevel,
    getLevelName
};
