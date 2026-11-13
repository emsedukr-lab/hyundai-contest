"""WCAG contrast check of the colour pairs the car app actually uses (design/TOSS.md roles, light and night).
Usage: python3 tools/contrast.py
Reads car/app/src/main/res/values{,-night}/tn_colors.xml. Text needs 4.5:1 (Pleos guide); the only large-text
exception is the white label on a filled button (accent or the red delete confirm), 3:1, because every car button
label is 26sp bold or larger (TOSS.md §6). State dots, switches and bars are graphics: reported, not gated."""
import re
import sys
from pathlib import Path

RES = Path(__file__).resolve().parent.parent / "car/app/src/main/res"


def load(night: bool):
    f = RES / ("values-night" if night else "values") / "tn_colors.xml"
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
TEXT = 4.5
LARGE = 3.0  # large text: 24sp+ or 19sp bold — car button labels are 26sp bold or larger
PAIRS = [
    ("본문 / 화면 바탕", "tn_text_primary", "tn_canvas", None, TEXT),
    ("본문 / 카드", "tn_text_primary", "tn_surface", None, TEXT),
    ("보조 문구 / 화면 바탕", "tn_text_secondary", "tn_canvas", None, TEXT),
    ("보조 문구 / 카드", "tn_text_secondary", "tn_surface", None, TEXT),
    ("팝업 제목 / 팝업", "tn_text_primary", "tn_surface_float", None, TEXT),
    ("팝업 설명 / 팝업", "tn_text_secondary", "tn_surface_float", None, TEXT),
    ("보조 버튼 글자 / 보조 버튼 (카드 위)", "tn_text_primary", "tn_fill_weak", None, TEXT),
    ("보조 버튼 글자 / 눌림 (카드 위)", "tn_text_primary", "tn_fill_weak_pressed", None, TEXT),
    ("보조 버튼 글자 / 보조 버튼 (바탕 위)", "tn_text_primary", "tn_fill_weak_on_canvas", None, TEXT),
    ("보조 버튼 글자 / 눌림 (바탕 위)", "tn_text_primary", "tn_fill_weak_on_canvas_pressed", None, TEXT),
    ("보조 버튼 글자 / 보조 버튼 (팝업 위)", "tn_text_primary", "tn_fill_weak_on_float", None, TEXT),
    ("보조 버튼 글자 / 눌림 (팝업 위)", "tn_text_primary", "tn_fill_weak_on_float_pressed", None, TEXT),
    ("세그먼트 나머지 칸 / 트랙 (바탕 위)", "tn_text_secondary", "tn_fill_weak_on_canvas", None, TEXT),
    ("중립 태그 / 카드 위 면", "tn_text_secondary", "tn_fill_weak", None, TEXT),
    ("중립 태그 / 바탕 위 면", "tn_text_secondary", "tn_fill_weak_on_canvas", None, TEXT),
    ("정보 태그", "tn_accent_text", "tn_accent_weak", None, TEXT),
    ("여유·완료 태그", "tn_positive", "tn_positive_weak", None, TEXT),
    ("늦음·충돌 태그", "tn_negative_text", "tn_negative_weak", None, TEXT),
    ("확인 필요 태그 (잉크 글자)", "tn_text_primary", "tn_warning_weak", None, TEXT),
    ("고정 시각 (파란 굵은 시각) / 정류지 카드", "tn_accent_text", "tn_surface", None, TEXT),
    ("동선 스케치 번호 / 흰 원", "tn_accent_text", "tn_surface", None, TEXT),
    ("타임라인 번호 / 번호 원 (바탕 위)", "tn_text_primary", "tn_fill_weak_on_canvas", None, TEXT),
    ("지난 곳 번호 / 번호 원 (바탕 위)", "tn_text_secondary", "tn_fill_weak_on_canvas", None, TEXT),
    ("확인 코드 / 코드 상자", "tn_text_primary", "tn_fill_weak", None, TEXT),
    ("QR 모듈 / QR 바탕", "tn_qr_module", "tn_qr_background", None, TEXT),
    ("주 버튼 글자 / 주 버튼 (큰 글자)", "tn_on_accent", "tn_accent", None, LARGE),
    ("주 버튼 글자 / 눌린 주 버튼 (큰 글자)", "tn_on_accent", "tn_accent_pressed", None, LARGE),
    ("삭제 확인 글자 / 빨간 버튼 (큰 글자)", "tn_on_accent", "tn_negative", None, LARGE),
    ("삭제 확인 글자 / 눌린 빨간 버튼 (큰 글자)", "tn_on_accent", "tn_press_overlay", "tn_negative", LARGE),
]

# Graphics next to words (the meaning is always in the text): reported against the 3:1 non-text guide, not gated.
CUES = [
    ("여유 점 / 카드", "tn_positive", "tn_surface"),
    ("정보 점 / 카드", "tn_accent", "tn_surface"),
    ("늦음 점 / 카드", "tn_negative", "tn_surface"),
    ("확인 필요 점 / 카드", "tn_warning", "tn_surface"),
    ("확인 필요 점 / 확인 필요 태그", "tn_warning", "tn_warning_weak"),
    ("꼭 핀 / 꼭 태그", "tn_negative", "tn_negative_weak"),
    ("스위치 켜짐 트랙 / 카드", "tn_accent", "tn_surface"),
    ("스위치 꺼짐 트랙 / 카드", "tn_switch_off", "tn_surface"),
    ("진행 막대 / 화면 바탕", "tn_accent", "tn_canvas"),
    ("남은 막대·레일 / 화면 바탕", "tn_hairline", "tn_canvas"),
    ("꺾쇠 / 카드", "tn_text_disabled", "tn_surface"),
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
            r = ratio(c[fg], c[bg])
            print(f"  참고 {r:5.2f}:1 {'(3:1 이상)' if r >= 3 else '(3:1 미만)'} {name} (의미는 옆 문구로 전달)")
    print(f"\n{'모두 기준 충족' if not failed else f'기준 미달 {failed}건'}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
