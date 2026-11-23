#!/usr/bin/env python3
"""RubberScope 2.3 Riss – Berechnungskern für Ozonrissbilder und Prüfprotokoll.

Explorative, bildbasierte Merkmalserfassung an Mikroskopaufnahmen von Elastomeren.
Orientiert an ISO 1431-1 (Ozonrissbeständigkeit); keine normkonforme Prüfung.

Kommandozeile:
    python rubberscope_engine.py --selftest [ordner]   Systemtest + Validierung + Beispiel-PDF
    python rubberscope_engine.py --demo ordner         nur synthetische Demobilder erzeugen
"""
from __future__ import annotations

import csv
import hashlib
import json
import math
import platform
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import stats as sstats
from scipy.ndimage import distance_transform_edt
from skimage.filters import apply_hysteresis_threshold, frangi
from skimage.morphology import skeletonize

VERSION = '2.4.0-riss'
EXTS = ('.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp')

CLASS_OPTIONS = ['Nicht zugeordnet', 'Riss', 'Riefe / Rille', 'Kratzer / Schnittspur',
                 'Punkt / Porenstruktur', 'Agglomerat', 'Helle Stelle / Reflexion',
                 'Fragment – ausschließen', 'Sonstiges / unklar']
# Objekte mit diesen manuellen Klassen gehen NICHT in die bereinigten Rissmaßzahlen ein.
NON_CRACK_CLASSES = {'Riefe / Rille', 'Kratzer / Schnittspur', 'Punkt / Porenstruktur',
                     'Agglomerat', 'Helle Stelle / Reflexion', 'Sonstiges / unklar'}

# Kulpa (1977): unverzerrter Längenschätzer für 8-verbundene Ketten (isotrope Orientierung)
KULPA = math.pi * (1 + math.sqrt(2)) / 8          # = 0,9481
PERPENDICULAR_MIN_DEG = 60.0                       # "quer zur Dehnung": Winkel zur Dehnachse >= 60°

DEFAULTS = {'riss': {'algorithm': 'rissoptimiert'}}


# ----------------------------------------------------------------------------- Ein-/Ausgabe
def file_sha256(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(chunk), b''):
            h.update(block)
    return h.hexdigest()


def environment_info():
    import skimage, scipy, PIL
    try:
        import reportlab
        rl = reportlab.Version
    except Exception:
        rl = '-'
    return {'RubberScope': VERSION, 'Python': platform.python_version(),
            'Betriebssystem': f'{platform.system()} {platform.release()}',
            'NumPy': np.__version__, 'OpenCV': cv2.__version__, 'scikit-image': skimage.__version__,
            'SciPy': scipy.__version__, 'Pillow': PIL.__version__, 'ReportLab': rl}


def _to_uint8(a, info):
    """Lineare Abbildung auf 8 bit; dokumentiert in info['conversion']."""
    if a.dtype == np.uint8:
        info['conversion'] = '8 bit, unverändert'
        return a
    if np.issubdtype(a.dtype, np.integer):
        mx = int(a.max()) if a.size else 0
        bits = 12 if mx <= 4095 else 16
        full = (1 << bits) - 1
        info['conversion'] = f'{a.dtype} ({bits}-bit-Bereich) linear auf 8 bit: I8 = round(I·255/{full})'
        return np.clip(np.round(a.astype(np.float64) * 255.0 / full), 0, 255).astype(np.uint8)
    a = a.astype(np.float64)
    lo, hi = float(np.nanmin(a)), float(np.nanmax(a))
    info['conversion'] = f'Gleitkomma linear Min–Max ({lo:.4g}…{hi:.4g}) auf 8 bit'
    return np.clip(np.round((a - lo) / max(hi - lo, 1e-12) * 255), 0, 255).astype(np.uint8)


def read_img(path):
    """Liest ein Bild in Originalauflösung. Rückgabe: (RGB uint8, Grau uint8, info)."""
    p = Path(path)
    info = {'source_dtype': None, 'conversion': None, 'note': ''}
    a = None
    if p.suffix.lower() in ('.tif', '.tiff'):
        try:
            import tifffile
            a = np.squeeze(tifffile.imread(str(p)))
            if a.ndim == 4:
                a = a[0]
                info['note'] = 'Mehrdimensionale TIFF: erste Ebene ausgewertet'
            if a.ndim == 3 and a.shape[0] in (3, 4) and a.shape[-1] not in (3, 4):
                a = np.moveaxis(a, 0, -1)
            if a.ndim == 3 and a.shape[-1] not in (3, 4):
                a = a[0]
                info['note'] = 'Bildstapel: erste Ebene ausgewertet'
        except Exception:
            a = None
    if a is None:
        with Image.open(p) as im:
            if im.mode in ('I;16', 'I;16B', 'I;16L', 'I', 'F'):
                a = np.array(im)
            else:
                a = np.array(im.convert('RGB'))
    info['source_dtype'] = str(a.dtype)
    a8 = _to_uint8(a, info)
    if a8.ndim == 2:
        rgb = np.dstack([a8, a8, a8])
    else:
        rgb = np.ascontiguousarray(a8[..., :3])
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)          # Y = 0,299 R + 0,587 G + 0,114 B
    return rgb, gray, info


def metadata_scale(path):
    """(µm/Pixel, Quelle) aus OME-/TIFF-Metadaten, nur wenn eindeutig definiert."""
    p = Path(path)
    if p.suffix.lower() not in ('.tif', '.tiff'):
        return None, 'Kein verlässlicher Maßstab in Standardbild'
    try:
        import tifffile
        with tifffile.TiffFile(p) as tf:
            ome = tf.ome_metadata
            if ome:
                m = re.search(r'PhysicalSizeX="([0-9.eE+-]+)"', ome)
                if m:
                    pos = ome[m.start():m.start() + 350]
                    unit = re.search(r'PhysicalSizeXUnit="([^"]+)"', pos)
                    val = float(m.group(1))
                    u = unit.group(1) if unit else 'µm'
                    factor = {'µm': 1, 'um': 1, 'μm': 1, 'nm': .001, 'mm': 1000, 'm': 1e6}.get(u)
                    if factor and val > 0:
                        return val * factor, 'OME PhysicalSizeX'
            descr = tf.pages[0].description or ''
            for key in ('pixel_size_um', 'microns_per_pixel', 'um_per_pixel'):
                m = re.search(r'\b' + key + r'\s*[=:]\s*([0-9.eE+-]+)', descr, re.I)
                if m and float(m.group(1)) > 0:
                    return float(m.group(1)), 'TIFF ' + key
            # DPI-Tags werden bewusst NICHT verwendet (meist Druckmetadaten).
    except Exception:
        pass
    return None, 'Manuelle Kalibrierung erforderlich'


# ----------------------------------------------------------------------------- Geometrie
def components(mask):
    """8-Nachbarschafts-Komponenten (OpenCV). Rückgabe n, labels(int32), stats, centroids."""
    return cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8, ltype=cv2.CV_32S)


def remove_small(mask, min_area):
    n, lab, st, _ = components(mask)
    keep = st[:, cv2.CC_STAT_AREA] >= max(1, int(min_area))
    keep[0] = False
    return keep[lab]


def shape_moments(sub):
    """Hauptachsen, Exzentrizität und Orientierung aus zentralen Momenten 2. Ordnung."""
    m = cv2.moments(sub.astype(np.uint8), binaryImage=True)
    m00 = m['m00']
    if m00 <= 0:
        return 0.0, 0.0, 0.0, 0.0
    mu20, mu02, mu11 = m['mu20'] / m00, m['mu02'] / m00, m['mu11'] / m00
    common = math.sqrt(4 * mu11 ** 2 + (mu20 - mu02) ** 2)
    l1, l2 = (mu20 + mu02 + common) / 2, (mu20 + mu02 - common) / 2
    major, minor = 4 * math.sqrt(max(l1, 0)), 4 * math.sqrt(max(l2, 0))
    ecc = math.sqrt(max(0.0, 1 - l2 / l1)) if l1 > 0 else 0.0
    theta = 0.5 * math.atan2(2 * mu11, mu20 - mu02)       # Bildkoordinaten (y nach unten)
    angle = (-math.degrees(theta)) % 180.0                   # mathematisch, 0° = horizontal
    return major, minor, ecc, angle


def chain_counts(sk):
    """Anzahl orthogonaler (n_e) und diagonaler (n_o) Nachbarschaftskanten eines Skeletts.
    Diagonalen werden nur gezählt, wenn keine orthogonale Ersatzverbindung besteht."""
    s = sk.astype(bool)
    n_e = np.count_nonzero(s[:, :-1] & s[:, 1:]) + np.count_nonzero(s[:-1, :] & s[1:, :])
    d1 = s[:-1, :-1] & s[1:, 1:] & ~s[:-1, 1:] & ~s[1:, :-1]
    d2 = s[:-1, 1:] & s[1:, :-1] & ~s[:-1, :-1] & ~s[1:, 1:]
    return int(n_e), int(np.count_nonzero(d1) + np.count_nonzero(d2))


def skeleton_length(sk):
    """Kulpa-Schätzer: L = 0,948·n_e + 1,341·n_o  [px]."""
    n_e, n_o = chain_counts(sk)
    return KULPA * (n_e + math.sqrt(2) * n_o)


def feret_max(sub):
    cnts, _ = cv2.findContours(sub.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cnts:
        return 0.0
    pts = np.vstack([c.reshape(-1, 2) for c in cnts]).astype(np.float32)
    hull = cv2.convexHull(pts).reshape(-1, 2).astype(np.float64)
    if len(hull) < 2:
        return 1.0
    d = np.sqrt(((hull[:, None, :] - hull[None, :, :]) ** 2).sum(-1)).max()
    return float(d + 1.0)   # +1 px: Pixelausdehnung statt Pixelmittelpunkt


def angle_to_axis(angle, axis):
    d = abs(angle - axis) % 180.0
    return min(d, 180.0 - d)


# ----------------------------------------------------------------------------- Segmentierung

def smooth_background(img, sigma):
    """Gauß-Hintergrund G_sigma*I. Für große sigma auf verkleinertem Bild berechnet (Faktor f = sigma/8,
    Flächenmittelung) und bilinear zurückskaliert – numerisch nahezu identisch, aber um ein Vielfaches schneller."""
    img = np.asarray(img, np.float32)
    h, w = img.shape[:2]
    f = int(sigma // 8)
    if f < 2 or min(h, w) // f < 16:
        return cv2.GaussianBlur(img, (0, 0), sigma)
    small = cv2.resize(img, (max(1, w // f), max(1, h // f)), interpolation=cv2.INTER_AREA)
    small = cv2.GaussianBlur(small, (0, 0), sigma / f, borderType=cv2.BORDER_REFLECT)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)

# Absolute (bildunabhängige) Schwellen des Mehrskalenverfahrens – bei k = 1:
FRANGI_GAMMA = 0.05      # fester Strukturparameter c (statt bildabhängig ½·max S)
V_REF = 0.25             # Referenz-Vesselness
C_MIN = 0.15             # minimaler Weber-Kontrast (lokale Tiefe / Hintergrund) = 15 %


def crack_features(gray, polarity='dunkel'):
    """Bildunabhängig normierte Merkmale: Weber-Kontrast C und Frangi-Vesselness V."""
    h, w = gray.shape
    src = gray if polarity == 'dunkel' else 255 - gray
    src = cv2.GaussianBlur(src, (3, 3), .65).astype(np.float32)
    bg = np.maximum(smooth_background(src, max(8, min(h, w) / 22)), 1.0)
    inv = np.clip(1 - src / bg, 0, 1)                       # relative Abdunklung (Weber)
    vess = frangi(inv, sigmas=(1, 1.6, 2.5, 3.5), black_ridges=False, alpha=.5, beta=.5, gamma=FRANGI_GAMMA)
    vess = np.nan_to_num(vess, copy=False).astype(np.float32)
    bh = np.zeros_like(src)
    for k in (9, 17, 27):
        bh = np.maximum(bh, cv2.morphologyEx(src, cv2.MORPH_BLACKHAT,
                                             cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))))
    return vess, bh / bg


def crack_optimized_mask(gray, polarity='dunkel', sensitivity=1.0, min_area=16):
    """Mehrskalen-Rissverfahren mit ABSOLUTEN Schwellen (Bilder untereinander vergleichbar).
    Score = min(V/V_ref; C/C_min)·k; Hysterese 0,5 / 1,0."""
    k = max(.2, float(sensitivity))
    vess, contrast = crack_features(gray, polarity)
    score = np.minimum(vess / V_REF, contrast / C_MIN) * k
    mask = apply_hysteresis_threshold(score, 0.5, 1.0)
    mask = remove_small(mask, min_area)
    n, lab, st, _ = components(mask)
    keep = np.zeros(n, bool)
    lmin = max(12, int(min_area) ** .5 * 2.5)
    for i in range(1, n):
        x, y, ww, hh, _a = st[i]
        sub = lab[y:y + hh, x:x + ww] == i
        path_len = int(skeletonize(sub).sum())
        if path_len < lmin:
            continue
        ecc = shape_moments(sub)[2]
        keep[i] = ecc >= .68 or path_len >= 40
    return keep[lab]


C_MIN_FAST = {'riss': 0.12}   # minimaler Weber-Kontrast bei k = 1


def contrast_mask(gray, mode='riss', polarity='dunkel', sensitivity=1.0, min_area=16, algorithm='erweitert'):
    """Kontrastverfahren: Weber-Kontrast C = (I_B − I)/I_B gegen absolute Schwelle C_min/k."""
    h, w = gray.shape
    if min(h, w) < 30:
        raise ValueError('Bild zu klein (< 30 px)')
    g = cv2.GaussianBlur(gray, (3, 3), 0).astype(np.float32)
    if polarity != 'dunkel':
        g = 255 - g
    bg = np.maximum(smooth_background(g, max(9, min(h, w) // 18)), 1.0)
    weber = cv2.GaussianBlur(np.clip((bg - g) / bg, 0, 1), (3, 3), 0)
    threshold = C_MIN_FAST[mode] / max(.2, float(sensitivity))
    mask = (weber >= threshold).astype(np.uint8)
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k3)
    mask = remove_small(mask, min_area)
    if mode == 'riss':
        n, lab, st, _ = components(mask)
        keep = np.zeros(n, bool)
        for i in range(1, n):
            x, y, ww, hh, _a = st[i]
            major, _mi, ecc, _an = shape_moments(lab[y:y + hh, x:x + ww] == i)
            keep[i] = major >= 20 and (ecc >= .68 or major >= 40)
        mask = keep[lab]
    return mask


def make_mask(gray, mode='riss', polarity='dunkel', sensitivity=1.0, min_area=16, algorithm='rissoptimiert'):
    if algorithm == 'rissoptimiert' and mode == 'riss':
        return crack_optimized_mask(gray, polarity, sensitivity, min_area)
    return contrast_mask(gray, mode, polarity, sensitivity, min_area, algorithm)


def bright_anomaly_mask(gray, sensitivity=1.0, min_area=16, exclude=None):
    """Positive lokale Kontrastmerkmale – bewusst NICHT als Risse oder Stoff identifiziert."""
    g = cv2.GaussianBlur(gray, (3, 3), .7)
    gb = g.copy()
    if exclude is not None and exclude.any():   # dunkle Risse nicht in den Hintergrund einrechnen
        gb[cv2.dilate(exclude.astype(np.uint8), np.ones((7, 7), np.uint8)) > 0] = int(np.median(g))
    bg = np.clip(smooth_background(gb, max(10, min(gray.shape) / 17)), 0, 255).astype(np.uint8)
    delta = cv2.subtract(g, bg)
    threshold = 18.0 / max(.3, float(sensitivity))          # absolute Schwelle in Graustufen
    mask =cv2.morphologyEx((delta >= threshold).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    if exclude is not None:
        mask &= ~(cv2.dilate(exclude.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
    return remove_small(mask, min_area)


def surface_appearance(gray, sensitivity=1.0, min_area=16, exclude=None):
    """Heuristische optische Merkmale; KEINE normierte Glanzmessung."""
    g = gray.astype(np.uint8)
    bg = smooth_background(g, max(10, min(g.shape) / 16))
    residual = g.astype(np.float32) - bg.astype(np.float32)
    high = 200                                                # absolute Helligkeit (8 bit)
    threshold = 20.0 / max(.3, float(sensitivity))           # lokaler Überschuss in Graustufen
    hl = cv2.morphologyEx(((g >= high) & (residual >= threshold)).astype(np.uint8), cv2.MORPH_OPEN,
                          np.ones((3, 3), np.uint8)) > 0
    if exclude is not None:
        hl &= ~(cv2.dilate(exclude.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0)
    hl = remove_small(hl, min_area)
    detail = g.astype(np.float32) - cv2.GaussianBlur(g, (0, 0), 3).astype(np.float32)
    metrics = {'image_median_gray': round(float(np.median(g)), 2),
               'image_p95_gray': round(float(np.percentile(g, 95)), 2),
               'image_p99_gray': round(float(np.percentile(g, 99)), 2),
               'surface_texture_rms_gray': round(float(np.sqrt(np.mean(detail ** 2))), 3)}
    return hl, metrics


# ----------------------------------------------------------------------------- Vermessung
def measure_objects(labels, n, st, cents, mode, scale, strain_dir):
    H, W = labels.shape
    objs = []
    for i in range(1, n):
        x, y, w, h, area = (int(v) for v in st[i])
        sub = labels[y:y + h, x:x + w] == i
        major, minor, ecc, angle = shape_moments(sub)
        cx, cy = float(cents[i][0]), float(cents[i][1])
        o = {'id': i, 'x_px': round(cx, 2), 'y_px': round(cy, 2), 'area_px2': area,
             'equiv_diameter_px': round(2 * math.sqrt(area / math.pi), 3),
             'feret_max_px': round(feret_max(sub), 3),
             'major_axis_px': round(major, 3), 'minor_axis_px': round(minor, 3),
             'eccentricity': round(ecc, 4), 'orientation_deg': round(angle, 2),
             'edge_touching': bool(x == 0 or y == 0 or x + w == W or y + h == H),
             'classification': 'Nicht zugeordnet'}
        if mode == 'riss':
            pad = np.pad(sub, 1)
            sk = skeletonize(pad)
            n_e, n_o = chain_counts(sk)
            L = KULPA * (n_e + math.sqrt(2) * n_o)
            dt = distance_transform_edt(pad)
            wl = 2 * dt[sk] - 1 if sk.any() else np.array([0.0])
            o.update({'skeleton_length_px': round(L, 3), 'chain_n_e': n_e, 'chain_n_o': n_o,
                      'mean_width_px': round(area / L, 3) if L > 0 else round(float(np.mean(wl)), 3),
                      'max_width_edt_px': round(float(np.max(wl)), 3)})
            if strain_dir is not None:
                o['angle_to_strain_deg'] = round(angle_to_axis(angle, strain_dir), 2)
        objs.append(o)
    if scale:
        for o in objs:
            o['area_um2'] = round(o['area_px2'] * scale * scale, 3)
            o['equiv_diameter_um'] = round(o['equiv_diameter_px'] * scale, 3)
            o['feret_max_um'] = round(o['feret_max_px'] * scale, 3)
            if mode == 'riss':
                o['skeleton_length_um'] = round(o['skeleton_length_px'] * scale, 3)
                o['mean_width_um'] = round(o['mean_width_px'] * scale, 3)
                o['max_width_edt_um'] = round(o['max_width_edt_px'] * scale, 3)
    return objs


def roi_mask(shape, roi):
    h, w = shape
    m = np.zeros((h, w), bool)
    if roi:
        x0, y0, x1, y1 = (int(v) for v in roi)
        m[max(0, y0):min(h, y1), max(0, x0):min(w, x1)] = True
    else:
        m[:] = True
    return m


def object_at(labels, x, y, radius=15):
    """ID des angeklickten Objekts bzw. des nächstgelegenen Objektpixels im Radius (sonst 0)."""
    h, w = labels.shape
    x, y = int(round(x)), int(round(y))
    if 0 <= x < w and 0 <= y < h and labels[y, x] > 0:
        return int(labels[y, x])
    x0, x1, y0, y1 = max(0, x - radius), min(w, x + radius + 1), max(0, y - radius), min(h, y + radius + 1)
    win = labels[y0:y1, x0:x1]
    yy, xx = np.nonzero(win)
    if not len(yy):
        return 0
    d = (xx + x0 - x) ** 2 + (yy + y0 - y) ** 2
    j = int(np.argmin(d))
    return int(win[yy[j], xx[j]]) if d[j] <= radius ** 2 else 0


def objects_touching_exclusions(labels, exclusions):
    """Original-IDs der Objekte, die eines der Ausschlussrechtecke überlappen."""
    h, w = labels.shape
    ids = set()
    for box in exclusions or []:
        x0, y0, x1, y1 = (int(c) for c in box)
        x0, x1 = sorted((max(0, min(w, x0)), max(0, min(w, x1))))
        y0, y1 = sorted((max(0, min(h, y0)), max(0, min(h, y1))))
        if x1 > x0 and y1 > y0:
            ids.update(int(i) for i in np.unique(labels[y0:y1, x0:x1]) if i)
    return ids


# ----------------------------------------------------------------------------- Hauptanalyse
def analyze(path, mode='riss', scale_um=None, polarity='dunkel', sensitivity=1.0, min_area=16, roi=None,
            algorithm=None, sample_state='Unbekannt', comparison_group='', sample_id='', operator='',
            test_context='', manual_rating='', bright_features=False, surface_features=False,
            controlled_acquisition=False, strain_direction_deg=None, exclude_edge_objects=False,
            scale_uncertainty_pct=None, robustness=False, edge_cracks=False,
            **_ignored):
    if mode != 'riss':
        raise ValueError('RubberScope Riss: nur der Ozonrissmodus ist verfügbar.')
    t0 = time.perf_counter()
    algorithm = algorithm or DEFAULTS[mode]['algorithm']
    rgb, gray, info = read_img(path)
    source = 'Benutzerangabe' if scale_um is not None else None
    if scale_um is None:
        scale_um, source = metadata_scale(path)
    calibrated = scale_um is not None and float(scale_um) > 0
    scale = float(scale_um) if calibrated else None
    roim = roi_mask(gray.shape, roi)

    raw = make_mask(gray, mode, polarity, sensitivity, min_area, algorithm) & roim
    n, labels, st, cents = components(raw)
    objects_all = measure_objects(labels, n, st, cents, mode, scale,
                                  strain_direction_deg if mode == 'riss' else None)
    bright = bright_anomaly_mask(gray, sensitivity, min_area, raw if mode == 'riss' else None) & roim \
        if bright_features else np.zeros_like(raw)
    if surface_features:
        highlight, appearance = surface_appearance(gray, sensitivity, min_area, raw)
        highlight &= roim
    else:
        highlight, appearance = np.zeros_like(raw), {}

    h, w = gray.shape
    summary = {
        'file': str(path), 'file_name': Path(path).name, 'sha256': file_sha256(path),
        'mode': mode, 'algorithm': algorithm, 'polarity': polarity,
        'width_px': w, 'height_px': h, 'source_dtype': info['source_dtype'],
        'intensity_conversion': info['conversion'], 'image_note': info['note'],
        'scale_um_per_px': scale, 'scale_source': source if calibrated else 'nicht kalibriert',
        'calibrated': bool(calibrated), 'scale_uncertainty_pct': scale_uncertainty_pct,
        'sensitivity': float(sensitivity), 'min_area_px': int(min_area), 'roi_px': list(roi) if roi else None,
        'strain_direction_deg': strain_direction_deg if mode == 'riss' else None,
        'exclude_edge_objects': bool(exclude_edge_objects),
        'sample_state': sample_state, 'comparison_group': (comparison_group or '').strip(),
        'sample_id': sample_id or Path(path).stem, 'operator': operator, 'test_context': test_context,
        'manual_rating': manual_rating, 'edge_cracks': edge_cracks,
        'controlled_acquisition': bool(controlled_acquisition),
        'bright_feature_analysis': bool(bright_features), 'surface_feature_analysis': bool(surface_features),
        'raw_object_count': n - 1,
        'analysis_version': VERSION,
        'normative_status': 'Explorative Bildkennwerte; keine normkonforme Einstufung',
        'timestamp': datetime.now().isoformat(timespec='seconds'),
    }
    summary.update(appearance)
    result = {'summary': summary, 'objects_all': objects_all, 'labels': labels, 'roi_mask': roim,
              'initial_bright_mask': bright, 'initial_highlight_mask': highlight, 'original': rgb}
    if robustness:
        summary['robustness'] = robustness_check(gray, raw, mode, polarity, sensitivity, min_area, algorithm,
                                                 roim, scale)
    apply_editor_annotations(result, [], [])
    summary['runtime_s'] = round(time.perf_counter() - t0, 2)
    return result


def _crack_metrics_from_mask(mask, mode, scale, eval_px):
    out = {'area_fraction_pct': 100.0 * mask.sum() / max(1, eval_px)}
    if mode == 'riss':
        L = skeleton_length(skeletonize(mask)) if mask.any() else 0.0
        out['length_px'] = L
        if scale:
            out['length_density_mm_per_mm2'] = (L * scale / 1000) / (eval_px * scale * scale / 1e6)
    return out


def robustness_check(gray, base_mask, mode, polarity, sensitivity, min_area, algorithm, roim, scale):
    """Sensitivitätsanalyse: Hauptkennwerte bei Empfindlichkeit ×0,8 und ×1,2 (ohne manuelle Ausschlüsse)."""
    eval_px = int(roim.sum())
    base = _crack_metrics_from_mask(base_mask, mode, scale, eval_px)
    rows = []
    for f in (0.8, 1.0, 1.2):
        m = base_mask if f == 1.0 else make_mask(gray, mode, polarity, sensitivity * f, min_area, algorithm) & roim
        r = _crack_metrics_from_mask(m, mode, scale, eval_px)
        row = {'factor': f, 'sensitivity': round(sensitivity * f, 3),
               'area_fraction_pct': round(r['area_fraction_pct'], 4),
               'area_rel_change_pct': round(100 * (r['area_fraction_pct'] / base['area_fraction_pct'] - 1), 1)
               if base['area_fraction_pct'] > 0 else None}
        if 'length_density_mm_per_mm2' in r:
            row['length_density_mm_per_mm2'] = round(r['length_density_mm_per_mm2'], 4)
            row['length_rel_change_pct'] = round(100 * (r['length_density_mm_per_mm2'] /
                                                        base['length_density_mm_per_mm2'] - 1), 1) \
                if base.get('length_density_mm_per_mm2') else None
        rows.append(row)
    return rows


def apply_editor_annotations(result, exclusions=None, labels=None, overlap_decisions=None):
    """Ausschlüsse, manuelle Klassen und überprüfbare Objektentscheidungen anwenden.

    Standard: jede berührte Komponente wird vollständig verworfen. Pro berührtem
    Original-Objekt kann der Anwender ausdrücklich `behalten` wählen. Dann wird
    das komplette Objekt einschließlich überlappender Pixel ausgewertet; *nur diese*
    Objektpixel werden aus dem Ausschlussbereich herausgenommen. So passen
    Rissfläche, Risslänge und bewertete Bezugsfläche konsistent zueinander.

    Entscheidungen liegen als Bildkoordinaten vor und werden auf die aktuellen
    Komponenten-IDs abgebildet, nicht über möglicherweise instabile alte IDs.
    """
    exclusions, labels, overlap_decisions = exclusions or [], labels or [], overlap_decisions or []
    lab = result['labels']
    v = result['summary']
    h, w = lab.shape
    excluded = np.zeros((h, w), np.uint8)
    for box in exclusions:
        x0, y0, x1, y1 = (int(c) for c in box)
        x0, x1 = sorted((max(0, min(w, x0)), max(0, min(w, x1))))
        y0, y1 = sorted((max(0, min(h, y0)), max(0, min(h, y1))))
        if x1 > x0 and y1 > y0:
            excluded[y0:y1, x0:x1] = 1
    exb = excluded.astype(bool)
    touched = set(np.unique(lab[exb]).tolist()) - {0} if exb.any() else set()

    decisions = {}
    for item in overlap_decisions:
        oid = object_at(lab, item['x'], item['y'], int(item.get('radius', 12)))
        if oid and oid in touched and item.get('decision') in ('behalten', 'ausschliessen'):
            decisions[oid] = item['decision']
    keep_touching = {oid for oid in touched if decisions.get(oid) == 'behalten'}
    drop = touched - keep_touching
    if v.get('exclude_edge_objects'):
        drop |= {o['id'] for o in result['objects_all'] if o['edge_touching']}
        keep_touching -= drop

    assigned = {}
    for item in labels:
        oid = object_at(lab, item['x'], item['y'], int(item.get('radius', 15)))
        if oid:
            assigned[oid] = item['label']
    objects = []
    for o in result['objects_all']:
        if o['id'] in drop:
            continue
        oo = dict(o)
        oo['classification'] = assigned.get(o['id'], 'Nicht zugeordnet')
        if oo['classification'] == 'Fragment – ausschließen':
            keep_touching.discard(o['id'])
            continue
        oo['overlap_decision'] = 'behalten' if o['id'] in keep_touching else (
            'ausschliessen' if o['id'] in touched else '')
        objects.append(oo)

    # Überlappende, ausdrücklich beibehaltene Risse haben Vorrang vor dem
    # rechteckigen Ausschluss. Die Überschneidung wird somit nicht zugleich
    # im Zähler mitgerechnet und aus der Bezugsfläche entfernt.
    exempt = np.isin(lab, list(keep_touching)) if keep_touching else np.zeros_like(exb)
    effective_exclusion = exb & ~exempt
    valid = result['roi_mask'] & ~effective_exclusion
    keep = np.zeros(len(result['objects_all']) + 1, bool)
    keep[[o['id'] for o in objects]] = True
    mask = keep[lab] & valid
    result.update(objects=objects, mask=mask, excluded_mask=effective_exclusion,
                  bright_mask=result['initial_bright_mask'] & valid,
                  highlight_mask=result['initial_highlight_mask'] & valid,
                  manual_overlap_decisions=[{'object_id': int(oid), 'decision': decisions.get(oid, 'ausschliessen')}
                                            for oid in sorted(touched)])
    v['excluded_region_count'] = len(exclusions)
    v['excluded_area_fraction_pct'] = round(100 * float((effective_exclusion & result['roi_mask']).sum()) /
                                            max(1, int(result['roi_mask'].sum())), 3)
    v['manual_annotation_count'] = len(assigned)
    v['overlap_touched_object_count'] = len(touched)
    v['overlap_retained_object_count'] = len(keep_touching)
    v['overlap_decision_count'] = len(decisions)
    _summarize(result, int(valid.sum()))
    result['overlay'] = render_overlay(result)
    return result


def _stats(vals):
    a = np.asarray(vals, float)
    if not a.size:
        return {}
    return {'median': float(np.median(a)), 'p90': float(np.percentile(a, 90)), 'max': float(a.max()),
            'mean': float(a.mean())}


def _summarize(result, eval_px):
    v, objs, mask = result['summary'], result['objects'], result['mask']
    s = v['scale_um_per_px']
    eval_px = max(1, eval_px)
    eval_mm2 = eval_px * s * s / 1e6 if s else None
    v['effective_evaluated_area_px2'] = eval_px
    v['effective_evaluated_area_mm2'] = round(eval_mm2, 6) if eval_mm2 else None
    v['object_count'] = len(objs)
    v['edge_object_count'] = sum(o['edge_touching'] for o in objs)
    v['feature_area_fraction_pct'] = round(100 * float(mask.sum()) / eval_px, 4)
    v['feature_density_mm2'] = round(len(objs) / eval_mm2, 3) if eval_mm2 else None
    v['classification_counts'] = {k: n for k in CLASS_OPTIONS
                                  if (n := sum(o['classification'] == k for o in objs))}
    v['bright_feature_count'] = int(components(result['bright_mask'])[0] - 1)
    v['bright_feature_area_fraction_pct'] = round(100 * float(result['bright_mask'].sum()) / eval_px, 4)
    if v.get('surface_feature_analysis'):
        v['highlight_object_count'] = int(components(result['highlight_mask'])[0] - 1)
        v['highlight_area_fraction_pct'] = round(100 * float(result['highlight_mask'].sum()) / eval_px, 4)
    u = v.get('scale_uncertainty_pct')
    if v['mode'] == 'riss':
        def crack_block(subset, prefix):
            L = sum(o['skeleton_length_px'] for o in subset)
            A = sum(o['area_px2'] for o in subset)
            v[prefix + 'count'] = len(subset)
            v[prefix + 'total_length_px'] = round(L, 2)
            v[prefix + 'mean_width_px'] = round(A / L, 3) if L > 0 else None   # = ΣA/ΣL (längengewichtet)
            st_ = _stats([o['skeleton_length_px'] for o in subset])
            for k in ('median', 'p90', 'max'):
                v[prefix + f'length_{k}_px'] = round(st_[k], 2) if st_ else None
            if v.get('strain_direction_deg') is not None and L > 0:
                perp = sum(o['skeleton_length_px'] for o in subset
                           if o.get('angle_to_strain_deg', 0) >= PERPENDICULAR_MIN_DEG)
                v[prefix + 'perpendicular_length_fraction_pct'] = round(100 * perp / L, 1)
            if s:
                v[prefix + 'total_length_mm'] = round(L * s / 1000, 5)
                v[prefix + 'length_density_mm_per_mm2'] = round(L * s / 1000 / eval_mm2, 4)
                v[prefix + 'mean_width_um'] = round(A / L * s, 3) if L > 0 else None
                v[prefix + 'length_max_um'] = round(st_['max'] * s, 2) if st_ else None
                v[prefix + 'length_median_um'] = round(st_['median'] * s, 2) if st_ else None
        crack_block(objs, 'crack_')
        clean = [o for o in objs if o['classification'] not in NON_CRACK_CLASSES]
        crack_block(clean, 'crack_clean_')
        if v.get('strain_direction_deg') is not None:
            crack_block([o for o in clean if o['classification'] == 'Riss' or
                         o.get('angle_to_strain_deg', 0) >= PERPENDICULAR_MIN_DEG], 'crack_perp_')
        confirmed = [o for o in objs if o['classification'] == 'Riss']
        v['confirmed_crack_count'] = len(confirmed)
        # Kompatibilität zu v2.0
        v['sum_skeleton_length_mm'] = v.get('crack_total_length_mm')
        v['mean_crack_width_um'] = v.get('crack_mean_width_um')
        if s and u:
            v['uncertainty_length_density_rel_pct'] = round(u, 2)        # L/A ∝ s / s² = 1/s
            v['uncertainty_area_rel_pct'] = round(2 * u, 2)


def render_overlay(result):
    out = result['original'].copy()
    for field, color in (('mask', (16, 224, 207)), ('bright_mask', (250, 171, 62)),
                         ('highlight_mask', (236, 95, 220))):
        m = result[field]
        if m.any():
            out[m] = np.clip(out[m] * .4 + np.array(color) * .6, 0, 255).astype(np.uint8)
    h, w = out.shape[:2]
    lw = max(2, int(round(min(h, w) / 500)))
    ex = result['excluded_mask'].astype(np.uint8)
    if ex.any():
        cnts, _ = cv2.findContours(ex, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(out, cnts, -1, (255, 80, 70), lw)
    objs = result['objects']
    if len(objs) <= 400:
        fs = max(.36, min(h, w) / 1400)
        th = max(1, int(fs * 2.2))
        for o in objs:
            name = str(o['id'])
            if o['classification'] != 'Nicht zugeordnet':
                name += ' ' + o['classification'].split(' / ')[0]
            cv2.putText(out, name, (max(1, int(o['x_px'])), max(12, int(o['y_px']))),
                        cv2.FONT_HERSHEY_SIMPLEX, fs, (255, 220, 75), th, cv2.LINE_AA)
    return out


# ----------------------------------------------------------------------------- Vergleiche & Statistik
PRIMARY_KEYS = {
    'riss': [('crack_clean_length_density_mm_per_mm2', 'Risslängendichte L_A [mm/mm²]'),
             ('crack_perp_length_density_mm_per_mm2', 'L_A quer zur Dehnung [mm/mm²]'),
             ('feature_area_fraction_pct', 'Flächenanteil [%]'),
             ('feature_density_mm2', 'Objektdichte [1/mm²]'),
             ('crack_clean_mean_width_um', 'mittl. Rissbreite [µm]'),
             ('crack_clean_length_max_um', 'max. Risslänge [µm]'),
             ('crack_clean_perpendicular_length_fraction_pct', 'Längenanteil quer zur Dehnung [%]')],
}
UNCALIBRATED_KEYS = {'riss': [('feature_area_fraction_pct', 'Flächenanteil [%]'),
                              ('crack_clean_total_length_px', 'Gesamtlänge [px]'),
                              ('crack_clean_mean_width_px', 'mittl. Breite [px]')],
                     }


def metric_keys(results):
    if not results:
        return []
    mode = results[0]['summary']['mode']
    allcal = all(r['summary']['calibrated'] for r in results)
    return PRIMARY_KEYS[mode] if allcal else UNCALIBRATED_KEYS[mode]


def group_key(v):
    return f"{v.get('comparison_group') or 'ohne Gruppe'} | {v.get('sample_state', 'Unbekannt')}"


def group_statistics(results):
    """Mittelwert, Standardabweichung (n−1), 95-%-Konfidenzintervall je Gruppe und Kennwert."""
    groups = {}
    for r in results:
        groups.setdefault(group_key(r['summary']), []).append(r['summary'])
    table = []
    for key, label in metric_keys(results):
        for g, members in groups.items():
            vals = [float(m[key]) for m in members if m.get(key) is not None]
            n = len(vals)
            if not n:
                continue
            mean = float(np.mean(vals))
            sd = float(np.std(vals, ddof=1)) if n > 1 else None
            ci = float(sstats.t.ppf(.975, n - 1) * sd / math.sqrt(n)) if n > 1 else None
            table.append({'group': g, 'metric': key, 'label': label, 'n': n, 'mean': mean, 'sd': sd,
                          'ci95': ci, 'cv_pct': 100 * sd / mean if sd is not None and mean else None})
    return table


def group_tests(results):
    """Welch-t-Test je Gruppenpaar für den Hauptkennwert, Holm-korrigiert. Nur bei n ≥ 3 je Gruppe."""
    keys = metric_keys(results)
    if not keys:
        return []
    key, label = keys[0]
    groups = {}
    for r in results:
        val = r['summary'].get(key)
        if val is not None:
            groups.setdefault(group_key(r['summary']), []).append(float(val))
    names = [g for g, v in groups.items() if len(v) >= 3]
    tests = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = groups[names[i]], groups[names[j]]
            t, p = sstats.ttest_ind(a, b, equal_var=False)
            tests.append({'metric': label, 'a': names[i], 'b': names[j], 'n_a': len(a), 'n_b': len(b),
                          'mean_a': float(np.mean(a)), 'mean_b': float(np.mean(b)), 't': float(t),
                          'p': float(p)})
    m = len(tests)
    order = sorted(range(m), key=lambda k: tests[k]['p'])
    running = 0.0
    for rank, k in enumerate(order):
        running = max(running, min(1.0, (m - rank) * tests[k]['p']))
        tests[k]['p_holm'] = running
    return tests


def pair_comparison(a, b):
    va, vb = a['summary'], b['summary']
    keys = [k for k, _ in metric_keys([a, b])] + ['object_count', 'bright_feature_area_fraction_pct',
                                                 'highlight_area_fraction_pct', 'surface_texture_rms_gray']
    same_scale = (not va['calibrated'] and not vb['calibrated']) or (
        va['calibrated'] and vb['calibrated'] and abs(va['scale_um_per_px'] / vb['scale_um_per_px'] - 1) < .02)
    out = {'a': va['file'], 'b': vb['file'], 'state_a': va['sample_state'], 'state_b': vb['sample_state'],
           'group_a': va.get('comparison_group', ''), 'group_b': vb.get('comparison_group', ''),
           'comparable': va['mode'] == vb['mode'] and va['algorithm'] == vb['algorithm'] and
           va['polarity'] == vb['polarity'] and va['sensitivity'] == vb['sensitivity'] and same_scale,
           'note': 'Deskriptiver Bildvergleich; keine kausale Interpretation, keine Bildregistrierung.'}
    for key in dict.fromkeys(keys):
        if va.get(key) is not None and vb.get(key) is not None:
            out[key + '_a'], out[key + '_b'] = va[key], vb[key]
            out[key + '_delta_b_minus_a'] = round(float(vb[key]) - float(va[key]), 5)
    return out


def compare_to_unaged(results):
    """Gealterte Proben gegen ungealterte Referenzen derselben Vergleichsgruppe (nur bei
    bestätigt identischen Aufnahmebedingungen und gleichem Maßstab)."""
    for r in results:
        for key in [k for k in r['summary'] if k.startswith('reference_')]:
            r['summary'].pop(key)
    refs = {}
    for r in results:
        v = r['summary']
        if v['sample_state'] == 'Ungealtert (Referenz)' and v.get('comparison_group') and v['controlled_acquisition']:
            refs.setdefault((v['comparison_group'], v['mode'], v['algorithm'], v['polarity']), []).append(v)
    for r in results:
        v = r['summary']
        if v['sample_state'] != 'Gealtert' or not v.get('comparison_group') or not v['controlled_acquisition']:
            continue
        cand = [x for x in refs.get((v['comparison_group'], v['mode'], v['algorithm'], v['polarity']), [])
                if x['calibrated'] == v['calibrated'] and
                (not v['calibrated'] or abs(x['scale_um_per_px'] / v['scale_um_per_px'] - 1) < .02)]
        if not cand:
            continue
        v['reference_count'] = len(cand)
        v['reference_note'] = 'Deskriptiv; Mittelwert der Referenzaufnahmen; keine Registrierung.'
        for key in ('feature_area_fraction_pct', 'crack_clean_length_density_mm_per_mm2',
                    'bright_feature_area_fraction_pct', 'highlight_area_fraction_pct', 'surface_texture_rms_gray'):
            vals = [x.get(key) for x in cand]
            if v.get(key) is not None and all(x is not None for x in vals):
                v['reference_delta_' + key] = round(float(v[key]) - float(np.mean(vals)), 5)
        v['reference_delta_area_pp'] = v.get('reference_delta_feature_area_fraction_pct')


# ----------------------------------------------------------------------------- Profile & Diagramme
def optical_profile(rgb, start, end, scale_um=None):
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    h, w = gray.shape
    x0, y0 = (int(np.clip(start[0], 0, w - 1)), int(np.clip(start[1], 0, h - 1)))
    x1, y1 = (int(np.clip(end[0], 0, w - 1)), int(np.clip(end[1], 0, h - 1)))
    length = float(np.hypot(x1 - x0, y1 - y0))
    n = max(2, int(length) + 1)
    xx, yy = np.linspace(x0, x1, n, dtype=np.float32), np.linspace(y0, y1, n, dtype=np.float32)
    intens = cv2.remap(gray, xx.reshape(1, -1), yy.reshape(1, -1), cv2.INTER_LINEAR)[0]
    unit = 'µm' if scale_um else 'px'
    dist = np.linspace(0, length, n) * (float(scale_um) if scale_um else 1)
    return {'start': [x0, y0], 'end': [x1, y1], 'unit': unit, 'distance': dist.tolist(),
            'intensity': intens.astype(float).tolist()}


def _chart_canvas(width, height, title):
    from PIL import ImageDraw
    im = Image.new('RGB', (width, height), 'white')
    d = ImageDraw.Draw(im)
    d.text((60, 8), title, fill=(16, 75, 96), font=_pil_font(15))
    return im, d


def _pil_font(size):
    from PIL import ImageFont
    for f in _font_candidates()[0]:
        try:
            return ImageFont.truetype(f, size)
        except Exception:
            continue
    return ImageFont.load_default()


def profile_chart(profile, width=900, height=300):
    im, d = _chart_canvas(width, height, 'Optischer Schnitt · Grauwertprofil (0–255)')
    l, r, t, b = 60, width - 20, 36, height - 40
    f = _pil_font(12)
    d.rectangle([l, t, r, b], outline=(120, 140, 155))
    for level in (0, 64, 128, 192, 255):
        y = b - (b - t) * level / 255
        d.line((l, y, r, y), fill=(225, 232, 238))
        d.text((18, y - 7), str(level), fill=(70, 80, 90), font=f)
    dist, inten = profile['distance'], profile['intensity']
    mx = max(float(dist[-1]), 1e-9)
    pts = [(l + float(x) / mx * (r - l), b - float(y) / 255 * (b - t)) for x, y in zip(dist, inten)]
    if len(pts) > 1:
        d.line(pts, fill=(14, 140, 150), width=2)
    d.text((l, b + 10), '0', fill=(70, 80, 90), font=f)
    d.text((r - 120, b + 10), f'{dist[-1]:.2f} {profile["unit"]}', fill=(70, 80, 90), font=f)
    return im


def histogram_chart(values, xlabel, title, width=900, height=300, bins=20):
    im, d = _chart_canvas(width, height, title)
    l, r, t, b = 60, width - 20, 36, height - 46
    f = _pil_font(12)
    vals = np.asarray(values, float)
    d.rectangle([l, t, r, b], outline=(120, 140, 155))
    if vals.size == 0:
        d.text((l + 10, t + 10), 'keine Objekte', fill=(90, 90, 90), font=f)
        return im
    hi = float(np.percentile(vals, 99)) if vals.size > 20 else float(vals.max())
    hi = max(hi, 1e-9)
    counts, edges = np.histogram(np.clip(vals, 0, hi), bins=bins, range=(0, hi))
    cmax = max(1, counts.max())
    bw = (r - l) / bins
    for i, c in enumerate(counts):
        x0 = l + i * bw + 1
        y0 = b - (b - t - 8) * c / cmax
        d.rectangle([x0, y0, x0 + bw - 2, b], fill=(46, 160, 168))
    d.text((18, t), str(int(cmax)), fill=(70, 80, 90), font=f)
    d.text((26, b - 12), '0', fill=(70, 80, 90), font=f)
    d.text((l, b + 8), '0', fill=(70, 80, 90), font=f)
    d.text((r - 90, b + 8), f'{hi:.1f}', fill=(70, 80, 90), font=f)
    d.text(((l + r) / 2 - 80, b + 24), xlabel + '  (Anzahl je Klasse)', fill=(40, 50, 60), font=f)
    return im


# ----------------------------------------------------------------------------- Export
def _fmt(v):
    """Zahlen für deutsches Excel: Dezimalkomma."""
    if isinstance(v, bool) or v is None:
        return '' if v is None else ('ja' if v else 'nein')
    if isinstance(v, float):
        return repr(round(v, 6)).replace('.', ',')
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return v


def export_result(result, folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    v = result['summary']
    tag = re.sub(r'[^A-Za-z0-9_-]', '_', Path(v['file']).stem) + '_' + v['mode']
    cv2.imwrite(str(folder / (tag + '_overlay.png')), cv2.cvtColor(result['overlay'], cv2.COLOR_RGB2BGR))
    cv2.imwrite(str(folder / (tag + '_maske.png')), (result['mask'] * 255).astype(np.uint8))
    if v.get('surface_feature_analysis'):
        cv2.imwrite(str(folder / (tag + '_reflexionskandidaten.png')), (result['highlight_mask'] * 255).astype(np.uint8))
    if v.get('bright_feature_analysis'):
        cv2.imwrite(str(folder / (tag + '_helle_auffaelligkeiten.png')), (result['bright_mask'] * 255).astype(np.uint8))
    (folder / (tag + '_ergebnisse.json')).write_text(json.dumps(
        {'summary': v, 'objects': result['objects'], 'manual_overlap_decisions': result.get('manual_overlap_decisions', []),
         'optical_profile': result.get('optical_profile')},
        ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    return tag


def export_tables(results, folder, conditions=None):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / 'probenuebersicht.csv').open('w', encoding='utf-8-sig', newline='') as f:
        keys = list(dict.fromkeys(k for r in results for k in r['summary']))
        wr = csv.DictWriter(f, fieldnames=keys, delimiter=';', extrasaction='ignore')
        wr.writeheader()
        for r in results:
            wr.writerow({k: _fmt(x) for k, x in r['summary'].items()})
    objrows = [dict(file=Path(r['summary']['file']).name, mode=r['summary']['mode'], **o)
               for r in results for o in r['objects']]
    if objrows:
        keys = list(dict.fromkeys(k for o in objrows for k in o))
        with (folder / 'einzelobjekte.csv').open('w', encoding='utf-8-sig', newline='') as f:
            wr = csv.DictWriter(f, fieldnames=keys, delimiter=';', extrasaction='ignore')
            wr.writeheader()
            for o in objrows:
                wr.writerow({k: _fmt(x) for k, x in o.items()})
    stats_rows = group_statistics(results)
    if stats_rows:
        with (folder / 'gruppenstatistik.csv').open('w', encoding='utf-8-sig', newline='') as f:
            wr = csv.DictWriter(f, fieldnames=list(stats_rows[0]), delimiter=';')
            wr.writeheader()
            for s in stats_rows:
                wr.writerow({k: _fmt(x) for k, x in s.items()})
    params = {'software': environment_info(), 'pruefbedingungen': conditions or {},
              'bilder': [{k: r['summary'].get(k) for k in PARAM_KEYS} for r in results]}
    (folder / 'auswertungsparameter.json').write_text(json.dumps(params, ensure_ascii=False, indent=2, default=str),
                                                      encoding='utf-8')


PARAM_KEYS = ['file_name', 'sha256', 'mode', 'algorithm', 'polarity', 'sensitivity', 'min_area_px', 'roi_px',
              'scale_um_per_px', 'scale_source', 'scale_uncertainty_pct', 'strain_direction_deg',
              'exclude_edge_objects', 'intensity_conversion', 'width_px', 'height_px',
              'excluded_region_count', 'manual_annotation_count', 'overlap_touched_object_count',
              'overlap_retained_object_count', 'overlap_decision_count', 'timestamp', 'runtime_s']


# ----------------------------------------------------------------------------- PDF-Prüfprotokoll
def _font_candidates():
    reg = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
           '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
           '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf']
    bold = ['C:/Windows/Fonts/arialbd.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf']
    return reg, bold


_ASCII = {'≥': '>=', '≤': '<=', '√': 'sqrt', 'Σ': 'Sum ', 'σ': 'sigma', 'π': 'pi', '≈': '~', 'λ': 'lambda',
          'μ': 'mu', 'θ': 'theta', 'φ': 'phi', 'Δ': 'Delta', '∝': '~', '·': '*', '−': '-', '→': '->',
          '∈': 'in', '∩': '&', '¬': 'not ', '₀': '0', 'ω': 'omega', 'β': 'beta', '₉': '9', '₅': '5', '⊥': '_perp', '∗': '*'}


def _register_fonts():
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.fonts import addMapping
    reg, bold = _font_candidates()
    r = next((p for p in reg if Path(p).exists()), None)
    b = next((p for p in bold if Path(p).exists()), None)
    if not r:
        return 'Helvetica', 'Helvetica-Bold', False
    try:
        pdfmetrics.registerFont(TTFont('RS', r))
        pdfmetrics.registerFont(TTFont('RS-Bold', b or r))
        addMapping('RS', 0, 0, 'RS')
        addMapping('RS', 1, 0, 'RS-Bold')
        addMapping('RS', 0, 1, 'RS')
        addMapping('RS', 1, 1, 'RS-Bold')
        return 'RS', 'RS-Bold', True
    except Exception:
        return 'Helvetica', 'Helvetica-Bold', False


def _num(x, nd=4):
    if x is None:
        return '–'
    if isinstance(x, bool):
        return 'ja' if x else 'nein'
    if isinstance(x, (int, np.integer)):
        return f'{int(x):,}'.replace(',', '.')
    if isinstance(x, (float, np.floating)):
        if x == 0:
            return '0'
        mag = abs(x)
        s = f'{x:.{nd}g}' if (mag < 1e-3 or mag >= 1e6) else f'{x:.{max(0, nd - 1 - int(math.floor(math.log10(mag))))}f}'
        return s.replace('.', ',')
    return str(x)


METHOD_TEXT = [
    ('1 Bildeinlesen und Graustufen',
     'Die Bilder werden in Originalauflösung eingelesen; nur die Bildschirmvorschau wird verkleinert. '
     'Mehr-Bit-Daten werden linear auf 8 bit abgebildet (I<sub>8</sub> = round(I·255/(2<sup>b</sup>−1)), '
     'b = 12 oder 16 aus dem Datenmaximum). Graustufen nach ITU-R BT.601: '
     'Y = 0,299·R + 0,587·G + 0,114·B. Für jede Datei wird ein SHA-256-Prüfwert protokolliert, '
     'sodass die Auswertung eindeutig einer Rohdatei zugeordnet werden kann.'),
    ('2 Grundprinzip: absolute, bildunabhängige Schwellen',
     'Die nachfolgenden Kontrast- und Formgrenzen sind numerisch festgelegt und werden nicht aus '
     'Bildperzentilen des einzelnen Bildes angepasst. Dies erleichtert Vergleiche bei gleichen Aufnahmebedingungen, '
     'schließt aber falsche positive Risskandidaten nicht generell aus. Beleuchtungsunterschiede werden über den '
     'Weber-Kontrast C = (I<sub>B</sub> − I)/I<sub>B</sub> kompensiert (I<sub>B</sub> = lokaler Hintergrund, Gauß-gefiltert). '
     'k bezeichnet den Empfindlichkeitsfaktor (k = 1: Standard; k &gt; 1 senkt alle Schwellen um den Faktor k).'),
    ('2a Segmentierung „Präzise · Mehrskalen“ (Risse)',
     f'Gauß-Glättung (σ = 0,65 px); Hintergrund I<sub>B</sub> = G<sub>σ</sub>∗I mit σ = max(8; min(H,W)/22). '
     'Linienverstärkung mit dem Hesse-Matrix-basierten Frangi-Filter (Frangi et al. 1998) auf dem relativen '
     'Abdunklungsbild 1 − I/I<sub>B</sub> bei den Skalen σ ∈ {1; 1,6; 2,5; 3,5} px: '
     'V = exp(−R<sub>B</sub>²/2β²)·(1 − exp(−S²/2c²)), R<sub>B</sub> = λ<sub>1</sub>/λ<sub>2</sub>, '
     f'S = √(λ<sub>1</sub>² + λ<sub>2</sub>²), β = 0,5, c = {FRANGI_GAMMA} (fest). Lokale Tiefe über Black-Hat-Transformation '
     '(elliptische Strukturelemente 9, 17, 27 px), normiert zum Weber-Kontrast C = BH/I<sub>B</sub>. '
     f'Bewertung Score = k·min(V/{V_REF}; C/{C_MIN}); Hysterese mit T<sub>hoch</sub> = 1,0 und T<sub>tief</sub> = 0,5 '
     f'(Objekt wird aufgenommen, wenn es mindestens ein Pixel mit V ≥ {V_REF}/k und C ≥ {int(C_MIN*100)} %/k enthält). '
     'Formfilter: Skelettpixel ≥ max(12; 2,5·√A<sub>min</sub>) und (Exzentrizität ≥ 0,68 oder Skelett ≥ 40 px). '
     'Kein morphologisches Schließen, damit benachbarte Einzelrisse nicht verschmelzen.'),
    ('2b Segmentierung „Kontrastverfahren“ (Risse schnell)',
     'Gauß-Glättung (3×3), Hintergrund I<sub>B</sub> = G<sub>σ</sub>∗I mit σ = max(9; min(H,W)/18); '
     f'Weber-Kontrast C ≥ C<sub>min</sub>/k mit C<sub>min</sub> = {int(C_MIN_FAST["riss"]*100)} %. '
     'Schließen 3×3; Formfilter Hauptachse ≥ 20 px und (e ≥ 0,68 oder Hauptachse ≥ 40 px). '
     'Helle Auffälligkeiten: lokaler Überschuss ≥ 18/k Graustufen; Reflexionskandidaten: I ≥ 200 und Überschuss ≥ 20/k.'),
    ('3 Objektbildung',
     'Zusammenhangskomponenten in 8-Nachbarschaft; Objekte kleiner als A<sub>min</sub> werden verworfen. '
     'Objekte, die einen manuellen Ausschlussbereich berühren oder als „Fragment“ markiert sind, werden '
     'standardmäßig vollständig entfernt. Anwender können berührte Risse ausdrücklich behalten; ihre '
     'Objektpixel werden dann in die bewertete Fläche zurückgenommen. Alle Entscheidungen werden dokumentiert.'),
    ('4 Geometrische Kennwerte',
     'Fläche A = N<sub>px</sub>·s² (s = Pixelgröße in µm). Flächenanteil φ = ΣA<sub>i</sub>/A<sub>eval</sub>·100 %. '
     'Äquivalenter Kreisdurchmesser d<sub>eq</sub> = 2·√(A/π). Max. Feret-Durchmesser = größter Abstand zweier '
     'Punkte der konvexen Hülle + 1 px. Hauptachsen, Exzentrizität e = √(1 − λ<sub>2</sub>/λ<sub>1</sub>) und '
     'Orientierung θ = ½·atan2(2μ<sub>11</sub>; μ<sub>20</sub> − μ<sub>02</sub>) aus den zentralen Momenten 2. Ordnung.'),
    ('5 Risslänge, Rissbreite, Längendichte',
     'Skelettierung (Zhang-Suen-Verdünnung, scikit-image). Länge nach Kulpa (1977): '
     'L = (π(1+√2)/8)·(n<sub>e</sub> + √2·n<sub>o</sub>) = 0,948·n<sub>e</sub> + 1,341·n<sub>o</sub>, mit n<sub>e</sub> '
     'orthogonalen und n<sub>o</sub> diagonalen Nachbarschaftskanten (Diagonale nur ohne orthogonale Ersatzverbindung). '
     'Der Schätzer ist über alle Orientierungen erwartungstreu (max. Einzelfehler ca. ±6 %); die reine '
     'Pixelzählung unterschätzt Diagonalen um bis zu 29 %. Mittlere Breite w̄ = ΣA<sub>i</sub>/ΣL<sub>i</sub> '
     '(längengewichtet, orientierungsunabhängig); lokale Maximalbreite w<sub>max</sub> = 2·d<sub>EDT</sub> − 1 '
     '(euklidische Distanztransformation am Skelett). Risslängendichte L<sub>A</sub> = ΣL<sub>i</sub>/A<sub>eval</sub> '
     '[mm/mm²] als stereologische Kenngröße der Rissdichte.'),
    ('6 Orientierung zur Dehnrichtung',
     'Ozonrisse wachsen bevorzugt senkrecht zur Hauptzugspannung. Für jedes Objekt wird der Winkel '
     'Δ = min(|θ − φ<sub>D</sub>| mod 180°; 180° − …) zur eingegebenen Dehnrichtung φ<sub>D</sub> bestimmt. '
     'Kennwerte: längengewichteter Anteil mit Δ ≥ 60° („quer zur Dehnung“) sowie die orientierungsgefilterte '
     'Risslängendichte L<sub>A,⊥</sub> (nur Objekte mit Δ ≥ 60° oder manuell als „Riss“ bestätigt). '
     'Parallel zur Dehnung liegende Riefen aus der Formgebung gehen so nicht ein. Ein hoher Anteil stützt die '
     'Interpretation als Ozonriss, ersetzt aber keine Ursachenklärung (Riefen aus der Formgebung können '
     'zufällig ebenso orientiert sein).'),
    ('7 Bereinigte Rissmaßzahlen',
     'Rohkennwerte enthalten alle segmentierten Linienobjekte. „Bereinigte“ Kennwerte schließen Objekte aus, '
     'die manuell als Riefe, Kratzer, Pore, Agglomerat, Reflexion oder unklar klassifiziert wurden. '
     '„Bestätigte Risse“ zählt nur ausdrücklich als „Riss“ klassifizierte Objekte.'),
    ('8 Messunsicherheit, Robustheit und Statistik',
     'Eine relative Unsicherheit u<sub>s</sub> der Pixelkalibrierung pflanzt sich fort als u(L)/L = u<sub>s</sub>, '
     'u(A)/A = 2u<sub>s</sub> und u(L<sub>A</sub>)/L<sub>A</sub> = u<sub>s</sub> (L<sub>A</sub> ∝ s/s²). '
     'Die Segmentierungsunsicherheit wird optional durch eine Sensitivitätsanalyse (Empfindlichkeit ×0,8 und ×1,2) '
     'abgeschätzt. Gruppenstatistik: Mittelwert x̄, Standardabweichung s (n − 1), 95-%-Konfidenzintervall '
     'x̄ ± t<sub>0,975; n−1</sub>·s/√n. Gruppenvergleich (ab n ≥ 3 je Gruppe): Welch-t-Test mit Holm-Korrektur, '
     'explorativ. Die statistische Einheit ist das Bild; mehrere Bilder desselben Prüfkörpers sind keine '
     'unabhängigen Proben (Pseudoreplikation beachten).'),
    ('9 Grenzen',
     'Die Auswertung ist bildbasiert und hängt von Beleuchtung, Fokus, Objektiv und Belichtung ab. Breiten unter '
     'ca. 2–3 Pixeln oder unterhalb der optischen Auflösungsgrenze (Rayleigh: d = 0,61·λ/NA) sind nicht belastbar. '
     'Nachweisgrenze (synthetisch charakterisiert; Rauschen σ = 5 GW, Rissbreite ca. 3 px): Wiederfindungsrate '
     '≥ 0,8 ab ca. 20 % Weber-Kontrast bei k = 1 bzw. ab ca. 16 % bei k = 1,5; unter 10 % Kontrast werden Risse '
     'praktisch nicht erkannt, falsch-positive Pixel blieben in allen Fällen &lt; 0,01 %. '
     'Risse und Riefen sind optisch ähnlich; Schwellenwerte wurden auf synthetischen Phantombildern abgestimmt und '
     'müssen an manuell annotierten Realaufnahmen validiert werden. Der optische Schnitt ist ein Grauwertprofil, '
     'kein Tiefenprofil.'),
]

LITERATURE = [
    'ISO 1431-1: Elastomere oder thermoplastische Elastomere – Widerstand gegen Ozonrissbildung – Teil 1: Statische und dynamische Dehnungsprüfung.',
    'Frangi, A. F.; Niessen, W. J.; Vincken, K. L.; Viergever, M. A. (1998): Multiscale vessel enhancement filtering. MICCAI 1998, LNCS 1496, 130–137.',
    'Kulpa, Z. (1977): Area and perimeter measurement of blobs in discrete binary pictures. Computer Graphics and Image Processing 6, 434–451.',
    'Zhang, T. Y.; Suen, C. Y. (1984): A fast parallel algorithm for thinning digital patterns. Communications of the ACM 27(3), 236–239.',
    'van der Walt, S. et al. (2014): scikit-image: image processing in Python. PeerJ 2:e453.',
    'Holm, S. (1979): A simple sequentially rejective multiple test procedure. Scandinavian Journal of Statistics 6, 65–70.',
]

CONDITION_LABELS = [('project', 'Projekt / Arbeit'), ('operator', 'Bearbeiter/in'), ('standard', 'Prüfverfahren / Norm'),
                    ('specimen', 'Prüfkörper / Vulkanisation'), ('ozone', 'Ozonkonzentration'),
                    ('temperature', 'Temperatur'), ('humidity', 'Relative Luftfeuchte'), ('strain', 'Dehnung (statisch/dynamisch)'),
                    ('duration', 'Expositionsdauer / Prüfzeitpunkte'), ('microscope', 'Mikroskop / Objektiv / Beleuchtung'),
                    ('na', 'Numerische Apertur'), ('notes', 'Bemerkungen')]


def pdf_report(results, folder, title='Mikroskopische Bildanalyse – Prüfprotokoll', comparisons=None,
               conditions=None, validation=None, groups_info=None):
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (Image as RLImage, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
                                    Spacer, Table, TableStyle)
    from xml.sax.saxutils import escape

    font, fontb, unicode_ok = _register_fonts()

    def T(s):
        s = str(s)
        if not unicode_ok:
            for k, v in _ASCII.items():
                s = s.replace(k, v)
        return s

    def E(s):
        return T(escape(str(s)))

    conditions = conditions or {}
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    out = folder / 'pruefprotokoll.pdf'
    doc = SimpleDocTemplate(str(out), pagesize=(595, 842), rightMargin=42, leftMargin=42, topMargin=40,
                            bottomMargin=42, title=title, author=conditions.get('operator', ''),
                            subject='RubberScope ' + VERSION)
    ss = getSampleStyleSheet()
    base = ParagraphStyle('B', parent=ss['Normal'], fontName=font, fontSize=8.6, leading=11.8)
    small = ParagraphStyle('S', parent=base, fontSize=7.6, leading=10)
    h1 = ParagraphStyle('H1', parent=base, fontName=fontb, fontSize=17, leading=22, textColor=colors.HexColor('#104B60'))
    h2 = ParagraphStyle('H2', parent=base, fontName=fontb, fontSize=12.5, leading=16, spaceBefore=8, spaceAfter=5,
                        textColor=colors.HexColor('#104B60'), keepWithNext=1)
    h3 = ParagraphStyle('H3', parent=base, fontName=fontb, fontSize=9.6, leading=13, spaceBefore=6, spaceAfter=3,
                        keepWithNext=1)
    cell = ParagraphStyle('C', parent=base, fontSize=7.8, leading=9.6)
    cellb = ParagraphStyle('CB', parent=cell, fontName=fontb)

    def table(rows, widths, header=False, size=7.8):
        data = [[Paragraph(T(c) if isinstance(c, str) and '<' in c else E(c), cellb if (header and i == 0) or
                           (not header and j == 0) else cell) for j, c in enumerate(row)] for i, row in enumerate(rows)]
        t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
        style = [('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.HexColor('#F3F6F8'), colors.white]),
                 ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 3),
                 ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('LINEBELOW', (0, 0), (-1, -1), .25, colors.HexColor('#D5DEE5'))]
        if header:
            style += [('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#DCEBF0'))]
        t.setStyle(TableStyle(style))
        return t

    story = [Paragraph(E(title), h1), Spacer(1, 4),
             Paragraph(E(f"RubberScope {VERSION} · erstellt {datetime.now().strftime('%d.%m.%Y %H:%M')} · "
                         f"{len(results)} Aufnahme(n)"), small), Spacer(1, 10)]
    story.append(Paragraph(T('<b>Methodischer Status:</b> Explorative, bildbasierte Merkmalserfassung mit separat '
                             'dokumentierter Rechenvorschrift. Keine automatische ISO-1431-1-Konformität, '
                             'kein normierter Glanzgrad, keine chemische Identifizierung. Rissbewertungen nach Norm '
                             'erfolgen visuell durch qualifiziertes Personal; die hier angegebenen Kennwerte ergänzen '
                             'diese Bewertung quantitativ und reproduzierbar.'), base))

    # Abschnitt A: Prüfbedingungen
    story.append(Paragraph('A · Prüfbedingungen und Probenzuordnung', h2))
    rows = [[lbl, conditions.get(k) or '–'] for k, lbl in CONDITION_LABELS]
    story.append(table(rows, [170, 341]))
    if groups_info:
        story.append(Paragraph('Vergleichsgruppen / Rezepturen', h3))
        story.append(table([['Gruppe', 'Beschreibung']] + [[g, d or '–'] for g, d in groups_info.items()],
                           [170, 341], header=True))
    na = _parse_float(conditions.get('na'))
    scales = sorted({r['summary']['scale_um_per_px'] for r in results if r['summary']['calibrated']})
    if na and scales:
        d_r = 0.61 * 0.55 / na
        story.append(Spacer(1, 4))
        story.append(Paragraph(T(f'Optische Auflösungsgrenze (Rayleigh, λ = 550 nm, NA = {_num(na, 3)}): '
                                 f'd = 0,61·λ/NA = {_num(d_r, 3)} µm. Nyquist-Bedingung s ≤ d/2 = {_num(d_r / 2, 3)} µm: '
                                 + ', '.join(f"s = {_num(s, 4)} µm → {'erfüllt' if s <= d_r / 2 else 'NICHT erfüllt (Bild unterabgetastet)'}"
                                             for s in scales)), base))

    # Abschnitt B: Übersicht
    story.append(Paragraph('B · Ergebnisübersicht', h2))
    keys = metric_keys(results)
    hdr = ['Aufnahme', 'Gruppe | Zustand'] + [lbl for _, lbl in keys[:4]]
    rows = [hdr] + [[r['summary']['file_name'], group_key(r['summary'])] +
                    [_num(r['summary'].get(k)) for k, _ in keys[:4]] for r in results]
    nk = len(hdr) - 2
    story.append(table(rows, [120, 105] + [286 / nk] * nk, header=True))

    stats_rows = group_statistics(results)
    if stats_rows:
        story.append(Paragraph('Gruppenstatistik (Mittelwert ± Standardabweichung, 95-%-KI)', h3))
        rows = [['Kennwert', 'Gruppe | Zustand', 'n', 'x̄', 's', '± KI95', 'VK %']]
        for s in stats_rows:
            rows.append([s['label'], s['group'], str(s['n']), _num(s['mean']), _num(s['sd']), _num(s['ci95']),
                         _num(s['cv_pct'], 3)])
        story.append(table(rows, [125, 140, 22, 58, 58, 58, 50], header=True))
        if any(s['n'] < 3 for s in stats_rows):
            story.append(Paragraph(T('Hinweis: Gruppen mit n &lt; 3 liefern kein belastbares Streumaß.'), small))
    tests = group_tests(results)
    if tests:
        story.append(Paragraph('Gruppenvergleich (Welch-t-Test, Holm-korrigiert, explorativ)', h3))
        rows = [['Kennwert', 'Gruppe A', 'Gruppe B', 'n A/B', 'x̄ A', 'x̄ B', 't', 'p (Holm)']]
        for t_ in tests:
            rows.append([t_['metric'], t_['a'], t_['b'], f"{t_['n_a']}/{t_['n_b']}", _num(t_['mean_a']),
                         _num(t_['mean_b']), _num(t_['t'], 3), _num(t_['p_holm'], 3)])
        story.append(table(rows, [90, 85, 85, 36, 50, 50, 45, 70], header=True))

    # Abschnitt C: Einzelaufnahmen
    tmpfiles = []
    for idx, r in enumerate(results):
        v = r['summary']
        story.append(PageBreak())
        story.append(Paragraph(E(f"C.{idx + 1} · {v['file_name']}"), h2))
        cal = (f"{_num(v['scale_um_per_px'], 5)} µm/px ({v['scale_source']})"
               + (f", u = ±{_num(v['scale_uncertainty_pct'], 3)} %" if v.get('scale_uncertainty_pct') else '')
               if v['calibrated'] else 'nicht kalibriert – nur Pixelwerte')
        rows = [['Proben-ID', v.get('sample_id')], ['Gruppe | Zustand', group_key(v)],
                ['Bildgröße', f"{v['width_px']} × {v['height_px']} px ({v['source_dtype']}; {v['intensity_conversion']})"],
                ['SHA-256', v['sha256']], ['Kalibrierung', cal],
                ['Verfahren', f"{v['mode']} · {v['algorithm']} · Polung {v['polarity']}"],
                ['Parameter', f"k = {_num(v['sensitivity'], 3)}; A_min = {v['min_area_px']} px²"
                              + (f"; Dehnrichtung φ_D = {_num(v['strain_direction_deg'], 3)}°" if v.get('strain_direction_deg') is not None else '')

                              + ('; Randobjekte ausgeschlossen' if v.get('exclude_edge_objects') else '')],
                ['Bewertete Fläche', f"{_num(v['effective_evaluated_area_px2'])} px²"
                                     + (f" = {_num(v['effective_evaluated_area_mm2'])} mm²" if v.get('effective_evaluated_area_mm2') else '')
                                     + f"; Ausschlüsse: {v.get('excluded_region_count', 0)} ({_num(v.get('excluded_area_fraction_pct'), 3)} %)"],
                ['Objekte', f"{v['object_count']} (roh {v['raw_object_count']}, Rand berührend {v['edge_object_count']}, "
                            f"manuell klassifiziert {v.get('manual_annotation_count', 0)})"],
                ['Ausschluss-Überlappungen', f"berührt: {v.get('overlap_touched_object_count', 0)}; "
                 f"manuell erhalten: {v.get('overlap_retained_object_count', 0)}; "
                 f"Entscheidungen: {v.get('overlap_decision_count', 0)}"],
                ['Flächenanteil φ', f"{_num(v['feature_area_fraction_pct'])} %"],
                ['Objektdichte', f"{_num(v['feature_density_mm2'])} 1/mm²" if v.get('feature_density_mm2') is not None else '–']]
        if v['mode'] == 'riss':
            u = 'µm' if v['calibrated'] else 'px'
            for pre, lbl in (('crack_', 'alle Linienobjekte'), ('crack_clean_', 'bereinigt'),
                             ('crack_perp_', 'quer zur Dehnung')):
                if v.get(pre + 'count') is None:
                    continue
                rows.append([f'Risse ({lbl})',
                             f"n = {v.get(pre + 'count')}; ΣL = "
                             + (f"{_num(v.get(pre + 'total_length_mm'))} mm; L_A = {_num(v.get(pre + 'length_density_mm_per_mm2'))} mm/mm²; "
                                f"w̄ = {_num(v.get(pre + 'mean_width_um'))} µm; L_max = {_num(v.get(pre + 'length_max_um'))} µm"
                                if v['calibrated'] else
                                f"{_num(v.get(pre + 'total_length_px'))} px; w̄ = {_num(v.get(pre + 'mean_width_px'))} px")
                             + (f"; quer zur Dehnung {_num(v.get(pre + 'perpendicular_length_fraction_pct'), 3)} %"
                                if v.get(pre + 'perpendicular_length_fraction_pct') is not None else '')])
            rows.append(['Bestätigte Risse', str(v.get('confirmed_crack_count', 0))])
            if v.get('uncertainty_length_density_rel_pct'):
                rows.append(['Kalibrier-Unsicherheit', f"u(L_A)/L_A = {_num(v['uncertainty_length_density_rel_pct'], 3)} %; "
                                                       f"u(A)/A = {_num(v['uncertainty_area_rel_pct'], 3)} %"])
        if v.get('bright_feature_analysis'):
            rows.append(['Helle Auffälligkeiten', f"{v.get('bright_feature_count', 0)} Objekte / {_num(v.get('bright_feature_area_fraction_pct'))} %"])
        if v.get('surface_feature_analysis'):
            rows.append(['Reflexionskandidaten', f"{v.get('highlight_object_count', 0)} / {_num(v.get('highlight_area_fraction_pct'))} % "
                                                 f"(Helligkeitsproxy, kein Glanzgrad); Textur-RMS {_num(v.get('surface_texture_rms_gray'))} GW"])
        cc = {k: n for k, n in (v.get('classification_counts') or {}).items() if k != 'Nicht zugeordnet'}
        if cc:
            rows.append(['Manuelle Klassen', ', '.join(f'{k}: {n}' for k, n in cc.items())])
        if 'reference_delta_area_pp' in v and v['reference_delta_area_pp'] is not None:
            rows.append(['Differenz zur ungealterten Referenz', f"Δφ = {_num(v['reference_delta_area_pp'])} Prozentpunkte"
                         + (f"; ΔL_A = {_num(v.get('reference_delta_crack_clean_length_density_mm_per_mm2'))} mm/mm²"
                            if v.get('reference_delta_crack_clean_length_density_mm_per_mm2') is not None else '')
                         + f" (n_Ref = {v['reference_count']})"])
        if v.get('manual_rating'):
            rows.append(['Visuelle Bewertung (manuell)', v['manual_rating']])
        if v.get('test_context'):
            rows.append(['Prüfkontext', v['test_context']])
        rows.append(['Rechenzeit', f"{_num(v.get('runtime_s'), 3)} s"])
        story.append(table(rows, [150, 361]))

        tmp = folder / f'_report_{idx}.png'
        ov = r['overlay']
        hh, ww = ov.shape[:2]
        f = min(1.0, 1800 / max(hh, ww))
        Image.fromarray(ov if f >= 1 else cv2.resize(ov, (int(ww * f), int(hh * f)), interpolation=cv2.INTER_AREA)).save(tmp)
        tmpfiles.append(tmp)
        cw = 511
        ch = min(285, cw * hh / ww)
        cw = ch * ww / hh
        story += [Spacer(1, 8), RLImage(str(tmp), width=cw, height=ch), Spacer(1, 3),
                  Paragraph(T('Türkis: segmentierte Objekte · Orange: helle Bereiche · Magenta: Reflexionskandidaten · '
                              'Rot: ausgeschlossene Bereiche · Gelb: Objekt-ID und manuelle Klasse.'), small)]
        if r['objects']:
            vals = [o.get('skeleton_length_um', o['skeleton_length_px']) for o in r['objects']]
            xl = 'Risslänge L [' + ('µm' if v['calibrated'] else 'px') + ']'
            hp = folder / f'_hist_{idx}.png'
            histogram_chart(vals, T(xl), T('Größenverteilung der Objekte')).save(hp)
            tmpfiles.append(hp)
            story += [Spacer(1, 4), RLImage(str(hp), width=420, height=140)]
        if v.get('robustness'):
            rb = v['robustness']
            rrows = [['Faktor', 'k', 'φ [%]', 'Δφ rel. [%]'] + (['L_A [mm/mm²]', 'ΔL_A rel. [%]'] if 'length_density_mm_per_mm2' in rb[0] else [])]
            for x in rb:
                rrows.append([_num(x['factor'], 2), _num(x['sensitivity'], 3), _num(x['area_fraction_pct']),
                              _num(x['area_rel_change_pct'], 3)] +
                             ([_num(x.get('length_density_mm_per_mm2')), _num(x.get('length_rel_change_pct'), 3)]
                              if 'length_density_mm_per_mm2' in rb[0] else []))
            story.append(KeepTogether([Paragraph('Sensitivitätsanalyse (Segmentierungsrobustheit)', h3),
                                       table(rrows, [60, 60, 80, 80, 110, 110][:len(rrows[0])], header=True)]))
        classified = [o for o in r['objects'] if o['classification'] != 'Nicht zugeordnet']
        if classified:
            story.append(Paragraph('Manuell klassifizierte Objekte', h3))
            for o in classified[:40]:
                story.append(Paragraph(E(f"ID {o['id']}: {o['classification']} · Position ({o['x_px']}; {o['y_px']}) px"), small))
        if r.get('optical_profile'):
            pp = folder / f'_profile_{idx}.png'
            profile_chart(r['optical_profile']).save(pp)
            tmpfiles.append(pp)
            prof = r['optical_profile']
            story += [Paragraph('Optischer Schnitt (Grauwertprofil)', h3),
                      RLImage(str(pp), width=480, height=160),
                      Paragraph(E(f"Linie von {tuple(prof['start'])} nach {tuple(prof['end'])} px; bilineare Interpolation; "
                                  'Helligkeit, kein topografischer Tiefenschnitt.'), small)]

    if comparisons:
        story.append(PageBreak())
        story.append(Paragraph('D · Direkte Probenvergleiche (B − A)', h2))
        for comp in comparisons:
            block = [Spacer(1, 6), Paragraph(E(f"A: {Path(comp['a']).name} ({comp.get('group_a') or '–'} | {comp['state_a']})"), base),
                     Paragraph(E(f"B: {Path(comp['b']).name} ({comp.get('group_b') or '–'} | {comp['state_b']})"), base)]
            rows = [['Kennwert', 'A', 'B', 'B − A']]
            for k in [k[:-len('_delta_b_minus_a')] for k in comp if k.endswith('_delta_b_minus_a')]:
                rows.append([k.replace('_', ' '), _num(comp[k + '_a']), _num(comp[k + '_b']), _num(comp[k + '_delta_b_minus_a'])])
            if len(rows) > 1:
                block.append(table(rows, [230, 90, 90, 101], header=True))
            if not comp.get('comparable'):
                block.append(Paragraph(T('<b>Achtung:</b> Verfahren, Parameter oder Maßstab unterscheiden sich – Werte nur eingeschränkt vergleichbar.'), small))
            story.append(KeepTogether(block))

    # Der Hauptbericht bleibt bewusst kurz. Ausfuehrliche Methodik und die
    # Einzelvalidierung werden seit 2.3 in ZWEI eigenstaendige PDFs exportiert.
    story.append(Paragraph('E · Methodische Nachweise (separate Dokumente)', h2))
    story.append(Paragraph(T('Die vollstaendigen Rechenvorschriften, die numerischen Einsetzungen pro Aufnahme '
                             'und Objekt, die Parametertabellen sowie die Referenzbild-Validierung sind im '
                             'separaten <b>methoden_und_rechenprotokoll.pdf</b> und '
                             '<b>validierungsprotokoll_synthetisch.pdf</b> beziehungsweise '
                             '<b>validierungsprotokoll_echte_fremdbilder.pdf</b> dokumentiert. '
                             'Externe Referenzbilder anderen Materials belegen keine Ozonriss-Validierung.'), base))
    story.append(Paragraph('G · Software-Umgebung und Rückverfolgbarkeit', h2))
    env = environment_info()
    story.append(table([[k, v] for k, v in env.items()], [150, 361]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(T('Alle Parameter je Bild sind zusätzlich maschinenlesbar in auswertungsparameter.json, '
                             'die Einzelobjekte in einzelobjekte.csv und die Gruppenstatistik in gruppenstatistik.csv '
                             'abgelegt. Gleiche Rohdatei (SHA-256), gleiche Parameter und gleiche Softwareversion '
                             'liefern identische Ergebnisse (deterministische Verarbeitung).'), base))
    story.append(Paragraph('Literatur und Normen', h3))
    for lit in LITERATURE:
        story.append(Paragraph(E(lit), small))
    story.append(KeepTogether([Spacer(1, 18), table([['Ausgewertet (Name, Datum)', ''],
                                                     ['Geprüft / freigegeben (Name, Datum)', '']], [200, 311])]))

    def page(canvas, d):
        canvas.setFont(font, 7.5)
        canvas.setFillColor(colors.grey)
        canvas.drawString(42, 24, T(f'RubberScope {VERSION} · explorative Bildauswertung, nicht normzertifiziert'))
        canvas.drawRightString(553, 24, f'Seite {d.page}')

    try:
        doc.build(story, onFirstPage=page, onLaterPages=page)
    finally:
        for t in tmpfiles:
            try:
                t.unlink()
            except Exception:
                pass
    return out


def _parse_float(s):
    try:
        return float(str(s).replace(',', '.').strip())
    except Exception:
        return None


# ----------------------------------------------------------------------------- Demo & Validierung
def create_demo(folder):
    """Synthetische Szenen mit exakter Ground Truth (keine Realproben).
    Erzeugt Rissaufnahmen zweier exemplarischer Rezepturen zur Live-Vorführung."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(2026)
    h, w = 520, 760
    yy, xx = np.indices((h, w))
    files = []

    def background(seed):
        r = np.random.default_rng(seed)
        bg = 174 + 10 * np.sin(xx / 150) + 7 * np.cos(yy / 80) + r.normal(0, 5, (h, w))
        # Riefen aus der Formgebung: schwach, parallel zur Dehnrichtung (horizontal)
        for k in range(4):
            y0 = int(r.integers(30, h - 30))
            bg[max(0, y0 - 1):y0 + 1, :] -= 9
        return bg

    def cracks(seed, n, amp):
        r = np.random.default_rng(seed)
        gt = np.zeros((h, w), np.uint8)
        for k in range(n):
            x0 = int(r.integers(40, w - 40))
            y0 = int(r.integers(30, h // 2))
            ln = int(r.integers(12, 30))
            pts = [[x0 + int(6 * np.sin(t / 3 + k)), y0 + t * 8] for t in range(ln)]
            pts = [[min(w - 2, max(1, x)), min(h - 2, y)] for x, y in pts]
            cv2.polylines(gt, [np.array(pts, np.int32)], False, 255, thickness=int(r.integers(2, 4)))
        return gt

    specs = [('A_mit_Schutzmittel_ungealtert', 0, 0.0, 'Rezeptur A', 'Ungealtert (Referenz)'),
             ('A_mit_Schutzmittel_gealtert_1', 3, .45, 'Rezeptur A', 'Gealtert'),
             ('A_mit_Schutzmittel_gealtert_2', 4, .45, 'Rezeptur A', 'Gealtert'),
             ('A_mit_Schutzmittel_gealtert_3', 2, .45, 'Rezeptur A', 'Gealtert'),
             ('B_ohne_Schutzmittel_ungealtert', 0, 0.0, 'Rezeptur B', 'Ungealtert (Referenz)'),
             ('B_ohne_Schutzmittel_gealtert_1', 11, .5, 'Rezeptur B', 'Gealtert'),
             ('B_ohne_Schutzmittel_gealtert_2', 13, .5, 'Rezeptur B', 'Gealtert'),
             ('B_ohne_Schutzmittel_gealtert_3', 10, .5, 'Rezeptur B', 'Gealtert')]
    for i, (name, n, amp, grp, state) in enumerate(specs):
        bg = background(100 + i)
        gt = cracks(200 + i, n, amp) if n else np.zeros((h, w), np.uint8)
        img = np.clip(bg - cv2.GaussianBlur(gt, (3, 3), .7).astype(np.float32) * amp, 0, 255).astype(np.uint8)
        p = folder / f'demo_riss_{name}.png'
        Image.fromarray(img).save(p)
        Image.fromarray(gt).save(folder / f'demo_riss_{name}_ground_truth.png')
        files.append({'path': str(p), 'mode': 'riss', 'group': grp, 'state': state})
    (folder / 'demo_zuordnung.json').write_text(json.dumps(files, ensure_ascii=False, indent=2), encoding='utf-8')
    return files


def validate_reference_set(folder):
    """6 synthetische Bilder, Parameterwahl auf 1–4, Holdout 5–6; F1 und Längenfehler."""
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(227)
    records, truths = [], {}
    for idx in range(6):
        h, w = 280, 400
        y, x = np.indices((h, w))
        base = np.uint8(np.clip(166 + np.sin(x / 55) * 9 + np.cos(y / 70) * 12 + rng.normal(0, 4 + idx % 3 * 2, (h, w)), 0, 255))
        truth = np.zeros((h, w), np.uint8)
        for j in range(2 + idx % 4):
            startx = 25 + j * 65 + idx * 6
            pts = [[startx + int(13 * np.sin(t / 4 + j * .8) + t * (idx % 2 - .5) * .25), 12 + t * 10] for t in range(26)]
            cv2.polylines(truth, [np.array(pts, np.int32)], False, 255, 2 + j % 2)
        noise = np.zeros_like(truth)
        for _ in range(19):
            cv2.circle(noise, (int(rng.integers(10, w - 10)), int(rng.integers(10, h - 10))), int(rng.integers(2, 8)), 255, -1)
        image = np.clip(base.astype(np.float32) - cv2.GaussianBlur(truth, (3, 3), .65) * (.45 + idx * .075)
                        - cv2.GaussianBlur(noise, (3, 3), .7) * .3, 0, 255).astype(np.uint8)
        Image.fromarray(image).save(folder / f'referenz_{idx + 1:02d}.png')
        Image.fromarray(truth).save(folder / f'referenz_{idx + 1:02d}_maske.png')
        gt = truth > 0
        L_true = skeleton_length(skeletonize(gt))
        truths[idx + 1] = L_true
        for algorithm in ('erweitert', 'rissoptimiert'):
            for sens in ((.5, .75, 1., 1.25, 1.5) if algorithm == 'rissoptimiert' else (.35, .6, 1., 1.3)):
                m = make_mask(image, 'riss', 'dunkel', sens, 12, algorithm)
                tp, fp, fn = int((m & gt).sum()), int((m & ~gt).sum()), int((~m & gt).sum())
                p_, r_ = tp / max(tp + fp, 1), tp / max(tp + fn, 1)
                L = skeleton_length(skeletonize(m)) if m.any() else 0.0
                records.append(dict(image=idx + 1, algorithm=algorithm, sensitivity=sens, TP=tp, FP=fp, FN=fn, TN=int((~m & ~gt).sum()), precision=round(p_, 4),
                                    recall=round(r_, 4), f1=round(2 * p_ * r_ / max(p_ + r_, 1e-9), 4),
                                    length_error_pct=round(100 * (L / L_true - 1), 2)))
    summary = {}
    for algorithm in ('erweitert', 'rissoptimiert'):
        sel = [r for r in records if r['algorithm'] == algorithm]
        opts = sorted({r['sensitivity'] for r in sel})
        chosen = max(opts, key=lambda s: np.mean([r['f1'] for r in sel if r['sensitivity'] == s and r['image'] <= 4]))
        dev = [r for r in sel if r['sensitivity'] == chosen and r['image'] <= 4]
        hold = [r for r in sel if r['sensitivity'] == chosen and r['image'] > 4]
        summary[algorithm] = dict(sensitivity=chosen, development_f1=round(float(np.mean([r['f1'] for r in dev])), 4),
                                  holdout_f1=round(float(np.mean([r['f1'] for r in hold])), 4),
                                  holdout_length_error_pct=round(float(np.mean([r['length_error_pct'] for r in hold])), 2))
    report = {'method': '6 synthetische Bilder mit bekannten Pixelmasken; Parameterwahl auf 1–4, Holdout 5–6',
              'restriction': 'Keine ISO-normierten Bildvorlagen; keine Realproben-Validierung',
              'scores': summary, 'detail': records}
    (folder / 'referenztest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


def selftest(folder=None):
    """Prüft Abhängigkeiten, Rechenkern, Validierung und PDF-Erzeugung – vor der Präsentation ausführen."""
    folder = Path(folder or Path.cwd() / 'rubberscope_selbsttest')
    print(f'RubberScope {VERSION} – Systemtest in {folder}')
    for k, v in environment_info().items():
        print(f'  {k:14s} {v}')
    t0 = time.perf_counter()
    val = validate_reference_set(folder / 'validierung')
    for alg, sc in val['scores'].items():
        print(f"  Validierung {alg:14s} F1 Holdout = {sc['holdout_f1']:.3f}, Längenfehler = {sc['holdout_length_error_pct']:+.1f} %")
    files = create_demo(folder / 'demo')
    results = []
    for f in files:
        r = analyze(f['path'], mode=f['mode'], scale_um=0.8, scale_uncertainty_pct=1.0, sample_state=f['state'],
                    comparison_group=f['group'], strain_direction_deg=0.0, controlled_acquisition=True,
                    bright_features=True, surface_features=True,
                    robustness=f['path'].endswith('B_ohne_Schutzmittel_gealtert_1.png'))
        results.append(r)
    riss = [r for r in results if r['summary']['mode'] == 'riss']
    compare_to_unaged(riss)
    cond = {'project': 'Systemtest (synthetische Daten)', 'standard': 'ISO 1431-1 (Orientierung)', 'ozone': '50 pphm (Beispiel)',
            'temperature': '40 °C (Beispiel)', 'strain': '20 % statisch (Beispiel)', 'duration': '72 h (Beispiel)', 'na': '0,25'}
    out = folder / 'protokoll_riss'
    for r in riss:
        export_result(r, out)
    export_tables(riss, out, cond)
    pdf = pdf_report(riss, out, 'RubberScope – Systemtest Rissauswertung (synthetisch)',
                     comparisons=[pair_comparison(riss[1], riss[5])], conditions=cond, validation=val,
                     groups_info={'Rezeptur A': 'mit Alterungsschutzmittel (Beispiel)', 'Rezeptur B': 'ohne Alterungsschutzmittel (Beispiel)'})
    import rubberscope_berichte as extra
    pmethod = extra.rechenprotokoll(riss, out)
    pval = extra.validierungsprotokoll(val, out)
    print(f'  PDF Riss:        {pdf}')
    print(f'  PDF Rechenweg:   {pmethod}')
    print(f'  PDF Validierung: {pval}')
    print(f'  Gesamtdauer {time.perf_counter() - t0:.1f} s – Systemtest bestanden.')
    return pdf


if __name__ == '__main__':
    args = sys.argv[1:]
    try:
        if args and args[0] == '--demo':
            print(json.dumps(create_demo(args[1] if len(args) > 1 else 'rubberscope_demo'), indent=2, ensure_ascii=False))
        else:
            selftest(args[1] if len(args) > 1 else None)
    except Exception:
        import traceback
        traceback.print_exc()
        print('\nSystemtest FEHLGESCHLAGEN – bitte INSTALLIEREN.bat erneut ausführen.')
        sys.exit(1)
