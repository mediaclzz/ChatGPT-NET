(() => {
  const NS = globalThis.ChatGPTNET;
  const U = NS.U = {};
  U.uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  U.now = () => Date.now();
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.deepClone = (v) => structuredClone(v);
  U.hash = (text = '') => {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  };
  U.escapeHtml = (s = '') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  U.isEditable = (el) => !!(el && el.closest && el.closest('input,textarea,[contenteditable="true"],[role="textbox"]'));
  U.isPrimary = (e) => e.button === 0;
  U.pointInRect = (p, r, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
  U.rectsOverlap = (a, b, gap = 0) => !(a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y);
  U.rectContains = (outer, inner) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
  U.distance2 = (a, b) => (a.x-b.x)**2 + (a.y-b.y)**2;
  U.normalizeRgb = (value) => {
    const v = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
    const m = v.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i) || v.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
    if (!m) return null;
    const c = [1,2,3].map(i => Number(m[i]));
    if (c.some(n => n < 0 || n > 255)) return null;
    return '#' + c.map(n => n.toString(16).padStart(2,'0')).join('').toUpperCase();
  };
  U.downloadJson = (name, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.style.display='none'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
})();
