// Logika pembuat prompt — fungsi murni, tanpa DOM, supaya bisa diuji runtime.
// Disalin dari aplikasi statis generator-prompt (versi yang sama persis).

export const EXPRESSIONS = [
  '',
  'senyum',
  'tertawa',
  'marah',
  'sedih',
  'terkejut',
  'cemberut',
  'menangis',
  'dingin',
  'kesal',
  'malu',
  'bingung',
  'serius',
  'panik',
  'sinis',
];

export const FORMAT_LINES = {
  vertikal: 'Video vertikal 9:16, 1080x1920',
  landscape: 'Video landscape 16:9, 1920x1080',
  persegi: 'Video persegi 1:1, 1080x1080',
};

export const DEFAULT_NEG_PROMPT =
  'face swap, changing face, different clothes, different age, different hairstyle, wrong speaker, swapped dialogue, extra dialogue, random talking, lip sync mismatch, duplicate characters, distorted hands, unnatural movement, cartoon, subtitles, text, watermark';

export const DEFAULT_GAYA =
  'photorealistic, sinematik drama Indonesia, gerakan manusia realistis, ekspresi wajah natural, pencahayaan sinematik, tekstur kulit realistis';

export function charName(characters, id) {
  const c = characters.find((x) => x.id === id);
  return c ? (c.name || 'Karakter').toUpperCase() : 'KARAKTER';
}

export function buildPrompt(settings, characters, scene, idx) {
  const fmtLine = FORMAT_LINES[settings.format] || FORMAT_LINES.vertikal;
  const lines = [];
  lines.push(
    fmtLine +
      ', ' +
      settings.durasi +
      ' detik, 30fps, ' +
      settings.gaya +
      ', no character morphing, consistent face, consistent wardrobe, natural lip sync.',
  );
  const judul = (settings.judul || '').trim();
  if (judul) lines.push('Seri: ' + judul);
  lines.push(
    'Adegan ' + (idx + 1) + (scene.title ? ' — ' + scene.title : '') + '. ' + scene.time + '.',
  );

  // Karakter yang tampil: chip yang dipilih, kalau kosong pakai pembicara dialog, kalau masih kosong pakai semua karakter.
  let presentIds = (scene.present || []).slice();
  if (!presentIds.length) {
    (scene.dialogues || []).forEach((d) => {
      if (d.speaker && presentIds.indexOf(d.speaker) < 0) presentIds.push(d.speaker);
    });
  }
  if (!presentIds.length) {
    presentIds = characters.map((c) => c.id);
  }
  if (presentIds.length) {
    lines.push('');
    lines.push(
      'KARAKTER (kunci wajah & pakaian persis seperti foto referensi yang dilampirkan, jangan berubah di sepanjang adegan):',
    );
    presentIds.forEach((id) => {
      const c = characters.find((x) => x.id === id);
      if (!c) return;
      const bits = [];
      if (c.age) bits.push(c.age);
      if (c.role) bits.push(c.role);
      const head = (c.name || 'Karakter').toUpperCase() + (bits.length ? ' (' + bits.join(', ') + ')' : '');
      const desc = c.desc ? ': ' + c.desc : '';
      const foto = c.photoName
        ? ' [Foto referensi: ' + c.photoName + ']'
        : ' [pakai foto referensi yang dilampirkan untuk karakter ini]';
      lines.push('- ' + head + desc + foto);
    });
  }

  if (scene.location || scene.locationPhotoName) {
    lines.push('');
    let locLine =
      'LOKASI: ' + (scene.location || 'sesuai foto referensi lokasi') + ', ' + scene.time.toLowerCase() + '.';
    if (scene.locationPhotoName) {
      locLine +=
        ' Gunakan latar, bangunan, dan suasana persis seperti foto referensi lokasi yang dilampirkan, jangan diganti. [Foto referensi lokasi: ' +
        scene.locationPhotoName +
        ']';
    } else {
      locLine += ' [Lampirkan foto referensi lokasi untuk adegan ini bila ada]';
    }
    lines.push(locLine);
  }

  if ((scene.action || '').trim()) {
    lines.push('');
    lines.push('AKSI / MULTISHOOT:');
    lines.push(scene.action.trim());
  }

  // Hanya dialog yang muat di durasi adegan yang dimasukkan ke prompt.
  // Dialog yang kepanjangan dideteksi di checkSceneDuration dan tidak
  // ikut keluar di hasil, supaya tidak ada dialog yang hilang di video.
  const allDlgs = (scene.dialogues || []).filter((d) => (d.text || '').trim());
  const dlgs = dialoguesWithinLimit(settings, scene);
  // ATURAN DIAM: karakter yang tampil tapi TIDAK disebut di dialog
  // (tidak punya baris dialog) WAJIB diam — tidak boleh bicara,
  // bergumam, atau menyela. Disebut eksplisit di prompt supaya
  // generator video tidak membuat mereka ikut ngomong.
  const speakingIds = [...new Set(dlgs.map((d) => d.speaker).filter(Boolean))];
  const silentIds = presentIds.filter((id) => !speakingIds.includes(id));
  if (silentIds.length) {
    const silentNames = silentIds
      .map((id) => {
        const c = characters.find((x) => x.id === id);
        return c ? (c.name || 'Karakter').toUpperCase() : null;
      })
      .filter(Boolean);
    if (silentNames.length) {
      lines.push('');
      lines.push(
        'ATURAN DIAM — karakter berikut tampil di adegan ini tapi TIDAK disebut di dialog, jadi mereka WAJIB DIAM dan TIDAK BOLEH BICARA: ' +
          silentNames.join(', ') +
          '. Mulut tertutup, bibir tidak bergerak, tidak bergumam, tidak menyela, tidak ikut bicara. Hanya karakter yang namanya disebut di baris DIALOG yang boleh bicara.',
      );
    }
  }
  const dropped = allDlgs.length - dlgs.length;
  if (dropped > 0) {
    lines.push('');
    lines.push(
      'PERINGATAN DURASI: ' +
        dropped +
        ' baris dialog dihilangkan dari prompt ini karena total dialog melebihi durasi ' +
        settings.durasi +
        ' detik — pendekkan dialognya di aplikasi supaya semua dialog muat.',
    );
  }
  if (dlgs.length) {
    lines.push('');
    lines.push(
      'DIALOG — bahasa: ' +
        settings.bahasa +
        '. Bergantian, HANYA karakter yang namanya disebut di baris dialog yang boleh bicara, dengan ekspresi wajah sesuai yang tertulis di barisnya; karakter yang tidak disebut di dialog WAJIB DIAM (mulut tertutup, bibir tidak bergerak, tidak bergumam, tidak menyela), suara tidak bersamaan:',
    );
    dlgs.forEach((d) => {
      const expr = d.expression ? ' (ekspresi: ' + d.expression + ')' : '';
      lines.push(charName(characters, d.speaker) + expr + ': "' + d.text.trim() + '"');
    });
  }

  lines.push('');
  lines.push('Negative prompt: ' + (settings.negprompt || '').trim());
  return lines.join('\n');
}

export function buildAllPrompts(settings, characters, scenes) {
  return scenes.map((s, i) => buildPrompt(settings, characters, s, i));
}

// ---------- Deteksi dialog melebihi durasi ----------
// Kecepatan bicara Bahasa Indonesia kira-kira 2,5 kata/detik.
// 5 detik ≈ 12 kata, 10 detik ≈ 25 kata, 15 detik ≈ 37 kata.
// Dialog yang totalnya melebihi durasi adegan tidak akan sempat
// terucap semua di video — jadi harus dideteksi SEBELUM generate.
export const WORDS_PER_SECOND = 2.5;
export const PAUSE_PER_LINE = 0.4; // jeda antar pembicara, detik

export function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

export function estimateLineSeconds(text) {
  const words = countWords(text);
  if (!words) return 0;
  return words / WORDS_PER_SECOND + PAUSE_PER_LINE;
}

export function estimateDialogueSeconds(dialogues) {
  return (dialogues || [])
    .filter((d) => (d.text || '').trim())
    .reduce((sum, d) => sum + estimateLineSeconds(d.text), 0);
}

// Cek satu adegan terhadap durasi yang dipilih (5/10/15 detik).
// Balik: { totalSeconds, limit, over, overSeconds, lines: [{text, seconds}] }
export function checkSceneDuration(settings, scene) {
  const limit = parseInt(settings.durasi, 10) || 10;
  const lines = (scene.dialogues || [])
    .filter((d) => (d.text || '').trim())
    .map((d) => ({ text: d.text.trim(), seconds: estimateLineSeconds(d.text) }));
  const totalSeconds = lines.reduce((sum, l) => sum + l.seconds, 0);
  return {
    totalSeconds,
    limit,
    over: totalSeconds > limit,
    overSeconds: Math.max(0, totalSeconds - limit),
    lines,
  };
}

// Dialog yang melebihi durasi TIDAK dimasukkan ke prompt hasil —
// supaya yang keluar di prompt (dan nanti di video) hanya dialog
// yang benar-benar muat di durasi adegan.
export function dialoguesWithinLimit(settings, scene) {
  const limit = parseInt(settings.durasi, 10) || 10;
  const kept = [];
  let used = 0;
  for (const d of scene.dialogues || []) {
    if (!(d.text || '').trim()) continue;
    const sec = estimateLineSeconds(d.text);
    if (used + sec <= limit) {
      kept.push(d);
      used += sec;
    }
  }
  return kept;
}

export function downloadFileName(judul) {
  const base = ((judul || '').trim() || 'prompt-sinetron')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return base + '.txt';
}
