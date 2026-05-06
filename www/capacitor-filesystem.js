// ═══ STORAGE LAYER ═══
// Di dalam APK Android WebView, OPFS tetap tersedia DAN persistent
// karena data disimpan di /data/data/com.kamu.id/ — tidak hilang saat clear cache Chrome
// Tidak perlu Capacitor Filesystem plugin sama sekali.

let opfsRoot = null;
let opfsMediaDir = null;

async function initOPFS() {
  // Cek OPFS tersedia (selalu true di Android WebView Chromium modern)
  const supported = 'storage' in navigator && 'getDirectory' in navigator.storage;
  if (!supported) return false;

  try {
    opfsRoot = await navigator.storage.getDirectory();
    opfsMediaDir = await opfsRoot.getDirectoryHandle('vault_media', { create: true });

    // Minta persistent storage — di APK ini otomatis granted
    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist();
    }

    console.log('[Storage] OPFS aktif — data tersimpan di app private storage');
    return true;
  } catch (e) {
    console.warn('[Storage] OPFS gagal:', e);
    return false;
  }
}

async function opfsSave(id, blob) {
  if (!opfsMediaDir) return false;
  try {
    const fh = await opfsMediaDir.getFileHandle(id, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return true;
  } catch (e) {
    console.warn('[Storage] save gagal:', e);
    return false;
  }
}

async function opfsRead(id) {
  if (!opfsMediaDir) return null;
  try {
    const fh = await opfsMediaDir.getFileHandle(id);
    return await fh.getFile();
  } catch (e) {
    return null;
  }
}

async function opfsDelete(id) {
  if (!opfsMediaDir) return;
  try { await opfsMediaDir.removeEntry(id); } catch (e) {}
}

async function opfsClearAll() {
  if (!opfsMediaDir) return;
  try {
    const entries = [];
    for await (const [name] of opfsMediaDir.entries()) entries.push(name);
    await Promise.all(entries.map(n => opfsMediaDir.removeEntry(n).catch(() => {})));
  } catch (e) {}
}
