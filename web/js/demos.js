/* RubberScope Web – interaktive Experimente des Lernpfads (reines JavaScript, sofort verfügbar) */
'use strict';
(() => {
  const RS = window.RS, h = RS.h, num = RS.num;
  const D = RS.DEMOS = {};

  function slider(label, min, max, step, val, fmt = v => num(v, 3)) {
    const out = h('output', {}, fmt(val));
    const inp = h('input', { type: 'range', min, max, step, value: val, 'aria-label': label });
    inp.addEventListener('input', () => out.textContent = fmt(+inp.value));
    return { row: [h('span', {}, label), inp, out], inp, get v() { return +inp.value; } };
  }
  function canvas(w, hgt) { const c = h('canvas', { width: w, height: hgt }); return [c, c.getContext('2d')]; }
  function frame(title, ...kids) { return h('div', { class: 'demo' }, h('div', { class: 'small', style: 'font-weight:600;margin-bottom:6px' }, '🧪 ' + title), ...kids); }
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // ------------------------------------------------------------------ 1 Dehnung (schematisch)
  D.strain = () => {
    const [c, g] = canvas(520, 260);
    const s1 = slider('Dehnung ε', 0, 40, 1, 20, v => v + ' %'), s2 = slider('Ozon-Expositionszeit', 0, 100, 1, 60, v => v + ' %');
    const ro = h('div', { class: 'readout' });
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const seeds = Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd(), l: rnd(), a: (rnd() - .5) * .35, t: rnd() }));
    function draw() {
      const eps = s1.v / 100, t = s2.v / 100, W = 520, H = 260;
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, H);
      const sw = 300 * (1 + eps), sh = 140 / Math.sqrt(1 + eps), x0 = (W - sw) / 2, y0 = (H - sh) / 2;
      g.fillStyle = '#3d4a52'; g.fillRect(x0, y0, sw, sh);
      g.fillStyle = '#56636b'; g.fillRect(x0 - 22, y0 - 10, 22, sh + 20); g.fillRect(x0 + sw, y0 - 10, 22, sh + 20);
      const crit = 0.05;
      let n = 0;
      if (eps > crit) {
        const dens = Math.min(1, (eps - crit) * 4) * t;
        for (const s of seeds) {
          if (s.t > dens) continue;
          n++;
          const cx = x0 + 10 + s.x * (sw - 20), cy = y0 + 8 + s.y * (sh - 16);
          const len = (6 + s.l * 22) * Math.min(1.6, .4 + t + eps), wid = 0.8 + eps * 4 * t;
          g.strokeStyle = '#0a0f12'; g.lineWidth = wid; g.lineCap = 'round';
          g.beginPath(); g.moveTo(cx - Math.sin(s.a) * len / 2, cy - Math.cos(s.a) * len / 2); g.lineTo(cx + Math.sin(s.a) * len / 2, cy + Math.cos(s.a) * len / 2); g.stroke();
        }
      }
      g.strokeStyle = '#ffd34d'; g.fillStyle = '#ffd34d'; g.lineWidth = 2.5;
      for (const [a, b] of [[x0 - 30, x0 - 70], [x0 + sw + 30, x0 + sw + 70]]) { g.beginPath(); g.moveTo(a, H / 2); g.lineTo(b, H / 2); g.stroke(); g.beginPath(); g.moveTo(b, H / 2); g.lineTo(b + (b < a ? 9 : -9), H / 2 - 6); g.lineTo(b + (b < a ? 9 : -9), H / 2 + 6); g.fill(); }
      g.font = '600 12px Inter,sans-serif'; g.fillText('Zug', 14, H / 2 - 12);
      ro.textContent = eps <= crit ? `ε = ${s1.v} % liegt unter der (hier angenommenen) kritischen Dehnung von 5 %: kein Risswachstum,\nnur Oberflächenreaktion.` :
        `${n} Risse – alle etwa senkrecht zur Zugrichtung. Mehr Dehnung → mehr und breitere Risse,\nlängere Exposition → längere Risse.`;
    }
    [s1, s2].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Schematisches Modell: Dehnung und Ozonrissbildung', c, h('div', { class: 'ctrl' }, s1.row, s2.row), ro,
      h('p', { class: 'tiny muted', style: 'margin:6px 0 0' }, 'Qualitative Veranschaulichung, keine Simulation. Kritische Dehnung und Rissdichten sind frei gewählt.'));
  };

  // ------------------------------------------------------------------ 2 Optik
  D.optics = () => {
    const sNA = slider('Numerische Apertur NA', 0.05, 0.95, 0.01, 0.25), sL = slider('Wellenlänge λ', 400, 700, 10, 550, v => v + ' nm'), sS = slider('Pixelgröße s', 0.1, 3, 0.05, 0.8, v => num(v, 3) + ' µm');
    const ro = h('div', { class: 'readout' });
    const [c, g] = canvas(520, 120);
    function draw() {
      const d = 0.61 * sL.v / 1000 / sNA.v, ny = d / 2, ok = sS.v <= ny;
      ro.innerHTML = `Rayleigh: d = 0,61·${num(sL.v / 1000, 3)} µm / ${num(sNA.v, 3)} = <b>${num(d, 3)} µm</b>\nNyquist: s ≤ d/2 = ${num(ny, 3)} µm → s = ${num(sS.v, 3)} µm ${ok ? '<b style="color:var(--ok)">erfüllt</b>' : '<b style="color:var(--err)">nicht erfüllt (unterabgetastet)</b>'}\nKleinste sinnvolle Rissbreite ≈ max(d; 3·s) = ${num(Math.max(d, 3 * sS.v), 3)} µm`;
      const W = 520, H = 120; g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, H);
      const scale = 60; // px pro µm
      const xc = W / 2;
      g.strokeStyle = 'rgba(255,255,255,.12)';
      for (let x = xc % (sS.v * scale); x < W; x += sS.v * scale) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x, H - 20); g.stroke(); }
      g.strokeStyle = '#2bb3bd'; g.lineWidth = 2; g.beginPath();
      for (let px = 0; px < W; px++) {
        const u = (px - xc) / scale;
        const f = sig => Math.exp(-((u - sig) ** 2) / (2 * (d / 2.355 * 1.2) ** 2));
        const y = (f(-d / 2) + f(d / 2));
        g.lineTo(px, H - 20 - y * 70);
      }
      g.stroke();
      g.fillStyle = '#9bb'; g.font = '11px Inter,sans-serif';
      g.fillText('zwei Punkte im Abstand d (Intensität) · graue Linien = Pixelraster', 10, H - 5);
    }
    [sNA, sL, sS].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Auflösung und Abtastung', c, h('div', { class: 'ctrl' }, sNA.row, sL.row, sS.row), ro);
  };

  // ------------------------------------------------------------------ 3 Weber
  D.weber = () => {
    const [c, g] = canvas(520, 230);
    const sA = slider('Beleuchtung (Faktor)', 0.3, 1.6, 0.05, 1), sC = slider('Rissabdunklung', 0.05, 0.5, 0.01, 0.2, v => num(v * 100, 3) + ' %'), sG = slider('Helligkeitsverlauf', 0, 1, 0.05, 0.6);
    const ro = h('div', { class: 'readout' });
    function draw() {
      const W = 520, H = 230, a = sA.v, depth = sC.v, grad = sG.v;
      const I0 = x => a * (90 + 120 * grad * x / W + (1 - grad) * 60);
      const img = g.createImageData(W, 130);
      const cracks = [130, 390];
      for (let y = 0; y < 130; y++) for (let x = 0; x < W; x++) {
        let I = I0(x);
        for (const cx of cracks) I *= 1 - depth * Math.exp(-((x - cx) ** 2) / 4.5);
        const v = Math.max(0, Math.min(255, I)), k = (y * W + x) * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      g.fillStyle = '#0b1114'; g.fillRect(0, 130, W, 100);
      g.strokeStyle = '#2bb3bd'; g.lineWidth = 1.5; g.beginPath();
      for (let x = 0; x < W; x++) { let I = I0(x); for (const cx of cracks) I *= 1 - depth * Math.exp(-((x - cx) ** 2) / 4.5); g.lineTo(x, 225 - Math.min(255, I) / 255 * 90); }
      g.stroke();
      g.strokeStyle = 'rgba(255,211,77,.6)'; g.setLineDash([4, 3]); g.beginPath();
      for (let x = 0; x < W; x++) g.lineTo(x, 225 - Math.min(255, I0(x)) / 255 * 90);
      g.stroke(); g.setLineDash([]);
      g.fillStyle = '#9bb'; g.font = '11px Inter,sans-serif'; g.fillText('Profil: Bild (türkis) und Hintergrund I_B (gelb)', 8, 145);
      const r = cracks.map(cx => { const IB = I0(cx), I = IB * (1 - depth); return { abs: IB - I, C: (IB - I) / IB }; });
      ro.textContent = `Riss links:  I_B − I = ${num(r[0].abs, 3)} GW   →  C = ${num(r[0].C * 100, 3)} %\nRiss rechts: I_B − I = ${num(r[1].abs, 3)} GW   →  C = ${num(r[1].C * 100, 3)} %\n` +
        `Absolute Differenz hängt von Beleuchtung und Ort ab, der Weber-Kontrast C nicht.\nSchwelle Schnellverfahren bei k = 1: C ≥ 12 % → ${r[0].C >= .12 ? 'beide erkannt' : 'beide NICHT erkannt'}`;
    }
    [sA, sC, sG].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Absoluter vs. relativer Kontrast', c, h('div', { class: 'ctrl' }, sA.row, sC.row, sG.row), ro);
  };

  // ------------------------------------------------------------------ 4 Hesse / Frangi (in JS nachgerechnet)
  function gaussKernel(sig, order) {
    const r = Math.ceil(4 * sig), k = [];
    for (let x = -r; x <= r; x++) { const g0 = Math.exp(-x * x / (2 * sig * sig)); k.push(order === 0 ? g0 : order === 1 ? -x / (sig * sig) * g0 : (x * x / sig ** 4 - 1 / sig ** 2) * g0); }
    const s0 = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sig * sig))).reduce((a, b) => a + b, 0);
    return { r, k: k.map(v => v / s0) };
  }
  function sep(img, W, H, kx, ky) {
    const tmp = new Float32Array(W * H), out = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let i = -kx.r; i <= kx.r; i++) { const xx = Math.min(W - 1, Math.max(0, x + i)); s += img[y * W + xx] * kx.k[i + kx.r]; } tmp[y * W + x] = s; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let i = -ky.r; i <= ky.r; i++) { const yy = Math.min(H - 1, Math.max(0, y + i)); s += tmp[yy * W + x] * ky.k[i + ky.r]; } out[y * W + x] = s; }
    return out;
  }
  D.hessian = () => {
    const W = 120, H = 90;
    const base = new Float32Array(W * H);
    let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = 0;
      const d = Math.abs((x - 30) - (y - 45) * 0.25); v += 0.35 * Math.exp(-d * d / 2.5);              // Linie (Riss)
      v += 0.35 * Math.exp(-((x - 82) ** 2 + (y - 30) ** 2) / 18);                                       // Pore
      const d2 = Math.abs(y - 72); if (x > 60) v += 0.12 * Math.exp(-d2 * d2 / 1.2);                     // schwache Linie
      v += (rnd() - .5) * 0.04;
      base[y * W + x] = v;
    }
    const [c, g] = canvas(W * 4 + 8, H * 2);
    const sS = slider('Skala σ', 0.8, 4, 0.1, 1.6, v => num(v, 2) + ' px'), sC = slider('Strukturparameter c', 0.01, 0.2, 0.005, 0.05, v => num(v, 3));
    const ro = h('div', { class: 'readout' });
    function draw() {
      const sig = sS.v, cpar = sC.v, beta = .5;
      const g0 = gaussKernel(sig, 0), g1 = gaussKernel(sig, 1), g2 = gaussKernel(sig, 2);
      const Ixx = sep(base, W, H, g2, g0), Iyy = sep(base, W, H, g0, g2), Ixy = sep(base, W, H, g1, g1);
      const V = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const a = Ixx[i] * sig * sig, b = Iyy[i] * sig * sig, d = Ixy[i] * sig * sig;
        const tr = (a + b) / 2, dis = Math.sqrt(((a - b) / 2) ** 2 + d * d);
        let l1 = tr + dis, l2 = tr - dis;
        if (Math.abs(l1) > Math.abs(l2)) [l1, l2] = [l2, l1];
        // helle Linien auf dunklem Grund: l2 muss negativ sein
        if (l2 > 0) { V[i] = 0; continue; }
        const rb = Math.abs(l1) / Math.abs(l2), S2 = l1 * l1 + l2 * l2;
        V[i] = Math.exp(-rb * rb / (2 * beta * beta)) * (1 - Math.exp(-S2 / (2 * cpar * cpar)));
      }
      const put = (arr, ox, lo, hi, cmap) => {
        const im = g.createImageData(W * 2, H * 2);
        for (let y = 0; y < H * 2; y++) for (let x = 0; x < W * 2; x++) {
          const v = Math.max(0, Math.min(1, (arr[(y >> 1) * W + (x >> 1)] - lo) / (hi - lo))), k = (y * W * 2 + x) * 4;
          const [r, gg, b] = cmap(v); im.data[k] = r; im.data[k + 1] = gg; im.data[k + 2] = b; im.data[k + 3] = 255;
        }
        g.putImageData(im, ox, 0);
      };
      put(base, 0, -0.02, 0.4, v => [v * 255, v * 255, v * 255]);
      put(V, W * 2 + 8, 0, 1, v => [Math.min(255, v * 2 * 255), Math.min(255, v * 300), 60 + v * 120]);
      g.fillStyle = '#fff'; g.font = '600 11px Inter,sans-serif'; g.fillText('relative Abdunklung', 6, 14); g.fillText('Linienmaß V', W * 2 + 14, 14);
      const at = (x, y) => V[y * W + x];
      ro.textContent = `V an der Rissmitte  (Linie, breit):   ${num(at(30 + Math.round(0), 45), 3)}\nV an der Porenmitte (Fleck):          ${num(at(82, 30), 3)}\nV an der schwachen Linie:             ${num(at(90, 72), 3)}\n→ Linien antworten stark, Flecken kaum. Kleines σ passt zu schmalen, großes zu breiten Strukturen.`;
    }
    [sS, sC].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Frangi-Linienmaß an Linie, Pore und schwacher Linie', c, h('div', { class: 'ctrl' }, sS.row, sC.row), ro,
      h('p', { class: 'tiny muted', style: 'margin:6px 0 0' }, 'Vereinfachte JavaScript-Nachrechnung auf einer Skala (γ-normierte Hesse-Matrix). Das Programm selbst rechnet mit scikit-image-identischen Kernen auf vier Skalen.'));
  };

  // ------------------------------------------------------------------ 5 Black-Hat (1D)
  D.blackhat = () => {
    const [c, g] = canvas(520, 220);
    const sB = slider('Strukturelement B', 3, 31, 2, 17, v => v + ' px');
    const ro = h('div', { class: 'readout' });
    const N = 260, I = new Float32Array(N);
    for (let x = 0; x < N; x++) {
      I[x] = 170 + 20 * Math.sin(x / 40);
      I[x] -= 60 * Math.exp(-((x - 70) ** 2) / (2 * 1.5 ** 2));    // schmaler Riss (≈ 3 px)
      I[x] -= 50 * Math.exp(-((x - 180) ** 2) / (2 * 5 ** 2));     // breiter Riss (≈ 12 px)
    }
    const filt = (a, r, fn) => a.map((_, i) => { let v = a[i]; for (let j = Math.max(0, i - r); j <= Math.min(N - 1, i + r); j++) v = fn(v, a[j]); return v; });
    function draw() {
      const r = (sB.v - 1) / 2, dil = filt(I, r, Math.max), clo = filt(dil, r, Math.min), bh = clo.map((v, i) => v - I[i]);
      const W = 520, H = 220, X = x => x / N * W, Y = v => 150 - (v - 60) / 160 * 140;
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, H);
      const pl = (arr, col, yf = Y, w = 1.8) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); arr.forEach((v, i) => g.lineTo(X(i), yf(v))); g.stroke(); };
      pl(clo, '#ffd34d'); pl(I, '#2bb3bd');
      g.fillStyle = 'rgba(240,120,60,.55)'; bh.forEach((v, i) => g.fillRect(X(i), 215 - v, W / N + .5, v));
      g.fillStyle = '#9bb'; g.font = '11px Inter,sans-serif';
      g.fillText('Profil I (türkis) · Schließung I•B (gelb) · Black-Hat (orange, unten)', 8, 14);
      const p1 = Math.max(...bh.slice(55, 85)), p2 = Math.max(...bh.slice(160, 200));
      ro.textContent = `Black-Hat schmaler Riss (≈3 px): ${num(p1, 3)} GW\nBlack-Hat breiter Riss (≈12 px): ${num(p2, 3)} GW\n${p2 < 40 ? '→ B ist zu klein für den breiten Riss: das Element „passt hinein“, die Antwort bricht ein.' : '→ B ist groß genug, beide Risstäler werden vollständig gefüllt.'}\nRubberScope nimmt das Maximum aus B = 9, 17, 27 px.`;
    }
    sB.inp.addEventListener('input', draw); draw();
    return frame('Black-Hat an zwei Rissen unterschiedlicher Breite', c, h('div', { class: 'ctrl' }, sB.row), ro);
  };

  // ------------------------------------------------------------------ 6 Hysterese (1D)
  D.hysteresis = () => {
    const [c, g] = canvas(520, 210);
    const sK = slider('Empfindlichkeit k', 0.4, 2, 0.05, 1);
    const ro = h('div', { class: 'readout' });
    const N = 300, base = new Float32Array(N);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let x = 0; x < N; x++) {
      let v = 0.15 + rnd() * 0.12;
      if (x > 40 && x < 170) v = 0.95 + 0.35 * Math.sin(x / 9) + (rnd() - .5) * .1;   // Riss mit schwankendem Kontrast
      if (x > 215 && x < 228) v = 0.75;                                                  // isolierter Rauschfleck
      if (x > 255 && x < 262) v = 1.1;                                                   // kurzer starker Fleck
      base[x] = Math.max(0, v);
    }
    function draw() {
      const k = sK.v, S = base.map(v => v * k), W = 520, H = 210, X = x => x / N * W, Y = v => 170 - v / 2 * 150;
      const strong = S.map(v => v >= 1), weak = S.map(v => v >= 0.5), acc = new Array(N).fill(false);
      let i = 0;
      while (i < N) { if (!weak[i]) { i++; continue; } let j = i; while (j < N && weak[j]) j++; let any = false; for (let q = i; q < j; q++) any ||= strong[q]; for (let q = i; q < j; q++) acc[q] = any; i = j; }
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, H);
      for (let x = 0; x < N; x++) { g.fillStyle = strong[x] ? '#d4a017' : acc[x] ? '#5fb5d6' : weak[x] ? '#5a5a90' : 'transparent'; if (weak[x]) g.fillRect(X(x), 180, W / N + .5, 22); }
      g.strokeStyle = '#ddd'; g.lineWidth = 1.6; g.beginPath(); S.forEach((v, x) => g.lineTo(X(x), Y(Math.min(2, v)))); g.stroke();
      for (const [t, col, lab] of [[1, '#d4a017', 'T_hoch = 1,0'], [0.5, '#5fb5d6', 'T_tief = 0,5']]) { g.strokeStyle = col; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(0, Y(t)); g.lineTo(W, Y(t)); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.font = '11px Inter,sans-serif'; g.fillText(lab, 8, Y(t) - 4); }
      g.fillStyle = '#9bb'; g.fillText('Score entlang einer Bildzeile · Balken unten: gelb stark, blau übernommen, violett verworfen', 6, 14);
      const segs = (arr) => { let n = 0; for (let x = 1; x < N; x++) if (arr[x] && !arr[x - 1]) n++; return n + (arr[0] ? 1 : 0); };
      ro.textContent = `Übernommene Abschnitte: ${segs(acc)}   ·   nur mit einfacher Schwelle 1,0: ${segs(strong)} Bruchstücke\n` +
        `Der Riss (links) ist mit Hysterese ${({ 0: 'nicht erkannt', 1: 'durchgehend erkannt' })[segs(acc.slice(30, 180))] || 'zerstückelt'}, der isolierte schwache Fleck wird ${acc[220] ? 'übernommen' : 'verworfen'}.`;
    }
    sK.inp.addEventListener('input', draw); draw();
    return frame('Zwei Schwellen: Hysterese', c, h('div', { class: 'ctrl' }, sK.row), ro);
  };

  // ------------------------------------------------------------------ 7 Ellipse / Momente
  D.ellipse = () => {
    const [c, g] = canvas(520, 220);
    const sR = slider('Achsenverhältnis a/b', 1, 8, 0.1, 2), sA = slider('Drehwinkel', 0, 179, 1, 30, v => v + '°'), sL = slider('Länge a', 4, 60, 1, 24, v => v + ' px');
    const ro = h('div', { class: 'readout' });
    function draw() {
      const W = 130, H = 55, a = sL.v / 2, b = a / sR.v, th = sA.v * Math.PI / 180;
      const pix = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const dx = x - W / 2, dy = y - H / 2, u = dx * Math.cos(th) - dy * Math.sin(th), v = dx * Math.sin(th) + dy * Math.cos(th);
        if ((u / a) ** 2 + (v / Math.max(b, .5)) ** 2 <= 1) pix.push([x, y]);
      }
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, 520, 220);
      g.fillStyle = '#10e0cf'; pix.forEach(([x, y]) => g.fillRect(x * 4, y * 4, 3.6, 3.6));
      const n = pix.length || 1, mx = pix.reduce((s, p) => s + p[0], 0) / n, my = pix.reduce((s, p) => s + p[1], 0) / n;
      let m20 = 0, m02 = 0, m11 = 0; pix.forEach(([x, y]) => { m20 += (x - mx) ** 2; m02 += (y - my) ** 2; m11 += (x - mx) * (y - my); });
      m20 /= n; m02 /= n; m11 /= n;
      const com = Math.sqrt(4 * m11 * m11 + (m20 - m02) ** 2), l1 = (m20 + m02 + com) / 2, l2 = (m20 + m02 - com) / 2;
      const e = l1 > 0 ? Math.sqrt(Math.max(0, 1 - l2 / l1)) : 0, theta = ((-0.5 * Math.atan2(2 * m11, m20 - m02) * 180 / Math.PI) % 180 + 180) % 180;
      const skel = Math.round(sL.v), pass = e >= .68 || skel >= 40;
      ro.innerHTML = `Pixel: ${pix.length} · μ20 = ${num(m20, 3)} · μ02 = ${num(m02, 3)} · μ11 = ${num(m11, 3)}\ne = √(1 − λ_klein/λ_groß) = <b>${num(e, 3)}</b> · θ = ${num(theta, 3)}° (gegen den Uhrzeigersinn, 0° = waagerecht)\nFormfilter (e ≥ 0,68 oder Skelett ≥ 40 px, Skelett ≈ ${skel} px): ${pass ? '<b style="color:var(--ok)">bestanden</b>' : '<b style="color:var(--err)">verworfen</b>'}`;
    }
    [sR, sA, sL].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Exzentrizität aus Bildmomenten', c, h('div', { class: 'ctrl' }, sR.row, sA.row, sL.row), ro);
  };

  // ------------------------------------------------------------------ 8 Kulpa
  D.kulpa = () => {
    const G = 14, NX = 37, NY = 18;
    const [c, g] = canvas(NX * G, NY * G);
    const ro = h('div', { class: 'readout' });
    let p0 = [3, 14], p1 = [30, 4], dragging = null;
    function raster(a, b) {               // 8-verbundene Bresenham-Linie
      let [x0, y0] = a, [x1, y1] = b; const pts = [];
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; let err = dx + dy;
      for (; ;) { pts.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      return pts;
    }
    function draw() {
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, NX * G, NY * G);
      g.strokeStyle = 'rgba(255,255,255,.06)';
      for (let x = 0; x <= NX; x++) { g.beginPath(); g.moveTo(x * G, 0); g.lineTo(x * G, NY * G); g.stroke(); }
      for (let y = 0; y <= NY; y++) { g.beginPath(); g.moveTo(0, y * G); g.lineTo(NX * G, y * G); g.stroke(); }
      const pts = raster(p0, p1), S = new Set(pts.map(p => p.join(',')));
      g.fillStyle = '#10e0cf'; pts.forEach(([x, y]) => g.fillRect(x * G + 1, y * G + 1, G - 2, G - 2));
      // Kanten zählen wie chain_counts(): orthogonal, diagonal nur ohne orthogonale Ersatzverbindung
      let ne = 0, no = 0;
      for (const [x, y] of pts) {
        if (S.has(`${x + 1},${y}`)) ne++; if (S.has(`${x},${y + 1}`)) ne++;
        if (S.has(`${x + 1},${y + 1}`) && !S.has(`${x + 1},${y}`) && !S.has(`${x},${y + 1}`)) no++;
        if (S.has(`${x - 1},${y + 1}`) && !S.has(`${x - 1},${y}`) && !S.has(`${x},${y + 1}`)) no++;
      }
      g.strokeStyle = '#ff9f1c'; g.lineWidth = 2; g.beginPath(); g.moveTo((p0[0] + .5) * G, (p0[1] + .5) * G); g.lineTo((p1[0] + .5) * G, (p1[1] + .5) * G); g.stroke();
      for (const p of [p0, p1]) { g.fillStyle = '#ff9f1c'; g.beginPath(); g.arc((p[0] + .5) * G, (p[1] + .5) * G, 5, 0, 7); g.fill(); }
      const Ltrue = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), Lpix = pts.length - 1, Lk = 0.9481 * ne + 1.3408 * no;
      const ang = (Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]) * 180 / Math.PI + 180) % 180;
      const err = v => (Ltrue > 0 ? (v / Ltrue - 1) * 100 : 0);
      ro.textContent = `Winkel ${num(ang, 3)}° · n_e = ${ne} orthogonal, n_o = ${no} diagonal\nwahre Länge (Mittelpunkte):  ${num(Ltrue, 4)} px\nPixelzählung (Schritte):     ${num(Lpix, 4)} px  (${err(Lpix) >= 0 ? '+' : ''}${num(err(Lpix), 3)} %)\nKulpa 0,948·n_e + 1,341·n_o: ${num(Lk, 4)} px  (${err(Lk) >= 0 ? '+' : ''}${num(err(Lk), 3)} %)`;
    }
    const cell = e => { const r = c.getBoundingClientRect(); return [Math.max(0, Math.min(NX - 1, Math.floor((e.clientX - r.left) / r.width * NX))), Math.max(0, Math.min(NY - 1, Math.floor((e.clientY - r.top) / r.height * NY)))]; };
    c.style.cursor = 'pointer'; c.style.touchAction = 'none';
    c.addEventListener('pointerdown', e => { const p = cell(e); dragging = Math.hypot(p[0] - p0[0], p[1] - p0[1]) < Math.hypot(p[0] - p1[0], p[1] - p1[1]) ? 0 : 1; (dragging ? p1 = p : p0 = p); c.setPointerCapture(e.pointerId); draw(); });
    c.addEventListener('pointermove', e => { if (dragging === null) return; const p = cell(e); dragging ? p1 = p : p0 = p; draw(); });
    c.addEventListener('pointerup', () => dragging = null);
    const presets = h('div', { class: 'btnrow', style: 'margin-top:6px' }, [['waagerecht', [3, 9], [33, 9]], ['45°', [3, 16], [19, 0]], ['22,5°', [2, 15], [34, 2]], ['steil', [18, 17], [24, 0]]].map(([l, a, b]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { p0 = a; p1 = b; draw(); } }, l)));
    draw();
    return frame('Endpunkte ziehen: Pixelzählung vs. Kulpa', c, presets, ro);
  };

  // ------------------------------------------------------------------ 9 Winkel
  D.angle = () => {
    const [c, g] = canvas(520, 220);
    const sD = slider('Dehnrichtung φ_D', 0, 179, 1, 0, v => v + '°'), sT = slider('Objektorientierung θ', 0, 179, 1, 75, v => v + '°');
    const ro = h('div', { class: 'readout' });
    function draw() {
      const W = 520, H = 220, cx = W / 2, cy = H / 2;
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, H);
      // Sektor "quer" (Δ ≥ 60°)
      const pd = -sD.v * Math.PI / 180;
      g.fillStyle = 'rgba(16,224,207,.12)';
      for (const off of [Math.PI / 2, -Math.PI / 2]) { g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 95, pd + off - Math.PI / 6, pd + off + Math.PI / 6); g.fill(); }
      const arrow = (ang, L, col, w) => { const a = -ang * Math.PI / 180; g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(cx - L * Math.cos(a), cy - L * Math.sin(a)); g.lineTo(cx + L * Math.cos(a), cy + L * Math.sin(a)); g.stroke(); };
      arrow(sD.v, 110, '#ffd34d', 2.5); arrow(sT.v, 75, '#10e0cf', 6);
      const d0 = Math.abs(sT.v - sD.v) % 180, delta = Math.min(d0, 180 - d0), quer = delta >= 60;
      g.fillStyle = '#9bb'; g.font = '11px Inter,sans-serif'; g.fillText('gelb: Dehnrichtung · türkis: Objekt · heller Sektor: „quer“ (Δ ≥ 60°)', 8, 14);
      ro.innerHTML = `Δ = min(|${sT.v}° − ${sD.v}°| mod 180; 180° − …) = <b>${delta}°</b> → ${quer ? '<b style="color:var(--ok)">quer zur Dehnung</b> (zählt in L_A,⊥)' : '<b style="color:var(--warm)">nicht quer</b> (z. B. Riefe aus der Formgebung)'}`;
    }
    [sD, sT].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Winkel zur Dehnrichtung', c, h('div', { class: 'ctrl' }, sD.row, sT.row), ro);
  };

  // ------------------------------------------------------------------ 10b Rissbreite: Schwelle vs. Profil (ab 2.7)
  D.width = () => {
    const [c, g] = canvas(520, 230);
    const sW = slider('wahre Rissbreite w', 1.5, 12, 0.5, 4, v => num(v, 2) + ' px'),
      sS = slider('Unschärfe σ (Optik)', 0.3, 3, 0.1, 1.2, v => num(v, 2) + ' px'),
      sT = slider('Segmentierschwelle', 0.1, 0.9, 0.05, 0.7, v => num(v * 100, 3) + ' % der Tiefe');
    const ro = h('div', { class: 'readout' });
    const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
    const prof = (x, w, s) => 0.5 * (erf((x + w / 2) / (Math.SQRT2 * s)) - erf((x - w / 2) / (Math.SQRT2 * s)));
    const widthAt = (lvl, w, s) => { let x = 0; while (x < 40 && prof(x, w, s) >= lvl) x += 0.01; return 2 * x; };
    function draw() {
      const W = 520, H = 230, w = sW.v, s = sS.v, t = sT.v, X = x => W / 2 + x * 16, Y = d => 40 + (1 - d) * 150;
      const peak = prof(0, w, s);
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#5a6b78'; g.setLineDash([4, 4]); g.beginPath();
      g.moveTo(0, Y(0)); g.lineTo(X(-w / 2), Y(0)); g.lineTo(X(-w / 2), Y(1)); g.lineTo(X(w / 2), Y(1)); g.lineTo(X(w / 2), Y(0)); g.lineTo(W, Y(0)); g.stroke(); g.setLineDash([]);
      g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath();
      for (let px = 0; px <= W; px += 2) { const x = (px - W / 2) / 16; g.lineTo(px, Y(prof(x, w, s))); } g.stroke();
      const wt = widthAt(t * peak, w, s), wf = widthAt(0.5 * peak, w, s);
      for (const [lvl, col, lab, ww] of [[t * peak, '#e0a33a', 'Schwelle', wt], [0.5 * peak, '#10e0cf', 'halbe Tiefe', wf]]) {
        g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, Y(lvl)); g.lineTo(W, Y(lvl)); g.stroke();
        g.lineWidth = 4; g.beginPath(); g.moveTo(X(-ww / 2), Y(lvl)); g.lineTo(X(ww / 2), Y(lvl)); g.stroke();
        g.fillStyle = col; g.font = '11px Inter,sans-serif'; g.fillText(lab, 8, Y(lvl) - 4);
      }
      g.fillStyle = '#9bb'; g.font = '11px Inter,sans-serif';
      g.fillText('Abdunklung quer zum Riss · gestrichelt: wahre Rissbreite · weiß: Bild nach optischer Unschärfe', 8, 14);
      ro.innerHTML = `Breite über die Schwelle (Fläche ÷ Länge): <b style="color:var(--warm)">${num(wt, 3)} px</b> – ändert sich mit der Schwelle\n` +
        `Halbwertsbreite (FWHM): <b>${num(wf, 3)} px</b> – unabhängig von der Schwelle\n` +
        `Profilmodell (Kasten ⊗ Gauß): <b style="color:var(--ok)">${num(w, 3)} px</b> = wahre Breite, weil die Unschärfe σ mitgeschätzt wird`;
    }
    [sW, sS, sT].forEach(q => q.inp.addEventListener('input', draw)); draw();
    return frame('Rissbreite: Schwelle, Halbwertsbreite, Profilmodell', c, h('div', { class: 'ctrl' }, sW.row, sS.row, sT.row), ro);
  };

  // ------------------------------------------------------------------ 11 Konfidenzintervall
  const T975 = [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086];
  D.ci = () => {
    const [c, g] = canvas(520, 200);
    const sN = slider('Anzahl n', 2, 20, 1, 3, v => String(v)), sS = slider('Standardabweichung s', 0.1, 3, 0.1, 1);
    const ro = h('div', { class: 'readout' });
    function draw() {
      const W = 520, H = 200, l = 40;
      g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, H);
      const hw = n => T975[n - 1] * sS.v / Math.sqrt(n), max = hw(2);
      g.strokeStyle = '#2bb3bd'; g.lineWidth = 2; g.beginPath();
      for (let n = 2; n <= 20; n++) g.lineTo(l + (n - 2) / 18 * (W - l - 10), H - 25 - hw(n) / max * (H - 45));
      g.stroke();
      const xn = l + (sN.v - 2) / 18 * (W - l - 10), yn = H - 25 - hw(sN.v) / max * (H - 45);
      g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(xn, yn, 5, 0, 7); g.fill();
      g.fillStyle = '#9bb'; g.font = '11px Inter,sans-serif'; g.fillText('Halbe Breite des 95-%-KI über n', 8, 14); g.fillText('n = 2', l, H - 8); g.fillText('n = 20', W - 50, H - 8);
      ro.textContent = `n = ${sN.v}: t(0,975; ${sN.v - 1}) = ${num(T975[sN.v - 1], 4)}\nKI95 = x̄ ± ${num(T975[sN.v - 1], 4)} · ${num(sS.v, 3)} / √${sN.v} = x̄ ± ${num(hw(sN.v), 3)}`;
    }
    [sN, sS].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Konfidenzintervall und Stichprobenumfang', c, h('div', { class: 'ctrl' }, sN.row, sS.row), ro);
  };

  // ------------------------------------------------------------------ 12 Konfusionsmatrix
  D.confusion = () => {
    const sTP = slider('TP richtig erkannt', 0, 1000, 10, 800, v => String(v)), sFP = slider('FP fälschlich', 0, 1000, 10, 150, v => String(v)), sFN = slider('FN übersehen', 0, 1000, 10, 60, v => String(v));
    const ro = h('div', { class: 'readout' });
    const [c, g] = canvas(520, 90);
    function draw() {
      const tp = sTP.v, fp = sFP.v, fn = sFN.v, P = tp / (tp + fp || 1), R = tp / (tp + fn || 1), F = 2 * tp / (2 * tp + fp + fn || 1), I = tp / (tp + fp + fn || 1);
      ro.textContent = `Precision = ${num(P, 3)}   Recall = ${num(R, 3)}   F1 = ${num(F, 3)}   IoU = ${num(I, 3)}`;
      const W = 520, tot = tp + fp + fn || 1; g.fillStyle = '#0b1114'; g.fillRect(0, 0, W, 90);
      let x = 10; for (const [v, col, lab] of [[tp, '#28c85a', 'TP'], [fp, '#eb3c3c', 'FP'], [fn, '#3c78ff', 'FN']]) { const w = v / tot * (W - 20); g.fillStyle = col; g.fillRect(x, 25, w, 36); g.fillStyle = '#fff'; g.font = '600 12px Inter,sans-serif'; if (w > 24) g.fillText(lab, x + 6, 48); x += w; }
      g.fillStyle = '#9bb'; g.font = '11px Inter,sans-serif'; g.fillText('Farben wie in den Validierungs-Overlays: grün richtig, rot falsch positiv, blau übersehen', 10, 80);
    }
    [sTP, sFP, sFN].forEach(s => s.inp.addEventListener('input', draw)); draw();
    return frame('Precision, Recall, F1, IoU', c, h('div', { class: 'ctrl' }, sTP.row, sFP.row, sFN.row), ro);
  };
})();
