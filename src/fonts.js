// Livery lettering fonts (SIL Open Font License 1.1, see assets/fonts/), bundled
// so every render, the offline page and the exported models paint the same
// "Ninja" script and Kawasaki wordmarks instead of a system fallback.
const FACES = [
  ['Kaushan Script', 'kaushan-script-latin.woff2', { weight: '400' }],
  ['Kanit', 'kanit-800-italic-latin.woff2', { weight: '800', style: 'italic' }],
  ['Kanit', 'kanit-900-italic-latin.woff2', { weight: '900', style: 'italic' }],
];
export const LIVERY_FONT_FILES = FACES.map((f) => f[1]);

// base: URL of assets/fonts/ relative to the page. The single-file build sets
// window.__ZX6R_FONTS = { file: base64 } to embed them. Resolves true when
// every face loaded.
export async function loadLiveryFonts(base = 'assets/fonts/') {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return false;
  const inline = (typeof window !== 'undefined' && window.__ZX6R_FONTS) || {};
  const results = await Promise.all(
    FACES.map(async ([family, file, desc]) => {
      try {
        let src = `url(${base}${file})`;
        if (inline[file]) {
          const bin = atob(inline[file]);
          const buf = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          src = buf.buffer;
        }
        const face = new FontFace(family, src, desc);
        await face.load();
        document.fonts.add(face);
        return true;
      } catch (e) {
        return false;
      }
    })
  );
  return results.every(Boolean);
}
