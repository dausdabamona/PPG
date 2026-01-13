/**
 * raporEngine.js - Academic Report Orchestrator
 *
 * Main orchestrator for generating complete academic reports (rapor).
 * Combines:
 * - Attendance analysis (kehadiranEngine)
 * - Subject mastery (materiEngine)
 * - Character assessment (akhlaqEngine)
 * - Rule-based recommendations (rekomendasiEngine)
 *
 * Model C: Numeric + Predicate + Narrative + Recommendation
 */

import { getDB } from '../db/db.js';
import { v4 as uuidv4 } from '../db/uuid.js';
import kehadiranEngine from './kehadiranEngine.js';
import materiEngine from './materiEngine.js';
import akhlaqEngine from './akhlaqEngine.js';
import rekomendasiEngine from './rekomendasiEngine.js';

/**
 * Generate complete academic report for a student
 * @param {string} jamaahId - Student ID
 * @param {object} periodeConfig - Period configuration
 * @param {string} deviceId - Device ID
 * @returns {Promise<object>} Complete rapor
 */
export async function generateRapor(jamaahId, periodeConfig, deviceId) {
  const db = getDB();
  const {
    periode,
    tahunAjaran,
    semester,
    tanggalMulai,
    tanggalSelesai,
    tingkatId,
    namaTingkat
  } = periodeConfig;

  // Get student info
  const jamaahQuery = `SELECT nama FROM jamaah WHERE id = ? AND is_deleted = 0`;
  const jamaahResult = db.exec(jamaahQuery, [jamaahId]);
  const namaJamaah = jamaahResult.length > 0 && jamaahResult[0].values
    ? jamaahResult[0].values[0][0]
    : 'Unknown';

  // 1. Calculate attendance
  const kehadiranStats = await kehadiranEngine.hitungKehadiran(
    jamaahId,
    tanggalMulai,
    tanggalSelesai
  );

  // 2. Analyze subjects
  const materiStats = await materiEngine.analisisSemuaMateri(jamaahId, periode);

  // 3. Calculate character assessment
  const akhlaqStats = await akhlaqEngine.hitungAkhlaq(
    jamaahId,
    tanggalMulai,
    tanggalSelesai
  );

  // 4. Calculate overall predicate
  const overallPredicate = calculateOverallPredicate(kehadiranStats, materiStats, akhlaqStats);

  // 5. Generate overall description
  const overallDescription = generateOverallDescription(
    namaJamaah,
    kehadiranStats,
    materiStats,
    akhlaqStats,
    overallPredicate
  );

  // Create rapor_periode record
  const raporId = uuidv4();

  const insertRaporQuery = `
    INSERT INTO rapor_periode (
      id, jamaah_id, nama_jamaah, periode, tahun_ajaran, semester,
      tanggal_mulai, tanggal_selesai, tingkat_id, nama_tingkat,
      total_hadir, total_tidak_hadir, total_izin, total_sakit,
      total_pertemuan, persentase_hadir, predikat_kehadiran,
      deskripsi_kehadiran, predikat_keseluruhan, deskripsi_keseluruhan,
      status, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
  `;

  db.run(insertRaporQuery, [
    raporId,
    jamaahId,
    namaJamaah,
    periode,
    tahunAjaran,
    semester,
    tanggalMulai,
    tanggalSelesai,
    tingkatId || null,
    namaTingkat || null,
    kehadiranStats.totalHadir,
    kehadiranStats.totalTidakHadir,
    kehadiranStats.totalIzin,
    kehadiranStats.totalSakit,
    kehadiranStats.totalPertemuan,
    kehadiranStats.persentase,
    kehadiranStats.predikat,
    kehadiranStats.deskripsi,
    overallPredicate,
    overallDescription,
    deviceId
  ]);

  // Save subject records
  for (const materi of materiStats.detailMateri) {
    await saveRaporMateri(raporId, materi, deviceId);
  }

  // Save character assessment
  await saveRaporAkhlaq(raporId, akhlaqStats, deviceId);

  // 6. Generate and save recommendations
  const ruleData = {
    kehadiran: kehadiranStats,
    materi: materiStats,
    akhlaq: akhlaqStats
  };

  const recommendations = rekomendasiEngine.evaluateRules(ruleData);
  await rekomendasiEngine.saveRekomendasi(raporId, recommendations, deviceId);

  return {
    id: raporId,
    jamaahId,
    namaJamaah,
    periode,
    tahunAjaran,
    semester,
    kehadiran: kehadiranStats,
    materi: materiStats,
    akhlaq: akhlaqStats,
    predikatKeseluruhan: overallPredicate,
    deskripsiKeseluruhan: overallDescription,
    rekomendasi: recommendations,
    status: 'draft'
  };
}

/**
 * Save subject assessment to rapor_materi
 */
async function saveRaporMateri(raporId, materi, deviceId) {
  const db = getDB();
  const id = uuidv4();

  const query = `
    INSERT INTO rapor_materi (
      id, rapor_id, materi_id, kode_materi, nama_materi, kategori_materi,
      nilai_tugas, nilai_ujian, nilai_praktik, nilai_hafalan, nilai_akhir,
      status, predikat, deskripsi, kekuatan, kelemahan, rekomendasi, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    id,
    raporId,
    materi.materiId,
    null, // kode_materi
    materi.namaMateri,
    materi.kategoriMateri,
    materi.nilaiTugas,
    materi.nilaiUjian,
    materi.nilaiPraktik,
    materi.nilaiHafalan,
    materi.nilaiAkhir,
    materi.status,
    materi.predikat,
    materi.deskripsi,
    materi.kekuatan,
    materi.kelemahan,
    materiEngine.generateRekomendasiMateri(materi),
    deviceId
  ]);

  return id;
}

/**
 * Save character assessment to rapor_akhlaq
 */
async function saveRaporAkhlaq(raporId, akhlaq, deviceId) {
  const db = getDB();
  const id = uuidv4();

  const query = `
    INSERT INTO rapor_akhlaq (
      id, rapor_id,
      kedisiplinan_nilai, kedisiplinan_predikat, kedisiplinan_deskripsi,
      adab_nilai, adab_predikat, adab_deskripsi,
      kemandirian_nilai, kemandirian_predikat, kemandirian_deskripsi,
      kebersihan_nilai, kebersihan_predikat, kebersihan_deskripsi,
      tanggung_jawab_nilai, tanggung_jawab_predikat, tanggung_jawab_deskripsi,
      kejujuran_nilai, kejujuran_predikat, kejujuran_deskripsi,
      kepedulian_nilai, kepedulian_predikat, kepedulian_deskripsi,
      kerjasama_nilai, kerjasama_predikat, kerjasama_deskripsi,
      nilai_rata_rata, predikat_keseluruhan, deskripsi_keseluruhan,
      kekuatan_karakter, area_pengembangan, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const getDimensi = (nama) => akhlaq.dimensi[nama] || { nilai: null, predikat: null, deskripsi: null };

  const kedisiplinan = getDimensi('kedisiplinan');
  const adab = getDimensi('adab');
  const kemandirian = getDimensi('kemandirian');
  const kebersihan = getDimensi('kebersihan');
  const tanggungJawab = getDimensi('tanggung_jawab');
  const kejujuran = getDimensi('kejujuran');
  const kepedulian = getDimensi('kepedulian');
  const kerjasama = getDimensi('kerjasama');

  db.run(query, [
    id,
    raporId,
    kedisiplinan.nilai, kedisiplinan.predikat, kedisiplinan.deskripsi,
    adab.nilai, adab.predikat, adab.deskripsi,
    kemandirian.nilai, kemandirian.predikat, kemandirian.deskripsi,
    kebersihan.nilai, kebersihan.predikat, kebersihan.deskripsi,
    tanggungJawab.nilai, tanggungJawab.predikat, tanggungJawab.deskripsi,
    kejujuran.nilai, kejujuran.predikat, kejujuran.deskripsi,
    kepedulian.nilai, kepedulian.predikat, kepedulian.deskripsi,
    kerjasama.nilai, kerjasama.predikat, kerjasama.deskripsi,
    akhlaq.nilaiRataRata,
    akhlaq.predikatKeseluruhan,
    akhlaq.deskripsiKeseluruhan,
    akhlaq.kekuatanKarakter?.join(', ') || null,
    akhlaq.areaPengembangan?.join(', ') || null,
    deviceId
  ]);

  return id;
}

/**
 * Calculate overall predicate from all components
 */
function calculateOverallPredicate(kehadiran, materi, akhlaq) {
  // Weighted scoring: Kehadiran 20%, Akademik 50%, Akhlaq 30%
  const kehadiranScore = getPredicateScore(kehadiran.predikat, 'kehadiran');
  const akademikScore = getPredicateScore(materi.predikatKeseluruhan, 'akademik');
  const akhlaqScore = getPredicateScore(akhlaq.predikatKeseluruhan, 'akhlaq');

  const weightedScore = (kehadiranScore * 0.20) + (akademikScore * 0.50) + (akhlaqScore * 0.30);

  if (weightedScore >= 90) return 'Istimewa';
  if (weightedScore >= 80) return 'Sangat Baik';
  if (weightedScore >= 70) return 'Baik';
  if (weightedScore >= 60) return 'Cukup';
  return 'Perlu Pembinaan';
}

/**
 * Convert predicate to numeric score
 */
function getPredicateScore(predikat, type) {
  const scoreMap = {
    kehadiran: {
      'Sangat Baik': 100,
      'Baik': 80,
      'Cukup': 70,
      'Perlu Pembinaan': 50
    },
    akademik: {
      'A': 95,
      'B': 85,
      'C': 75,
      'D': 65,
      'E': 50
    },
    akhlaq: {
      'Sangat Baik': 100,
      'Baik': 80,
      'Cukup': 70,
      'Perlu Bimbingan': 50
    }
  };

  return scoreMap[type]?.[predikat] || 50;
}

/**
 * Generate overall narrative description
 */
function generateOverallDescription(namaJamaah, kehadiran, materi, akhlaq, overallPredicate) {
  let deskripsi = `Assalamu'alaikum warahmatullahi wabarakatuh.\n\n`;
  deskripsi += `Berikut adalah laporan perkembangan Ananda ${namaJamaah}.\n\n`;

  // Attendance summary
  deskripsi += `**Kehadiran:** Ananda hadir ${kehadiran.totalHadir} dari ${kehadiran.totalPertemuan} pertemuan (${kehadiran.persentase.toFixed(1)}%), dengan predikat ${kehadiran.predikat}.\n\n`;

  // Academic summary
  deskripsi += `**Akademik:** Rata-rata nilai ${materi.rataRataNilai.toFixed(1)} dengan predikat ${materi.predikatKeseluruhan}. `;
  deskripsi += `${materi.materiLulus} materi lulus, ${materi.materiProses} dalam proses, ${materi.materiTertinggal} tertinggal.\n\n`;

  // Character summary
  deskripsi += `**Akhlaq:** Perkembangan karakter dengan predikat ${akhlaq.predikatKeseluruhan}. `;
  if (akhlaq.kekuatanKarakter?.length > 0) {
    deskripsi += `Kekuatan pada ${akhlaq.kekuatanKarakter.join(', ')}. `;
  }
  if (akhlaq.areaPengembangan?.length > 0) {
    deskripsi += `Area pengembangan: ${akhlaq.areaPengembangan.join(', ')}.`;
  }
  deskripsi += '\n\n';

  // Overall conclusion
  deskripsi += `**Kesimpulan:** Secara keseluruhan, Ananda ${namaJamaah} mendapat predikat **${overallPredicate}**. `;

  if (overallPredicate === 'Istimewa' || overallPredicate === 'Sangat Baik') {
    deskripsi += 'Alhamdulillah, prestasi yang sangat membanggakan. Pertahankan!';
  } else if (overallPredicate === 'Baik') {
    deskripsi += 'Terus tingkatkan untuk hasil yang lebih optimal.';
  } else if (overallPredicate === 'Cukup') {
    deskripsi += 'Dengan bimbingan yang tepat, Insya Allah dapat meningkat.';
  } else {
    deskripsi += 'Diperlukan pembinaan intensif dari orang tua dan mubaligh.';
  }

  deskripsi += '\n\nWassalamu\'alaikum warahmatullahi wabarakatuh.';

  return deskripsi;
}

/**
 * Get existing rapor by ID
 */
export async function getRaporById(raporId) {
  const db = getDB();

  // Get main rapor
  const raporQuery = `SELECT * FROM rapor_periode WHERE id = ? AND is_deleted = 0`;
  const raporResult = db.exec(raporQuery, [raporId]);

  if (raporResult.length === 0 || !raporResult[0].values) {
    return null;
  }

  const columns = raporResult[0].columns;
  const row = raporResult[0].values[0];
  const rapor = {};
  columns.forEach((col, idx) => {
    rapor[col] = row[idx];
  });

  // Get materi details
  const materiQuery = `SELECT * FROM rapor_materi WHERE rapor_id = ? AND is_deleted = 0`;
  const materiResult = db.exec(materiQuery, [raporId]);
  rapor.materi = parseQueryResults(materiResult);

  // Get akhlaq
  const akhlaqQuery = `SELECT * FROM rapor_akhlaq WHERE rapor_id = ? AND is_deleted = 0`;
  const akhlaqResult = db.exec(akhlaqQuery, [raporId]);
  rapor.akhlaq = parseQueryResults(akhlaqResult)[0] || null;

  // Get recommendations
  rapor.rekomendasi = await rekomendasiEngine.getRekomendasi(raporId);

  return rapor;
}

/**
 * Get rapor list for a student
 */
export async function getRaporListByJamaah(jamaahId) {
  const db = getDB();

  const query = `
    SELECT id, periode, tahun_ajaran, semester, predikat_keseluruhan, status, created_at
    FROM rapor_periode
    WHERE jamaah_id = ? AND is_deleted = 0
    ORDER BY created_at DESC
  `;

  const result = db.exec(query, [jamaahId]);
  return parseQueryResults(result);
}

/**
 * Finalize rapor (change status to final)
 */
export async function finalizeRapor(raporId, finalisasiOleh) {
  const db = getDB();

  const query = `
    UPDATE rapor_periode
    SET status = 'final',
        tanggal_finalisasi = datetime('now'),
        difinalisasi_oleh = ?
    WHERE id = ?
  `;

  db.run(query, [finalisasiOleh, raporId]);
  return true;
}

/**
 * Publish rapor (make it visible to parents)
 */
export async function publishRapor(raporId) {
  const db = getDB();

  const query = `
    UPDATE rapor_periode
    SET status = 'published'
    WHERE id = ? AND status = 'final'
  `;

  db.run(query, [raporId]);
  return true;
}

/**
 * Add mubaligh notes to rapor
 */
export async function addCatatanMubaligh(raporId, catatan) {
  const db = getDB();

  const query = `
    UPDATE rapor_periode
    SET catatan_mubaligh = ?
    WHERE id = ?
  `;

  db.run(query, [catatan, raporId]);
  return true;
}

/**
 * Add expert notes to rapor
 */
export async function addCatatanPakar(raporId, catatan) {
  const db = getDB();

  const query = `
    UPDATE rapor_periode
    SET catatan_pakar = ?
    WHERE id = ?
  `;

  db.run(query, [catatan, raporId]);
  return true;
}

/**
 * Helper: Parse query results to array of objects
 */
function parseQueryResults(results) {
  if (results.length === 0 || !results[0].values) {
    return [];
  }

  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

/**
 * Generate rapor for all students in a class
 */
export async function generateRaporKelas(kelasId, periodeConfig, deviceId) {
  const db = getDB();

  // Get all students in the class
  const query = `
    SELECT jamaah_id FROM jamaah_kelas
    WHERE kelas_id = ? AND status = 'aktif' AND is_deleted = 0
  `;

  const result = db.exec(query, [kelasId]);
  const jamaahIds = result.length > 0 && result[0].values
    ? result[0].values.map(row => row[0])
    : [];

  const raporList = [];
  for (const jamaahId of jamaahIds) {
    try {
      const rapor = await generateRapor(jamaahId, periodeConfig, deviceId);
      raporList.push(rapor);
    } catch (error) {
      console.error(`Error generating rapor for ${jamaahId}:`, error);
      raporList.push({ jamaahId, error: error.message });
    }
  }

  return raporList;
}

export default {
  generateRapor,
  getRaporById,
  getRaporListByJamaah,
  finalizeRapor,
  publishRapor,
  addCatatanMubaligh,
  addCatatanPakar,
  generateRaporKelas
};
