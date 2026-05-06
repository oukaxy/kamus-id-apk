// ═══ CAPACITOR FILESYSTEM LAYER ═══
// Pengganti OPFS — menyimpan file langsung ke storage device (bukan browser sandbox)
// Drop-in replacement: fungsi opfsSave/opfsRead/opfsDelete/initOPFS tetap ada
// sehingga kode utama tidak perlu banyak diubah.

const CAP_FS = window.Capacitor?.Plugins?.Filesystem;
const CAP_DIR = 'DATA'; // Capacitor Directory.Data — private, tidak muncul di galeri

// Apakah Capacitor Filesystem tersedia (jalan sebagai APK)?
const CAP_SUPPORTED = !!CAP_FS;

// opfsMediaDir diset ke true saat init berhasil
// (dipakai sebagai flag di kode utama: if(opfsMediaDir){...})
let opfsRoot = null;
let opfsMediaDir = null;

// ── Init ──
async function initOPFS() {
  if (!CAP_SUPPORTED) {
    // Fallback ke OPFS browser biasa kalau jalan sebagai PWA
    const OPFS_SUPPORTED = 'storage' in navigator && 'getDirectory' in navigator.storage;
    if (!OPFS_SUPPORTED) return false;
    try {
      opfsRoot = await navigator.storage.getDirectory();
      opfsMediaDir = await opfsRoot.getDirectoryHandle('vault_media', { create: true });
      console.log('[Storage] Mode: OPFS (browser)');
      return true;
    } catch (e) {
      console.warn('[Storage] OPFS gagal, pakai IndexedDB:', e);
      return false;
    }
  }

  // Jalan sebagai APK — pakai Capacitor Filesystem
  try {
    // Pastikan folder vault_media ada
    await CAP_FS.mkdir({
      path: 'vault_media',
      directory: CAP_DIR,
      recursive: true
    }).catch(() => {}); // ignore kalau sudah ada

    // Set opfsMediaDir sebagai flag "siap pakai"
    opfsMediaDir = { _capacitor: true };
    opfsRoot = opfsMediaDir;
    console.log('[Storage] Mode: Capacitor Filesystem (native device storage)');
    return true;
  } catch (e) {
    console.warn('[Storage] Capacitor Filesystem gagal:', e);
    return false;
  }
}

// ── Simpan blob ke storage ──
async function opfsSave(id, blob) {
  // Kalau bukan Capacitor, delegate ke OPFS browser
  if (!opfsMediaDir?._capacitor) {
    if (!opfsMediaDir) return false;
    try {
      const fh = await opfsMediaDir.getFileHandle(id, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return true;
    } catch (e) {
      console.warn('[OPFS] save gagal:', e);
      return false;
    }
  }

  // Capacitor: konversi blob → base64
  try {
    const base64 = await blobToBase64(blob);
    await CAP_FS.writeFile({
      path: `vault_media/${id}`,
      data: base64,
      directory: CAP_DIR
    });
    return true;
  } catch (e) {
    console.warn('[Capacitor FS] save gagal:', e);
    return false;
  }
}

// ── Baca blob dari storage ──
async function opfsRead(id) {
  // OPFS browser
  if (!opfsMediaDir?._capacitor) {
    if (!opfsMediaDir) return null;
    try {
      const fh = await opfsMediaDir.getFileHandle(id);
      return await fh.getFile();
    } catch (e) {
      return null;
    }
  }

  // Capacitor: baca base64 → konversi ke Blob
  try {
    const result = await CAP_FS.readFile({
      path: `vault_media/${id}`,
      directory: CAP_DIR
    });
    // result.data bisa string base64 atau Blob tergantung versi Capacitor
    if (typeof result.data === 'string') {
      return base64ToBlob(result.data);
    }
    return result.data;
  } catch (e) {
    return null;
  }
}

// ── Hapus file dari storage ──
async function opfsDelete(id) {
  // OPFS browser
  if (!opfsMediaDir?._capacitor) {
    if (!opfsMediaDir) return;
    try { await opfsMediaDir.removeEntry(id); } catch (e) {}
    return;
  }

  // Capacitor
  try {
    await CAP_FS.deleteFile({
      path: `vault_media/${id}`,
      directory: CAP_DIR
    });
  } catch (e) {}
}

// ── Hapus semua file (untuk reset data) ──
// Dipakai di bagian doReset dan doRestore (clear lama sebelum restore)
async function opfsClearAll() {
  if (!opfsMediaDir?._capacitor) {
    // OPFS browser
    if (!opfsMediaDir) return;
    try {
      const entries = [];
      for await (const [name] of opfsMediaDir.entries()) entries.push(name);
      await Promise.all(entries.map(name => opfsMediaDir.removeEntry(name).catch(() => {})));
    } catch (e) {}
    return;
  }

  // Capacitor: list lalu hapus satu-satu
  try {
    const result = await CAP_FS.readdir({
      path: 'vault_media',
      directory: CAP_DIR
    });
    await Promise.all(
      result.files.map(f =>
        CAP_FS.deleteFile({
          path: `vault_media/${f.name || f}`,
          directory: CAP_DIR
        }).catch(() => {})
      )
    );
  } catch (e) {}
}

// ── Helper: Blob → base64 string ──
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // result: "data:mime/type;base64,XXXX" — ambil bagian setelah koma
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Helper: base64 string → Blob ──
function base64ToBlob(base64, mime = 'application/octet-stream') {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
