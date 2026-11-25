# RubberScope Web 2.7 – kostenlos selbst hosten

Die Webseite besteht nur aus statischen Dateien. Gerechnet wird im Browser jedes Nutzers
(Pyodide/WebAssembly), es wird also **kein Server mit Python** gebraucht und keine Bilder werden hochgeladen.

## Variante A: Netlify Drop (2 Minuten, ohne Git)
1. https://app.netlify.com/drop öffnen (kostenloses Konto).
2. Den Ordner `RubberScope_Web_2.7` per Drag & Drop in das Fenster ziehen.
3. Fertig: Netlify zeigt eine Adresse wie `https://<name>.netlify.app`. Unter „Site settings“ lässt sich der Name ändern.

## Variante B: GitHub Pages
1. Neues öffentliches Repository anlegen, z. B. `rubberscope`.
2. Den **Inhalt** dieses Ordners (inkl. `.nojekyll`) hochladen („Add file → Upload files“).
3. Settings → Pages → Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)` → Save.
4. Nach 1–2 Minuten: `https://<benutzername>.github.io/rubberscope/`

## Variante C: Cloudflare Pages
Dashboard → Workers & Pages → Create → Pages → „Upload assets“ → Ordner hochladen.

## Lokal testen
`python -m http.server 8000` in diesem Ordner, dann http://localhost:8000 öffnen
(benötigt Internet für Pyodide von cdn.jsdelivr.net).
Entwicklermodus mit nativem Python: `python lokaler_testserver.py . 8765` und
http://127.0.0.1:8765/index.html?dev=1 (benötigt die Pakete aus requirements.txt der Desktop-Version).

## Hinweise
- Python-Dateien liegen als `py/*.py.txt`, die Pakete reportlab/tifffile als Base64-Text in `wheels/` –
  so werden sie von jedem Hoster als Text ausgeliefert. Die Seite dekodiert sie selbst.
- Downloads (ZIP/PDF) laufen außerhalb von claude.ai als normaler Browser-Download,
  die Sprachausgabe nutzt dann die Stimme des Browsers (deutsche Stimme muss installiert sein).
- Schriftarten DejaVu: Lizenz in `fonts/LICENSE-DejaVu.txt`.

## Update einer bestehenden Netlify-Seite (gleiche Adresse, gleicher QR-Code)

1. In Netlify anmelden → Seite **rubberscope-fh-hda** öffnen → Reiter **Deploys**.
2. Die Datei `RubberScope_Web_2.7_Netlify.zip` entpacken und den entpackten Ordner (darin liegt index.html direkt) in das Feld
   „Drag and drop your project folder here“ ziehen – nicht über „Add new site“, sonst entsteht eine neue Adresse.
3. Nach ca. 30 s ist die neue Version unter https://rubberscope-fh-hda.netlify.app live. Oben links steht „2.7“.
4. Im Browser einmal neu laden (Strg + F5), damit keine alte Version aus dem Zwischenspeicher kommt.
