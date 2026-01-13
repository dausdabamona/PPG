/**
 * =============================================================================
 * Role-Based Access Control (RBAC) Module
 * =============================================================================
 * Defines user roles and their permissions for the PPG application
 *
 * Roles:
 * - ORANG_TUA (Parent): Limited access to own children's data
 * - MUBALIGH (Teacher): Class management and student assessment
 * - PAKAR (Expert): Full access including recommendations
 * =============================================================================
 */

/**
 * Available user roles
 */
const ROLES = {
    ORANG_TUA: 'orang_tua',
    MUBALIGH: 'mubaligh',
    PAKAR: 'pakar'
};

/**
 * Role display names (Indonesian)
 */
const ROLE_NAMES = {
    [ROLES.ORANG_TUA]: 'Orang Tua',
    [ROLES.MUBALIGH]: 'Mubaligh',
    [ROLES.PAKAR]: 'Pakar'
};

/**
 * Role descriptions
 */
const ROLE_DESCRIPTIONS = {
    [ROLES.ORANG_TUA]: 'Akses data anak dan kelas mandiri orang tua',
    [ROLES.MUBALIGH]: 'Kelola kelas, absensi, dan penilaian jamaah',
    [ROLES.PAKAR]: 'Akses penuh termasuk konsultasi dan rekomendasi'
};

/**
 * Feature permissions by role
 */
const PERMISSIONS = {
    // Jamaah (Student) Management
    jamaah: {
        view_all: [ROLES.MUBALIGH, ROLES.PAKAR],
        view_own: [ROLES.ORANG_TUA],  // Only their children
        create: [ROLES.MUBALIGH, ROLES.PAKAR],
        update: [ROLES.MUBALIGH, ROLES.PAKAR],
        delete: [ROLES.PAKAR]
    },

    // Kelas (Class) Management
    kelas: {
        view_all: [ROLES.MUBALIGH, ROLES.PAKAR],
        view_enrolled: [ROLES.ORANG_TUA],  // Only classes their children attend
        create: [ROLES.MUBALIGH, ROLES.PAKAR],
        update: [ROLES.MUBALIGH, ROLES.PAKAR],
        delete: [ROLES.PAKAR]
    },

    // Kehadiran (Attendance)
    kehadiran: {
        view_all: [ROLES.MUBALIGH, ROLES.PAKAR],
        view_own: [ROLES.ORANG_TUA],  // Only their children's attendance
        record: [ROLES.MUBALIGH, ROLES.PAKAR],
        update: [ROLES.MUBALIGH, ROLES.PAKAR]
    },

    // Penilaian (Assessment)
    penilaian: {
        view_all: [ROLES.MUBALIGH, ROLES.PAKAR],
        view_own: [ROLES.ORANG_TUA],  // Only their children's assessments
        create: [ROLES.MUBALIGH, ROLES.PAKAR],
        update: [ROLES.MUBALIGH, ROLES.PAKAR]
    },

    // Kelas Mandiri (Parent Self-Learning)
    kelas_mandiri: {
        view: [ROLES.ORANG_TUA, ROLES.MUBALIGH, ROLES.PAKAR],
        manage: [ROLES.PAKAR],  // Create/edit modules
        progress: [ROLES.ORANG_TUA]  // Track own progress
    },

    // Catatan Pembinaan (Coaching Notes)
    catatan_pembinaan: {
        view_all: [ROLES.MUBALIGH, ROLES.PAKAR],
        view_visible: [ROLES.ORANG_TUA],  // Only notes marked visible to parents
        create: [ROLES.MUBALIGH, ROLES.PAKAR],
        update: [ROLES.MUBALIGH, ROLES.PAKAR]
    },

    // Rekomendasi (Recommendations)
    rekomendasi: {
        view_all: [ROLES.PAKAR],
        view_own: [ROLES.ORANG_TUA, ROLES.MUBALIGH],  // Only related recommendations
        create: [ROLES.PAKAR],
        update_progress: [ROLES.ORANG_TUA, ROLES.MUBALIGH, ROLES.PAKAR]
    },

    // Konsultasi (Consultations)
    konsultasi: {
        view_all: [ROLES.PAKAR],
        view_own: [ROLES.ORANG_TUA, ROLES.MUBALIGH],
        create: [ROLES.PAKAR],
        request: [ROLES.ORANG_TUA, ROLES.MUBALIGH]
    },

    // Backup & Settings
    backup: {
        export: [ROLES.MUBALIGH, ROLES.PAKAR],
        import: [ROLES.PAKAR]
    },

    settings: {
        view: [ROLES.ORANG_TUA, ROLES.MUBALIGH, ROLES.PAKAR],
        manage: [ROLES.PAKAR]
    }
};

/**
 * Menu items by role
 */
const MENU_BY_ROLE = {
    [ROLES.ORANG_TUA]: [
        { id: 'anak', label: 'Anak Saya', icon: '&#128100;' },
        { id: 'kehadiran', label: 'Kehadiran', icon: '&#9989;' },
        { id: 'penilaian', label: 'Penilaian', icon: '&#128202;' },
        { id: 'mandiri', label: 'Kelas Mandiri', icon: '&#128214;' },
        { id: 'rekomendasi', label: 'Rekomendasi', icon: '&#128161;' },
        { id: 'konsultasi', label: 'Konsultasi', icon: '&#128172;' }
    ],
    [ROLES.MUBALIGH]: [
        { id: 'jamaah', label: 'Jamaah', icon: '&#128100;' },
        { id: 'kelas', label: 'Kelas', icon: '&#128218;' },
        { id: 'kehadiran', label: 'Kehadiran', icon: '&#9989;' },
        { id: 'penilaian', label: 'Penilaian', icon: '&#128202;' },
        { id: 'catatan', label: 'Catatan', icon: '&#128221;' },
        { id: 'laporan', label: 'Laporan', icon: '&#128200;' }
    ],
    [ROLES.PAKAR]: [
        { id: 'jamaah', label: 'Jamaah', icon: '&#128100;' },
        { id: 'kelas', label: 'Kelas', icon: '&#128218;' },
        { id: 'kehadiran', label: 'Kehadiran', icon: '&#9989;' },
        { id: 'penilaian', label: 'Penilaian', icon: '&#128202;' },
        { id: 'catatan', label: 'Catatan', icon: '&#128221;' },
        { id: 'mandiri', label: 'Kelas Mandiri', icon: '&#128214;' },
        { id: 'rekomendasi', label: 'Rekomendasi', icon: '&#128161;' },
        { id: 'konsultasi', label: 'Konsultasi', icon: '&#128172;' },
        { id: 'laporan', label: 'Laporan', icon: '&#128200;' },
        { id: 'pengaturan', label: 'Pengaturan', icon: '&#9881;' }
    ]
};

/**
 * Check if a role has permission for an action
 * @param {string} role - User role
 * @param {string} feature - Feature name
 * @param {string} action - Action name
 * @returns {boolean} Has permission
 */
function hasPermission(role, feature, action) {
    if (!PERMISSIONS[feature] || !PERMISSIONS[feature][action]) {
        return false;
    }
    return PERMISSIONS[feature][action].includes(role);
}

/**
 * Get menu items for a role
 * @param {string} role - User role
 * @returns {Array} Menu items
 */
function getMenuForRole(role) {
    return MENU_BY_ROLE[role] || [];
}

/**
 * Get role display name
 * @param {string} role - Role code
 * @returns {string} Display name
 */
function getRoleName(role) {
    return ROLE_NAMES[role] || role;
}

/**
 * Get role description
 * @param {string} role - Role code
 * @returns {string} Description
 */
function getRoleDescription(role) {
    return ROLE_DESCRIPTIONS[role] || '';
}

/**
 * Get all available roles
 * @returns {Array} List of role objects
 */
function getAllRoles() {
    return Object.values(ROLES).map(role => ({
        code: role,
        name: ROLE_NAMES[role],
        description: ROLE_DESCRIPTIONS[role]
    }));
}

// =============================================================================
// Current User Role Management (stored in localStorage)
// =============================================================================

/**
 * Get current user's role
 * @returns {string} Current role
 */
function getCurrentRole() {
    return localStorage.getItem('ppg_user_role') || ROLES.MUBALIGH;
}

/**
 * Set current user's role
 * @param {string} role - Role to set
 */
function setCurrentRole(role) {
    if (Object.values(ROLES).includes(role)) {
        localStorage.setItem('ppg_user_role', role);
    }
}

/**
 * Get current user's name
 * @returns {string} User name
 */
function getCurrentUserName() {
    return localStorage.getItem('ppg_user_name') || 'Pengguna';
}

/**
 * Set current user's name
 * @param {string} name - User name
 */
function setCurrentUserName(name) {
    localStorage.setItem('ppg_user_name', name);
}

// =============================================================================
// Export module
// =============================================================================

const RolesModule = {
    ROLES,
    ROLE_NAMES,
    ROLE_DESCRIPTIONS,
    PERMISSIONS,
    MENU_BY_ROLE,
    hasPermission,
    getMenuForRole,
    getRoleName,
    getRoleDescription,
    getAllRoles,
    getCurrentRole,
    setCurrentRole,
    getCurrentUserName,
    setCurrentUserName
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RolesModule;
}

if (typeof window !== 'undefined') {
    window.Roles = RolesModule;
}

export default RolesModule;
export {
    ROLES,
    hasPermission,
    getMenuForRole,
    getRoleName,
    getAllRoles,
    getCurrentRole,
    setCurrentRole,
    getCurrentUserName,
    setCurrentUserName
};
