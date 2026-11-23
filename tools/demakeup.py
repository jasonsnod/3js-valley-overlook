"""
Remove eyeshadow and lipstick from the Angelica head diffuse texture.

usage: python demakeup.py <in Head_diffuse.jpeg> <out file> <preview dir>

The texture is stored upside down (brows below eyes). All coordinates are
pixels in the 2048x2048 texture.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, dst, preview_dir = sys.argv[1], sys.argv[2], sys.argv[3]
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255.0
H, W, _ = img.shape
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def ellipse(cx, cy, rx, ry, feather=0.25):
    """1 inside, soft falloff over the outer `feather` fraction of the radius."""
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    return 1 - smoothstep(1 - feather, 1.0, d)


def blur3(a, sigma):
    return np.stack([ndi.gaussian_filter(a[..., c], sigma) for c in range(3)], -1)


def fill_from_surroundings(a, exclude, sigma):
    """Normalized convolution: estimate the underlying skin colour inside
    `exclude` from nearby pixels outside it. Second pass drops pixels that are
    much darker than the estimate (brows, lashes) so they don't bleed in."""
    def multiscale(w):
        # Coarse-to-fine: large blurs reach the middle of big holes, small
        # blurs take over wherever there is enough nearby data.
        est = None
        for s in (sigma * 8, sigma * 4, sigma * 2, sigma):
            den = ndi.gaussian_filter(w, s)
            e = blur3(a * w[..., None], s) / np.maximum(den, 1e-6)[..., None]
            if est is None:
                est = e
            else:
                conf = smoothstep(0.03, 0.25, den)[..., None]
                est = est * (1 - conf) + e * conf
        return est

    w = 1 - exclude
    est = multiscale(w)
    w2 = w * (1 - smoothstep(0.012, 0.05, lum(est) - lum(a)))
    return multiscale(w2)


out = img.copy()
L = lum(img)
highpass = L - ndi.gaussian_filter(L, 2.5)  # pore-scale detail

# ---------------------------------------------------------------- eyes
EYES = [(777, 1290), (1277, 1290)]
RX, RY = 205, 128
LASH_Y = 1284           # top edge of the dark band = upper lash line
LIDEDGE = (1258, 1284)  # lower lid shimmer edge + pink lid margin: keep as-is
BROW_Y = 1376           # brows start just past here: never touch
DETAIL_SHIFT = -185     # borrow pore detail from the cheek above the eye

eye_region = np.zeros((H, W), np.float32)
eye_exclude = np.zeros((H, W), np.float32)
for cx, cy in EYES:
    eye_region = np.maximum(eye_region, ellipse(cx, cy, RX, RY, feather=0.35))
    eye_exclude = np.maximum(eye_exclude, ellipse(cx, cy, RX + 30, RY + 25, feather=0.05))

# Keep brows out of both the edit and the skin-colour estimate.
brow_guard = 1 - smoothstep(BROW_Y - 8, BROW_Y + 4, yy)
eye_region *= brow_guard
eye_exclude = np.maximum(eye_exclude, 1 - brow_guard) * (yy < BROW_Y + 60)

skin = fill_from_surroundings(img, eye_exclude, sigma=30)

def sat(a):
    return a.max(-1) - a.min(-1)

# How much each pixel looks like makeup: darker than skin, or greyer than skin.
darker = smoothstep(0.01, 0.06, lum(skin) - L)
greyer = smoothstep(0.02, 0.08, sat(skin) - sat(img))

upper_lid = smoothstep(LASH_Y - 2, LASH_Y + 1, yy)           # lash line toward brow
lower_keep = (yy >= 1232) & (yy < LASH_Y - 1)                # lower lid shimmer + pink margin
lower_keep_soft = ndi.gaussian_filter(lower_keep.astype(np.float32), 1.5)

# Upper lid: the whole eyeshadow zone is replaced outright.
lid_zone = np.zeros((H, W), np.float32)
for cx, cy in EYES:
    lid_zone = np.maximum(lid_zone, ellipse(cx, 1308, 150, 64, feather=0.45))
lid_zone *= upper_lid * brow_guard

# Elsewhere: only pixels darker/greyer than skin (the smoky smudge).
smudge = np.maximum(darker, greyer * 0.6) * eye_region
# In the kept band only near-black pixels count (shadow wrapping the corners).
smudge = smudge * (1 - lower_keep_soft) + lower_keep_soft * eye_region * (1 - smoothstep(0.30, 0.42, L))

eye_mask = np.maximum(lid_zone, smudge)
eye_mask = ndi.gaussian_filter(eye_mask, 1.5)
eye_mask = np.clip(eye_mask, 0, 1)

# Natural upper-lid shading: slightly darker and a touch rosier at the lash line.
below_lash = yy - LASH_Y
lash_shade = 1 - 0.12 * np.exp(-np.clip(below_lash, 0, None) / 9.0) * smoothstep(-3, 1, below_lash)
# Corners of the lid margin: shaded, not plain skin, so they don't read as notches.
corner_shade = 1 - 0.18 * lower_keep_soft
target = skin * (lash_shade * corner_shade)[..., None]

# Real skin variation borrowed from the cheek rows above the eye: pores plus
# mid-scale mottling, in colour.
cheek = np.roll(img, -DETAIL_SHIFT, axis=0)
detail = np.clip(cheek - blur3(cheek, 6), -0.035, 0.035)  # cap so no structure edges copy over
target = np.clip(target + detail * 1.1, 0, 1)

out = out * (1 - eye_mask[..., None]) + target * eye_mask[..., None]

# ---------------------------------------------------------------- lips
LCX, LCY, LRX, LRY = 1025, 855, 190, 72
lip_region = ellipse(LCX, LCY, LRX, LRY)
lip_skin = fill_from_surroundings(img, ellipse(LCX, LCY, LRX + 30, LRY + 25, feather=0.05), sigma=30)

def redness(a):
    return a[..., 0] - 0.5 * (a[..., 1] + a[..., 2])

lip_mask = lip_region * smoothstep(0.01, 0.06, redness(img) - redness(lip_skin))
lip_mask = np.clip(ndi.gaussian_filter(lip_mask, 1.5), 0, 1)

# Flatten the painted gloss: compress local brightness contrast and kill sparkles.
Lo = lum(out)
Lb = ndi.gaussian_filter(Lo, 6)
sparkle = np.clip(Lo - ndi.median_filter(Lo, size=9), 0, None)
L_new = Lb + (Lo - Lb) * 0.55 - sparkle * 1.0

# Natural lip colour: tone down the lipstick and pull toward a warm dusky
# rose derived from the surrounding skin.
lip = out.copy()
grey = Lo[..., None]
lip = grey + (lip - grey) * 0.75
rose = lip_skin * np.array([0.96, 0.78, 0.72], np.float32)
lip = lip * 0.5 + rose * 0.5
lip = lip * (L_new / np.maximum(lum(lip), 1e-4))[..., None] * 0.97
lip = np.clip(lip, 0, 1)

out = out * (1 - lip_mask[..., None]) + lip * lip_mask[..., None]

# ---------------------------------------------------------------- save
out8 = (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)
Image.fromarray(out8).save(dst, quality=95, subsampling=0)

orig8 = (img * 255 + 0.5).astype(np.uint8)
def compare(name, box):
    x0, y0, x1, y1 = box
    a = orig8[y0:y1, x0:x1]
    b = out8[y0:y1, x0:x1]
    gap = np.full((8, x1 - x0, 3), 255, np.uint8)
    # flip vertically so the preview reads right side up
    Image.fromarray(np.concatenate([a, gap, b], 0)[::-1]).save(f'{preview_dir}/compare_{name}.png')

compare('eyes', (560, 1120, 1490, 1460))
compare('lips', (800, 700, 1250, 950))
Image.fromarray((np.maximum(eye_mask, lip_mask)[::-1] * 255).astype(np.uint8)).resize((1024, 1024)).save(f'{preview_dir}/mask.png')
print('done')
