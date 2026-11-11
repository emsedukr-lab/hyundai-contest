#!/usr/bin/env python3
"""앱 아이콘·시작 화면 그림을 차량 앱과 같은 표식(접힌 지도 + 핀)으로 다시 만든다.

표식의 원본은 car/app/src/main/res/drawable/ic_launcher_foreground.xml 이고, 여기서는 같은 경로를 SVG로 옮겨
PNG로 그린다. Android 8 이상은 벡터(drawable-v24/ic_launcher_foreground.xml)를 쓰므로 PNG는 Android 7과 iOS,
시작 화면용이다. 필요 도구: rsvg-convert(librsvg), Pillow.

    python3 packages/mobile/scripts/make-icons.py
"""
import io
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'
IOS = ROOT / 'ios/App/App/Assets.xcassets'
CANVAS = (0xF7, 0xF8, 0xFA)  # ic_launcher_background (Pleos canvas grey)
MARK = (
    '<path fill="#2F3B57" d="M8,10L18,6L30,10L40,6L40,38L30,42L18,38L8,42Z"/>'
    '<path fill="#FFFFFF" d="M24,14a7,7 0,0 0,-7 7c0,5.2 7,12 7,12s7,-6.8 7,-12a7,7 0,0 0,-7,-7zM24,24a3,3 0,1 1,0,-6a3,3 0,0 1,0,6z"/>'
)


def mark(px: int) -> Image.Image:
    """The mark alone on a transparent 48-unit square, `px` pixels wide."""
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">{MARK}</svg>'
    png = subprocess.run(['rsvg-convert', '-w', str(px), '-h', str(px)], input=svg.encode(), capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(png)).convert('RGBA')


def centered(size: tuple[int, int], mark_px: int, background=None) -> Image.Image:
    img = Image.new('RGBA', size, (*background, 255) if background else (0, 0, 0, 0))
    m = mark(mark_px)
    img.alpha_composite(m, ((size[0] - mark_px) // 2, (size[1] - mark_px) // 2))
    return img


def masked(px: int, round_: bool) -> Image.Image:
    """Android 7 icon: the mark on the canvas colour inside a circle or rounded square."""
    scale = 4
    mask = Image.new('L', (px * scale, px * scale), 0)
    d = ImageDraw.Draw(mask)
    if round_:
        d.ellipse((0, 0, px * scale - 1, px * scale - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, px * scale - 1, px * scale - 1), radius=px * scale * 0.2, fill=255)
    img = centered((px, px), round(px * 0.62), CANVAS)
    img.putalpha(mask.resize((px, px), Image.LANCZOS))
    return img


def main():
    # Android launcher: legacy PNGs (Android 7) and the adaptive foreground at the template's sizes.
    for density, dp in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        d = RES / f'mipmap-{density}'
        masked(round(48 * dp), False).save(d / 'ic_launcher.png')
        masked(round(48 * dp), True).save(d / 'ic_launcher_round.png')
        centered((round(108 * dp),) * 2, round(60 * dp)).save(d / 'ic_launcher_foreground.png')  # mark inside the 66dp safe zone
    # Android launch image (Android 11 and below; Android 12+ shows the app icon by itself).
    for f in sorted(RES.glob('drawable*/splash.png')):
        size = Image.open(f).size
        centered(size, round(min(size) * 0.28), CANVAS).convert('RGB').save(f)
    # iOS: one 1024px icon without transparency, one square launch image (shown aspect-fill, so the mark stays small and centred).
    centered((1024, 1024), 620, CANVAS).convert('RGB').save(IOS / 'AppIcon.appiconset/AppIcon-512@2x.png')
    for f in sorted((IOS / 'Splash.imageset').glob('splash-*.png')):
        centered((2732, 2732), 300, CANVAS).convert('RGB').save(f, optimize=True)


if __name__ == '__main__':
    main()
