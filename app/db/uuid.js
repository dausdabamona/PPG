/**
 * UUID Generation Module
 * Provides UUID generation for offline-first operation
 */

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
export function v4() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate UUID (alias for v4)
 */
export function generateUUID() {
  return v4();
}

export default {
  v4,
  generateUUID
};
