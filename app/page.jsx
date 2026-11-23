'use client';

import { useEffect, useRef, useState } from 'react';
import {
  EXPRESSIONS,
  DEFAULT_NEG_PROMPT,
  DEFAULT_GAYA,
  buildAllPrompts,
  downloadFileName,
} from '../lib/prompt';
import {
  loadHistory,
  saveHistory,
  addHistoryEntry,
  removeHistoryEntry,
  makeHistoryEntry,
} from '../lib/history';

const GAYA_OPTIONS = [
  {
    value: DEFAULT_GAYA,
    label: 'Photorealistic sinematik',
  },
  {
    value:
      'photorealistic, pencahayaan natural siang hari, warna hangat, detail tajam',
    label: 'Natural siang hari',
  },
  {
    value:
      'photorealistic, suasana malam dramatis, pencahayaan lampu hangat, detail tajam',
    label: 'Malam dramatis',
  },
];

const WAKTU_OPTIONS = ['Pagi hari', 'Siang hari', 'Sore hari', 'Malam hari'];

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function newCharacter() {
  return { id: uid('c'), name: '', age: '', role: '', desc: '', photoName: '', photoData: '' };
}

function newScene() {
  return {
    id: uid('s'),
    title: '',
    location: '',
    locationPhotoName: '',
    locationPhotoData: '',
    time: 'Siang hari',
    action: '',
    present: [],
    dialogues: [{ speaker: '', expression: '', text: '' }],
  };
}

export default function Home() {
  const [settings, setSettings] = useState({
    judul: '',
    format: 'vertikal',
    durasi: '10',
    bahasa: 'Bahasa Indonesia',
    gaya: DEFAULT_GAYA,
    negprompt: DEFAULT_NEG_PROMPT,
  });
  const [characters, setCharacters] = useState([newCharacter(), newCharacter()]);
  const [scenes, setScenes] = useState([newScene()]);
  const [prompts, setPrompts] = useState([]);
  const [history, setHistory] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastKey, setToastKey] = useState(0);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [justAddedChar, setJustAddedChar] = useState(null);
  const [justAddedScene, setJustAddedScene] = useState(null);
  const outputRef = useRef(null);
  const toastTimer = useRef(null);

  // Muat riwayat dari localStorage + daftarkan service worker + tangkap install prompt.
  useEffect(() => {
    setHistory(loadHistory(window.localStorage));
    setHydrated(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  // Simpan riwayat ke localStorage setiap kali berubah (setelah data awal dimuat).
  useEffect(() => {
    if (hydrated) saveHistory(window.localStorage, history);
  }, [history, hydrated]);

  function toast(msg) {
    setToastMsg(msg);
    setToastKey((k) => k + 1);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2400);
  }

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      toast('Prompt tersalin');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('Prompt tersalin');
      } catch {
        toast('Gagal menyalin — salin manual dari kotak hasil');
      }
      document.body.removeChild(ta);
    }
  }

  function readPhotoFile(file, onDone) {
    const reader = new FileReader();
    reader.onload = (e) => onDone(e.target.result);
    reader.readAsDataURL(file);
  }

  // ---------- Karakter ----------
  function addCharacter() {
    const c = newCharacter();
    setCharacters((prev) => [...prev, c]);
    setJustAddedChar(c.id);
    setTimeout(() => setJustAddedChar(null), 600);
  }

  function updateCharacter(id, field, value) {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function deleteCharacter(id) {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    setScenes((prev) =>
      prev.map((s) => ({
        ...s,
        present: s.present.filter((p) => p !== id),
        dialogues: s.dialogues.map((d) => (d.speaker === id ? { ...d, speaker: '' } : d)),
      })),
    );
  }

  function onCharPhoto(id, file) {
    if (!file) return;
    readPhotoFile(file, (dataUrl) => {
      setCharacters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, photoName: file.name, photoData: dataUrl } : c)),
      );
    });
  }

  // ---------- Adegan ----------
  function addScene() {
    const s = newScene();
    setScenes((prev) => [...prev, s]);
    setJustAddedScene(s.id);
    setTimeout(() => setJustAddedScene(null), 600);
  }

  function updateScene(id, field, value) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  }

  function deleteScene(id) {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }

  function togglePresent(sceneId, charId) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s;
        const has = s.present.includes(charId);
        return {
          ...s,
          present: has ? s.present.filter((p) => p !== charId) : [...s.present, charId],
        };
      }),
    );
  }

  function onLocPhoto(sceneId, file) {
    if (!file) return;
    readPhotoFile(file, (dataUrl) => {
      setScenes((prev) =>
        prev.map((s) =>
          s.id === sceneId ? { ...s, locationPhotoName: file.name, locationPhotoData: dataUrl } : s,
        ),
      );
    });
  }

  function deleteLocPhoto(sceneId) {
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId ? { ...s, locationPhotoName: '', locationPhotoData: '' } : s,
      ),
    );
  }

  function updateDialogue(sceneId, idx, field, value) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s;
        const dialogues = s.dialogues.map((d, i) => (i === idx ? { ...d, [field]: value } : d));
        return { ...s, dialogues };
      }),
    );
  }

  function addDialogue(sceneId) {
    setScenes((prev) =>
      prev.map((s) =>
        s.id === sceneId
          ? { ...s, dialogues: [...s.dialogues, { speaker: '', expression: '', text: '' }] }
          : s,
      ),
    );
  }

  function deleteDialogue(sceneId, idx) {
    setScenes((prev) =>
      prev.map((s) => {
        if (s.id !== sceneId) return s;
        const dialogues = s.dialogues.filter((_, i) => i !== idx);
        return {
          ...s,
          dialogues: dialogues.length ? dialogues : [{ speaker: '', expression: '', text: '' }],
        };
      }),
    );
  }

  // ---------- Generate & riwayat ----------
  function generate() {
    if (!characters.some((c) => c.name.trim())) {
      toast('Isi dulu minimal satu nama karakter');
      return;
    }
    if (!scenes.length) {
      toast('Tambah minimal satu adegan');
      return;
    }
    const result = buildAllPrompts(settings, characters, scenes);
    setPrompts(result);
    setHistory((prev) =>
      addHistoryEntry(prev, makeHistoryEntry({ judul: settings.judul, prompts: result })),
    );
    toast('Prompt jadi — ' + result.length + ' adegan');
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function downloadTxt() {
    if (!prompts.length) return;
    const blob = new Blob([prompts.join('\n\n====================\n\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = downloadFileName(settings.judul);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function installApp() {
    if (!installPrompt) return;
    installPrompt.prompt();
    try {
      await installPrompt.userChoice;
    } catch {
      /* abaikan */
    }
    setInstallPrompt(null);
  }

  function showHistoryEntry(entry) {
    setPrompts(entry.prompts);
    toast('Riwayat dimuat — ' + entry.jumlahAdegan + ' adegan');
    setTimeout(() => {
      if (outputRef.current) outputRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function fmtTanggal(iso) {
    try {
      return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  const charNameById = (id) => {
    const c = characters.find((x) => x.id === id);
    return c ? c.name || 'Tanpa nama' : 'Tanpa nama';
  };

  return (
    <div className="wrap">
      <header className="intro">
        <span className="brand">✦ Generator Prompt Sinetron AI</span>
        <h1>Aplikasi Generator by Bagus Alfiansyah</h1>
        <p>
          Unggah foto karaktermu sendiri, tulis nama &amp; deskripsinya, unggah foto lokasi tiap adegan,
          lalu susun dialog lengkap dengan ekspresinya — prompt rapi siap salin langsung jadi, lengkap
          dengan kunci wajah, referensi lokasi, aturan dialog bergantian, dan negative prompt.
        </p>
      </header>

      {installPrompt && (
        <div className="install-bar anim-pop">
          <span>📲 Pasang aplikasi ini di HP-mu supaya bisa dibuka seperti aplikasi biasa.</span>
          <button className="btn btn-accent btn-sm" type="button" onClick={installApp}>
            Pasang Aplikasi
          </button>
        </div>
      )}

      <div className="layout">
        <div>
          {/* 1 — PENGATURAN */}
          <section className="card anim-in" style={{ animationDelay: '0.05s' }}>
            <h2>
              <span className="num">1</span> Pengaturan Video
            </h2>
            <p className="hint">
              Format bawaan mengikuti aturan videomu: vertikal 9:16, photorealistic, tanpa subtitle &amp;
              watermark.
            </p>
            <label htmlFor="judul">Judul seri / episode</label>
            <input
              type="text"
              id="judul"
              placeholder="Contoh: judul seri — Episode 1"
              value={settings.judul}
              onChange={(e) => setSettings({ ...settings, judul: e.target.value })}
            />
            <div className="grid2">
              <div>
                <label htmlFor="format">Format layar</label>
                <select
                  id="format"
                  value={settings.format}
                  onChange={(e) => setSettings({ ...settings, format: e.target.value })}
                >
                  <option value="vertikal">Vertikal 9:16 — 1080×1920</option>
                  <option value="landscape">Landscape 16:9 — 1920×1080</option>
                  <option value="persegi">Persegi 1:1 — 1080×1080</option>
                </select>
              </div>
              <div>
                <label htmlFor="durasi">Durasi per adegan</label>
                <select
                  id="durasi"
                  value={settings.durasi}
                  onChange={(e) => setSettings({ ...settings, durasi: e.target.value })}
                >
                  <option value="5">5 detik</option>
                  <option value="10">10 detik</option>
                  <option value="15">15 detik</option>
                </select>
              </div>
            </div>
            <div className="grid2">
              <div>
                <label htmlFor="bahasa">Bahasa dialog</label>
                <select
                  id="bahasa"
                  value={settings.bahasa}
                  onChange={(e) => setSettings({ ...settings, bahasa: e.target.value })}
                >
                  <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                  <option value="Bahasa Jawa (ngoko)">Bahasa Jawa (ngoko)</option>
                  <option value="campuran Bahasa Indonesia dan Bahasa Jawa">
                    Campuran Indonesia + Jawa
                  </option>
                </select>
              </div>
              <div>
                <label htmlFor="gaya">Gaya visual</label>
                <select
                  id="gaya"
                  value={settings.gaya}
                  onChange={(e) => setSettings({ ...settings, gaya: e.target.value })}
                >
                  {GAYA_OPTIONS.map((g) => (
                    <option key={g.label} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label htmlFor="negprompt">Negative prompt (bisa diedit)</label>
            <textarea
              id="negprompt"
              value={settings.negprompt}
              onChange={(e) => setSettings({ ...settings, negprompt: e.target.value })}
            />
          </section>

          {/* 2 — KARAKTER */}
          <section className="card anim-in" style={{ animationDelay: '0.12s' }}>
            <h2>
              <span className="num">2</span> Karakter Kamu
            </h2>
            <p className="hint">
              Tidak ada karakter bawaan — ini karaktermu sendiri. Unggah foto tiap karakter (dari galeri
              atau kamera), lalu tulis nama dan deskripsinya. Di prompt hasil, foto itu disebut sebagai
              referensi wajah &amp; pakaian yang dikunci: <em>lampirkan foto yang sama saat generate video</em>.
            </p>
            {characters.map((c, idx) => (
              <div
                key={c.id}
                className={`char-card ${justAddedChar === c.id ? 'anim-pop' : ''}`}
              >
                <div className="char-head">
                  <div className="photo-box">
                    <div className="photo-preview">
                      {c.photoData ? (
                        <img src={c.photoData} alt={'Foto referensi ' + (c.name || 'karakter ' + (idx + 1))} />
                      ) : (
                        <span>Belum ada foto</span>
                      )}
                    </div>
                    <label className="btn btn-ghost photo-btn" htmlFor={'file-' + c.id}>
                      📷 Unggah Foto
                    </label>
                    <input
                      type="file"
                      id={'file-' + c.id}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => onCharPhoto(c.id, e.target.files && e.target.files[0])}
                    />
                    {c.photoName && <div className="file-name">{c.photoName}</div>}
                  </div>
                  <div className="char-fields">
                    <label>Nama karakter *</label>
                    <input
                      type="text"
                      value={c.name}
                      placeholder="Tulis nama karaktermu"
                      onChange={(e) => updateCharacter(c.id, 'name', e.target.value)}
                    />
                    <div className="grid2">
                      <div>
                        <label>Usia</label>
                        <input
                          type="text"
                          value={c.age}
                          placeholder="Mis. 27 tahun"
                          onChange={(e) => updateCharacter(c.id, 'age', e.target.value)}
                        />
                      </div>
                      <div>
                        <label>Peran</label>
                        <input
                          type="text"
                          value={c.role}
                          placeholder="Mis. istri, suami, ibu"
                          onChange={(e) => updateCharacter(c.id, 'role', e.target.value)}
                        />
                      </div>
                    </div>
                    <label>Deskripsi wajah &amp; pakaian</label>
                    <textarea
                      value={c.desc}
                      placeholder="Rambut, wajah, baju, celana, sepatu — sesuai foto yang diunggah"
                      onChange={(e) => updateCharacter(c.id, 'desc', e.target.value)}
                    />
                  </div>
                </div>
                <div className="remove-row">
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => deleteCharacter(c.id)}>
                    Hapus karakter
                  </button>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" type="button" onClick={addCharacter}>
              + Tambah Karakter
            </button>
          </section>

          {/* 3 — ADEGAN */}
          <section className="card anim-in" style={{ animationDelay: '0.19s' }}>
            <h2>
              <span className="num">3</span> Adegan &amp; Dialog
            </h2>
            <p className="hint">
              Satu kartu = satu adegan / satu video. Unggah foto lokasinya, pilih siapa saja yang tampil,
              tulis aksi atau rincian multishoot-nya, lalu tambah baris dialog per pembicara — tiap baris
              bisa dipilih ekspresinya dan ekspresi itu ikut masuk ke prompt.
            </p>
            {scenes.map((s, i) => (
              <div key={s.id} className={`scene-card ${justAddedScene === s.id ? 'anim-pop' : ''}`}>
                <h3>Adegan {i + 1}</h3>
                <label>Judul adegan</label>
                <input
                  type="text"
                  value={s.title}
                  placeholder="Mis. Perpisahan di depan rumah"
                  onChange={(e) => updateScene(s.id, 'title', e.target.value)}
                />
                <div className="grid2">
                  <div>
                    <label>Nama / deskripsi lokasi</label>
                    <input
                      type="text"
                      value={s.location}
                      placeholder="Mis. teras rumah desa, bale bambu pinggir sawah"
                      onChange={(e) => updateScene(s.id, 'location', e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Waktu</label>
                    <select value={s.time} onChange={(e) => updateScene(s.id, 'time', e.target.value)}>
                      {WAKTU_OPTIONS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label>Foto lokasi adegan ini</label>
                <div className="loc-box">
                  <div className="loc-preview">
                    {s.locationPhotoData ? (
                      <img src={s.locationPhotoData} alt={'Foto referensi lokasi adegan ' + (i + 1)} />
                    ) : (
                      <span>Belum ada foto lokasi</span>
                    )}
                  </div>
                  <div className="loc-side">
                    <label
                      className="btn btn-ghost"
                      htmlFor={'locfile-' + s.id}
                      style={{ margin: 0, minHeight: 44 }}
                    >
                      📷 Unggah Foto Lokasi
                    </label>
                    <input
                      type="file"
                      id={'locfile-' + s.id}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => onLocPhoto(s.id, e.target.files && e.target.files[0])}
                    />
                    {s.locationPhotoName && (
                      <div className="file-name" style={{ textAlign: 'left' }}>
                        {s.locationPhotoName}
                      </div>
                    )}
                    <p className="small">
                      Dari galeri / kamera. Foto ini disebut di prompt sebagai referensi latar — lampirkan
                      file yang sama saat generate video.
                    </p>
                    {s.locationPhotoName && (
                      <button className="btn btn-danger btn-sm" type="button" onClick={() => deleteLocPhoto(s.id)}>
                        Hapus foto lokasi
                      </button>
                    )}
                  </div>
                </div>
                <label>Karakter yang tampil (ketuk untuk pilih)</label>
                <div className="chips">
                  {characters.length ? (
                    characters.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={'chip' + (s.present.includes(c.id) ? ' on' : '')}
                        onClick={() => togglePresent(s.id, c.id)}
                      >
                        {c.name || 'Tanpa nama'}
                      </button>
                    ))
                  ) : (
                    <span className="small">Tambah karakter dulu di bagian 2.</span>
                  )}
                </div>
                <label>Aksi / rincian multishoot</label>
                <textarea
                  value={s.action}
                  placeholder={'Shot 1 — medium two-shot: ...\nShot 2 — close-up: ...\nTulis aksi tiap shot di baris sendiri'}
                  onChange={(e) => updateScene(s.id, 'action', e.target.value)}
                />
                <label>Dialog (bergantian, satu baris = satu pembicara + ekspresinya + kalimatnya)</label>
                {s.dialogues.map((d, di) => (
                  <div key={di} className="dlg-item anim-fade">
                    <div className="dlg-top">
                      <div>
                        <label>Pembicara</label>
                        <select
                          value={d.speaker}
                          onChange={(e) => updateDialogue(s.id, di, 'speaker', e.target.value)}
                        >
                          <option value="">— Pilih pembicara —</option>
                          {characters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name || 'Karakter tanpa nama'}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Ekspresi pas dialog</label>
                        <select
                          value={d.expression || ''}
                          onChange={(e) => updateDialogue(s.id, di, 'expression', e.target.value)}
                        >
                          {EXPRESSIONS.map((ex) => (
                            <option key={ex} value={ex}>
                              {ex === '' ? '— Ekspresi —' : ex.charAt(0).toUpperCase() + ex.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Hapus dialog"
                        onClick={() => deleteDialogue(s.id, di)}
                      >
                        ×
                      </button>
                    </div>
                    <textarea
                      value={d.text}
                      placeholder="Tulis kalimat dialognya persis seperti mau diucapkan"
                      onChange={(e) => updateDialogue(s.id, di, 'text', e.target.value)}
                    />
                    {d.expression && (
                      <span className="expr-badge">Ekspresi: {d.expression}</span>
                    )}
                  </div>
                ))}
                <div className="actions">
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => addDialogue(s.id)}>
                    + Baris Dialog
                  </button>
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => deleteScene(s.id)}>
                    Hapus adegan
                  </button>
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" type="button" onClick={addScene}>
              + Tambah Adegan
            </button>
            <div className="actions">
              <button
                className="btn btn-accent btn-generate"
                type="button"
                onClick={generate}
                style={{ flex: 1 }}
              >
                ⚡ Buat Prompt
              </button>
            </div>
          </section>
        </div>

        {/* OUTPUT */}
        <div className="output-col">
          <section className="card anim-in" style={{ animationDelay: '0.26s' }} ref={outputRef}>
            <h2>Hasil Prompt</h2>
            <p className="hint">
              Klik “Buat Prompt”, lalu salin per adegan atau unduh semuanya. Saat generate video,
              lampirkan foto karakter <em>dan</em> foto lokasi yang kamu unggah di sini sebagai gambar
              referensi.
            </p>
            {prompts.length ? (
              <div>
                {prompts.map((p, i) => (
                  <div key={i} className="scene-out anim-fade">
                    <div className="scene-out-head">
                      <strong>Adegan {i + 1}</strong>
                      <button className="btn btn-accent btn-sm" type="button" onClick={() => copyText(p)}>
                        Salin Prompt
                      </button>
                    </div>
                    <div className="output-box">{p}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-out">Belum ada prompt. Isi karakter &amp; adegan, lalu klik “Buat Prompt”.</div>
            )}
            {prompts.length > 0 && (
              <div className="actions">
                <button
                  className="btn btn-dark btn-sm"
                  type="button"
                  onClick={() => copyText(prompts.join('\n\n====================\n\n'))}
                >
                  Salin Semua
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={downloadTxt}>
                  Unduh .txt
                </button>
              </div>
            )}
          </section>

          {/* RIWAYAT */}
          <section className="card anim-in" style={{ animationDelay: '0.32s' }}>
            <h2>🕘 Riwayat Prompt</h2>
            <p className="hint">
              Prompt yang pernah dibuat tersimpan otomatis di perangkat ini (maksimal 20). Ketuk “Lihat”
              untuk memuatnya lagi ke kotak hasil.
            </p>
            {history.length === 0 ? (
              <div className="empty-history">Belum ada riwayat. Buat prompt pertamamu dulu.</div>
            ) : (
              <>
                {history.map((h) => (
                  <div key={h.id} className="history-item anim-fade">
                    <div className="h-title">{h.judul}</div>
                    <div className="h-meta">
                      {fmtTanggal(h.tanggal)} • {h.jumlahAdegan} adegan
                    </div>
                    <div className="h-actions">
                      <button className="btn btn-accent btn-sm" type="button" onClick={() => showHistoryEntry(h)}>
                        Lihat
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => copyText(h.prompts.join('\n\n====================\n\n'))}
                      >
                        Salin
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        type="button"
                        onClick={() => setHistory((prev) => removeHistoryEntry(prev, h.id))}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
                <div className="actions">
                  <button className="btn btn-danger btn-sm" type="button" onClick={() => setHistory([])}>
                    Hapus Semua Riwayat
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <p className="footer">
        Aplikasi Generator by <b>Bagus Alfiansyah</b> — prompt sinetron AI, karakter &amp; lokasi dari
        fotomu sendiri.
      </p>

      {toastMsg && (
        <div key={toastKey} className="toast show">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
