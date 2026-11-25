/* RubberScope Web – Lernpfad: Kapitel, Pipeline-Bilder, Vorlesen und Videomodus */
'use strict';
(() => {
  const RS = window.RS, $ = RS.$, $$ = RS.$$, h = RS.h;
  const L = RS.learn = { idx: 0, playing: false, video: false, done: new Set() };
  try { JSON.parse(localStorage.getItem('rs-done') || '[]').forEach(i => L.done.add(i)); } catch { }
  const saveDone = () => { try { localStorage.setItem('rs-done', JSON.stringify([...L.done])); } catch { } };

  const STAGE_TEXT = {
    grau: ['Graustufenbild (Lernbild)', 'Synthetisches Lernbild: 7 Risse quer zur waagerechten Dehnung, Poren, eine Riefe parallel zur Dehnung und ein Helligkeitsverlauf.'],
    weber: ['Relative Abdunklung 1 − I/I_B', 'Der Helligkeitsverlauf ist entfernt; dunkle Strukturen erscheinen hell (Farbskala inferno, 0–50 %).'],
    frangi: ['Frangi-Linienmaß V / V_ref', 'Gelb/grün: linienförmig. Poren antworten kaum, die schwache Riefe deutlich (sie ist ja eine Linie).'],
    blackhat: ['Black-Hat-Kontrast C / C_min', 'Lokale Tiefe der Abdunklung, unabhängig von der Form: Hier sprechen auch Poren an.'],
    hysterese: ['Hysterese-Ergebnis', 'Gelb: Score ≥ 1 (stark). Blau: 0,5–1 und mit starkem Bereich verbunden (übernommen). Violett: schwach und isoliert (verworfen).'],
    formfilter: ['Formfilter', 'Türkis: behalten. Rot: durch Exzentrizitäts- und Längenfilter entfernt. Grau: unter A_min.'],
    skelett: ['Skelett (Mittellinien)', 'Gelb: 1 Pixel breite Skelettlinien, aus denen n_e und n_o für die Kulpa-Länge gezählt werden.'],
    ergebnis: ['Ergebnis mit Objekt-IDs', 'Kalibrierung 0,8 µm/px, Dehnrichtung 0°. Objekt mit Riefe und zwei Rissen ist verschmolzen – siehe Kapitel 9/10.'],
  };

  // ------------------------------------------------------------------ Pipeline-Bilder vom Rechenkern
  let pipePromise = null;
  RS.lernPipeline = () => {
    if (!pipePromise) pipePromise = (async () => {
      await RS.loadEngine();
      const bytes = await RS.call('lern_image');
      await RS.call('put_file', 'lern', 'lernbild.png', bytes);
      RS.lernBytes = bytes;
      return RS.callJSON('pipeline', 'lern', 1.0, 16);
    })().catch(e => { pipePromise = null; throw e; });
    return pipePromise;
  };
  RS.loadLernbildForAnalysis = async () => {
    try {
      await RS.lernPipeline();
      await RS.anaAddImage('lernbild.png', RS.lernBytes, { state: 'Gealtert', group: 'Lernbild' });
      $('#p-scale').value = 0.8; $('#p-strain').value = 0;
      $('#scale-src').textContent = 'Lernbild: 0,8 µm/px (frei gewählt, synthetisch)';
      RS.toast('Lernbild geladen – „Analysieren“ drücken, dann mit ⛔ die Riefe zwischen den Rissen ausschließen.', 'ok', 7000);
    } catch (e) { RS.toast(e.message, 'err'); }
  };

  async function fillStage(box, id) {
    const [title, cap] = STAGE_TEXT[id] || [id, ''];
    box.innerHTML = '';
    box.append(h('div', { class: 'small', style: 'font-weight:600;margin-bottom:6px' }, '🔬 Echter Rechenschritt am Lernbild: ' + title));
    if (RS.engine.state !== 'ready') {
      const ld = h('div', { class: 'loadpanel' }, h('div', { class: 'bar' }, h('i')), h('span', { class: 'tiny muted' }, 'Rechenkern lädt …'));
      box.append(ld);
      const off = RS.onEngine(e => { const i = $('.bar i', ld); if (i) i.style.width = e.progress + '%'; $('span', ld).textContent = e.text; });
      try { await RS.lernPipeline(); } catch (e) { off(); box.append(h('div', { class: 'callout warn small' }, 'Rechenkern nicht verfügbar: ' + e.message)); return; }
      off();
      if (!box.isConnected) return;
      return fillStage(box, id);
    }
    let p;
    try { p = await RS.lernPipeline(); } catch (e) { box.append(h('div', { class: 'callout warn small' }, e.message)); return; }
    const st = p.stages.find(s => s.id === id);
    if (!st) return;
    const isPng = st.img.startsWith('iVBOR');
    box.append(h('figure', { class: 'stagebox', style: 'margin:0' },
      h('img', { class: 'stageimg', src: `data:image/${isPng ? 'png' : 'jpeg'};base64,${st.img}`, alt: title }),
      h('figcaption', {}, cap),
      st.stat ? h('div', { class: 'stat' }, Object.entries(st.stat).map(([k, v]) => `${k}: ${typeof v === 'number' ? RS.num(v, 4) : v}`).join(' · ')) : ''));
    const nav = h('div', { class: 'btnrow', style: 'margin-top:6px' });
    p.stages.forEach(s => { if (s.id !== 'original') nav.append(h('button', { class: 'btn sm' + (s.id === id ? ' on' : ''), type: 'button', onclick: () => fillStage(box, s.id) }, (STAGE_TEXT[s.id]?.[0] || s.id).split(' ')[0])); });
    box.append(h('details', { style: 'margin-top:6px' }, h('summary', { class: 'tiny muted' }, 'Andere Rechenschritte ansehen'), nav));
  }

  // ------------------------------------------------------------------ Inhaltsverzeichnis & Kapitel
  function renderTOC() {
    const ol = $('#toc'); ol.innerHTML = '';
    RS.CHAPTERS.forEach((ch, i) => ol.append(h('li', {}, h('a', {
      class: (i === L.idx ? 'on ' : '') + (L.done.has(ch.id) ? 'done' : ''), onclick: () => { stopPlayback(); show(i); }, role: 'button', tabindex: 0,
      onkeydown: e => { if (e.key === 'Enter') { stopPlayback(); show(i); } }
    }, h('span', { class: 'n' }, L.done.has(ch.id) ? '✓' : i + 1), h('span', {}, ch.title, h('br'), h('span', { class: 'tiny', style: 'opacity:.75' }, `${ch.min} min`))))));
  }

  function show(i, opts = {}) {
    L.idx = Math.max(0, Math.min(RS.CHAPTERS.length - 1, i));
    const ch = RS.CHAPTERS[L.idx];
    const art = $('#chapter'); art.innerHTML = '';
    const speakBtn = h('button', { class: 'btn sm', type: 'button', id: 'ch-speak', onclick: () => playChapter(false) }, '🔊 Kapitel vorlesen');
    art.append(h('div', { class: 'meta' }, h('span', { class: 'pill' }, `Kapitel ${L.idx + 1} / ${RS.CHAPTERS.length}`), h('span', { class: 'small muted' }, `≈ ${ch.min} min`), speakBtn));
    art.append(h('h2', {}, ch.title));
    const text = h('div', { class: 'text', html: ch.html() });
    const right = h('div', {});
    [].concat(ch.demo || []).forEach((dn, i) => { if (RS.DEMOS[dn]) { const d = RS.DEMOS[dn](); d.id = i ? 'ch-demo-' + (i + 1) : 'ch-demo'; if (i) d.style.marginTop = '12px'; right.append(d); } });
    if (ch.stage) { const sb = h('div', { class: 'demo', id: 'ch-stage', style: 'margin-top:12px' }); right.append(sb); fillStage(sb, ch.stage); }
    if (!ch.demo && !ch.stage) right.append(h('div', { class: 'demo' }, h('div', { class: 'small', style: 'font-weight:600' }, '🗂 Zusammenfassung'), h('p', { class: 'small' }, 'Dieses Kapitel ist eine Arbeitsanleitung. Im Bereich „Analyse“ kannst du alles direkt ausprobieren – mit eigenen Bildern oder den Demobildern.'), h('a', { class: 'btn sm primary', href: '#analyse' }, 'Zur Analyse →')));
    art.append(h('div', { class: 'body' }, text, right));
    // Sprechertext (sichtbar, für Barrierefreiheit und zum Mitlesen)
    const narr = h('details', { class: 'box', style: 'margin-top:14px' }, h('summary', {}, '📝 Sprechertext / Transkript'),
      ...ch.narr.map((t, j) => h('p', { class: 'small speakline', 'data-line': `${ch.id}-${j}` }, t)));
    art.append(narr);
    if (ch.quiz.length) art.append(renderQuiz(ch));
    art.append(h('div', { class: 'btnrow', style: 'margin-top:16px;justify-content:space-between' },
      L.idx > 0 ? h('button', { class: 'btn', type: 'button', onclick: () => { stopPlayback(); show(L.idx - 1); } }, '← ' + RS.CHAPTERS[L.idx - 1].title) : h('span'),
      L.idx < RS.CHAPTERS.length - 1 ? h('button', { class: 'btn primary', type: 'button', onclick: () => { markDone(ch.id); stopPlayback(); show(L.idx + 1); } }, 'Weiter: ' + RS.CHAPTERS[L.idx + 1].title + ' →') :
        h('a', { class: 'btn primary', href: '#analyse', onclick: () => markDone(ch.id) }, 'Geschafft – zur Analyse →')));
    renderTOC();
    if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function markDone(id) { L.done.add(id); saveDone(); renderTOC(); }

  function renderQuiz(ch) {
    const box = h('div', { class: 'quiz' }, h('h4', {}, '✅ Kurz-Check'));
    ch.quiz.forEach((q, qi) => {
      const why = h('div', { class: 'why', hidden: true });
      const opts = h('div', { class: 'opts' }, q.opts.map((o, oi) => h('button', {
        type: 'button', onclick: e => {
          $$('button', opts).forEach((b, bi) => { b.disabled = true; if (bi === q.a) b.classList.add('right'); });
          if (oi !== q.a) e.target.classList.add('wrong');
          why.hidden = false; why.textContent = (oi === q.a ? 'Richtig. ' : 'Nicht ganz. ') + q.why;
          if ($$('.quiz .why', box.parentNode).every(w => !w.hidden)) markDone(ch.id);
        }
      }, o)));
      box.append(h('div', { class: 'q' }, h('div', { class: 'small', style: 'font-weight:600' }, `${qi + 1}. ${q.q}`), opts, why));
    });
    return box;
  }

  // ------------------------------------------------------------------ Vorlesen & Videomodus
  function focusFor(text) {
    if (/rechts|Experiment|Rechner|probiere|ziehen|Konfusionsmatrix/i.test(text)) return $('#ch-demo') || $('#ch-stage');
    if (/Lernbild|unten|darunter/i.test(text)) return $('#ch-stage');
    return null;
  }
  function setSub(text, i, n) {
    $('#pl-sub').innerHTML = `<b>Kapitel ${L.idx + 1}:</b> ${RS.esc(text)}`;
    $('#pl-prog').style.width = ((L.idx + (n ? i / n : 0)) / RS.CHAPTERS.length * 100) + '%';
  }
  async function playChapter(video) {
    const ch = RS.CHAPTERS[L.idx];
    L.video = video; L.playing = true; L.token = (L.token || 0) + 1;
    const my = L.token;
    $('#player').hidden = false; $('#pl-play').textContent = '⏸ Pause';
    const lines = ch.narr.map((t, j) => ({ id: `${ch.id}-${j}`, text: t }));
    let prevFocus = null;
    const onLine = id => {
      if (my !== L.token) return;
      const j = +id.split('-').pop(), line = lines[j];
      setSub(line.text, j, lines.length);
      $$('.speakline').forEach(p => p.classList.toggle('now', p.dataset.line === id));
      const f = focusFor(line.text);
      if (prevFocus) prevFocus.classList.remove('focus-ring');
      if (f) { f.classList.add('focus-ring'); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); prevFocus = f; }
    };
    const rec = RS.LP_AUDIO && RS.LP_AUDIO[ch.id];
    let res = rec && rec.starts.length === lines.length ? await RS.speech.playAudio(rec.src, rec.starts, lines, onLine) : 'error';
    if (res === 'error' && my === L.token) res = await RS.speech.play(lines, onLine);
    if (prevFocus) prevFocus.classList.remove('focus-ring');
    $$('.speakline').forEach(p => p.classList.remove('now'));
    if (my !== L.token) return;
    if (res === 'completed') {
      markDone(ch.id);
      if (video && L.idx < RS.CHAPTERS.length - 1) { show(L.idx + 1); await RS.sleep(900); if (my === L.token) playChapter(true); return; }
    }
    L.playing = false;
    if (res === 'completed') setSub(video ? 'Ende des Erklärvideos. Viel Erfolg bei der Auswertung!' : 'Kapitel vorgelesen.', 1, 1);
    $('#pl-play').textContent = '▶ Abspielen';
  }
  function stopPlayback() {
    if (!L.playing) return;
    L.token = (L.token || 0) + 1; L.playing = false;
    RS.speech.stop();
    $('#pl-play').textContent = '▶ Abspielen';
  }
  RS.startVideo = (from = 0) => { RS.go('lernen'); setTimeout(() => { show(from); playChapter(true); }, 60); };

  RS.routes.lernen = () => { if (!$('#chapter').childElementCount) show(L.idx); else renderTOC(); RS.loadEngine().catch(() => { }); };

  document.addEventListener('DOMContentLoaded', () => {
    $('#video-all').onclick = () => { stopPlayback(); show(0); playChapter(true); };
    $('#pl-play').onclick = () => {
      if (!L.playing) return playChapter(L.video);
      if (RS.speech.state === 'paused') { RS.speech.resume(); $('#pl-play').textContent = '⏸ Pause'; }
      else { RS.speech.pause(); $('#pl-play').textContent = '▶ Weiter'; }
    };
    $('#pl-stop').onclick = () => { stopPlayback(); $('#player').hidden = true; };
    $('#pl-next').onclick = () => { const v = L.video; stopPlayback(); show(L.idx + 1); playChapter(v); };
    $('#pl-prev').onclick = () => { const v = L.video; stopPlayback(); show(L.idx - 1); playChapter(v); };
    $('#pl-rate').onchange = e => RS.speech.setRate(+e.target.value);
    fetch('audio/lernpfad/zeiten.json').then(r => r.ok ? r.json() : null).then(j => {
      if (!j) return;
      RS.LP_AUDIO = j;
      $('#voice-info').textContent = 'Sprachausgabe: eingesprochene Stimme (Helmut, ElevenLabs); Untertitel laufen mit.';
    }).catch(() => { });
    RS.speech.ready.then(() => {
      if (RS.LP_AUDIO) return;
      $('#voice-info').textContent = { claude: 'Sprachausgabe: Claude-Stimme.', browser: 'Sprachausgabe: Stimme deines Browsers (Deutsch, falls installiert).', none: 'Keine Sprachausgabe verfügbar – Untertitel laufen automatisch.' }[RS.speech.mode];
    });
    RS.speech.on(e => { if (e.state === 'denied') { $('#voice-info').textContent = 'Vorlesen ist für diese Seite ausgeschaltet – Untertitel bleiben sichtbar.'; } });
  });
})();
