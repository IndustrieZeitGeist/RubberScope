/* RubberScope Web – Quellenverzeichnis und Zitier-Markierungen
   Q01–Q17 und R01–R09 sind unverändert aus RubberScope 2.4 (QUELLENVERZEICHNIS_2_4.csv) übernommen.
   L01–L07 sind ergänzende Quellen für den Lernpfad (Werkstoffgrundlagen, Optik, Software). */
'use strict';
(() => {
  const RS = window.RS;
  const S = RS.SOURCES = {
    Q01: { t: 'ITU-R BT.601-5 (1995): Studio encoding parameters of digital television. Luma-Gewichte 0,299 / 0,587 / 0,114.', u: 'https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.601-5-199510-S!!PDF-E.pdf', k: 'Norm / Empfehlung' },
    Q02: { t: 'OpenCV-Dokumentation: Smoothing Images (GaussianBlur) – Gauß-Faltung und Vorverarbeitung.', u: 'https://docs.opencv.org/4.13.0/dc/dd3/tutorial_gausian_median_blur_bilateral_filter.html', k: 'Software-Dokumentation' },
    Q03: { t: 'Frangi, A. F.; Niessen, W. J.; Vincken, K. L.; Viergever, M. A. (1998): Multiscale Vessel Enhancement Filtering. MICCAI 1998, LNCS 1496, S. 130–137. DOI 10.1007/BFb0056195.', u: 'https://doi.org/10.1007/BFb0056195', k: 'Primärliteratur' },
    Q04: { t: 'scikit-image 0.26: skimage.filters.frangi und apply_hysteresis_threshold – implementierte Parameter und Schnittstellen.', u: 'https://scikit-image.org/docs/0.26.x/api/skimage.filters.html', k: 'Software-Dokumentation' },
    Q05: { t: 'OpenCV-Dokumentation: More Morphology Transformations – Closing und Black Hat.', u: 'https://docs.opencv.org/4.10.0/d3/dbe/tutorial_opening_closing_hats.html', k: 'Software-Dokumentation' },
    Q06: { t: 'Zhang, T. Y.; Suen, C. Y. (1984): A fast parallel algorithm for thinning digital patterns. Communications of the ACM 27(3), S. 236–239. DOI 10.1145/357994.358023.', u: 'https://doi.org/10.1145/357994.358023', k: 'Primärliteratur' },
    Q07: { t: 'Kulpa, Z. (1977): Area and perimeter measurement of blobs in discrete binary pictures. Computer Graphics and Image Processing 6, S. 434–451. DOI 10.1016/S0146-664X(77)80021-X.', u: 'https://doi.org/10.1016/S0146-664X(77)80021-X', k: 'Primärliteratur' },
    Q08: { t: 'OpenCV-Dokumentation: Image Moments – zentrale Momente und geometrische Bildmerkmale.', u: 'https://docs.opencv.org/4.x/d0/d49/tutorial_moments.html', k: 'Software-Dokumentation' },
    Q09: { t: 'scikit-image 0.26: skimage.measure.regionprops – eccentricity und orientation aus zweiten zentralen Momenten.', u: 'https://scikit-image.org/docs/0.26.x/api/skimage.measure.html', k: 'Software-Dokumentation' },
    Q10: { t: 'JCGM 100:2008 (GUM): Evaluation of measurement data – Guide to the expression of uncertainty in measurement, Abschnitt 5 (Unsicherheitsfortpflanzung). DOI 10.59161/JCGM100-2008E.', u: 'https://doi.org/10.59161/JCGM100-2008E', k: 'Norm / Leitfaden' },
    Q11: { t: 'NIST: Statistical Techniques, Kapitel 8 – Student-t-Konfidenzintervalle für den Mittelwert.', u: 'https://www.nist.gov/system/files/documents/2019/05/13/section-8-statistics-techniques-20190506.pdf', k: 'Leitfaden' },
    Q12: { t: 'SciPy-Dokumentation: scipy.stats.ttest_ind – Welch-t-Test mit equal_var=False.', u: 'https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ttest_ind.html', k: 'Software-Dokumentation' },
    Q13: { t: 'Holm, S. (1979): A simple sequentially rejective multiple test procedure. Scandinavian Journal of Statistics 6, S. 65–70.', u: 'https://www.ime.usp.br/~abe/lista/pdf4R8xPVzCnX.pdf', k: 'Primärliteratur' },
    Q14: { t: 'Sokolova, M.; Lapalme, G. (2009): A systematic analysis of performance measures for classification tasks. Information Processing & Management 45(4). DOI 10.1016/j.ipm.2009.03.002.', u: 'https://doi.org/10.1016/j.ipm.2009.03.002', k: 'Primärliteratur' },
    Q15: { t: 'NIST FIPS 180-4: Secure Hash Standard (SHA-256). DOI 10.6028/NIST.FIPS.180-4.', u: 'https://doi.org/10.6028/NIST.FIPS.180-4', k: 'Norm' },
    Q16: { t: 'ISO 1431-1:2024: Rubber, vulcanized or thermoplastic – Resistance to ozone cracking – Part 1: Static and dynamic strain testing. Nur fachliche Orientierung, keine Konformität.', u: 'https://www.iso.org/standard/86601.html', k: 'Norm' },
    Q17: { t: 'van der Walt, S. et al. (2014): scikit-image: image processing in Python. PeerJ 2:e453. DOI 10.7717/peerj.453.', u: 'https://doi.org/10.7717/peerj.453', k: 'Primärliteratur' },
    R01: { t: 'RubberScope, Eigenimplementierung: rubberscope_engine.py – _to_uint8(), read_img(), metadata_scale(). Zahlenwahl nach Programmlogik, nicht extern standardisiert.', k: 'Eigenimplementierung' },
    R02: { t: 'RubberScope, Eigenimplementierung: smooth_background(), contrast_mask(), crack_features(). Sigma-Festlegungen, Schwellen C_min und k sind projektspezifisch.', k: 'Eigenimplementierung' },
    R03: { t: 'RubberScope, Eigenimplementierung: crack_features(), crack_optimized_mask(), make_mask(), ab 2.5 frangi_fast(). Kombination V/C, Skalen und Hysteresegrenzen sind projektspezifisch.', k: 'Eigenimplementierung' },
    R04: { t: 'RubberScope, Eigenimplementierung: components(), shape_moments(), measure_objects(), _summarize(). Geometrische Kennwertdefinitionen und Filterkonstanten.', k: 'Eigenimplementierung' },
    R05: { t: 'RubberScope, Eigenimplementierung: chain_counts(), skeleton_length(), feret_max(). Digitale Kantenzählung und +1-px-Feret-Korrektur.', k: 'Eigenimplementierung' },
    R06: { t: 'RubberScope, Eigenimplementierung: angle_to_axis(), PERPENDICULAR_MIN_DEG, _crack_metrics_from_mask(). Winkelgrenze 60° ist projektspezifisch.', k: 'Eigenimplementierung' },
    R07: { t: 'RubberScope, Eigenimplementierung: _stats(), group_statistics(), group_tests(). Statistik über Bilder, nicht zwingend unabhängige Prüfkörper.', k: 'Eigenimplementierung' },
    R08: { t: 'RubberScope, Eigenimplementierung: validate_reference_set(), selftest(); rubberscope_berichte.py validate_real_reference_set(). Definition der Referenzprüfungen.', k: 'Eigenimplementierung' },
    R09: { t: 'RubberScope, Eigenimplementierung: rubberscope_berichte.py rechenprotokoll(). Algebraische Einsetzungen, Rundungsdifferenzen möglich.', k: 'Eigenimplementierung' },
    R10: { t: 'RubberScope 2.7, Eigenimplementierung: profile_widths(), _fit_width_model(). Rissbreite aus Grauwertprofilen senkrecht zur Mittellinie (Halbwertsbreite; Kastenprofil ⊗ Gauß mit R²-Grenze). Validiert an Demo-Set und Testkarte TK-1: mittlerer Breitenfehler 6,8 % (Fläche ÷ Länge: 24,5 %).', k: 'Eigenimplementierung' },
    L01: { t: 'Braden, M.; Gent, A. N. (1960): The attack of ozone on stretched rubber vulcanizates. I. The rate of cut growth. Journal of Applied Polymer Science 3(7), S. 90–99. DOI 10.1002/app.1960.070030713.', u: 'https://doi.org/10.1002/app.1960.070030713', k: 'Primärliteratur (Werkstoff)' },
    L02: { t: 'Braden, M.; Gent, A. N. (1960): The attack of ozone on stretched rubber vulcanizates. II. Conditions for cut growth. Nachdruck in Rubber Chemistry and Technology 33(4), S. 1156–1165. DOI 10.5254/1.3542222.', u: 'https://doi.org/10.5254/1.3542222', k: 'Primärliteratur (Werkstoff)' },
    L03: { t: 'Criegee, R. (1975): Mechanism of Ozonolysis. Angewandte Chemie International Edition 14(11), S. 745–752. DOI 10.1002/anie.197507451.', u: 'https://doi.org/10.1002/anie.197507451', k: 'Primärliteratur (Chemie)' },
    L04: { t: 'Canny, J. (1986): A Computational Approach to Edge Detection. IEEE Transactions on Pattern Analysis and Machine Intelligence PAMI-8(6), S. 679–698. DOI 10.1109/TPAMI.1986.4767851.', u: 'https://doi.org/10.1109/TPAMI.1986.4767851', k: 'Primärliteratur (Bildverarbeitung)' },
    L05: { t: 'Leica Microsystems Science Lab: Microscope Resolution – Concepts, Factors and Calculation (Abbe, Airy, Rayleigh-Kriterium).', u: 'https://www.leica-microsystems.com/science-lab/microscope-resolution-concepts-factors-and-calculation/', k: 'Fachartikel (Optik)' },
    L06: { t: 'Basler AG: What Really Limits Microscopy Resolution? Diffraction, Rayleigh, aberrations and Nyquist sampling.', u: 'https://www.baslerweb.com/en/learning/microscopy-resolution-limits/', k: 'Fachartikel (Optik)' },
    L07: { t: 'Luo, S.; Xie, X.; Zhou, B.; Zeng, K.; Guo, J. (2025): Multiscenario Generalization Crack Detection Network Based on the Visual Foundation Model. DOI 10.1155/stc/6269747. Datensatz CTCD (CC BY 4.0).', u: 'https://doi.org/10.1155/stc/6269747', k: 'Primärliteratur (Referenzdaten)' },
    S01: { t: 'Pyodide-Projekt: Python-Distribution für den Browser auf Basis von WebAssembly (hier Version 314.0.8).', u: 'https://pyodide.org/', k: 'Software' },
  };
  RS.SOURCE_GROUPS = [
    ['Externe Fachquellen der Methode (aus RubberScope 2.4)', /^Q/],
    ['Ergänzende Quellen des Lernpfads', /^L/],
    ['Software-Laufzeit', /^S/],
    ['Programmstellen (Eigenimplementierung – keine externen Belege)', /^R/],
  ];

  /** Zitiermarke(n) als HTML: RS.cite('Q03','R03') */
  RS.cite = (...ids) => `<span class="cites">${ids.map(id => `<button type="button" class="cite ${id[0] === 'R' ? 'own' : ''}" data-src="${id}" aria-label="Quelle ${id}">${id}</button>`).join('')}</span>`;

  // Popover für Zitiermarken (Ereignisdelegation)
  let pop = null;
  const closePop = () => { if (pop) { pop.remove(); pop = null; } };
  document.addEventListener('click', e => {
    const b = e.target.closest('button.cite');
    if (!b) { if (pop && !e.target.closest('.cite-pop')) closePop(); return; }
    e.preventDefault();
    closePop();
    const s = S[b.dataset.src];
    if (!s) return;
    pop = RS.h('div', { class: 'cite-pop', role: 'tooltip' },
      RS.h('div', { class: 'cite-kind' }, `[${b.dataset.src}] · ${s.k}`),
      RS.h('div', {}, s.t),
      s.u ? RS.h('a', { href: s.u, target: '_blank', rel: 'noopener' }, 'Quelle öffnen ↗') : RS.h('div', { class: 'muted' }, 'Verweis auf den mitgelieferten Quellcode (im Hilfe-Bereich verlinkt).'));
    document.body.append(pop);
    const r = b.getBoundingClientRect();
    const w = Math.min(380, window.innerWidth - 24);
    pop.style.width = w + 'px';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + window.scrollX - 20)) + 'px';
    pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { e.preventDefault(); closePop(); } });

  RS.routes.quellen = () => {
    const box = RS.$('#quellen-liste');
    if (box.dataset.done) return;
    box.dataset.done = 1;
    for (const [title, re] of RS.SOURCE_GROUPS) {
      box.append(RS.h('h3', {}, title));
      const dl = RS.h('dl', { class: 'srclist' });
      for (const [id, s] of Object.entries(S).filter(([id]) => re.test(id))) {
        dl.append(RS.h('dt', { id: 'src-' + id }, id), RS.h('dd', {}, s.t, ' ', s.u ? RS.h('a', { href: s.u, target: '_blank', rel: 'noopener' }, s.u) : '', RS.h('span', { class: 'tag' }, s.k)));
      }
      box.append(dl);
    }
  };
})();
