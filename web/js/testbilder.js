/* RubberScope Web – Testbilder mit Sollwerten zum Herunterladen, Öffnen und als Referenzpaare */
'use strict';
(() => {
  const RS = window.RS, $ = RS.$, h = RS.h;
  const P = 'testbilder/';
  const BILDER = [
    { f: '01_referenz_ungealtert', titel: 'Referenz, ungealtert', text: 'keine Ozonrisse; Poren und eine Formriefe parallel zur Dehnung (zählt nicht)', n: 0, la: '0' },
    { f: '02_einfach', titel: 'Einfach', text: '6 deutliche Risse, gleichmäßige Beleuchtung', n: 6, la: '0,760' },
    { f: '03_rissnetz', titel: 'Rissnetz', text: '16 Risse unterschiedlicher Länge und Breite', n: 16, la: '0,998' },
    { f: '04_beleuchtungsverlauf', titel: 'Beleuchtungsverlauf', text: 'starker Helligkeitsverlauf und Rauschen (Weber-Kontrast)', n: 14, la: '1,117' },
    { f: '05_stoerungen', titel: 'Störungen', text: '10 Risse, dazu Poren, Riefe, Kratzer und Staub', n: 10, la: '0,785' },
    { f: '06_schwacher_kontrast', titel: 'Schwacher Kontrast', text: '10 Risse mit nur 17 % Kontrast, nahe der Nachweisgrenze', n: 10, la: '0,816' },
  ];

  async function holen(name) {
    const r = await fetch(P + name);
    if (!r.ok) throw new Error(name + ' nicht gefunden (' + r.status + ')');
    return new File([await r.blob()], name);
  }

  async function inAnalyse(name, btn) {
    if (!RS.analyseAddImage) return RS.toast('Analyse-Bereich nicht verfügbar.', 'err');
    btn && (btn.disabled = true);
    try {
      const f = await holen(name);
      RS.go('analyse');
      await RS.analyseAddImage(name, new Uint8Array(await f.arrayBuffer()));
      RS.toast(name + ' geladen. Maßstab 2,5 µm/px kommt aus dem TIFF, Dehnrichtung 0° (waagerecht).', 'ok', 6000);
    } catch (e) { RS.toast(e.message, 'err', 8000); }
    finally { btn && (btn.disabled = false); }
  }

  async function alsReferenzpaare(btn) {
    if (!RS.addValFiles) return RS.toast('Validierung mit eigenen Bildern nicht verfügbar.', 'err');
    btn.disabled = true; const alt = btn.textContent; btn.textContent = 'Lade Testset …';
    try {
      const bilder = await Promise.all(BILDER.map(b => holen(b.f + '.tif')));
      const masken = await Promise.all(BILDER.map(b => holen(b.f + '_maske.png')));
      await RS.addValFiles(bilder, masken);
      const ziel = $('#own-pairs'); if (ziel) ziel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) { RS.toast(e.message, 'err', 8000); }
    finally { btn.disabled = false; btn.textContent = alt; }
  }

  const dl = (name, label) => h('a', { href: P + name, download: name }, label);

  function render() {
    const host = $('#testbilder'); if (!host || host.childElementCount) return;
    const zeilen = BILDER.map(b => h('tr', {},
      h('td', {}, h('img', { src: P + 'vorschau_' + b.f + '.jpg', alt: b.titel, loading: 'lazy', width: 120, height: 90, style: 'border-radius:6px;display:block' })),
      h('td', {}, h('b', {}, b.f.slice(0, 2) + ' · ' + b.titel), h('br'), h('span', { class: 'small muted' }, b.text)),
      h('td', { class: 'n' }, String(b.n)),
      h('td', { class: 'n' }, b.la),
      h('td', { class: 'small' }, dl(b.f + '.tif', 'Bild (TIFF)'), h('br'), dl(b.f + '_maske.png', 'Sollmaske (PNG)')),
      h('td', {}, h('button', { class: 'btn sm', type: 'button', onclick: e => inAnalyse(b.f + '.tif', e.currentTarget) }, 'In Analyse öffnen'))));
    zeilen.push(h('tr', {},
      h('td', {}, h('img', { src: P + 'vorschau_TK-1.jpg', alt: 'Testkarte TK-1', loading: 'lazy', width: 120, height: 64, style: 'border-radius:6px;display:block' })),
      h('td', {}, h('b', {}, 'Testkarte TK-1'), h('br'), h('span', { class: 'small muted' }, '14 vermessene Risse: Druckvorlage A4 quer (mit 100 % drucken) zum Fotografieren und digitale Fassung mit 60 µm/px')),
      h('td', { class: 'n' }, '14'),
      h('td', { class: 'n' }, '–'),
      h('td', { class: 'small' }, dl('TK-1_digital_60um.tif', 'Digital (TIFF)'), h('br'), dl('RubberScope_Testkarte_TK-1.pdf', 'Druckvorlage (PDF)'), h('br'), dl('TK-1_sollwerte.csv', 'Sollwerte (CSV)')),
      h('td', {}, h('button', { class: 'btn sm', type: 'button', onclick: e => inAnalyse('TK-1_digital_60um.tif', e.currentTarget) }, 'In Analyse öffnen'))));
    host.append(h('div', { class: 'card' },
      h('h2', { style: 'margin-top:0' }, '⬇ Testbilder mit Sollwerten'),
      h('p', { class: 'small' }, 'Sechs synthetische Ozonrissbilder (1024 × 768 px, Maßstab 2,5 µm/px im TIFF) mit Sollmasken und Sollwerten, dazu die Testkarte TK-1. Bei der Auswertung Dehnrichtung 0° (waagerecht) eintragen. Synthetische Prüfbilder, keine echten Proben – frei für Lehre und Übung.'),
      h('div', { class: 'btnrow' },
        h('a', { class: 'btn primary', href: P + 'RubberScope_Testbilder.zip', download: 'RubberScope_Testbilder.zip' }, '⬇ Alle Testbilder (ZIP, 6,5 MB)'),
        h('a', { class: 'btn', href: P + 'Uebersicht_Testbilder.pdf', target: '_blank', rel: 'noopener' }, 'Übersicht & Anleitung (PDF)'),
        h('a', { class: 'btn', href: P + 'Sollwerte.csv', download: 'Sollwerte.csv' }, 'Sollwerte je Bild (CSV)'),
        h('a', { class: 'btn', href: P + 'Sollwerte_je_Riss.csv', download: 'Sollwerte_je_Riss.csv' }, 'Sollwerte je Riss (CSV)'),
        h('button', { class: 'btn', type: 'button', title: 'Lädt alle sechs Bilder mit Sollmaske unten in „Eigene Bilder validieren“', onclick: e => alsReferenzpaare(e.currentTarget) }, '▶ Testset als Referenzpaare laden')),
      h('div', { style: 'overflow-x:auto;margin-top:10px' }, h('table', { class: 't' },
        h('tr', {}, h('th', {}, 'Vorschau'), h('th', {}, 'Bild'), h('th', {}, 'Risse quer'), h('th', {}, 'L', h('sub', {}, 'A,⊥'), ' Soll [mm/mm²]'), h('th', {}, 'Download'), h('th', {}, '')),
        zeilen))));
  }

  RS.testbilder = render;
  RS.zuTestbildern = () => { RS.go('validierung'); setTimeout(() => { render(); const t = $('#testbilder'); t && t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120); };
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-testbilder]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); RS.zuTestbildern(); }));
  });
})();
