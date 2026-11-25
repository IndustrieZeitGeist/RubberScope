/* RubberScope Web – Start, Validierungsseite, Hilfe, Initialisierung */
'use strict';
(() => {
  const RS = window.RS, $ = RS.$, $$ = RS.$$, h = RS.h, num = RS.num;

  function renderCites(root = document) {
    $$('[data-cite]', root).forEach(el => { el.outerHTML = RS.cite(...el.dataset.cite.split(',').map(s => s.trim())); });
  }

  // ------------------------------------------------------------------ Animation Startseite
  function hero() {
    const c = $('#hero-canvas'); if (!c) return;
    const g = c.getContext('2d'), W = c.width, H = c.height;
    let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cracks = Array.from({ length: 9 }, (_, k) => {
      const x0 = 40 + k * 55 + rnd() * 20, y0 = 30 + rnd() * 90, n = 10 + Math.floor(rnd() * 14), ph = rnd() * 6;
      return Array.from({ length: n }, (_, t) => [x0 + 5 * Math.sin(t / 3 + ph), y0 + t * 10]);
    });
    const riefe = [[20, 300], [540, 292]];
    let t0 = null;
    function frame(ts) {
      if (!c.isConnected) return;
      if (t0 === null) t0 = ts;
      const t = ((ts - t0) / 1000) % 9;
      const grd = g.createLinearGradient(0, 0, W, 0); grd.addColorStop(0, '#5b6870'); grd.addColorStop(1, '#8e9ca4');
      g.fillStyle = grd; g.fillRect(0, 0, W, H);
      const grow = Math.min(1, t / 3);
      g.lineCap = 'round';
      const drawPath = (pts, frac, col, w) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); const m = Math.max(2, Math.floor(pts.length * frac)); pts.slice(0, m).forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
      cracks.forEach(p => drawPath(p, grow, '#2a3237', 2.6));
      drawPath(riefe, 1, 'rgba(40,48,52,.7)', 2);
      if (t > 3.6) {
        const sweep = Math.min(1, (t - 3.6) / 1.6) * W;
        g.save(); g.beginPath(); g.rect(0, 0, sweep, H); g.clip();
        cracks.forEach(p => drawPath(p, 1, '#10e0cf', 3.2));
        g.restore();
        g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sweep, 0); g.lineTo(sweep, H); g.stroke();
      }
      if (t > 5.4) {
        g.setLineDash([6, 4]); drawPath(riefe, 1, '#ff9f1c', 2); g.setLineDash([]);
        g.fillStyle = '#ff9f1c'; g.font = '600 12px Inter,sans-serif'; g.fillText('Riefe ∥ Dehnung → nicht quer', 330, 284);
        g.fillStyle = '#10e0cf'; g.fillText('Risse ⊥ Dehnung', 20, 22);
      }
      g.strokeStyle = '#ffd34d'; g.fillStyle = '#ffd34d'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(W - 120, 22); g.lineTo(W - 30, 22); g.stroke();
      g.beginPath(); g.moveTo(W - 22, 22); g.lineTo(W - 32, 16); g.lineTo(W - 32, 28); g.fill();
      g.beginPath(); g.moveTo(W - 128, 22); g.lineTo(W - 118, 16); g.lineTo(W - 118, 28); g.fill();
      g.font = '600 11px Inter,sans-serif'; g.fillText('Dehnrichtung', W - 112, 40);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ Validierung
  let valDone = false;
  async function runValidation() {
    const out = $('#val-out'), btn = $('#val-run');
    btn.disabled = true;
    out.innerHTML = '<div class="card"><div class="spinner" style="border-color:var(--line);border-top-color:var(--accent)"></div><p class="small muted" style="text-align:center">Validierung läuft im Browser (6 Bilder × 9 Parameterkombinationen) …</p></div>';
    try {
      const vo = RS.valOptions ? RS.valOptions() : { k_grid: null, params: null };
      const r = await RS.callJSON('validation', JSON.stringify(vo.k_grid), vo.params);
      valDone = true; $('#val-pdf').disabled = false;
      const sc = r.scores;
      out.innerHTML = '';
      const card = h('div', { class: 'card' });
      card.append(h('h3', {}, `Ergebnis (${num(r.runtime_s, 3)} s)`));
      const t = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Verfahren'), h('th', { class: 'n' }, 'k gewählt'), h('th', { class: 'n' }, 'F1 Entwicklung (1–4)'), h('th', { class: 'n' }, 'F1 Holdout (5–6)'), h('th', { class: 'n' }, 'Längenfehler Holdout')));
      for (const [alg, s] of Object.entries(sc)) t.append(h('tr', {}, h('td', {}, alg === 'rissoptimiert' ? 'Präzise · Mehrskalen' : 'Schnell · Weber'), h('td', { class: 'n' }, num(s.sensitivity, 3)), h('td', { class: 'n' }, num(s.development_f1, 4)), h('td', { class: 'n' }, num(s.holdout_f1, 4)), h('td', { class: 'n' }, (s.holdout_length_error_pct > 0 ? '+' : '') + num(s.holdout_length_error_pct, 3) + ' %')));
      card.append(t);
      card.append(h('p', { class: 'tiny muted' }, 'Geprüfte k: ' + Object.entries(r.k_grid).map(([a, g]) => `${a}: ${g.map(x => num(x, 3)).join('; ')}`).join(' · ') + ` · Methodenparameter: Satz ${r.method_params_hash}` + (r.method_params_changed.length ? ` (abweichend: ${r.method_params_changed.join(', ')})` : ' (Standard)')));
      const edge = Object.entries(r.k_at_grid_edge || {}).filter(([, e]) => e).map(([a]) => a);
      if (edge.length) card.append(h('div', { class: 'callout warn small' }, `⚠ Gewähltes k liegt am Rand des Rasters (${edge.join(', ')}) – das Optimum kann außerhalb liegen. Raster unter „Einstellungen“ erweitern.`));
      const imgs = h('div', { class: 'grid g2', style: 'margin-top:12px' });
      for (const [name, b64] of Object.entries(r.images)) imgs.append(h('figure', { style: 'margin:0' }, h('img', { class: 'stageimg', src: 'data:image/png;base64,' + b64, alt: name }), h('figcaption', { class: 'tiny muted' }, `${name}${name.endsWith('05') ? ' (Holdout)' : ' (Entwicklung)'} · grün richtig, rot falsch positiv, blau übersehen · Präzisionsverfahren, k = ${num(sc.rissoptimiert.sensitivity, 3)}`)));
      card.append(imgs);
      // Detailtabelle
      const det = h('details', { class: 'box' }, h('summary', {}, 'Alle 54 Einzelergebnisse'));
      const dt = h('table', { class: 't' }, h('tr', {}, ['Bild', 'Verfahren', 'k', 'Precision', 'Recall', 'F1', 'L-Fehler %'].map(x => h('th', {}, x))));
      r.detail.forEach(d => dt.append(h('tr', {}, h('td', {}, d.image), h('td', {}, d.algorithm), h('td', { class: 'n' }, num(d.sensitivity, 3)), h('td', { class: 'n' }, num(d.precision, 4)), h('td', { class: 'n' }, num(d.recall, 4)), h('td', { class: 'n' }, num(d.f1, 4)), h('td', { class: 'n' }, num(d.length_error_pct, 3)))));
      det.append(h('div', { class: 'tablewrap' }, dt));
      card.append(det);
      card.append(h('div', { class: 'callout small', html: '<b>Einordnung:</b> Mit dem Standardraster liegt das gewählte k bei beiden Verfahren am unteren Rand; mit erweitertem Raster bleibt k = 0,5 beim präzisen Verfahren optimal. Beim schnellen Verfahren mit k = 1 erkennt das Programm alle Risspixel (Recall 1,0), zeichnet sie aber breiter (Precision ≈ 0,6), bei Längenfehlern unter 3 %. Länge und L<sub>A</sub> sind dort also verlässlicher als Breite und φ. ' + RS.cite('Q14', 'R08') }));
      out.append(card);
    } catch (e) { out.innerHTML = ''; out.append(h('div', { class: 'callout warn' }, 'Fehler: ' + e.message)); }
    finally { btn.disabled = false; }
  }
  async function runSelftest() {
    const out = $('#val-out');
    const box = h('div', { class: 'card', style: 'margin-top:12px' }, h('p', { class: 'small muted' }, 'Systemtest läuft …'));
    out.prepend(box);
    try {
      const r = await RS.callJSON('run_selftest');
      const ok = r.frangi.ok;
      box.innerHTML = '';
      box.append(h('h3', {}, (ok ? '✅' : '❌') + ` Systemtest ${ok ? 'bestanden' : 'FEHLGESCHLAGEN'} (${num(r.runtime_s, 3)} s)`));
      box.append(h('p', { class: 'small' }, `Frangi schnell vs. scikit-image: max. Abweichung ${r.frangi.max_abs_diff.toExponential(1)}, Schwellen-Umkippungen ${r.frangi.threshold_flips}. Validierung: F1 Holdout ${num(r.validation.rissoptimiert.holdout_f1, 4)} (präzise) / ${num(r.validation.erweitert.holdout_f1, 4)} (schnell).`));
      const t = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Demobild'), h('th', { class: 'n' }, 'Objekte'), h('th', { class: 'n' }, 'φ [%]'), h('th', { class: 'n' }, 'L_A [mm/mm²]')));
      r.demo.forEach(d => t.append(h('tr', {}, h('td', { class: 'tiny' }, d.name), h('td', { class: 'n' }, d.n), h('td', { class: 'n' }, num(d.phi)), h('td', { class: 'n' }, num(d.LA)))));
      box.append(t);
      box.append(h('p', { class: 'tiny muted' }, 'Referenzwerte der Desktop-Version 2.4 (Programmstandard): B_ohne_Schutzmittel_gealtert_1 → 8 Objekte, L_A = 5,1059 mm/mm². Gleiche Zahlen = gleicher Rechenkern. Der Systemtest rechnet immer mit Standardparametern.'));
    } catch (e) { box.innerHTML = ''; box.append(h('div', { class: 'callout warn' }, 'Fehler: ' + e.message)); }
  }

  // ------------------------------------------------------------------ Hilfe: Quellcode, Version
  function helpExtras() {
    const box = $('#src-dl'); if (!box || box.childElementCount) return;
    for (const f of ['rubberscope_engine.py', 'rubberscope_berichte.py', 'web_api.py']) {
      box.append(h('button', {
        class: 'btn sm', type: 'button', onclick: async () => {
          try { const txt = await RS.sourceFile(f); await RS.download(f.replace('.py', '.txt'), txt, 'text/plain'); }
          catch (e) { RS.toast(e.message, 'err'); }
        }
      }, '⬇ ' + f));
    }
    box.append(h('p', { class: 'tiny muted', style: 'flex-basis:100%;margin:4px 0 0' }, 'Wird als .txt gespeichert (Browser-Vorgabe) – nach dem Download in .py umbenennen.'));
  }
  function envInfo() {
    const e = RS.engine.info; const p = $('#env-info'); if (!p || !e) return;
    p.innerHTML = Object.entries(e.env).map(([k, v]) => `${RS.esc(k)}: <b>${RS.esc(v)}</b>`).join(' · ') + ` · Pyodide ${RS.PYODIDE_VERSION}` +
      `<br>Frangi-Selbstprüfung beim Start: max. Abweichung ${e.frangi_check.max_abs_diff.toExponential(1)}, ${e.frangi_check.threshold_flips} Umkippungen → ${e.frangi_check.ok ? 'OK' : 'FEHLER'}`;
  }

  RS.routes.methodik = () => { const m = $('#methodik-content'); if (!m.childElementCount) { m.innerHTML = RS.METHODIK(); } RS.paramReference($('#param-ref')); };
  RS.routes.hilfe = () => { const m = $('#hilfe-content'); if (!m.childElementCount) { m.innerHTML = RS.HILFE(); helpExtras(); } envInfo(); };
  RS.routes.validierung = () => { RS.loadEngine().catch(() => { }); RS.valUI(); RS.testbilder && RS.testbilder(); };
  RS.routes.start = () => { };

  document.addEventListener('DOMContentLoaded', () => {
    renderCites();
    hero();
    $('#start-video').onclick = () => RS.startVideo(0);
    $('#val-run').onclick = runValidation;
    $('#selftest-run').onclick = runSelftest;
    $('#val-pdf').onclick = async () => { try { await RS.download('validierungsprotokoll_synthetisch.pdf', await RS.call('validation_pdf'), 'application/pdf'); } catch (e) { RS.toast(e.message, 'err'); } };
    $('#engine-badge').onclick = () => {
      if (RS.engine.state === 'idle' || RS.engine.state === 'error') { RS.loadEngine().catch(e => RS.toast(e.message, 'err', 9000)); return; }
      const e = RS.engine.info;
      RS.dialog('Rechenkern', e ? `<p class="small">${Object.entries(e.env).map(([k, v]) => `${RS.esc(k)}: <b>${RS.esc(v)}</b>`).join('<br>')}</p><p class="small">Frangi-Selbstprüfung: ${e.frangi_check.ok ? '✅ identisch zu scikit-image' : '❌ Abweichung'}</p>` : `<p>${RS.esc(RS.engine.text)}</p>`);
    };
    RS.onEngine(e => { if (e.state === 'ready') envInfo(); if (e.state === 'error') RS.toast(e.text, 'err', 10000); });
    RS.startRouter();
    // Rechenkern im Hintergrund vorladen, sobald die Seite steht
    if (!(navigator.connection && navigator.connection.saveData)) setTimeout(() => RS.loadEngine().catch(() => { }), 1500);
  });
})();
