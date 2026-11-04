"""WCAG contrast check of the Pleos color pairs the car app actually uses (light and night).
Usage: python3 tools/contrast.py   (Pleos guide: icons/text/images need 4.5:1 or more)"""
import re
import sys
from pathlib import Path

RES = Path(__file__).resolve().parent.parent / "design/android-res"


def load(night: bool):
    f = RES / ("values-night" if night else "values") / "pleos_colors.xml"
    return dict(re.findall(r'<color name="([^"]+)">(#[0-9A-Fa-f]{6,8})</color>', f.read_text()))


def rgba(h):
    h = h.lstrip("#")
    a, rgb = (int(h[:2], 16) / 255, h[2:]) if len(h) == 8 else (1.0, h)
    return [int(rgb[i:i + 2], 16) / 255 for i in (0, 2, 4)], a


def over(fg, bg):
    (f, a), (b, _) = rgba(fg), rgba(bg)
    return [a * fc + (1 - a) * bc for fc, bc in zip(f, b)]


def lum(c):
    lin = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(fg, bg, base=None):
    bg_c = over(bg, base) if base else rgba(bg)[0]
    bg_hex = "#" + "".join(f"{round(v * 255):02X}" for v in bg_c)
    l1, l2 = sorted([lum(over(fg, bg_hex)), lum(bg_c)], reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


# (where, foreground, background, base under a translucent background, minimum)
PAIRS = [
    ("본문 / 화면 배경", "pleos_text_dark_primary", "pleos_background_primary", None, 4.5),
    ("본문 / 카드", "pleos_text_dark_primary", "pleos_surface_basic", None, 4.5),
    ("보조 문구 / 화면 배경", "pleos_text_dark_secondary", "pleos_background_primary", None, 4.5),
    ("보조 문구 / 카드", "pleos_text_dark_secondary", "pleos_surface_basic", None, 4.5),
    ("주 버튼 글자 / 주 버튼", "pleos_text_light_primary", "pleos_button_filled_enabled", None, 4.5),
    ("주 버튼 글자 / 눌린 주 버튼", "pleos_text_light_primary", "pleos_button_filled_pressed", None, 4.5),
    ("보조 버튼 글자 / 보조 버튼", "pleos_text_dark_primary", "pleos_button_basic_enabled", "pleos_background_primary", 4.5),
    ("팝업 제목 / 팝업", "pleos_text_dark_primary", "pleos_background_popup", None, 4.5),
    ("팝업 설명 / 팝업", "pleos_text_dark_secondary", "pleos_background_popup", None, 4.5),
    ("QR 검정 / QR 흰 바탕", "pleos_static_dark_100", "pleos_static_light_100", None, 4.5),
]

# Status bars next to a text label ("충돌 · …", "확인 필요 · …"): a cue only, so reported, not gated.
CUES = [
    ("충돌 표시 막대", "pleos_informative_negative", "pleos_surface_basic"),
    ("주의 표시 막대", "pleos_regulation_orange", "pleos_surface_basic"),
    ("정상 표시 막대", "pleos_informative_active", "pleos_surface_basic"),
]


def main():
    failed = 0
    for night in (False, True):
        c = load(night)
        print(f"\n[{'야간' if night else '주간'}]")
        for name, fg, bg, base, need in PAIRS:
            r = ratio(c[fg], c[bg], c[base] if base else None)
            ok = r >= need
            failed += not ok
            print(f"  {'OK ' if ok else 'LOW'} {r:5.2f}:1 (기준 {need}) {name}")
        for name, fg, bg in CUES:
            print(f"  참고 {ratio(c[fg], c[bg]):5.2f}:1 {name} (의미는 옆 문구로 전달)")
    print(f"\n{'모두 기준 충족' if not failed else f'기준 미달 {failed}건'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
