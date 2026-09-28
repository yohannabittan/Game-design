#!/usr/bin/env python3
"""Generate placeholder PNG icons for a game folder without any image library.
Usage: tools/make-icons.py games/<slug> [hex-color] [letter]
Writes icons/icon-180.png, icon-192.png, icon-512.png (flat color, rounded, one letter).
Swap these for real art whenever a game earns it."""
import sys, os, struct, zlib

def png(w, h, pixels):
    raw = b''.join(b'\x00' + bytes(pixels[y]) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')

# 5x7 bitmap font for a single capital letter (enough for a placeholder icon)
FONT = {
 'A':["01110","10001","10001","11111","10001","10001","10001"],'B':["11110","10001","11110","10001","10001","10001","11110"],
 'C':["01111","10000","10000","10000","10000","10000","01111"],'D':["11110","10001","10001","10001","10001","10001","11110"],
 'E':["11111","10000","11110","10000","10000","10000","11111"],'F':["11111","10000","11110","10000","10000","10000","10000"],
 'G':["01111","10000","10000","10111","10001","10001","01111"],'H':["10001","10001","11111","10001","10001","10001","10001"],
 'I':["11111","00100","00100","00100","00100","00100","11111"],'J':["00111","00010","00010","00010","10010","10010","01100"],
 'K':["10001","10010","11100","10010","10001","10001","10001"],'L':["10000","10000","10000","10000","10000","10000","11111"],
 'M':["10001","11011","10101","10001","10001","10001","10001"],'N':["10001","11001","10101","10011","10001","10001","10001"],
 'O':["01110","10001","10001","10001","10001","10001","01110"],'P':["11110","10001","11110","10000","10000","10000","10000"],
 'Q':["01110","10001","10001","10001","10101","10010","01101"],'R':["11110","10001","11110","10010","10001","10001","10001"],
 'S':["01111","10000","01110","00001","00001","00001","11110"],'T':["11111","00100","00100","00100","00100","00100","00100"],
 'U':["10001","10001","10001","10001","10001","10001","01110"],'V':["10001","10001","10001","10001","01010","01010","00100"],
 'W':["10001","10001","10001","10101","10101","11011","10001"],'X':["10001","01010","00100","00100","01010","10001","10001"],
 'Y':["10001","01010","00100","00100","00100","00100","00100"],'Z':["11111","00001","00010","00100","01000","10000","11111"],
}

def icon(size, rgb, letter):
    r = size * 0.22
    glyph = FONT.get(letter.upper(), FONT['G'])
    cell = size * 0.55 / 7
    gx = (size - 5 * cell) / 2; gy = (size - 7 * cell) / 2
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            # rounded-square mask
            dx = max(r - x, 0, x - (size - 1 - r)); dy = max(r - y, 0, y - (size - 1 - r))
            inside = dx * dx + dy * dy <= r * r
            if not inside: row += [0, 0, 0, 0]; continue
            cx = int((x - gx) // cell); cy = int((y - gy) // cell)
            on = 0 <= cx < 5 and 0 <= cy < 7 and glyph[cy][cx] == '1'
            row += [255, 255, 255, 255] if on else [*rgb, 255]
        rows.append(row)
    return png(size, size, rows)

if __name__ == '__main__':
    folder = sys.argv[1]
    color = sys.argv[2] if len(sys.argv) > 2 else '3b82f6'
    letter = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(folder.rstrip('/'))[:1] or 'G'
    rgb = tuple(int(color.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))
    os.makedirs(os.path.join(folder, 'icons'), exist_ok=True)
    for s in (180, 192, 512):
        with open(os.path.join(folder, 'icons', f'icon-{s}.png'), 'wb') as f: f.write(icon(s, rgb, letter))
    print(f'wrote icons to {folder}/icons')
