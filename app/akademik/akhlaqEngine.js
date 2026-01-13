/**
 * akhlaqEngine.js - Character Assessment Engine
 *
 * Evaluates student character across 8 dimensions:
 * - Kedisiplinan (Discipline)
 * - Adab (Manners/Etiquette)
 * - Kemandirian (Independence)
 * - Kebersihan (Cleanliness)
 * - Tanggung Jawab (Responsibility)
 * - Kejujuran (Honesty)
 * - Kepedulian (Care/Empathy)
 * - Kerjasama (Cooperation)
 *
 * Each dimension scored 1-4:
 * 4: Sangat Baik, 3: Baik, 2: Cukup, 1: Perlu Bimbingan
 */

import { getDB } from '../db/db.js';

// Character dimensions
const DIMENSI_AKHLAQ = [
  'kedisiplinan',
  'adab',
  'kemandirian',
  'kebersihan',
  'tanggung_jawab',
  'kejujuran',
  'kepedulian',
  'kerjasama'
];

// Predicate mapping
const PREDIKAT_NILAI = {
  4: 'Sangat Baik',
  3: 'Baik',
  2: 'Cukup',
  1: 'Perlu Bimbingan'
};

// Overall predicate thresholds based on average
const PREDIKAT_KESELURUHAN_THRESHOLDS = {
  SANGAT_BAIK: 3.5,  // >= 3.5
  BAIK: 2.5,         // >= 2.5
  CUKUP: 1.5,        // >= 1.5
  // < 1.5 = Perlu Bimbingan
};

// Dimension descriptions for narratives
const DIMENSI_DESKRIPSI = {
  kedisiplinan: {
    nama: 'Kedisiplinan',
    tinggi: 'Ananda sangat disiplin dalam mengikuti aturan dan jadwal kegiatan.',
    sedang: 'Ananda cukup disiplin, namun terkadang masih perlu diingatkan.',
    rendah: 'Ananda perlu bimbingan untuk meningkatkan kedisiplinan.'
  },
  adab: {
    nama: 'Adab',
    tinggi: 'Ananda menunjukkan adab yang sangat baik terhadap guru dan teman.',
    sedang: 'Ananda memiliki adab yang baik, terus pertahankan.',
    rendah: 'Ananda perlu pembinaan dalam hal adab dan sopan santun.'
  },
  kemandirian: {
    nama: 'Kemandirian',
    tinggi: 'Ananda sangat mandiri dalam menyelesaikan tugas dan kegiatan.',
    sedang: 'Ananda cukup mandiri, namun terkadang masih membutuhkan bimbingan.',
    rendah: 'Ananda perlu dorongan untuk lebih mandiri dalam beraktivitas.'
  },
  kebersihan: {
    nama: 'Kebersihan',
    tinggi: 'Ananda sangat menjaga kebersihan diri dan lingkungan.',
    sedang: 'Ananda cukup menjaga kebersihan.',
    rendah: 'Ananda perlu bimbingan dalam menjaga kebersihan.'
  },
  tanggung_jawab: {
    nama: 'Tanggung Jawab',
    tinggi: 'Ananda sangat bertanggung jawab dalam setiap tugas yang diberikan.',
    sedang: 'Ananda cukup bertanggung jawab terhadap tugasnya.',
    rendah: 'Ananda perlu pembinaan untuk meningkatkan rasa tanggung jawab.'
  },
  kejujuran: {
    nama: 'Kejujuran',
    tinggi: 'Ananda selalu jujur dalam perkataan dan perbuatan.',
    sedang: 'Ananda memiliki kejujuran yang baik.',
    rendah: 'Ananda perlu bimbingan untuk memahami pentingnya kejujuran.'
  },
  kepedulian: {
    nama: 'Kepedulian',
    tinggi: 'Ananda sangat peduli terhadap teman dan lingkungan sekitar.',
    sedang: 'Ananda cukup peduli terhadap sesama.',
    rendah: 'Ananda perlu dorongan untuk lebih peduli terhadap orang lain.'
  },
  kerjasama: {
    nama: 'Kerjasama',
    tinggi: 'Ananda sangat baik dalam bekerjasama dengan teman.',
    sedang: 'Ananda cukup baik dalam kerjasama tim.',
    rendah: 'Ananda perlu bimbingan untuk meningkatkan kemampuan kerjasama.'
  }
};

/**
 * Get predicate text from numeric value
 * @param {number} nilai - Score 1-4
 * @returns {string} Predicate text
 */
export function getPredikatAkhlaq(nilai) {
  const rounded = Math.round(nilai);
  return PREDIKAT_NILAI[rounded] || 'Tidak Diketahui';
}

/**
 * Get overall predicate from average score
 * @param {number} rataRata - Average score
 * @returns {string} Overall predicate
 */
export function getPredikatKeseluruhan(rataRata) {
  if (rataRata >= PREDIKAT_KESELURUHAN_THRESHOLDS.SANGAT_BAIK) {
    return 'Sangat Baik';
  } else if (rataRata >= PREDIKAT_KESELURUHAN_THRESHOLDS.BAIK) {
    return 'Baik';
  } else if (rataRata >= PREDIKAT_KESELURUHAN_THRESHOLDS.CUKUP) {
    return 'Cukup';
  } else {
    return 'Perlu Bimbingan';
  }
}

/**
 * Generate description for a dimension
 * @param {string} dimensi - Dimension name
 * @param {number} nilai - Score 1-4
 * @returns {string} Description
 */
export function generateDeskripsiDimensi(dimensi, nilai) {
  const info = DIMENSI_DESKRIPSI[dimensi];
  if (!info) return '';

  if (nilai >= 3.5) {
    return info.tinggi;
  } else if (nilai >= 2.5) {
    return info.sedang;
  } else {
    return info.rendah;
  }
}

/**
 * Calculate character assessment from penilaian_akhlaq records
 * @param {string} jamaahId - Student ID
 * @param {string} tanggalMulai - Period start date
 * @param {string} tanggalSelesai - Period end date
 * @returns {Promise<object>} Character assessment
 */
export async function hitungAkhlaq(jamaahId, tanggalMulai, tanggalSelesai) {
  const db = getDB();

  // Get all akhlaq assessments for the period
  const query = `
    SELECT
      pa.aspek,
      AVG(pa.nilai) as rata_nilai,
      COUNT(*) as jumlah_penilaian
    FROM penilaian_akhlaq pa
    INNER JOIN penilaian p ON pa.penilaian_id = p.id
    WHERE p.jamaah_id = ?
      AND p.tanggal >= ?
      AND p.tanggal <= ?
      AND pa.is_deleted = 0
      AND p.is_deleted = 0
    GROUP BY pa.aspek
  `;

  const results = db.exec(query, [jamaahId, tanggalMulai, tanggalSelesai]);

  // Initialize assessment object
  const assessment = {
    dimensi: {},
    nilaiRataRata: 0,
    predikatKeseluruhan: 'Perlu Bimbingan',
    deskripsiKeseluruhan: '',
    kekuatanKarakter: [],
    areaPengembangan: []
  };

  // Parse results
  const nilaiList = [];

  if (results.length > 0 && results[0].values) {
    results[0].values.forEach(row => {
      const aspek = row[0];
      const rataNilai = row[1];
      const jumlah = row[2];

      if (DIMENSI_AKHLAQ.includes(aspek)) {
        assessment.dimensi[aspek] = {
          nilai: rataNilai,
          predikat: getPredikatAkhlaq(rataNilai),
          deskripsi: generateDeskripsiDimensi(aspek, rataNilai),
          jumlahPenilaian: jumlah
        };
        nilaiList.push(rataNilai);

        // Identify strengths and areas for development
        if (rataNilai >= 3.5) {
          assessment.kekuatanKarakter.push(DIMENSI_DESKRIPSI[aspek].nama);
        } else if (rataNilai < 2.5) {
          assessment.areaPengembangan.push(DIMENSI_DESKRIPSI[aspek].nama);
        }
      }
    });
  }

  // Calculate overall average
  if (nilaiList.length > 0) {
    assessment.nilaiRataRata = nilaiList.reduce((a, b) => a + b, 0) / nilaiList.length;
  }

  // Determine overall predicate
  assessment.predikatKeseluruhan = getPredikatKeseluruhan(assessment.nilaiRataRata);

  // Generate overall description
  assessment.deskripsiKeseluruhan = generateDeskripsiKeseluruhan(assessment);

  return assessment;
}

/**
 * Generate overall character description
 * @param {object} assessment - Character assessment
 * @returns {string} Overall description
 */
export function generateDeskripsiKeseluruhan(assessment) {
  const { nilaiRataRata, predikatKeseluruhan, kekuatanKarakter, areaPengembangan } = assessment;

  let deskripsi = `Secara keseluruhan, perkembangan akhlaq Ananda mendapat predikat ${predikatKeseluruhan} dengan nilai rata-rata ${nilaiRataRata.toFixed(2)}. `;

  if (kekuatanKarakter.length > 0) {
    deskripsi += `Kekuatan karakter Ananda terlihat pada aspek ${kekuatanKarakter.join(', ')}. `;
  }

  if (areaPengembangan.length > 0) {
    deskripsi += `Area yang perlu dikembangkan meliputi ${areaPengembangan.join(', ')}. `;
  }

  if (predikatKeseluruhan === 'Sangat Baik') {
    deskripsi += 'Pertahankan akhlaq yang baik ini dan jadilah teladan bagi teman-teman.';
  } else if (predikatKeseluruhan === 'Baik') {
    deskripsi += 'Terus tingkatkan akhlaq untuk mencapai hasil yang lebih optimal.';
  } else if (predikatKeseluruhan === 'Cukup') {
    deskripsi += 'Dengan bimbingan yang tepat, Ananda dapat mengembangkan akhlaq yang lebih baik.';
  } else {
    deskripsi += 'Diperlukan pembinaan intensif dan kerjasama antara mubaligh dan orang tua.';
  }

  return deskripsi;
}

/**
 * Compare character with previous period
 * @param {string} jamaahId - Student ID
 * @param {object} currentAssessment - Current assessment
 * @param {string} previousStart - Previous period start
 * @param {string} previousEnd - Previous period end
 * @returns {Promise<object>} Comparison result
 */
export async function compareWithPrevious(jamaahId, currentAssessment, previousStart, previousEnd) {
  const previousAssessment = await hitungAkhlaq(jamaahId, previousStart, previousEnd);

  const diff = currentAssessment.nilaiRataRata - previousAssessment.nilaiRataRata;

  let perkembangan = 'stabil';
  let catatanPerkembangan = 'Perkembangan akhlaq stabil dibandingkan periode sebelumnya.';

  if (diff > 0.3) {
    perkembangan = 'meningkat';
    catatanPerkembangan = `Perkembangan akhlaq meningkat signifikan. Nilai rata-rata naik dari ${previousAssessment.nilaiRataRata.toFixed(2)} menjadi ${currentAssessment.nilaiRataRata.toFixed(2)}.`;
  } else if (diff < -0.3) {
    perkembangan = 'menurun';
    catatanPerkembangan = `Perkembangan akhlaq menurun. Nilai rata-rata turun dari ${previousAssessment.nilaiRataRata.toFixed(2)} menjadi ${currentAssessment.nilaiRataRata.toFixed(2)}. Perlu perhatian khusus.`;
  }

  // Compare each dimension
  const dimensiChanges = [];
  for (const dimensi of DIMENSI_AKHLAQ) {
    const current = currentAssessment.dimensi[dimensi]?.nilai || 0;
    const previous = previousAssessment.dimensi[dimensi]?.nilai || 0;
    const dimDiff = current - previous;

    if (Math.abs(dimDiff) > 0.5) {
      dimensiChanges.push({
        dimensi,
        nama: DIMENSI_DESKRIPSI[dimensi]?.nama || dimensi,
        perubahan: dimDiff > 0 ? 'meningkat' : 'menurun',
        selisih: dimDiff
      });
    }
  }

  return {
    perkembangan,
    catatanPerkembangan,
    nilaiSebelumnya: previousAssessment.nilaiRataRata,
    nilaiSekarang: currentAssessment.nilaiRataRata,
    selisih: diff,
    dimensiChanges
  };
}

/**
 * Get character strengths
 * @param {object} assessment - Character assessment
 * @returns {string} Strengths narrative
 */
export function getKekuatanKarakter(assessment) {
  const kekuatan = [];

  for (const [dimensi, data] of Object.entries(assessment.dimensi)) {
    if (data.nilai >= 3.5) {
      kekuatan.push(DIMENSI_DESKRIPSI[dimensi]?.nama || dimensi);
    }
  }

  if (kekuatan.length === 0) {
    return 'Belum ada aspek karakter yang menonjol, namun dengan bimbingan yang tepat dapat dikembangkan.';
  }

  return `Kekuatan karakter Ananda terlihat pada aspek: ${kekuatan.join(', ')}.`;
}

/**
 * Get areas for character development
 * @param {object} assessment - Character assessment
 * @returns {string} Development areas narrative
 */
export function getAreaPengembangan(assessment) {
  const pengembangan = [];

  for (const [dimensi, data] of Object.entries(assessment.dimensi)) {
    if (data.nilai < 2.5) {
      pengembangan.push(DIMENSI_DESKRIPSI[dimensi]?.nama || dimensi);
    }
  }

  if (pengembangan.length === 0) {
    return 'Tidak ada aspek karakter yang memerlukan perhatian khusus saat ini.';
  }

  return `Area yang perlu dikembangkan: ${pengembangan.join(', ')}.`;
}

/**
 * Generate character recommendations
 * @param {object} assessment - Character assessment
 * @returns {object[]} List of recommendations
 */
export function generateRekomendasiAkhlaq(assessment) {
  const rekomendasi = [];

  for (const [dimensi, data] of Object.entries(assessment.dimensi)) {
    if (data.nilai < 2.5) {
      const info = DIMENSI_DESKRIPSI[dimensi];
      rekomendasi.push({
        aspek: info?.nama || dimensi,
        kategori: 'akhlaq',
        prioritas: data.nilai < 2 ? 'tinggi' : 'normal',
        rekomendasi: generateSpecificRekomendasi(dimensi, data.nilai)
      });
    }
  }

  return rekomendasi;
}

/**
 * Generate specific recommendation for a dimension
 * @param {string} dimensi - Dimension name
 * @param {number} nilai - Score
 * @returns {string} Recommendation text
 */
function generateSpecificRekomendasi(dimensi, nilai) {
  const base = {
    kedisiplinan: 'Buat jadwal harian yang konsisten dan berikan reward untuk kehadiran tepat waktu.',
    adab: 'Latih sopan santun melalui role-play dan beri contoh langsung dari orang tua.',
    kemandirian: 'Berikan tanggung jawab kecil yang dapat diselesaikan sendiri, tingkatkan secara bertahap.',
    kebersihan: 'Libatkan dalam kegiatan bersih-bersih rumah dan ajarkan pentingnya kebersihan.',
    tanggung_jawab: 'Berikan tugas dengan deadline jelas dan evaluasi bersama hasil pekerjaan.',
    kejujuran: 'Apresiasi setiap kejujuran dan jelaskan dampak ketidakjujuran dengan bahasa yang mudah dipahami.',
    kepedulian: 'Libatkan dalam kegiatan sosial dan ajarkan empati melalui cerita dan diskusi.',
    kerjasama: 'Berikan kegiatan kelompok di rumah dan ajarkan pentingnya berbagi tugas.'
  };

  return base[dimensi] || 'Berikan pembinaan khusus dengan pendekatan personal.';
}

export default {
  DIMENSI_AKHLAQ,
  getPredikatAkhlaq,
  getPredikatKeseluruhan,
  generateDeskripsiDimensi,
  hitungAkhlaq,
  generateDeskripsiKeseluruhan,
  compareWithPrevious,
  getKekuatanKarakter,
  getAreaPengembangan,
  generateRekomendasiAkhlaq
};
