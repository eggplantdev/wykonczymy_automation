# Vector layer loader for the case 6 projekt (ArchiCAD PDF → `pdftocairo -svg`).
# Every drawing path carries `matrix(2.831207,…)`: its own units are paper millimetres, and the
# plans are 1:50, so 1 unit ≈ 4,98 cm — checked against the printed sides 464 × 304 and 355 × 253.
import re, math
import numpy as np, cv2

PX_PER_UNIT = 6  # raster resolution for flood fills


def load(svg_path):
    """All non-glyph paths as dicts: stroke, fill, width, subpaths [[(x, y), …], …] in drawing units."""
    svg = open(svg_path, encoding='utf-8').read()
    body = svg.split('</defs>', 1)[1] if '</defs>' in svg else svg
    out = []
    for m in re.finditer(r'<path ([^>]*?)/?>', body):
        a = m.group(1)
        d = re.search(r'\bd="([^"]*)"', a)
        if not d:
            continue
        g = lambda k: (re.search(r'\b' + k + r'="([^"]*)"', a) or [None, None])[1]
        tr = g('transform')
        if not tr or not tr.startswith('matrix(2.83'):
            continue  # glyph/logo transforms are not drawing geometry
        out.append(dict(stroke=g('stroke'), fill=g('fill'), w=float(g('stroke-width') or 0), subs=subpaths(d.group(1))))
    return out


def subpaths(d):
    toks = re.findall(r'[MLCZ]|-?\d+\.?\d*(?:e-?\d+)?', d)
    subs, cur, cmd, i = [], [], None, 0
    while i < len(toks):
        t = toks[i]
        if t in 'MLCZ':
            cmd = t
            i += 1
            if t == 'M' and cur:
                subs.append(cur)
                cur = []
            if t == 'M':
                cur = []
            if t == 'Z' and cur:
                cur.append(cur[0])
            continue
        if cmd == 'C':
            p = [float(x) for x in toks[i:i + 6]]
            i += 6
            cur.append((p[4], p[5]))
        else:
            cur.append((float(toks[i]), float(toks[i + 1])))
            i += 2
    if cur:
        subs.append(cur)
    return subs


def rgb(s):
    return s and s.startswith('rgb(') and tuple(round(float(v.strip(' %'))) for v in s[4:-1].split(','))


def seg_length(subs):
    return sum(math.dist(a, b) for s in subs for a, b in zip(s, s[1:]))


def canvas(paths):
    xs = [x for p in paths for s in p['subs'] for x, _ in s]
    ys = [y for p in paths for s in p['subs'] for _, y in s]
    return (int(max(ys) * PX_PER_UNIT) + 10, int(max(xs) * PX_PER_UNIT) + 10)


def draw(img, paths, thick=1, fill=False):
    for p in paths:
        for s in p['subs']:
            pts = (np.array(s) * PX_PER_UNIT).astype(np.int32).reshape(-1, 1, 2)
            if fill and len(s) > 2:
                cv2.fillPoly(img, [pts], 255)
            else:
                cv2.polylines(img, [pts], False, 255, thick)
    return img
