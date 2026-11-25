/* RubberScope Web – Inhalte: Lernpfad-Kapitel (Text, Sprechertext, Selbsttest), Methodik, Hilfe */
'use strict';
(() => {
  const RS = window.RS, c = (...a) => RS.cite(...a);

  RS.CHAPTERS = [
    // ------------------------------------------------------------------ 1
    {
      id: 'ozon', title: 'Ozonrisse: Was wir messen wollen', min: 5, demo: 'strain', stage: null,
      html: () => `
<p>Ozon (O<sub>3</sub>) reagiert mit den <b>C=C-Doppelbindungen</b> ungesättigter Kautschuke. Nach dem Mechanismus von Criegee lagert sich Ozon an die Doppelbindung an. Über ein instabiles Primärozonid zerfällt die Bindung, und die Polymerkette wird gespalten ${c('L03')}. NBR (Acrylnitril-Butadien-Kautschuk) enthält Butadien-Einheiten mit solchen Doppelbindungen und ist deshalb grundsätzlich ozonempfindlich.</p>
<p>Ohne mechanische Spannung bleibt der Angriff auf eine dünne Oberflächenschicht beschränkt. Wird die Probe <b>gedehnt</b>, öffnen sich die gespaltenen Bereiche zu Rissen. Braden und Gent zeigten, dass Risswachstum erst oberhalb einer <b>kritischen Spannung bzw. Reißenergie</b> einsetzt und dann mit einer nahezu spannungsunabhängigen Geschwindigkeit verläuft ${c('L01', 'L02')}.</p>
<figure class="scheme"><img src="img/ozonolyse_schema.png" alt="Reaktionsschema der Ozonolyse: C=C-Doppelbindung plus Ozon bildet das Primärozonid, das in Carbonylverbindung und Carbonyloxid zerfällt; ohne Dehnung entsteht das Sekundärozonid, im gedehnten Gummi öffnet sich ein Riss." loading="lazy"><figcaption class="small muted">Ozonolyse nach Criegee ${c('L03')}: Ozon addiert an die Doppelbindung (Primärozonid), der Ring zerfällt in eine Carbonylverbindung und ein Carbonyloxid – die Kette ist gespalten. Unter Dehnung weichen die Enden auseinander, statt zum Sekundärozonid zu rekombinieren ${c('L01')}.</figcaption></figure>
<div class="callout"><b>Kernidee für die Bildanalyse:</b> Ozonrisse stehen bevorzugt <b>senkrecht zur Hauptzugrichtung</b>. Riefen aus der Formgebung oder Kratzer liegen oft anders. Deshalb fragt RubberScope nach der Dehnrichtung und wertet den Winkel jedes Objekts dazu aus.</div>
<p>Die Prüfung der Ozonrissbeständigkeit ist in ISO 1431-1 genormt (statische und dynamische Dehnung, definierte Ozonkonzentration, Temperatur und Feuchte) ${c('Q16')}. Die Norm bewertet <b>visuell</b>. RubberScope ergänzt das um <b>reproduzierbare Bildkennwerte</b>:</p>
<ul>
<li><b>Risslänge</b> L und <b>Risslängendichte</b> L<sub>A</sub> = ΣL / A<sub>eval</sub> [mm/mm²]</li>
<li><b>mittlere Rissbreite</b> w̄ aus Grauwertprofilen quer zum Riss und Flächenanteil φ</li>
<li><b>Orientierung</b> zur Dehnrichtung und Längenanteil „quer zur Dehnung“</li>
</ul>
<p class="small muted">Das Programm erkennt Linienstrukturen im Bild, nicht deren chemische Ursache. Ob eine Linie ein Ozonriss ist, entscheidet am Ende die fachkundige Person (Klassifikation, Kapitel 10).</p>`,
      narr: [
        'Willkommen bei RubberScope. In diesem ersten Kapitel geht es darum, was Ozonrisse sind und was wir an ihnen messen wollen.',
        'Ozon greift die Kohlenstoff-Doppelbindungen ungesättigter Kautschuke an. Nach dem Mechanismus von Criegee lagert sich Ozon zunächst an die Doppelbindung an und bildet das Primärozonid. Dieser Ring zerfällt sofort in eine Carbonylverbindung und ein Carbonyloxid – damit ist die Polymerkette gespalten. Das Schema zeigt die Schritte. NBR enthält Butadien-Einheiten mit solchen Doppelbindungen und ist deshalb ozonempfindlich.',
        'Entscheidend ist die Dehnung. Erst wenn die Probe gedehnt ist und eine kritische Spannung überschritten wird, öffnen sich die geschädigten Bereiche zu Rissen. Das haben Braden und Gent schon 1960 gezeigt.',
        'Für die Bildanalyse ist eine Eigenschaft besonders nützlich: Ozonrisse stehen bevorzugt senkrecht zur Zugrichtung. Im Experiment rechts kannst du die Dehnung verändern und beobachten, wie die Risse quer zur Zugrichtung entstehen.',
        'Die Norm ISO 1431-1 bewertet Ozonrisse visuell. RubberScope ergänzt das um messbare, reproduzierbare Kennwerte: Risslänge, Risslängendichte, mittlere Breite, Flächenanteil und die Orientierung zur Dehnrichtung.',
      ],
      quiz: [
        { q: 'Warum fragt RubberScope nach der Dehnrichtung?', opts: ['Um das Bild zu drehen', 'Weil Ozonrisse bevorzugt senkrecht zur Zugrichtung stehen und so von parallelen Riefen unterschieden werden können', 'Weil die Norm eine Bilddrehung verlangt'], a: 1, why: 'Die Orientierung relativ zur Dehnung ist ein starkes, aber kein eindeutiges Indiz für Ozonrisse.' },
        { q: 'Was liefert RubberScope nicht?', opts: ['Eine Risslängendichte in mm/mm²', 'Eine normkonforme Einstufung nach ISO 1431-1', 'Den Winkel jedes Objekts zur Dehnrichtung'], a: 1, why: 'Die Kennwerte sind explorativ; die Normbewertung bleibt visuell.' },
      ],
    },
    // ------------------------------------------------------------------ 2
    {
      id: 'bild', title: 'Vom Mikroskopbild zur Zahl: Pixel, Maßstab, Auflösung', min: 5, demo: 'optics', stage: 'grau',
      html: () => `
<p>Ein Digitalbild ist ein Raster aus Pixeln. Jeder Pixel hat eine Helligkeit. Farbbilder werden nach ITU-R BT.601 in Graustufen umgerechnet ${c('Q01', 'R01')}:</p>
<div class="formula">Y = 0,299·R + 0,587·G + 0,114·B</div>
<p>12- oder 16-bit-Rohdaten werden linear auf 8 bit abgebildet. Neu in Version 2.5: Liegen 8-bit-Werte in einem 16-bit-Container (Maximum ≤ 255), werden sie unverändert übernommen, statt sie auf nur 16 Graustufen zusammenzudrücken ${c('R01')}.</p>
<h4>Maßstab (Pixelkalibrierung)</h4>
<p>Erst mit der <b>Pixelgröße s</b> [µm/Pixel] werden aus Pixeln physikalische Größen ${c('R04')}:</p>
<div class="formula">A = N<sub>px</sub> · s² &nbsp;&nbsp;&nbsp; L = L<sub>px</sub> · s</div>
<p>s bestimmt man mit einem Objektmikrometer oder dem Maßstabsbalken im Bild (Werkzeug 📏). Ohne Kalibrierung gibt RubberScope nur Pixelwerte aus.</p>
<h4>Was das Mikroskop überhaupt auflösen kann</h4>
<p>Die optische Auflösung begrenzt, wie schmale Risse noch getrennt abgebildet werden. Nach dem Rayleigh-Kriterium gilt ${c('L05')}:</p>
<div class="formula">d = 0,61 · λ / NA</div>
<p>Damit die Kamera diese Details nicht verliert, sollte die Pixelgröße höchstens etwa die Hälfte von d betragen (Nyquist-Abtastung) ${c('L06')}. Rissbreiten unter etwa 2–3 Pixeln oder unter d sind nicht belastbar. Trägst du beim Export die numerische Apertur ein, prüft das Protokoll diese Bedingung automatisch.</p>
<p class="small">Jede Rohdatei erhält einen <b>SHA-256-Prüfwert</b> ${c('Q15')}, damit Ergebnis und Bild eindeutig zusammengehören.</p>`,
      narr: [
        'Kapitel zwei: Wie aus einem Mikroskopbild Zahlen werden.',
        'Ein Digitalbild ist ein Raster aus Pixeln. Farbbilder werden mit den Gewichten aus der Norm ITU-R BT.601 in Graustufen umgerechnet. Grün zählt dabei am stärksten, weil das Auge dafür am empfindlichsten ist.',
        'Damit aus Pixeln Mikrometer werden, braucht man die Pixelgröße s, also Mikrometer pro Pixel. Flächen skalieren mit s zum Quadrat, Längen mit s. Ohne diese Kalibrierung gibt das Programm nur Pixelwerte aus.',
        'Wichtig ist auch, was die Optik überhaupt auflösen kann. Nach dem Rayleigh-Kriterium ist das kleinste auflösbare Detail 0,61 mal Wellenlänge durch numerische Apertur. Die Pixelgröße sollte höchstens die Hälfte davon sein.',
        'Probiere im Rechner rechts aus, wie Objektiv-Apertur und Pixelgröße zusammenpassen. Rissbreiten unter etwa zwei bis drei Pixeln sind grundsätzlich nicht belastbar.',
      ],
      quiz: [
        { q: 'Die Pixelgröße wird um 2 % zu groß angenommen. Wie stark ändert sich die Fläche A = N·s²?', opts: ['um etwa 2 %', 'um etwa 4 %', 'gar nicht'], a: 1, why: 'Relative Unsicherheit verdoppelt sich bei s²: u(A)/A ≈ 2·u(s)/s (Kapitel 11).' },
        { q: 'Objektiv NA = 0,25, λ = 550 nm. Welche Pixelgröße erfüllt Nyquist?', opts: ['0,5 µm/px', '1,0 µm/px', '2,0 µm/px'], a: 0, why: 'd = 0,61·0,55/0,25 ≈ 1,34 µm; d/2 ≈ 0,67 µm → 0,5 µm/px erfüllt die Bedingung.' },
      ],
    },
    // ------------------------------------------------------------------ 3
    {
      id: 'weber', title: 'Ungleichmäßige Beleuchtung: Hintergrund und Weber-Kontrast', min: 5, demo: 'weber', stage: 'weber',
      html: () => `
<p>Mikroskopbilder sind selten gleichmäßig ausgeleuchtet. Ein fester Grauwert-Schwellwert würde in hellen Bereichen andere Risse finden als in dunklen. RubberScope arbeitet deshalb mit einem <b>relativen</b> Kontrast.</p>
<p>Zuerst wird der lokale Hintergrund I<sub>B</sub> durch starke Gauß-Glättung geschätzt ${c('Q02', 'R02')}:</p>
<div class="formula">I<sub>B</sub> = G<sub>σ</sub> ∗ I &nbsp;&nbsp; mit σ = max(8; min(H,W)/22)<span class="lbl">Präzisionsverfahren</span></div>
<p>Ein Riss ist eine lokale Abdunklung gegenüber diesem Hintergrund. Der <b>Weber-Kontrast</b> misst sie relativ:</p>
<div class="formula">C = (I<sub>B</sub> − I) / I<sub>B</sub></div>
<p><b>Warum relativ?</b> Wird die Beleuchtung um den Faktor a heller, gilt I → a·I und I<sub>B</sub> → a·I<sub>B</sub>, und C bleibt gleich. Ein Riss mit 20 % Abdunklung wird also im hellen und im dunklen Bildteil gleich bewertet. Probiere es rechts aus.</p>
<div class="callout small">Für große σ rechnet das Programm den Hintergrund auf einem verkleinerten Bild und skaliert zurück. Das ist numerisch nahezu identisch, aber viel schneller ${c('R02')}.</div>
<p>Das Bild darunter zeigt die relative Abdunklung 1 − I/I<sub>B</sub> des Lernbilds. Der Helligkeitsverlauf von links nach rechts ist verschwunden, Risse und Poren treten hervor.</p>`,
      narr: [
        'Kapitel drei: Wie das Programm mit ungleichmäßiger Beleuchtung umgeht.',
        'Ein fester Grauwert-Schwellwert funktioniert bei Mikroskopbildern schlecht, denn die Ausleuchtung ist fast nie gleichmäßig. Deshalb schätzt RubberScope zuerst den lokalen Hintergrund durch eine starke Gauß-Glättung.',
        'Ein Riss ist dann eine lokale Abdunklung gegenüber diesem Hintergrund. Gemessen wird sie als Weber-Kontrast: Hintergrund minus Bild, geteilt durch den Hintergrund.',
        'Der Vorteil: Wird die Beleuchtung insgesamt heller oder dunkler, kürzt sich der Faktor heraus. Ein Riss mit zwanzig Prozent Abdunklung wird überall gleich bewertet. Im Experiment rechts kannst du das prüfen.',
        'Im Lernbild unten siehst du das Ergebnis: Der Helligkeitsverlauf ist weg, Risse und Poren treten deutlich hervor.',
      ],
      quiz: [
        { q: 'Die Beleuchtung wird überall doppelt so hell. Was passiert mit dem Weber-Kontrast eines Risses?', opts: ['Er verdoppelt sich', 'Er bleibt gleich', 'Er halbiert sich'], a: 1, why: 'Zähler und Nenner skalieren beide mit dem Faktor 2.' },
      ],
    },
    // ------------------------------------------------------------------ 4
    {
      id: 'frangi', title: 'Linien finden: der Frangi-Filter (Hesse-Matrix)', min: 7, demo: 'hessian', stage: 'frangi',
      html: () => `
<p>Risse sind <b>linienförmig</b>: schmal in einer Richtung und lang in der anderen. Diese Form lässt sich mit der <b>Hesse-Matrix</b> der zweiten Ableitungen der (geglätteten) Bildhelligkeit erkennen ${c('Q03')}:</p>
<div class="formula">H<sub>σ</sub> = [[I<sub>xx</sub>, I<sub>xy</sub>], [I<sub>xy</sub>, I<sub>yy</sub>]]</div>
<p>Ihre Eigenwerte λ<sub>1</sub>, λ<sub>2</sub> (sortiert nach Betrag, |λ<sub>1</sub>| ≤ |λ<sub>2</sub>|) beschreiben die Krümmung entlang und quer zur Struktur:</p>
<ul>
<li><b>Linie:</b> |λ<sub>1</sub>| ≈ 0 (entlang flach), |λ<sub>2</sub>| groß (quer stark gekrümmt)</li>
<li><b>Fleck/Pore:</b> |λ<sub>1</sub>| ≈ |λ<sub>2</sub>| (in alle Richtungen gekrümmt)</li>
<li><b>Hintergrund:</b> beide klein</li>
</ul>
<p>Frangi et al. fassen das in einem <b>Linienmaß V</b> zusammen ${c('Q03', 'Q04')}:</p>
<div class="formula">R<sub>B</sub> = |λ<sub>1</sub>|/|λ<sub>2</sub>| &nbsp;&nbsp; S = √(λ<sub>1</sub>² + λ<sub>2</sub>²) &nbsp;&nbsp; V = exp(−R<sub>B</sub>²/2β²) · (1 − exp(−S²/2c²))</div>
<p>Der erste Faktor unterdrückt Flecken, der zweite schwachen Hintergrund. RubberScope verwendet β = 0,5 und einen <b>festen</b> Strukturparameter c = 0,05 ${c('R03')}, damit V zwischen verschiedenen Bildern vergleichbar bleibt. Da Risse unterschiedlich breit sind, wird über mehrere Skalen σ ∈ {1; 1,6; 2,5; 3,5} px gerechnet und je Pixel das Maximum genommen.</p>
<p>Berechnet wird V auf dem relativen Abdunklungsbild aus Kapitel 3, also beleuchtungsunabhängig.</p>
<div class="callout small"><b>Neu in 2.5:</b> Die Hesse-Matrix wird mit OpenCV statt scipy gefaltet: <b>dieselben</b> Gauß-Ableitungskerne, derselbe Randmodus. Die Abweichung zu scikit-image liegt unter 2·10<sup>−7</sup>, kein Pixel kippt über eine Schwelle, und die Rechnung ist etwa 3–6-mal schneller. Jeder Start prüft das automatisch ${c('R03')}.</div>`,
      narr: [
        'Kapitel vier, das Herzstück: Wie findet das Programm Linien?',
        'Risse sind schmal in einer Richtung und lang in der anderen. Diese Form erkennt man mit der Hesse-Matrix, der Matrix der zweiten Ableitungen der geglätteten Helligkeit.',
        'Ihre beiden Eigenwerte beschreiben die Krümmung. Bei einer Linie ist die Krümmung entlang der Linie fast null und quer dazu groß. Bei einer Pore sind beide Krümmungen ähnlich groß. Im Hintergrund sind beide klein.',
        'Frangi und Kollegen haben daraus 1998 ein Linienmaß gebaut. Ein Faktor bestraft rundliche Strukturen, ein zweiter bestraft zu schwache Strukturen. Heraus kommt ein Wert zwischen null und eins.',
        'Weil Risse unterschiedlich breit sind, rechnet RubberScope auf vier Skalen und nimmt je Pixel den größten Wert. Im Experiment rechts kannst du die Skala verändern und sehen, dass Linien stark antworten, Flecken dagegen kaum.',
        'Gerechnet wird mit OpenCV, mit denselben Kernen wie in scikit-image. Das Ergebnis ist bis auf Rundung gleich, aber mehrfach schneller.',
      ],
      quiz: [
        { q: 'Welche Eigenwert-Kombination kennzeichnet eine Linie?', opts: ['|λ1| ≈ |λ2|, beide groß', '|λ1| ≈ 0, |λ2| groß', 'beide ≈ 0'], a: 1, why: 'Entlang der Linie keine Krümmung, quer dazu starke.' },
        { q: 'Warum ist c = 0,05 fest und nicht wie im Original bildabhängig?', opts: ['Damit V zwischen Bildern vergleichbar bleibt', 'Weil es schneller ist', 'Weil ISO 1431-1 es vorschreibt'], a: 0, why: 'Eine bildabhängige Normierung würde jedes Bild anders skalieren (Eigenfestlegung R03).' },
      ],
    },
    // ------------------------------------------------------------------ 5
    {
      id: 'blackhat', title: 'Wie tief ist die Abdunklung? Black-Hat-Transformation', min: 4, demo: 'blackhat', stage: 'blackhat',
      html: () => `
<p>Der Frangi-Filter bewertet die <b>Form</b>. Ein zweites, unabhängiges Merkmal bewertet die <b>Stärke</b> der lokalen Abdunklung: die morphologische <b>Black-Hat-Transformation</b> ${c('Q05')}.</p>
<p>Dazu wird das Bild mit einem Strukturelement B <b>geschlossen</b> (erst Dilatation = lokales Maximum, dann Erosion = lokales Minimum). Dunkle Täler, die schmaler als B sind, werden dabei „zugeschüttet“. Die Differenz zum Original ist genau die Tiefe dieser Täler:</p>
<div class="formula">BH<sub>B</sub> = (I • B) − I &nbsp;&nbsp;&nbsp; C = max<sub>B</sub> BH<sub>B</sub> / I<sub>B</sub></div>
<p>RubberScope nutzt elliptische Strukturelemente mit 9, 17 und 27 Pixeln Durchmesser und nimmt das Maximum. Geteilt durch den Hintergrund wird daraus wieder ein relativer Kontrast ${c('R03')}.</p>
<div class="callout warn small">C ist ein <b>Helligkeitskontrast</b>, keine Risstiefe im physikalischen Sinn. Über die Tiefe eines Risses sagt ein Auflichtbild nichts Verlässliches aus.</div>
<p>Rechts siehst du ein Helligkeitsprofil quer über zwei Risse. Wird das Strukturelement kleiner als die Rissbreite, „passt“ es in den Riss und die Black-Hat-Antwort bricht ein.</p>`,
      narr: [
        'Kapitel fünf: die Black-Hat-Transformation.',
        'Der Frangi-Filter bewertet die Form. Ein zweites Merkmal bewertet, wie stark die Abdunklung ist. Dazu wird das Bild morphologisch geschlossen: zuerst lokales Maximum, dann lokales Minimum.',
        'Dunkle Täler, die schmaler als das Strukturelement sind, werden dabei aufgefüllt. Die Differenz zum Original ist die Tiefe dieser Täler. Geteilt durch den Hintergrund ergibt sich ein relativer Kontrast.',
        'Wichtig: Das ist ein Helligkeitskontrast, keine physikalische Risstiefe. Rechts siehst du, was passiert, wenn das Strukturelement kleiner als die Rissbreite wird.',
      ],
      quiz: [
        { q: 'Was misst die Black-Hat-Transformation?', opts: ['Die physikalische Risstiefe in µm', 'Die Helligkeitstiefe schmaler dunkler Strukturen relativ zur Umgebung', 'Die Rissorientierung'], a: 1, why: 'Ein Auflichtbild enthält keine verlässliche Tiefeninformation.' },
      ],
    },
    // ------------------------------------------------------------------ 6
    {
      id: 'score', title: 'Entscheiden: Score, Empfindlichkeit k und Hysterese', min: 6, demo: 'hysteresis', stage: 'hysterese',
      html: () => `
<p>Ein Pixel gilt nur dann als rissverdächtig, wenn <b>beide</b> Merkmale ansprechen: linienförmig (V) <b>und</b> deutlich dunkler (C). Das erreicht das Minimum ${c('R03')}:</p>
<div class="formula">Score = k · min( V / 0,25 ; C / 0,15 )</div>
<p>V<sub>ref</sub> = 0,25 und C<sub>ref</sub> = 0,15 sind <b>Eigenfestlegungen</b> (keine Norm- oder Literaturwerte). Der Empfindlichkeitsfaktor k skaliert beide Schwellen: k = 1,2 bedeutet, dass 0,25/1,2 bzw. 15 %/1,2 Kontrast genügen.</p>
<h4>Hysterese: zwei Schwellen statt einer</h4>
<p>Ein einzelner Schwellwert zerreißt schwach kontrastierte Risse in Stücke. Die <b>Hysterese</b> aus der Kantendetektion nach Canny löst das ${c('L04', 'Q04')}:</p>
<ul>
<li>Pixel mit Score ≥ 1,0 sind <b>sicher</b> (stark).</li>
<li>Pixel mit 0,5 ≤ Score &lt; 1,0 werden nur übernommen, wenn sie mit einem starken Pixel <b>verbunden</b> sind.</li>
<li>Isolierte schwache Pixel werden verworfen.</li>
</ul>
<p>So bleibt ein Riss durchgehend, dessen Kontrast stellenweise nachlässt, während einzelne Rauschpunkte wegfallen. Im Lernbild: <span style="color:#d4a017">■</span> stark, <span style="color:#5fb5d6">■</span> schwach und verbunden (übernommen), <span style="color:#7a7ab0">■</span> schwach und isoliert (verworfen).</p>
<p class="small">Bewusst <b>kein</b> morphologisches Schließen danach, damit benachbarte Einzelrisse nicht verschmelzen.</p>`,
      narr: [
        'Kapitel sechs: Wie wird entschieden, was ein Risspixel ist?',
        'Ein Pixel muss beide Merkmale erfüllen. Er muss linienförmig sein und deutlich dunkler als die Umgebung. Das Programm nimmt deshalb das Minimum der beiden normierten Werte und multipliziert es mit der Empfindlichkeit k.',
        'Die Bezugswerte 0,25 und 0,15 sind Festlegungen dieses Programms, keine Normwerte. Ein größeres k senkt beide Schwellen, es wird also mehr erkannt.',
        'Dann folgt die Hysterese, bekannt aus dem Canny-Kantendetektor. Pixel mit einem Score über eins sind sicher. Pixel zwischen 0,5 und eins werden nur übernommen, wenn sie mit einem sicheren Pixel verbunden sind.',
        'So bleiben Risse durchgehend, auch wenn ihr Kontrast schwankt, und einzelne Rauschpunkte fallen weg. Im Experiment rechts kannst du k verändern und sehen, welche Abschnitte eines Rissprofils übernommen werden.',
      ],
      quiz: [
        { q: 'Ein Abschnitt hat Score 0,7 und ist mit einem Abschnitt mit Score 1,3 verbunden. Wird er übernommen?', opts: ['Ja', 'Nein'], a: 0, why: '0,5 ≤ 0,7 < 1 → schwach, aber verbunden → übernommen.' },
        { q: 'Was bewirkt k = 0,5?', opts: ['Doppelt so strenge Schwellen, weniger Treffer', 'Doppelt so viele Skalen', 'Halbe Bildauflösung'], a: 0, why: 'Score = k·min(…); mit k = 0,5 braucht es doppelt so hohe V- und C-Werte.' },
      ],
    },
    // ------------------------------------------------------------------ 7
    {
      id: 'form', title: 'Objekte bilden und Formen filtern', min: 5, demo: 'ellipse', stage: 'formfilter',
      html: () => `
<p>Zusammenhängende Risspixel (8-Nachbarschaft: auch diagonal) werden zu <b>Objekten</b> zusammengefasst. Danach entfernt ein Formfilter alles, was nicht linienartig ist ${c('R03', 'R04')}:</p>
<ol>
<li>Fläche ≥ A<sub>min</sub> (Standard 16 px²)</li>
<li>Skelettpixel ≥ max(12; 2,5·√A<sub>min</sub>)</li>
<li><b>Exzentrizität</b> e ≥ 0,68 <b>oder</b> Skelett ≥ 40 Pixel</li>
</ol>
<p>Die Exzentrizität stammt aus den <b>zentralen Bildmomenten</b> zweiter Ordnung des Objekts ${c('Q08', 'Q09')}. Die Momente μ<sub>20</sub>, μ<sub>02</sub>, μ<sub>11</sub> bilden eine Kovarianzmatrix, deren Eigenwerte λ<sub>groß</sub> ≥ λ<sub>klein</sub> die Ausdehnung entlang der Haupt- und Nebenachse beschreiben:</p>
<div class="formula">e = √(1 − λ<sub>klein</sub>/λ<sub>groß</sub>) &nbsp;&nbsp;&nbsp; θ = ½ · atan2(2μ<sub>11</sub> ; μ<sub>20</sub> − μ<sub>02</sub>)</div>
<p>Ein Kreis hat e = 0, eine sehr gestreckte Ellipse e → 1. θ ist die Orientierung der Hauptachse (wichtig für Kapitel 9).</p>
<div class="callout warn small">Nicht verwechseln: Diese Momente-Eigenwerte beschreiben die <b>Objektform</b>. Die Hesse-Eigenwerte aus Kapitel 4 beschreiben die <b>lokale Krümmung</b> der Helligkeit.</div>
<p>Im Lernbild: <span style="color:#10e0cf">■</span> behalten, <span style="color:#eb4646">■</span> vom Formfilter entfernt (kleine Poren). Große Poren hat der Frangi-Filter bereits gar nicht erst als Linie gewertet.</p>`,
      narr: [
        'Kapitel sieben: Aus Pixeln werden Objekte.',
        'Benachbarte Risspixel, auch diagonal benachbarte, werden zu Objekten zusammengefasst. Dann prüft ein Formfilter, ob ein Objekt linienartig ist.',
        'Das wichtigste Kriterium ist die Exzentrizität. Sie wird aus den zentralen Bildmomenten berechnet. Ein Kreis hat die Exzentrizität null, eine sehr gestreckte Ellipse fast eins. RubberScope verlangt mindestens 0,68, oder ein ausreichend langes Skelett.',
        'Rechts kannst du das Achsenverhältnis einer Ellipse verändern und sehen, ab wann sie den Filter passiert. Im Lernbild darunter sind die vom Formfilter entfernten kleinen Poren rot markiert.',
      ],
      quiz: [
        { q: 'Ein Objekt hat das Achsenverhältnis 1 : 1,2. Passiert es den Exzentrizitätsfilter (e ≥ 0,68), wenn sein Skelett kürzer als 40 px ist?', opts: ['Ja', 'Nein'], a: 1, why: 'e = √(1 − (1/1,2)²) ≈ 0,55 < 0,68.' },
      ],
    },
    // ------------------------------------------------------------------ 8
    {
      id: 'laenge', title: 'Risslänge messen: Skelett und Kulpa-Schätzer', min: 6, demo: 'kulpa', stage: 'skelett',
      html: () => `
<p>Um die Länge eines Risses zu messen, wird er auf eine <b>ein Pixel breite Mittellinie</b> verdünnt (Skelettierung nach Zhang &amp; Suen, scikit-image) ${c('Q06', 'Q17')}.</p>
<p>Einfach die Skelettpixel zu zählen wäre falsch: Ein diagonaler Schritt ist √2 ≈ 1,41 Pixel lang, ein waagerechter nur 1. Reine Pixelzählung unterschätzt diagonale Risse um bis zu 29 %.</p>
<p>RubberScope zählt deshalb die Schritte getrennt: n<sub>e</sub> orthogonale und n<sub>o</sub> diagonale Verbindungen (eine Diagonale nur, wenn es keine orthogonale Ersatzverbindung gibt) ${c('R05')}. Daraus schätzt es die Länge nach <b>Kulpa (1977)</b> ${c('Q07')}:</p>
<div class="formula">L = (π(1+√2)/8) · (n<sub>e</sub> + √2·n<sub>o</sub>) = 0,948·n<sub>e</sub> + 1,341·n<sub>o</sub></div>
<p>Der Vorfaktor 0,948 korrigiert, dass ein gerastertes Liniensegment im Mittel über alle Richtungen etwas länger erscheint als die echte Linie. Damit ist der Schätzer über alle Orientierungen <b>erwartungstreu</b>, der Einzelfehler liegt bei maximal etwa ±6 %.</p>
<p>Zieh rechts eine Linie in beliebiger Richtung und vergleiche wahre Länge, Pixelzählung und Kulpa-Schätzer.</p>
<p class="small">Zusätzlich: <b>maximaler Feret-Durchmesser</b> = größter Abstand zweier Punkte der konvexen Hülle + 1 px ${c('R05')}.</p>`,
      narr: [
        'Kapitel acht: Wie misst man die Länge eines gekrümmten Risses?',
        'Zuerst wird der Riss auf eine ein Pixel breite Mittellinie verdünnt. Das nennt man Skelettierung. RubberScope verwendet das Verfahren nach Zhang und Suen.',
        'Einfaches Zählen der Pixel ist falsch, weil ein diagonaler Schritt länger ist als ein waagerechter, nämlich Wurzel zwei. Diagonale Risse würden um bis zu 29 Prozent zu kurz gemessen.',
        'Deshalb werden waagerechte und diagonale Schritte getrennt gezählt und nach Kulpa gewichtet: 0,948 mal die geraden plus 1,341 mal die diagonalen Schritte. Dieser Schätzer ist über alle Richtungen erwartungstreu, der Fehler einzelner Linien liegt bei höchstens etwa sechs Prozent.',
        'Rechts kannst du selbst eine Linie ziehen und die drei Längen vergleichen.',
      ],
      quiz: [
        { q: 'Ein Skelett hat 100 orthogonale und 50 diagonale Schritte. Kulpa-Länge?', opts: ['150 px', '≈ 161,9 px', '≈ 170,7 px'], a: 1, why: '0,948·100 + 1,341·50 ≈ 94,8 + 67,0 = 161,9 px.' },
      ],
    },
    // ------------------------------------------------------------------ 9
    {
      id: 'kennwerte', title: 'Breite, Dichte und Orientierung zur Dehnung', min: 7, demo: ['width', 'angle'], stage: 'ergebnis',
      html: () => `
<p>Aus Länge, Breite und Fläche aller Objekte ergeben sich die Hauptkennwerte ${c('R04', 'R10')}:</p>
<div class="formula">w̄ = Σ(w<sub>i</sub>·L<sub>i</sub>) / ΣL<sub>i</sub><span class="lbl">mittlere Breite (längengewichtet)</span></div>
<p><b>Rissbreite ab Version 2.7:</b> Die Fläche einer Maske hängt von der Segmentierschwelle ab – Fläche ÷ Länge unterschätzte die Breite im Demo-Set um rund 25 % und überschätzte sie auf der Testkarte um bis zu 32 %. RubberScope liest deshalb an jedem zweiten Skelettpunkt ein <b>Grauwertprofil senkrecht zur Mittellinie</b> (Normale aus dem Strukturtensor der Maske). Je Profil wird die <b>Halbwertsbreite</b> bestimmt: der Abstand der Punkte, an denen die Abdunklung auf die Hälfte gefallen ist. Standard ist das <b>Profilmodell</b>: Ein Kastenprofil, gefaltet mit einer Gauß-Unschärfe, wird an das ausgerichtete Medianprofil angepasst; so wird die optische Unschärfe mitgeschätzt. Ist die Passung schlecht (R² &lt; 0,95), gilt die Halbwertsbreite. Mittlerer Breitenfehler an Demo-Set und Testkarte: Fläche ÷ Länge 24,5 %, Halbwertsbreite 9,2 %, Profilmodell 6,8 %. Rechts oben kannst du Schwelle, Unschärfe und wahre Breite verändern.</p>
<div class="formula">L<sub>A</sub> = ΣL<sub>i</sub> / A<sub>eval</sub> &nbsp; [mm/mm²]<span class="lbl">Risslängendichte</span></div>
<div class="formula">φ = 100 · N<sub>Risspixel</sub> / N<sub>eval</sub> &nbsp; [%]<span class="lbl">Flächenanteil</span></div>
<p>Die <b>Risslängendichte</b> L<sub>A</sub> ist der robusteste Vergleichskennwert: Sie hängt kaum von der Rissbreite ab (die bei schwachem Kontrast unsicher ist) und ist auf die tatsächlich ausgewertete Fläche bezogen, also ohne Ausschlussbereiche. Zusätzlich gibt es die lokale Maximalbreite w<sub>max</sub> = 2·d<sub>EDT</sub> − 1 aus der euklidischen Distanztransformation am Skelett.</p>
<h4>Orientierung zur Dehnrichtung</h4>
<p>Für jedes Objekt wird der Winkel Δ zwischen Hauptachse θ und Dehnrichtung φ<sub>D</sub> bestimmt (0–90°) ${c('R06')}:</p>
<div class="formula">Δ = min( |θ − φ<sub>D</sub>| mod 180° ; 180° − |θ − φ<sub>D</sub>| mod 180° )</div>
<p>Objekte mit Δ ≥ 60° gelten als <b>quer zur Dehnung</b>. Daraus ergeben sich der längengewichtete Anteil quer zur Dehnung und die orientierungsgefilterte Dichte L<sub>A,⊥</sub>. Die 60°-Grenze ist eine Eigenfestlegung.</p>
<div class="callout warn small"><b>Lernbild-Beispiel:</b> Die Riefe parallel zur Dehnung ist mit zwei Rissen zu <b>einem</b> Objekt verschmolzen. Dessen Hauptachse ist fast waagerecht (Δ klein), daher sinkt der Queranteil auf ≈ 48 %, obwohl alle echten Risse quer stehen. Genau für solche Fälle gibt es die manuellen Korrekturen (Kapitel 10).</div>`,
      narr: [
        'Kapitel neun: Die Kennwerte, die am Ende im Protokoll stehen.',
        'Zur Breite: Fläche geteilt durch Länge reicht nicht, denn die Fläche hängt davon ab, wo die Schwelle liegt. RubberScope misst die Breite deshalb direkt im Grauwertprofil quer zum Riss. Im Experiment rechts oben siehst du: Die Breite über die Schwelle wandert mit der Schwelle, die Halbwertsbreite nicht, und das Profilmodell findet sogar die wahre Breite trotz Unschärfe.',
        'Die Risslängendichte ist die Gesamtlänge geteilt durch die ausgewertete Fläche, in Millimeter pro Quadratmillimeter. Sie ist der robusteste Vergleichskennwert.',
        'Für jedes Objekt wird außerdem der Winkel zwischen seiner Hauptachse und der Dehnrichtung berechnet. Ab sechzig Grad gilt ein Objekt als quer zur Dehnung. Rechts kannst du ein Objekt drehen und die Einstufung beobachten.',
        'Ein Hinweis zum Lernbild: Die Riefe parallel zur Dehnung ist mit zwei Rissen zu einem Objekt verschmolzen. Dessen Hauptachse liegt fast waagerecht, deshalb sinkt der Queranteil auf etwa die Hälfte. Wie man das korrigiert, zeigt das nächste Kapitel.',
      ],
      quiz: [
        { q: 'Dehnrichtung 0° (waagerecht), Objekt-Orientierung 150°. Wie groß ist Δ, und ist das Objekt „quer“?', opts: ['Δ = 150°, quer', 'Δ = 30°, nicht quer', 'Δ = 60°, quer'], a: 1, why: '|150 − 0| = 150; min(150; 180 − 150) = 30° < 60°.' },
      ],
    },
    // ------------------------------------------------------------------ 10
    {
      id: 'korrektur', title: 'Der Mensch entscheidet: Klassifizieren, Ausschließen, Überlappung', min: 5, demo: null, stage: 'ergebnis',
      html: () => `
<p>Kein Bildverfahren unterscheidet Ozonrisse sicher von Riefen, Kratzern oder Schmutz. RubberScope trennt deshalb klar zwischen <b>automatischer Segmentierung</b> und <b>fachlicher Entscheidung</b>:</p>
<table class="t"><tr><th>Kennwertsatz</th><th>enthält</th></tr>
<tr><td><b>roh</b> (crack_…)</td><td>alle segmentierten Linienobjekte</td></tr>
<tr><td><b>bereinigt</b> (crack_clean_…)</td><td>ohne Objekte, die als Riefe, Kratzer, Pore, Agglomerat, Reflexion oder unklar klassifiziert wurden</td></tr>
<tr><td><b>quer</b> (crack_perp_…)</td><td>bereinigt und (Δ ≥ 60° oder als „Riss“ bestätigt)</td></tr>
<tr><td><b>bestätigt</b></td><td>nur ausdrücklich als „Riss“ klassifizierte Objekte</td></tr></table>
<h4>Werkzeuge im Analyse-Bereich</h4>
<ul>
<li><b>🏷 Klassifizieren:</b> Objekt anklicken → Klasse wählen. „Fragment – ausschließen“ entfernt das Objekt vollständig.</li>
<li><b>⛔ Ausschließen:</b> Rechteck um ein Artefakt ziehen. <b>Standard:</b> Jede Komponente, die das Rechteck berührt, wird <b>vollständig</b> entfernt, und die Rechteckfläche zählt nicht mehr zur Bezugsfläche A<sub>eval</sub>.</li>
<li><b>⇄ Überlappung:</b> Ein berührtes Objekt kann ausdrücklich <b>behalten</b> werden. Dann zählt die gesamte Komponente samt Schnittbereich, und genau diese Pixel kehren in die Bezugsfläche zurück, damit Zähler und Nenner konsistent bleiben ${c('R04')}.</li>
</ul>
<div class="callout warn small">„Behalten“ trennt <b>nicht</b> automatisch Riss und Artefakt. Bei einem verschmolzenen Objekt bleiben alle Pixel, auch die der Riefe. Saubere Lösung im Lernbild: die Riefe zwischen den Rissen per Rechteck ausschließen und die berührten Risse behalten, oder die Stelle neu aufnehmen.</div>
<p>Alle Entscheidungen werden mit Bildkoordinaten gespeichert (manuelle_korrekturen.json) und im Protokoll gezählt. So bleibt die Auswertung nachvollziehbar und wiederholbar.</p>
<p><a class="btn sm primary" href="#analyse" onclick="RS.loadLernbildForAnalysis && RS.loadLernbildForAnalysis()">Lernbild im Analyse-Bereich öffnen und selbst korrigieren →</a></p>`,
      narr: [
        'Kapitel zehn: Wo der Mensch entscheidet.',
        'Kein Bildverfahren kann Ozonrisse sicher von Riefen, Kratzern oder Schmutz unterscheiden. Deshalb trennt RubberScope zwischen automatischer Segmentierung und fachlicher Entscheidung.',
        'Mit dem Klassifizieren-Werkzeug weist du einem Objekt eine Klasse zu. Objekte, die als Riefe, Kratzer oder Pore markiert sind, fallen aus den bereinigten Kennwerten heraus.',
        'Mit dem Ausschließen-Werkzeug ziehst du ein Rechteck um ein Artefakt. Standardmäßig wird jedes berührte Objekt vollständig entfernt. Willst du einen berührten Riss behalten, entscheidest du das ausdrücklich. Dann zählt das ganze Objekt, und seine Pixel kehren in die Bezugsfläche zurück.',
        'Alle Entscheidungen werden gespeichert und im Protokoll gezählt. Am besten probierst du es direkt am Lernbild im Analyse-Bereich aus.',
      ],
      quiz: [
        { q: 'Ein Rechteck berührt einen langen Riss nur an einer Ecke. Was passiert standardmäßig?', opts: ['Nur die Pixel im Rechteck werden entfernt', 'Der gesamte Riss wird entfernt', 'Nichts'], a: 1, why: 'Standard: berührte Komponenten werden vollständig verworfen. „Behalten“ muss ausdrücklich gewählt werden.' },
      ],
    },
    // ------------------------------------------------------------------ 11
    {
      id: 'statistik', title: 'Unsicherheit und Statistik', min: 6, demo: 'ci', stage: null,
      html: () => `
<h4>Kalibrier-Unsicherheit</h4>
<p>Ist die Pixelgröße s mit der relativen Unsicherheit u<sub>s</sub> bekannt, pflanzt sich diese nach dem GUM in erster Ordnung fort ${c('Q10', 'R04')}:</p>
<div class="formula">u(L)/L = u<sub>s</sub> &nbsp;&nbsp; u(A)/A = 2u<sub>s</sub> &nbsp;&nbsp; u(L<sub>A</sub>)/L<sub>A</sub> = u<sub>s</sub> &nbsp;(da L<sub>A</sub> ∝ s/s²)</div>
<p>Das ist <b>nur</b> der Kalibrieranteil, keine vollständige Messunsicherheitsbilanz. Die Segmentierungsunsicherheit schätzt die optionale <b>Sensitivitätsanalyse</b> ab (Neuberechnung mit k × 0,8 und k × 1,2).</p>
<h4>Gruppenstatistik</h4>
<p>Für jede Gruppe (Rezeptur | Zustand) werden Mittelwert, Standardabweichung (n − 1) und ein 95-%-Konfidenzintervall nach Student-t berechnet ${c('Q11', 'R07')}:</p>
<div class="formula">x̄ ± t<sub>0,975; n−1</sub> · s / √n</div>
<p>Gruppenvergleiche (ab n ≥ 3 je Gruppe) verwenden den <b>Welch-t-Test</b> (ungleiche Varianzen) ${c('Q12')} mit <b>Holm-Korrektur</b> für Mehrfachvergleiche ${c('Q13')}.</p>
<div class="callout warn"><b>Pseudoreplikation:</b> Die statistische Einheit ist das <b>Bild</b>. Fünf Bilder desselben Prüfkörpers sind <b>keine</b> fünf unabhängigen Proben. Für belastbare Vergleiche braucht man mehrere Prüfkörper je Rezeptur (und mittelt deren Bilder vorher).</div>
<p>Rechts: Wie schnell schrumpft das Konfidenzintervall mit n? Beachte den großen Sprung von n = 2 auf n = 3, denn t<sub>0,975;1</sub> = 12,7.</p>`,
      narr: [
        'Kapitel elf: Wie sicher sind die Zahlen?',
        'Eine Unsicherheit der Pixelkalibrierung überträgt sich direkt: Längen und die Risslängendichte ändern sich relativ genauso stark, Flächen doppelt so stark. Das ist allerdings nur ein Anteil der gesamten Messunsicherheit.',
        'Für Gruppen berechnet das Programm Mittelwert, Standardabweichung und ein 95-Prozent-Konfidenzintervall nach Student. Gruppen werden mit dem Welch-Test verglichen und für Mehrfachvergleiche nach Holm korrigiert.',
        'Ganz wichtig: Die statistische Einheit ist das Bild. Mehrere Bilder desselben Prüfkörpers sind keine unabhängigen Proben. Rechts siehst du, wie stark das Konfidenzintervall von der Anzahl der Proben abhängt, besonders der Sprung von zwei auf drei.',
      ],
      quiz: [
        { q: 'Du hast 6 Bilder von einem einzigen Prüfkörper pro Rezeptur. Was gilt?', opts: ['n = 6 unabhängige Proben', 'Die Bilder sind keine unabhängigen Proben – Aussage gilt nur für diesen Prüfkörper', 'Der Welch-Test korrigiert das automatisch'], a: 1, why: 'Pseudoreplikation: Streuung zwischen Prüfkörpern wird so nicht erfasst.' },
      ],
    },
    // ------------------------------------------------------------------ 12
    {
      id: 'validierung', title: 'Validierung: Woher wissen wir, dass es funktioniert?', min: 6, demo: 'confusion', stage: null,
      html: () => `
<p>Validieren heißt: Ergebnisse mit einer bekannten Wahrheit (<i>Ground Truth</i>) vergleichen. Pixelweise zählt man ${c('Q14', 'R08')}:</p>
<ul><li><b>TP</b> richtig erkannte Risspixel · <b>FP</b> fälschlich erkannte · <b>FN</b> übersehene</li></ul>
<div class="formula">Precision = TP/(TP+FP) &nbsp; Recall = TP/(TP+FN) &nbsp; F1 = 2TP/(2TP+FP+FN) &nbsp; IoU = TP/(TP+FP+FN)</div>
<p><b>Synthetische Validierung</b> (im Programm eingebaut): 6 Bilder mit bekannter Maske, k-Wahl an Bild 1–4, Prüfung an Bild 5–6 (Holdout):</p>
<table class="t"><tr><th>Verfahren</th><th class="n">gewähltes k</th><th class="n">F1 Holdout</th><th class="n">Längenfehler</th></tr>
<tr><td>Präzise (Frangi)</td><td class="n">0,5</td><td class="n">0,952</td><td class="n">+1,2 %</td></tr>
<tr><td>Schnell (Weber)</td><td class="n">0,35</td><td class="n">0,905</td><td class="n">+0,4 %</td></tr></table>
<h4>Was man daraus lernen kann (und was nicht)</h4>
<ul>
<li>Beim schnellen Verfahren mit k = 1 sinkt die Precision auf ≈ 0,62, der Längenfehler bleibt aber klein (&lt; 3 %). Das Verfahren erkennt also die richtigen Risse, zeichnet sie aber <b>breiter</b>. Bei k = 1 sind <b>Länge und L<sub>A</sub> verlässlicher als Breite und φ</b>.</li>
<li>Das gewählte k liegt bei beiden Verfahren am <b>Rand</b> des geprüften Bereichs. Das Optimum könnte also noch tiefer liegen. Empfehlung: das Raster in einer Folgeversion erweitern.</li>
<li>Synthetische Risse sind idealisiert. Ein externer Test mit echten, von Menschen markierten Rissfotos ist vorbereitet (Tunnelrisse, CTCD-Datensatz ${c('L07')}). Das sind aber <b>keine Elastomer-Ozonrisse</b>. Die eigentliche Materialvalidierung braucht manuell markierte Ozonriss-Aufnahmen.</li>
</ul>
<p><a class="btn sm" href="#validierung">Validierung selbst im Browser ausführen →</a></p>`,
      narr: [
        'Kapitel zwölf: Woher wissen wir, dass das Programm funktioniert?',
        'Validieren heißt, Ergebnisse mit einer bekannten Wahrheit zu vergleichen. Man zählt richtig erkannte, fälschlich erkannte und übersehene Pixel und berechnet daraus Precision, Recall und den F1-Wert.',
        'Im Programm ist eine synthetische Validierung eingebaut. Das Präzisionsverfahren erreicht dort einen F1-Wert von 0,95 auf zurückgehaltenen Bildern, mit gut einem Prozent Längenfehler.',
        'Eine wichtige Beobachtung: Das schnelle Verfahren zeichnet Risse bei k gleich eins zu breit, die Längen stimmen aber. Länge und Längendichte sind also verlässlicher als Breite und Flächenanteil.',
        'Und die wichtigste Grenze: Synthetische Bilder sind keine echten Ozonrisse. Für eine echte Materialvalidierung braucht man manuell markierte Ozonriss-Aufnahmen. Rechts kannst du mit einer Konfusionsmatrix experimentieren.',
      ],
      quiz: [
        { q: 'Precision 0,62, Längenfehler +2 %. Was ist am wahrscheinlichsten?', opts: ['Viele falsche Objekte', 'Richtige Risse, aber zu breit segmentiert', 'Viele übersehene Risse'], a: 1, why: 'Zusätzliche Pixel am Rissrand senken die Precision, ändern die Skelettlänge aber kaum.' },
      ],
    },
    // ------------------------------------------------------------------ 13
    {
      id: 'praxis', title: 'Praxis: Eine Auswertung Schritt für Schritt', min: 5, demo: null, stage: null,
      html: () => `
<h4>Vor der Aufnahme</h4>
<ul>
<li>Gleiche Beleuchtung, Belichtung, Objektiv und Fokus für alle Proben, die verglichen werden sollen. Dann „Aufnahmebedingungen kontrolliert gleich“ aktivieren.</li>
<li>Maßstab dokumentieren (Objektmikrometer oder Balken im Bild). Dehnrichtung im Bild festhalten, z. B. Probe immer waagerecht einspannen.</li>
<li>Mehrere Prüfkörper je Rezeptur und Zustand, nicht nur mehrere Bilder einer Probe (Kapitel 11).</li>
</ul>
<h4>Im Programm</h4>
<ol>
<li><b>Bilder laden</b> und je Bild <b>Gruppe</b> (Rezeptur) und <b>Zustand</b> (Referenz/gealtert) zuweisen.</li>
<li><b>Pixelgröße</b> eintragen oder mit 📏 am Maßstabsbalken abgreifen. Unsicherheit u<sub>s</sub> angeben (Ablesefehler ±1 px ≈ 100 %/Balkenlänge in px).</li>
<li><b>Dehnrichtung</b> eintragen oder mit ↔ einzeichnen.</li>
<li>Verfahren <b>Präzise</b> und k = 1 als Standard. Optional die Sensitivitätsanalyse einschalten.</li>
<li><b>Alle analysieren</b> → jedes Bild ansehen. Fehlerkennungen klassifizieren oder ausschließen.</li>
<li>Reiter <b>Vergleich</b>: Gruppenmittelwerte, Konfidenzintervalle, Referenzdifferenzen.</li>
<li>Reiter <b>Export</b>: Prüfbedingungen eintragen → ZIP mit beiden Protokollen und allen Tabellen.</li>
</ol>
<h4>Für die Auswertung</h4>
<ul>
<li>Alle Festlegungen des Verfahrens lassen sich unter <b>⚙ Methodenparameter</b> ändern. Für vergleichende Auswertungen <b>einen</b> Parametersatz festlegen (als Voreinstellung speichern und teilen), ihn möglichst mit eigenen markierten Bildern validieren (Seite „Validierung“) und erst dann die eigentlichen Proben auswerten.</li>
<li>Wenn du Ergebnisse in einem Bericht, Praktikumsprotokoll oder einer Präsentation verwendest: die <b>externen Originalquellen</b> zitieren (Frangi, Kulpa, Zhang &amp; Suen, GUM …) und Schwellen, Score und 60°-Grenze ausdrücklich als <b>Eigenfestlegung der Software</b> beschreiben.</li>
<li>Programmversion, Parameter und SHA-256 der Rohbilder angeben (stehen im Protokoll).</li>
<li>Keine ISO-1431-1-Konformität behaupten. Synthetische und reale Validierung getrennt berichten.</li>
</ul>
<p><a class="btn primary" href="#analyse">Jetzt eigene Bilder auswerten →</a></p>`,
      narr: [
        'Letztes Kapitel: die Praxis.',
        'Schon vor der Aufnahme entscheidet sich die Qualität. Beleuchtung, Belichtung, Objektiv und Fokus sollten für alle verglichenen Proben gleich sein. Der Maßstab muss dokumentiert sein, und die Dehnrichtung im Bild bekannt.',
        'Im Programm lädst du die Bilder, weist Rezeptur und Zustand zu, trägst Pixelgröße und Dehnrichtung ein und analysierst alle Bilder. Danach prüfst du jedes Bild und korrigierst Fehlerkennungen.',
        'Im Reiter Vergleich findest du Gruppenmittelwerte und Konfidenzintervalle, im Reiter Export die Protokolle mit vollständigem Rechenweg und allen Quellen.',
        'Für die Auswertung gilt: Wenn du Ergebnisse in einem Bericht oder Protokoll verwendest, zitiere die Originalquellen, benenne die Schwellenwerte als Eigenfestlegung des Programms und behaupte keine Normkonformität. Viel Erfolg bei der Auswertung!',
      ],
      quiz: [],
    },
  ];

  // ------------------------------------------------------------------ Methodik (Nachschlagen)
  RS.METHODIK = () => `
<h2>1 · Daten und Vorverarbeitung</h2>
<table class="t"><tr><th>Schritt</th><th>Vorschrift</th><th>Beleg</th></tr>
<tr><td>Grauwert</td><td>Y = 0,299R + 0,587G + 0,114B</td><td>${c('Q01', 'R01')}</td></tr>
<tr><td>Mehr-Bit</td><td>I<sub>8</sub> = round(255·I/(2<sup>b</sup>−1)), b = 12 falls I<sub>max</sub> ≤ 4095, sonst 16; I<sub>max</sub> ≤ 255 → unverändert (2.5)</td><td>${c('R01')}</td></tr>
<tr><td>Kalibrierung</td><td>A = N·s², L = L<sub>px</sub>·s; s aus Benutzerangabe oder OME-/TIFF-Metadaten (keine DPI-Tags)</td><td>${c('R01', 'R04')}</td></tr>
<tr><td>Rückverfolgbarkeit</td><td>SHA-256 je Rohdatei</td><td>${c('Q15')}</td></tr></table>

<h2>2 · Segmentierung „Präzise · Mehrskalen“ (Standard)</h2>
<table class="t"><tr><th>Schritt</th><th>Vorschrift</th><th>Beleg</th></tr>
<tr><td>Glättung</td><td>Gauß 3×3, σ = 0,65 px</td><td>${c('Q02')}</td></tr>
<tr><td>Hintergrund</td><td>I<sub>B</sub> = G<sub>σ</sub>∗I, σ = max(8; min(H,W)/22)</td><td>${c('Q02', 'R02')}</td></tr>
<tr><td>Relative Abdunklung</td><td>I<sub>rel</sub> = clip(1 − I/I<sub>B</sub>; 0; 1)</td><td>${c('R02')}</td></tr>
<tr><td>Frangi</td><td>σ ∈ {1; 1,6; 2,5; 3,5}; β = 0,5; c = 0,05 (fest); V = max<sub>σ</sub> V<sub>σ</sub></td><td>${c('Q03', 'Q04', 'R03')}</td></tr>
<tr><td>Black-Hat</td><td>Ellipsen 9, 17, 27 px; C = max BH / I<sub>B</sub></td><td>${c('Q05', 'R03')}</td></tr>
<tr><td>Score</td><td>k·min(V/0,25; C/0,15)</td><td>${c('R03')}</td></tr>
<tr><td>Hysterese</td><td>stark ≥ 1,0; schwach ≥ 0,5 bei Verbindung</td><td>${c('Q04', 'L04')}</td></tr>
<tr><td>Formfilter</td><td>A ≥ A<sub>min</sub>; Skelett ≥ max(12; 2,5√A<sub>min</sub>); e ≥ 0,68 oder Skelett ≥ 40</td><td>${c('R03', 'Q09')}</td></tr></table>

<h2>3 · Segmentierung „Schnell · Weber-Kontrast“</h2>
<p>Gauß 3×3; I<sub>B</sub> mit σ = max(9; ⌊min(H,W)/18⌋); C = (I<sub>B</sub> − I)/I<sub>B</sub> (geglättet) ≥ 0,12/k; Schließen 3×3; Formfilter Hauptachse ≥ 20 px und (e ≥ 0,68 oder Hauptachse ≥ 40 px) ${c('R02', 'Q05')}.</p>

<h2>4 · Kennwerte</h2>
<table class="t"><tr><th>Größe</th><th>Formel</th><th>Beleg</th></tr>
<tr><td>Bewertete Fläche</td><td>A<sub>eval</sub> = N<sub>eval</sub>·s²/10⁶ [mm²] (ROI ohne wirksame Ausschlüsse)</td><td>${c('R04', 'R09')}</td></tr>
<tr><td>Flächenanteil</td><td>φ = 100·N<sub>Riss</sub>/N<sub>eval</sub> [%]</td><td>${c('R04')}</td></tr>
<tr><td>Objektdichte</td><td>D<sub>N</sub> = n / A<sub>eval</sub> [1/mm²]</td><td>${c('R04')}</td></tr>
<tr><td>Risslänge</td><td>L = 0,948·n<sub>e</sub> + 1,341·n<sub>o</sub> [px] (Kulpa)</td><td>${c('Q06', 'Q07', 'R05')}</td></tr>
<tr><td>Längendichte</td><td>L<sub>A</sub> = ΣL·s/1000 / A<sub>eval</sub> [mm/mm²]</td><td>${c('R04', 'R09')}</td></tr>
<tr><td>Mittlere Breite</td><td>w̄ = s·Σ(w<sub>i</sub>·L<sub>i</sub>)/ΣL<sub>i</sub> [µm], w<sub>i</sub> = Profilbreite (Modell bzw. Halbwertsbreite); Vergleichswert s·ΣA<sub>i</sub>/ΣL<sub>i</sub></td><td>${c('R04', 'R10')}</td></tr>
<tr><td>Max. Breite</td><td>w<sub>max</sub> = 2·d<sub>EDT</sub> − 1 am Skelett</td><td>${c('R04')}</td></tr>
<tr><td>Äquivalentdurchmesser</td><td>d<sub>eq</sub> = 2√(A/π)</td><td>${c('Q09')}</td></tr>
<tr><td>Feret max.</td><td>größter Abstand der konvexen Hülle + 1 px</td><td>${c('R05')}</td></tr>
<tr><td>Exzentrizität, Orientierung</td><td>e = √(1 − λ<sub>2</sub>/λ<sub>1</sub>), θ = ½·atan2(2μ<sub>11</sub>; μ<sub>20</sub> − μ<sub>02</sub>)</td><td>${c('Q08', 'Q09')}</td></tr>
<tr><td>Winkel zur Dehnung</td><td>Δ = min(|θ − φ<sub>D</sub>| mod 180; 180 − …); quer: Δ ≥ 60° (Standard, einstellbar)</td><td>${c('R06')}</td></tr>
<tr><td>Kalibrier-Unsicherheit</td><td>u(L)/L = u<sub>s</sub>; u(A)/A = 2u<sub>s</sub>; u(L<sub>A</sub>)/L<sub>A</sub> = u<sub>s</sub></td><td>${c('Q10')}</td></tr></table>

<h2>5 · Statistik</h2>
<p>x̄, s (n − 1), KI95 = t<sub>0,975;n−1</sub>·s/√n ${c('Q11', 'R07')}; Welch-t-Test ${c('Q12')} mit Holm-Korrektur ${c('Q13')}, explorativ ab n ≥ 3 je Gruppe; Referenzdifferenz zu ungealterten Bildern derselben Gruppe bei gleichem Maßstab (±2 %).</p>

<h2>6 · Änderungen in Version 2.7</h2>
<ul>
<li><b>Neue Rissbreitenmessung</b> ${c('R10')}: Grauwertprofile senkrecht zur Mittellinie, Halbwertsbreite je Profil und standardmäßig ein Profilmodell (Kastenprofil ⊗ Gauß, Rückfall bei R² &lt; 0,95). Mittlerer Breitenfehler an Demo-Set und Testkarte TK-1: 24,5 % → 6,8 %. Neue Methodenparameter in der Gruppe „Rissbreite“: <code>width_method</code> (modell | profil | flaeche), Mindestabdunklung, Mindestzahl der Profile, R²-Grenze.</li>
<li>Die bisherige Breite Fläche ÷ Länge wird als <code>mean_width_area</code> weiter ausgegeben; mit <code>width_method = flaeche</code> sind alle Ergebnisse identisch mit 2.6. Risszahl, Längen, L<sub>A</sub> und Winkel ändern sich nicht.</li>
<li>Lernpfad: Reaktionsschema der Ozonolyse (Kapitel 1) und neues Experiment „Rissbreite“ (Kapitel 9).</li>
</ul>
<h2>6a · Änderungen in Version 2.6</h2>
<ul>
<li><b>Alle Festlegungen sind einstellbar</b> (41 Methodenparameter in 2.6, seit 2.7 sind es 45; Tabelle unten): Vorglättung, Hintergrund-σ, Frangi-Skalen/β/c und Implementierung, Black-Hat-Größen, V<sub>ref</sub>, C<sub>ref</sub>, Hystereseschwellen, Formfilter, alle Schwellen des Schnellverfahrens, Nachbarschaft, Längenschätzer, Feret-Korrektur, Grenzwinkel, Zusatzmerkmale, Sensitivitätsfaktoren, Konfidenzniveau, Mindest-n, α, Maßstabstoleranz.</li>
<li>Jedes Ergebnis speichert seinen vollständigen Parametersatz mit Prüfwert (Hash). Prüf- und Rechenprotokoll enthalten eine <b>Parametertabelle</b>, Abweichungen vom Standard sind mit * markiert. Zusätzlich gibt es <code>methodenparameter.csv</code> und ein erweitertes <code>auswertungsparameter.json</code>.</li>
<li>Bilder mit <b>verschiedenen Parametersätzen</b> werden in Gruppenstatistik und Referenzvergleich automatisch getrennt.</li>
<li><b>Voreinstellungen</b> lassen sich als JSON speichern und laden (auch aus einem früheren Export), sodass ein Labor einen gemeinsamen Satz verwenden kann.</li>
<li><b>Validierung mit eigenen Aufnahmen</b> (Bild + handgezeichnete Maske) mit k-Suche, Entwicklungs-/Holdout-Trennung und Export. Das k-Raster der synthetischen Validierung ist frei wählbar, und ein Optimum am Rasterrand wird gemeldet.</li>
<li>Mit Standardwerten sind alle Ergebnisse <b>bitgleich</b> zu 2.4/2.5 (16 Demo-Analysen, 54 Validierungsläufe geprüft).</li>
</ul>
<h2>6b · Änderungen in Version 2.5 (Web)</h2>
<ul>
<li><b>Schnellerer Frangi-Filter</b> (frangi_fast): identische Gauß-Ableitungskerne wie scikit-image 0.26, gefaltet mit OpenCV. Max. Abweichung 1,5·10<sup>−7</sup>, 0 Schwellen-Umkippungen. Alle 16 Demo-Analysen und 54 Validierungsläufe sind <b>bitgleich</b> zu 2.4, ein 5-MP-Bild braucht 1,9 s statt 8,7 s. Bei jedem Systemtest und beim Start im Browser wird die Gleichheit erneut geprüft.</li>
<li><b>16-bit-Container mit 8-bit-Werten</b> werden nicht mehr auf 16 Graustufen reduziert.</li>
<li><b>Welch-Test ohne Streuung</b> (p = NaN) liefert jetzt p = 1 statt eines undefinierten Werts.</li>
<li>Unverändert: alle Schwellen, Formfilter, Rechenregeln, Validierungsergebnisse und Protokollinhalte.</li>
</ul>`;

  // ------------------------------------------------------------------ Hilfe
  RS.HILFE = () => `
<h1>Hilfe, Datenschutz &amp; Zitieren</h1>
<h3>🔒 Wo werden meine Bilder verarbeitet?</h3>
<p>Ausschließlich <b>in deinem Browser</b>. Die Webseite lädt Python (Pyodide ${c('S01')}) und die Bibliotheken NumPy, SciPy, scikit-image und OpenCV als WebAssembly herunter und rechnet lokal. Bilder, Ergebnisse und Korrekturen werden <b>nicht</b> an einen Server gesendet. Schließt du den Tab, sind sie weg. Exportiere das ZIP, um sie zu behalten.</p>
<h3>💻 Welche Geräte und Browser?</h3>
<p>Aktueller Chrome, Edge, Firefox oder Safari am Laptop/PC. Der erste Start lädt etwa 40 MB (danach aus dem Browser-Cache). Smartphones funktionieren für kleine Bilder, sind aber langsam. Richtwert: 1 MP ≈ 1 s, 5 MP ≈ 5 s pro Bild.</p>
<h3>🖼 Welche Bilder eignen sich?</h3>
<ul><li>Auflichtmikroskopie der Probenoberfläche, Risse dunkel auf hellerem Grund (sonst Polarität „hell“ wählen).</li>
<li>PNG/TIFF verlustfrei bevorzugen. JPG funktioniert, Kompressionsartefakte können aber feine Risse beeinflussen.</li>
<li>Gleichmäßiger Fokus. Unscharfe Bereiche mit „Ausschließen“ entfernen.</li></ul>
<h3>⚠️ Typische Probleme</h3>
<table class="t"><tr><th>Beobachtung</th><th>Ursache / Abhilfe</th></tr>
<tr><td>Viele kurze Fehlobjekte</td><td>Rauschen oder Textur → k verringern (z. B. 0,8), A<sub>min</sub> erhöhen</td></tr>
<tr><td>Schwache Risse fehlen</td><td>k erhöhen (1,2–1,5), Sensitivitätsanalyse einschalten und Stabilität prüfen</td></tr>
<tr><td>Riefen werden als Risse erkannt</td><td>Dehnrichtung setzen (L<sub>A,⊥</sub> verwenden) und Riefen klassifizieren</td></tr>
<tr><td>Riss und Riefe verschmolzen</td><td>Verbindungsstelle per Rechteck ausschließen, Risse behalten (Kapitel 10)</td></tr>
<tr><td>Nur Pixelwerte</td><td>Pixelgröße fehlt → eintragen oder mit 📏 abgreifen</td></tr>
<tr><td>Rechenkern lädt nicht</td><td>Netzwerk/Firewall blockiert cdn.jsdelivr.net → anderes Netz oder lokale Desktop-Version nutzen</td></tr></table>
<h3>⚙ Parameter anpassen – aber nachvollziehbar</h3>
<p>Unter <b>Analyse → ⚙ Methodenparameter</b> ist jede Festlegung einstellbar, mit Erklärung, zulässigem Bereich und Quelle. Empfohlenes Vorgehen für wissenschaftliche Auswertungen:</p>
<ol>
<li>Einige repräsentative Aufnahmen <b>von Hand</b> markieren (Rissmaske, z. B. in Fiji/ImageJ oder GIMP).</li>
<li>Auf der Seite <b>Validierung → eigene Aufnahmen</b> Parameter und k prüfen. Einen Teil der Bilder als <b>Holdout</b> zurückhalten.</li>
<li>Den gefundenen Satz als <b>Voreinstellung speichern</b> und für <b>alle</b> Proben unverändert verwenden.</li>
<li>Im Bericht Parametersatz (Hash), abweichende Werte und Validierungsergebnis angeben. Alles steht im Prüf- und Rechenprotokoll.</li>
</ol>
<p class="small">Nicht empfehlenswert: Parameter pro Bild nachjustieren, bis „das Ergebnis passt“. Dann sind die Werte nicht mehr vergleichbar und nicht unabhängig.</p>
<h3>📝 Ergebnisse dokumentieren und zitieren</h3>
<p>Die Software selbst ist eine Eigenentwicklung. Zitiere die <b>Originalquellen der Verfahren</b> (siehe <a href="#quellen">Quellen</a>) und beschreibe die gewählten Grenzwerte (V<sub>ref</sub> = 0,25, C<sub>ref</sub> = 0,15, Filtergrößen, k, Exzentrizitäts- und Winkelschwellen) als <b>projektspezifische Festlegungen</b>. Die R-Verweise (R01–R09) zeigen auf Funktionen im Quellcode und sind <b>keine</b> wissenschaftlichen Quellen. ISO 1431-1 nur als fachliche Orientierung nennen.</p>
<h3>📦 Quellcode und Desktop-Version</h3>
<p>Der Rechenkern ist derselbe Python-Code wie in der Desktop-Version (PySide6-Oberfläche). Hier kannst du ihn herunterladen:</p>
<div class="btnrow" id="src-dl"></div>
<h3>🌐 Eigenes Hosting</h3>
<p>Die Seite besteht nur aus statischen Dateien (HTML, JavaScript, Python, Schriftarten). Sie läuft kostenlos auf <b>GitHub Pages</b>, <b>Netlify</b> oder <b>Cloudflare Pages</b>, ohne Server-Programmierung, weil gerechnet wird im Browser.</p>
<h3>ℹ️ Version</h3>
<p id="env-info" class="small muted">Rechenkern noch nicht geladen.</p>`;
})();
