/* RubberScope Web – Kern: Rechenkern-Anbindung, Hilfsfunktionen, Download, Sprachausgabe, Navigation */
'use strict';
window.RS = window.RS || {};

(() => {
  const RS = window.RS;
  const PYODIDE_VERSION = '314.0.8';
  const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
  RS.PYODIDE_VERSION = PYODIDE_VERSION;

  // ------------------------------------------------------------------ kleine Helfer
  RS.$ = (s, r = document) => r.querySelector(s);
  RS.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  RS.h = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  RS.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RS.num = (x, nd = 4) => {
    if (x === null || x === undefined || x === '' || Number.isNaN(x)) return '–';
    if (typeof x === 'boolean') return x ? 'ja' : 'nein';
    if (typeof x !== 'number') return String(x);
    if (Number.isInteger(x) && Math.abs(x) < 1e7) return x.toLocaleString('de-DE');
    if (x === 0) return '0';
    const m = Math.abs(x);
    if (m < 1e-3 || m >= 1e6) return x.toExponential(nd - 1).replace('.', ',');
    const dec = Math.max(0, nd - 1 - Math.floor(Math.log10(m)));
    return x.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: Math.min(dec, 6) });
  };
  RS.sleep = ms => new Promise(r => setTimeout(r, ms));
  RS.frame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 20)));
  RS.b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  RS.bytesToURL = (bytes, mime) => URL.createObjectURL(new Blob([bytes], { type: mime }));

  // ------------------------------------------------------------------ Meldungen
  RS.toast = (msg, kind = 'info', ms = 4200) => {
    let box = RS.$('#toasts');
    if (!box) { box = RS.h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
    const t = RS.h('div', { class: 'toast ' + kind }, msg);
    box.append(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  };

  RS.dialog = (title, body, buttons = [{ label: 'OK', value: true, primary: true }]) => new Promise(resolve => {
    const wrap = RS.h('div', { class: 'modal-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
    const close = v => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(null); } };
    document.addEventListener('keydown', onKey);
    const content = typeof body === 'string' ? RS.h('div', { html: body }) : body;
    wrap.append(RS.h('div', { class: 'modal' },
      RS.h('h3', {}, title), content,
      RS.h('div', { class: 'modal-buttons' }, buttons.map(b => RS.h('button', {
        class: 'btn ' + (b.primary ? 'primary' : '') + (b.danger ? ' danger' : ''), onclick: () => close(b.value)
      }, b.label)))));
    wrap.addEventListener('click', e => { if (e.target === wrap) close(null); });
    document.body.append(wrap);
    setTimeout(() => RS.$('.modal button.primary', wrap)?.focus(), 30);
  });

  // ------------------------------------------------------------------ Rechenkern
  const DEV = /[?&]dev=1/.test(location.search);
  RS.mode = DEV ? 'dev' : 'pyodide';
  const listeners = new Set();
  RS.engine = { state: 'idle', progress: 0, text: 'Rechenkern noch nicht geladen', info: null };
  RS.onEngine = fn => { listeners.add(fn); fn(RS.engine); return () => listeners.delete(fn); };
  const setEngine = (state, progress, text) => {
    Object.assign(RS.engine, { state, progress, text });
    listeners.forEach(fn => { try { fn(RS.engine); } catch (e) { console.error(e); } });
  };

  let api = null, py = null, readyPromise = null, wheelsInstalled = false;

  // Dateien der Seite werden mit bis zu 3 Versuchen geladen (kurze Netz-/Hosting-Aussetzer)
  async function fetchRetry(url) {
    let last;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(url, { cache: i ? 'reload' : 'default' });
        if (r.ok) return r;
        last = new Error(`${url}: HTTP ${r.status}`);
      } catch (e) { last = e; }
      await RS.sleep(400 * (i + 1));
    }
    throw last;
  }
  async function fetchBytes(url) {
    return new Uint8Array(await (await fetchRetry(url)).arrayBuffer());
  }
  // Wheel-Archive liegen als Base64-Text in Teilen < 700 KB bei (Hosting-Vorgabe)
  const WHEEL_PARTS = { 'reportlab-5.1.0-py3-none-any.whl': 4, 'tifffile-2026.11.16-py3-none-any.whl': 1 };
  async function fetchWheel(name) {
    const parts = await Promise.all(Array.from({ length: WHEEL_PARTS[name] },
      async (_, i) => (await (await fetchRetry(`wheels/${name}.b64.${i}.txt`)).text()).trim()));
    return RS.b64ToBytes(parts.join(''));
  }
  // Alle Zusatzdateien sofort beim Start holen (nicht erst beim Export)
  let extrasPromise = null;
  function prefetchExtras() {
    if (!extrasPromise) extrasPromise = Promise.all([
      fetchWheel('tifffile-2026.11.16-py3-none-any.whl'),
      fetchWheel('reportlab-5.1.0-py3-none-any.whl'),
      fetchBytes('fonts/DejaVuSans.ttf'),
      fetchBytes('fonts/DejaVuSans-Bold.ttf'),
      ...['rubberscope_engine.py', 'rubberscope_berichte.py', 'web_api.py'].map(f => fetchBytes('py/' + f + '.txt')),
    ]).then(([tiff, rl, f1, f2, e, b, w]) => ({ tiff, rl, f1, f2, py: { 'rubberscope_engine.py': e, 'rubberscope_berichte.py': b, 'web_api.py': w } }))
      .catch(err => { extrasPromise = null; throw err; });
    return extrasPromise;
  }
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Skript nicht ladbar: ' + src));
      document.head.append(s);
    });
  }

  async function bootPyodide() {
    setEngine('loading', 3, 'Python-Laufzeit (Pyodide) wird geladen …');
    const extras = prefetchExtras();           // parallel zu Pyodide
    if (!window.loadPyodide) await loadScript(PYODIDE_URL + 'pyodide.js');
    py = await window.loadPyodide({ indexURL: PYODIDE_URL });
    setEngine('loading', 25, 'Wissenschaftliche Bibliotheken: NumPy, SciPy, scikit-image, OpenCV …');
    const pkgs = ['numpy', 'scipy', 'scikit-image', 'opencv-python', 'pillow', 'charset-normalizer'];
    let done = 0;
    await py.loadPackage(pkgs, {
      messageCallback: m => {
        if (/^Loaded /.test(m)) { done++; setEngine('loading', Math.min(80, 25 + done * 3), m.replace('Loaded', 'Geladen:')); }
      }, errorCallback: m => console.warn(m)
    });
    setEngine('loading', 84, 'RubberScope-Rechenkern wird installiert …');
    const x = await extras;
    py.FS.mkdirTree('/rs');
    for (const [f, data] of Object.entries(x.py)) py.FS.writeFile('/rs/' + f, data);
    // reine Python-Pakete (Wheels) und Schriften aus den eigenen Dateien der Seite
    py.FS.writeFile('/tmp/tifffile.whl', x.tiff);
    py.FS.writeFile('/tmp/reportlab.whl', x.rl);
    py.FS.mkdirTree('/usr/share/fonts/truetype/dejavu');
    py.FS.writeFile('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', x.f1);
    py.FS.writeFile('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', x.f2);
    py.runPython(`
import sys, zipfile, site
sp = site.getsitepackages()[0]
zipfile.ZipFile('/tmp/tifffile.whl').extractall(sp)
zipfile.ZipFile('/tmp/reportlab.whl').extractall(sp)
sys.path.insert(0, '/rs')
import web_api as api
`);
    wheelsInstalled = true;
    api = py.globals.get('api');
    setEngine('loading', 94, 'Selbstprüfung (Frangi-Äquivalenz) …');
    await RS.frame();
    RS.engine.info = JSON.parse(api.info());
    setEngine('ready', 100, 'Rechenkern bereit');
  }

  async function bootDev() {
    setEngine('loading', 50, 'Entwicklungsmodus: lokaler Python-Server');
    RS.engine.info = JSON.parse(await devCall('info', []));
    setEngine('ready', 100, 'Rechenkern bereit (Entwicklungsmodus)');
  }

  RS.sourceFile = async f => new TextDecoder().decode((await prefetchExtras()).py[f]);
  RS.loadEngine = () => {
    if (!readyPromise) {
      readyPromise = (DEV ? bootDev() : bootPyodide()).catch(err => {
        console.error(err);
        setEngine('error', 0, 'Rechenkern konnte nicht geladen werden: ' + (err.message || err));
        readyPromise = null;
        throw err;
      });
    }
    return readyPromise;
  };

  async function devCall(fn, args) {
    const enc = await Promise.all(args.map(async a => {
      if (a instanceof Uint8Array) {
        let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
        return { __b64: btoa(s) };
      }
      return a;
    }));
    const r = await fetch('api/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ args: enc }) });
    const ct = r.headers.get('Content-Type') || '';
    if (ct.includes('json')) {
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Serverfehler');
      return j.v;
    }
    return new Uint8Array(await r.arrayBuffer());
  }

  async function ensureWheels() {
    if (wheelsInstalled || DEV) return;   // wird beim Start bereits installiert
  }

  /** Ruft eine Funktion aus web_api.py auf. Liefert String (JSON) oder Uint8Array (Binärdaten). */
  RS.call = async (fn, ...args) => {
    await RS.loadEngine();
    if (['export_zip', 'single_pdf', 'validation'].includes(fn)) await ensureWheels();
    await RS.frame();                      // Oberfläche zeichnen lassen, bevor Python rechnet
    if (DEV) return devCall(fn, args);
    const f = api[fn];
    if (!f) throw new Error('Unbekannte Funktion: ' + fn);
    let res;
    try {
      res = f(...args);
    } catch (e) {
      const msg = String(e.message || e);
      const last = msg.trim().split('\n').filter(Boolean).pop();
      throw new Error(last || msg);
    } finally {
      if (f.destroy) f.destroy();
    }
    if (res && typeof res === 'object') {
      try {
        if (res.getBuffer) {                 // Python-bytes -> Uint8Array (Kopie)
          const buf = res.getBuffer('u8');
          const out = buf.data.slice();
          buf.release();
          return out;
        }
        const out = res.toJs();
        return out instanceof Uint8Array ? out : new Uint8Array(out);
      } finally { res.destroy && res.destroy(); }
    }
    return res;
  };
  RS.callJSON = async (fn, ...args) => JSON.parse(await RS.call(fn, ...args));

  // ------------------------------------------------------------------ Download
  let dlCap; // undefined = unbekannt, null = nicht verfügbar
  RS.capReady = (async () => {
    if (!window.claude || !window.claude.use) return;
    try { dlCap = await window.claude.use('downloads'); } catch { dlCap = null; }
  })();

  RS.download = async (filename, data, mime = 'application/octet-stream') => {
    if (window.claude && window.claude.use && dlCap === undefined) await RS.capReady;
    if (dlCap) {
      try {
        await dlCap.save({ filename, data: data instanceof Uint8Array ? data.slice() : data });
        RS.toast('Gespeichert: ' + filename, 'ok');
        return true;
      } catch (e) {
        if (e && e.code === 'declined') { RS.toast('Speichern abgebrochen.'); return false; }
        if (e && e.code === 'rate_limited') { RS.toast('Bitte kurz warten – es ist noch ein Speichern-Dialog offen.', 'warn'); return false; }
        console.warn('downloads capability', e);
      }
    }
    // Normaler Browser-Download (z. B. bei eigenem Hosting auf GitHub Pages / Netlify)
    try {
      const url = RS.bytesToURL(data, mime);
      const a = RS.h('a', { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return true;
    } catch (e) {
      RS.toast('Download in dieser Ansicht nicht möglich.', 'err');
      return false;
    }
  };

  // ------------------------------------------------------------------ Sprachausgabe
  // 1. Claude-Stimme (tts-Fähigkeit der Seite, falls angeboten)  2. Browser-Stimme (Web Speech API)
  const speech = RS.speech = { mode: 'none', state: 'idle', rate: 1, listeners: new Set(), cap: null, denied: false };
  speech.on = fn => { speech.listeners.add(fn); return () => speech.listeners.delete(fn); };
  const emit = (state, extra = {}) => { speech.state = state; speech.listeners.forEach(f => f({ state, ...extra })); };
  speech.ready = (async () => {
    if (window.claude && window.claude.use) {
      try { speech.cap = await window.claude.use('tts'); } catch { speech.cap = null; }
    }
    if (speech.cap) {
      speech.mode = 'claude';
      speech.cap.onState(({ state, reason }) => {
        if (state === 'idle' && reason === 'not_granted') { speech.denied = true; emit('denied'); return; }
        emit(state === 'idle' ? 'idle' : state === 'paused' ? 'paused' : 'speaking', { reason });
      });
      speech.cap.onLine(({ id }) => emit('speaking', { lineId: id }));
    } else if ('speechSynthesis' in window) {
      speech.mode = 'browser';
    }
    speech.hasGerman = () => speech.mode !== 'browser' || !!germanVoice();
    speech.listeners.forEach(f => f({ state: speech.state }));
  })();

  function germanVoice() {
    const vs = window.speechSynthesis.getVoices();
    return vs.find(v => /^de(-|_)DE/i.test(v.lang) && /natural|neural|online|google/i.test(v.name)) ||
      vs.find(v => /^de/i.test(v.lang)) || null;
  }

  /** lines: [{id, text}] – liest der Reihe nach vor; onLine(id) wird bei jeder Zeile gerufen. */
  speech.play = async (lines, onLine) => {
    await speech.ready;
    speech.stop(true);
    speech._onLine = onLine;
    const mode = speech.denied ? 'none' : speech.mode;   // ausgeschaltet -> nur Untertitel, keine Ersatzstimme
    if (mode === 'claude') {
      const off = speech.cap.onLine(({ id }) => onLine && onLine(id));
      speech._off = off;
      try {
        await speech.cap.speak(lines.map(l => ({ text: l.text.slice(0, 1990), id: l.id })), { language: 'de', rate: speech.rate });
        return 'completed';
      } catch (e) {
        if (e && e.code === 'not_granted') { speech.denied = true; emit('denied'); }
        if (e && e.code === 'no_gesture') RS.toast('Bitte zum Vorlesen einmal auf die Seite klicken.', 'warn');
        return 'stopped';
      } finally { off && off(); }
    }
    if (mode === 'browser') {
      const synth = window.speechSynthesis;
      speech._cancelled = false;
      emit('speaking');
      for (const l of lines) {
        if (speech._cancelled) break;
        onLine && onLine(l.id);
        const t0 = Date.now(), expect = l.text.split(/\s+/).length * 380 / speech.rate;
        await new Promise(res => {
          const u = new SpeechSynthesisUtterance(l.text);
          u.lang = 'de-DE'; u.rate = speech.rate;
          const v = germanVoice(); if (v) u.voice = v;
          u.onend = res; u.onerror = res;
          synth.speak(u);
          // Chrome-Eigenheit: lange Ausgaben pausieren; regelmäßig anstoßen
          const keep = setInterval(() => { if (!synth.speaking) clearInterval(keep); else if (!synth.paused) { synth.pause(); synth.resume(); } }, 10000);
          u.addEventListener('end', () => clearInterval(keep));
        });
        // Ohne passende Stimme endet die Ausgabe sofort: dann Lesezeit für die Untertitel abwarten
        while (!speech._cancelled && Date.now() - t0 < expect * 0.6) await RS.sleep(120);
        while (speech.state === 'paused' && !speech._cancelled) await RS.sleep(150);
      }
      const r = speech._cancelled ? 'stopped' : 'completed';
      emit('idle', { reason: r });
      return r;
    }
    // ohne Stimme: Text wird nur angezeigt, Zeit nach Wortanzahl
    speech._cancelled = false;
    emit('speaking');
    for (const l of lines) {
      if (speech._cancelled) break;
      onLine && onLine(l.id);
      const ms = Math.max(2500, l.text.split(/\s+/).length * 380 / speech.rate);
      const t0 = Date.now();
      while (Date.now() - t0 < ms && !speech._cancelled) { await RS.sleep(120); if (speech.state === 'paused') { const p0 = Date.now(); while (speech.state === 'paused' && !speech._cancelled) await RS.sleep(150); } }
    }
    const r = speech._cancelled ? 'stopped' : 'completed';
    emit('idle', { reason: r });
    return r;
  };
  speech.stop = (silent) => {
    speech._cancelled = true;
    if (speech._audioStop) { speech._audioStop(); return; }
    if (speech.mode === 'claude' && speech.cap) speech.cap.stop().catch(() => { });
    if (speech.mode === 'browser') window.speechSynthesis.cancel();
    if (!silent) emit('idle', { reason: 'stopped' });
  };
  speech.pause = () => {
    if (speech._audio) { speech._audio.pause(); emit('paused'); return; }
    if (speech.mode === 'claude') speech.cap.pause().catch(() => { });
    else if (speech.mode === 'browser') window.speechSynthesis.pause();
    emit('paused');
  };
  speech.resume = () => {
    if (speech._audio) { speech._audio.play().catch(() => { }); emit('speaking'); return; }
    if (speech.mode === 'claude') speech.cap.resume().catch(() => { });
    else if (speech.mode === 'browser') window.speechSynthesis.resume();
    emit('speaking');
  };
  // 3. Aufgenommene Sprecherstimme: eine Datei je Kapitel; Untertitel wechseln nach gemessenen Satzanfängen
  speech.playAudio = (src, starts, lines, onLine) => new Promise(resolve => {
    speech.stop(true);
    const a = speech.audioEl || (speech.audioEl = new Audio());
    a.preload = 'auto'; a.src = src; a.playbackRate = speech.rate;
    let cur = -1, done = false, raf = 0;
    const finish = r => {
      if (done) return; done = true; cancelAnimationFrame(raf);
      a.onended = a.onerror = null; speech._audioStop = null; speech._audio = null;
      emit('idle', { reason: r }); resolve(r);
    };
    const tick = () => {
      if (done) return;
      const t = a.currentTime; let i = 0;
      while (i + 1 < starts.length && t >= starts[i + 1] - 0.05) i++;
      if (i !== cur) { cur = i; onLine && onLine(lines[Math.min(i, lines.length - 1)].id); }
      raf = requestAnimationFrame(tick);
    };
    speech._audio = a;
    speech._audioStop = () => { try { a.pause(); } catch { } finish('stopped'); };
    a.onended = () => finish('completed');
    a.onerror = () => finish('error');
    a.play().then(() => { emit('speaking'); tick(); })
      .catch(e => { if (e && e.name === 'NotAllowedError') RS.toast('Bitte zum Vorlesen einmal auf die Seite klicken.', 'warn'); finish(e && e.name === 'NotAllowedError' ? 'stopped' : 'error'); });
  });
  speech.setRate = r => {
    speech.rate = r;
    if (speech.audioEl) speech.audioEl.playbackRate = r;
    if (speech.mode === 'claude' && speech.cap && speech.cap.setRate) speech.cap.setRate(r).catch(() => { });
  };

  // ------------------------------------------------------------------ Navigation (#start, #lernen, …)
  const ROUTES = ['start', 'lernen', 'analyse', 'methodik', 'validierung', 'quellen', 'hilfe'];
  RS.routes = {};
  RS.go = name => { if (location.hash !== '#' + name) location.hash = name; else route(); };
  function route() {
    const name = (location.hash || '#start').slice(1);
    const r = ROUTES.includes(name) ? name : 'start';
    RS.$$('main > section.view').forEach(s => s.hidden = s.id !== 'view-' + r);
    RS.$$('nav.tabs a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + r));
    if (RS.routes[r]) RS.routes[r]();
    window.scrollTo(0, 0);
    document.title = 'RubberScope Web – ' + (RS.$(`nav.tabs a[href="#${r}"]`)?.textContent || '');
  }
  window.addEventListener('hashchange', route);
  RS.startRouter = route;

  // ------------------------------------------------------------------ Statusanzeige Rechenkern
  RS.onEngine(e => {
    const b = RS.$('#engine-badge');
    if (!b) return;
    b.dataset.state = e.state;
    const label = { idle: 'Rechenkern: nicht geladen', loading: `Rechenkern lädt … ${e.progress} %`, ready: 'Rechenkern bereit', error: 'Rechenkern: Fehler' }[e.state];
    RS.$('.label', b).textContent = label;
    b.title = e.text;
    const bar = RS.$('.bar i', b);
    if (bar) bar.style.width = (e.state === 'ready' ? 100 : e.progress) + '%';
  });
})();
