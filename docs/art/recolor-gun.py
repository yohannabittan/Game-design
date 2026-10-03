"""Palette repaint of a standard Recoil gun picture (used for gun-make-my-day-frost).

Usage: python3 docs/art/recolor-gun.py docs/art/final/recoil/gun-make-my-day.png out.png
Reads the standard picture, keeps its alpha channel byte for byte (so the silhouette is exact), and recolours
by role: near-black outlines stay; the teal underline and the stripe above it become the accent rib; the pink top rim becomes a pale
highlight; the red grip becomes dark steel; the orange muzzle tip stays; the dark body is remapped by
luminance from dark steel through steel to a pale highlight. Needs Pillow and numpy.
"""
import sys, colorsys
import numpy as np
from PIL import Image

STEEL, DARK, ACCENT, PALE = "#dbe7f7", "#8ea6c8", "#3f6396", "#f4f9ff"   # the game's frost palette (steel / dark steel / accent)
RIB = (156, 172, 255)   # rows and first column of the barrel's lower stripes in gun-make-my-day.png; both stripes become the accent rib

def hx(h):
    h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float) / 255

def recolor(src, dst):
    im = Image.open(src).convert("RGBA"); a = np.asarray(im).astype(float); rgb = a[:, :, :3] / 255; al = a[:, :, 3]
    H, W = al.shape; mx = rgb.max(2); mn = rgb.min(2); L = (mx + mn) / 2
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue = np.zeros_like(L)
    for y in range(H):                                   # hue per pixel; 512 x 437 is small enough for a plain loop
        for x in range(W):
            if al[y, x] > 0: hue[y, x] = colorsys.rgb_to_hsv(*rgb[y, x])[0] * 360
    ys, xs = np.where(al > 40); x0, x1 = xs.min(), xs.max()
    outline = L < 0.085
    teal = (hue > 150) & (hue < 215) & (sat > 0.45) & (L > 0.28)
    pink = (hue > 270) & (hue < 355) & (sat > 0.35) & (L > 0.25)
    red = ((hue < 35) | (hue >= 340)) & (sat > 0.45) & (L > 0.08)
    tip = red & (hue > 8) & (hue < 45) & (L > 0.42) & (np.arange(W)[None, :] > x0 + 0.9 * (x1 - x0))
    s, d, ac, pale = hx(STEEL), hx(DARK), hx(ACCENT), hx(PALE)
    t1 = np.clip((L - 0.06) / (0.28 - 0.06), 0, 1)[..., None]; t2 = np.clip((L - 0.45) / (0.90 - 0.45), 0, 1)[..., None]
    body = d * (1 - t1) + s * t1; body = body * (1 - t2) + pale * t2
    teal_c = ac * (0.75 + 0.5 * np.clip(L, 0, 1)[..., None]); grip = d * (0.8 + 0.5 * np.clip(L, 0, 1)[..., None])
    out = body.copy()
    out = np.where(pink[..., None], pale * (0.85 + 0.15 * L[..., None]), out)
    out = np.where(red[..., None], grip, out)
    out = np.where(teal[..., None], teal_c, out)
    rib = np.zeros_like(outline); rib[RIB[0]:RIB[1], RIB[2]:int(x1 - 8)] = True
    rib &= ~outline & (al > 0)
    out = np.where(rib[..., None], ac * (0.8 + 0.4 * np.clip(L, 0, 1)[..., None]), out)
    out = np.where(tip[..., None], rgb, out)
    out = np.where(outline[..., None], rgb, out)
    res = np.dstack([np.clip(out * 255, 0, 255), al]).astype(np.uint8)
    Image.fromarray(res).save(dst, optimize=True)

if __name__ == "__main__":
    recolor(sys.argv[1], sys.argv[2])
