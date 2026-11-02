"""
Slices a character pose sheet into transparent, head-aligned sprites.

Usage:
    python3 scripts/slice-poses-ai.py <character> [--out DIR]

Reads assets/characters/<character>/raw/sheet.png and layout.json, and writes
<pose>.png files into assets/characters/<character>/ (or --out).

Requirements: pip install rembg onnxruntime pillow numpy scipy
(the "matte" method downloads a ~176 MB model on first use).

layout.json keys:
    method         "matte" for busy/gradient backgrounds (rembg isnet-anime),
                   "flood" for flat backgrounds: flood-fill from the sheet edges,
                   stopping at the character's dark outline.
    poses          pose names in reading order (left to right, top row first);
                   null skips a figure (e.g. off-model art)
    rowSplit       number of poses on the top row
    headX          optional head-centre x per pose, used to align heads;
                   null entries (or omitting it) use the bounding-box centre
    minArea        figures smaller than this many pixels are ignored (bubbles, labels)
    cleanRoi       optional {pose: [x0, y0, x1, y1]} regions, in shared-canvas
                   pixels, where background leaked in beside a speech bubble
    scaleOverride  optional {pose: factor} for poses the head-size heuristic misjudges
    eraseRects     optional [[x0, y0, x1, y1], ...] sheet regions painted with the
                   background colour before slicing (speech bubbles, sparkles)
"""
import argparse
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def matte_mask(im):
    from rembg import new_session, remove

    res = remove(im, session=new_session('isnet-anime'))
    # Harden the matte: the model leaves translucent patches on hands and edges.
    mask = np.array(res.getchannel('A')) > 0.22 * 255
    mask = ndi.binary_fill_holes(mask)
    return ndi.binary_opening(mask, iterations=1)


def flood_mask(im):
    rgb = np.array(im).astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    # Close 1-2px gaps in the outline so the fill can't leak into white clothing.
    outline = ndi.binary_dilation(lum < 150, iterations=2)
    passable = (lum > 200) & (sat < 28) & ~outline
    seeds = np.zeros_like(passable)
    seeds[0, :] = seeds[-1, :] = seeds[:, 0] = seeds[:, -1] = True
    background = ndi.binary_propagation(seeds & passable, mask=passable)
    mask = ndi.binary_fill_holes(~background)
    # Undo the dilation margin so no light halo is left outside the outline.
    return ndi.binary_erosion(mask, iterations=1)


def figures(mask, layout, height):
    lab, n = ndi.label(mask)
    areas = ndi.sum(mask, lab, range(1, n + 1))
    centres = ndi.center_of_mass(mask, lab, range(1, n + 1))
    big = [(i + 1, centres[i]) for i in range(n) if areas[i] > layout.get('minArea', 20000)]
    poses = layout['poses']
    if len(big) != len(poses):
        raise SystemExit(f'expected {len(poses)} figures, found {len(big)}; adjust minArea')
    split = height * 0.55
    top = sorted((b for b in big if b[1][0] < split), key=lambda b: b[1][1])
    bottom = sorted((b for b in big if b[1][0] >= split), key=lambda b: b[1][1])
    if len(top) != layout['rowSplit']:
        raise SystemExit(f'top row has {len(top)} figures, layout says {layout["rowSplit"]}')
    return lab, top + bottom


def clean(img, roi):
    """Remove background that leaked in beside a speech bubble.

    Floods inward from the transparent outside, within roi, stopping at the
    character's dark outline, so only leaked background is removed.
    """
    a = np.array(img).astype(float)
    x0, y0, x1, y1 = roi
    rgb = a[..., :3]
    lum = rgb.mean(axis=2)
    navy = (rgb[..., 2] > rgb[..., 0] + 12) & (lum < 130)  # the bubble's navy outline
    eatable = (lum >= 75) | navy
    inroi = np.zeros(lum.shape, bool)
    inroi[y0:y1, x0:x1] = True
    outside = (a[..., 3] == 0) & inroi
    reach = ndi.binary_propagation(outside, mask=(outside | ((a[..., 3] > 0) & eatable)) & inroi)
    a[..., 3][reach] = 0
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def keep_largest(img):
    a = np.array(img)
    solid = a[..., 3] > 8
    lab, n = ndi.label(solid)
    if n > 1:
        sizes = ndi.sum(solid, lab, range(1, n + 1))
        a[..., 3][lab != 1 + int(np.argmax(sizes))] = 0
    return Image.fromarray(a, 'RGBA')


def hair_width(img):
    """Width of the hair blob, used to normalise head size across poses."""
    arr = np.array(img).astype(int)
    r, g, b, al = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    hair = (
        (al > 200) & (r >= 45) & (r <= 105) & (g >= 22) & (g <= 65)
        & (b >= 10) & (b <= 55) & (r > g) & (g > b)
    )
    hair = ndi.binary_opening(hair, iterations=2)
    lab, n = ndi.label(hair)
    if n == 0:
        return None
    sizes = ndi.sum(hair, lab, range(1, n + 1))
    _, xs = np.where(lab == 1 + int(np.argmax(sizes)))
    return xs.max() - xs.min() + 1


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('character')
    parser.add_argument('--out', help='output directory (default: the character folder)')
    args = parser.parse_args()

    char_dir = os.path.join(ROOT, 'assets', 'characters', args.character)
    with open(os.path.join(char_dir, 'raw', 'layout.json')) as f:
        layout = json.load(f)
    out = args.out or char_dir
    os.makedirs(out, exist_ok=True)

    im = Image.open(os.path.join(char_dir, 'raw', 'sheet.png')).convert('RGB')
    if layout.get('eraseRects'):
        background = im.getpixel((0, 0))
        for rect in layout['eraseRects']:
            im.paste(background, tuple(rect))
    rgb = np.array(im)
    mask = matte_mask(im) if layout['method'] == 'matte' else flood_mask(im)
    lab, ordered = figures(mask, layout, im.height)
    head_x = layout.get('headX') or [None] * len(ordered)

    cuts = []
    for (label, _), pose, hx in zip(ordered, layout['poses'], head_x):
        if pose is None:
            continue
        soft = ndi.gaussian_filter((lab == label).astype(float), 0.8)
        alpha = np.clip((soft - 0.35) / 0.4, 0, 1) * 255  # 1px feathered edge
        rgba = np.dstack([rgb, alpha.astype(np.uint8)])
        ys, xs = np.where(alpha > 8)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = Image.fromarray(rgba, 'RGBA').crop((x0, y0, x1, y1))
        cuts.append([pose, crop, x0, x1, hx if hx is not None else (x0 + x1) / 2])

    # cleanRoi is in un-scaled shared-canvas coordinates; translate into each crop.
    half0 = max(max(hx - x0, x1 - hx) for _, _, x0, x1, hx in cuts)
    canvas_h0 = max(c.height for _, c, *_ in cuts)
    canvas_w0 = int(2 * half0) + 8
    for cut in cuts:
        pose, crop, x0, _, hx = cut
        roi = layout.get('cleanRoi', {}).get(pose)
        if roi:
            ox, oy = int(canvas_w0 / 2 - (hx - x0)), canvas_h0 - crop.height
            rx0, ry0, rx1, ry1 = roi
            local = (max(0, rx0 - ox), max(0, ry0 - oy), min(crop.width, rx1 - ox), min(crop.height, ry1 - oy))
            cut[1] = keep_largest(clean(crop, local))

    widths = [hair_width(c) for _, c, *_ in cuts]
    target = float(np.median([w for w in widths if w]))
    scaled = []
    for (pose, crop, x0, x1, hx), w in zip(cuts, widths):
        k = min(max(target / w, 0.8), 1.3) if w else 1.0
        k = layout.get('scaleOverride', {}).get(pose, k)
        crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.LANCZOS)
        scaled.append((pose, crop, (hx - x0) * k, (x1 - hx) * k))
        print(f'{pose}: head {w}px, scale x{k:.2f}')

    half = max(max(left, right) for _, _, left, right in scaled)
    canvas_h = max(c.height for _, c, *_ in scaled)
    canvas_w = int(2 * half) + 8
    for pose, crop, left, _ in scaled:
        canvas = Image.new('RGBA', (canvas_w, canvas_h), (0, 0, 0, 0))
        canvas.alpha_composite(crop, (int(canvas_w / 2 - left), canvas_h - crop.height))
        canvas.save(os.path.join(out, pose + '.png'), optimize=True)
    print(f'wrote {len(scaled)} sprites ({canvas_w}x{canvas_h}) to {out}')


if __name__ == '__main__':
    main()
