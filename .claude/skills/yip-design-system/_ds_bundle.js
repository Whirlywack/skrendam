/* @ds-bundle: {"format":4,"namespace":"YipDesignSystem_bc53ee","components":[{"name":"DealTicket","sourcePath":"components/DealTicket.jsx"}],"sourceHashes":{"components/DealTicket.jsx":"527b75fa3950","preview/image-slot.js":"9309434cb09c","screens/ios-frame.jsx":"be3343be4b51","screens/mobile-app.jsx":"3cd80827a278","screens/sidebar.js":"31c1fcd0a1aa","ui_kits/curator/Composer.jsx":"e1d76ad96d80","ui_kits/curator/CuratorApp.jsx":"981a05c17b04","ui_kits/curator/Queue.jsx":"9b9b573a9a85","ui_kits/curator/Sidebar.jsx":"e776e68bb7cd","ui_kits/curator/data.js":"6d7598afac0c","ui_kits/website/App.jsx":"9da5bd4b77bd","ui_kits/website/DealCard.jsx":"9ef6ff52dd43","ui_kits/website/DealDetail.jsx":"a6df6c4032db","ui_kits/website/Header.jsx":"3db2f38d6762","ui_kits/website/Icon.jsx":"d8de1137b885","ui_kits/website/Sections.jsx":"483e602a96a3","ui_kits/website/data.js":"f858e50411fb"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.YipDesignSystem_bc53ee = window.YipDesignSystem_bc53ee || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/DealTicket.jsx
try { (() => {
// DealTicket — the signature Yip boarding-pass deal card, exported for consumers.
// Self-contained: inline styles + tokens from styles.css (link it on the page).
function DealTicket({
  place = "Larnaca",
  country = "Cyprus",
  origin = "Vilnius",
  from = "VNO",
  to = "LCA",
  dates = "14–21 Oct",
  legs = "Direct · 4h",
  airline = "Wizz Air",
  price = 59,
  usual = 102,
  headline = "Sun's still out — and the crowds have gone",
  eyebrow = "Last warm week",
  gradient = "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
  hot = false,
  ctaLabel = "See deal",
  onSee
}) {
  const pct = usual > price ? Math.round((1 - price / usual) * 100) : 0;
  const mono = {
    fontFamily: "var(--font-mono, monospace)",
    textTransform: "uppercase"
  };
  const disp = {
    fontFamily: "var(--font-display, sans-serif)"
  };
  return /*#__PURE__*/React.createElement("article", {
    style: {
      background: "var(--bg-surface, #fff)",
      borderRadius: 20,
      boxShadow: "var(--shadow-sm, 0 2px 6px rgba(28,24,19,.07))",
      overflow: "hidden",
      fontFamily: "var(--font-body, sans-serif)",
      color: "var(--fg-1, #1C1813)",
      maxWidth: 420
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 150,
      position: "relative",
      background: gradient
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(28,24,19,.55), transparent 58%)"
    }
  }), hot && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 11,
      right: 11,
      background: "var(--coral-500, #D63E22)",
      color: "#fff",
      fontSize: 11,
      fontWeight: 700,
      padding: "4px 9px",
      borderRadius: 999
    }
  }, "Going fast"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 15,
      right: 15,
      bottom: 12,
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mono,
      fontSize: 10,
      letterSpacing: ".1em",
      textShadow: "0 1px 4px rgba(0,0,0,.4)"
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      ...disp,
      fontWeight: 700,
      fontSize: 24,
      lineHeight: 1,
      marginTop: 4,
      textShadow: "0 1px 8px rgba(0,0,0,.45)"
    }
  }, place, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontFamily: "var(--font-body, sans-serif)",
      fontWeight: 500,
      fontSize: 13,
      opacity: .92,
      marginTop: 4
    }
  }, country, " \xB7 from ", origin)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "14px 16px 16px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...mono,
      fontSize: 11.5,
      color: "var(--fg-2, #685B47)"
    }
  }, from, " \u2192 ", to, " \xB7 ", dates, " \xB7 ", legs), /*#__PURE__*/React.createElement("div", {
    style: {
      ...disp,
      fontWeight: 700,
      fontSize: 17,
      lineHeight: 1.2,
      margin: "8px 0 12px"
    }
  }, headline), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      borderTop: "1.5px dashed var(--perforation, #C8B79C)",
      paddingTop: 13
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      ...disp,
      fontWeight: 800,
      fontSize: 27,
      letterSpacing: "-.03em"
    }
  }, "\u20AC", price), usual > price && /*#__PURE__*/React.createElement("s", {
    style: {
      fontWeight: 500,
      fontSize: 14,
      color: "var(--fg-3, #877860)",
      marginLeft: 6
    }
  }, "\u20AC", usual), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: 11,
      color: "var(--fg-3, #877860)",
      marginTop: 3
    }
  }, "return \xB7 ", airline, pct ? ` · −${pct}%` : "")), /*#__PURE__*/React.createElement("button", {
    onClick: onSee,
    style: {
      background: "var(--amber-500, #E2820E)",
      color: "var(--fg-on-amber, #1C1813)",
      border: "none",
      borderRadius: 12,
      fontFamily: "inherit",
      fontWeight: 600,
      fontSize: 13,
      padding: "10px 15px",
      cursor: "pointer",
      boxShadow: "var(--shadow-amber, 0 10px 28px rgba(226,130,14,.28))"
    }
  }, ctaLabel, " \u2192"))));
}
Object.assign(__ds_scope, { DealTicket });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/DealTicket.jsx", error: String((e && e.message) || e) }); }

// preview/image-slot.js
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)
/* BEGIN USAGE */
/**
 * <image-slot> — user-fillable image placeholder.
 *
 * Drop this into a deck, mockup, or page wherever you want the user to
 * supply an image. You control the slot's shape and size; the user fills it
 * by dragging an image file onto it (or clicking to browse). The dropped
 * image persists across reloads via a .image-slots.state.json sidecar —
 * same read-via-fetch / write-via-window.omelette pattern as
 * design_canvas.jsx, so the filled slot shows on share links, downloaded
 * zips, and PPTX export. Outside the omelette runtime the slot is read-only.
 *
 * The host bridge only allows sidecar writes at the project root, so the
 * HTML that uses this component is assumed to live at the project root too
 * (same constraint as design_canvas.jsx).
 *
 * Attributes:
 *   id           Persistence key. REQUIRED for the drop to survive reload —
 *                every slot on the page needs a distinct id.
 *   shape        'rect' | 'rounded' | 'circle' | 'pill'   (default 'rounded')
 *                'circle' applies 50% border-radius; on a non-square slot
 *                that's an ellipse — set equal width and height for a true
 *                circle.
 *   radius       Corner radius in px for 'rounded'.       (default 12)
 *   mask         Any CSS clip-path value. Overrides `shape` — use this for
 *                hexagons, blobs, arbitrary polygons.
 *   fit          object-fit: cover | contain | fill.       (default 'cover')
 *                With cover (the default) double-clicking the filled slot
 *                enters a reframe mode: the whole image spills past the mask
 *                (translucent outside, opaque inside), drag to reposition,
 *                corner-drag to scale. The crop persists alongside the image
 *                in the sidecar. contain/fill stay static.
 *   position     object-position for fit=contain|fill.     (default '50% 50%')
 *   placeholder  Empty-state caption.                      (default 'Drop an image')
 *   src          Optional initial/fallback image URL. A user drop overrides
 *                it; clearing the drop reveals src again.
 *
 * Size and layout come from ordinary CSS on the element — width/height
 * inline or from a parent grid — so it composes with any layout.
 *
 * Usage:
 *   <image-slot id="hero"   style="width:800px;height:450px" shape="rounded" radius="20"
 *               placeholder="Drop a hero image"></image-slot>
 *   <image-slot id="avatar" style="width:120px;height:120px" shape="circle"></image-slot>
 *   <image-slot id="kite"   style="width:300px;height:300px"
 *               mask="polygon(50% 0, 100% 50%, 50% 100%, 0 50%)"></image-slot>
 */
/* END USAGE */

(() => {
  const STATE_FILE = '.image-slots.state.json';
  // 2× a ~600px slot in a 1920-wide deck — retina-sharp without making the
  // sidecar enormous. A 1200px WebP at q=0.85 is ~150-300KB.
  const MAX_DIM = 1200;
  // Raster formats only. SVG is excluded (can carry script; createImageBitmap
  // on SVG blobs is inconsistent). GIF is excluded because the canvas
  // re-encode keeps only the first frame, so an animated GIF would silently
  // go still — better to reject than surprise.
  const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

  // ── Shared sidecar store ────────────────────────────────────────────────
  // One fetch + immediate write-on-change for every <image-slot> on the
  // page. Reads via fetch() so viewing works anywhere the HTML and sidecar
  // are served together; writes go through window.omelette.writeFile, which
  // the host allowlists to *.state.json basenames only.
  const subs = new Set();
  let slots = {};
  // ids explicitly cleared before the sidecar fetch resolved — otherwise
  // the merge below can't tell "never set" from "just deleted" and would
  // resurrect the sidecar's stale value.
  const tombstones = new Set();
  let loaded = false;
  let loadP = null;
  function load() {
    if (loadP) return loadP;
    loadP = fetch(STATE_FILE).then(r => r.ok ? r.json() : null).then(j => {
      // Merge: sidecar loses to any in-memory change that raced ahead of
      // the fetch (drop or clear) so neither is clobbered by hydration.
      if (j && typeof j === 'object') {
        const merged = Object.assign({}, j, slots);
        // A framing-only write that raced ahead of hydration must not
        // drop a user image that's only on disk — inherit u from the
        // sidecar for any in-memory entry that lacks one.
        for (const k in slots) {
          if (merged[k] && !merged[k].u && j[k]) {
            merged[k].u = typeof j[k] === 'string' ? j[k] : j[k].u;
          }
        }
        for (const id of tombstones) delete merged[id];
        slots = merged;
      }
      tombstones.clear();
    }).catch(() => {}).then(() => {
      loaded = true;
      subs.forEach(fn => fn());
    });
    return loadP;
  }

  // Serialize writes so two near-simultaneous drops on different slots
  // can't reorder at the backend and leave the sidecar with only the
  // first. A save requested mid-flight just marks dirty and re-fires on
  // completion with the then-current slots.
  let saving = false;
  let saveDirty = false;
  function save() {
    if (saving) {
      saveDirty = true;
      return;
    }
    const w = window.omelette && window.omelette.writeFile;
    if (!w) return;
    saving = true;
    Promise.resolve(w(STATE_FILE, JSON.stringify(slots))).catch(() => {}).then(() => {
      saving = false;
      if (saveDirty) {
        saveDirty = false;
        save();
      }
    });
  }
  const S_MAX = 5;
  const clampS = s => Math.max(1, Math.min(S_MAX, s));

  // Normalize a stored slot value. Pre-reframe sidecars stored a bare
  // data-URL string; newer ones store {u, s, x, y}. Either shape is valid.
  function getSlot(id) {
    const v = slots[id];
    if (!v) return null;
    return typeof v === 'string' ? {
      u: v,
      s: 1,
      x: 0,
      y: 0
    } : v;
  }
  function setSlot(id, val) {
    if (!id) return;
    if (val) {
      slots[id] = val;
      tombstones.delete(id);
    } else {
      delete slots[id];
      if (!loaded) tombstones.add(id);
    }
    subs.forEach(fn => fn());
    // A drop is rare + high-value — write immediately so nav-away can't lose
    // it. Gate on the initial read so we don't overwrite a sidecar we haven't
    // merged yet; the merge in load() keeps this change once the read lands.
    if (loaded) save();else load().then(save);
  }

  // ── Image downscale ─────────────────────────────────────────────────────
  // Encode through a canvas so the sidecar carries resized bytes, not the
  // raw upload. Longest side is capped at 2× the slot's rendered width
  // (retina) and at MAX_DIM. WebP keeps alpha and is ~10× smaller than PNG
  // for photos, so there's no need for per-image format picking.
  async function toDataUrl(file, targetW) {
    const bitmap = await createImageBitmap(file);
    try {
      const cap = Math.min(MAX_DIM, Math.max(1, Math.round(targetW * 2)) || MAX_DIM);
      const scale = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/webp', 0.85);
    } finally {
      bitmap.close && bitmap.close();
    }
  }

  // ── Custom element ──────────────────────────────────────────────────────
  const stylesheet = ':host{display:inline-block;position:relative;vertical-align:top;' + '  font:13px/1.3 system-ui,-apple-system,sans-serif;color:rgba(0,0,0,.55);width:240px;height:160px}' + '.frame{position:absolute;inset:0;overflow:hidden;background:rgba(0,0,0,.04)}' +
  // .frame img (clipped) and .spill (unclipped ghost + handles) share the
  // same left/top/width/height in frame-%, computed by _applyView(), so the
  // inside-mask crop and the outside-mask spill stay pixel-aligned.
  '.frame img{position:absolute;max-width:none;transform:translate(-50%,-50%);' + '  -webkit-user-drag:none;user-select:none;touch-action:none}' +
  // Reframe mode (double-click): the full image spills past the mask. The
  // spill layer is sized to the IMAGE bounds so its corners are where the
  // resize handles belong. The ghost <img> inside is translucent; the real
  // clipped <img> underneath shows the opaque in-mask crop.
  '.spill{position:absolute;transform:translate(-50%,-50%);display:none;z-index:1;' + '  cursor:grab;touch-action:none}' + ':host([data-panning]) .spill{cursor:grabbing}' + '.spill .ghost{position:absolute;inset:0;width:100%;height:100%;opacity:.35;' + '  pointer-events:none;-webkit-user-drag:none;user-select:none;' + '  box-shadow:0 0 0 1px rgba(0,0,0,.2),0 12px 32px rgba(0,0,0,.2)}' + '.spill .handle{position:absolute;width:12px;height:12px;border-radius:50%;' + '  background:#fff;box-shadow:0 0 0 1.5px #c96442,0 1px 3px rgba(0,0,0,.3);' + '  transform:translate(-50%,-50%)}' + '.spill .handle[data-c=nw]{left:0;top:0;cursor:nwse-resize}' + '.spill .handle[data-c=ne]{left:100%;top:0;cursor:nesw-resize}' + '.spill .handle[data-c=sw]{left:0;top:100%;cursor:nesw-resize}' + '.spill .handle[data-c=se]{left:100%;top:100%;cursor:nwse-resize}' + ':host([data-reframe]){z-index:10}' + ':host([data-reframe]) .spill{display:block}' + ':host([data-reframe]) .frame{box-shadow:0 0 0 2px #c96442}' + '.empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;' + '  justify-content:center;gap:6px;text-align:center;padding:12px;box-sizing:border-box;' + '  cursor:pointer;user-select:none}' + '.empty svg{opacity:.45}' + '.empty .cap{max-width:90%;font-weight:500;letter-spacing:.01em}' + '.empty .sub{font-size:11px}' + '.empty .sub u{text-underline-offset:2px;text-decoration-color:rgba(0,0,0,.25)}' + '.empty:hover .sub u{color:rgba(0,0,0,.75);text-decoration-color:currentColor}' + ':host([data-over]) .frame{outline:2px solid #c96442;outline-offset:-2px;' + '  background:rgba(201,100,66,.10)}' + '.ring{position:absolute;inset:0;pointer-events:none;border:1.5px dashed rgba(0,0,0,.25);' + '  transition:border-color .12s}' + ':host([data-over]) .ring{border-color:#c96442}' + ':host([data-filled]) .ring{display:none}' +
  // Controls sit BELOW the mask (top:100%), absolutely positioned so the
  // author-declared slot height is unaffected. The gap is padding, not a
  // top offset, so the hover target stays contiguous with the frame.
  '.ctl{position:absolute;top:100%;left:50%;transform:translateX(-50%);padding-top:8px;' + '  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .12s;z-index:2;' + '  white-space:nowrap}' + ':host([data-filled][data-editable]:hover) .ctl,:host([data-reframe]) .ctl' + '  {opacity:1;pointer-events:auto}' + '.ctl button{appearance:none;border:0;border-radius:6px;padding:5px 10px;cursor:pointer;' + '  background:rgba(0,0,0,.65);color:#fff;font:11px/1 system-ui,-apple-system,sans-serif;' + '  backdrop-filter:blur(6px)}' + '.ctl button:hover{background:rgba(0,0,0,.8)}' + '.err{position:absolute;left:8px;bottom:8px;right:8px;color:#b3261e;font-size:11px;' + '  background:rgba(255,255,255,.85);padding:4px 6px;border-radius:5px;pointer-events:none}';
  const icon = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' + 'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>' + '<path d="m21 15-5-5L5 21"/></svg>';
  class ImageSlot extends HTMLElement {
    static get observedAttributes() {
      return ['shape', 'radius', 'mask', 'fit', 'position', 'placeholder', 'src', 'id'];
    }
    constructor() {
      super();
      const root = this.attachShadow({
        mode: 'open'
      });
      // .spill and .ctl sit OUTSIDE .frame so overflow:hidden + border-radius
      // on the frame (circle, pill, rounded) can't clip them.
      root.innerHTML = '<style>' + stylesheet + '</style>' + '<div class="frame" part="frame">' + '  <img part="image" alt="" draggable="false" style="display:none">' + '  <div class="empty" part="empty">' + icon + '    <div class="cap"></div>' + '    <div class="sub">or <u>browse files</u></div></div>' + '  <div class="ring" part="ring"></div>' + '</div>' + '<div class="spill">' + '  <img class="ghost" alt="" draggable="false">' + '  <div class="handle" data-c="nw"></div><div class="handle" data-c="ne"></div>' + '  <div class="handle" data-c="sw"></div><div class="handle" data-c="se"></div>' + '</div>' + '<div class="ctl"><button data-act="replace" title="Replace image">Replace</button>' + '  <button data-act="clear" title="Remove image">Remove</button></div>' + '<input type="file" accept="' + ACCEPT.join(',') + '" hidden>';
      this._frame = root.querySelector('.frame');
      this._ring = root.querySelector('.ring');
      this._img = root.querySelector('.frame img');
      this._empty = root.querySelector('.empty');
      this._cap = root.querySelector('.cap');
      this._sub = root.querySelector('.sub');
      this._spill = root.querySelector('.spill');
      this._ghost = root.querySelector('.ghost');
      this._err = null;
      this._input = root.querySelector('input');
      this._depth = 0;
      this._gen = 0;
      this._view = {
        s: 1,
        x: 0,
        y: 0
      };
      this._subFn = () => this._render();
      // Shadow-DOM listeners live with the shadow DOM — bound once here so
      // disconnect/reconnect (e.g. React remount) doesn't stack handlers.
      this._empty.addEventListener('click', () => this._input.click());
      root.addEventListener('click', e => {
        const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
        if (act === 'replace') {
          this._exitReframe(true);
          this._input.click();
        }
        if (act === 'clear') {
          this._exitReframe(false);
          this._gen++;
          this._local = null;
          if (this.id) setSlot(this.id, null);else this._render();
        }
      });
      this._input.addEventListener('change', () => {
        const f = this._input.files && this._input.files[0];
        if (f) this._ingest(f);
        this._input.value = '';
      });
      // naturalWidth/Height aren't known until load — re-apply so the cover
      // baseline is computed from real dimensions, not the 100%×100% fallback.
      this._img.addEventListener('load', () => this._applyView());
      // Gated on editable + fit=cover so share links and contain/fill slots
      // stay static.
      this.addEventListener('dblclick', e => {
        if (!this.hasAttribute('data-editable') || !this._reframes()) return;
        e.preventDefault();
        if (this.hasAttribute('data-reframe')) this._exitReframe(true);else this._enterReframe();
      });
      // Pan + resize both originate on the spill layer. A handle pointerdown
      // drives an aspect-locked resize anchored at the opposite corner; any
      // other pointerdown on the spill pans. Offsets are frame-% so a
      // reframed slot survives responsive resize / PPTX export.
      this._spill.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        e.stopPropagation();
        this._spill.setPointerCapture(e.pointerId);
        const rect = this.getBoundingClientRect();
        const fw = rect.width || 1,
          fh = rect.height || 1;
        const corner = e.target.getAttribute && e.target.getAttribute('data-c');
        let move;
        if (corner) {
          // Resize about the OPPOSITE corner. Viewport-px throughout (rect
          // fw/fh, not clientWidth) so the math survives a transform:scale()
          // ancestor — deck_stage renders slides scaled-to-fit.
          const iw = this._img.naturalWidth || 1,
            ih = this._img.naturalHeight || 1;
          const base = Math.max(fw / iw, fh / ih);
          const sx = corner.includes('e') ? 1 : -1;
          const sy = corner.includes('s') ? 1 : -1;
          const s0 = this._view.s;
          const w0 = iw * base * s0,
            h0 = ih * base * s0;
          const cx0 = (50 + this._view.x) / 100 * fw;
          const cy0 = (50 + this._view.y) / 100 * fh;
          const ox = cx0 - sx * w0 / 2,
            oy = cy0 - sy * h0 / 2;
          const diag0 = Math.hypot(w0, h0);
          const ux = sx * w0 / diag0,
            uy = sy * h0 / diag0;
          move = ev => {
            const proj = (ev.clientX - rect.left - ox) * ux + (ev.clientY - rect.top - oy) * uy;
            const s = clampS(s0 * proj / diag0);
            const d = diag0 * s / s0;
            this._view.s = s;
            this._view.x = (ox + ux * d / 2) / fw * 100 - 50;
            this._view.y = (oy + uy * d / 2) / fh * 100 - 50;
            this._clampView();
            this._applyView();
          };
        } else {
          this.setAttribute('data-panning', '');
          const start = {
            px: e.clientX,
            py: e.clientY,
            x: this._view.x,
            y: this._view.y
          };
          move = ev => {
            this._view.x = start.x + (ev.clientX - start.px) / fw * 100;
            this._view.y = start.y + (ev.clientY - start.py) / fh * 100;
            this._clampView();
            this._applyView();
          };
        }
        const up = () => {
          try {
            this._spill.releasePointerCapture(e.pointerId);
          } catch {}
          this._spill.removeEventListener('pointermove', move);
          this._spill.removeEventListener('pointerup', up);
          this._spill.removeEventListener('pointercancel', up);
          this.removeAttribute('data-panning');
          this._dragUp = null;
        };
        // Stashed so _exitReframe (Escape / outside-click mid-drag) can
        // tear the capture + listeners down synchronously.
        this._dragUp = up;
        this._spill.addEventListener('pointermove', move);
        this._spill.addEventListener('pointerup', up);
        this._spill.addEventListener('pointercancel', up);
      });
      // Wheel zoom stays available inside reframe mode as a trackpad nicety —
      // zooms toward the cursor (offset' = cursor·(1-k) + offset·k).
      this.addEventListener('wheel', e => {
        if (!this.hasAttribute('data-reframe')) return;
        e.preventDefault();
        const r = this.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width * 100 - 50;
        const cy = (e.clientY - r.top) / r.height * 100 - 50;
        const prev = this._view.s;
        const next = clampS(prev * Math.pow(1.0015, -e.deltaY));
        if (next === prev) return;
        const k = next / prev;
        this._view.s = next;
        this._view.x = cx * (1 - k) + this._view.x * k;
        this._view.y = cy * (1 - k) + this._view.y * k;
        this._clampView();
        this._applyView();
      }, {
        passive: false
      });
    }
    connectedCallback() {
      // Warn once per page — an id-less slot works for the session but
      // cannot persist, and two id-less slots would share nothing.
      if (!this.id && !ImageSlot._warned) {
        ImageSlot._warned = true;
        console.warn('<image-slot> without an id will not persist its dropped image.');
      }
      this.addEventListener('dragenter', this);
      this.addEventListener('dragover', this);
      this.addEventListener('dragleave', this);
      this.addEventListener('drop', this);
      subs.add(this._subFn);
      // width%/height% in _applyView encode the frame aspect at call time —
      // a host resize (responsive grid, pane divider) would stretch the
      // image until the next _render. Re-render on size change: _render()
      // re-seeds _view from stored before clamp/apply, so a shrink→grow
      // cycle round-trips instead of ratcheting x/y toward the narrower
      // frame's clamp range.
      this._ro = new ResizeObserver(() => this._render());
      this._ro.observe(this);
      load();
      this._render();
    }
    disconnectedCallback() {
      subs.delete(this._subFn);
      this.removeEventListener('dragenter', this);
      this.removeEventListener('dragover', this);
      this.removeEventListener('dragleave', this);
      this.removeEventListener('drop', this);
      if (this._ro) {
        this._ro.disconnect();
        this._ro = null;
      }
      this._exitReframe(false);
    }
    _enterReframe() {
      if (this.hasAttribute('data-reframe')) return;
      this.setAttribute('data-reframe', '');
      this._applyView();
      // Close on click outside (the spill handler stopPropagation()s so
      // in-image drags don't reach this) and on Escape. Listeners are held
      // on the instance so _exitReframe / disconnectedCallback can detach
      // exactly what was attached.
      this._outside = e => {
        if (e.composedPath && e.composedPath().includes(this)) return;
        this._exitReframe(true);
      };
      this._esc = e => {
        if (e.key === 'Escape') this._exitReframe(true);
      };
      document.addEventListener('pointerdown', this._outside, true);
      document.addEventListener('keydown', this._esc, true);
    }
    _exitReframe(commit) {
      if (!this.hasAttribute('data-reframe')) return;
      if (this._dragUp) this._dragUp();
      this.removeAttribute('data-reframe');
      this.removeAttribute('data-panning');
      if (this._outside) document.removeEventListener('pointerdown', this._outside, true);
      if (this._esc) document.removeEventListener('keydown', this._esc, true);
      this._outside = this._esc = null;
      if (commit) this._commitView();
    }
    attributeChangedCallback() {
      if (this.shadowRoot) this._render();
    }

    // handleEvent — one listener object for all four drag events keeps the
    // add/remove symmetric and the depth counter correct.
    handleEvent(e) {
      if (e.type === 'dragenter' || e.type === 'dragover') {
        // Without preventDefault the browser never fires 'drop'.
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        if (e.type === 'dragenter') this._depth++;
        this.setAttribute('data-over', '');
      } else if (e.type === 'dragleave') {
        // dragenter/leave fire for every descendant crossing — count depth
        // so hovering the icon inside the empty state doesn't flicker.
        if (--this._depth <= 0) {
          this._depth = 0;
          this.removeAttribute('data-over');
        }
      } else if (e.type === 'drop') {
        e.preventDefault();
        e.stopPropagation();
        this._depth = 0;
        this.removeAttribute('data-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) this._ingest(f);
      }
    }
    async _ingest(file) {
      this._setError(null);
      if (!file || ACCEPT.indexOf(file.type) < 0) {
        this._setError('Drop a PNG, JPEG, WebP, or AVIF image.');
        return;
      }
      // toDataUrl can take hundreds of ms on a large photo. A Clear or a
      // newer drop during that window would be clobbered when this await
      // resumes — bump + capture a generation so stale encodes bail.
      const gen = ++this._gen;
      try {
        const w = this.clientWidth || this.offsetWidth || MAX_DIM;
        const url = await toDataUrl(file, w);
        if (gen !== this._gen) return;
        // Only exit reframe once the new image is in hand — a rejected type
        // or decode failure leaves the in-progress crop untouched.
        this._exitReframe(false);
        const val = {
          u: url,
          s: 1,
          x: 0,
          y: 0
        };
        setSlot(this.id || '', val);
        // Keep a session-local copy for id-less slots so the drop still
        // shows, even though it cannot persist.
        if (!this.id) {
          this._local = val;
          this._render();
        }
      } catch (err) {
        if (gen !== this._gen) return;
        this._setError('Could not read that image.');
        console.warn('<image-slot> ingest failed:', err);
      }
    }
    _setError(msg) {
      if (this._err) {
        this._err.remove();
        this._err = null;
      }
      if (!msg) return;
      const d = document.createElement('div');
      d.className = 'err';
      d.textContent = msg;
      this.shadowRoot.appendChild(d);
      this._err = d;
      setTimeout(() => {
        if (this._err === d) {
          d.remove();
          this._err = null;
        }
      }, 3000);
    }

    // Reframing (pan/resize) is only meaningful for fit=cover — contain/fill
    // keep the old object-fit path and double-click is a no-op.
    _reframes() {
      return this.hasAttribute('data-filled') && (this.getAttribute('fit') || 'cover') === 'cover';
    }

    // Cover-baseline geometry, shared by clamp/apply/resize. Null until the
    // img has loaded (naturalWidth is 0 before that) or when the slot has no
    // layout box — ResizeObserver fires with a 0×0 rect under display:none,
    // and clamping against a degenerate 1×1 frame would silently pull the
    // stored pan toward zero.
    _geom() {
      const iw = this._img.naturalWidth,
        ih = this._img.naturalHeight;
      const fw = this.clientWidth,
        fh = this.clientHeight;
      if (!iw || !ih || !fw || !fh) return null;
      return {
        iw,
        ih,
        fw,
        fh,
        base: Math.max(fw / iw, fh / ih)
      };
    }
    _clampView() {
      // Pan range on each axis is half the overflow past the frame edge.
      const g = this._geom();
      if (!g) return;
      const mx = Math.max(0, (g.iw * g.base * this._view.s / g.fw - 1) * 50);
      const my = Math.max(0, (g.ih * g.base * this._view.s / g.fh - 1) * 50);
      this._view.x = Math.max(-mx, Math.min(mx, this._view.x));
      this._view.y = Math.max(-my, Math.min(my, this._view.y));
    }
    _applyView() {
      const g = this._geom();
      const fit = this.getAttribute('fit') || 'cover';
      if (fit !== 'cover' || !g) {
        // Non-cover, or dimensions not known yet (before img load).
        this._img.style.width = '100%';
        this._img.style.height = '100%';
        this._img.style.left = '50%';
        this._img.style.top = '50%';
        this._img.style.objectFit = fit;
        this._img.style.objectPosition = this.getAttribute('position') || '50% 50%';
        return;
      }
      // Cover baseline: img fills the frame on its tighter axis at s=1, so
      // pan works immediately on the overflowing axis without zooming first.
      // Width/height and left/top are all frame-% — depends only on the
      // frame aspect ratio, so a responsive resize keeps the same crop. The
      // spill layer mirrors the same box so its corners = image corners.
      const k = g.base * this._view.s;
      const w = g.iw * k / g.fw * 100 + '%';
      const h = g.ih * k / g.fh * 100 + '%';
      const l = 50 + this._view.x + '%';
      const t = 50 + this._view.y + '%';
      this._img.style.width = w;
      this._img.style.height = h;
      this._img.style.left = l;
      this._img.style.top = t;
      this._img.style.objectFit = '';
      this._spill.style.width = w;
      this._spill.style.height = h;
      this._spill.style.left = l;
      this._spill.style.top = t;
    }
    _commitView() {
      const v = {
        s: this._view.s,
        x: this._view.x,
        y: this._view.y
      };
      if (this._userUrl) v.u = this._userUrl;
      // Framing-only (no u) persists too so an author-src slot remembers its
      // crop; clearing the sidecar still falls through to src=.
      if (this.id) setSlot(this.id, v);else {
        this._local = v;
      }
    }
    _render() {
      // Shape / mask. Presets use border-radius so the dashed ring can
      // follow the rounded outline; clip-path is only applied for an
      // explicit `mask` (the ring is hidden there since a rectangle
      // dashed border chopped by an arbitrary polygon looks broken).
      const mask = this.getAttribute('mask');
      const shape = (this.getAttribute('shape') || 'rounded').toLowerCase();
      let radius = '';
      if (shape === 'circle') radius = '50%';else if (shape === 'pill') radius = '9999px';else if (shape === 'rounded') {
        const n = parseFloat(this.getAttribute('radius'));
        radius = (Number.isFinite(n) ? n : 12) + 'px';
      }
      this._frame.style.borderRadius = mask ? '' : radius;
      this._frame.style.clipPath = mask || '';
      this._ring.style.borderRadius = mask ? '' : radius;
      this._ring.style.display = mask ? 'none' : '';

      // Controls and reframe entry gate on this so share links stay read-only.
      const editable = !!(window.omelette && window.omelette.writeFile);
      this.toggleAttribute('data-editable', editable);
      this._sub.style.display = editable ? '' : 'none';

      // Content. The sidecar is also writable by the agent's write_file
      // tool, so its value isn't guaranteed canvas-originated — only accept
      // data:image/ URLs from it. The `src` attribute is author-controlled
      // (Claude wrote it into the HTML) so it passes through unchanged.
      let stored = this.id ? getSlot(this.id) : this._local;
      if (stored && stored.u && !/^data:image\//i.test(stored.u)) stored = null;
      const srcAttr = this.getAttribute('src') || '';
      this._userUrl = stored && stored.u || null;
      const url = this._userUrl || srcAttr;
      // Don't clobber an in-flight reframe with a store-triggered re-render.
      if (!this.hasAttribute('data-reframe')) {
        this._view = {
          s: stored && Number.isFinite(stored.s) ? clampS(stored.s) : 1,
          x: stored && Number.isFinite(stored.x) ? stored.x : 0,
          y: stored && Number.isFinite(stored.y) ? stored.y : 0
        };
      }
      this._cap.textContent = this.getAttribute('placeholder') || 'Drop an image';
      // Toggle via style.display — the [hidden] attribute alone loses to
      // the display:flex / display:block rules in the stylesheet above.
      if (url) {
        if (this._img.getAttribute('src') !== url) {
          this._img.src = url;
          this._ghost.src = url;
        }
        this._img.style.display = 'block';
        this._empty.style.display = 'none';
        this.setAttribute('data-filled', '');
        this._clampView();
        this._applyView();
      } else {
        this._img.style.display = 'none';
        this._img.removeAttribute('src');
        this._ghost.removeAttribute('src');
        this._empty.style.display = 'flex';
        this.removeAttribute('data-filled');
      }
    }
  }
  if (!customElements.get('image-slot')) {
    customElements.define('image-slot', ImageSlot);
  }
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "preview/image-slot.js", error: String((e && e.message) || e) }); }

// screens/ios-frame.jsx
try { (() => {
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// iOS.jsx — Simplified iOS 26 (Liquid Glass) device frame
// Based on the iOS 26 UI Kit + Figma status bar spec. No assets, no deps.
// Exports (to window): IOSDevice, IOSStatusBar, IOSNavBar, IOSGlassPill, IOSList, IOSListRow, IOSKeyboard
//
// Usage — wrap your screen content in <IOSDevice> to get the bezel, status bar
// and home indicator (props: title, dark, keyboard):
//
//   <IOSDevice title="Settings">
//     ...your screen content...
//   </IOSDevice>
//   <IOSDevice dark title="Search" keyboard>…</IOSDevice>
/* END USAGE */

// ─────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────
function IOSStatusBar({
  dark = false,
  time = '9:41'
}) {
  const c = dark ? '#fff' : '#000';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 154,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '21px 24px 19px',
      boxSizing: 'border-box',
      position: 'relative',
      zIndex: 20,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 1.5
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: '-apple-system, "SF Pro", system-ui',
      fontWeight: 590,
      fontSize: 17,
      lineHeight: '22px',
      color: c
    }
  }, time)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 22,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingTop: 1,
      paddingRight: 1
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "19",
    height: "12",
    viewBox: "0 0 19 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7.5",
    width: "3.2",
    height: "4.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.8",
    y: "5",
    width: "3.2",
    height: "7",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "9.6",
    y: "2.5",
    width: "3.2",
    height: "9.5",
    rx: "0.7",
    fill: c
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14.4",
    y: "0",
    width: "3.2",
    height: "12",
    rx: "0.7",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "12",
    viewBox: "0 0 17 12"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z",
    fill: c
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "10.5",
    r: "1.5",
    fill: c
  })), /*#__PURE__*/React.createElement("svg", {
    width: "27",
    height: "13",
    viewBox: "0 0 27 13"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "23",
    height: "12",
    rx: "3.5",
    stroke: c,
    strokeOpacity: "0.35",
    fill: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "9",
    rx: "2",
    fill: c
  }), /*#__PURE__*/React.createElement("path", {
    d: "M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z",
    fill: c,
    fillOpacity: "0.4"
  }))));
}

// ─────────────────────────────────────────────────────────────
// Liquid glass pill — blur + tint + shine
// ─────────────────────────────────────────────────────────────
function IOSGlassPill({
  children,
  dark = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 44,
      minWidth: 44,
      borderRadius: 9999,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: dark ? '0 2px 6px rgba(0,0,0,0.35), 0 6px 16px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.07), 0 3px 10px rgba(0,0,0,0.06)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.28)' : 'rgba(255,255,255,0.5)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 9999,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15), inset -1px -1px 1px rgba(255,255,255,0.08)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      display: 'flex',
      alignItems: 'center',
      padding: '0 4px'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Navigation bar — glass pills + large title
// ─────────────────────────────────────────────────────────────
function IOSNavBar({
  title = 'Title',
  dark = false,
  trailingIcon = true
}) {
  const muted = dark ? 'rgba(255,255,255,0.6)' : '#404040';
  const text = dark ? '#fff' : '#000';
  const pillIcon = content => /*#__PURE__*/React.createElement(IOSGlassPill, {
    dark: dark
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, content));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingTop: 62,
      paddingBottom: 10,
      position: 'relative',
      zIndex: 5
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }
  }, pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "20",
    viewBox: "0 0 12 20",
    fill: "none",
    style: {
      marginLeft: -1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 2L2 10l8 8",
    stroke: muted,
    strokeWidth: "2.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), trailingIcon && pillIcon(/*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "6",
    viewBox: "0 0 22 6"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "3",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "3",
    r: "2.5",
    fill: muted
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "19",
    cy: "3",
    r: "2.5",
    fill: muted
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px',
      fontFamily: '-apple-system, system-ui',
      fontSize: 34,
      fontWeight: 700,
      lineHeight: '41px',
      color: text,
      letterSpacing: 0.4
    }
  }, title));
}

// ─────────────────────────────────────────────────────────────
// Grouped list (inset card, r:26) + row (52px)
// ─────────────────────────────────────────────────────────────
function IOSListRow({
  title,
  detail,
  icon,
  chevron = true,
  isLast = false,
  dark = false
}) {
  const text = dark ? '#fff' : '#000';
  const sec = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const ter = dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)';
  const sep = dark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.12)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      minHeight: 52,
      padding: '0 16px',
      position: 'relative',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      letterSpacing: -0.43
    }
  }, icon && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: icon,
      marginRight: 12,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      color: text
    }
  }, title), detail && /*#__PURE__*/React.createElement("span", {
    style: {
      color: sec,
      marginRight: 6
    }
  }, detail), chevron && /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "14",
    viewBox: "0 0 8 14",
    style: {
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M1 1l6 6-6 6",
    stroke: ter,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), !isLast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      left: icon ? 58 : 16,
      height: 0.5,
      background: sep
    }
  }));
}
function IOSList({
  header,
  children,
  dark = false
}) {
  const hc = dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)';
  const bg = dark ? '#1C1C1E' : '#fff';
  return /*#__PURE__*/React.createElement("div", null, header && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: '-apple-system, system-ui',
      fontSize: 13,
      color: hc,
      textTransform: 'uppercase',
      padding: '8px 36px 6px',
      letterSpacing: -0.08
    }
  }, header), /*#__PURE__*/React.createElement("div", {
    style: {
      background: bg,
      borderRadius: 26,
      margin: '0 16px',
      overflow: 'hidden'
    }
  }, children));
}

// ─────────────────────────────────────────────────────────────
// Device frame
// ─────────────────────────────────────────────────────────────
function IOSDevice({
  children,
  width = 402,
  height = 874,
  dark = false,
  title,
  keyboard = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      borderRadius: 48,
      overflow: 'hidden',
      position: 'relative',
      background: dark ? '#000' : '#F2F2F7',
      boxShadow: '0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)',
      fontFamily: '-apple-system, system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 11,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 126,
      height: 37,
      borderRadius: 24,
      background: '#000',
      zIndex: 50
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10
    }
  }, /*#__PURE__*/React.createElement(IOSStatusBar, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }
  }, title !== undefined && /*#__PURE__*/React.createElement(IOSNavBar, {
    title: title,
    dark: dark
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflow: 'auto'
    }
  }, children), keyboard && /*#__PURE__*/React.createElement(IOSKeyboard, {
    dark: dark
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      height: 34,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-end',
      paddingBottom: 8,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 139,
      height: 5,
      borderRadius: 100,
      background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// Keyboard — iOS 26 liquid glass
// ─────────────────────────────────────────────────────────────
function IOSKeyboard({
  dark = false
}) {
  const glyph = dark ? 'rgba(255,255,255,0.7)' : '#595959';
  const sugg = dark ? 'rgba(255,255,255,0.6)' : '#333';
  const keyBg = dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)';

  // special-key icons
  const icons = {
    shift: /*#__PURE__*/React.createElement("svg", {
      width: "19",
      height: "17",
      viewBox: "0 0 19 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9.5 1L1 9.5h4.5V16h8V9.5H18L9.5 1z",
      fill: glyph
    })),
    del: /*#__PURE__*/React.createElement("svg", {
      width: "23",
      height: "17",
      viewBox: "0 0 23 17"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M7 1h13a2 2 0 012 2v11a2 2 0 01-2 2H7l-6-7.5L7 1z",
      fill: "none",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 5l7 7M17 5l-7 7",
      stroke: glyph,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    ret: /*#__PURE__*/React.createElement("svg", {
      width: "20",
      height: "14",
      viewBox: "0 0 20 14"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M18 1v6H4m0 0l4-4M4 7l4 4",
      fill: "none",
      stroke: "#fff",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }))
  };
  const key = (content, {
    w,
    flex,
    ret,
    fs = 25,
    k
  } = {}) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      height: 42,
      borderRadius: 8.5,
      flex: flex ? 1 : undefined,
      width: w,
      minWidth: 0,
      background: ret ? '#08f' : keyBg,
      boxShadow: '0 1px 0 rgba(0,0,0,0.075)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, "SF Compact", system-ui',
      fontSize: fs,
      fontWeight: 458,
      color: ret ? '#fff' : glyph
    }
  }, content);
  const row = (keys, pad = 0) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      justifyContent: 'center',
      padding: `0 ${pad}px`
    }
  }, keys.map(l => key(l, {
    flex: true,
    k: l
  })));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 15,
      borderRadius: 27,
      overflow: 'hidden',
      padding: '11px 0 2px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxShadow: dark ? '0 -2px 20px rgba(0,0,0,0.09)' : '0 -1px 6px rgba(0,0,0,0.018), 0 -3px 20px rgba(0,0,0,0.012)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      background: dark ? 'rgba(120,120,128,0.14)' : 'rgba(255,255,255,0.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 27,
      boxShadow: dark ? 'inset 1.5px 1.5px 1px rgba(255,255,255,0.15)' : 'inset 1.5px 1.5px 1px rgba(255,255,255,0.7), inset -1px -1px 1px rgba(255,255,255,0.4)',
      border: dark ? '0.5px solid rgba(255,255,255,0.15)' : '0.5px solid rgba(0,0,0,0.06)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 20,
      alignItems: 'center',
      padding: '8px 22px 13px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, ['"The"', 'the', 'to'].map((w, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 1,
      height: 25,
      background: '#ccc',
      opacity: 0.3
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: '-apple-system, system-ui',
      fontSize: 17,
      color: sugg,
      letterSpacing: -0.43,
      lineHeight: '22px'
    }
  }, w)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13,
      padding: '0 6.5px',
      width: '100%',
      boxSizing: 'border-box',
      position: 'relative'
    }
  }, row(['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p']), row(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], 20), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14.25,
      alignItems: 'center'
    }
  }, key(icons.shift, {
    w: 45,
    k: 'shift'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6.5,
      flex: 1
    }
  }, ['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(l => key(l, {
    flex: true,
    k: l
  }))), key(icons.del, {
    w: 45,
    k: 'del'
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, key('ABC', {
    w: 92.25,
    fs: 18,
    k: 'abc'
  }), key('', {
    flex: true,
    k: 'space'
  }), key(icons.ret, {
    w: 92.25,
    ret: true,
    k: 'ret'
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      width: '100%',
      position: 'relative'
    }
  }));
}
Object.assign(window, {
  IOSDevice,
  IOSStatusBar,
  IOSNavBar,
  IOSGlassPill,
  IOSList,
  IOSListRow,
  IOSKeyboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "screens/ios-frame.jsx", error: String((e && e.message) || e) }); }

// screens/mobile-app.jsx
try { (() => {
/* Yip Deal Desk — mobile app (interactive). Renders inside <IOSDevice>. */

function MIcon({
  name,
  size = 20,
  color,
  sw = 2,
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = `<i data-lucide="${name}"></i>`;
    window.lucide.createIcons();
    const svg = el.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);
      svg.setAttribute("stroke-width", sw);
    }
  }, [name, size, sw]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      display: "inline-flex",
      width: size,
      height: size,
      color,
      flex: "none",
      ...style
    }
  });
}
const DEALS = [{
  id: "lca",
  place: "Larnaca",
  country: "Cyprus",
  from: "VNO",
  to: "LCA",
  origin: "Vilnius",
  price: 59,
  usual: 102,
  drop: 42,
  dates: "14–21 Oct",
  legs: "Direct · 4h",
  airline: "Wizz Air",
  template: "Last warm days",
  score: 92,
  hot: true,
  grad: "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
  why: [["trending-down", "42% below the 90-day median"], ["plane", "Direct both ways — no self-transfer"], ["sun", "Still 27°C, warm sea, quiet beaches"]],
  caveats: [["luggage", "Hand luggage only (+€25 for a bag)"], ["clock", "Return lands 23:40"]],
  headline: "€59 return to Cyprus — last warm week of the year",
  hook: "POV: it's 6°C in Vilnius but you found €59 returns to 27°C Cyprus 🌴"
}, {
  id: "vie",
  place: "Vienna",
  country: "Austria",
  from: "VNO",
  to: "VIE",
  origin: "Vilnius",
  price: 45,
  usual: 88,
  drop: 49,
  dates: "5–8 Dec",
  legs: "Direct · 1h45",
  airline: "Ryanair",
  template: "Christmas markets",
  score: 88,
  hot: true,
  grad: "linear-gradient(150deg,#ED7660,#B53017 70%,#4A4034)",
  why: [["trending-down", "49% below median"], ["snowflake", "Peak Christmas-market season"], ["plane", "Direct, short hop"]],
  caveats: [["luggage", "Hand luggage only"], ["bus", "Bus from airport ~25 min"]],
  headline: "Vienna Christmas-market weekend for €45",
  hook: "€45 return to Vienna for the Christmas markets?? sending to the group chat 🎄"
}, {
  id: "agp",
  place: "Málaga",
  country: "Spain",
  from: "KUN",
  to: "AGP",
  origin: "Kaunas",
  price: 52,
  usual: 110,
  drop: 53,
  dates: "This Fri–Mon",
  legs: "Direct · 4h30",
  airline: "Ryanair",
  template: "Last-minute weekends",
  score: 76,
  hot: true,
  grad: "linear-gradient(150deg,#EFA227,#E55438 70%,#7A410E)",
  why: [["trending-down", "53% below median"], ["plane", "Direct from Kaunas"], ["sun", "25°C — last beach days"]],
  caveats: [["clock", "Return lands 00:35"], ["alert-triangle", "Limited seats left"]],
  headline: "Costa del Sol escape — leaving this Friday, €52",
  hook: "leaving for málaga friday for €52 and telling my boss monday 😎"
}];
const C = {
  page: "var(--bg-page)",
  surface: "var(--bg-surface)",
  ink: "var(--fg-1)",
  fg2: "var(--fg-2)",
  fg3: "var(--fg-3)",
  amber: "var(--amber-500)",
  amber700: "var(--amber-700)",
  sea: "var(--sea-500)",
  sea700: "var(--sea-700)",
  line: "var(--line)",
  lineSoft: "var(--line-soft)",
  coral: "var(--coral-500)",
  fmono: "var(--font-mono)",
  fdisp: "var(--font-display)"
};
const STATUS_PAD = 56; // clear the status bar / island
const TAB_H = 84; // bottom tab bar incl. home indicator

function ScoreDot({
  s,
  size = 44
}) {
  const tone = s >= 80 ? ["var(--sea-50)", "var(--sea-700)"] : s >= 60 ? ["var(--amber-50)", "var(--amber-700)"] : ["var(--sand-100)", "var(--sand-500)"];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      background: tone[0],
      color: tone[1],
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      flex: "none",
      fontFamily: C.fdisp,
      fontWeight: 800,
      fontSize: size * 0.38,
      lineHeight: 1
    }
  }, s, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: C.fmono,
      fontSize: 7,
      fontWeight: 700,
      letterSpacing: ".06em",
      opacity: .8,
      marginTop: 1
    }
  }, "SCORE"));
}
function Chip({
  icon,
  children,
  tone = "sand"
}) {
  const map = {
    sea: ["var(--sea-50)", "var(--sea-700)"],
    sand: ["var(--sand-100)", "var(--sand-700)"],
    amber: ["var(--amber-100)", "var(--amber-800)"]
  };
  const [bg, fg] = map[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      background: bg,
      color: fg,
      fontSize: 12,
      fontWeight: 600,
      padding: "5px 10px",
      borderRadius: 999,
      whiteSpace: "nowrap"
    }
  }, icon && /*#__PURE__*/React.createElement(MIcon, {
    name: icon,
    size: 13
  }), children);
}
function AppHeader({
  title,
  sub,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: STATUS_PAD,
      padding: `${STATUS_PAD}px 20px 12px`,
      background: C.page
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: ".1em",
      textTransform: "uppercase",
      color: C.sea700,
      marginBottom: 4
    }
  }, sub), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 800,
      fontSize: 30,
      letterSpacing: "-.02em",
      color: C.ink,
      lineHeight: 1.05
    }
  }, title)), right));
}
function DealTile({
  d,
  onClick,
  compact
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: "block",
      width: "100%",
      textAlign: "left",
      border: "none",
      padding: 0,
      background: C.surface,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "var(--shadow-sm)",
      marginBottom: 13,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: compact ? 96 : 132,
      position: "relative",
      background: d.grad
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(28,24,19,.55), transparent 60%)"
    }
  }), d.hot && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 11,
      right: 11,
      background: C.coral,
      color: "#fff",
      fontSize: 11,
      fontWeight: 700,
      padding: "4px 9px",
      borderRadius: 999,
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "flame",
    size: 12
  }), " Going fast"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 14,
      bottom: 11,
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 10,
      letterSpacing: ".1em",
      textTransform: "uppercase",
      textShadow: "0 1px 4px rgba(0,0,0,.4)"
    }
  }, d.template), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 700,
      fontSize: 22,
      lineHeight: 1,
      marginTop: 3,
      textShadow: "0 1px 8px rgba(0,0,0,.45)"
    }
  }, d.place, ", ", d.country))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "13px 15px 15px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      textTransform: "uppercase",
      color: C.fg2
    }
  }, d.from, " \u2192 ", d.to, " \xB7 ", d.dates, " \xB7 ", d.legs), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 11
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(ScoreDot, {
    s: d.score,
    size: 40
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 800,
      fontSize: 24,
      letterSpacing: "-.03em",
      color: C.ink
    }
  }, "\u20AC", d.price, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-body)",
      fontWeight: 500,
      fontSize: 13,
      color: C.fg3,
      textDecoration: "line-through",
      marginLeft: 5
    }
  }, "\u20AC", d.usual)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 10,
      color: C.sea700,
      fontWeight: 700
    }
  }, "\u2212", d.drop, "% vs usual"))), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      background: C.amber,
      color: "var(--fg-on-amber)",
      fontWeight: 600,
      fontSize: 13,
      padding: "9px 14px",
      borderRadius: 12
    }
  }, "Review ", /*#__PURE__*/React.createElement(MIcon, {
    name: "arrow-right",
    size: 15
  })))));
}

/* ---------------- Screens ---------------- */
function ScrollArea({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      background: C.page,
      paddingBottom: TAB_H + 8
    }
  }, children);
}
function TodayScreen({
  onOpen
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppHeader, {
    sub: "Tuesday, 2 June",
    title: "Good afternoon",
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "linear-gradient(135deg,var(--sea-400),var(--sea-600))",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 14
      }
    }, "TK")
  }), /*#__PURE__*/React.createElement(ScrollArea, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "var(--sea-50)",
      border: "1px solid var(--sea-100)",
      color: C.sea700,
      padding: "11px 14px",
      borderRadius: 14,
      fontSize: 13,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: C.sea,
      boxShadow: "0 0 0 3px rgba(15,124,104,.2)",
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("span", null, "Scanned ", /*#__PURE__*/React.createElement("b", null, "4 min ago"), " \xB7 ", /*#__PURE__*/React.createElement("b", null, "2,143"), " fares \xB7 ", /*#__PURE__*/React.createElement("b", null, "3"), " new")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 10,
      marginBottom: 22
    }
  }, [["3", "New top", "var(--amber-50)", "var(--amber-700)"], ["2", "Expiring", "var(--coral-50)", "var(--coral-600)"], ["14", "Live", "var(--bg-surface)", "var(--fg-1)"]].map(([n, l, bg, fg], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: bg,
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: "13px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 800,
      fontSize: 26,
      color: fg,
      lineHeight: 1
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.fg2,
      marginTop: 4
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 700,
      fontSize: 20,
      color: C.ink
    }
  }, "New top deals"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.sea700
    }
  }, "Review all")), DEALS.map(d => /*#__PURE__*/React.createElement(DealTile, {
    key: d.id,
    d: d,
    onClick: () => onOpen(d)
  })))));
}
function QueueScreen({
  onOpen
}) {
  const groups = [["sun", "Last warm days", DEALS.filter(d => d.template === "Last warm days")], ["snowflake", "Christmas markets", DEALS.filter(d => d.template === "Christmas markets")], ["zap", "Last-minute weekends", DEALS.filter(d => d.template === "Last-minute weekends")]];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppHeader, {
    sub: "7 candidates",
    title: "Deal queue"
  }), /*#__PURE__*/React.createElement(ScrollArea, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      marginBottom: 18,
      overflowX: "auto"
    }
  }, ["All", "Suggested", "Maybe", "Rejected"].map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontSize: 13,
      fontWeight: 600,
      padding: "8px 14px",
      borderRadius: 999,
      whiteSpace: "nowrap",
      background: i === 0 ? "var(--sand-900)" : C.surface,
      color: i === 0 ? "var(--sand-50)" : C.fg2,
      border: i === 0 ? "none" : "1.5px solid var(--line)"
    }
  }, t))), groups.map(([ic, name, items]) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 28,
      height: 28,
      borderRadius: 8,
      background: "var(--amber-50)",
      color: C.amber700,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: ic,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 700,
      fontSize: 17
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.fg3,
      fontWeight: 700
    }
  }, items.length)), items.map(d => /*#__PURE__*/React.createElement(DealTile, {
    key: d.id,
    d: d,
    onClick: () => onOpen(d),
    compact: true
  })))))));
}
function PublishedScreen() {
  const tabs = ["Live 14", "Draft 3", "Expired 52"];
  const rows = [["Larnaca, Cyprus", "VNO → LCA", "€59", "+218", "Public"], ["Vienna, Austria", "VNO → VIE", "€45", "+341", "Public"], ["Athens, Greece", "RIX → ATH", "€68", "+154", "Public"], ["Málaga, Spain", "KUN → AGP", "€52", "+402", "Public"]];
  const grads = ["linear-gradient(150deg,#EFA227,#D63E22)", "linear-gradient(150deg,#ED7660,#B53017)", "linear-gradient(150deg,#F3B84E,#C56A07)", "linear-gradient(150deg,#EFA227,#E55438)"];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppHeader, {
    sub: "Manage",
    title: "Published"
  }), /*#__PURE__*/React.createElement(ScrollArea, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 16,
      borderBottom: "1px solid var(--line)",
      marginBottom: 14
    }
  }, tabs.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontSize: 14,
      fontWeight: 600,
      padding: "8px 0",
      color: i === 0 ? C.ink : C.fg2,
      boxShadow: i === 0 ? "inset 0 -2px 0 var(--amber-500)" : "none"
    }
  }, t))), rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: C.surface,
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: 12,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 11,
      background: grads[i],
      flex: "none"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 700,
      fontSize: 15
    }
  }, r[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      color: C.fg2,
      marginTop: 2
    }
  }, r[1], " \xB7 ", r[2])), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13,
      color: C.sea700
    }
  }, r[3]), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "#fff",
      background: C.sea,
      padding: "2px 8px",
      borderRadius: 999
    }
  }, r[4])))))));
}
function ProfileScreen() {
  const items = [["bell", "Alert preferences"], ["map", "Routes & zones"], ["activity", "Scan health"], ["users", "Audience segments"], ["settings", "Settings"]];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(AppHeader, {
    sub: "Founder \xB7 Vilnius",
    title: "Tomas K.",
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "linear-gradient(135deg,var(--sea-400),var(--sea-600))",
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 15
      }
    }, "TK")
  }), /*#__PURE__*/React.createElement(ScrollArea, null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: "1px solid var(--line)",
      borderRadius: 18,
      overflow: "hidden"
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 13,
      padding: "15px 16px",
      borderTop: i ? "1px solid var(--line-soft)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.fg2
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: it[0],
    size: 19
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      fontSize: 16,
      fontWeight: 500
    }
  }, it[1]), /*#__PURE__*/React.createElement(MIcon, {
    name: "chevron-right",
    size: 18,
    color: "var(--fg-3)"
  })))))));
}
function ReviewScreen({
  d,
  onBack,
  onApprove
}) {
  const pct = d.drop;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: C.page
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 230,
      position: "relative",
      background: d.grad
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(28,24,19,.6), transparent 60%)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      position: "absolute",
      top: STATUS_PAD,
      left: 16,
      width: 38,
      height: 38,
      borderRadius: "50%",
      border: "none",
      background: "rgba(255,255,255,.92)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: C.ink
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "arrow-left",
    size: 20
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: STATUS_PAD,
      right: 16
    }
  }, /*#__PURE__*/React.createElement(ScoreDot, {
    s: d.score,
    size: 44
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 20,
      bottom: 16,
      color: "#fff"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      letterSpacing: ".1em",
      textTransform: "uppercase",
      opacity: .92
    }
  }, d.template), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 800,
      fontSize: 30,
      marginTop: 4,
      textShadow: "0 1px 8px rgba(0,0,0,.4)"
    }
  }, d.place, ", ", d.country))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "18px 20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 7,
      marginBottom: 18
    }
  }, [`${d.from} → ${d.to}`, d.dates, d.legs, d.airline].map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      textTransform: "uppercase",
      color: C.fg2,
      background: "var(--bg-sunken)",
      padding: "5px 9px",
      borderRadius: 6
    }
  }, m))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: 16,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 13,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("b", null, "Price vs baseline"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.fg2
    }
  }, "median \u20AC", d.usual)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12,
      borderRadius: 999,
      background: "var(--sand-150)",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 999,
      background: C.sea,
      width: `${100 - pct}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 800,
      fontSize: 28,
      letterSpacing: "-.03em"
    }
  }, "\u20AC", d.price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: C.fmono,
      fontSize: 12,
      color: C.sea700,
      fontWeight: 700,
      alignSelf: "flex-end"
    }
  }, pct, "% below usual"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: C.sea700,
      marginBottom: 11
    }
  }, "Why Yip suggests it"), d.why.map(([ic, t], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      marginBottom: 11,
      fontSize: 15,
      lineHeight: 1.4
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: ic,
    size: 18,
    color: C.sea,
    style: {
      marginTop: 1
    }
  }), t)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: "var(--sand-500)",
      margin: "20px 0 11px"
    }
  }, "Caveats to disclose"), d.caveats.map(([ic, t], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      marginBottom: 11,
      fontSize: 15,
      lineHeight: 1.4
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: ic,
    size: 17,
    color: "var(--amber-600)",
    style: {
      marginTop: 1
    }
  }), t)), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--amber-50)",
      borderRadius: 14,
      padding: "14px 16px",
      marginTop: 18,
      display: "flex",
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "sparkles",
    size: 18,
    color: "var(--amber-600)",
    style: {
      marginTop: 2
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.amber700,
      marginBottom: 3
    }
  }, "SUGGESTED HEADLINE"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      lineHeight: 1.4,
      color: "var(--sand-800)"
    }
  }, d.headline))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: "none",
      borderTop: "1px solid var(--line)",
      background: C.surface,
      padding: "12px 16px",
      paddingBottom: 28,
      display: "flex",
      gap: 10,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    title: "Reject",
    style: {
      width: 54,
      height: 54,
      flex: "none",
      borderRadius: 16,
      border: "none",
      background: "var(--coral-50)",
      color: C.coral,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "x",
    size: 22
  })), /*#__PURE__*/React.createElement("button", {
    title: "Recheck",
    style: {
      width: 54,
      height: 54,
      flex: "none",
      borderRadius: 16,
      border: "none",
      background: "var(--bg-sunken)",
      color: C.fg2,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "rotate-cw",
    size: 21
  })), /*#__PURE__*/React.createElement("button", {
    onClick: onApprove,
    style: {
      flex: 1,
      height: 54,
      borderRadius: 16,
      border: "none",
      background: C.amber,
      color: "var(--fg-on-amber)",
      fontWeight: 700,
      fontSize: 16.5,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxShadow: "var(--shadow-amber)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "check",
    size: 20
  }), " Approve & publish")));
}
function ApproveSheet({
  d,
  onClose,
  onPublish
}) {
  const [vis, setVis] = React.useState(0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 40,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "rgba(28,24,19,.45)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: C.surface,
      borderRadius: "26px 26px 0 0",
      padding: "10px 20px 30px",
      animation: "sheetUp .28s cubic-bezier(.22,1,.36,1)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 5,
      borderRadius: 999,
      background: "var(--sand-300)",
      margin: "0 auto 16px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fdisp,
      fontWeight: 800,
      fontSize: 22,
      letterSpacing: "-.02em",
      marginBottom: 4
    }
  }, "Publish this deal?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.fg2,
      marginBottom: 18
    }
  }, d.place, ", ", d.country, " \xB7 \u20AC", d.price, " return \xB7 matched ", d.template, "."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: C.fmono,
      fontSize: 11,
      letterSpacing: ".08em",
      textTransform: "uppercase",
      color: C.fg3,
      marginBottom: 8
    }
  }, "Visibility"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      background: "var(--bg-sunken)",
      borderRadius: 12,
      padding: 4,
      marginBottom: 20
    }
  }, ["Public", "Newsletter", "Premium"].map((v, i) => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => setVis(i),
    style: {
      flex: 1,
      fontSize: 13,
      fontWeight: 600,
      padding: "9px 0",
      borderRadius: 9,
      border: "none",
      cursor: "pointer",
      background: vis === i ? C.surface : "transparent",
      color: vis === i ? C.ink : C.fg2,
      boxShadow: vis === i ? "var(--shadow-xs)" : "none"
    }
  }, v))), /*#__PURE__*/React.createElement("button", {
    onClick: onPublish,
    style: {
      width: "100%",
      borderRadius: 14,
      border: "none",
      background: C.amber,
      color: "var(--fg-on-amber)",
      fontWeight: 700,
      fontSize: 17,
      padding: "15px 0",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxShadow: "var(--shadow-amber)"
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "send",
    size: 18
  }), " Publish now"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      width: "100%",
      borderRadius: 14,
      border: "none",
      background: "transparent",
      color: C.fg2,
      fontWeight: 600,
      fontSize: 15,
      padding: "12px 0",
      marginTop: 4
    }
  }, "Save as draft instead")));
}
function TabBar({
  tab,
  setTab
}) {
  const tabs = [["today", "home", "Today"], ["queue", "inbox", "Queue", 7], ["published", "send", "Live"], ["profile", "user", "You"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 30,
      paddingBottom: 22,
      paddingTop: 8,
      background: "rgba(251,246,236,.92)",
      backdropFilter: "blur(12px)",
      borderTop: "1px solid var(--line-soft)",
      display: "flex"
    }
  }, tabs.map(([key, icon, label, badge]) => {
    const on = tab === key;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      onClick: () => setTab(key),
      style: {
        flex: 1,
        border: "none",
        background: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        color: on ? C.amber700 : C.fg3,
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement(MIcon, {
      name: icon,
      size: 23,
      sw: on ? 2.4 : 2
    }), badge && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: -5,
        right: -9,
        background: C.coral,
        color: "#fff",
        fontSize: 9,
        fontWeight: 700,
        minWidth: 15,
        height: 15,
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 3px"
      }
    }, badge)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: on ? 700 : 500
      }
    }, label));
  }));
}
function App() {
  const [tab, setTab] = React.useState("today");
  const [review, setReview] = React.useState(null);
  const [sheet, setSheet] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const publish = () => {
    setSheet(false);
    const d = review;
    setReview(null);
    setTab("published");
    setToast(`“${d.place}, ${d.country}” is live`);
    setTimeout(() => setToast(null), 2600);
  };
  return /*#__PURE__*/React.createElement(IOSDevice, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: C.page
    }
  }, review ? /*#__PURE__*/React.createElement(ReviewScreen, {
    d: review,
    onBack: () => setReview(null),
    onApprove: () => setSheet(true)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, tab === "today" && /*#__PURE__*/React.createElement(TodayScreen, {
    onOpen: setReview
  }), tab === "queue" && /*#__PURE__*/React.createElement(QueueScreen, {
    onOpen: setReview
  }), tab === "published" && /*#__PURE__*/React.createElement(PublishedScreen, null), tab === "profile" && /*#__PURE__*/React.createElement(ProfileScreen, null), /*#__PURE__*/React.createElement(TabBar, {
    tab: tab,
    setTab: setTab
  })), sheet && review && /*#__PURE__*/React.createElement(ApproveSheet, {
    d: review,
    onClose: () => setSheet(false),
    onPublish: publish
  }), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: 20,
      right: 20,
      bottom: 104,
      zIndex: 55,
      background: "var(--sand-900)",
      color: "var(--sand-50)",
      padding: "13px 18px",
      borderRadius: 14,
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 14,
      fontWeight: 500,
      boxShadow: "var(--shadow-lg)"
    }
  }, /*#__PURE__*/React.createElement(MIcon, {
    name: "check-circle",
    size: 18,
    color: "var(--sea-300)"
  }), " ", toast)));
}
const style = document.createElement("style");
style.textContent = "@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}";
document.head.appendChild(style);
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "screens/mobile-app.jsx", error: String((e && e.message) || e) }); }

// screens/sidebar.js
try { (() => {
// Shared Deal Desk sidebar. Set <body data-nav="queue"> to mark the active item.
// Injects into the element with id="asb".
(function () {
  const items = [["g", "Workspace"], ["today", "Today", "layout-dashboard", "admin-today.html"], ["queue", "Deal queue", "inbox", "admin-queue.html", "7"], ["published", "Published", "send", "admin-published.html"], ["g", "Strategy"], ["templates", "Templates", "layout-template", "admin-templates.html"], ["builder", "Template builder", "wand-2", "admin-template-builder.html"], ["audience", "Audience", "users", "admin-audience.html"], ["moments", "Travel moments", "calendar-days", "admin-moments.html"], ["routes", "Routes & zones", "map", "admin-routes.html"], ["g", "System"], ["scan", "Scan health", "activity", "admin-scan-health.html"]];
  const active = document.body.dataset.nav || "";
  let html = '<div class="brand"><span class="yip-logo" style="font-size:24px">yıp</span><span class="tag">Deal Desk</span></div>';
  for (const it of items) {
    if (it[0] === "g") {
      html += `<div class="grp">${it[1]}</div>`;
      continue;
    }
    const [key, label, icon, href, badge] = it;
    html += `<a class="navi${key === active ? " on" : ""}" href="${href}"><i data-lucide="${icon}"></i> ${label}${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  }
  html += '<div class="who"><span class="av">TK</span><div><div class="nm">Tomas K.</div><div class="ro">Founder · Vilnius</div></div></div>';
  const el = document.getElementById("asb");
  if (el) el.innerHTML = html;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "screens/sidebar.js", error: String((e && e.message) || e) }); }

// ui_kits/curator/Composer.jsx
try { (() => {
function Composer({
  c,
  onClose,
  onPublish
}) {
  const [tab, setTab] = React.useState("headline");
  const [pick, setPick] = React.useState(0);
  const [hook, setHook] = React.useState(c.copy.hook);
  const [news, setNews] = React.useState(c.copy.news);
  const cls = c.score >= 80 ? "hi" : c.score >= 60 ? "mid" : "lo";
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "scrim",
    onClick: onClose
  }), /*#__PURE__*/React.createElement("div", {
    className: "drawer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dh",
    style: {
      background: c.grad
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ov"
  }), /*#__PURE__*/React.createElement("div", {
    className: "score " + cls
  }, c.score, /*#__PURE__*/React.createElement("small", null, "SCORE")), /*#__PURE__*/React.createElement("button", {
    className: "x",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "cap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "e"
  }, c.template), /*#__PURE__*/React.createElement("div", {
    className: "nm"
  }, c.place, ", ", c.country))), /*#__PURE__*/React.createElement("div", {
    className: "dscroll"
  }, /*#__PURE__*/React.createElement("div", {
    className: "drow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pp"
  }, c.from, " \u2192 ", c.to), /*#__PURE__*/React.createElement("span", {
    className: "pp"
  }, c.dates), /*#__PURE__*/React.createElement("span", {
    className: "pp"
  }, c.legs), /*#__PURE__*/React.createElement("span", {
    className: "pp"
  }, c.airline), /*#__PURE__*/React.createElement("span", {
    className: "pp",
    style: {
      color: "var(--sea-700)"
    }
  }, "\u20AC", c.price, " \xB7 \u2212", c.drop, "%")), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Why the scanner flagged it"), c.signals.map((s, i) => /*#__PURE__*/React.createElement("div", {
    className: "sig",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  })), s))), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Caveats to disclose"), c.flags.map((f, i) => /*#__PURE__*/React.createElement("div", {
    className: "flag",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "alert-triangle",
    size: 15
  })), f))), /*#__PURE__*/React.createElement("div", {
    className: "sec"
  }, /*#__PURE__*/React.createElement("h4", null, "Draft copy \xB7 AI-assisted, you approve"), /*#__PURE__*/React.createElement("div", {
    className: "drafter"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dtabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dtab" + (tab === "headline" ? " on" : ""),
    onClick: () => setTab("headline")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "type",
    size: 15
  }), " Headline"), /*#__PURE__*/React.createElement("button", {
    className: "dtab" + (tab === "hook" ? " on" : ""),
    onClick: () => setTab("hook")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "music",
    size: 15
  }), " TikTok hook"), /*#__PURE__*/React.createElement("button", {
    className: "dtab" + (tab === "news" ? " on" : ""),
    onClick: () => setTab("news")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "mail",
    size: 15
  }), " Newsletter")), /*#__PURE__*/React.createElement("div", {
    className: "dcontent"
  }, tab === "headline" && /*#__PURE__*/React.createElement("div", null, c.copy.headline.map((h, i) => /*#__PURE__*/React.createElement("div", {
    className: "opt" + (pick === i ? " sel" : ""),
    key: i,
    onClick: () => setPick(i)
  }, /*#__PURE__*/React.createElement("span", {
    className: "radio"
  }), /*#__PURE__*/React.createElement("span", {
    className: "txt"
  }, h))), /*#__PURE__*/React.createElement("button", {
    className: "regen"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 14
  }), " Suggest more options")), tab === "hook" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("textarea", {
    className: "draftbox",
    value: hook,
    onChange: e => setHook(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "regen"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 14
  }), " Regenerate hook"), /*#__PURE__*/React.createElement("span", {
    className: "charcount"
  }, hook.length, " chars")), tab === "news" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("textarea", {
    className: "draftbox",
    style: {
      minHeight: 132
    },
    value: news,
    onChange: e => setNews(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    className: "regen"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sparkles",
    size: 14
  }), " Regenerate snippet"), /*#__PURE__*/React.createElement("span", {
    className: "charcount"
  }, news.length, " chars")))))), /*#__PURE__*/React.createElement("div", {
    className: "pubbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-ghost",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 16
  }), " Reject"), /*#__PURE__*/React.createElement("span", {
    className: "flex1"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-outline"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 16
  }), " Schedule"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => onPublish(c)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 16
  }), " Approve & publish"))));
}
Object.assign(window, {
  Composer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/curator/Composer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/curator/CuratorApp.jsx
try { (() => {
function CuratorApp() {
  const [tab, setTab] = React.useState("All");
  const [selected, setSelected] = React.useState(null);
  const [items, setItems] = React.useState(window.YIP_CANDIDATES);
  const [toast, setToast] = React.useState(null);
  const tabMap = {
    "Suggested": "suggested",
    "In review": "review",
    "Rejected": "rejected"
  };
  const filtered = tab === "All" ? items : items.filter(c => c.status === tabMap[tab]);
  const publish = c => {
    setItems(prev => prev.map(x => x.id === c.id ? {
      ...x,
      status: "published"
    } : x));
    setSelected(null);
    setToast(`“${c.place}, ${c.country}” is live — published to the site & newsletter.`);
    setTimeout(() => setToast(null), 3200);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "app"
  }, /*#__PURE__*/React.createElement(Sidebar, null), /*#__PURE__*/React.createElement("div", {
    className: "main"
  }, /*#__PURE__*/React.createElement(Topbar, {
    tab: tab,
    setTab: setTab
  }), /*#__PURE__*/React.createElement(Queue, {
    candidates: filtered,
    onOpen: setSelected
  })), selected && /*#__PURE__*/React.createElement(Composer, {
    c: selected,
    onClose: () => setSelected(null),
    onPublish: publish
  }), toast && /*#__PURE__*/React.createElement("div", {
    className: "toast"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check-circle",
    size: 18
  })), toast));
}
const __curRoot = document.getElementById("root");
if (__curRoot && __curRoot.dataset.app === "curator") {
  ReactDOM.createRoot(__curRoot).render(/*#__PURE__*/React.createElement(CuratorApp, null));
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/curator/CuratorApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/curator/Queue.jsx
try { (() => {
function ScoreBadge({
  score
}) {
  const cls = score >= 80 ? "hi" : score >= 60 ? "mid" : "lo";
  return /*#__PURE__*/React.createElement("div", {
    className: "score " + cls
  }, score, /*#__PURE__*/React.createElement("small", null, "SCORE"));
}
function QueueRow({
  c,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "qrow",
    onClick: () => onOpen(c)
  }, /*#__PURE__*/React.createElement(ScoreBadge, {
    score: c.score
  }), /*#__PURE__*/React.createElement("div", {
    className: "qdeal"
  }, /*#__PURE__*/React.createElement("span", {
    className: "qthumb",
    style: {
      background: c.grad
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "nm"
  }, c.place, ", ", c.country), /*#__PURE__*/React.createElement("div", {
    className: "mt"
  }, c.from, " \u2192 ", c.to, " \xB7 ", c.dates, " \xB7 ", c.legs))), /*#__PURE__*/React.createElement("div", {
    className: "qtmpl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip"
  }, c.template)), /*#__PURE__*/React.createElement("div", {
    className: "qdrop"
  }, "\u2212", c.drop, "%"), /*#__PURE__*/React.createElement("div", {
    className: "qprice"
  }, "\u20AC", c.price, /*#__PURE__*/React.createElement("s", null, "was \u20AC", c.usual)), /*#__PURE__*/React.createElement("div", {
    className: "stat " + c.status
  }, c.status[0].toUpperCase() + c.status.slice(1)));
}
function Topbar({
  tab,
  setTab
}) {
  const s = window.YIP_SCAN;
  return /*#__PURE__*/React.createElement("div", {
    className: "topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "scan"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot"
  }), /*#__PURE__*/React.createElement("span", null, "Scanner ran ", /*#__PURE__*/React.createElement("b", null, s.ago), " \xB7 checked ", /*#__PURE__*/React.createElement("b", null, s.fares), " fares across ", /*#__PURE__*/React.createElement("b", null, s.airports), " airports \xB7 ", /*#__PURE__*/React.createElement("b", null, s.newToday), " new candidates today"), /*#__PURE__*/React.createElement("button", {
    className: "rescan"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "refresh-cw",
    size: 14
  }), " Re-scan now")), /*#__PURE__*/React.createElement("div", {
    className: "pagehead"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", null, "Deal queue"), /*#__PURE__*/React.createElement("div", {
    className: "sub"
  }, "Candidates the scanner surfaced \u2014 review, draft, and approve before they go public.")), /*#__PURE__*/React.createElement("div", {
    className: "tabs"
  }, ["All", "Suggested", "In review", "Rejected"].map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: "tab" + (tab === t ? " on" : ""),
    onClick: () => setTab(t)
  }, t)))));
}
function Queue({
  candidates,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "queue"
  }, /*#__PURE__*/React.createElement("div", {
    className: "qhead"
  }, /*#__PURE__*/React.createElement("span", null, "Score"), /*#__PURE__*/React.createElement("span", null, "Deal"), /*#__PURE__*/React.createElement("span", null, "Template"), /*#__PURE__*/React.createElement("span", null, "Drop"), /*#__PURE__*/React.createElement("span", null, "Price"), /*#__PURE__*/React.createElement("span", null, "Status")), candidates.map(c => /*#__PURE__*/React.createElement(QueueRow, {
    key: c.id,
    c: c,
    onOpen: onOpen
  })));
}
Object.assign(window, {
  ScoreBadge,
  QueueRow,
  Topbar,
  Queue
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/curator/Queue.jsx", error: String((e && e.message) || e) }); }

// ui_kits/curator/Sidebar.jsx
try { (() => {
function Sidebar() {
  const [active, setActive] = React.useState("Queue");
  const items = [["Queue", "inbox", 3], ["Published", "send", null], ["Templates", "layout-template", null], ["Audience", "users", null], ["Insights", "bar-chart-3", null], ["Settings", "settings", null]];
  return /*#__PURE__*/React.createElement("aside", {
    className: "side"
  }, /*#__PURE__*/React.createElement("div", {
    className: "brand"
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 26
  }), /*#__PURE__*/React.createElement("span", {
    className: "tag"
  }, "Curator")), /*#__PURE__*/React.createElement("nav", null, items.map(([label, icon, badge]) => /*#__PURE__*/React.createElement("button", {
    key: label,
    className: "navi" + (active === label ? " on" : ""),
    onClick: () => setActive(label)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 18
  }), label, badge && /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, badge)))), /*#__PURE__*/React.createElement("div", {
    className: "who"
  }, /*#__PURE__*/React.createElement("span", {
    className: "av"
  }, "R\u0160"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "nm"
  }, "Rasa \u0160imkut\u0117"), /*#__PURE__*/React.createElement("div", {
    className: "ro"
  }, "Curator \xB7 Vilnius"))));
}
Object.assign(window, {
  Sidebar
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/curator/Sidebar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/curator/data.js
try { (() => {
// Yip curator tool — candidate deals surfaced by the scanner (fake data)
window.YIP_CANDIDATES = [{
  id: "c1",
  score: 92,
  status: "suggested",
  place: "Larnaca",
  country: "Cyprus",
  from: "VNO",
  to: "LCA",
  origin: "Vilnius",
  price: 59,
  usual: 102,
  drop: 42,
  dates: "14–21 Oct",
  legs: "Direct · 4h",
  airline: "Wizz Air",
  template: "Last warm week · sun",
  signals: ["42% below 90-day median", "Direct route", "Shoulder season (27°C)", "Seat availability: healthy"],
  flags: ["Hand luggage only", "Return lands 23:40"],
  grad: "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
  copy: {
    headline: ["€59 return to Cyprus — last warm week of the year", "Sun's still out in Cyprus, and the crowds have gone — €59", "Sneak a Cyprus week in before winter: €59 return from Vilnius"],
    hook: "POV: it's 6°C in Vilnius but you just found €59 returns to 27°C Cyprus 🌴 link in bio before it's gone",
    news: "We dug up a €59 return to Larnaca for the last warm week of October — direct from Vilnius, 42% under the usual fare. Hand luggage only and the return lands late, but the sea's still warm and the beaches are empty."
  }
}, {
  id: "c2",
  score: 88,
  status: "suggested",
  place: "Vienna",
  country: "Austria",
  from: "VNO",
  to: "VIE",
  origin: "Vilnius",
  price: 45,
  usual: 88,
  drop: 49,
  dates: "5–8 Dec",
  legs: "Direct · 1h45",
  airline: "Ryanair",
  template: "Christmas markets · weekend",
  signals: ["49% below median", "Peak market season", "Direct, short hop", "Fare dropped 3× this week"],
  flags: ["Hand luggage only", "Bus to airport"],
  grad: "linear-gradient(150deg,#ED7660,#B53017 70%,#4A4034)",
  copy: {
    headline: ["Vienna Christmas-market weekend for €45", "Glühwein o'clock: €45 return to Vienna in December", "€45 to Vienna for the Christmas markets — direct from Vilnius"],
    hook: "€45 return to Vienna for the Christmas markets?? christmas-girlie behaviour, sending this to my group chat rn 🎄",
    news: "A €45 return to Vienna lands you right in peak Christmas-market season — direct from Vilnius, 49% under usual. Hand luggage only and you'll bus in from the airport, but glühwein season makes up for it."
  }
}, {
  id: "c3",
  score: 76,
  status: "suggested",
  place: "Málaga",
  country: "Spain",
  from: "KUN",
  to: "AGP",
  origin: "Kaunas",
  price: 52,
  usual: 110,
  drop: 53,
  dates: "This Fri–Mon",
  legs: "Direct · 4h30",
  airline: "Ryanair",
  template: "Last-minute · long weekend",
  signals: ["53% below median", "Direct from Kaunas", "Last-minute window", "Limited seats left"],
  flags: ["Return lands 00:35", "Hand luggage only"],
  grad: "linear-gradient(150deg,#EFA227,#E55438 70%,#7A410E)",
  copy: {
    headline: ["Costa del Sol escape — leaving this Friday, €52", "Last-minute Málaga: €52 return from Kaunas this weekend", "Drop everything: €52 to Málaga, wheels up Friday"],
    hook: "leaving for málaga this friday for €52 and telling my boss monday 😎☀️",
    news: "Pure last-minute sun: €52 return to Málaga from Kaunas, leaving this Friday. 53% under usual. The return lands at 00:35 and it's hand luggage only — but it's 25°C and the beaches are still open."
  }
}, {
  id: "c4",
  score: 64,
  status: "review",
  place: "Athens",
  country: "Greece",
  from: "RIX",
  to: "ATH",
  origin: "Riga",
  price: 68,
  usual: 119,
  drop: 43,
  dates: "9–16 Oct",
  legs: "Direct · 3h",
  airline: "airBaltic",
  template: "Sun + culture · plan ahead",
  signals: ["43% below median", "Direct with airBaltic", "Mild 24°C"],
  flags: ["Outbound departs 06:05"],
  grad: "linear-gradient(150deg,#F3B84E,#C56A07 70%,#5C320F)",
  copy: {
    headline: ["Athens in October — €68 return from Riga", "Acropolis weather, autumn prices: €68 to Athens", "€68 return to Athens, direct from Riga"],
    hook: "€68 to athens in october, sun + ruins + no crowds, the dream 🏛️",
    news: "A €68 return to Athens from Riga, direct with airBaltic — 43% under usual. Early 06:05 outbound, but you get mild 24°C and the ruins without the summer crowds."
  }
}, {
  id: "c5",
  score: 41,
  status: "rejected",
  place: "Faro",
  country: "Portugal",
  from: "RIX",
  to: "FAO",
  origin: "Riga",
  price: 119,
  usual: 198,
  drop: 40,
  dates: "7–14 Jun",
  legs: "1 stop · 7h",
  airline: "Lufthansa",
  template: "Summer holiday · plan ahead",
  signals: ["40% below summer median", "Reliable 26°C"],
  flags: ["1 stop in Frankfurt", "Long total travel time"],
  grad: "linear-gradient(150deg,#8FD2C2,#239A83 70%,#094E43)",
  copy: {
    headline: ["Algarve in June — €119 return, book now", "Lock in summer: €119 to Faro from Riga"],
    hook: "booking my june algarve trip for €119 in march like a responsible adult 🧴",
    news: "Summer fares only climb: €119 return to Faro for peak June, 40% under usual. One stop in Frankfurt and a longer travel day, but a strong early lock-in for the Algarve."
  }
}];
window.YIP_SCAN = {
  fares: "2,143",
  airports: 4,
  ago: "4 min ago",
  newToday: 3
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/curator/data.js", error: String((e && e.message) || e) }); }

// ui_kits/website/App.jsx
try { (() => {
function App() {
  const [airport, setAirport] = React.useState("All airports");
  const [moment, setMoment] = React.useState("All");
  const [selected, setSelected] = React.useState(null);
  const momentMap = {
    "Sun": ["September sun", "Sun + culture"],
    "City break": ["City break"],
    "Christmas": ["Winter weekend"],
    "Last-minute": ["Long weekend"]
  };
  const deals = window.YIP_DEALS.filter(d => {
    const okAir = airport === "All airports" || d.origin === airport;
    const okMom = moment === "All" || (momentMap[moment] || []).includes(d.moment);
    return okAir && okMom;
  });
  const scrollTop = () => window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "site"
  }, /*#__PURE__*/React.createElement(Header, {
    onLogo: scrollTop,
    onSubscribe: scrollTop
  }), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(FilterBar, {
    airport: airport,
    setAirport: setAirport,
    moment: moment,
    setMoment: setMoment
  }), /*#__PURE__*/React.createElement(DealGrid, {
    deals: deals,
    onOpen: setSelected
  }), /*#__PURE__*/React.createElement(SignupBand, null), /*#__PURE__*/React.createElement(Footer, null), selected && /*#__PURE__*/React.createElement(DealDetail, {
    deal: selected,
    onClose: () => setSelected(null)
  }));
}
const __webRoot = document.getElementById("root");
if (__webRoot && __webRoot.dataset.app === "website") {
  ReactDOM.createRoot(__webRoot).render(/*#__PURE__*/React.createElement(App, null));
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/DealCard.jsx
try { (() => {
function DealCard({
  deal,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("article", {
    className: "deal",
    onClick: () => onOpen(deal)
  }, /*#__PURE__*/React.createElement("div", {
    className: "ph"
  }, /*#__PURE__*/React.createElement("div", {
    className: "img",
    style: {
      background: deal.grad
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "ov"
  }), /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, deal.eyebrow), /*#__PURE__*/React.createElement("div", {
    className: "place"
  }, deal.place, /*#__PURE__*/React.createElement("small", null, deal.country, " \xB7 from ", deal.origin)), deal.hot && /*#__PURE__*/React.createElement("span", {
    className: "hot-tag"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "flame",
    size: 12
  }), " Going fast")), /*#__PURE__*/React.createElement("div", {
    className: "body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "meta"
  }, deal.from, " \u2192 ", deal.to, " \xB7 ", deal.dates, " \xB7 ", deal.legs), /*#__PURE__*/React.createElement("h3", null, deal.headline), /*#__PURE__*/React.createElement("div", {
    className: "chips"
  }, /*#__PURE__*/React.createElement("span", {
    className: "chip chip-good"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "trending-down",
    size: 13
  }), " ", Math.round((1 - deal.price / deal.usual) * 100), "% under"), /*#__PURE__*/React.createElement("span", {
    className: "chip chip-good"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: deal.why[1] ? deal.why[1][0] : "plane",
    size: 13
  }), " ", deal.why[1] ? deal.why[1][1].split(" ").slice(0, 2).join(" ") : "Direct")), /*#__PURE__*/React.createElement("div", {
    className: "ticket-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "price"
  }, "\u20AC", deal.price, /*#__PURE__*/React.createElement("s", null, "\u20AC", deal.usual), /*#__PURE__*/React.createElement("span", {
    className: "ret"
  }, "return \xB7 ", deal.airline)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-sm",
    onClick: e => {
      e.stopPropagation();
      onOpen(deal);
    }
  }, "See deal ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 15
  })))));
}
function DealGrid({
  deals,
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, deals.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "60px 0 80px",
      textAlign: "center",
      color: "var(--fg-2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: 24,
      color: "var(--fg-1)",
      marginBottom: 8
    }
  }, "Nothing live for that combo right now."), "We're always hunting \u2014 get the next one by email.") : /*#__PURE__*/React.createElement("div", {
    className: "grid"
  }, deals.map(d => /*#__PURE__*/React.createElement(DealCard, {
    key: d.id,
    deal: d,
    onOpen: onOpen
  }))));
}
Object.assign(window, {
  DealCard,
  DealGrid
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/DealCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/DealDetail.jsx
try { (() => {
function DealDetail({
  deal,
  onClose
}) {
  const pct = Math.round((1 - deal.price / deal.usual) * 100);
  React.useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "detail-scrim",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-img",
    style: {
      background: deal.grad
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "ov"
  }), /*#__PURE__*/React.createElement("button", {
    className: "close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "x",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    className: "cap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, deal.eyebrow, " \xB7 ", deal.moment), /*#__PURE__*/React.createElement("h2", null, deal.place, ", ", deal.country))), /*#__PURE__*/React.createElement("div", {
    className: "dbody"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dmeta"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "plane",
    size: 15,
    style: {
      marginRight: 6,
      verticalAlign: "-3px"
    }
  }), deal.from, " \u2192 ", deal.to), /*#__PURE__*/React.createElement("span", null, deal.dates), /*#__PURE__*/React.createElement("span", null, deal.legs), /*#__PURE__*/React.createElement("span", null, deal.airline)), /*#__PURE__*/React.createElement("h3", {
    className: "dh"
  }, deal.headline), /*#__PURE__*/React.createElement("div", {
    className: "dcols"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h5", {
    className: "good"
  }, "Why it's good"), /*#__PURE__*/React.createElement("div", {
    className: "dlist"
  }, deal.why.map(([ic, t], i) => /*#__PURE__*/React.createElement("div", {
    className: "li good",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18
  })), t)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h5", {
    className: "cav"
  }, "The catch"), /*#__PURE__*/React.createElement("div", {
    className: "dlist"
  }, deal.caveats.map(([ic, t], i) => /*#__PURE__*/React.createElement("div", {
    className: "li cav",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 18
  })), t))))), /*#__PURE__*/React.createElement("div", {
    className: "curator-note"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ic"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "quote",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    className: "txt"
  }, /*#__PURE__*/React.createElement("b", null, "From the curator \u2014"), " ", deal.note)), /*#__PURE__*/React.createElement("div", {
    className: "dbook"
  }, /*#__PURE__*/React.createElement("div", {
    className: "price"
  }, "\u20AC", deal.price, /*#__PURE__*/React.createElement("s", null, "\u20AC", deal.usual), /*#__PURE__*/React.createElement("span", {
    className: "ret"
  }, "return \xB7 ", pct, "% under usual")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary",
    onClick: e => e.preventDefault()
  }, "Book on ", deal.airline, " ", /*#__PURE__*/React.createElement(Icon, {
    name: "external-link",
    size: 16
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12.5,
      color: "var(--fg-3)",
      marginTop: 14,
      textAlign: "center"
    }
  }, "Yip links you out to book directly with the airline. Prices change fast \u2014 confirm before paying."))));
}
Object.assign(window, {
  DealDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/DealDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Header.jsx
try { (() => {
function Header({
  onLogo,
  onSubscribe
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "hdr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap hdr-in"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onLogo();
    },
    style: {
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 30
  })), /*#__PURE__*/React.createElement("nav", null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "active"
  }, "Deals"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "How it works"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "About")), /*#__PURE__*/React.createElement("span", {
    className: "spacer"
  }), /*#__PURE__*/React.createElement("span", {
    className: "from-pill"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 14
  }), " Vilnius \xB7 Kaunas \xB7 Riga"), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-primary btn-sm",
    onClick: onSubscribe
  }, "Get deals by email")));
}
Object.assign(window, {
  Header
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Icon.jsx
try { (() => {
// Shared Icon component (Lucide). Renders SVG imperatively so React reconciliation
// never fights lucide's node replacement. Export to window for cross-file use.
function Icon({
  name,
  size = 18,
  color,
  strokeWidth = 2,
  style
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = `<i data-lucide="${name}"></i>`;
    window.lucide.createIcons();
    const svg = el.querySelector("svg");
    if (svg) {
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);
      svg.setAttribute("stroke-width", strokeWidth);
    }
  }, [name, size, strokeWidth]);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      color,
      flex: "none",
      ...style
    }
  });
}

// Yip wordmark lockup (dotless ı + amber bead tittle)
function Wordmark({
  size = 30,
  light = false
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "yip-logo",
    style: {
      fontSize: size,
      "--logo-ink": light ? "#FBF6EC" : "#1C1813"
    }
  }, "y\u0131p");
}
Object.assign(window, {
  Icon,
  Wordmark
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Icon.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Sections.jsx
try { (() => {
// Reusable email signup form. Shows an inline confirmation on submit.
function SignupForm({
  cta = "Get deals",
  placeholder = "you@email.com"
}) {
  const [email, setEmail] = React.useState("");
  const [done, setDone] = React.useState(false);
  if (done) {
    return /*#__PURE__*/React.createElement("div", {
      className: "confirm"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "check-circle",
      size: 20,
      color: "var(--sea-600)"
    }), "You're in \u2014 first deals land in your inbox this week.");
  }
  return /*#__PURE__*/React.createElement("form", {
    className: "signup",
    onSubmit: e => {
      e.preventDefault();
      if (email.includes("@")) setDone(true);
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    value: email,
    placeholder: placeholder,
    onChange: e => setEmail(e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "btn btn-primary"
  }, cta));
}
function Hero() {
  return /*#__PURE__*/React.createElement("section", {
    className: "hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, "Curated flight deals \xB7 Lithuania & the Baltics"), /*#__PURE__*/React.createElement("h1", null, "We find the ", /*#__PURE__*/React.createElement("span", {
    className: "amber"
  }, "cheap flights"), ", so you don't have to."), /*#__PURE__*/React.createElement("p", {
    className: "lead"
  }, "A few genuinely good deals a week from Vilnius, Kaunas & Riga \u2014 checked by a real person, with the catch shown up front."), /*#__PURE__*/React.createElement(SignupForm, {
    cta: "Get deals by email"
  }), /*#__PURE__*/React.createElement("div", {
    className: "trust"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "users",
    size: 15,
    color: "var(--sea-500)"
  }), " 12,400+ Baltic travelers"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "hand",
    size: 15,
    color: "var(--sea-500)"
  }), " Human-checked deals"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Icon, {
    name: "ban",
    size: 15,
    color: "var(--sea-500)"
  }), " No spam, ever"))));
}
function FilterBar({
  airport,
  setAirport,
  moment,
  setMoment
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "filters"
  }, /*#__PURE__*/React.createElement("div", {
    className: "fgroup"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "From"), window.YIP_AIRPORTS.map(a => /*#__PURE__*/React.createElement("button", {
    key: a,
    className: "fchip" + (airport === a ? " on" : ""),
    onClick: () => setAirport(a)
  }, a))), /*#__PURE__*/React.createElement("div", {
    className: "fgroup"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "Mood"), window.YIP_MOMENTS.map(m => /*#__PURE__*/React.createElement("button", {
    key: m,
    className: "fchip" + (moment === m ? " on" : ""),
    onClick: () => setMoment(m)
  }, m)))));
}
function SignupBand() {
  return /*#__PURE__*/React.createElement("div", {
    className: "wrap"
  }, /*#__PURE__*/React.createElement("section", {
    className: "band"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bead"
  }), /*#__PURE__*/React.createElement("div", {
    className: "bcol",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h2", null, "Get the next great deal before it sells out."), /*#__PURE__*/React.createElement("p", null, "We send a short email when we find something worth your weekend. That's it.")), /*#__PURE__*/React.createElement("div", {
    className: "bcol"
  }, /*#__PURE__*/React.createElement(SignupForm, {
    cta: "Subscribe"
  }))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "ftr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "wrap ftr-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "col lead-col"
  }, /*#__PURE__*/React.createElement(Wordmark, {
    size: 30,
    light: true
  }), /*#__PURE__*/React.createElement("p", null, "Curated flight deals from Lithuania and nearby Baltic airports. We find the gems so you don't have to.")), /*#__PURE__*/React.createElement("div", {
    className: "col"
  }, /*#__PURE__*/React.createElement("h4", null, "Deals"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "From Vilnius"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "From Kaunas"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "From Riga"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Christmas markets")), /*#__PURE__*/React.createElement("div", {
    className: "col"
  }, /*#__PURE__*/React.createElement("h4", null, "Yip"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "How it works"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "About us"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Newsletter"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Contact")), /*#__PURE__*/React.createElement("div", {
    className: "col"
  }, /*#__PURE__*/React.createElement("h4", null, "Follow"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "TikTok"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Instagram"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Telegram"))), /*#__PURE__*/React.createElement("div", {
    className: "wrap legal"
  }, /*#__PURE__*/React.createElement("span", null, "\xA9 2026 Yip. We link to airlines & OTAs to book \u2014 prices change fast."), /*#__PURE__*/React.createElement("span", null, "Made in Vilnius \uD83C\uDDF1\uD83C\uDDF9")));
}
Object.assign(window, {
  SignupForm,
  Hero,
  FilterBar,
  SignupBand,
  Footer
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Sections.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/data.js
try { (() => {
// Yip — sample curated deals (fake data for the UI kit demo)
window.YIP_DEALS = [{
  id: "vno-lca",
  place: "Larnaca",
  country: "Cyprus",
  from: "VNO",
  to: "LCA",
  grad: "linear-gradient(150deg,#EFA227,#D63E22 70%,#9C520A)",
  eyebrow: "Last warm week",
  moment: "September sun",
  headline: "Sun's still out in Cyprus — and the crowds have gone",
  dates: "14–21 Oct",
  legs: "Direct · 4h",
  airline: "Wizz Air",
  price: 59,
  usual: 102,
  hot: true,
  origin: "Vilnius",
  why: [["trending-down", "42% under the usual fare for these dates"], ["plane", "Direct flight — no layovers"], ["sun", "Still 27°C, sea's warm, beaches quiet"]],
  caveats: [["luggage", "Hand luggage only (add a bag for ~€25)"], ["clock", "Return lands at 23:40"]],
  note: "A genuinely good shoulder-season week. We'd book the outbound Saturday — the Tuesday return is the cheapest leg."
}, {
  id: "kun-mla",
  place: "Valletta",
  country: "Malta",
  from: "KUN",
  to: "MLA",
  grad: "linear-gradient(150deg,#54B7A2,#0F7C68 70%,#093D36)",
  eyebrow: "September sun",
  moment: "City break",
  headline: "Malta long weekend — honey-stone streets, warm sea",
  dates: "19–22 Sep",
  legs: "1 stop · 6h",
  airline: "Ryanair",
  price: 74,
  usual: 138,
  hot: false,
  origin: "Kaunas",
  why: [["trending-down", "46% under usual"], ["sun", "28°C and swimmable into October"], ["map-pin", "20 min from airport to the old town"]],
  caveats: [["repeat", "1 stop in Bergamo, 1h10 layover"], ["luggage", "Hand luggage only"]],
  note: "Great value for a 3-night city break with beach time tacked on."
}, {
  id: "rix-ath",
  place: "Athens",
  country: "Greece",
  from: "RIX",
  to: "ATH",
  grad: "linear-gradient(150deg,#F3B84E,#C56A07 70%,#5C320F)",
  eyebrow: "Plan ahead",
  moment: "Sun + culture",
  headline: "Athens in October — €68 return from Riga",
  dates: "9–16 Oct",
  legs: "Direct · 3h",
  airline: "airBaltic",
  price: 68,
  usual: 119,
  hot: false,
  origin: "Riga",
  why: [["trending-down", "43% under usual"], ["plane", "Direct with airBaltic"], ["sun", "Mild 24°C — perfect for the ruins"]],
  caveats: [["clock", "Outbound departs 06:05"]],
  note: "Pair the Acropolis with a couple of island day-trips while the sea's still warm."
}, {
  id: "vno-vie",
  place: "Vienna",
  country: "Austria",
  from: "VNO",
  to: "VIE",
  grad: "linear-gradient(150deg,#ED7660,#B53017 70%,#4A4034)",
  eyebrow: "Christmas markets",
  moment: "Winter weekend",
  headline: "Vienna Christmas-market weekend for €45",
  dates: "5–8 Dec",
  legs: "Direct · 1h45",
  airline: "Ryanair",
  price: 45,
  usual: 88,
  hot: true,
  origin: "Vilnius",
  why: [["trending-down", "49% under usual"], ["plane", "Direct, short hop"], ["snowflake", "Peak market season, glühwein everywhere"]],
  caveats: [["luggage", "Hand luggage only"], ["bus", "City bus from airport ~25 min"]],
  note: "The best-value market weekend we've seen this year. Hotels still reasonable if you book now."
}, {
  id: "kun-agp",
  place: "Málaga",
  country: "Spain",
  from: "KUN",
  to: "AGP",
  grad: "linear-gradient(150deg,#EFA227,#E55438 70%,#7A410E)",
  eyebrow: "Last-minute",
  moment: "Long weekend",
  headline: "Costa del Sol escape — leaving this Friday",
  dates: "This Fri–Mon",
  legs: "Direct · 4h30",
  airline: "Ryanair",
  price: 52,
  usual: 110,
  hot: true,
  origin: "Kaunas",
  why: [["trending-down", "53% under usual"], ["plane", "Direct from Kaunas"], ["sun", "25°C, last proper beach days"]],
  caveats: [["clock", "Return lands 00:35 Tuesday"], ["luggage", "Hand luggage only"]],
  note: "Pure last-minute sun. Move fast — the Friday outbound is almost gone."
}, {
  id: "rix-fao",
  place: "Faro",
  country: "Portugal",
  from: "RIX",
  to: "FAO",
  grad: "linear-gradient(150deg,#8FD2C2,#239A83 70%,#094E43)",
  eyebrow: "Plan ahead",
  moment: "Summer holiday",
  headline: "Algarve in June — book now, pay holiday-you later",
  dates: "7–14 Jun",
  legs: "1 stop · 7h",
  airline: "Lufthansa",
  price: 119,
  usual: 198,
  hot: false,
  origin: "Riga",
  why: [["trending-down", "40% under usual summer fare"], ["sun", "Reliable 26°C and the Atlantic coast"]],
  caveats: [["repeat", "1 stop in Frankfurt"]],
  note: "Summer fares only go up. This is a strong lock-it-in-early price for peak June."
}];
window.YIP_AIRPORTS = ["All airports", "Vilnius", "Kaunas", "Riga"];
window.YIP_MOMENTS = ["All", "Sun", "City break", "Christmas", "Last-minute"];
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/data.js", error: String((e && e.message) || e) }); }

__ds_ns.DealTicket = __ds_scope.DealTicket;

})();
