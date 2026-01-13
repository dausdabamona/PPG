/**
 * rekomendasiEngine.js - Rule-Based Recommendation Engine
 *
 * Generates targeted recommendations based on:
 * - Attendance patterns
 * - Academic performance
 * - Character assessment
 *
 * Rules are configurable and can be extended.
 * Recommendations are targeted to specific roles (orang_tua, mubaligh, pakar, jamaah).
 */

import { getDB } from '../db/db.js';
import { v4 as uuidv4 } from '../db/uuid.js';

// Rule definitions
const RULES = [
  // ============== Attendance Rules ==============
  {
    id: 'kehadiran_rendah',
    kategori: 'kehadiran',
    kondisi: (data) => data.kehadiran?.persentase < 70,
    prioritas: 'tinggi',
    targetPeran: ['orang_tua', 'mubaligh'],
    generate: (data) => ({
      judul: 'Tingkatkan Kehadiran',
      rekomendasi_text: `Kehadiran Ananda hanya ${data.kehadiran.persentase.toFixed(1)}%. Perlu upaya bersama untuk meningkatkan partisipasi dalam kegiatan pengajian.`,
      alasan: 'Kehadiran di bawah 70% akan berdampak pada pemahaman materi.',
      langkah_tindakan: '1. Diskusikan penyebab ketidakhadiran\n2. Buat komitmen kehadiran mingguan\n3. Evaluasi progress setiap minggu',
      target_tindak_lanjut: 'Kehadiran minimal 80% dalam 1 bulan',
      durasi_target: '1 bulan'
    })
  },
  {
    id: 'kehadiran_menurun',
    kategori: 'kehadiran',
    kondisi: (data) => data.kehadiran?.trend === 'menurun',
    prioritas: 'normal',
    targetPeran: ['orang_tua'],
    generate: (data) => ({
      judul: 'Perhatikan Penurunan Kehadiran',
      rekomendasi_text: 'Kehadiran Ananda menurun dibandingkan periode sebelumnya. Perlu perhatian untuk mencegah penurunan lebih lanjut.',
      alasan: 'Penurunan kehadiran dapat mengindikasikan masalah yang perlu ditangani.',
      langkah_tindakan: '1. Tanyakan apakah ada kendala mengikuti pengajian\n2. Pastikan jadwal tidak bentrok\n3. Berikan motivasi dan dukungan',
      target_tindak_lanjut: 'Stabilkan atau tingkatkan kehadiran',
      durasi_target: '2 minggu'
    })
  },

  // ============== Academic Rules ==============
  {
    id: 'materi_tertinggal',
    kategori: 'akademik',
    kondisi: (data) => data.materi?.materiTertinggal > 0,
    prioritas: 'tinggi',
    targetPeran: ['orang_tua', 'mubaligh'],
    generate: (data) => ({
      judul: 'Perlu Bimbingan Akademik',
      rekomendasi_text: `Ananda tertinggal pada ${data.materi.materiTertinggal} mata pelajaran. Diperlukan bimbingan tambahan.`,
      alasan: 'Ketertinggalan materi akan menyulitkan pemahaman materi selanjutnya.',
      langkah_tindakan: '1. Identifikasi materi yang tertinggal\n2. Atur jadwal belajar tambahan\n3. Libatkan tutor jika diperlukan',
      target_tindak_lanjut: 'Mengejar ketertinggalan dalam 1 bulan',
      durasi_target: '1 bulan'
    })
  },
  {
    id: 'hafalan_lemah',
    kategori: 'akademik',
    kondisi: (data) => {
      const hafalanMateri = data.materi?.detailMateri?.filter(m => m.nilaiHafalan !== null && m.nilaiHafalan < 70);
      return hafalanMateri && hafalanMateri.length > 0;
    },
    prioritas: 'normal',
    targetPeran: ['orang_tua', 'jamaah'],
    generate: (data) => ({
      judul: 'Tingkatkan Hafalan',
      rekomendasi_text: 'Kemampuan hafalan Ananda perlu ditingkatkan. Latihan rutin di rumah akan sangat membantu.',
      alasan: 'Hafalan adalah dasar penting dalam pembelajaran agama.',
      langkah_tindakan: '1. Tetapkan waktu muroja\'ah harian (15-20 menit)\n2. Gunakan metode pengulangan bertahap\n3. Berikan apresiasi untuk setiap kemajuan',
      target_tindak_lanjut: 'Nilai hafalan minimal 70',
      durasi_target: '1 bulan'
    })
  },
  {
    id: 'prestasi_tinggi',
    kategori: 'akademik',
    kondisi: (data) => data.materi?.rataRataNilai >= 90,
    prioritas: 'rendah',
    targetPeran: ['jamaah', 'orang_tua'],
    generate: (data) => ({
      judul: 'Pertahankan Prestasi',
      rekomendasi_text: `Alhamdulillah, Ananda meraih prestasi yang sangat baik dengan nilai rata-rata ${data.materi.rataRataNilai.toFixed(1)}. Pertahankan!`,
      alasan: 'Apresiasi dan dorongan positif penting untuk mempertahankan motivasi.',
      langkah_tindakan: '1. Berikan apresiasi yang tulus\n2. Dorong untuk membantu teman\n3. Tantang dengan materi yang lebih tinggi',
      target_tindak_lanjut: 'Pertahankan prestasi dan jadilah teladan',
      durasi_target: 'berkelanjutan'
    })
  },

  // ============== Character Rules ==============
  {
    id: 'akhlaq_perlu_bimbingan',
    kategori: 'akhlaq',
    kondisi: (data) => data.akhlaq?.predikatKeseluruhan === 'Perlu Bimbingan',
    prioritas: 'urgent',
    targetPeran: ['orang_tua', 'mubaligh', 'pakar'],
    generate: (data) => ({
      judul: 'Pembinaan Akhlaq Intensif',
      rekomendasi_text: 'Perkembangan akhlaq Ananda memerlukan pembinaan intensif dari orang tua dan mubaligh.',
      alasan: 'Akhlaq adalah fondasi kepribadian yang harus dibangun sejak dini.',
      langkah_tindakan: '1. Jadwalkan pertemuan khusus dengan mubaligh\n2. Buat program pembinaan di rumah\n3. Evaluasi mingguan dengan catatan progress',
      target_tindak_lanjut: 'Predikat akhlaq minimal "Cukup" dalam 2 bulan',
      durasi_target: '2 bulan'
    })
  },
  {
    id: 'akhlaq_area_pengembangan',
    kategori: 'akhlaq',
    kondisi: (data) => data.akhlaq?.areaPengembangan?.length > 0,
    prioritas: 'normal',
    targetPeran: ['orang_tua'],
    generate: (data) => ({
      judul: 'Pengembangan Karakter',
      rekomendasi_text: `Area karakter yang perlu dikembangkan: ${data.akhlaq.areaPengembangan.join(', ')}.`,
      alasan: 'Fokus pada area spesifik akan memberikan hasil yang lebih efektif.',
      langkah_tindakan: '1. Pilih satu aspek untuk difokuskan\n2. Buat aktivitas harian terkait aspek tersebut\n3. Berikan teladan dan apresiasi',
      target_tindak_lanjut: 'Peningkatan minimal 1 tingkat pada aspek yang difokuskan',
      durasi_target: '1 bulan'
    })
  },
  {
    id: 'akhlaq_menurun',
    kategori: 'akhlaq',
    kondisi: (data) => data.akhlaq?.perkembangan === 'menurun',
    prioritas: 'tinggi',
    targetPeran: ['orang_tua', 'mubaligh'],
    generate: (data) => ({
      judul: 'Perhatikan Penurunan Akhlaq',
      rekomendasi_text: 'Perkembangan akhlaq Ananda menurun dibandingkan periode sebelumnya. Perlu perhatian serius.',
      alasan: 'Penurunan akhlaq mungkin mengindikasikan masalah yang lebih dalam.',
      langkah_tindakan: '1. Diskusikan dengan Ananda secara personal\n2. Koordinasikan dengan mubaligh\n3. Identifikasi faktor penyebab',
      target_tindak_lanjut: 'Stabilkan dan pulihkan ke tingkat sebelumnya',
      durasi_target: '1 bulan'
    })
  },

  // ============== Parent Self-Learning Rules ==============
  {
    id: 'kelas_mandiri_aktif',
    kategori: 'kelas_mandiri',
    kondisi: (data) => data.kelasMandiri?.partisipasiAktif === true,
    prioritas: 'rendah',
    targetPeran: ['orang_tua'],
    generate: (data) => ({
      judul: 'Apresiasi Partisipasi Kelas Mandiri',
      rekomendasi_text: 'Terima kasih atas partisipasi aktif dalam kelas mandiri orang tua. Ini sangat membantu perkembangan Ananda.',
      alasan: 'Keterlibatan orang tua adalah kunci keberhasilan pendidikan.',
      langkah_tindakan: '1. Lanjutkan kehadiran di kelas mandiri\n2. Terapkan ilmu yang dipelajari di rumah\n3. Berbagi pengalaman dengan orang tua lain',
      target_tindak_lanjut: 'Pertahankan partisipasi aktif',
      durasi_target: 'berkelanjutan'
    })
  },
  {
    id: 'kelas_mandiri_tidak_aktif',
    kategori: 'kelas_mandiri',
    kondisi: (data) => data.kelasMandiri?.partisipasiAktif === false,
    prioritas: 'normal',
    targetPeran: ['orang_tua'],
    generate: (data) => ({
      judul: 'Ajakan Kelas Mandiri Orang Tua',
      rekomendasi_text: 'Mengundang Bapak/Ibu untuk berpartisipasi dalam kelas mandiri orang tua untuk mendukung perkembangan Ananda.',
      alasan: 'Ilmu parenting Islami akan membantu pembinaan di rumah.',
      langkah_tindakan: '1. Cek jadwal kelas mandiri\n2. Prioritaskan kehadiran\n3. Konsultasikan kendala jika ada',
      target_tindak_lanjut: 'Kehadiran minimal 75% di kelas mandiri',
      durasi_target: '1 semester'
    })
  },

  // ============== Health/Wellbeing Rules ==============
  {
    id: 'sakit_tinggi',
    kategori: 'kesehatan',
    kondisi: (data) => data.kehadiran?.totalSakit >= 3,
    prioritas: 'normal',
    targetPeran: ['orang_tua'],
    generate: (data) => ({
      judul: 'Perhatikan Kesehatan',
      rekomendasi_text: `Ananda tercatat sakit sebanyak ${data.kehadiran.totalSakit}x dalam periode ini. Mohon perhatikan kondisi kesehatan.`,
      alasan: 'Kesehatan yang baik adalah modal utama untuk belajar.',
      langkah_tindakan: '1. Pastikan asupan gizi seimbang\n2. Cukupkan waktu istirahat\n3. Periksakan ke dokter jika perlu',
      target_tindak_lanjut: 'Kondisi kesehatan prima',
      durasi_target: 'berkelanjutan'
    })
  }
];

/**
 * Evaluate all rules against student data
 * @param {object} data - Combined data (kehadiran, materi, akhlaq)
 * @returns {object[]} List of triggered recommendations
 */
export function evaluateRules(data) {
  const recommendations = [];

  for (const rule of RULES) {
    try {
      if (rule.kondisi(data)) {
        const generated = rule.generate(data);
        recommendations.push({
          ruleId: rule.id,
          kategori: rule.kategori,
          prioritas: rule.prioritas,
          targetPeran: rule.targetPeran,
          ...generated
        });
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  // Sort by priority
  const priorityOrder = { urgent: 0, tinggi: 1, normal: 2, rendah: 3 };
  recommendations.sort((a, b) => priorityOrder[a.prioritas] - priorityOrder[b.prioritas]);

  return recommendations;
}

/**
 * Filter recommendations by target role
 * @param {object[]} recommendations - All recommendations
 * @param {string} peran - Target role
 * @returns {object[]} Filtered recommendations
 */
export function filterByPeran(recommendations, peran) {
  return recommendations.filter(r =>
    r.targetPeran.includes(peran) || r.targetPeran.includes('semua')
  );
}

/**
 * Save recommendations to database
 * @param {string} raporId - Rapor period ID
 * @param {object[]} recommendations - Generated recommendations
 * @param {string} deviceId - Device ID
 * @returns {Promise<string[]>} Saved recommendation IDs
 */
export async function saveRekomendasi(raporId, recommendations, deviceId) {
  const db = getDB();
  const savedIds = [];

  for (const rec of recommendations) {
    for (const peran of rec.targetPeran) {
      const id = uuidv4();

      const insertQuery = `
        INSERT INTO rapor_rekomendasi (
          id, rapor_id, untuk_peran, kategori, judul, rekomendasi_text,
          alasan, langkah_tindakan, target_tindak_lanjut, durasi_target,
          prioritas, status_tindak_lanjut, sumber, rule_id, device_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'sistem', ?, ?)
      `;

      db.run(insertQuery, [
        id,
        raporId,
        peran,
        rec.kategori,
        rec.judul,
        rec.rekomendasi_text,
        rec.alasan,
        rec.langkah_tindakan,
        rec.target_tindak_lanjut,
        rec.durasi_target,
        rec.prioritas,
        rec.ruleId,
        deviceId
      ]);

      savedIds.push(id);
    }
  }

  return savedIds;
}

/**
 * Get existing recommendations for a rapor
 * @param {string} raporId - Rapor period ID
 * @param {string} peran - Filter by role (optional)
 * @returns {Promise<object[]>} List of recommendations
 */
export async function getRekomendasi(raporId, peran = null) {
  const db = getDB();

  let query = `
    SELECT * FROM rapor_rekomendasi
    WHERE rapor_id = ? AND is_deleted = 0
  `;
  const params = [raporId];

  if (peran) {
    query += ' AND untuk_peran = ?';
    params.push(peran);
  }

  query += ' ORDER BY prioritas ASC, created_at DESC';

  const results = db.exec(query, params);

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
 * Update recommendation status
 * @param {string} rekomendasiId - Recommendation ID
 * @param {string} status - New status
 * @param {string} catatan - Progress notes
 * @returns {Promise<boolean>} Success status
 */
export async function updateStatus(rekomendasiId, status, catatan = null) {
  const db = getDB();

  let query = `
    UPDATE rapor_rekomendasi
    SET status_tindak_lanjut = ?
  `;
  const params = [status];

  if (status === 'in_progress') {
    query += ', tanggal_mulai = date(\'now\')';
  } else if (status === 'selesai') {
    query += ', tanggal_selesai = date(\'now\')';
  }

  if (catatan) {
    query += ', catatan_progress = ?';
    params.push(catatan);
  }

  query += ' WHERE id = ?';
  params.push(rekomendasiId);

  db.run(query, params);
  return true;
}

/**
 * Add progress entry for a recommendation
 * @param {string} rekomendasiId - Recommendation ID
 * @param {object} progress - Progress data
 * @returns {Promise<string>} Progress ID
 */
export async function addProgress(rekomendasiId, progress) {
  const db = getDB();
  const id = uuidv4();

  const query = `
    INSERT INTO rapor_rekomendasi_progress (
      id, rekomendasi_id, tanggal, deskripsi, pencapaian,
      dilaporkan_oleh, nama_pelapor, peran_pelapor, tingkat_kemajuan
    ) VALUES (?, ?, date('now'), ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    id,
    rekomendasiId,
    progress.deskripsi,
    progress.pencapaian || null,
    progress.dilaporkanOleh || null,
    progress.namaPelapor || null,
    progress.peranPelapor || null,
    progress.tingkatKemajuan || 'awal'
  ]);

  return id;
}

/**
 * Add manual recommendation (from mubaligh or pakar)
 * @param {string} raporId - Rapor period ID
 * @param {object} data - Recommendation data
 * @returns {Promise<string>} Recommendation ID
 */
export async function addManualRekomendasi(raporId, data) {
  const db = getDB();
  const id = uuidv4();

  const query = `
    INSERT INTO rapor_rekomendasi (
      id, rapor_id, untuk_peran, kategori, judul, rekomendasi_text,
      alasan, langkah_tindakan, target_tindak_lanjut, durasi_target,
      tanggal_target, prioritas, sumber, dibuat_oleh, nama_pembuat, device_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [
    id,
    raporId,
    data.untukPeran,
    data.kategori,
    data.judul,
    data.rekomendasiText,
    data.alasan || null,
    data.langkahTindakan || null,
    data.targetTindakLanjut || null,
    data.durasiTarget || null,
    data.tanggalTarget || null,
    data.prioritas || 'normal',
    data.sumber || 'manual',
    data.dibuatOleh || null,
    data.namaPembuat || null,
    data.deviceId || null
  ]);

  return id;
}

/**
 * Get rule definitions for UI display
 * @returns {object[]} List of rule definitions
 */
export function getRuleDefinitions() {
  return RULES.map(rule => ({
    id: rule.id,
    kategori: rule.kategori,
    prioritas: rule.prioritas,
    targetPeran: rule.targetPeran
  }));
}

export default {
  RULES,
  evaluateRules,
  filterByPeran,
  saveRekomendasi,
  getRekomendasi,
  updateStatus,
  addProgress,
  addManualRekomendasi,
  getRuleDefinitions
};
