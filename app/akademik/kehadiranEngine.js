/**
 * kehadiranEngine.js - Attendance Calculation Engine
 *
 * Calculates attendance statistics for academic reports:
 * - Total hadir, tidak hadir, izin, sakit
 * - Attendance percentage
 * - Predicate determination (Sangat Baik, Baik, Cukup, Perlu Pembinaan)
 * - Narrative description generation
 */

import { getDB } from '../db/db.js';

// Predicate thresholds
const PREDIKAT_THRESHOLDS = {
  SANGAT_BAIK: 90,  // >= 90%
  BAIK: 80,         // >= 80%
  CUKUP: 70,        // >= 70%
  // < 70% = Perlu Pembinaan
};

/**
 * Determine attendance predicate based on percentage
 * @param {number} percentage - Attendance percentage (0-100)
 * @returns {string} Predicate text
 */
export function getPredikatKehadiran(percentage) {
  if (percentage >= PREDIKAT_THRESHOLDS.SANGAT_BAIK) {
    return 'Sangat Baik';
  } else if (percentage >= PREDIKAT_THRESHOLDS.BAIK) {
    return 'Baik';
  } else if (percentage >= PREDIKAT_THRESHOLDS.CUKUP) {
    return 'Cukup';
  } else {
    return 'Perlu Pembinaan';
  }
}

/**
 * Generate narrative description for attendance
 * @param {object} stats - Attendance statistics
 * @returns {string} Narrative description
 */
export function generateDeskripsiKehadiran(stats) {
  const { persentase, totalHadir, totalPertemuan, totalIzin, totalSakit, totalTidakHadir } = stats;
  const predikat = getPredikatKehadiran(persentase);

  let deskripsi = `Ananda mengikuti ${totalHadir} dari ${totalPertemuan} pertemuan (${persentase.toFixed(1)}%). `;

  if (predikat === 'Sangat Baik') {
    deskripsi += 'Tingkat kehadiran sangat baik dan menunjukkan komitmen yang tinggi dalam mengikuti kegiatan pengajian. ';
  } else if (predikat === 'Baik') {
    deskripsi += 'Tingkat kehadiran baik, namun masih dapat ditingkatkan untuk hasil yang lebih optimal. ';
  } else if (predikat === 'Cukup') {
    deskripsi += 'Tingkat kehadiran cukup, diharapkan dapat lebih konsisten mengikuti kegiatan pengajian. ';
  } else {
    deskripsi += 'Tingkat kehadiran perlu pembinaan lebih lanjut. Diperlukan dukungan orang tua untuk meningkatkan kehadiran. ';
  }

  // Detail breakdown
  const details = [];
  if (totalIzin > 0) {
    details.push(`izin ${totalIzin}x`);
  }
  if (totalSakit > 0) {
    details.push(`sakit ${totalSakit}x`);
  }
  if (totalTidakHadir > 0) {
    details.push(`tanpa keterangan ${totalTidakHadir}x`);
  }

  if (details.length > 0) {
    deskripsi += `Ketidakhadiran: ${details.join(', ')}.`;
  }

  return deskripsi;
}

/**
 * Calculate attendance statistics for a student in a period
 * @param {string} jamaahId - Student ID
 * @param {string} tanggalMulai - Period start date (YYYY-MM-DD)
 * @param {string} tanggalSelesai - Period end date (YYYY-MM-DD)
 * @returns {Promise<object>} Attendance statistics
 */
export async function hitungKehadiran(jamaahId, tanggalMulai, tanggalSelesai) {
  const db = getDB();

  // Get all attendance records for this student in the period
  const query = `
    SELECT
      kd.status,
      COUNT(*) as jumlah
    FROM kehadiran_detail kd
    INNER JOIN kehadiran_sesi ks ON kd.sesi_id = ks.id
    WHERE kd.jamaah_id = ?
      AND ks.tanggal >= ?
      AND ks.tanggal <= ?
      AND kd.is_deleted = 0
      AND ks.is_deleted = 0
    GROUP BY kd.status
  `;

  const results = db.exec(query, [jamaahId, tanggalMulai, tanggalSelesai]);

  // Initialize stats
  const stats = {
    totalHadir: 0,
    totalTidakHadir: 0,
    totalIzin: 0,
    totalSakit: 0,
    totalPertemuan: 0,
    persentase: 0,
    predikat: 'Perlu Pembinaan',
    deskripsi: ''
  };

  // Parse results
  if (results.length > 0 && results[0].values) {
    results[0].values.forEach(row => {
      const status = row[0];
      const count = row[1];

      switch (status) {
        case 'hadir':
          stats.totalHadir = count;
          break;
        case 'tidak_hadir':
          stats.totalTidakHadir = count;
          break;
        case 'izin':
          stats.totalIzin = count;
          break;
        case 'sakit':
          stats.totalSakit = count;
          break;
      }
    });
  }

  // Calculate totals
  stats.totalPertemuan = stats.totalHadir + stats.totalTidakHadir + stats.totalIzin + stats.totalSakit;

  // Calculate percentage (hadir / total * 100)
  if (stats.totalPertemuan > 0) {
    stats.persentase = (stats.totalHadir / stats.totalPertemuan) * 100;
  }

  // Determine predicate
  stats.predikat = getPredikatKehadiran(stats.persentase);

  // Generate narrative
  stats.deskripsi = generateDeskripsiKehadiran(stats);

  return stats;
}

/**
 * Get attendance trend comparing current period with previous
 * @param {string} jamaahId - Student ID
 * @param {object} currentStats - Current period statistics
 * @param {string} previousPeriodStart - Previous period start date
 * @param {string} previousPeriodEnd - Previous period end date
 * @returns {Promise<object>} Trend analysis
 */
export async function getKehadiranTrend(jamaahId, currentStats, previousPeriodStart, previousPeriodEnd) {
  const previousStats = await hitungKehadiran(jamaahId, previousPeriodStart, previousPeriodEnd);

  const diff = currentStats.persentase - previousStats.persentase;

  let trend = 'stabil';
  let trendDeskripsi = 'Tingkat kehadiran stabil dibandingkan periode sebelumnya.';

  if (diff > 5) {
    trend = 'meningkat';
    trendDeskripsi = `Tingkat kehadiran meningkat ${diff.toFixed(1)}% dari periode sebelumnya. Apresiasi untuk konsistensi yang lebih baik!`;
  } else if (diff < -5) {
    trend = 'menurun';
    trendDeskripsi = `Tingkat kehadiran menurun ${Math.abs(diff).toFixed(1)}% dari periode sebelumnya. Perlu perhatian untuk meningkatkan kehadiran.`;
  }

  return {
    trend,
    trendDeskripsi,
    persentaseSebelumnya: previousStats.persentase,
    persentaseSekarang: currentStats.persentase,
    selisih: diff
  };
}

/**
 * Get attendance summary for multiple students (for class reports)
 * @param {string[]} jamaahIds - Array of student IDs
 * @param {string} tanggalMulai - Period start date
 * @param {string} tanggalSelesai - Period end date
 * @returns {Promise<object[]>} Array of attendance summaries
 */
export async function hitungKehadiranKelas(jamaahIds, tanggalMulai, tanggalSelesai) {
  const summaries = [];

  for (const jamaahId of jamaahIds) {
    const stats = await hitungKehadiran(jamaahId, tanggalMulai, tanggalSelesai);
    summaries.push({
      jamaahId,
      ...stats
    });
  }

  return summaries;
}

/**
 * Get class-wide attendance statistics
 * @param {string[]} jamaahIds - Array of student IDs
 * @param {string} tanggalMulai - Period start date
 * @param {string} tanggalSelesai - Period end date
 * @returns {Promise<object>} Class statistics
 */
export async function getStatistikKehadiranKelas(jamaahIds, tanggalMulai, tanggalSelesai) {
  const summaries = await hitungKehadiranKelas(jamaahIds, tanggalMulai, tanggalSelesai);

  if (summaries.length === 0) {
    return {
      rataRataPersentase: 0,
      distribusiPredikat: {},
      totalJamaah: 0
    };
  }

  // Calculate average percentage
  const totalPersentase = summaries.reduce((sum, s) => sum + s.persentase, 0);
  const rataRataPersentase = totalPersentase / summaries.length;

  // Count predicate distribution
  const distribusiPredikat = {
    'Sangat Baik': 0,
    'Baik': 0,
    'Cukup': 0,
    'Perlu Pembinaan': 0
  };

  summaries.forEach(s => {
    distribusiPredikat[s.predikat]++;
  });

  return {
    rataRataPersentase,
    distribusiPredikat,
    totalJamaah: summaries.length,
    summaries
  };
}

export default {
  hitungKehadiran,
  getPredikatKehadiran,
  generateDeskripsiKehadiran,
  getKehadiranTrend,
  hitungKehadiranKelas,
  getStatistikKehadiranKelas
};
