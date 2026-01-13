/**
 * materiEngine.js - Subject Mastery Analysis Engine
 *
 * Analyzes student performance across subjects/materials:
 * - Calculate final scores from tugas, ujian, praktik, hafalan
 * - Determine status (lulus/proses/tertinggal)
 * - Generate predicates (A-E) and narratives
 * - Track competency achievement
 */

import { getDB } from '../db/db.js';

// Score weights for final calculation
const BOBOT_NILAI = {
  tugas: 0.20,     // 20% - Assignments
  ujian: 0.30,     // 30% - Exams
  praktik: 0.25,   // 25% - Practice
  hafalan: 0.25    // 25% - Memorization
};

// Predicate thresholds
const PREDIKAT_THRESHOLDS = {
  A: 90,  // >= 90: Istimewa
  B: 80,  // >= 80: Sangat Baik
  C: 70,  // >= 70: Baik
  D: 60,  // >= 60: Cukup
  // < 60: E - Perlu Bimbingan
};

// Status thresholds
const STATUS_THRESHOLDS = {
  LULUS: 70,      // >= 70: Lulus/Passed
  PROSES: 50,     // >= 50: In Progress
  // < 50: Tertinggal/Behind
};

/**
 * Calculate weighted final score
 * @param {object} scores - Individual scores { tugas, ujian, praktik, hafalan }
 * @returns {number} Final score (0-100)
 */
export function hitungNilaiAkhir(scores) {
  let totalBobot = 0;
  let nilaiTerbobot = 0;

  // Only count scores that exist
  if (scores.tugas !== null && scores.tugas !== undefined) {
    nilaiTerbobot += scores.tugas * BOBOT_NILAI.tugas;
    totalBobot += BOBOT_NILAI.tugas;
  }
  if (scores.ujian !== null && scores.ujian !== undefined) {
    nilaiTerbobot += scores.ujian * BOBOT_NILAI.ujian;
    totalBobot += BOBOT_NILAI.ujian;
  }
  if (scores.praktik !== null && scores.praktik !== undefined) {
    nilaiTerbobot += scores.praktik * BOBOT_NILAI.praktik;
    totalBobot += BOBOT_NILAI.praktik;
  }
  if (scores.hafalan !== null && scores.hafalan !== undefined) {
    nilaiTerbobot += scores.hafalan * BOBOT_NILAI.hafalan;
    totalBobot += BOBOT_NILAI.hafalan;
  }

  // Normalize if not all scores present
  if (totalBobot > 0) {
    return nilaiTerbobot / totalBobot;
  }

  return 0;
}

/**
 * Determine predicate from final score
 * @param {number} nilaiAkhir - Final score (0-100)
 * @returns {string} Predicate (A-E)
 */
export function getPredikat(nilaiAkhir) {
  if (nilaiAkhir >= PREDIKAT_THRESHOLDS.A) return 'A';
  if (nilaiAkhir >= PREDIKAT_THRESHOLDS.B) return 'B';
  if (nilaiAkhir >= PREDIKAT_THRESHOLDS.C) return 'C';
  if (nilaiAkhir >= PREDIKAT_THRESHOLDS.D) return 'D';
  return 'E';
}

/**
 * Get predicate description
 * @param {string} predikat - Predicate letter
 * @returns {string} Description
 */
export function getPredikatDeskripsi(predikat) {
  const deskripsi = {
    'A': 'Istimewa',
    'B': 'Sangat Baik',
    'C': 'Baik',
    'D': 'Cukup',
    'E': 'Perlu Bimbingan'
  };
  return deskripsi[predikat] || 'Tidak Diketahui';
}

/**
 * Determine mastery status
 * @param {number} nilaiAkhir - Final score
 * @returns {string} Status (lulus/proses/tertinggal)
 */
export function getStatus(nilaiAkhir) {
  if (nilaiAkhir >= STATUS_THRESHOLDS.LULUS) return 'lulus';
  if (nilaiAkhir >= STATUS_THRESHOLDS.PROSES) return 'proses';
  return 'tertinggal';
}

/**
 * Generate narrative description for subject performance
 * @param {object} data - Subject data including scores and subject info
 * @returns {string} Narrative description
 */
export function generateDeskripsiMateri(data) {
  const { namaMateri, nilaiAkhir, predikat, status, kekuatan, kelemahan } = data;

  let deskripsi = `Pada mata pelajaran ${namaMateri}, Ananda memperoleh nilai ${nilaiAkhir.toFixed(1)} dengan predikat ${predikat} (${getPredikatDeskripsi(predikat)}). `;

  if (status === 'lulus') {
    deskripsi += 'Ananda telah menguasai kompetensi yang diajarkan dengan baik. ';
  } else if (status === 'proses') {
    deskripsi += 'Ananda masih dalam proses penguasaan materi dan perlu bimbingan tambahan. ';
  } else {
    deskripsi += 'Ananda memerlukan pembinaan intensif untuk mengejar ketertinggalan. ';
  }

  if (kekuatan) {
    deskripsi += `Kekuatan: ${kekuatan}. `;
  }

  if (kelemahan) {
    deskripsi += `Area pengembangan: ${kelemahan}.`;
  }

  return deskripsi;
}

/**
 * Analyze subject performance for a student
 * @param {string} jamaahId - Student ID
 * @param {string} materiId - Subject/material ID
 * @param {string} periode - Period identifier
 * @returns {Promise<object>} Subject analysis
 */
export async function analisisMateri(jamaahId, materiId, periode) {
  const db = getDB();

  // Get assessment scores for this subject
  const query = `
    SELECT
      pm.nilai,
      pm.tipe_nilai,
      p.kategori_penilaian,
      m.nama as nama_materi,
      m.kategori as kategori_materi
    FROM penilaian_materi pm
    INNER JOIN penilaian p ON pm.penilaian_id = p.id
    LEFT JOIN materi m ON pm.materi_id = m.id
    WHERE p.jamaah_id = ?
      AND pm.materi_id = ?
      AND p.tanggal LIKE ?
      AND pm.is_deleted = 0
      AND p.is_deleted = 0
    ORDER BY p.tanggal DESC
  `;

  // Extract year from periode (e.g., '2024-S1' -> '2024%')
  const tahun = periode.split('-')[0] + '%';
  const results = db.exec(query, [jamaahId, materiId, tahun]);

  // Aggregate scores by type
  const scores = {
    tugas: [],
    ujian: [],
    praktik: [],
    hafalan: []
  };

  let namaMateri = 'Materi';
  let kategoriMateri = '';

  if (results.length > 0 && results[0].values) {
    results[0].values.forEach(row => {
      const nilai = row[0];
      const tipeNilai = row[1];
      namaMateri = row[3] || namaMateri;
      kategoriMateri = row[4] || kategoriMateri;

      if (tipeNilai && scores[tipeNilai]) {
        scores[tipeNilai].push(nilai);
      }
    });
  }

  // Calculate average for each type
  const avgScores = {
    tugas: scores.tugas.length > 0 ? scores.tugas.reduce((a, b) => a + b, 0) / scores.tugas.length : null,
    ujian: scores.ujian.length > 0 ? scores.ujian.reduce((a, b) => a + b, 0) / scores.ujian.length : null,
    praktik: scores.praktik.length > 0 ? scores.praktik.reduce((a, b) => a + b, 0) / scores.praktik.length : null,
    hafalan: scores.hafalan.length > 0 ? scores.hafalan.reduce((a, b) => a + b, 0) / scores.hafalan.length : null
  };

  // Calculate final score
  const nilaiAkhir = hitungNilaiAkhir(avgScores);
  const predikat = getPredikat(nilaiAkhir);
  const status = getStatus(nilaiAkhir);

  // Identify strengths and weaknesses
  const kekuatan = identifyKekuatan(avgScores);
  const kelemahan = identifyKelemahan(avgScores);

  // Generate description
  const deskripsi = generateDeskripsiMateri({
    namaMateri,
    nilaiAkhir,
    predikat,
    status,
    kekuatan,
    kelemahan
  });

  return {
    materiId,
    namaMateri,
    kategoriMateri,
    nilaiTugas: avgScores.tugas,
    nilaiUjian: avgScores.ujian,
    nilaiPraktik: avgScores.praktik,
    nilaiHafalan: avgScores.hafalan,
    nilaiAkhir,
    predikat,
    predikatDeskripsi: getPredikatDeskripsi(predikat),
    status,
    kekuatan,
    kelemahan,
    deskripsi
  };
}

/**
 * Identify strengths from scores
 * @param {object} scores - Score breakdown
 * @returns {string} Strengths description
 */
function identifyKekuatan(scores) {
  const areas = [];
  const threshold = 80;

  if (scores.tugas !== null && scores.tugas >= threshold) {
    areas.push('pengerjaan tugas');
  }
  if (scores.ujian !== null && scores.ujian >= threshold) {
    areas.push('penguasaan teori (ujian)');
  }
  if (scores.praktik !== null && scores.praktik >= threshold) {
    areas.push('kemampuan praktik');
  }
  if (scores.hafalan !== null && scores.hafalan >= threshold) {
    areas.push('daya hafal');
  }

  if (areas.length === 0) return null;
  return areas.join(', ');
}

/**
 * Identify weaknesses from scores
 * @param {object} scores - Score breakdown
 * @returns {string} Weaknesses description
 */
function identifyKelemahan(scores) {
  const areas = [];
  const threshold = 70;

  if (scores.tugas !== null && scores.tugas < threshold) {
    areas.push('konsistensi pengerjaan tugas');
  }
  if (scores.ujian !== null && scores.ujian < threshold) {
    areas.push('pemahaman teori');
  }
  if (scores.praktik !== null && scores.praktik < threshold) {
    areas.push('penerapan praktik');
  }
  if (scores.hafalan !== null && scores.hafalan < threshold) {
    areas.push('hafalan');
  }

  if (areas.length === 0) return null;
  return areas.join(', ');
}

/**
 * Analyze all subjects for a student in a period
 * @param {string} jamaahId - Student ID
 * @param {string} periode - Period identifier
 * @returns {Promise<object>} Complete subject analysis
 */
export async function analisisSemuaMateri(jamaahId, periode) {
  const db = getDB();

  // Get all subjects the student has been assessed on
  const query = `
    SELECT DISTINCT pm.materi_id
    FROM penilaian_materi pm
    INNER JOIN penilaian p ON pm.penilaian_id = p.id
    WHERE p.jamaah_id = ?
      AND p.tanggal LIKE ?
      AND pm.is_deleted = 0
      AND p.is_deleted = 0
  `;

  const tahun = periode.split('-')[0] + '%';
  const results = db.exec(query, [jamaahId, tahun]);

  const materiIds = [];
  if (results.length > 0 && results[0].values) {
    results[0].values.forEach(row => {
      if (row[0]) materiIds.push(row[0]);
    });
  }

  // Analyze each subject
  const analisisMateriList = [];
  for (const materiId of materiIds) {
    const analisis = await analisisMateri(jamaahId, materiId, periode);
    analisisMateriList.push(analisis);
  }

  // Calculate overall statistics
  const totalMateri = analisisMateriList.length;
  const materiLulus = analisisMateriList.filter(m => m.status === 'lulus').length;
  const materiProses = analisisMateriList.filter(m => m.status === 'proses').length;
  const materiTertinggal = analisisMateriList.filter(m => m.status === 'tertinggal').length;

  const rataRataNilai = totalMateri > 0
    ? analisisMateriList.reduce((sum, m) => sum + m.nilaiAkhir, 0) / totalMateri
    : 0;

  // Distribute by predicate
  const distribusiPredikat = {
    'A': analisisMateriList.filter(m => m.predikat === 'A').length,
    'B': analisisMateriList.filter(m => m.predikat === 'B').length,
    'C': analisisMateriList.filter(m => m.predikat === 'C').length,
    'D': analisisMateriList.filter(m => m.predikat === 'D').length,
    'E': analisisMateriList.filter(m => m.predikat === 'E').length
  };

  return {
    totalMateri,
    materiLulus,
    materiProses,
    materiTertinggal,
    rataRataNilai,
    predikatKeseluruhan: getPredikat(rataRataNilai),
    distribusiPredikat,
    detailMateri: analisisMateriList
  };
}

/**
 * Generate recommendation for a subject
 * @param {object} analisis - Subject analysis
 * @returns {string} Recommendation text
 */
export function generateRekomendasiMateri(analisis) {
  const { namaMateri, status, kelemahan, nilaiAkhir, predikat } = analisis;

  if (status === 'lulus' && predikat === 'A') {
    return `Pertahankan prestasi pada ${namaMateri}. Ananda dapat membantu teman yang masih kesulitan.`;
  }

  if (status === 'lulus') {
    return `Tingkatkan konsistensi belajar ${namaMateri} untuk mencapai hasil yang lebih optimal.`;
  }

  if (status === 'proses') {
    let rekomendasi = `Perlu bimbingan tambahan pada ${namaMateri}.`;
    if (kelemahan) {
      rekomendasi += ` Fokus perbaikan pada: ${kelemahan}.`;
    }
    return rekomendasi;
  }

  // tertinggal
  let rekomendasi = `Memerlukan pembinaan intensif pada ${namaMateri}.`;
  if (kelemahan) {
    rekomendasi += ` Area yang perlu dikejar: ${kelemahan}.`;
  }
  rekomendasi += ' Disarankan untuk mengikuti kelas remedial atau bimbingan pribadi.';
  return rekomendasi;
}

export default {
  hitungNilaiAkhir,
  getPredikat,
  getPredikatDeskripsi,
  getStatus,
  generateDeskripsiMateri,
  analisisMateri,
  analisisSemuaMateri,
  generateRekomendasiMateri
};
