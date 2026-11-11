# Pleos Connect 디자인 시스템 (공식 .fig 기반)

공식 Figma 파일 2종을 단일 출처로 사용한다. 앱 UI의 색·치수·타이포·컴포넌트는 **여기서 추출한 값만** 쓰고 임의 값을 만들지 않는다.

**먼저 읽을 것: [`DESIGN.md`](DESIGN.md)** — 두 파일의 Foundation·Components·Form factors를 글로 옮긴 디자인 명세(색·타이포·레이아웃·그림자·모양·컴포넌트별 구조와 상태 색·Do/Don't). Variant별 전체 레이어 스펙과 폼팩터 4종의 사이즈 토큰은 [`DESIGN-reference.md`](DESIGN-reference.md). 화면은 이 명세대로 만든다(M58, 2026-11-12).

| 원본 | 내용 |
|---|---|
| `source/Pleos_Connect_design_assets_215.fig` | Foundation(Typography·Iconography·Colors·App Cover), Components(버튼·체크박스·드롭다운·필드·키패드·슬라이더·스위치·팝업·토스트·탭·타이틀 등 37세트) |
| `source/Pleos_Connect_display_guide_215.fig` | Form factors & Display(Connect-S/L/W/WF 화면 구성, Driving view·Status bar·GNB·Window 레이아웃), 아이콘·텔테일·차량 이미지 |

## 산출물

| 경로 | 설명 |
|---|---|
| `tokens/variables.json` | Figma 변수 전체(alias 해석 완료). 컬러 Light/Dark, 폼팩터별 치수(connect-s/l/w/waterfall), 타이포, 브랜드 테마(Hyundai/Kia/Genesis) |
| `tokens/styles_*.json` | 텍스트 스타일(Asta Sans 계층), 그림자(Level1~3) |
| `tokens/components_*.json` | 컴포넌트 세트와 variant 속성 목록 |
| `android-res/` | **앱에 그대로 복사할 Android 리소스** — `values/pleos_colors.xml`, `values-night/pleos_colors.xml`, `values/pleos_dimens.xml`(connect-s), `values/pleos_type.xml` |
| `fonts/asta_sans.ttf` | Pleos 시스템 폰트 Asta Sans (가변 폰트, OFL) → `res/font/asta_sans.ttf`로 복사 |

## 앱에서 쓰는 법

1. `android-res/*` → `app/src/main/res/`, `fonts/asta_sans.ttf` → `app/src/main/res/font/asta_sans.ttf`
2. 색: `@color/pleos_text_text_primary`, `@color/pleos_background_primary` 등 (다크모드는 values-night가 자동 적용)
3. 치수: `@dimen/pleos_window_apps_landscape_width`(1700dp), `@dimen/pleos_popup_toast_max_width`(792dp), `@dimen/pleos_buttons_basic_medium_*` 등
4. 텍스트: `TextAppearance.Pleos.Title.Large.Strong`, `TextAppearance.Pleos.Body.Medium.Strong` 등
5. 컴포넌트를 구현할 때 `tokens/components_assets.json`에서 variant(Type/Size/State)를 확인하고, 해당 컴포넌트의 `pleos_<component>_*` dimen과 `pleos_button_*`/`pleos_switch_*` 색을 사용

주요 토큰 접두어: `basic/*`(그레이 스케일), `text/*`, `icon/*`, `background/*`, `button/*`, `switch/*`, `controller/*`, `field/*`, `informative/*`(positive/negative/active), `regulation/*`(red/orange/yellow/green/blue), `dim/*`, `alpha/*`.

## 다시 생성

```sh
python3 -m venv tools/.venv && tools/.venv/bin/pip install zstandard
unzip -oq source/Pleos_Connect_design_assets_215.fig -d extracted/assets
unzip -oq source/Pleos_Connect_display_guide_215.fig -d extracted/display
tools/.venv/bin/python tools/fig_decode.py extracted/assets/canvas.fig extracted/assets.json
tools/.venv/bin/python tools/fig_decode.py extracted/display/canvas.fig extracted/display.json
tools/.venv/bin/python tools/fig_tokens.py tokens extracted/assets.json extracted/display.json
tools/.venv/bin/python tools/fig_android.py tokens android-res connect-s
tools/.venv/bin/python tools/fig_tree.py extracted/assets.json 3   # 노드 트리 탐색
```

`fig_android.py`의 세 번째 인자로 `connect-l`/`connect-w`/`connect-waterfall`을 주면 다른 폼팩터 치수를 생성한다.

## 한계

- `.fig` 바이너리에서 구조·값은 정확히 뽑지만 **화면 렌더링(시각 미리보기)은 불가**. 레이아웃을 눈으로 대조하려면 두 파일을 Figma에 가져와(드래그&드롭) Figma MCP로 스크린샷·디자인 컨텍스트를 받는다.
- 아이콘은 벡터 노드로만 존재 → 필요한 아이콘은 Figma에서 SVG로 내보내 VectorDrawable로 변환.
- 일부 폼팩터 변수에 모드 이름이 해석되지 않는 항목(`32257:0` 등)이 있음 — connect-s 값은 정상.
