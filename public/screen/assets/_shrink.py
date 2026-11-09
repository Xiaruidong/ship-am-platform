import os, glob
from PIL import Image

SRC = os.path.dirname(os.path.abspath(__file__))
OUT = 760
files = sorted(glob.glob(os.path.join(SRC, "*.png")))
report = []
for f in files:
    name = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f).convert("RGB")
    w, h = im.size
    # 裁掉底部 60px（平台水印区），再居中裁成 16:9
    bottom = h - 60
    neww = int(bottom * 16 / 9)
    if neww <= w:
        left = (w - neww) // 2
        im = im.crop((left, 0, left + neww, bottom))
    else:
        im = im.crop((0, 0, w, bottom))
    im = im.resize((OUT, int(OUT * 9 / 16)), Image.LANCZOS)
    dst = os.path.join(SRC, name + ".webp")
    im.save(dst, "WEBP", quality=82, method=6)
    report.append((name, os.path.getsize(dst) // 1024))

for n, s in report:
    print(f"{n:16s} {s:5d} KB")
print("total KB:", sum(s for _, s in report))
