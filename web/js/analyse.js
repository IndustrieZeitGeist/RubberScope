/* RubberScope Web – Analyse-Arbeitsplatz */
'use strict';
(() => {
  const RS = window.RS, $ = RS.$, $$ = RS.$$, h = RS.h, num = RS.num;
  const A = RS.ana = { images: [], sel: -1, view: 'overlay', tool: 'pan', T: { s: 1, x: 0, y: 0 }, highlight: null, temp: null, counter: 0 };
  const EXT_OK = /\.(png|jpe?g|tiff?|bmp|webp)$/i;
  const BROWSER_DECODES = /\.(png|jpe?g|bmp|webp)$/i;
  const COND = [['project', 'Projekt / Arbeit'], ['operator', 'Bearbeiter/in'], ['standard', 'Prüfverfahren / Norm'], ['specimen', 'Prüfkörper / Vulkanisation'], ['ozone', 'Ozonkonzentration'], ['temperature', 'Temperatur'], ['humidity', 'Relative Luftfeuchte'], ['strain', 'Dehnung (statisch/dynamisch)'], ['duration', 'Expositionsdauer / Prüfzeitpunkte'], ['microscope', 'Mikroskop / Objektiv / Beleuchtung'], ['na', 'Numerische Apertur'], ['notes', 'Bemerkungen']];

  const cur = () => A.images[A.sel];
  const emptyAnn = () => ({ exclusions: [], labels: [], overlap: [], profile: null });

  // ------------------------------------------------------------------ Bilder hinzufügen
  async function addFiles(fileList) {
    const files = Array.from(fileList).filter(f => EXT_OK.test(f.name));
    if (!files.length) { RS.toast('Keine unterstützten Bilddateien (PNG, JPG, TIFF, BMP, WebP).', 'warn'); return; }
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      await addImage(f.name, bytes);
    }
  }

  RS.analyseAddImage = (name, bytes, meta) => addImage(name, bytes, meta);
  async function addImage(name, bytes, meta = {}) {
    const key = 'img' + (++A.counter);
    const im = { key, name, bytes, status: 'neu', meta: { state: meta.state || 'Unbekannt', group: meta.group || '', id: '' }, ann: emptyAnn(), result: null, bmp: {}, w: 0, h: 0 };
    A.images.push(im);
    if (BROWSER_DECODES.test(name)) {
      try {
        im.bmp.original = await createImageBitmap(new Blob([bytes]));
        im.w = im.bmp.original.width; im.h = im.bmp.original.height;
        im.thumb = thumbFrom(im.bmp.original);
      } catch { /* z. B. 16-bit-PNG: Vorschau später vom Rechenkern */ }
    }
    renderList();
    if (A.sel < 0) select(A.images.length - 1);
    RS.loadEngine().then(() => registerWithEngine(im)).catch(() => { });
    return im;
  }

  function thumbFrom(bmp) {
    const c = document.createElement('canvas'); c.width = 76; c.height = 60;
    const g = c.getContext('2d'); const s = Math.max(76 / bmp.width, 60 / bmp.height);
    g.drawImage(bmp, (76 - bmp.width * s) / 2, (60 - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
    return c.toDataURL('image/jpeg', .7);
  }

  async function registerWithEngine(im) {
    if (im.registered) return im.registered;
    im.registered = (async () => {
      const info = JSON.parse(await RS.call('put_file', im.key, im.name, im.bytes));
      im.w = info.width; im.h = info.height; im.info = info;
      if (!im.bmp.original) {
        const jpg = await RS.call('preview', im.key);
        im.bmp.original = await createImageBitmap(new Blob([jpg], { type: 'image/jpeg' }));
        im.thumb = thumbFrom(im.bmp.original);
        renderList();
        if (cur() === im) { fit(); draw(); }
      }
      if (info.meta_scale && !$('#p-scale').value) {
        $('#p-scale').value = +info.meta_scale.toPrecision(6);
        $('#scale-src').textContent = 'Aus Bildmetadaten: ' + info.meta_scale_source;
      }
      if (info.large) RS.toast(`${im.name}: sehr großes Bild (${(im.w * im.h / 1e6).toFixed(1)} MP) – die Analyse kann einige Sekunden dauern.`, 'warn', 6000);
      return info;
    })();
    return im.registered;
  }

  async function loadDemo() {
    $('#load-demo').disabled = true;
    try {
      setBusy(true, 'Demobilder werden erzeugt …');
      const set = await RS.callJSON('demo_set');
      for (const d of set) await addImage(d.name, RS.b64ToBytes(d.b64), { state: d.state, group: d.group });
      $('#p-scale').value = 0.8; $('#p-strain').value = 0; $('#p-ctrl').checked = true;
      $('#scale-src').textContent = 'Demobilder: 0,8 µm/px (frei gewählt, synthetisch)';
      RS.toast('8 synthetische Demobilder geladen (2 Rezepturen, je 1 Referenz + 3 gealtert). Jetzt „Alle analysieren“.', 'ok', 6000);
    } catch (e) { RS.toast('Demobilder: ' + e.message, 'err'); }
    finally { setBusy(false); $('#load-demo').disabled = false; }
  }

  // ------------------------------------------------------------------ Liste & Auswahl
  function renderList() {
    const ul = $('#imglist'); ul.innerHTML = '';
    A.images.forEach((im, i) => {
      const st = { neu: ['neu', ''], läuft: ['läuft …', 'run'], fertig: ['fertig', 'done'], veraltet: ['neu rechnen', 'run'], fehler: ['Fehler', ''] }[im.status];
      const li = h('li', { class: i === A.sel ? 'sel' : '', onclick: () => select(i), title: im.name },
        im.thumb ? h('img', { src: im.thumb, alt: '' }) : h('span', { style: 'width:38px;height:30px;background:#223;border-radius:4px;display:inline-block' }),
        h('span', { class: 'nm' }, im.name, h('br'), h('span', { class: 'tiny muted' }, [im.meta.group, im.meta.state !== 'Unbekannt' ? im.meta.state : ''].filter(Boolean).join(' · '))),
        h('span', { class: 'st ' + st[1] }, st[0]));
      ul.append(li);
    });
    const any = A.images.length > 0;
    $('#run-one').disabled = !any; $('#run-all').disabled = !any; $('#remove-img').disabled = !any;
  }

  function select(i) {
    A.sel = i; A.highlight = null; A.temp = null;
    const im = cur();
    if (im) { $('#p-state').value = im.meta.state; $('#p-group').value = im.meta.group; $('#p-id').value = im.meta.id; }
    renderList(); fit(); draw(); renderResults();
  }

  function removeCurrent() {
    const im = cur(); if (!im) return;
    if (im.key) RS.call('remove', im.key).catch(() => { });
    A.images.splice(A.sel, 1);
    A.sel = Math.min(A.sel, A.images.length - 1);
    select(A.sel);
  }

  function readMeta() {
    const im = cur(); if (!im) return;
    const before = JSON.stringify(im.meta);
    im.meta.state = $('#p-state').value; im.meta.group = $('#p-group').value.trim(); im.meta.id = $('#p-id').value.trim();
    if (before !== JSON.stringify(im.meta) && im.status === 'fertig') im.status = 'veraltet';
    renderList();
  }

  // ------------------------------------------------------------------ Parameter
  function params(im) {
    const f = v => { const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
    const p = {
      algorithm: $('#p-alg').value, sensitivity: f($('#p-k').value), min_area: parseInt($('#p-amin').value) || 16,
      polarity: $('#p-pol').value, exclude_edge_objects: $('#p-edge').checked, robustness: $('#p-robust').checked,
      controlled_acquisition: $('#p-ctrl').checked, bright_features: $('#p-bright').checked, surface_features: $('#p-surface').checked,
      sample_state: im.meta.state, comparison_group: im.meta.group, sample_id: im.meta.id || undefined,
      method_params: RS.pm.overrides,
    };
    const s = f($('#p-scale').value); if (s && s > 0) p.scale_um = s;
    const u = f($('#p-unc').value); if (u && u > 0) p.scale_uncertainty_pct = u;
    const d = f($('#p-strain').value); if (d !== null && $('#p-strain').value !== '') p.strain_direction_deg = ((d % 180) + 180) % 180;
    return p;
  }

  // ------------------------------------------------------------------ Analyse
  function setBusy(on, text) { $('#viewer').classList.toggle('is-busy', !!on); if (text) $('#busy-text').textContent = text; }

  async function analyzeImage(im, quiet) {
    im.status = 'läuft'; renderList();
    try {
      await registerWithEngine(im);
      const res = JSON.parse(await RS.call('analyze', im.key, JSON.stringify(params(im))));
      im.result = res; im.status = 'fertig';
      if (hasAnn(im)) im.result = JSON.parse(await RS.call('annotate', im.key, JSON.stringify(im.ann)));
      await refreshImages(im);
    } catch (e) {
      im.status = 'fehler'; console.error(e);
      if (!quiet) RS.toast(im.name + ': ' + e.message, 'err', 8000);
      throw e;
    } finally { renderList(); }
  }
  const hasAnn = im => im.ann.exclusions.length || im.ann.labels.length || im.ann.overlap.length || im.ann.profile;

  async function refreshImages(im) {
    const ov = await RS.call('image', im.key, 'overlay');
    im.bmp.overlay = await createImageBitmap(new Blob([ov], { type: 'image/jpeg' }));
    im.bmp.mask = null;
  }

  async function runOne() {
    const im = cur(); if (!im) return;
    readMeta();
    setBusy(true, 'Analyse läuft … (' + im.name + ')');
    const t0 = performance.now();
    try {
      await analyzeImage(im);
      A.view = 'overlay'; syncViewButtons();
      RS.toast(`${im.name}: ${im.result.summary.object_count} Objekte · ${((performance.now() - t0) / 1000).toFixed(1)} s`, 'ok');
    } catch { } finally { setBusy(false); draw(); renderResults(); }
  }

  async function runAll() {
    readMeta();
    let n = 0, errs = 0;
    for (let i = 0; i < A.images.length; i++) {
      const im = A.images[i];
      setBusy(true, `Analyse ${i + 1} / ${A.images.length}: ${im.name}`);
      try { await analyzeImage(im, true); n++; } catch { errs++; }
      if (i === A.sel) draw();
    }
    setBusy(false); draw(); renderResults();
    RS.toast(`${n} Bild(er) ausgewertet` + (errs ? `, ${errs} mit Fehler` : ''), errs ? 'warn' : 'ok');
    if (n >= 2) showRightTab('statistik');
  }

  async function reannotate(im) {
    if (!im.result) return;
    setBusy(true, 'Korrekturen werden angewendet …');
    try {
      im.result = JSON.parse(await RS.call('annotate', im.key, JSON.stringify(im.ann)));
      await refreshImages(im);
    } catch (e) { RS.toast(e.message, 'err'); }
    finally { setBusy(false); draw(); renderResults(); }
  }

  // ------------------------------------------------------------------ Viewer
  const cv = () => $('#cv');
  function viewBitmap() {
    const im = cur(); if (!im) return null;
    if (A.view === 'overlay' && im.bmp.overlay) return im.bmp.overlay;
    if (A.view === 'mask' && im.bmp.mask) return im.bmp.mask;
    return im.bmp.original || im.bmp.overlay || null;
  }
  async function ensureMask() {
    const im = cur();
    if (A.view === 'mask' && im && im.result && !im.bmp.mask) {
      const png = await RS.call('image', im.key, 'mask');
      im.bmp.mask = await createImageBitmap(new Blob([png], { type: 'image/png' }));
      draw();
    }
  }
  function fit() {
    const im = cur(), c = cv(); if (!im || !im.w) return;
    const r = c.getBoundingClientRect();
    const s = Math.min(r.width / im.w, r.height / im.h) * 0.98;
    A.T = { s, x: (r.width - im.w * s) / 2, y: (r.height - im.h * s) / 2 };
  }
  const toImg = (cx, cy) => [(cx - A.T.x) / A.T.s, (cy - A.T.y) / A.T.s];
  const toScr = (ix, iy) => [ix * A.T.s + A.T.x, iy * A.T.s + A.T.y];

  function draw() {
    const c = cv(), r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, r.width, r.height);
    const im = cur(), bmp = viewBitmap();
    $('#viewer-empty').hidden = !!bmp;
    $('#legend').hidden = !(im && im.result && A.view === 'overlay');
    if (!bmp) { $('#hud').textContent = ''; return; }
    if (!im.w) { im.w = bmp.width; im.h = bmp.height; fit(); }
    g.imageSmoothingEnabled = A.T.s < 2;
    g.drawImage(bmp, A.T.x, A.T.y, im.w * A.T.s, im.h * A.T.s);
    // Dehnrichtung als Pfeil
    const sd = parseFloat($('#p-strain').value);
    if (Number.isFinite(sd)) {
      const a = -sd * Math.PI / 180, cx = 46, cy = 34, L = 26;
      g.strokeStyle = '#ffd34d'; g.fillStyle = '#ffd34d'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx - L * Math.cos(a), cy - L * Math.sin(a)); g.lineTo(cx + L * Math.cos(a), cy + L * Math.sin(a)); g.stroke();
      for (const sgn of [1, -1]) { const tx = cx + sgn * L * Math.cos(a), ty = cy + sgn * L * Math.sin(a); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - sgn * 8 * Math.cos(a - .5), ty - sgn * 8 * Math.sin(a - .5)); g.lineTo(tx - sgn * 8 * Math.cos(a + .5), ty - sgn * 8 * Math.sin(a + .5)); g.fill(); }
      g.font = '600 11px Inter, sans-serif'; g.fillText('Dehnung', cx - 22, cy + 22);
    }
    // gespeicherter Schnitt
    if (im.ann.profile) line(g, im.ann.profile[0], im.ann.profile[1], '#ff9f1c', true);
    // ausgewähltes Objekt
    if (A.highlight && A.highlight.bbox) {
      const [x0, y0, x1, y1] = A.highlight.bbox, [sx, sy] = toScr(x0 - 3, y0 - 3), [ex, ey] = toScr(x1 + 3, y1 + 3);
      g.strokeStyle = '#ff9f1c'; g.lineWidth = 2; g.setLineDash([5, 3]); g.strokeRect(sx, sy, ex - sx, ey - sy); g.setLineDash([]);
    }
    // laufende Eingabe (Rechteck / Linie)
    const t = A.temp;
    if (t && t.p0 && t.p1) {
      if (t.kind === 'rect') {
        const [sx, sy] = toScr(...t.p0), [ex, ey] = toScr(...t.p1);
        g.fillStyle = 'rgba(255,80,70,.18)'; g.fillRect(sx, sy, ex - sx, ey - sy);
        g.strokeStyle = '#ff5046'; g.lineWidth = 2; g.strokeRect(sx, sy, ex - sx, ey - sy);
      } else line(g, t.p0, t.p1, t.kind === 'scale' ? '#7CFC00' : t.kind === 'strain' ? '#ffd34d' : '#ff9f1c', false);
    } else if (t && t.p0) { const [sx, sy] = toScr(...t.p0); g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 4, 0, 7); g.fill(); }
    const s = im.result?.summary;
    $('#hud').textContent = `${im.w}×${im.h} px · Zoom ${(A.T.s * 100).toFixed(0)} %` + (A.cursor ? ` · x ${A.cursor[0].toFixed(0)}, y ${A.cursor[1].toFixed(0)}` : '') + (s ? ` · ${s.object_count} Objekte` : '');
  }
  function line(g, p0, p1, col, endMarks) {
    const [ax, ay] = toScr(...p0), [bx, by] = toScr(...p1);
    g.strokeStyle = '#000'; g.lineWidth = 4; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (endMarks) for (const [x, y] of [[ax, ay], [bx, by]]) { g.fillStyle = col; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  }

  const TOOLHELP = {
    pan: 'Mausrad = zoomen, Ziehen = verschieben, Doppelklick = ganzes Bild. Klick auf ein Objekt zeigt seine Werte.',
    label: 'Objekt anklicken → Klasse wählen. Als Riefe, Kratzer, Pore usw. markierte Objekte fallen aus den „bereinigten“ Kennwerten heraus; „Fragment – ausschließen“ entfernt das Objekt.',
    exclude: 'Rechteck über ein Artefakt ziehen. Standard: Jedes berührte Objekt wird vollständig entfernt. Bei bis zu 4 berührten Objekten wirst du gefragt, ob ein Riss behalten werden soll.',
    overlap: 'Objekt anklicken, das einen Ausschlussbereich berührt → „behalten“ oder „ganz ausschließen“. Auch bereits entfernte Objekte sind anklickbar.',
    profile: 'Zwei Punkte setzen: Grauwertprofil entlang der Linie (Helligkeit, kein Tiefenprofil). Ergebnis im Reiter „Kennwerte“.',
    scale: 'Maßstabsbalken: Anfang und Ende des Balkens anklicken, danach die Länge in µm eingeben.',
    strain: 'Dehnrichtung: zwei Punkte entlang der Zugrichtung setzen (Esc bricht ab).',
  };
  function setTool(t) {
    A.tool = t; A.temp = null;
    $$('[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    $('#tool-scale').classList.toggle('on', t === 'scale'); $('#tool-strain').classList.toggle('on', t === 'strain');
    $('#toolhelp').textContent = TOOLHELP[t];
    cv().style.cursor = t === 'pan' ? 'grab' : 'crosshair';
    if (['label', 'exclude', 'overlap', 'profile'].includes(t) && cur() && !cur().result) RS.toast('Dieses Werkzeug braucht eine Auswertung – zuerst „Analysieren“.', 'warn');
    draw();
  }
  function syncViewButtons() { $$('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === A.view)); }

  function bindViewer() {
    const c = cv();
    let drag = null;
    const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('wheel', e => {
      if (!cur()) return; e.preventDefault();
      const [mx, my] = pos(e), f = Math.exp(-e.deltaY * 0.0015), ns = Math.min(40, Math.max(0.02, A.T.s * f));
      A.T.x = mx - (mx - A.T.x) * ns / A.T.s; A.T.y = my - (my - A.T.y) * ns / A.T.s; A.T.s = ns; draw();
    }, { passive: false });
    c.addEventListener('dblclick', () => { fit(); draw(); });
    c.addEventListener('pointerdown', e => {
      if (!cur()) return;
      c.setPointerCapture(e.pointerId);
      const p = pos(e), ip = toImg(...p);
      drag = { start: p, T: { ...A.T }, moved: false, ip };
      if (A.tool === 'exclude' && cur().result) A.temp = { kind: 'rect', p0: ip, p1: ip };
    });
    c.addEventListener('pointermove', e => {
      const p = pos(e); A.cursor = toImg(...p);
      if (drag) {
        const dx = p[0] - drag.start[0], dy = p[1] - drag.start[1];
        if (Math.hypot(dx, dy) > 3) drag.moved = true;
        if (A.tool === 'pan' || e.buttons === 4) { A.T.x = drag.T.x + dx; A.T.y = drag.T.y + dy; c.style.cursor = 'grabbing'; }
        else if (A.temp && A.temp.kind === 'rect') A.temp.p1 = A.cursor;
      } else if (A.temp && A.temp.p0 && !A.temp.p1done) A.temp.p1 = A.cursor;
      draw();
    });
    c.addEventListener('pointerup', async e => {
      const d = drag; drag = null; if (A.tool === 'pan') c.style.cursor = 'grab';
      if (!d) return;
      const ip = toImg(...pos(e));
      if (A.tool === 'pan') { if (!d.moved) await inspect(ip); return; }
      if (A.tool === 'exclude' && A.temp) { const t = A.temp; A.temp = null; if (d.moved) await finishExclusion(t.p0, ip); draw(); return; }
      if (d.moved) return;
      if (A.tool === 'label') return labelAt(ip, e);
      if (A.tool === 'overlap') return overlapAt(ip);
      if (['profile', 'scale', 'strain'].includes(A.tool)) {
        if (!A.temp) { A.temp = { kind: A.tool, p0: ip }; draw(); return; }
        const t = A.temp; A.temp = null; await finishLine(t.kind, t.p0, ip); draw();
      }
    });
    c.addEventListener('pointerleave', () => { A.cursor = null; draw(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && A.temp) { e.preventDefault(); A.temp = null; draw(); } });
    new ResizeObserver(() => { const im = cur(); if (im) { fit(); } draw(); }).observe($('#viewer'));
  }

  async function objectAt(ip) {
    const im = cur(); if (!im?.result) return null;
    const rad = Math.max(6, 12 / A.T.s);
    const o = JSON.parse(await RS.call('object_info', im.key, ip[0], ip[1], Math.round(rad)));
    return o.id ? o : null;
  }

  async function inspect(ip) {
    const o = await objectAt(ip);
    A.highlight = o; draw();
    if (o) { showRightTab('objekte'); highlightRow(o.id); }
  }

  function labelAt(ip, e) {
    objectAt(ip).then(o => {
      if (!o) return RS.toast('Kein Objekt in der Nähe.', 'warn');
      A.highlight = o; draw();
      const classes = RS.engine.info?.classes || [];
      const menu = h('div', { class: 'ctxmenu', role: 'menu' }, h('div', { class: 'head' }, `Objekt ${o.id} · aktuell: ${o.classification || (o.active ? 'Nicht zugeordnet' : 'ausgeschlossen')}`),
        classes.map(cl => h('button', { type: 'button', onclick: () => { menu.remove(); setLabel(ip, cl, o.id); } }, cl)));
      document.body.append(menu);
      const x = Math.min(e.clientX + 6, window.innerWidth - 240), y = Math.min(e.clientY + 6, window.innerHeight - 330);
      menu.style.left = x + 'px'; menu.style.top = y + 'px';
      const off = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('pointerdown', off, true); } };
      setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    });
  }
  async function setLabel(ip, label, id) {
    const im = cur();
    im.ann.labels.push({ x: +ip[0].toFixed(1), y: +ip[1].toFixed(1), label });
    await reannotate(im);
    RS.toast(`Objekt ${id}: ${label}`, 'ok');
  }

  async function finishExclusion(p0, p1) {
    const im = cur();
    const box = [Math.round(Math.min(p0[0], p1[0])), Math.round(Math.min(p0[1], p1[1])), Math.round(Math.max(p0[0], p1[0])), Math.round(Math.max(p0[1], p1[1]))];
    if (box[2] - box[0] < 2 || box[3] - box[1] < 2) return;
    const touched = JSON.parse(await RS.call('touching', im.key, JSON.stringify(box)));
    im.ann.exclusions.push(box);
    if (touched.length && touched.length <= 4) {
      for (const t of touched) {
        A.highlight = { bbox: [t.x - 12, t.y - 12, t.x + 12, t.y + 12] }; draw();
        const v = await RS.dialog('Ausschlussbereich berührt ein Linienobjekt',
          `<p>Objekt <b>${t.id}</b> (Länge ${num(t.length_px, 4)} px, Orientierung ${num(t.angle, 3)}°) ragt in das Rechteck.</p>
           <p class="small">„Behalten“ übernimmt die <b>gesamte</b> segmentierte Komponente einschließlich des Schnittbereichs (keine automatische Trennung Riss/Artefakt). „Ganz ausschließen“ verwirft sie vollständig.</p>`,
          [{ label: 'Objekt behalten', value: 'behalten' }, { label: 'Ganz ausschließen', value: 'ausschliessen', primary: true }]);
        if (v === 'behalten') im.ann.overlap.push({ x: t.x, y: t.y, radius: 0, decision: 'behalten' });
      }
    } else if (touched.length > 4) RS.toast(`${touched.length} Objekte berührt – alle ausgeschlossen. Mit „⇄ Überlappung“ einzeln wieder aufnehmen.`, 'warn', 6500);
    A.highlight = null;
    await reannotate(im);
  }

  async function overlapAt(ip) {
    const im = cur();
    const o = await objectAt(ip);
    if (!o) return RS.toast('Kein Objekt in der Nähe.', 'warn');
    const touched = (im.result.decisions || []).find(d => d.object_id === o.id);
    if (!touched) return RS.toast(`Objekt ${o.id} berührt keinen Ausschlussbereich.`, 'warn');
    A.highlight = o; draw();
    const v = await RS.dialog(`Objekt ${o.id}: Überlappung entscheiden`, `<p>Aktuell: <b>${touched.decision === 'behalten' ? 'behalten' : 'ausgeschlossen'}</b>.</p>`,
      [{ label: 'Objekt behalten', value: 'behalten' }, { label: 'Ganz ausschließen', value: 'ausschliessen', primary: true }]);
    if (!v) return;
    const xs = Math.round(ip[0]), ys = Math.round(ip[1]);
    im.ann.overlap.push({ x: xs, y: ys, radius: Math.max(6, Math.round(12 / A.T.s)), decision: v });
    await reannotate(im);
  }

  async function finishLine(kind, p0, p1) {
    const im = cur();
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (L < 3) return;
    if (kind === 'profile') { im.ann.profile = [p0.map(Math.round), p1.map(Math.round)]; await reannotate(im); showRightTab('werte'); setTool('pan'); return; }
    if (kind === 'strain') {
      let ang = Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]) * 180 / Math.PI;
      ang = ((ang % 180) + 180) % 180;
      $('#p-strain').value = +ang.toFixed(1); paramsChanged(); setTool('pan');
      RS.toast(`Dehnrichtung φD = ${num(ang, 3)}°`, 'ok'); return;
    }
    if (kind === 'scale') {
      const body = h('div', {}, h('p', {}, `Gemessene Strecke: ${num(L, 5)} Pixel.`), h('label', { class: 'f' }, 'Länge des Maßstabsbalkens in µm'), h('input', { type: 'number', id: 'scale-um', step: 'any', min: '0', value: '100' }));
      const v = await RS.dialog('Maßstab übernehmen', body, [{ label: 'Abbrechen', value: null }, { label: 'Übernehmen', value: 'ok', primary: true }]);
      const um = parseFloat(body.querySelector('#scale-um').value);
      if (v && um > 0) {
        const s = um / L;
        $('#p-scale').value = +s.toPrecision(5);
        $('#scale-src').textContent = `Maßstabsbalken: ${num(um, 4)} µm / ${num(L, 5)} px = ${num(s, 4)} µm/px. Ablesefehler ±1 px ≈ ±${num(100 / L, 2)} %`;
        if (!$('#p-unc').value) $('#p-unc').value = +(100 / L).toFixed(2);
        paramsChanged();
      }
      setTool('pan');
    }
  }

  function paramsChanged() {
    let n = 0;
    A.images.forEach(im => { if (im.status === 'fertig') { im.status = 'veraltet'; n++; } });
    if (n) renderList();
    draw();
  }

  // ------------------------------------------------------------------ Ergebnisse rechts
  function showRightTab(t) {
    $$('[data-rt]').forEach(b => b.classList.toggle('on', b.dataset.rt === t));
    $$('[data-rp]').forEach(p => p.hidden = p.dataset.rp !== t);
    if (t === 'statistik') renderStats();
    if (t === 'export') renderExport();
  }

  function kpi(v, l) { return h('div', { class: 'kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'l', html: l })); }

  function renderResults() {
    const im = cur();
    const pw = $('[data-rp=werte]'), po = $('[data-rp=objekte]');
    if (!im || !im.result) {
      pw.innerHTML = `<p class="muted small">${im ? 'Dieses Bild ist noch nicht ausgewertet. Parameter links prüfen und „Analysieren“ wählen.' : 'Noch keine Auswertung.'}</p>`;
      po.innerHTML = '<p class="muted small">Noch keine Auswertung.</p>';
      return;
    }
    const s = im.result.summary, cal = s.calibrated;
    pw.innerHTML = '';
    if (im.status === 'veraltet') pw.append(h('div', { class: 'callout warn small' }, 'Parameter oder Zuordnung wurden geändert – Werte stammen noch von der vorherigen Analyse.'));
    if (!cal) pw.append(h('div', { class: 'callout warn small', html: 'Nicht kalibriert: nur Pixelwerte, keine Längendichte. Pixelgröße links eintragen oder mit 📏 abgreifen.' }));
    const k = h('div', { class: 'kpis' });
    k.append(kpi(num(s.object_count), 'Objekte (nach Korrekturen)'));
    k.append(kpi(num(s.feature_area_fraction_pct) + ' %', 'Flächenanteil φ'));
    if (cal) {
      k.append(kpi(num(s.crack_clean_length_density_mm_per_mm2), 'Risslängendichte L<sub>A</sub> [mm/mm²] (bereinigt)'));
      k.append(kpi(num(s.crack_clean_mean_width_um) + ' µm', 'mittlere Rissbreite w̄ (' + ({ modell: 'Profilmodell', profil: 'Halbwertsbreite', flaeche: 'ΣA/ΣL' }[s.width_method] || 'ΣA/ΣL') + ')'));
      k.append(kpi(num(s.crack_clean_length_max_um) + ' µm', 'größte Risslänge'));
      k.append(kpi(num(s.feature_density_mm2), 'Objektdichte [1/mm²]'));
    } else {
      k.append(kpi(num(s.crack_clean_total_length_px) + ' px', 'Gesamtlänge (bereinigt)'));
      k.append(kpi(num(s.crack_clean_mean_width_px) + ' px', 'mittlere Breite'));
    }
    if (s.crack_clean_perpendicular_length_fraction_pct != null) k.append(kpi(num(s.crack_clean_perpendicular_length_fraction_pct, 3) + ' %', `Längenanteil quer zur Dehnung (Δ ≥ ${num((s.method_params || {}).perp_min_deg ?? 60, 3)}°)`));
    if (cal && s.crack_perp_length_density_mm_per_mm2 != null) k.append(kpi(num(s.crack_perp_length_density_mm_per_mm2), 'L<sub>A,⊥</sub> quer zur Dehnung [mm/mm²]'));
    k.append(kpi(num(s.confirmed_crack_count), 'manuell bestätigte Risse'));
    if (s.uncertainty_length_density_rel_pct) k.append(kpi('± ' + num(s.uncertainty_length_density_rel_pct, 3) + ' %', 'u(L<sub>A</sub>)/L<sub>A</sub> aus Kalibrierung'));
    pw.append(k);
    const lens = im.result.objects.map(o => cal ? o.skeleton_length_um : o.skeleton_length_px).filter(x => x != null);
    if (lens.length) { pw.append(h('h4', { style: 'margin-top:14px' }, 'Längenverteilung')); pw.append(RS.svgHist(lens, 'Risslänge L [' + (cal ? 'µm' : 'px') + ']')); }
    if (im.result.profile) {
      const p = im.result.profile;
      pw.append(h('h4', { style: 'margin-top:14px' }, 'Optischer Schnitt (Grauwertprofil)'));
      pw.append(RS.svgLine(p.distance, p.intensity, `Abstand [${p.unit}]`, 'Grauwert', [0, 255]));
      pw.append(h('p', { class: 'tiny muted' }, 'Helligkeit entlang der Linie, bilinear interpoliert – kein topografisches Tiefenprofil.'));
    }
    pw.append(h('p', { class: 'tiny muted', style: 'margin-top:10px' }, `Methodenparameter: Satz ${s.method_params_hash}` + (s.method_params_changed && s.method_params_changed.length ? ` – vom Standard abweichend: ${s.method_params_changed.join(', ')}` : ' (Programmstandard)') + ` · RubberScope ${s.analysis_version}`));
    if (s.robustness) {
      const rb = s.robustness;
      pw.append(h('h4', { style: 'margin-top:14px' }, 'Sensitivitätsanalyse'));
      const t = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'k'), h('th', { class: 'n' }, 'φ [%]'), h('th', { class: 'n' }, 'Δφ rel.'), h('th', { class: 'n' }, 'L_A'), h('th', { class: 'n' }, 'ΔL_A rel.')));
      rb.forEach(r => t.append(h('tr', {}, h('td', {}, num(r.sensitivity, 3)), h('td', { class: 'n' }, num(r.area_fraction_pct)), h('td', { class: 'n' }, r.area_rel_change_pct == null ? '–' : num(r.area_rel_change_pct, 3) + ' %'), h('td', { class: 'n' }, num(r.length_density_mm_per_mm2)), h('td', { class: 'n' }, r.length_rel_change_pct == null ? '–' : num(r.length_rel_change_pct, 3) + ' %'))));
      pw.append(t);
    }
    const det = h('details', { class: 'box' }, h('summary', {}, 'Alle Kennwerte & Parameter (Rohdaten)'));
    const tb = h('table', { class: 't' });
    for (const [kk, vv] of Object.entries(s)) if (typeof vv !== 'object' || vv === null) tb.append(h('tr', {}, h('td', { class: 'mono tiny' }, kk), h('td', { class: 'tiny' }, typeof vv === 'number' ? num(vv, 6) : String(vv ?? '–'))));
    det.append(h('div', { class: 'tablewrap' }, tb));
    pw.append(det);
    renderObjects();
  }

  let sortKey = 'id', sortDir = 1;
  function renderObjects() {
    const im = cur(), po = $('[data-rp=objekte]');
    if (!im?.result) return;
    const cal = im.result.summary.calibrated, u = cal ? 'µm' : 'px';
    const cols = [['id', 'ID'], [cal ? 'skeleton_length_um' : 'skeleton_length_px', 'L [' + u + ']'], [cal ? 'mean_width_um' : 'mean_width_px', 'w̄ [' + u + ']'], ['eccentricity', 'e'], ['orientation_deg', 'θ [°]'], ['angle_to_strain_deg', 'Δ [°]'], ['classification', 'Klasse'], ['overlap_decision', 'Überl.']];
    const objs = [...im.result.objects].sort((a, b) => { const x = a[sortKey], y = b[sortKey]; return (x > y ? 1 : x < y ? -1 : 0) * sortDir; });
    po.innerHTML = '';
    po.append(h('p', { class: 'tiny muted' }, `${objs.length} Objekte · Klick auf Zeile = im Bild zeigen · Spaltenkopf = sortieren`));
    const t = h('table', { class: 't' });
    t.append(h('tr', {}, cols.map(([k, l]) => h('th', { class: k === 'classification' || k === 'overlap_decision' ? '' : 'n', onclick: () => { sortDir = sortKey === k ? -sortDir : 1; sortKey = k; renderObjects(); } }, l + (sortKey === k ? (sortDir > 0 ? ' ▲' : ' ▼') : '')))));
    for (const o of objs) {
      t.append(h('tr', { 'data-oid': o.id, style: 'cursor:pointer', onclick: () => focusObject(o) }, cols.map(([k]) => {
        const v = o[k];
        return h('td', { class: typeof v === 'number' ? 'n' : '', title: typeof v === 'string' ? v : null }, k === 'id' ? String(v) : typeof v === 'number' ? num(v, 4) : k === 'classification' ? (v === 'Nicht zugeordnet' ? '–' : v.split(' / ')[0].split(' – ')[0]) : k === 'overlap_decision' ? ({ behalten: 'behalten', ausschliessen: 'ausgeschl.' }[v] || '–') : (v || '–'));
      })));
    }
    po.append(h('div', { class: 'tablewrap', style: 'max-height:60vh' }, t));
    po.append(h('p', { class: 'tiny muted', html: 'L nach Kulpa ' + RS.cite('Q07', 'R05') + ' · e und θ aus zentralen Momenten ' + RS.cite('Q08', 'R04') + ' · Δ = Winkel zur Dehnrichtung ' + RS.cite('R06') }));
  }
  function highlightRow(id) {
    $$('[data-rp=objekte] tr[data-oid]').forEach(r => r.classList.toggle('hl', +r.dataset.oid === id));
    $(`[data-rp=objekte] tr[data-oid="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  async function focusObject(o) {
    const info = await objectAt([o.x_px, o.y_px]);
    A.highlight = info || { bbox: [o.x_px - 15, o.y_px - 15, o.x_px + 15, o.y_px + 15] };
    const r = cv().getBoundingClientRect(), [x0, y0, x1, y1] = A.highlight.bbox;
    const s = Math.min(8, Math.min(r.width / (x1 - x0 + 60), r.height / (y1 - y0 + 60)));
    A.T = { s, x: r.width / 2 - (x0 + x1) / 2 * s, y: r.height / 2 - (y0 + y1) / 2 * s };
    highlightRow(o.id); draw();
  }

  // ------------------------------------------------------------------ Vergleich & Statistik
  async function renderStats() {
    const p = $('[data-rp=statistik]');
    const done = A.images.filter(im => im.result);
    if (done.length < 2) { p.innerHTML = '<p class="muted small">Mindestens zwei ausgewertete Bilder nötig. Tipp: „Demobilder laden“ und „Alle analysieren“.</p>'; return; }
    p.innerHTML = '<p class="small muted">Berechne …</p>';
    try {
      const st = await RS.callJSON('statistics', JSON.stringify(done.map(i => i.key)), JSON.stringify(RS.pm.overrides));
      p.innerHTML = '';
      if (st.param_sets > 1) p.append(h('div', { class: 'callout warn small' }, `Die Bilder wurden mit ${st.param_sets} verschiedenen Methodenparametersätzen ausgewertet. Gruppen sind deshalb zusätzlich nach Satz getrennt ([P:…]). Für einen Vergleich alle Bilder mit demselben Satz neu analysieren.`));
      p.append(h('p', { class: 'tiny muted', html: 'Gruppe = „Vergleichsgruppe | Zustand“. Statistische Einheit ist das <b>Bild</b> – mehrere Bilder desselben Prüfkörpers sind keine unabhängigen Proben ' + RS.cite('R07') + '.' }));
      const keys = st.metric_keys.map(k => k[0]);
      const lbl = Object.fromEntries(st.metric_keys);
      const sel = h('select', {}, keys.map(k => h('option', { value: k }, lbl[k])));
      const box = h('div');
      const show = () => {
        const rows = st.groups.filter(g => g.metric === sel.value);
        box.innerHTML = '';
        box.append(RS.svgGroups(rows, lbl[sel.value]));
        const t = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Gruppe'), h('th', { class: 'n' }, 'n'), h('th', { class: 'n' }, 'x̄'), h('th', { class: 'n' }, 's'), h('th', { class: 'n' }, '± KI95')));
        rows.forEach(r => t.append(h('tr', {}, h('td', {}, r.group), h('td', { class: 'n' }, r.n), h('td', { class: 'n' }, num(r.mean)), h('td', { class: 'n' }, num(r.sd)), h('td', { class: 'n' }, num(r.ci95)))));
        box.append(t);
      };
      sel.onchange = show;
      p.append(h('label', { class: 'f' }, 'Kennwert'), sel, box);
      show();
      const lvl = (st.groups[0] && st.groups[0].ci_level) || 95;
      p.append(h('p', { class: 'tiny muted', html: `KI-Spalte: ${num(lvl, 4)}-%-Konfidenzintervall x̄ ± t·s/√n ` + RS.cite('Q11') + '. Gruppen mit n &lt; 3 liefern kein belastbares Streumaß.' }));
      if (st.tests.length) {
        p.append(h('h4', {}, 'Gruppenvergleich (Welch-t-Test, Holm-korrigiert)'));
        const t = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'A'), h('th', {}, 'B'), h('th', { class: 'n' }, 'x̄ A'), h('th', { class: 'n' }, 'x̄ B'), h('th', { class: 'n' }, 't'), h('th', { class: 'n' }, 'p (Holm)')));
        st.tests.forEach(x => t.append(h('tr', {}, h('td', {}, x.a), h('td', {}, x.b), h('td', { class: 'n' }, num(x.mean_a)), h('td', { class: 'n' }, num(x.mean_b)), h('td', { class: 'n' }, num(x.t, 3)), h('td', { class: 'n' }, num(x.p_holm, 3) + (x.significant ? ' *' : '')))));
        p.append(h('div', { class: 'tablewrap' }, t), h('p', { class: 'tiny muted', html: `Kennwert: ${RS.esc(st.tests[0].metric)}. Nur Gruppen mit n ≥ 3; explorativ; * = p<sub>Holm</sub> &lt; α = ${num(st.tests[0].alpha, 3)} ` + RS.cite('Q12', 'Q13') }));
      }
      const refs = Object.entries(st.refs).filter(([, v]) => v.reference_delta_area_pp != null);
      if (refs.length) {
        p.append(h('h4', {}, 'Differenz zur ungealterten Referenz'));
        const t = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Bild'), h('th', { class: 'n' }, 'Δφ [pp]'), h('th', { class: 'n' }, 'ΔL_A [mm/mm²]'), h('th', { class: 'n' }, 'n Ref')));
        refs.forEach(([k, v]) => { const im = A.images.find(i => i.key === k); t.append(h('tr', {}, h('td', {}, im?.name || k), h('td', { class: 'n' }, num(v.reference_delta_area_pp)), h('td', { class: 'n' }, num(v.reference_delta_crack_clean_length_density_mm_per_mm2)), h('td', { class: 'n' }, v.reference_count))); });
        p.append(h('div', { class: 'tablewrap' }, t), h('p', { class: 'tiny muted' }, 'Nur für Bilder mit Zustand „Gealtert“, gleicher Gruppe, kontrollierten Aufnahmebedingungen und gleichem Maßstab. Deskriptiv, keine Bildregistrierung.'));
      } else p.append(h('p', { class: 'tiny muted' }, 'Referenzvergleich: Zustand „Ungealtert (Referenz)“ bzw. „Gealtert“ in derselben Gruppe zuweisen und „Aufnahmebedingungen kontrolliert gleich“ aktivieren.'));
    } catch (e) { p.innerHTML = ''; p.append(h('div', { class: 'callout warn small' }, e.message)); }
  }

  // ------------------------------------------------------------------ Export
  const condState = {};
  function renderExport() {
    const p = $('[data-rp=export]');
    const done = A.images.filter(im => im.result);
    p.innerHTML = '';
    if (!done.length) { p.append(h('p', { class: 'muted small' }, 'Zuerst mindestens ein Bild auswerten.')); return; }
    p.append(h('p', { class: 'small' }, `${done.length} ausgewertete(s) Bild(er) werden exportiert.`));
    const form = h('details', { class: 'box', open: true }, h('summary', {}, 'Prüfbedingungen für das Protokoll'));
    COND.forEach(([k, l]) => {
      const inp = h('input', { type: 'text', value: condState[k] || '', oninput: e => condState[k] = e.target.value });
      form.append(h('label', { class: 'f' }, l), inp);
    });
    form.append(h('p', { class: 'hint' }, 'Mit numerischer Apertur und kalibrierten Bildern prüft das PDF die Rayleigh-/Nyquist-Bedingung.'));
    p.append(form);
    const groups = [...new Set(done.map(i => i.meta.group).filter(Boolean))];
    const gdesc = {};
    if (groups.length) {
      const gd = h('details', { class: 'box' }, h('summary', {}, 'Beschreibung der Gruppen / Rezepturen'));
      groups.forEach(g => gd.append(h('label', { class: 'f' }, g), h('input', { type: 'text', oninput: e => gdesc[g] = e.target.value })));
      p.append(gd);
    }
    const o1 = h('input', { type: 'checkbox', checked: true }), o2 = h('input', { type: 'checkbox', checked: true }), o3 = h('input', { type: 'checkbox' });
    p.append(h('label', { class: 'chk' }, o1, 'Prüfprotokoll (PDF)'), h('label', { class: 'chk' }, o2, 'Methoden- und Rechenprotokoll mit Quellen (PDF)'), h('label', { class: 'chk' }, o3, 'Synthetische Validierung (PDF, +3 s)'));
    const btn = h('button', { class: 'btn primary', type: 'button' }, '⬇ Alles als ZIP exportieren');
    btn.onclick = async () => {
      btn.disabled = true; setBusy(true, 'Protokolle werden erstellt …');
      try {
        const zip = await RS.call('export_zip', JSON.stringify(done.map(i => i.key)), JSON.stringify(condState),
          JSON.stringify({ pdf: o1.checked, rechenprotokoll: o2.checked, validierung: o3.checked, groups_info: Object.keys(gdesc).length ? gdesc : null, k_grid: RS.valOptions ? RS.valOptions().k_grid : null }),
          JSON.stringify(RS.pm.overrides));
        await RS.download('rubberscope_export_' + new Date().toISOString().slice(0, 10) + '.zip', zip, 'application/zip');
      } catch (e) { RS.toast('Export: ' + e.message, 'err', 8000); }
      finally { btn.disabled = false; setBusy(false); }
    };
    p.append(h('div', { class: 'btnrow', style: 'margin-top:8px' }, btn));
    const single = h('div', { class: 'btnrow', style: 'margin-top:8px' });
    const pdfBtn = (label, which, fname) => h('button', {
      class: 'btn sm', type: 'button', onclick: async e => {
        e.target.disabled = true; setBusy(true, 'PDF wird erstellt …');
        try { const b = await RS.call('single_pdf', JSON.stringify(done.map(i => i.key)), JSON.stringify(condState), which, JSON.stringify(RS.pm.overrides)); await RS.download(fname, b, 'application/pdf'); }
        catch (er) { RS.toast(er.message, 'err'); } finally { e.target.disabled = false; setBusy(false); }
      }
    }, label);
    single.append(pdfBtn('Prüfprotokoll.pdf', 'pruef', 'pruefprotokoll.pdf'), pdfBtn('Rechenprotokoll.pdf', 'rechen', 'methoden_und_rechenprotokoll.pdf'));
    const im = cur();
    if (im?.result) single.append(h('button', {
      class: 'btn sm', type: 'button', onclick: async () => {
        const png = await RS.call('image', im.key, 'overlay');
        await RS.download(im.name.replace(/\.[^.]+$/, '') + '_overlay.jpg', png, 'image/jpeg');
      }
    }, 'Overlay (aktuelles Bild)'));
    p.append(h('p', { class: 'small', style: 'margin:12px 0 4px' }, 'Einzeldateien:'), single);
    p.append(h('p', { class: 'tiny muted', style: 'margin-top:12px' }, 'Das ZIP enthält: pruefprotokoll.pdf, methoden_und_rechenprotokoll.pdf, probenuebersicht.csv, einzelobjekte.csv, gruppenstatistik.csv, rechenweg_einzelobjekte.csv, auswertungsparameter.json, manuelle_korrekturen.json sowie je Bild Overlay, Maske und Ergebnis-JSON. CSV mit Semikolon und Dezimalkomma (deutsches Excel).'));
  }

  // ------------------------------------------------------------------ SVG-Diagramme
  RS.svgHist = (vals, xlabel, bins = 16) => {
    const W = 340, H = 150, l = 34, r = 8, t = 8, b = 34;
    const hi = Math.max(...vals) || 1, counts = new Array(bins).fill(0);
    vals.forEach(v => counts[Math.min(bins - 1, Math.floor(v / hi * bins))]++);
    const cm = Math.max(...counts), bw = (W - l - r) / bins;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogramm ${RS.esc(xlabel)}"><line class="ax" x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}"/>`;
    counts.forEach((c, i) => { const hh = (H - t - b) * c / cm; s += `<rect x="${l + i * bw + 1}" y="${H - b - hh}" width="${bw - 2}" height="${hh}" rx="2" fill="var(--accent)"><title>${num(i * hi / bins, 3)}–${num((i + 1) * hi / bins, 3)}: ${c}</title></rect>`; });
    s += `<text x="${l - 4}" y="${t + 8}" text-anchor="end">${cm}</text><text x="${l - 4}" y="${H - b}" text-anchor="end">0</text><text x="${l}" y="${H - b + 14}">0</text><text x="${W - r}" y="${H - b + 14}" text-anchor="end">${num(hi, 3)}</text><text x="${(W + l) / 2}" y="${H - 4}" text-anchor="middle">${RS.esc(xlabel)} · Anzahl je Klasse</text></svg>`;
    return h('div', { html: s });
  };
  RS.svgLine = (xs, ys, xlabel, ylabel, yr) => {
    const W = 340, H = 150, l = 34, r = 8, t = 8, b = 34;
    const xm = xs[xs.length - 1] || 1, [y0, y1] = yr || [Math.min(...ys), Math.max(...ys)];
    const pts = xs.map((x, i) => `${(l + x / xm * (W - l - r)).toFixed(1)},${(H - b - (ys[i] - y0) / (y1 - y0 || 1) * (H - t - b)).toFixed(1)}`).join(' ');
    return h('div', { html: `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${RS.esc(ylabel)} über ${RS.esc(xlabel)}"><line class="ax" x1="${l}" y1="${H - b}" x2="${W - r}" y2="${H - b}"/><line class="ax" x1="${l}" y1="${t}" x2="${l}" y2="${H - b}"/><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="1.6"/><text x="${l - 4}" y="${t + 8}" text-anchor="end">${num(y1, 3)}</text><text x="${l - 4}" y="${H - b}" text-anchor="end">${num(y0, 3)}</text><text x="${W - r}" y="${H - b + 14}" text-anchor="end">${num(xm, 4)}</text><text x="${(W + l) / 2}" y="${H - 4}" text-anchor="middle">${RS.esc(xlabel)}</text></svg>` });
  };
  RS.svgGroups = (rows, label) => {
    if (!rows.length) return h('p', { class: 'muted small' }, 'Keine Werte.');
    const W = 340, rowH = 26, l = 130, r = 14, H = rows.length * rowH + 30;
    const hi = Math.max(...rows.map(x => x.mean + (x.ci95 || 0))) * 1.08 || 1;
    const X = v => l + v / hi * (W - l - r);
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gruppenmittelwerte ${RS.esc(label)}">`;
    rows.forEach((x, i) => {
      const y = 10 + i * rowH;
      s += `<text x="${l - 6}" y="${y + 13}" text-anchor="end">${RS.esc(x.group.length > 24 ? x.group.slice(0, 23) + '…' : x.group)}</text><rect x="${l}" y="${y + 3}" width="${X(x.mean) - l}" height="14" rx="3" fill="var(--accent)" opacity=".85"><title>${RS.esc(x.group)}: ${num(x.mean)} (n=${x.n})</title></rect>`;
      if (x.ci95) s += `<line x1="${X(x.mean - x.ci95)}" x2="${X(x.mean + x.ci95)}" y1="${y + 10}" y2="${y + 10}" stroke="var(--ink)" stroke-width="1.5"/><line x1="${X(x.mean - x.ci95)}" x2="${X(x.mean - x.ci95)}" y1="${y + 5}" y2="${y + 15}" stroke="var(--ink)"/><line x1="${X(x.mean + x.ci95)}" x2="${X(x.mean + x.ci95)}" y1="${y + 5}" y2="${y + 15}" stroke="var(--ink)"/>`;
    });
    s += `<line class="ax" x1="${l}" x2="${W - r}" y1="${H - 16}" y2="${H - 16}"/><text x="${l}" y="${H - 3}">0</text><text x="${W - r}" y="${H - 3}" text-anchor="end">${num(hi, 3)}</text></svg>`;
    return h('div', { html: s, style: 'margin:6px 0' });
  };

  // ------------------------------------------------------------------ Initialisierung
  RS.routes.analyse = () => { RS.loadEngine().catch(() => { }); requestAnimationFrame(() => { fit(); draw(); }); };
  RS.anaAddImage = addImage;

  document.addEventListener('DOMContentLoaded', () => {
    const drop = $('#drop'), file = $('#file');
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    file.addEventListener('change', () => { addFiles(file.files); file.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    $('#viewer').addEventListener('dragover', e => e.preventDefault());
    $('#viewer').addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer.files); });
    $('#load-demo').onclick = loadDemo;
    $('#remove-img').onclick = removeCurrent;
    $('#run-one').onclick = runOne;
    $('#run-all').onclick = runAll;
    ['#p-state', '#p-group', '#p-id'].forEach(s => $(s).addEventListener('change', readMeta));
    $('#p-apply-all').onclick = () => { readMeta(); const m = cur()?.meta; if (!m) return; A.images.forEach(im => { im.meta.state = m.state; im.meta.group = m.group; if (im.status === 'fertig') im.status = 'veraltet'; }); renderList(); RS.toast('Auf alle Bilder übertragen.'); };
    $('#p-k').addEventListener('input', e => { $('#p-k-num').value = +(+e.target.value).toFixed(3); });
    $('#p-k-num').addEventListener('change', e => { let v = parseFloat(String(e.target.value).replace(',', '.')); if (!(v > 0)) v = 1; v = Math.min(20, Math.max(0.01, v)); e.target.value = v; $('#p-k').value = v; paramsChanged(); });
    $('#mp-open').onclick = () => RS.openParamEditor();
    RS.anaParamsChanged = paramsChanged;
    RS.paramsInit();
    ['#p-k', '#p-amin', '#p-alg', '#p-pol', '#p-edge', '#p-robust', '#p-ctrl', '#p-bright', '#p-surface', '#p-scale', '#p-unc', '#p-strain'].forEach(s => $(s).addEventListener('change', paramsChanged));
    $('#p-scale').addEventListener('input', () => { $('#scale-src').textContent = $('#p-scale').value ? 'Benutzerangabe' : ''; });
    $$('[data-view]').forEach(b => b.onclick = async () => { A.view = b.dataset.view; syncViewButtons(); await ensureMask(); draw(); });
    $$('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    $('#tool-scale').onclick = () => setTool(A.tool === 'scale' ? 'pan' : 'scale');
    $('#tool-strain').onclick = () => setTool(A.tool === 'strain' ? 'pan' : 'strain');
    $('#fit').onclick = () => { fit(); draw(); };
    $('#undo-ex').onclick = () => { const im = cur(); if (im?.ann.exclusions.length) { im.ann.exclusions.pop(); reannotate(im); } };
    $('#reset-ann').onclick = async () => {
      const im = cur(); if (!im) return;
      if (await RS.dialog('Korrekturen zurücksetzen?', 'Alle Klassifikationen, Ausschlussbereiche, Überlappungsentscheidungen und der Schnitt dieses Bildes werden entfernt.', [{ label: 'Abbrechen', value: false }, { label: 'Zurücksetzen', value: true, primary: true }])) { im.ann = emptyAnn(); reannotate(im); }
    };
    $$('[data-rt]').forEach(b => b.onclick = () => showRightTab(b.dataset.rt));
    bindViewer();
    setTool('pan');
  });
})();
