/* RubberScope Web – Methodenparameter (Experteneinstellungen), Voreinstellungen, eigene Validierung */
'use strict';
(() => {
  const RS = window.RS, $ = RS.$, $$ = RS.$$, h = RS.h, num = RS.num;
  const PM = RS.pm = { overrides: {}, spec: null, defaults: null, hash: null, changed: [] };
  const LS = 'rs-method-params';
  try { PM.overrides = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch { PM.overrides = {}; }

  const fmt = v => Array.isArray(v) ? v.map(x => num(x, 4)).join('; ') : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : typeof v === 'number' ? num(v, 5) : String(v);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  /** Aktiver vollständiger Parametersatz (für die Übergabe an Python). */
  RS.methodParams = () => (PM.defaults ? { ...PM.defaults, ...PM.overrides } : null);
  RS.methodParamsJSON = () => { const p = RS.methodParams(); return p ? JSON.stringify(p) : null; };

  async function ensureSpec() {
    if (PM.spec) return;
    await RS.loadEngine();
    PM.spec = RS.engine.info.param_spec; PM.defaults = RS.engine.info.param_defaults;
    // gespeicherte Werte gegen aktuelle Version prüfen
    const r = await RS.callJSON('check_params', JSON.stringify(PM.overrides));
    if (!r.ok) { RS.toast('Gespeicherte Methodenparameter ungültig (' + r.error + ') – Standard wird verwendet.', 'warn', 8000); PM.overrides = {}; }
    await commit(PM.overrides, true);
  }

  async function commit(overrides, silent) {
    const r = await RS.callJSON('check_params', JSON.stringify(overrides));
    if (!r.ok) throw new Error(r.error);
    const clean = {};
    for (const k of r.changed) clean[k] = r.params[k];
    const before = PM.hash;
    PM.overrides = clean; PM.changed = r.changed; PM.hash = r.hash;
    try { localStorage.setItem(LS, JSON.stringify(clean)); } catch { }
    updateBadge();
    if (!silent && before && before !== r.hash && RS.anaParamsChanged) RS.anaParamsChanged();
    return r;
  }

  function updateBadge() {
    const b = $('#mp-badge'); if (!b) return;
    const n = PM.changed.length;
    b.className = 'mp-badge ' + (n ? 'changed' : 'std');
    b.innerHTML = n ? `⚠ <b>${n}</b> Methodenparameter geändert · Satz <code>${PM.hash}</code>` : `✓ Programmstandard · Satz <code>${PM.hash || '–'}</code>`;
    b.title = n ? 'Geändert: ' + PM.changed.join(', ') : 'Alle Festlegungen entsprechen RubberScope 2.4/2.5';
  }

  // ------------------------------------------------------------------ Editor
  function inputFor(sp, val) {
    const id = 'mp-' + sp.key;
    if (sp.type === 'bool') return h('input', { type: 'checkbox', id, checked: !!val });
    if (sp.type === 'choice') return h('select', { id }, sp.choices.map(c => h('option', { value: c, selected: String(c) === String(val) }, String(c))));
    if (sp.type === 'floatlist' || sp.type === 'oddintlist') return h('input', { type: 'text', id, value: val.map(x => String(x).replace('.', ',')).join('; '), placeholder: 'z. B. 1; 1,6; 2,5' });
    return h('input', { type: 'text', inputmode: 'decimal', id, value: String(val).replace('.', ','), autocomplete: 'off' });
  }
  function readInput(sp, root) {
    const el = root.querySelector('#mp-' + sp.key);
    if (sp.type === 'bool') return el.checked;
    if (sp.type === 'choice') return typeof sp.choices[0] === 'number' ? +el.value : el.value;
    if (sp.type === 'floatlist' || sp.type === 'oddintlist') return el.value;
    return el.value === '' ? sp.default : el.value;
  }

  async function openEditor() {
    try { await ensureSpec(); } catch (e) { return RS.toast('Rechenkern nicht bereit: ' + e.message, 'err'); }
    const cur = RS.methodParams();
    const body = h('div', { class: 'mp-editor' });
    body.append(h('div', { class: 'callout warn small', html: '<b>Wissenschaftlicher Hinweis:</b> Alle Werte unten sind Festlegungen des Verfahrens. Die Standardwerte stammen aus RubberScope 2.4 und sind an synthetischen Bildern abgestimmt ' + RS.cite('R03', 'R08') + '. Abweichende Werte werden im Prüf- und Rechenprotokoll markiert und müssen in deiner Auswertung begründet werden, idealerweise mit einer <b>Validierung an eigenen, manuell markierten Bildern</b> (Seite „Validierung“). Werte nicht am selben Bild „hindrehen“, das du anschließend berichtest.' }));
    const search = h('input', { type: 'text', placeholder: 'Parameter suchen …', style: 'margin:6px 0' });
    body.append(search);
    const groups = {};
    PM.spec.forEach(sp => (groups[sp.group] ||= []).push(sp));
    const rowsEls = [];
    const norm = (sp, v) => {
      if (sp.type === 'bool') return !!v;
      if (sp.type === 'choice') return String(v);
      if (Array.isArray(v)) return v.map(Number);
      if (sp.type === 'floatlist' || sp.type === 'oddintlist') return String(v).split(/[;\s]+/).filter(Boolean).map(x => parseFloat(x.replace(',', '.')));
      return parseFloat(String(v).replace(',', '.'));
    };
    const setInput = (sp, v) => {
      const el = $('#mp-' + sp.key, body);
      if (sp.type === 'bool') el.checked = !!v;
      else if (Array.isArray(v)) el.value = v.map(x => String(x).replace('.', ',')).join('; ');
      else el.value = v;
    };
    for (const [g, list] of Object.entries(groups)) {
      const det = h('details', { class: 'box', open: list.some(sp => !same(cur[sp.key], sp.default)) || g === 'Entscheidung' }, h('summary', {}, g));
      const tbl = h('div', { class: 'mp-grid' });
      for (const sp of list) {
        const inp = inputFor(sp, cur[sp.key]);
        const mark = h('span', { class: 'mp-mark' });
        const refresh = () => {
          const el = $('#mp-' + sp.key, body) || inp;
          const v = sp.type === 'bool' ? el.checked : el.value;
          const changed = !same(norm(sp, v), norm(sp, sp.default));
          mark.textContent = changed ? '● ' : ''; mark.title = changed ? 'vom Standard abweichend' : '';
        };
        const reset = h('button', { class: 'btn sm', type: 'button', title: 'Standard wiederherstellen', onclick: () => { setInput(sp, sp.default); refresh(); } }, '↺');
        inp.addEventListener('input', refresh); inp.addEventListener('change', refresh);
        const row = h('div', { class: 'mp-row', 'data-key': sp.key },
          h('label', { for: 'mp-' + sp.key }, mark, sp.label, sp.cites.length ? h('span', { html: ' ' + RS.cite(...sp.cites) }) : '',
            sp.help ? h('div', { class: 'hint' }, sp.help) : ''),
          h('div', { class: 'mp-in' }, inp, h('span', { class: 'tiny muted' }, sp.unit && sp.unit !== '–' ? sp.unit : '')),
          h('div', { class: 'tiny muted mp-def' }, 'Standard: ' + fmt(sp.default), sp.min != null ? h('br') : '', sp.min != null ? `${num(sp.min, 4)} … ${num(sp.max, 6)}` : ''),
          reset);
        rowsEls.push({ sp, row });
        tbl.append(row);
        refresh();
      }
      det.append(tbl); body.append(det);
    }
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      rowsEls.forEach(({ sp, row }) => { const hit = !q || (sp.label + sp.key + sp.help + sp.group).toLowerCase().includes(q); row.hidden = !hit; if (hit && q) row.closest('details').open = true; });
    });
    const err = h('div', { class: 'callout warn small', hidden: true });
    body.append(err);
    for (; ;) {
      const v = await RS.dialog('Methodenparameter – alle Festlegungen', body, [
        { label: 'Alle auf Standard', value: 'reset', danger: true },
        { label: 'Voreinstellung speichern', value: 'save' },
        { label: 'Voreinstellung laden', value: 'load' },
        { label: 'Abbrechen', value: null },
        { label: 'Übernehmen', value: 'ok', primary: true }]);
      if (v === null) return;
      if (v === 'reset') { await commit({}); RS.toast('Alle Methodenparameter auf Standard zurückgesetzt.', 'ok'); return; }
      if (v === 'load') { return loadPreset(); }
      const ov = {};
      for (const sp of PM.spec) ov[sp.key] = readInput(sp, body);
      try {
        const r = await commit(ov);
        if (v === 'save') { await savePreset(); return; }
        RS.toast(r.changed.length ? `${r.changed.length} Parameter vom Standard abweichend (Satz ${r.hash}).` : 'Programmstandard aktiv.', r.changed.length ? 'warn' : 'ok', 5000);
        return;
      } catch (e) {
        err.hidden = false; err.textContent = 'Nicht übernommen: ' + e.message;
        // Dialog erneut mit denselben Eingaben öffnen
        continue;
      }
    }
  }

  async function savePreset() {
    await ensureSpec();
    const name = await askText('Voreinstellung speichern', 'Name der Voreinstellung (z. B. „NBR Auflicht 10×“)', 'RubberScope_Parameter');
    if (name === null) return;
    const doc = {
      rubberscope_version: RS.engine.info.version, name, erstellt: new Date().toISOString(), parametersatz: PM.hash,
      abweichend_vom_standard: PM.changed, rubberscope_methodenparameter: RS.methodParams(),
      k: +$('#p-k').value, algorithmus: $('#p-alg').value, a_min: +$('#p-amin').value,
      hinweis: 'Laden in RubberScope Web: Analyse → Methodenparameter → Voreinstellung laden.'
    };
    await RS.download((name.replace(/[^\wäöüÄÖÜß.-]+/g, '_') || 'parameter') + '.json', JSON.stringify(doc, null, 2), 'application/json');
  }
  function askText(title, label, val) {
    const inp = h('input', { type: 'text', value: val });
    return RS.dialog(title, h('div', {}, h('label', { class: 'f' }, label), inp), [{ label: 'Abbrechen', value: null }, { label: 'OK', value: 'ok', primary: true }])
      .then(v => v ? inp.value.trim() : null);
  }
  function loadPreset() {
    const fi = h('input', { type: 'file', accept: '.json,application/json' });
    fi.onchange = async () => {
      try {
        await ensureSpec();
        const r = JSON.parse(await RS.call('params_from_file', await fi.files[0].text()));
        await commit(r.params);
        if (r.meta?.k) { $('#p-k').value = r.meta.k; $('#p-k').dispatchEvent(new Event('input')); }
        if (r.meta?.algorithmus) $('#p-alg').value = r.meta.algorithmus;
        if (r.meta?.a_min) $('#p-amin').value = r.meta.a_min;
        RS.toast(`Voreinstellung geladen${r.meta?.name ? ' „' + r.meta.name + '“' : ''}: ${r.changed.length} Parameter vom Standard abweichend.`, 'ok', 6000);
        RS.anaParamsChanged && RS.anaParamsChanged();
      } catch (e) { RS.toast('Laden fehlgeschlagen: ' + e.message, 'err', 8000); }
    };
    fi.click();
  }
  RS.openParamEditor = openEditor;

  // ------------------------------------------------------------------ Methodik: Parametertabelle
  RS.paramReference = async box => {
    try { await ensureSpec(); } catch { box.innerHTML = '<p class="muted small">Die Tabelle erscheint, sobald der Rechenkern geladen ist.</p>'; return; }
    box.innerHTML = '';
    const t = h('table', { class: 't' }, h('tr', {}, ['Gruppe', 'Parameter', 'Schlüssel', 'Standard', 'Bereich', 'Beleg'].map(x => h('th', {}, x))));
    PM.spec.forEach(sp => t.append(h('tr', {}, h('td', { class: 'tiny' }, sp.group), h('td', {}, sp.label, sp.help ? h('div', { class: 'hint' }, sp.help) : ''), h('td', { class: 'mono tiny' }, sp.key),
      h('td', { class: 'n' }, fmt(sp.default) + (sp.unit && sp.unit !== '–' ? ' ' + sp.unit : '')), h('td', { class: 'tiny' }, sp.choices ? sp.choices.join(' / ') : sp.min != null ? `${num(sp.min, 4)} … ${num(sp.max, 6)}` : '–'),
      h('td', { html: RS.cite(...sp.cites) }))));
    box.append(h('div', { class: 'tablewrap', style: 'max-height:none' }, t));
  };

  // ------------------------------------------------------------------ Validierung: k-Raster + eigene Bilder
  const pairs = []; let pairCounter = 0, lastOwn = null;
  const stem = n => n.replace(/\.[^.]+$/, '').toLowerCase();
  const MASK_RE = /[_\-\s]?(mask|maske|gt|groundtruth|label|annotation)$/i;
  const maskStem = n => stem(n).replace(MASK_RE, '');
  const isMaskName = n => /[_\-\s](mask|maske|gt|groundtruth|label|annotation)$/i.test(stem(n));
  const IMG_EXT = /\.(tiff?|png|jpe?g|bmp)$/i, isTif = n => /\.tiff?$/i.test(n);
  const list = a => a.length > 4 ? a.slice(0, 4).join(', ') + ` … (+${a.length - 4})` : a.join(', ');

  // Paarung robust: Masken werden am Zusatz (_maske, _mask, _gt …) auch im Feld „Aufnahmen“ erkannt,
  // Dateien ohne Bildendung (PDF, CSV …) werden ignoriert, und liegt dieselbe Aufnahme als TIF und PNG vor,
  // zählt die TIF-Datei (sonst würde das Bild doppelt gewertet).
  async function addValFiles(imgFiles, maskFiles) {
    const sel = [...Array.from(imgFiles).map(f => [f, false]), ...Array.from(maskFiles).map(f => [f, true])];
    const masks = new Map(), imgs = new Map(), dup = [], ignored = [];
    for (const [f, fromMaskField] of sel) {
      if (!IMG_EXT.test(f.name)) { ignored.push(f.name); continue; }
      if (fromMaskField || isMaskName(f.name)) { masks.set(maskStem(f.name), f); continue; }
      const s = stem(f.name), prev = imgs.get(s);
      if (!prev) { imgs.set(s, f); continue; }
      if (prev.name === f.name) continue;
      if (isTif(f.name) && !isTif(prev.name)) { dup.push(prev.name); imgs.set(s, f); } else dup.push(f.name);
    }
    const missing = [], used = new Set();
    let ok = 0, neg = 0;
    for (const [s, f] of [...imgs].sort((a, b) => a[0].localeCompare(b[0], 'de', { numeric: true }))) {
      const m = masks.get(s) || masks.get(maskStem(f.name));
      if (!m) { missing.push(f.name); continue; }
      used.add(m);
      if (pairs.some(p => p.name === f.name && p.mask === m.name)) continue;
      const key = 'vp' + (++pairCounter);
      try {
        const info = JSON.parse(await RS.call('put_val_pair', key, f.name, new Uint8Array(await f.arrayBuffer()), m.name, new Uint8Array(await m.arrayBuffer())));
        pairs.push({ key, name: f.name, mask: m.name, info, holdout: false }); ok++;
        if (info.rissfrei) neg++;
      } catch (e) { RS.toast(f.name + ': ' + e.message, 'err', 9000); }
    }
    const orphan = [...masks.values()].filter(m => !used.has(m)).map(m => m.name);
    if (!imgs.size) RS.toast('Keine Aufnahmen erkannt. Feld 1: Bilder (z. B. 02_einfach.tif), Feld 2: Masken (z. B. 02_einfach_maske.png).', 'warn', 9000);
    if (missing.length) RS.toast('Keine Maske gefunden zu: ' + list(missing) + ' (Maske gleich benannt oder mit Zusatz _maske/_mask).', 'warn', 9000);
    if (orphan.length && imgs.size) RS.toast('Masken ohne passende Aufnahme: ' + list(orphan) + '.', 'warn', 9000);
    if (dup.length) RS.toast('Gleiche Aufnahme als TIF und PNG – übersprungen: ' + list(dup) + ' (es zählt jeweils die TIF-Datei).', 'info', 8000);
    // Vorschlag: jedes dritte Bild mit Rissen als Holdout (rissfreie Bilder prüfen nur Fehlalarme)
    const pos = pairs.filter(p => !p.info.rissfrei);
    if (pos.length >= 3) pos.forEach((p, i) => { if (p.holdoutSet === undefined) { p.holdout = (i % 3 === 2); p.holdoutSet = true; } });
    renderPairs();
    if (ok) RS.toast(`${ok} Referenzpaar(e) geladen` + (neg ? `, davon ${neg} rissfrei (leere Maske → Fehlalarm-Prüfung)` : '') + '.', 'ok', 6000);
  }
  RS.addValFiles = (i, m) => addValFiles(i, m);
  function renderPairs() {
    const box = $('#own-pairs'); if (!box) return;
    box.innerHTML = '';
    if (!pairs.length) { box.append(h('p', { class: 'small muted' }, 'Noch keine Referenzpaare.')); $('#own-run').disabled = true; return; }
    const t = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Aufnahme'), h('th', {}, 'Maske'), h('th', { class: 'n' }, 'Größe'), h('th', { class: 'n' }, 'Riss-Anteil'), h('th', {}, 'Holdout'), h('th', {})));
    pairs.forEach((p, i) => t.append(h('tr', {}, h('td', { class: 'tiny' }, p.name), h('td', { class: 'tiny' }, p.mask), h('td', { class: 'n tiny' }, `${p.info.width}×${p.info.height}`), h('td', { class: 'n' }, p.info.rissfrei ? '0 % (rissfrei)' : num(p.info.gt_fraction_pct, 3) + ' %'),
      h('td', {}, p.info.rissfrei ? h('span', { class: 'tiny muted', title: 'Rissfreie Bilder gehen nicht in F1 ein, sie prüfen Fehlalarme.' }, '–') : h('input', { type: 'checkbox', checked: p.holdout, onchange: e => { p.holdout = e.target.checked; } })),
      h('td', {}, h('button', { class: 'btn sm', type: 'button', onclick: () => { RS.call('remove_val_pair', p.key).catch(() => { }); pairs.splice(i, 1); renderPairs(); } }, '✕')))));
    box.append(h('div', { class: 'tablewrap' }, t));
    $('#own-run').disabled = false;
  }
  const parseList = s => s.split(/[;\s]+/).map(x => parseFloat(x.replace(',', '.'))).filter(Number.isFinite);

  async function runOwn() {
    const out = $('#own-out'); const btn = $('#own-run');
    btn.disabled = true; out.innerHTML = '<p class="small muted">Validierung läuft …</p>';
    try {
      await ensureSpec();
      const algs = $$('input[name=own-alg]:checked').map(x => x.value);
      const kl = parseList($('#own-k').value);
      if (!algs.length || !kl.length) throw new Error('Mindestens ein Verfahren und ein k-Wert.');
      const r = await RS.callJSON('own_validation', JSON.stringify(pairs.map(p => p.key)),
        JSON.stringify({ algorithms: algs, k_list: kl, min_area: +$('#own-amin').value || 16, polarity: $('#own-pol').value, holdout: pairs.filter(p => p.holdout && !p.info.rissfrei).map(p => p.key) }),
        RS.methodParamsJSON());
      lastOwn = r; renderOwn(r);
    } catch (e) { out.innerHTML = ''; out.append(h('div', { class: 'callout warn small' }, e.message)); }
    finally { btn.disabled = false; }
  }
  function renderOwn(r) {
    const out = $('#own-out'); out.innerHTML = '';
    const card = h('div', { class: 'card' }, h('h3', {}, `Ergebnis eigene Validierung (${num(r.runtime_s, 3)} s)`));
    card.append(h('p', { class: 'small' }, `${new Set(r.rows.map(x => x.key)).size} Bildpaare · k ∈ {${r.k_list.map(k => num(k, 3)).join('; ')}} · A_min = ${r.min_area} px² · Parametersatz ${r.method_params_hash}${r.method_params_changed.length ? ' (abweichend: ' + r.method_params_changed.join(', ') + ')' : ' (Standard)'}`));
    const t = h('table', { class: 't' }, h('tr', {}, ['Verfahren', 'k gewählt', 'F1 Entw.', 'Prec. Entw.', 'Rec. Entw.', 'L-Fehler Entw.', 'F1 Holdout', 'L-Fehler Holdout'].map(x => h('th', { class: x === 'Verfahren' ? '' : 'n' }, x))));
    for (const [a, s] of Object.entries(r.scores)) t.append(h('tr', {}, h('td', {}, a === 'rissoptimiert' ? 'Präzise' : 'Schnell'), h('td', { class: 'n' }, num(s.k, 3) + (s.k_am_rand ? ' ⚠' : '')),
      ...[s.dev_f1, s.dev_precision, s.dev_recall].map(x => h('td', { class: 'n' }, num(x, 4))), h('td', { class: 'n' }, s.dev_length_error_pct == null ? '–' : num(s.dev_length_error_pct, 3) + ' %'),
      h('td', { class: 'n' }, s.holdout_n ? num(s.holdout_f1, 4) : '–'), h('td', { class: 'n' }, s.holdout_n && s.holdout_length_error_pct != null ? num(s.holdout_length_error_pct, 3) + ' %' : '–')));
    card.append(t);
    if (Object.values(r.scores).some(s => s.rissfrei_n)) card.append(h('p', { class: 'small' }, 'Rissfreie Bilder (leere Maske, gehen nicht in F1 ein) – Fehlalarme beim gewählten k: ' +
      Object.entries(r.scores).map(([a, s]) => `${a === 'rissoptimiert' ? 'Präzise' : 'Schnell'} ${num(s.rissfrei_fehlalarm_laenge_px, 3)} px Risslänge (${num(s.rissfrei_fehlalarm_px, 3)} Pixel)`).join(' · ') +
      ` bei ${Object.values(r.scores)[0].rissfrei_n} Bild(ern). Ideal ist 0. Bewertet wird die Segmentierung vor dem Winkelkriterium: Eine Riefe parallel zur Dehnung erscheint hier rot, zählt in L_A,⊥ aber nicht mit.`));
    if (Object.values(r.scores).some(s => s.k_am_rand)) card.append(h('div', { class: 'callout warn small' }, '⚠ Das gewählte k liegt am Rand der geprüften Werte – das Optimum kann außerhalb liegen. k-Liste erweitern.'));
    if (!Object.values(r.scores).some(s => s.holdout_n)) card.append(h('div', { class: 'callout warn small' }, 'Ohne Holdout-Bilder ist der F1-Wert optimistisch: k wurde auf denselben Bildern gewählt und bewertet. Für eine belastbare Aussage einige Paare als Holdout markieren.'));
    for (const [a, s] of Object.entries(r.scores)) {
      card.append(h('h4', { style: 'margin-top:12px' }, (a === 'rissoptimiert' ? 'Präzise' : 'Schnell') + ': mittlerer F1 (Entwicklung) über k'));
      card.append(RS.svgLine(s.f1_kurve.map(x => x[0]), s.f1_kurve.map(x => x[1]), 'k', 'F1', [0, 1]));
    }
    for (const [a, ims] of Object.entries(r.images)) {
      const g = h('div', { class: 'grid g2', style: 'margin-top:8px' });
      ims.forEach(im => g.append(h('figure', { style: 'margin:0' }, h('img', { class: 'stageimg', src: 'data:image/png;base64,' + im.png, alt: im.name }), h('figcaption', { class: 'tiny muted' }, `${im.name} (${im.rolle}) · ${a} · k = ${num(r.scores[a].k, 3)} · grün richtig, rot falsch positiv, blau übersehen`))));
      card.append(g);
    }
    card.append(h('div', { class: 'btnrow', style: 'margin-top:10px' },
      h('button', { class: 'btn', type: 'button', onclick: async () => { try { await RS.download('validierung_eigene_bilder.zip', await RS.call('own_validation_files'), 'application/zip'); } catch (e) { RS.toast(e.message, 'err'); } } }, '⬇ Ergebnisse (CSV, JSON, Overlays)'),
      h('button', { class: 'btn', type: 'button', onclick: () => { const a = Object.keys(r.scores)[0]; $('#p-alg').value = a; $('#p-k').value = r.scores[a].k; $('#p-k').dispatchEvent(new Event('input')); $('#p-amin').value = r.min_area; RS.anaParamsChanged && RS.anaParamsChanged(); RS.toast(`Analyse: ${a}, k = ${num(r.scores[a].k, 3)} übernommen.`, 'ok'); } }, 'k des ersten Verfahrens für die Analyse übernehmen')));
    card.append(h('p', { class: 'tiny muted', html: r.hinweis + ' Erklärung der Werte: oben unter „Was bedeuten die Werte?“. Metriken ' + RS.cite('Q14', 'R08') + '. Die Aussagekraft hängt von der Qualität der Masken ab: Masken unabhängig vom Programm zeichnen (nicht die Programmmaske korrigieren).' }));
    out.append(card);
  }

  function valUI() {
    const host = $('#val-extra'); if (!host || host.childElementCount) return;
    const kr = h('input', { type: 'text', id: 'val-k-r', value: '0,5; 0,75; 1; 1,25; 1,5' }), kf = h('input', { type: 'text', id: 'val-k-f', value: '0,35; 0,6; 1; 1,3' });
    const usep = h('input', { type: 'checkbox', id: 'val-use-mp', checked: true });
    host.append(h('details', { class: 'box' }, h('summary', {}, 'Einstellungen der synthetischen Validierung'),
      h('div', { class: 'row2' }, h('div', {}, h('label', { class: 'f' }, 'k-Werte „Präzise“'), kr), h('div', {}, h('label', { class: 'f' }, 'k-Werte „Schnell“'), kf)),
      h('label', { class: 'chk' }, usep, 'Aktuelle Methodenparameter verwenden (sonst Programmstandard)'),
      h('p', { class: 'hint' }, 'Standard wie in 2.4. Liegt das gewählte k am Rand, das Raster erweitern (z. B. 0,2; 0,25; 0,35 …).')));
    host.prepend(h('details', { class: 'box', id: 'val-werte' }, h('summary', {}, 'ℹ Was bedeuten die Werte? (Precision, Recall, F1, Längenfehler, Holdout)'),
      h('div', { class: 'small', html:
        '<p><b>Grundlage ist ein Pixelvergleich</b> der Programmmaske mit der Sollmaske, ohne Toleranz. Jedes Pixel fällt in eine Klasse: ' +
        '<b style="color:#1e9e52">TP</b> (grün) = Riss laut Soll und Programm · <b style="color:#d63c3c">FP</b> (rot) = vom Programm markiert, laut Soll kein Riss (Fehlalarm) · ' +
        '<b style="color:#3c78f0">FN</b> (blau) = Sollriss, vom Programm übersehen.</p>' +
        '<table class="t"><tr><th>Wert</th><th>Formel</th><th>Bedeutung</th></tr>' +
        '<tr><td><b>Precision</b></td><td class="mono tiny" style="white-space:nowrap">TP / (TP + FP)</td><td>Welcher Anteil des als Riss Markierten ist wirklich Riss? Niedrig bei Fehlalarmen oder zu breit gezeichneten Rissen.</td></tr>' +
        '<tr><td><b>Recall</b></td><td class="mono tiny" style="white-space:nowrap">TP / (TP + FN)</td><td>Welcher Anteil der Sollrisse wurde gefunden? Niedrig bei übersehenen oder zu schmal gezeichneten Rissen.</td></tr>' +
        '<tr><td><b>F1</b></td><td class="mono tiny" style="white-space:nowrap">2·TP / (2·TP + FP + FN)</td><td>Fasst Precision und Recall zusammen (harmonisches Mittel): 1 = deckungsgleich, 0 = keine Übereinstimmung. Danach wird k gewählt.</td></tr>' +
        '<tr><td><b>Längenfehler</b></td><td class="mono tiny" style="white-space:nowrap">(L<sub>Programm</sub> / L<sub>Soll</sub> − 1) · 100 %</td><td>Vergleich der Gesamtlänge der Skelettlinien beider Masken. Plus = zu lang (Fehlalarme, Verzweigungen), minus = zu kurz (Lücken, Übersehenes). Maßgeblich für L<sub>A</sub>, das aus der Länge berechnet wird.</td></tr>' +
        '<tr><td>IoU (nur Export)</td><td class="mono tiny" style="white-space:nowrap">TP / (TP + FP + FN)</td><td>Überlappung; strenger als F1.</td></tr></table>' +
        '<p><b>k gewählt:</b> das k mit dem höchsten mittleren F1 auf den Entwicklungsbildern. ⚠ = k liegt am Rand der geprüften Werte, das Optimum kann außerhalb liegen. ' +
        '<b>Entwicklung / Holdout:</b> k wird nur an den Entwicklungsbildern gewählt; die zurückgehaltenen Holdout-Bilder zeigen, ob dieses k auch auf unbekannten Bildern trägt. Der Holdout-Wert ist der belastbare, der Entwicklungswert ist optimistisch. ' +
        '<b>Mittelwerte</b> sind arithmetisch je Bild: Jedes Bild zählt gleich, unabhängig von seiner Rissmenge. ' +
        '<b>F1-Kurve über k:</b> Ein flaches Plateau bedeutet, dass das Ergebnis wenig von k abhängt. ' +
        '<b>Rissfreie Bilder</b> (leere Maske): F1 ist dort nicht definiert; angezeigt werden Fehlalarm-Pixel und Fehlalarm-Länge, ideal ist 0.</p>' +
        '<p><b>Einordnung:</b> Weil ohne Toleranz verglichen wird, senkt schon 1 px Breitenunterschied am Rissrand Precision oder Recall, obwohl der Riss richtig gefunden wurde. ' +
        'Beispiel Testbild 02, präzises Verfahren, k = 1: Precision 0,99 und Recall 0,74 (Maske schmaler als die Sollmaske, F1 = 0,85), Längenfehler aber nur +0,3 %. ' +
        'Für L<sub>A</sub> ist deshalb der Längenfehler aussagekräftiger als F1. Bewertet wird die Erkennung vor dem Winkelkriterium: Riefen oder Kratzer parallel bzw. schräg zur Dehnung zählen hier als Fehlalarm, in L<sub>A,⊥</sub> aber nicht. ' + RS.cite('Q14', 'R08') + '</p>' })));
    RS.valOptions = () => ({ k_grid: { rissoptimiert: parseList(kr.value), erweitert: parseList(kf.value) }, params: usep.checked ? RS.methodParamsJSON() : null });

    const own = h('div', { class: 'card', style: 'margin-top:16px' });
    own.append(h('h2', {}, 'Validierung mit eigenen Aufnahmen'),
      h('p', { class: 'small', html: 'Der wissenschaftlich entscheidende Schritt: Lade eigene Mikroskopaufnahmen zusammen mit <b>von Hand gezeichneten Rissmasken</b> (gleiche Pixelgröße; Risse weiß, Hintergrund schwarz; z. B. in GIMP, Fiji/ImageJ oder Paint als neue Ebene gezeichnet). RubberScope bestimmt für jedes k Precision, Recall, F1 und Längenfehler, wählt k auf den Entwicklungsbildern und prüft es an den Holdout-Bildern ' + RS.cite('Q14', 'R08') + '.' }),
      h('p', { class: 'tiny muted' }, 'Dateinamen: Maske gleich benannt wie die Aufnahme oder mit Zusatz _maske / _mask / _gt (z. B. probe1.tif und probe1_maske.png). Mit Zusatz dürfen Aufnahmen und Masken auch zusammen in Feld 1 gewählt werden. Liegt dieselbe Aufnahme als TIF und PNG vor, zählt die TIF. Eine komplett schwarze Maske gilt als rissfreie Referenz und prüft Fehlalarme. Die Dateien bleiben im Browser.'));
    const fiI = h('input', { type: 'file', multiple: true, accept: 'image/*,.tif,.tiff', id: 'own-imgs' }), fiM = h('input', { type: 'file', multiple: true, accept: 'image/*,.tif,.tiff', id: 'own-masks' });
    own.append(h('div', { class: 'row2' }, h('div', {}, h('label', { class: 'f' }, '1. Aufnahmen'), fiI), h('div', {}, h('label', { class: 'f' }, '2. Masken'), fiM)),
      h('div', { class: 'btnrow', style: 'margin-top:6px' }, h('button', { class: 'btn', type: 'button', onclick: async () => { if (!fiI.files.length && !fiM.files.length) return RS.toast('Bitte Aufnahmen und Masken wählen.', 'warn'); await addValFiles(fiI.files, fiM.files); fiI.value = ''; fiM.value = ''; } }, 'Paare hinzufügen')),
      h('div', { id: 'own-pairs', style: 'margin-top:8px' }),
      h('div', { class: 'row2', style: 'margin-top:8px' },
        h('div', {}, h('label', { class: 'f' }, 'k-Werte'), h('input', { type: 'text', id: 'own-k', value: '0,35; 0,5; 0,75; 1; 1,25; 1,5; 2' })),
        h('div', {}, h('label', { class: 'f' }, 'A_min [px²]'), h('input', { type: 'number', id: 'own-amin', value: 16, min: 1 }))),
      h('div', { class: 'row2' },
        h('div', {}, h('label', { class: 'f' }, 'Polarität'), h('select', { id: 'own-pol' }, h('option', { value: 'dunkel' }, 'Risse dunkel'), h('option', { value: 'hell' }, 'Risse hell'))),
        h('div', {}, h('label', { class: 'f' }, 'Verfahren'), h('label', { class: 'chk' }, h('input', { type: 'checkbox', name: 'own-alg', value: 'rissoptimiert', checked: true }), 'Präzise'), h('label', { class: 'chk' }, h('input', { type: 'checkbox', name: 'own-alg', value: 'erweitert', checked: true }), 'Schnell'))),
      h('p', { class: 'hint' }, 'Es werden die aktuell eingestellten Methodenparameter verwendet (Analyse → Methodenparameter).'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', type: 'button', id: 'own-run', disabled: true, onclick: runOwn }, '▶ Eigene Validierung starten')),
      h('div', { id: 'own-out', style: 'margin-top:12px' }));
    host.append(own);
    renderPairs();
  }

  RS.paramsInit = () => {
    updateBadge();
    RS.onEngine(e => { if (e.state === 'ready') ensureSpec().catch(err => console.error(err)); });
  };
  RS.valUI = valUI;
})();
