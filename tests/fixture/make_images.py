"""Writes the PNGs that BuildComplexDoc.js puts in the complex test doc, as one JSON map {name: base64}.

No image libraries: plain zlib PNGs in varied sizes and shapes (BuildComplexDoc converts some to JPEG and GIF).
Usage: python3 -I make_images.py > images.json
"""
import base64, json, math, struct, sys, zlib


def png(w, h, pixel, alpha=False):
    chans = 4 if alpha else 3
    rows = []
    for y in range(h):
        row = bytearray(b"\x00")
        for x in range(w):
            row += bytes(pixel(x, y)[:chans])
        rows.append(bytes(row))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6 if alpha else 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")


def sunset(x, y, w=1600, h=900):  # landscape gradient with a sun and a horizon
    t = y / h
    r, g, b = int(250 - 120 * t), int(150 - 100 * t), int(80 + 100 * t)
    if (x - w * 0.7) ** 2 + (y - h * 0.55) ** 2 < (h * 0.12) ** 2:
        r, g, b = 255, 220, 120
    if y > h * 0.62:
        r, g, b = 20, 40 + int(40 * math.sin(x / 40)) % 40, 90
    return r, g, b


def checker(x, y, n=40):
    return (230, 230, 230) if (x // n + y // n) % 2 else (40, 70, 120)


def stripes(x, y):
    return [(200, 30, 50), (240, 240, 240), (20, 60, 160)][(y // 60) % 3]


def icon(x, y):
    d = (x - 24) ** 2 + (y - 24) ** 2
    return (255, 200, 0) if d < 400 else (255, 255, 255)


def banner(x, y):
    return (int(40 + 200 * x / 2000), 90, int(200 - 150 * x / 2000))


def disc(x, y):  # transparent outside a ring
    d = math.hypot(x - 150, y - 150)
    return (30, 140, 90, 255 if 90 < d < 140 else 0)


def portrait(hue):
    def f(x, y):
        head = (x - 100) ** 2 + (y - 95) ** 2 < 55 ** 2
        body = y > 160 and abs(x - 100) < 70 - (260 - y) // 4
        base = [(hue * 37 + 60) % 256, (hue * 91 + 120) % 256, (hue * 53 + 180) % 256]
        if head:
            return 235, 200, 170
        if body:
            return tuple(c // 2 for c in base)
        return tuple(base)
    return f


images = {
    "sunset": png(1600, 900, sunset),
    "checker": png(400, 400, checker),
    "stripes_tall": png(240, 960, stripes),
    "icon": png(48, 48, icon),
    "banner": png(2000, 300, banner),
    "disc_alpha": png(300, 300, disc, alpha=True),
}
for i in range(12):
    images[f"portrait{i}"] = png(200, 260, portrait(i))

json.dump({k: base64.b64encode(v).decode() for k, v in images.items()}, sys.stdout)
