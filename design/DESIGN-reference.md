# Pleos Connect — DESIGN reference

> `DESIGN.md`의 동반 파일입니다. Figma 파일(`Pleos_Connect_design_assets_215.fig`, `Pleos Connect display guide 2.1.5`)에서 추출한 전체 값을 가공 없이 실었습니다.
> 치수는 Connect-S 17" 기준 dp, 색은 Light 모드 값(토큰명 + HEX)입니다.

- [1. 컴포넌트 — Variant별 전체 레이어 스펙](#1-컴포넌트--variant별-전체-레이어-스펙)
- [2. 컴포넌트 사이즈 토큰 — 폼팩터 4종](#2-컴포넌트-사이즈-토큰--폼팩터-4종)
- [3. 스케일 토큰 (글자 크기 · 줄 높이 · 반경 · 그림자)](#3-스케일-토큰-글자-크기--줄-높이--반경--그림자)
- [4. 플랫폼 레이아웃 토큰 (display guide)](#4-플랫폼-레이아웃-토큰-display-guide)

## 1. 컴포넌트 — Variant별 전체 레이어 스펙

각 컴포넌트 세트의 모든 Variant를 표로, 내부 레이어를 목록으로 실었습니다. `W×H · 레이아웃 · r 반경 · fill · stroke · effect` 순서이며 `⟵`는 인스턴스의 원본 컴포넌트입니다.

### Buttons

#### `ivi_basic_button`

- Variant 축: **Size** (Large / Medium / Small) · **State** (Enabled / Pressed / Disabled) · **Type** (Primary / Secondary)
- 속성: Label (bool, 기본 true), Prefix (bool, 기본 false), Text (text, 기본 "Label"), Suffix (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `buttons/basic/*`, `buttons/basic/large/*`, `buttons/basic/medium/*`, `buttons/basic/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Primary, Size=Large, State=Enabled | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/basic/enabled` #1314170D |  |  |
| Type=Primary, Size=Large, State=Pressed | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/basic/pressed` #1314171A |  |  |
| Type=Primary, Size=Large, State=Disabled | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/basic/disabled` #FFFFFF33 | `divider/secondary` #1314171A 2px inside |  |
| Type=Primary, Size=Medium, State=Enabled | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/basic/enabled` #1314170D |  |  |
| Type=Primary, Size=Medium, State=Pressed | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/basic/pressed` #1314171A |  |  |
| Type=Primary, Size=Medium, State=Disabled | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/basic/disabled` #FFFFFF33 | `divider/secondary` #1314171A 2px inside |  |
| Type=Primary, Size=Small, State=Enabled | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/basic/enabled` #1314170D |  |  |
| Type=Primary, Size=Small, State=Pressed | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/basic/pressed` #1314171A |  |  |
| Type=Primary, Size=Small, State=Disabled | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/basic/disabled` #FFFFFF33 | `divider/secondary` #1314171A 2px inside |  |
| Type=Secondary, Size=Large, State=Enabled | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/filled/enabled` #44464E |  |  |
| Type=Secondary, Size=Large, State=Pressed | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/filled/pressed` #313236 |  |  |
| Type=Secondary, Size=Large, State=Disabled | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/filled/disabled` #1314170D | `divider/secondary` #1314171A 2px inside |  |
| Type=Secondary, Size=Medium, State=Enabled | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/filled/enabled` #44464E |  |  |
| Type=Secondary, Size=Medium, State=Pressed | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/filled/pressed` #313236 |  |  |
| Type=Secondary, Size=Medium, State=Disabled | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/filled/disabled` #1314170D | `divider/secondary` #1314171A 2px inside |  |
| Type=Secondary, Size=Small, State=Enabled | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/filled/enabled` #44464E |  |  |
| Type=Secondary, Size=Small, State=Pressed | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/filled/pressed` #313236 |  |  |
| Type=Secondary, Size=Small, State=Disabled | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/filled/disabled` #1314170D | `divider/secondary` #1314171A 2px inside |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Primary, Size=Large, State=Enabled ‖ Type=Primary, Size=Large, State=Pressed_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
- _Type=Primary, Size=Large, State=Disabled ‖ Type=Secondary, Size=Large, State=Disabled_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/quaternary` #13141752
- _Type=Primary, Size=Medium, State=Enabled ‖ Type=Primary, Size=Medium, State=Pressed_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
- _Type=Primary, Size=Medium, State=Disabled ‖ Type=Secondary, Size=Medium, State=Disabled_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/quaternary` #13141752
- _Type=Primary, Size=Small, State=Enabled ‖ Type=Primary, Size=Small, State=Pressed_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `text/dark/primary` #131417
- _Type=Primary, Size=Small, State=Disabled ‖ Type=Secondary, Size=Small, State=Disabled_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `text/dark/quaternary` #13141752
- _Type=Secondary, Size=Large, State=Enabled ‖ Type=Secondary, Size=Large, State=Pressed_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/light/primary` #FFFFFF
- _Type=Secondary, Size=Medium, State=Enabled ‖ Type=Secondary, Size=Medium, State=Pressed_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/light/primary` #FFFFFF
- _Type=Secondary, Size=Small, State=Enabled ‖ Type=Secondary, Size=Small, State=Pressed_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `text/light/primary` #FFFFFF

#### `ivi_toggle_button`

- Variant 축: **On active** (false / true) · **Size** (Large / Medium / Small) · **State** (Enabled / Pressed / Disabled)
- 속성: Label (bool, 기본 true), Prefix (bool, 기본 false), Text (text, 기본 "Label"), Suffix (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `buttons/toggle/*`, `buttons/toggle/large/*`, `buttons/toggle/medium/*`, `buttons/toggle/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Large, State=Enabled, On active=false | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/basic/enabled` #1314170D |  |  |
| Size=Large, State=Pressed, On active=false | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/basic/pressed` #1314171A |  |  |
| Size=Large, State=Disabled, On active=false | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/basic/disabled` #FFFFFF33 | `divider/secondary` #1314171A 2px inside |  |
| Size=Medium, State=Enabled, On active=false | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/basic/enabled` #1314170D |  |  |
| Size=Medium, State=Pressed, On active=false | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/basic/pressed` #1314171A |  |  |
| Size=Medium, State=Disabled, On active=false | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/basic/disabled` #FFFFFF33 | `divider/secondary` #1314171A 2px inside |  |
| Size=Small, State=Enabled, On active=false | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/basic/enabled` #1314170D |  |  |
| Size=Small, State=Pressed, On active=false | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/basic/pressed` #1314171A |  |  |
| Size=Small, State=Disabled, On active=false | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/basic/disabled` #FFFFFF33 | `divider/secondary` #1314171A 2px inside |  |
| Size=Large, State=Enabled, On active=true | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/switch/enabled` #FFFFFF |  | Shadow/Light/Level2 |
| Size=Large, State=Pressed, On active=true | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/switch/pressed` #FFFFFF80 |  | Shadow/Light/Level2 |
| Size=Large, State=Disabled, On active=true | 160×100 | row, gap 16, pad 16/40, main center, cross center | 32 | `button/switch/disabled` #FFFFFF4D | `divider/secondary` #1314171A 2px inside |  |
| Size=Medium, State=Enabled, On active=true | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/switch/enabled` #FFFFFF |  | Shadow/Light/Level2 |
| Size=Medium, State=Pressed, On active=true | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/switch/pressed` #FFFFFF80 |  | Shadow/Light/Level2 |
| Size=Medium, State=Disabled, On active=true | 139×80 | row, gap 14, pad 16/32, main center, cross center | 24 | `button/switch/disabled` #FFFFFF4D | `divider/secondary` #1314171A 2px inside |  |
| Size=Small, State=Enabled, On active=true | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/switch/enabled` #FFFFFF |  | Shadow/Light/Level2 |
| Size=Small, State=Pressed, On active=true | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/switch/pressed` #FFFFFF80 |  | Shadow/Light/Level2 |
| Size=Small, State=Disabled, On active=true | 113×64 | row, gap 12, pad 8/24, main center, cross center | 16 | `button/basic/disabled` #FFFFFF33 | `divider/secondary` #1314171A 2px inside |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Large, State=Enabled, On active=false ‖ Size=Large, State=Pressed, On active=false_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Large, State=Disabled, On active=false ‖ Size=Large, State=Disabled, On active=true_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/quaternary` #13141752
- _Size=Medium, State=Enabled, On active=false ‖ Size=Medium, State=Pressed, On active=false_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
- _Size=Medium, State=Disabled, On active=false ‖ Size=Medium, State=Disabled, On active=true_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/quaternary` #13141752
- _Size=Small, State=Enabled, On active=false ‖ Size=Small, State=Pressed, On active=false_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Small, State=Disabled, On active=false ‖ Size=Small, State=Disabled, On active=true_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `text/dark/quaternary` #13141752
- _Size=Large, State=Enabled, On active=true ‖ Size=Large, State=Pressed, On active=true_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
- _Size=Medium, State=Enabled, On active=true ‖ Size=Medium, State=Pressed, On active=true_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
- _Size=Small, State=Enabled, On active=true ‖ Size=Small, State=Pressed, On active=true_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `text/dark/primary` #131417

#### `ivi_text_button`

- Variant 축: **Size** (Medium / Small) · **State** (Enabled / Pressed / Disabled)
- 속성: Prefix (bool, 기본 false), Suffix (bool, 기본 false), Label (text, 기본 "Label")
- 바인딩된 사이즈 토큰 그룹: `buttons/text/medium/*`, `buttons/text/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium, State=Enabled | 75×38 | row, gap 8, pad 0, main center, cross center |  |  |  |  |
| Size=Medium, State=Pressed | 75×38 | row, gap 8, pad 0, main center, cross center |  |  |  |  |
| Size=Medium, State=Disabled | 75×38 | row, gap 8, pad 0, main center, cross center |  |  |  |  |
| Size=Small, State=Enabled | 65×34 | row, gap 4, pad 0, main center, cross center |  |  |  |  |
| Size=Small, State=Pressed | 65×34 | row, gap 4, pad 0, main center, cross center |  |  |  |  |
| Size=Small, State=Disabled | 65×34 | row, gap 4, pad 0, main center, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium, State=Enabled ‖ Size=Medium, State=Pressed_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `informative/positive` #0064FF
- _Size=Medium, State=Disabled_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/quaternary` #13141752
- _Size=Small, State=Enabled ‖ Size=Small, State=Pressed_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `informative/positive` #0064FF
- _Size=Small, State=Disabled_
  - **Label** — 65×34 · "Label" `Body/Small/Strong` · `text/dark/quaternary` #13141752

#### `ivi_icon_button`

- Variant 축: **Size** (Medium / Small) · **State** (Enabled / Pressed / Diabled) · **Type** (Basic / Plain / Circle)
- 바인딩된 사이즈 토큰 그룹: `buttons/icon/*`, `buttons/icon/medium/*`, `buttons/icon/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Basic, State=Enabled, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 20 | `button/basic/enabled` #1314170D |  |  |
| Type=Basic, State=Pressed, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 20 | `button/basic/pressed` #1314171A |  |  |
| Type=Basic, State=Diabled, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 20 | `button/basic/disabled` #FFFFFF33 |  |  |
| Type=Basic, State=Enabled, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 16 | `button/basic/enabled` #1314170D |  |  |
| Type=Basic, State=Pressed, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 16 | `button/basic/pressed` #1314171A |  |  |
| Type=Basic, State=Diabled, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 16 | `button/basic/disabled` #FFFFFF33 |  |  |
| Type=Plain, State=Enabled, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 20 |  |  |  |
| Type=Plain, State=Pressed, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 20 | `button/basic/pressed` #1314171A |  |  |
| Type=Plain, State=Diabled, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 20 |  |  |  |
| Type=Plain, State=Enabled, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 16 |  |  |  |
| Type=Plain, State=Pressed, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 16 | `button/basic/pressed` #1314171A |  |  |
| Type=Plain, State=Diabled, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 16 |  |  |  |
| Type=Circle, State=Enabled, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 999 | `button/basic/enabled` #1314170D |  |  |
| Type=Circle, State=Pressed, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 999 | `button/basic/pressed` #1314171A |  |  |
| Type=Circle, State=Diabled, Size=Medium | 80×80 | row, gap 0, pad 0, main center, cross center | 999 | `button/basic/disabled` #FFFFFF33 |  |  |
| Type=Circle, State=Enabled, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 999 | `button/basic/enabled` #1314170D |  |  |
| Type=Circle, State=Pressed, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 999 | `button/basic/pressed` #1314171A |  |  |
| Type=Circle, State=Diabled, Size=Small | 64×64 | row, gap 0, pad 0, main center, cross center | 999 | `button/basic/disabled` #FFFFFF33 |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Basic, State=Enabled, Size=Medium ‖ Type=Basic, State=Pressed, Size=Medium ‖ Type=Basic, State=Enabled, Size=Small ‖ Type=Basic, State=Pressed, Size=Small ‖ 외 8개_
  - **ic_plus** — 56×56 · icon `icon/dark/primary` #131417
- _Type=Basic, State=Diabled, Size=Medium ‖ Type=Basic, State=Diabled, Size=Small ‖ Type=Plain, State=Diabled, Size=Medium ‖ Type=Plain, State=Diabled, Size=Small ‖ 외 2개_
  - **ic_plus** — 56×56 · icon `icon/dark/quaternary` #13141752

#### `ivi_numeric_keypad`

- Variant 축: **State** (Enabled / Pressed / Disabled) · **Type** (Number / Delete / Clear)
- 속성: Number (text, 기본 "1")
- 바인딩된 사이즈 토큰 그룹: `buttons/keypad/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Number, State=Enabled | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `keyboard/normal/primary_normal` #FFFFFF | `divider/secondary` #1314171A 4px inside |  |
| Type=Delete, State=Enabled | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `surface/accent` #E0E1E6 | `divider/secondary` #1314171A 4px inside |  |
| Type=Clear, State=Enabled | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `surface/accent` #E0E1E6 | `divider/secondary` #1314171A 4px inside |  |
| Type=Number, State=Pressed | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `keyboard/normal/primary_pressed` #EDEEF2 | `divider/secondary` #1314171A 4px inside |  |
| Type=Delete, State=Pressed | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `surface/accent` #E0E1E6 + `dim/dark/tertiary` #13141733 | `divider/secondary` #1314171A 4px inside |  |
| Type=Clear, State=Pressed | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `surface/accent` #E0E1E6 + `dim/dark/tertiary` #13141733 | `divider/secondary` #1314171A 4px inside |  |
| Type=Delete, State=Disabled | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `surface/accent` #E0E1E6 | `divider/secondary` #1314171A 4px inside |  |
| Type=Clear, State=Disabled | 200×108 | row, gap 0, pad 0, main center, cross center | 32 | `surface/accent` #E0E1E6 | `divider/secondary` #1314171A 4px inside |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Number, State=Enabled ‖ Type=Number, State=Pressed_
  - **1** — 200×72 · "1" `Headline/Medium/Extra_Strong` · `text/dark/primary` #131417
- _Type=Delete, State=Enabled ‖ Type=Delete, State=Pressed_
  - **ic_close** ⟵ ic_close › Type=Delete — 48×48 · icon `icon/dark/secondary` #1B1C1ED6
- _Type=Clear, State=Enabled ‖ Type=Clear, State=Pressed_
  - **Clear** — 200×52 · "Clear" `Title/Large/Strong` · `text/dark/primary` #131417
- _Type=Delete, State=Disabled_
  - **ic_close** ⟵ ic_close › Type=Delete — 48×48 · icon `icon/dark/quaternary` #13141752
- _Type=Clear, State=Disabled_
  - **Clear** — 200×52 · "Clear" `Title/Large/Strong` · `text/dark/quaternary` #13141752

#### `ivi_keypad_normal`

- Variant 축: **On** (False / True) · **State** (Enabled / Pressed) · **Type** (Shift / Delete / Secondary / Primary / Hyphen / Mic / Enter / Space)
- 속성: Label (text, 기본 "A"), Label2 (text, 기본 "한/A")
- 바인딩된 사이즈 토큰 그룹: `Common/*`, `keyboard/keyword/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Primary, State=Enabled, On=False | 100×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/primary_normal` #FFFFFF |  |  |
| Type=Primary, State=Pressed, On=False | 100×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/primary_pressed` #EDEEF2 |  |  |
| Type=Delete, State=Enabled, On=False | 120×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/normal/secondary_normal` #C7C9CE |  |  |
| Type=Delete, State=Pressed, On=False | 120×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/normal/secondary_pressed` #A4A8AE |  |  |
| Type=Shift, State=Enabled, On=False | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/normal/secondary_normal` #C7C9CE |  |  |
| Type=Shift, On=False, State=Pressed | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/normal/secondary_pressed` #A4A8AE |  |  |
| Type=Shift, State=Enabled, On=True | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/normal/active_normal` #44464E |  |  |
| Type=Shift, On=True, State=Pressed | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/normal/active_pressed` #313236 |  |  |
| Type=Secondary, State=Enabled, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/secondary_normal` #C7C9CE |  |  |
| Type=Secondary, State=Pressed, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/secondary_pressed` #A4A8AE |  |  |
| Type=Mic, State=Enabled, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/secondary_normal` #C7C9CE |  |  |
| Type=Mic, State=Pressed, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/secondary_pressed` #A4A8AE |  |  |
| Type=Hyphen, State=Enabled, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/secondary_normal` #C7C9CE |  |  |
| Type=Hyphen, State=Pressed, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/secondary_pressed` #A4A8AE |  |  |
| Type=Space, State=Enabled, On=False | 300×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/primary_normal` #FFFFFF |  |  |
| Type=Space, State=Pressed, On=False | 300×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/normal/primary_pressed` #EDEEF2 |  |  |
| Type=Enter, State=Enabled, On=False | 200×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/normal/accents_normal` #44464E |  |  |
| Type=Enter, State=Pressed, On=False | 200×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/normal/accents_pressed` #313236 |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Primary, State=Enabled, On=False ‖ Type=Primary, State=Pressed, On=False_
  - **A** — 100×52 · "A" `Title/Large/Normal` · `text/dark/primary` #131417
- _Type=Delete, State=Enabled, On=False ‖ Type=Delete, State=Pressed, On=False ‖ Type=Shift, State=Enabled, On=False ‖ Type=Shift, On=False, State=Pressed_
  - **ic_keyboard** ⟵ ic_keyboard › Type=Delete — 44×44 · icon `icon/dark/primary` #131417
- _Type=Shift, State=Enabled, On=True ‖ Type=Shift, On=True, State=Pressed_
  - **ic_keyboard** ⟵ ic_keyboard › Type=Shift-Active — 44×44 · icon `informative/active` #22E77D
- _Type=Secondary, State=Enabled, On=False ‖ Type=Secondary, State=Pressed, On=False_
  - **한/A** — 67×44 · "한/A" `Title/Medium/Normal` · `text/dark/primary` #131417
- _Type=Mic, State=Enabled, On=False ‖ Type=Mic, State=Pressed, On=False_
  - **ic_mic** ⟵ ic_mic › On=on — 44×44 · icon `icon/dark/primary` #131417
- _Type=Hyphen, State=Enabled, On=False ‖ Type=Hyphen, State=Pressed, On=False_
  - **-** — 17×52 · "-" `Title/Large/Normal` · `text/dark/primary` #131417
- _Type=Enter, State=Enabled, On=False ‖ Type=Enter, State=Pressed, On=False_
  - **ic_keyboard** ⟵ ic_keyboard › Type=Enter — 44×44 · icon `icon/light/primary` #FFFFFF

#### `ivi_keypad_static`

- Variant 축: **On** (False / True) · **State** (Enabled / Pressed) · **Type** (Shift / Delete / Secondary / Primary / Hyphen / Mic / Enter / Space)
- 속성: Label (text, 기본 "A"), Label2 (text, 기본 "한/A")
- 바인딩된 사이즈 토큰 그룹: `Common/*`, `keyboard/keyword/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Primary, State=Enabled, On=False | 100×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/primary_normal` #686A72 |  |  |
| Type=Primary, State=Pressed, On=False | 100×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/primary_pressed` #44464E |  |  |
| Type=Delete, State=Enabled, On=False | 120×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/static/secondary_normal` #44464E |  |  |
| Type=Delete, State=Pressed, On=False | 120×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/static/secondary_pressed` #686A72 |  |  |
| Type=Shift, State=Enabled, On=False | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/static/secondary_normal` #44464E |  |  |
| Type=Shift, On=False, State=Pressed | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/static/secondary_pressed` #686A72 |  |  |
| Type=Shift, State=Enabled, On=True | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/static/active_normal` #686A72 |  |  |
| Type=Shift, On=True, State=Pressed | 165×80 | row, gap 0, pad 0/20, cross center | 20 | `keyboard/static/active_pressed` #313236 |  |  |
| Type=Secondary, State=Enabled, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/secondary_normal` #44464E |  |  |
| Type=Secondary, State=Pressed, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/secondary_pressed` #686A72 |  |  |
| Type=Mic, State=Enabled, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/secondary_normal` #44464E |  |  |
| Type=Mic, State=Pressed, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/secondary_pressed` #686A72 |  |  |
| Type=Hyphen, State=Enabled, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/secondary_normal` #44464E |  |  |
| Type=Hyphen, State=Pressed, On=False | 120×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/secondary_pressed` #686A72 |  |  |
| Type=Space, State=Enabled, On=False | 300×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/primary_normal` #686A72 |  |  |
| Type=Space, State=Pressed, On=False | 300×80 | row, gap 0, pad 0, main center, cross center | 20 | `keyboard/static/primary_pressed` #44464E |  |  |
| Type=Enter, State=Enabled, On=False | 200×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/static/accents_normal` #C7C9CE |  |  |
| Type=Enter, State=Pressed, On=False | 200×80 | row, gap 0, pad 0/20, main end, cross center | 20 | `keyboard/static/accents_pressed` #A4A8AE |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Primary, State=Enabled, On=False ‖ Type=Primary, State=Pressed, On=False_
  - **A** — 100×52 · "A" `Title/Large/Normal` · `keyboard/static/text` #FFFFFF
- _Type=Delete, State=Enabled, On=False ‖ Type=Delete, State=Pressed, On=False ‖ Type=Shift, State=Enabled, On=False ‖ Type=Shift, On=False, State=Pressed_
  - **ic_keyboard** ⟵ ic_keyboard › Type=Delete — 44×44 · icon `keyboard/static/icon_light` #FFFFFF
- _Type=Shift, State=Enabled, On=True ‖ Type=Shift, On=True, State=Pressed_
  - **ic_keyboard** ⟵ ic_keyboard › Type=Shift-Active — 44×44 · icon `informative/active` #22E77D
- _Type=Secondary, State=Enabled, On=False ‖ Type=Secondary, State=Pressed, On=False_
  - **한/A** — 67×44 · "한/A" `Title/Medium/Normal` · `keyboard/static/text` #FFFFFF
- _Type=Mic, State=Enabled, On=False ‖ Type=Mic, State=Pressed, On=False_
  - **ic_mic** ⟵ ic_mic › On=on — 44×44 · icon `keyboard/static/icon_light` #FFFFFF
- _Type=Hyphen, State=Enabled, On=False ‖ Type=Hyphen, State=Pressed, On=False_
  - **-** — 17×52 · "-" `Title/Large/Normal` · `keyboard/static/text` #FFFFFF
- _Type=Enter, State=Enabled, On=False ‖ Type=Enter, State=Pressed, On=False_
  - **ic_keyboard** ⟵ ic_keyboard › Type=Enter — 44×44 · icon `keyboard/static/icon_dark` #131417

### Selections

#### `ivi_checkbox`

- Variant 축: **Active** (False / True / Indeterminate) · **State** (Enabled / Pressed / Disabled)
- 바인딩된 사이즈 토큰 그룹: `selections/*`, `selections/checkbox/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Active=False, State=Enabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=False, State=Pressed | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=False, State=Disabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=True, State=Enabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=True, State=Pressed | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=True, State=Disabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=Indeterminate, State=Enabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=Indeterminate, State=Pressed | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=Indeterminate, State=Disabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Active=False, State=Enabled_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · stroke `divider/tertiary` #13141733 4px inside
- _Active=False, State=Pressed_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `dim/dark/secondary` #1314171A · stroke `divider/tertiary` #13141733 4px inside
- _Active=False, State=Disabled_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `dim/dark/primary` #1314170D · stroke `divider/secondary` #1314171A 4px inside
- _Active=True, State=Enabled_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `switch/on` #02C265
    - **ic_check** ⟵ ic_check › Type=basic — 44×44 · icon `static/light/100` #FFFFFF
- _Active=True, State=Pressed_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `switch/on` #02C265 + `dim/dark/secondary` #1314171A
    - **ic_check** ⟵ ic_check › Type=basic — 44×44 · icon `static/light/100` #FFFFFF
- _Active=True, State=Disabled_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `switch/disabled` #1314171A
    - **ic_check** ⟵ ic_check › Type=basic — 44×44 · icon `static/light/300` #FFFFFFA3
- _Active=Indeterminate, State=Enabled_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `switch/on` #02C265
    - **ic_minus** — 44×44 · icon `static/light/100` #FFFFFF
- _Active=Indeterminate, State=Pressed_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `switch/on` #02C265 + `dim/dark/secondary` #1314171A
    - **ic_minus** — 44×44 · icon `static/light/100` #FFFFFF
- _Active=Indeterminate, State=Disabled_
  - **Box** — 48×48 · row, gap 0, pad 0, main center, cross center · r 12 · fill `switch/disabled` #1314171A
    - **ic_minus** — 44×44 · icon `static/light/300` #FFFFFFA3

#### `ivi_radio_button`

- Variant 축: **Active** (true / false) · **State** (Enabled / Pressed / Disabled)
- 바인딩된 사이즈 토큰 그룹: `Radius/*`, `selections/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Active=true, State=Enabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=true, State=Pressed | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=true, State=Disabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=false, State=Enabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=false, State=Pressed | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Active=false, State=Disabled | 64×64 | row, gap 0, pad 0, main center, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Active=true, State=Enabled_
  - **radio** — 48×48 · row, gap 0, pad 0, main center, cross center · r 999 · fill `switch/knob_on` #FFFFFF · stroke `informative/active` #02C265 12px inside
- _Active=true, State=Pressed_
  - **radio** — 48×48 · row, gap 0, pad 0, main center, cross center · r 999 · fill `switch/knob_on` #FFFFFF · stroke `informative/active` #02C265 + `dim/dark/secondary` #1314171A 12px inside
- _Active=true, State=Disabled_
  - **radio** — 48×48 · row, gap 0, pad 0, main center, cross center · r 999 · fill `switch/knob_disabled` #FFFFFF · stroke `switch/disabled` #1314171A 12px inside
- _Active=false, State=Enabled_
  - **radio** — 48×48 · row, gap 0, pad 0, main center, cross center · r 999 · stroke `divider/tertiary` #13141733 4px inside
- _Active=false, State=Pressed_
  - **radio** — 48×48 · row, gap 0, pad 0, main center, cross center · r 999 · fill `dim/dark/secondary` #1314171A · stroke `divider/tertiary` #13141733 4px inside
- _Active=false, State=Disabled_
  - **radio** — 48×48 · row, gap 0, pad 0, main center, cross center · r 999 · fill `dim/dark/primary` #1314170D · stroke `divider/primary` #1314170D 4px inside

#### `ivi_switch`

- Variant 축: **Active** (false / true) · **Size** (Medium / Small) · **State** (Enabled / Pressed / Disabled)
- 바인딩된 사이즈 토큰 그룹: `selections/switch/medium/*`, `selections/switch/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Active=true, Size=Medium, State=Enabled | 80×48 | col, gap 0, pad 8, main center, cross end | 16 | `switch/on` #02C265 |  |  |
| Active=true, Size=Medium, State=Pressed | 80×48 | col, gap 0, pad 8, main center, cross end | 16 | `switch/on` #02C265 + `dim/dark/secondary` #1314171A |  |  |
| Active=true, Size=Medium, State=Disabled | 80×48 | col, gap 0, pad 8, main center, cross end | 16 | `switch/disabled` #1314171A |  |  |
| Active=false, Size=Medium, State=Enabled | 80×48 | col, gap 0, pad 8, main center | 16 | `switch/off` #1314174D |  |  |
| Active=false, Size=Medium, State=Pressed | 80×48 | col, gap 0, pad 8, main center | 16 | `switch/off` #1314174D + `dim/dark/secondary` #1314171A |  |  |
| Active=false, Size=Medium, State=Disabled | 80×48 | col, gap 0, pad 8, main center | 16 | `switch/disabled` #1314171A |  |  |
| Active=true, Size=Small, State=Enabled | 64×40 | col, gap 0, pad 6, cross end | 12 | `switch/on` #02C265 |  |  |
| Active=true, Size=Small, State=Pressed | 64×40 | col, gap 0, pad 6, cross end | 12 | `switch/on` #02C265 + `dim/dark/secondary` #1314171A |  |  |
| Active=true, Size=Small, State=Disabled | 64×40 | col, gap 0, pad 6, cross end | 12 | `switch/disabled` #1314171A |  |  |
| Active=false, Size=Small, State=Enabled | 64×40 | col, gap 0, pad 6 | 12 | `switch/off` #1314174D |  |  |
| Active=false, Size=Small, State=Pressed | 64×40 | col, gap 0, pad 6 | 12 | `switch/off` #1314174D + `dim/dark/secondary` #1314171A |  |  |
| Active=false, Size=Small, State=Disabled | 64×40 | col, gap 0, pad 6 | 12 | `switch/disabled` #1314171A |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Active=true, Size=Medium, State=Enabled ‖ Active=true, Size=Medium, State=Pressed ‖ Active=true, Size=Medium, State=Disabled ‖ Active=true, Size=Small, State=Enabled ‖ 외 2개_
  - **Rectangle 346243665** — 32×32 · r 8 · fill `switch/knob_on` #FFFFFF · effect Shadow/Light/Level1
- _Active=false, Size=Medium, State=Enabled ‖ Active=false, Size=Medium, State=Pressed ‖ Active=false, Size=Small, State=Enabled ‖ Active=false, Size=Small, State=Pressed_
  - **Rectangle 346243665** — 32×32 · r 8 · fill `switch/knob_off` #FFFFFF · effect Shadow/Light/Level1
- _Active=false, Size=Medium, State=Disabled ‖ Active=false, Size=Small, State=Disabled_
  - **Rectangle 346243665** — 32×32 · r 8 · fill `switch/knob_disabled` #FFFFFF · effect Shadow/Light/Level1

### Sliders

#### `ivi_slider_centered`

- Variant 축: **OFF** (False / True) · **Type** (Basic / Button / Number)
- 바인딩된 사이즈 토큰 그룹: `buttons/icon/medium/*`, `controller/slider/*`, `controller/slider/centered/knob/*`, `controller/slider/centered/temporature/*`, `controller/slider/centered/track/*`, `gnb/temperature/*`, `line_height_sp/*`, `size_sp/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Button, OFF=False | 532×100 | row, gap 16, pad 10, main center, cross center | 32 | `climate/slider_background` #FFFFFF | `climate/button_border_enabled` #13141733 3px inside |  |
| Type=Basic, OFF=False | 400×100 | row, gap 16, pad 12/40, main center, cross center | 32 | `climate/slider_background` #FFFFFF | `climate/button_border_enabled` #13141733 3px inside | Shadow/Light/Level1 |
| Type=Number, OFF=False | 529×100 | row, gap 16, pad 12/40, main center, cross center | 32 | `climate/slider_background` #FFFFFF | `climate/button_border_enabled` #13141733 3px inside | Shadow/Light/Level1 |
| Type=Button, OFF=True | 532×100 | row, gap 16, pad 10, main center, cross center | 32 | `climate/slider_background` #FFFFFF | `climate/button_border_enabled` #13141733 3px inside |  |
| Type=Basic, OFF=True | 400×100 | row, gap 16, pad 12/40, main center, cross center | 32 | `climate/slider_background` #FFFFFF | `climate/button_border_enabled` #13141733 3px inside | Shadow/Light/Level1 |
| Type=Number, OFF=True | 529×100 | row, gap 16, pad 12/40, main center, cross center | 32 | `climate/slider_background` #FFFFFF | `climate/button_border_enabled` #13141733 3px inside | Shadow/Light/Level1 |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Button, OFF=False_
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
    - **ic_plus** ⟵ ic_arrow › Direction=left — 56×56 · icon `icon/dark/primary` #131417
  - **slider_track** ⟵ slider_track › State=Mid, OFF=False — 320×8 · r 999 · fill linear-gradient(#0064FF 0%, #F62E24 100%)
    - **slider_knob** ⟵ slider_knob › State=Enabled — 48×48 · row, gap 0, pad 0, main center, cross center · r 1000
      - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
    - **ic_plus** ⟵ ic_arrow › Direction=right — 56×56 · icon `icon/dark/primary` #131417
- _Type=Basic, OFF=False_
  - **slider_track** ⟵ slider_track › State=Mid, OFF=False — 320×8 · r 999 · fill linear-gradient(#0064FF 0%, #F62E24 100%)
    - **slider_knob** ⟵ slider_knob › State=Enabled — 48×48 · row, gap 0, pad 0, main center, cross center · r 1000
      - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside
- _Type=Number, OFF=False_
  - **temp** — 113×76 · row, gap 0, pad 0, main center, cross baseline
    - **20** — 75×76 · "20" Asta Sans Bold 60/68 · `text/dark/primary` #131417
    - **.0** — 38×62 · ".0" Asta Sans ExtraBold 40/64 · `text/dark/primary` #131417
  - **slider_track** ⟵ slider_track › State=Mid, OFF=False — 320×8 · r 999 · fill linear-gradient(#0064FF 0%, #F62E24 100%)
    - **slider_knob** ⟵ slider_knob › State=Enabled — 48×48 · row, gap 0, pad 0, main center, cross center · r 1000
      - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside
- _Type=Button, OFF=True_
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
    - **ic_plus** ⟵ ic_arrow › Direction=left — 56×56 · icon `icon/dark/primary` #131417
  - **slider_track** ⟵ slider_track › State=Mid, OFF=True — 320×8 · r 999 · fill `basic/200` #E0E1E6
    - **slider_knob** ⟵ slider_knob › State=Enabled — 48×48 · row, gap 0, pad 0, main center, cross center · r 1000
      - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
    - **ic_plus** ⟵ ic_arrow › Direction=right — 56×56 · icon `icon/dark/primary` #131417
- _Type=Basic, OFF=True_
  - **slider_track** ⟵ slider_track › State=Mid, OFF=True — 320×8 · r 999 · fill `basic/200` #E0E1E6
    - **slider_knob** ⟵ slider_knob › State=Enabled — 48×48 · row, gap 0, pad 0, main center, cross center · r 1000
      - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside
- _Type=Number, OFF=True_
  - **temp** — 113×76 · row, gap 0, pad 0, main center, cross baseline
    - **20** — 75×76 · "20" Asta Sans Bold 60/68 · `text/dark/primary` #131417
    - **.0** — 38×62 · ".0" Asta Sans ExtraBold 40/64 · `text/dark/primary` #131417
  - **slider_track** ⟵ slider_track › State=Mid, OFF=True — 320×8 · r 999 · fill `basic/200` #E0E1E6
    - **slider_knob** ⟵ slider_knob › State=Enabled — 48×48 · row, gap 0, pad 0, main center, cross center · r 1000
      - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside

#### `slider_track`

- Variant 축: **OFF** (False / True) · **State** (Min / Mid / Max)
- 바인딩된 사이즈 토큰 그룹: `controller/slider/*`, `controller/slider/centered/knob/*`, `controller/slider/centered/track/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| State=Min, OFF=False | 320×8 |  | 999 | linear-gradient(#0064FF 0%, #F62E24 100%) |  |  |
| State=Mid, OFF=False | 320×8 |  | 999 | linear-gradient(#0064FF 0%, #F62E24 100%) |  |  |
| State=Max, OFF=False | 320×8 |  | 999 | linear-gradient(#0064FF 0%, #F62E24 100%) |  |  |
| State=Min, OFF=True | 320×8 |  | 999 | `basic/200` #E0E1E6 |  |  |
| State=Mid, OFF=True | 320×8 |  | 999 | `basic/200` #E0E1E6 |  |  |
| State=Max, OFF=True | 320×8 |  | 999 | `basic/200` #E0E1E6 |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _State=Min, OFF=False ‖ State=Mid, OFF=False ‖ State=Max, OFF=False ‖ State=Min, OFF=True ‖ 외 2개_
  - **slider_knob** ⟵ slider_knob › State=Enabled — 48×48 · row, gap 0, pad 0, main center, cross center · r 1000
    - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside

#### `slider_knob`

- Variant 축: **State** (Enabled / Pressed)
- 바인딩된 사이즈 토큰 그룹: `controller/slider/*`, `controller/slider/centered/knob/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| State=Enabled | 48×48 | row, gap 0, pad 0, main center, cross center | 1000 |  |  |  |
| State=Pressed | 56×56 | row, gap 0, pad 0, main center, cross center | 1000 |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _State=Enabled ‖ State=Pressed_
  - **Ellipse 7731** — 48×48 · r 1000 · fill `basic/700` #313236 · stroke `climate/slider_background` #FFFFFF 4px inside

#### `ivi_slider_continuous`

- Variant 축: **Size** (Large / Medium) · **Type** (Basic / Floating)
- 속성: Label (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `buttons/icon/medium/*`, `buttons/icon/small/*`, `controller/slider/*`, `controller/slider/continuous/medium/*`, `controller/slider/continuous/medium/knob/*`, `controller/slider/continuous/small/*`, `controller/slider/continuous/small/knob/*`, `controller/slider/continuous/track/medium/*`, `controller/slider/continuous/track/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Large, Type=Basic | 808×100 | row, gap 16, pad 10/20, cross center | 32 | `dim/dark/primary` #1314170D |  |  |
| Size=Large, Type=Floating | 808×100 | row, gap 16, pad 10/20, cross center | 32 | `background/popup` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |
| Size=Medium, Type=Basic | 560×80 | row, gap 12, pad 8/10, cross center | 24 | `dim/dark/primary` #1314170D |  |  |
| Size=Medium, Type=Floating | 560×80 | row, gap 12, pad 8/10, cross center | 24 | `background/popup` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Large, Type=Basic ‖ Size=Large, Type=Floating_
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
    - **ic_plus** ⟵ ic_arrow › Direction=left — 56×56 · icon `icon/dark/primary` #131417
  - **slider_track** ⟵ slider_track › Size=Medium, State=Enabled, Level=Mid — 576×80 · col, gap 0, pad 4, main center · r 24 · fill `controller/slider/normal` #13141733
    - **Knob** — 290×72 · r 20/0/0/20 · fill `controller/slider/knop` #FFFFFF
    - **ic_sound** ⟵ ic_sound › volume=mid — 48×48 · icon `icon/dark/primary` #131417
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
    - **ic_plus** ⟵ ic_arrow › Direction=right — 56×56 · icon `icon/dark/primary` #131417
- _Size=Medium, Type=Basic ‖ Size=Medium, Type=Floating_
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Small — 64×64 · row, gap 0, pad 0, main center, cross center · r 16
    - **ic_plus** ⟵ ic_arrow › Direction=left — 44×44 · icon `icon/dark/primary` #131417
  - **slider_track** ⟵ slider_track › Size=Small, State=Enabled, Level=Mid — 388×64 · col, gap 0, pad 4, main center · r 20 · fill `controller/slider/normal` #13141733
    - **Knob** — 160×56 · r 16/0/0/16 · fill `controller/slider/knop` #FFFFFF
    - **ic_sound** ⟵ ic_sound › volume=mid — 40×40 · icon `icon/dark/primary` #131417
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Small — 64×64 · row, gap 0, pad 0, main center, cross center · r 16
    - **ic_plus** ⟵ ic_arrow › Direction=right — 44×44 · icon `icon/dark/primary` #131417

#### `slider_track`

- Variant 축: **Level** (Max / High / Mid / Low / Min) · **Size** (Medium / Small) · **State** (Enabled / Pressed)
- 속성: Prefix icon (bool, 기본 true)
- 바인딩된 사이즈 토큰 그룹: `controller/slider/*`, `controller/slider/continuous/medium/knob/*`, `controller/slider/continuous/small/knob/*`, `controller/slider/continuous/track/medium/*`, `controller/slider/continuous/track/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium, State=Enabled, Level=Max | 580×80 | col, gap 0, pad 4, main center | 24 | `controller/slider/normal` #13141733 |  |  |
| Size=Small, State=Enabled, Level=Max | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/normal` #13141733 |  |  |
| Size=Medium, State=Enabled, Level=High | 580×80 | col, gap 0, pad 4, main center | 24 | `controller/slider/normal` #13141733 |  |  |
| Size=Small, State=Enabled, Level=High | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/normal` #13141733 |  |  |
| Size=Medium, State=Enabled, Level=Mid | 580×80 | col, gap 0, pad 4, main center | 24 | `controller/slider/normal` #13141733 |  |  |
| Size=Small, State=Enabled, Level=Mid | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/normal` #13141733 |  |  |
| Size=Medium, State=Enabled, Level=Low | 580×80 | row, gap 0, pad 4, cross center | 24 | `controller/slider/normal` #13141733 |  |  |
| Size=Small, State=Enabled, Level=Low | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/normal` #13141733 |  |  |
| Size=Medium, State=Enabled, Level=Min | 580×80 | row, gap 0, pad 4, cross center | 24 | `controller/slider/normal` #13141733 |  |  |
| Size=Small, State=Enabled, Level=Min | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/normal` #13141733 |  |  |
| Size=Medium, State=Pressed, Level=Max | 580×80 | col, gap 0, pad 4, main center | 24 | `controller/slider/pressed` #1314174D |  |  |
| Size=Small, State=Pressed, Level=Max | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/pressed` #1314174D |  |  |
| Size=Medium, State=Pressed, Level=High | 580×80 | col, gap 0, pad 4, main center | 24 | `controller/slider/pressed` #1314174D |  |  |
| Size=Small, State=Pressed, Level=High | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/pressed` #1314174D |  |  |
| Size=Medium, State=Pressed, Level=Mid | 580×80 | col, gap 0, pad 4, main center | 24 | `controller/slider/pressed` #1314174D |  |  |
| Size=Small, State=Pressed, Level=Mid | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/pressed` #1314174D |  |  |
| Size=Medium, State=Pressed, Level=Low | 580×80 | row, gap 0, pad 4, cross center | 24 | `controller/slider/pressed` #1314174D |  |  |
| Size=Small, State=Pressed, Level=Low | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/pressed` #1314174D |  |  |
| Size=Medium, State=Pressed, Level=Min | 580×80 | row, gap 0, pad 4, cross center | 24 | `controller/slider/pressed` #1314174D |  |  |
| Size=Small, State=Pressed, Level=Min | 320×72 | col, gap 0, pad 4, main center | 20 | `controller/slider/pressed` #1314174D |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium, State=Enabled, Level=Max ‖ Size=Medium, State=Pressed, Level=Max_
  - **Knob** — 572×72 · r 20 · fill `controller/slider/knop` #FFFFFF
  - **ic_sound** ⟵ ic_sound › volume=high — 48×48 · icon `icon/dark/primary` #131417
- _Size=Small, State=Enabled, Level=Max ‖ Size=Small, State=Pressed, Level=Max_
  - **Knob** — 312×64 · r 16 · fill `controller/slider/knop` #FFFFFF
  - **ic_sound** ⟵ ic_sound › volume=high — 40×40 · icon `icon/dark/primary` #131417
- _Size=Medium, State=Enabled, Level=High ‖ Size=Medium, State=Enabled, Level=Mid ‖ Size=Medium, State=Enabled, Level=Low ‖ Size=Medium, State=Pressed, Level=High ‖ 외 2개_
  - **Knob** — 516×72 · r 20/0/0/20 · fill `controller/slider/knop` #FFFFFF
  - **ic_sound** ⟵ ic_sound › volume=high — 48×48 · icon `icon/dark/primary` #131417
- _Size=Small, State=Enabled, Level=High ‖ Size=Small, State=Enabled, Level=Mid ‖ Size=Small, State=Enabled, Level=Low ‖ Size=Small, State=Pressed, Level=High ‖ 외 2개_
  - **Knob** — 276×64 · r 16/0/0/16 · fill `controller/slider/knop` #FFFFFF
  - **ic_sound** ⟵ ic_sound › volume=high — 40×40 · icon `icon/dark/primary` #131417
- _Size=Medium, State=Enabled, Level=Min ‖ Size=Small, State=Enabled, Level=Min ‖ Size=Medium, State=Pressed, Level=Min ‖ Size=Small, State=Pressed, Level=Min_
  - **ic_sound** ⟵ ic_sound › volume=mute — 48×48 · icon `icon/dark/primary` #131417

#### `slider_button`

- Variant 축: **Direction** (down / up) · **Size** (Medium / Small) · **State** (Enabled / Pressed / Disabled)
- 바인딩된 사이즈 토큰 그룹: `controller/slider/continuous/medium/*`, `controller/slider/continuous/small/*`, `controller/slider/continuous/track/medium/*`, `controller/slider/continuous/track/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium, State=Enabled, Direction=down | 80×80 | row, gap 0, pad 0, main center, cross center | 24 |  |  |  |
| Size=Medium, State=Enabled, Direction=up | 80×80 | row, gap 0, pad 0, main center, cross center | 24 |  |  |  |
| Size=Medium, State=Disabled, Direction=down | 80×80 | row, gap 0, pad 0, main center, cross center | 24 |  |  |  |
| Size=Medium, State=Disabled, Direction=up | 80×80 | row, gap 0, pad 0, main center, cross center | 24 |  |  |  |
| Size=Medium, State=Pressed, Direction=down | 80×80 | row, gap 0, pad 0, main center, cross center | 24 | `dim/dark/secondary` #1314171A |  |  |
| Size=Medium, State=Pressed, Direction=up | 80×80 | row, gap 0, pad 0, main center, cross center | 24 | `dim/dark/secondary` #1314171A |  |  |
| Size=Small, State=Enabled, Direction=down | 72×72 | row, gap 0, pad 0, main center, cross center | 20 |  |  |  |
| Size=Small, State=Enabled, Direction=up | 72×72 | row, gap 0, pad 0, main center, cross center | 20 |  |  |  |
| Size=Small, State=Disabled, Direction=down | 72×72 | row, gap 0, pad 0, main center, cross center | 20 |  |  |  |
| Size=Small, State=Disabled, Direction=up | 72×72 | row, gap 0, pad 0, main center, cross center | 20 |  |  |  |
| Size=Small, State=Pressed, Direction=down | 72×72 | row, gap 0, pad 0, main center, cross center | 20 | `dim/dark/secondary` #1314171A |  |  |
| Size=Small, State=Pressed, Direction=up | 72×72 | row, gap 0, pad 0, main center, cross center | 20 | `dim/dark/secondary` #1314171A |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium, State=Enabled, Direction=down ‖ Size=Medium, State=Enabled, Direction=up ‖ Size=Medium, State=Pressed, Direction=down ‖ Size=Medium, State=Pressed, Direction=up ‖ 외 4개_
  - **ic_arrow** ⟵ ic_arrow › Direction=left — 56×56 · icon `icon/dark/secondary` #1B1C1E80
- _Size=Medium, State=Disabled, Direction=down ‖ Size=Small, State=Disabled, Direction=down_
  - **ic_arrow** ⟵ ic_arrow › Direction=left — 56×56 · icon `icon/dark/quaternary` #1B1C1E33
- _Size=Medium, State=Disabled, Direction=up ‖ Size=Small, State=Disabled, Direction=up_
  - **ic_arrow** ⟵ ic_arrow › Direction=right — 56×56 · icon `icon/dark/quaternary` #1B1C1E1A

### Steppers

#### `ivi_stepper`
- 바인딩된 사이즈 토큰 그룹: `buttons/icon/small/*`, `controller/stepper/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| (single) | 420×100 | row, gap 24, pad 18/24, main center, cross center | 24 | `controller/stepper_background` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _ivi_stepper_
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Small — 64×64 · row, gap 0, pad 0, main center, cross center · r 16
    - **ic_plus** ⟵ ic_minus — 44×44 · icon `icon/dark/primary` #131417
  - **divider** — 0×64 · stroke `divider/tertiary` #13141733 2px center
  - **48A** — 148×44 · "48A" `Title/Medium/Strong` · `text/dark/primary` #131417
  - **divider** — 0×64 · stroke `divider/tertiary` #13141733 2px center
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Small — 64×64 · row, gap 0, pad 0, main center, cross center · r 16
    - **ic_plus** — 44×44 · icon `icon/dark/primary` #131417

### Fields

#### `ivi_text_field`

- Variant 축: **Size** (Medium / Small) · **State** (Enabled / Focused / Typing / Entered / Read Only / Error)
- 속성: Cursor (bool, 기본 true), Help text (bool, 기본 false), Label (text, 기본 "Place holder"), Suffix icon (bool, 기본 false), Place holder (text, 기본 "Place holder")
- 바인딩된 사이즈 토큰 그룹: `fields/text/medium/*`, `fields/text/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Small, State=Enabled | 700×80 | col, gap 12, pad 0, main center |  |  |  |  |
| Size=Medium, State=Enabled | 700×100 | col, gap 16, pad 0, main center |  |  |  |  |
| Size=Small, State=Focused | 700×80 | col, gap 12, pad 0, cross center |  |  |  |  |
| Size=Medium, State=Focused | 700×100 | col, gap 16, pad 0, cross center |  |  |  |  |
| Size=Small, State=Typing | 700×80 | col, gap 12, pad 0, main center |  |  |  |  |
| Size=Medium, State=Typing | 700×100 | col, gap 16, pad 0, main center |  |  |  |  |
| Size=Small, State=Entered | 700×80 | col, gap 12, pad 0, cross center |  |  |  |  |
| Size=Medium, State=Entered | 700×100 | col, gap 16, pad 0, cross center |  |  |  |  |
| Size=Small, State=Read Only | 700×80 | col, gap 12, pad 0, main center |  |  |  |  |
| Size=Medium, State=Read Only | 700×100 | col, gap 16, pad 0, cross center |  |  |  |  |
| Size=Small, State=Error | 700×126 | col, gap 12, pad 0, cross center |  |  |  |  |
| Size=Medium, State=Error | 700×150 | col, gap 16, pad 0, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Small, State=Enabled_
  - **Text Fields** — 700×80 · row, gap 12, pad 0/24, cross center · r 24 · fill `field/background` #FFFFFF · stroke `divider/secondary` #1314171A 2px inside
    - **Place holder** — 652×38 · "Place holder" `Body/Large/Normal` · `text/dark/tertiary` #131417A3
- _Size=Medium, State=Enabled_
  - **Text Fields** — 700×100 · row, gap 16, pad 0/32, cross center · r 24 · fill `field/background` #FFFFFF · stroke `divider/secondary` #1314171A 2px inside
    - **Place holder** — 636×44 · "Place holder" `Title/Medium/Normal` · `text/dark/tertiary` #131417A3
- _Size=Small, State=Focused_
  - **Text Fields** — 700×80 · row, gap 12, pad 0/24, cross center · r 24 · fill `field/background` #FFFFFF · stroke `field/focused` #313236 3px inside
    - **Text area** — 652×38 · row, gap 0, pad 0, cross center
      - **Place holder** — 652×38 · "Place holder" `Body/Large/Normal` · `text/dark/tertiary` #131417A3
      - **cursor** — 3×32 · fill `icon/dark/primary` #131417
- _Size=Medium, State=Focused_
  - **Text Fields** — 700×100 · row, gap 16, pad 0/32, cross center · r 24 · fill `field/background` #FFFFFF · stroke `field/focused` #313236 3px inside
    - **Text area** — 636×44 · row, gap 0, pad 0, cross center
      - **Place holder** — 636×44 · "Place holder" `Title/Medium/Normal` · `text/dark/tertiary` #131417A3
      - **cursor** — 3×32 · fill `icon/dark/primary` #131417
- _Size=Small, State=Typing_
  - **Text Fields** — 700×80 · row, gap 12, pad 0/24, cross center · r 24 · fill `field/background` #FFFFFF · stroke `field/focused` #313236 3px inside
    - **Text area** — 600×38 · row, gap 4, pad 0, cross center
      - **Typing** — 91×38 · "Typing" `Body/Large/Normal` · `text/dark/primary` #131417
      - **cursor** — 3×32 · fill `icon/dark/primary` #131417
    - **ic_close** ⟵ ic_close › Type=Circle — 40×40 · icon `icon/dark/secondary` #1B1C1ECC
- _Size=Medium, State=Typing_
  - **Text Fields** — 700×100 · row, gap 16, pad 0/32, cross center · r 24 · fill `field/background` #FFFFFF · stroke `field/focused` #313236 3px inside
    - **Text area** — 572×44 · row, gap 0, pad 0, cross center
      - **Typing** — 109×44 · "Typing" `Title/Medium/Normal` · `text/dark/primary` #131417
      - **cursor** — 3×32 · fill `icon/dark/primary` #131417
    - **ic_close** ⟵ ic_close › Type=Circle — 48×48 · icon `icon/dark/secondary` #1B1C1ECC
- _Size=Small, State=Entered_
  - **Text Fields** — 700×80 · row, gap 12, pad 0/24, cross center · r 24 · fill `field/background` #FFFFFF · stroke `divider/secondary` #1314171A 2px inside
    - **Place holder** — 652×38 · "Place holder" `Body/Large/Normal` · `text/dark/primary` #131417
- _Size=Medium, State=Entered_
  - **Text Fields** — 700×100 · row, gap 16, pad 0/32, cross center · r 24 · fill `field/background` #FFFFFF · stroke `divider/secondary` #1314171A 2px inside
    - **Place holder** — 636×44 · "Place holder" `Title/Medium/Normal` · `text/dark/primary` #131417
- _Size=Small, State=Read Only_
  - **Text Fields** — 700×80 · row, gap 12, pad 0/24, cross center · r 24 · fill `surface/high` #EDEEF2 · stroke `divider/secondary` #1314171A 2px inside
    - **Place holder** — 652×38 · "Place holder" `Body/Large/Normal` · `text/dark/primary` #131417
- _Size=Medium, State=Read Only_
  - **Text Fields** — 700×100 · row, gap 16, pad 0/32, cross center · r 24 · fill `surface/high` #EDEEF2 · stroke `divider/secondary` #1314171A 2px inside
    - **Place holder** — 636×44 · "Place holder" `Title/Medium/Normal` · `text/dark/primary` #131417
- _Size=Small, State=Error_
  - **Text Fields** — 700×80 · row, gap 12, pad 0/24, cross center · r 24 · fill `field/background` #FFFFFF · stroke `regulation/red` #F62E24 3px inside
    - **Place holder** — 652×38 · "Place holder" `Body/Large/Normal` · `text/dark/primary` #131417
  - **Help Text** — 700×34 · row, gap 0, pad 0/16, main center, cross center
    - **Description** — 668×34 · "Please enter a valid email for" `Body/Small/Normal` · `regulation/red` #F62E24
- _Size=Medium, State=Error_
  - **Text Fields** — 700×100 · row, gap 16, pad 0/32, cross center · r 24 · fill `field/background` #FFFFFF · stroke `regulation/red` #F62E24 3px inside
    - **Place holder** — 636×44 · "Place holder" `Title/Medium/Normal` · `text/dark/primary` #131417
  - **Help Text** — 700×34 · row, gap 0, pad 0/16, main center, cross center
    - **Description** — 668×34 · "Please enter a valid email for" `Body/Small/Normal` · `regulation/red` #F62E24

#### `ivi_number_field`

- Variant 축: **Size** (Large / Medium) · **State** (Enabled / Focused / Entered / Error)
- 바인딩된 사이즈 토큰 그룹: `Spacing/*`, `fields/number/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium, State=Enabled | 128×128 | row, gap 0, pad 0, main center, cross center | 32 |  | `divider/secondary` #1314171A 4px inside |  |
| Size=Medium, State=Focused | 128×128 | row, gap 0, pad 0, main center, cross center | 32 | `dim/dark/secondary` #1314171A | `field/focused` #313236 4px inside |  |
| Size=Medium, State=Error | 128×128 | row, gap 0, pad 0, main center, cross center | 32 |  | `regulation/red` #F62E24 4px inside |  |
| Size=Medium, State=Entered | 128×128 | row, gap 0, pad 0, main center, cross center | 32 |  | `divider/secondary` #1314171A 4px inside |  |
| Size=Large, State=Enabled | 140×180 | row, gap 0, pad 0, main center, cross center | 32 |  | `divider/secondary` #1314171A 4px inside |  |
| Size=Large, State=Focused | 140×180 | row, gap 0, pad 0, main center, cross center | 32 | `dim/dark/secondary` #1314171A | `field/focused` #313236 4px inside |  |
| Size=Large, State=Error | 140×180 | row, gap 0, pad 0, main center, cross center | 32 |  | `regulation/red` #F62E24 4px inside |  |
| Size=Large, State=Entered | 140×180 | row, gap 0, pad 0, main center, cross center | 32 |  | `divider/secondary` #1314171A 4px inside |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium, State=Focused ‖ Size=Large, State=Focused_
  - **cursor** — 4×48 · fill `icon/dark/primary` #131417
- _Size=Medium, State=Error ‖ Size=Medium, State=Entered ‖ Size=Large, State=Error ‖ Size=Large, State=Entered_
  - **3** — 128×128 · "3" `Headline/Large/Extra_Strong` · `text/dark/primary` #131417

### Dropdown Menu

#### `ivi_dropdown`

- Variant 축: **Size** (Medium / Small)
- 속성: has Container (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `dropdown/*`, `dropdown/container/*`, `dropdown/medium/*`, `dropdown/medium/prefix/*`, `dropdown/prefix/*`, `dropdown/prefix/medium/*`, `dropdown/small/*`, `dropdown/suffix/*`, `selections/switch/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium | 600×100 | col, gap 8, pad 0, main center |  |  |  |  |
| Size=Small | 600×80 | col, gap 8, pad 0, main center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium_
  - **dropdown_button** ⟵ dropdown_button › Size=Medium, State=Enabled — 600×100 · row, gap 0, pad 0/20, cross center · r 32 · fill `dropdown/normal` #FFFFFF · stroke `divider/secondary` #1314171A 2px inside · effect Shadow/Light/Level1
    - **title** — 512×38 · row, gap 0, pad 0, cross center
      - **Label** — 512×38 · row, gap 0, pad 0/16, main center, cross center
        - **42dot theme** — 480×38 · "42dot theme" `Body/Large/Strong` · `text/dark/primary` #131417
    - **Suffix** ⟵ ic_arrow › Direction=down — 48×48 · icon `icon/dark/primary` #131417
- _Size=Small_
  - **dropdown_button** ⟵ dropdown_button › Size=Small, State=Enabled — 600×80 · row, gap 0, pad 0/16, main center, cross center · r 28 · fill `dropdown/normal` #FFFFFF · stroke `divider/secondary` #1314171A 2px inside · effect Shadow/Light/Level1
    - **title** — 520×38 · row, gap 0, pad 0, cross center
      - **Label** — 520×38 · row, gap 0, pad 0/12, cross center
        - **42dot theme** — 496×38 · "42dot theme" `Body/Large/Strong` · `text/dark/primary` #131417
    - **Suffix** ⟵ ic_arrow › Direction=down — 48×48 · icon `icon/dark/primary` #131417

#### `ivi_dropdown_menus`

- Variant 축: **Size** (Medium / Small)
- 바인딩된 사이즈 토큰 그룹: `dropdown/*`, `dropdown/container/*`, `dropdown/medium/*`, `dropdown/medium/prefix/*`, `dropdown/prefix/*`, `dropdown/prefix/medium/*`, `dropdown/small/*`, `dropdown/suffix/*`, `selections/switch/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium | 600×364 | col, gap 16, pad 16, main center, cross center | 32 | `surface/basic` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |
| Size=Small | 600×304 | col, gap 16, pad 16, main center, cross center | 28 | `surface/basic` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium_
  - **dropdown_item** ⟵ dropdown_item › Size=Medium, State=Selected — 568×100 · row, gap 0, pad 0/20, cross center · r 32 · fill `dim/dark/primary` #1314170D
    - **title** — 480×38 · row, gap 0, pad 0, cross center
      - **Label** — 480×38 · row, gap 0, pad 0/12, main center, cross center
        - **Label** — 456×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
    - **ic_check** ⟵ ic_check › Type=basic — 48×48 · icon `icon/dark/primary` #131417
  - **dropdown_item** ⟵ dropdown_item › Size=Medium, State=Enabled — 568×100 · row, gap 0, pad 0/20, cross center · r 32
    - **title** — 528×38 · row, gap 0, pad 0, cross center
      - **Label** — 528×38 · row, gap 0, pad 0/12, main center, cross center
        - **Label** — 504×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **dropdown_item** ⟵ dropdown_item › Size=Medium, State=Enabled — 568×100 · row, gap 0, pad 0/20, cross center · r 32
    - **title** — 528×38 · row, gap 0, pad 0, cross center
      - **Label** — 528×38 · row, gap 0, pad 0/12, main center, cross center
        - **Label** — 504×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
- _Size=Small_
  - **dropdown_item** ⟵ dropdown_item › Size=Small, State=Selected — 568×80 · row, gap 0, pad 0/16, cross center · r 28 · fill `dim/dark/primary` #1314170D
    - **title** — 488×38 · row, gap 0, pad 0, cross center
      - **Label** — 488×38 · row, gap 0, pad 0/12, cross center
        - **Label** — 464×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
    - **ic_check** ⟵ ic_check › Type=basic — 48×48 · icon `icon/dark/primary` #131417
  - **dropdown_item** ⟵ dropdown_item › Size=Small, State=Enabled — 568×80 · row, gap 0, pad 0/16, cross center · r 28
    - **title** — 536×38 · row, gap 0, pad 0, cross center
      - **Label** — 536×38 · row, gap 0, pad 0/12, cross center
        - **Label** — 512×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **dropdown_item** ⟵ dropdown_item › Size=Small, State=Enabled — 568×80 · row, gap 0, pad 0/16, cross center · r 28
    - **title** — 536×38 · row, gap 0, pad 0, cross center
      - **Label** — 536×38 · row, gap 0, pad 0/12, cross center
        - **Label** — 512×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417

#### `dropdown_button`

- Variant 축: **Size** (Medium / Small) · **State** (Enabled / Pressed / Disabled)
- 속성: Label (text, 기본 "42dot theme"), prefix icon (bool, 기본 false), App icon (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `dropdown/*`, `dropdown/container/*`, `dropdown/medium/*`, `dropdown/medium/prefix/*`, `dropdown/prefix/*`, `dropdown/small/*`, `dropdown/suffix/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium, State=Enabled | 600×100 | row, gap 0, pad 0/20, cross center | 32 | `dropdown/normal` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |
| Size=Medium, State=Pressed | 600×100 | row, gap 0, pad 0/20, cross center | 32 | `dropdown/pressed` #EDEEF2 | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |
| Size=Medium, State=Disabled | 600×100 | row, gap 0, pad 0/20, cross center | 32 | `dropdown/normal` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |
| Size=Small, State=Enabled | 600×80 | row, gap 0, pad 0/16, main center, cross center | 28 | `dropdown/normal` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |
| Size=Small, State=Pressed | 600×80 | row, gap 0, pad 0/16, cross center | 28 | `dropdown/pressed` #EDEEF2 | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |
| Size=Small, State=Disabled | 600×80 | row, gap 0, pad 0/16, cross center | 28 | `dropdown/normal` #FFFFFF | `divider/secondary` #1314171A 2px inside | Shadow/Light/Level1 |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium, State=Enabled ‖ Size=Medium, State=Pressed_
  - **title** — 512×38 · row, gap 0, pad 0, cross center
    - **Label** — 512×38 · row, gap 0, pad 0/16, main center, cross center
      - **42dot theme** — 480×38 · "42dot theme" `Body/Large/Strong` · `text/dark/primary` #131417
  - **Suffix** ⟵ ic_arrow › Direction=down — 48×48 · icon `icon/dark/primary` #131417
- _Size=Medium, State=Disabled_
  - **title** — 512×38 · row, gap 0, pad 0, cross center
    - **Label** — 512×38 · row, gap 0, pad 0/16, main center, cross center
      - **42dot theme** — 480×38 · "42dot theme" `Body/Large/Strong` · `text/dark/quaternary` #13141752
  - **Suffix** ⟵ ic_arrow › Direction=down — 48×48 · icon `icon/dark/quaternary` #13141752
- _Size=Small, State=Enabled ‖ Size=Small, State=Pressed_
  - **title** — 520×38 · row, gap 0, pad 0, cross center
    - **Label** — 520×38 · row, gap 0, pad 0/12, cross center
      - **42dot theme** — 496×38 · "42dot theme" `Body/Large/Strong` · `text/dark/primary` #131417
  - **Suffix** ⟵ ic_arrow › Direction=down — 48×48 · icon `icon/dark/primary` #131417
- _Size=Small, State=Disabled_
  - **Frame 4** — 520×38 · row, gap 0, pad 0, cross center
    - **Label** — 520×38 · row, gap 0, pad 0/12, cross center
      - **42dot theme** — 496×38 · "42dot theme" `Body/Large/Strong` · `text/dark/quaternary` #13141752
  - **Suffix** ⟵ ic_arrow › Direction=down — 48×48 · icon `icon/dark/quaternary` #13141752

#### `dropdown_item`

- Variant 축: **Size** (Small / Medium) · **State** (Enabled / Selected / Disabled / Footer)
- 속성: Label (text, 기본 "Label"), App icon (bool, 기본 false), Prefix icon (bool, 기본 false), Switch (bool, 기본 false), New dot (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `dropdown/*`, `dropdown/container/*`, `dropdown/medium/*`, `dropdown/medium/prefix/*`, `dropdown/prefix/*`, `dropdown/prefix/medium/*`, `dropdown/small/*`, `dropdown/suffix/*`, `selections/switch/small/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium, State=Selected | 568×100 | row, gap 0, pad 0/20, cross center | 32 | `dim/dark/primary` #1314170D |  |  |
| Size=Medium, State=Enabled | 568×100 | row, gap 0, pad 0/20, cross center | 32 |  |  |  |
| Size=Medium, State=Disabled | 568×100 | row, gap 0, pad 0/20, cross center | 32 |  |  |  |
| Size=Medium, State=Footer | 568×97 | col, gap 16, pad 0/20, main center | 32 |  |  |  |
| Size=Small, State=Selected | 568×80 | row, gap 0, pad 0/16, cross center | 28 | `dim/dark/primary` #1314170D |  |  |
| Size=Small, State=Enabled | 568×80 | row, gap 0, pad 0/16, cross center | 28 |  |  |  |
| Size=Small, State=Disabled | 568×80 | row, gap 0, pad 0/16, cross center | 28 |  |  |  |
| Size=Small, State=Footer | 568×81 | col, gap 16, pad 0/16, main center | 28 |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium, State=Selected_
  - **title** — 480×38 · row, gap 0, pad 0, cross center
    - **Label** — 480×38 · row, gap 0, pad 0/12, main center, cross center
      - **Label** — 456×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **ic_check** ⟵ ic_check › Type=basic — 48×48 · icon `icon/dark/primary` #131417
- _Size=Medium, State=Enabled_
  - **title** — 528×38 · row, gap 0, pad 0, cross center
    - **Label** — 528×38 · row, gap 0, pad 0/12, main center, cross center
      - **Label** — 504×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
- _Size=Medium, State=Disabled_
  - **title** — 528×38 · row, gap 0, pad 0, cross center
    - **Label** — 528×38 · row, gap 0, pad 0/12, main center, cross center
      - **Label** — 504×38 · "Label" `Body/Large/Strong` · `text/dark/quaternary` #13141752
- _Size=Medium, State=Footer ‖ Size=Small, State=Footer_
  - **Rectangle 346244179** — 528×1 · fill `divider/tertiary` #13141733
  - **Container** — 528×80 · row, gap 20, pad 0, cross center
    - **Prefix** — 80×80 · row, gap 0, pad 12, main center, cross center · r 999 · fill `dim/dark/primary` #1314170D
      - **ic_plus** — 40×40 · icon `icon/dark/primary` #131417
    - **Label** — 428×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
- _Size=Small, State=Selected_
  - **title** — 488×38 · row, gap 0, pad 0, cross center
    - **Label** — 488×38 · row, gap 0, pad 0/12, cross center
      - **Label** — 464×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **ic_check** ⟵ ic_check › Type=basic — 48×48 · icon `icon/dark/primary` #131417
- _Size=Small, State=Enabled_
  - **title** — 536×38 · row, gap 0, pad 0, cross center
    - **Label** — 536×38 · row, gap 0, pad 0/12, cross center
      - **Label** — 512×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
- _Size=Small, State=Disabled_
  - **title** — 536×38 · row, gap 0, pad 0, cross center
    - **Label** — 536×38 · row, gap 0, pad 0/12, cross center
      - **Label** — 512×38 · "Label" `Body/Large/Strong` · `text/dark/quaternary` #13141752

### Tabs

#### `ivi_segmented_control/solid`

- Variant 축: **Segments** (2 / 3 / 4 / 5 / 6) · **Size** (Large / Medium)
- 바인딩된 사이즈 토큰 그룹: `Radius/*`, `tabs/solid/*`, `tabs/solid/large/*`, `tabs/solid/large/button/*`, `tabs/solid/medium/*`, `tabs/solid/medium/button/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Large, Segments=6 | 1176×100 | row, gap 0, pad 8, main center, cross center | 32 | `controller/tab_background` #1314170D |  |  |
| Size=Large, Segments=5 | 1176×100 | row, gap 0, pad 8, main center, cross center | 32 | `controller/tab_background` #1314170D |  |  |
| Size=Large, Segments=4 | 1176×100 | row, gap 0, pad 8, main center, cross center | 32 | `controller/tab_background` #1314170D |  |  |
| Size=Large, Segments=3 | 880×100 | row, gap 0, pad 8, main center, cross center | 32 | `controller/tab_background` #1314170D |  |  |
| Size=Large, Segments=2 | 880×100 | row, gap 0, pad 8, main center, cross center | 32 | `controller/tab_background` #1314170D |  |  |
| Size=Medium, Segments=5 | 1176×80 | row, gap 0, pad 8, main center, cross center | 24 | `controller/tab_background` #1314170D |  |  |
| Size=Medium, Segments=4 | 960×80 | row, gap 0, pad 8, main center, cross center | 24 | `controller/tab_background` #1314170D |  |  |
| Size=Medium, Segments=3 | 780×80 | row, gap 0, pad 8, main center, cross center | 24 | `controller/tab_background` #1314170D |  |  |
| Size=Medium, Segments=2 | 780×80 | row, gap 0, pad 8, main center, cross center | 24 | `controller/tab_background` #1314170D |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Large, Segments=6_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=true — 191.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level2
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 191.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 191.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 191.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 191.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 191.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Large, Segments=5_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=true — 230.4×84 · row, gap 14, pad 16/28, main center, cross center · r 24 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level2
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 230.4×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 230.4×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 230.4×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 230.4×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Large, Segments=4_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=true — 288.5×84 · row, gap 14, pad 16/28, main center, cross center · r 24 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level2
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 288.5×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 288.5×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 288.5×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Large, Segments=3_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=true — 286.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level2
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 286.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 286.7×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Large, Segments=2_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=true — 431×84 · row, gap 14, pad 16/28, main center, cross center · r 24 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level2
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Large, State=Enabled, Focused=false — 431×84 · row, gap 14, pad 16/28, main center, cross center · r 24
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Medium, Segments=5_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=true — 230.4×64 · row, gap 8, pad 12/18, main center, cross center · r 16 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level1
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 230.4×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 230.4×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 230.4×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 230.4×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
- _Size=Medium, Segments=4_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=true — 234.5×64 · row, gap 8, pad 12/18, main center, cross center · r 16 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level1
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 234.5×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 234.5×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 234.5×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
- _Size=Medium, Segments=3_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=true — 253.3×64 · row, gap 8, pad 12/18, main center, cross center · r 16 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level1
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 253.3×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
  - **divider** — 2×36 · fill `divider/secondary` #1314171A
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 253.3×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
- _Size=Medium, Segments=2_
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=true — 381×64 · row, gap 8, pad 12/18, main center, cross center · r 16 · fill `button/switch/enabled` #FFFFFF · effect Shadow/Light/Level1
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417
  - **divider** — 2×36 · fill `divider/secondary` #1314171A · opacity 0
  - **segmented_controls/goast_button** ⟵ segmented_controls/goast_button › Size=Medium, State=Enabled, Focused=false — 381×64 · row, gap 8, pad 12/18, main center, cross center · r 16
    - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6

#### `segmented_controls/goast_button`

- Variant 축: **Focused** (false / true) · **Size** (Large / Medium) · **State** (Enabled / Pressed / Disabled)
- 속성: Icon (bool, 기본 false), Label (bool, 기본 true), Text (text, 기본 "Label")
- 바인딩된 사이즈 토큰 그룹: `tabs/solid/large/button/*`, `tabs/solid/medium/button/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Large, State=Enabled, Focused=false | 200×84 | row, gap 14, pad 16/28, main center, cross center | 24 |  |  |  |
| Size=Large, State=Pressed, Focused=false | 200×84 | row, gap 14, pad 16/28, main center, cross center | 24 | `button/basic/pressed` #1314171A |  |  |
| Size=Large, State=Disabled, Focused=false | 200×84 | row, gap 14, pad 16/28, main center, cross center | 24 |  |  |  |
| Size=Large, State=Enabled, Focused=true | 200×84 | row, gap 14, pad 16/28, main center, cross center | 24 | `button/switch/enabled` #FFFFFF |  | Shadow/Light/Level2 |
| Size=Large, State=Disabled, Focused=true | 200×84 | row, gap 14, pad 16/28, main center, cross center | 24 | `button/switch/enabled` #FFFFFF |  | Shadow/Light/Level2 |
| Size=Medium, State=Enabled, Focused=false | 160×64 | row, gap 8, pad 12/18, main center, cross center | 16 |  |  |  |
| Size=Medium, State=Pressed, Focused=false | 160×64 | row, gap 8, pad 12/18, main center, cross center | 16 | `button/basic/pressed` #1314171A |  |  |
| Size=Medium, State=Disabled, Focused=false | 160×64 | row, gap 8, pad 12/18, main center, cross center | 16 |  |  |  |
| Size=Medium, State=Enabled, Focused=true | 160×64 | row, gap 8, pad 12/18, main center, cross center | 16 | `button/switch/enabled` #FFFFFF |  | Shadow/Light/Level1 |
| Size=Medium, State=Disabled, Focused=true | 160×64 | row, gap 8, pad 12/18, main center, cross center | 16 | `button/switch/enabled` #FFFFFF |  | Shadow/Light/Level1 |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Large, State=Enabled, Focused=false ‖ Size=Large, State=Pressed, Focused=false_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Size=Large, State=Disabled, Focused=false ‖ Size=Large, State=Disabled, Focused=true_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/quaternary` #13141752
- _Size=Large, State=Enabled, Focused=true_
  - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
- _Size=Medium, State=Enabled, Focused=false ‖ Size=Medium, State=Pressed, Focused=false_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/secondary` #131417D6
- _Size=Medium, State=Disabled, Focused=false ‖ Size=Medium, State=Disabled, Focused=true_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/quaternary` #13141752
- _Size=Medium, State=Enabled, Focused=true_
  - **Label** — 75×38 · "Label" `Body/Large/Strong` · `text/dark/primary` #131417

#### `ivi_segmented_control/line`

- Variant 축: **Bottom line** (True / False)
- 바인딩된 사이즈 토큰 그룹: `tabs/line/*`, `tabs/line/button/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Bottom line=True | 1107×100 | row, gap 24, pad 0/28, cross center |  |  | `divider/secondary` #1314171A T0 R0 B1 L0px inside |  |
| Bottom line=False | 1107×128 | row, gap 24, pad 0, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Bottom line=True_
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Selected, Margin=Medium — 191×100 · row, gap 0, pad 12/0, main center, cross center · stroke `text/dark/primary` #131417 T0 R0 B4 L0px inside
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/primary` #131417
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 191×100 · row, gap 0, pad 12/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 191×100 · row, gap 0, pad 12/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 191×100 · row, gap 0, pad 12/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 191×100 · row, gap 0, pad 12/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Bottom line=False_
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Selected, Margin=Large(Page Nav Only)) — 191×128 · row, gap 0, pad 26/0, main center, cross center · stroke `text/dark/primary` #131417 T0 R0 B4 L0px inside
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/primary` #131417
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Large(Page Nav Only)) — 191×128 · row, gap 0, pad 26/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Large(Page Nav Only)) — 191×128 · row, gap 0, pad 26/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Large(Page Nav Only)) — 191×128 · row, gap 0, pad 26/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
  - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Large(Page Nav Only)) — 191×128 · row, gap 0, pad 26/0, main center, cross center
    - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
      - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6

#### `segmented_controls/line_button`

- Variant 축: **Margin** (Medium / Large(Page Nav Only))) · **State** (Enabled / Pressed / Selected / Disabled)
- 속성: Prefix icon (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `Radius/*`, `tabs/line/*`, `tabs/line/button/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| State=Enabled, Margin=Medium | 191×100 | row, gap 0, pad 12/0, main center, cross center |  |  |  |  |
| State=Pressed, Margin=Medium | 191×100 | row, gap 0, pad 12/0, main center, cross center |  |  |  |  |
| State=Selected, Margin=Medium | 191×100 | row, gap 0, pad 12/0, main center, cross center |  |  | `text/dark/primary` #131417 T0 R0 B4 L0px inside |  |
| State=Disabled, Margin=Medium | 191×100 | row, gap 0, pad 12/0, main center, cross center |  |  |  |  |
| State=Enabled, Margin=Large(Page Nav Only)) | 191×128 | row, gap 0, pad 26/0, main center, cross center |  |  |  |  |
| State=Pressed, Margin=Large(Page Nav Only)) | 191×128 | row, gap 0, pad 26/0, main center, cross center |  |  |  |  |
| State=Selected, Margin=Large(Page Nav Only)) | 191×128 | row, gap 0, pad 26/0, main center, cross center |  |  | `text/dark/primary` #131417 T0 R0 B4 L0px inside |  |
| State=Disabled, Margin=Large(Page Nav Only)) | 191×128 | row, gap 0, pad 26/0, main center, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _State=Enabled, Margin=Medium ‖ State=Enabled, Margin=Large(Page Nav Only))_
  - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
    - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _State=Pressed, Margin=Medium ‖ State=Pressed, Margin=Large(Page Nav Only))_
  - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12 · fill `dim/dark/primary` #1314170D
    - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _State=Selected, Margin=Medium ‖ State=Selected, Margin=Large(Page Nav Only))_
  - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
    - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/primary` #131417
- _State=Disabled, Margin=Medium ‖ State=Disabled, Margin=Large(Page Nav Only))_
  - **Button** — 191×76 · row, gap 8, pad 18/14, cross center · r 12
    - **Button text** — 163×40 · "Button text" `Title/Small/Strong` · `text/dark/quaternary` #13141752

### Page Navigation

#### `ivi_header`

- Variant 축: **Type** (Radio / Radio_Segmented_control / Music / Music_background / Phone / Phone_Segmented_control)
- 속성: Suffix button (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `New group/*`, `bars/*`, `bars/app_control/*`, `buttons/icon/medium/*`, `buttons/icon/small/*`, `line/*`, `page_navigation/*`, `page_navigation/title/*`, `page_navigation/title/app_icon/*`, `page_navigation/title/dropdown_menu_pressed/*`, `tabs/line/*`, `tabs/line/button/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Radio | 1355×144 | col, gap 0, pad 40/0/24/0, cross center |  | `surface/basic` #FFFFFF | `divider/tertiary` #13141733 T0 R0 B1 L0px inside |  |
| Type=Radio_Segmented_control | 1355×232 | col, gap 12, pad 40/0, cross center |  | `surface/basic` #FFFFFF | `divider/tertiary` #13141733 T0 R0 B1 L0px inside |  |
| Type=Phone | 1355×144 | col, gap 0, pad 40/0/24/0, cross center |  | `surface/basic` #FFFFFF | `divider/tertiary` #13141733 T0 R0 B1 L0px inside |  |
| Type=Phone_Segmented_control | 1355×232 | col, gap 12, pad 40/0, cross center |  | `surface/basic` #FFFFFF | `divider/tertiary` #13141733 T0 R0 B1 L0px inside |  |
| Type=Music | 1355×144 | col, gap 0, pad 40/0/24/0, cross center |  |  | `divider/tertiary` #13141733 T0 R0 B1 L0px inside |  |
| Type=Music_background | 1355×144 | col, gap 0, pad 40/0/24/0, cross center |  | `surface/basic` #FFFFFF | `divider/tertiary` #13141733 T0 R0 B1 L0px inside |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Radio_
  - **Title** ⟵ ivi_title › Type=Main — 1355×80 · row, gap 40, pad 0/24/0/40, main space-between, cross center
    - **title_group** — 1027×80 · row, gap 48, pad 0, cross center
      - **menu_group** — 426×80 · row, gap 16, pad 0, cross center
        - **Sources** ⟵ ic_app — 80×80 · icon
        - **primary_button** — 171×68 · col, gap 4, pad 8/16, main center · r 16
          - **Title** — 139×52 · row, gap 8, pad 0, cross center
        - **Divider** — 2×32 · fill `divider/tertiary` #13141733
        - **secondary_button** — 125×68 · row, gap 8, pad 8/16, cross center · r 16
          - **FM** — 57×52 · "FM" `Title/Large/Strong` · `text/dark/primary` #131417
          - **Dropdown** ⟵ ic_dropdown › Direction=Down — 28×28 · icon `text/dark/primary` #131417 + #252525
    - **suffix** — 264×80 · row, gap 12, pad 0, cross center
      - **btn1** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn2** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn3** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
- _Type=Radio_Segmented_control_
  - **Title** ⟵ ivi_title › Type=Main — 1355×80 · row, gap 40, pad 0/24/0/40, main space-between, cross center
    - **title_group** — 1027×80 · row, gap 48, pad 0, cross center
      - **menu_group** — 426×80 · row, gap 16, pad 0, cross center
        - **Sources** ⟵ ic_app — 80×80 · icon
        - **primary_button** — 171×68 · col, gap 4, pad 8/16, main center · r 16
          - **Title** — 139×52 · row, gap 8, pad 0, cross center
        - **Divider** — 2×32 · fill `divider/tertiary` #13141733
        - **secondary_button** — 125×68 · row, gap 8, pad 8/16, cross center · r 16
          - **FM** — 57×52 · "FM" `Title/Large/Strong` · `text/dark/primary` #131417
          - **Dropdown** ⟵ ic_dropdown › Direction=Down — 28×28 · icon `text/dark/primary` #131417 + #252525
    - **suffix** — 264×80 · row, gap 12, pad 0, cross center
      - **btn1** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn2** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn3** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
  - **segmented_control_group** — 1355×100 · row, gap 24, pad 0/24/0/0, cross center
    - **ivi_segmented_control/line** ⟵ ivi_segmented_control/line › Bottom line=True — 1331×100 · row, gap 24, pad 0/28, cross center · stroke `divider/secondary` #1314171A T0 R0 B1 L0px inside
      - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Selected, Margin=Medium — 138×100 · row, gap 0, pad 12/0, main center, cross center · stroke `text/dark/primary` #131417 T0 R0 B4 L0px inside
        - **Button** — 138×76 · row, gap 8, pad 18/14, cross center · r 12
          - **Button text** — 110×40 · "즐겨찾기" `Title/Small/Strong` · `text/dark/primary` #131417
      - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 173×100 · row, gap 0, pad 12/0, main center, cross center
        - **Button** — 173×76 · row, gap 8, pad 18/14, cross center · r 12
          - **Button text** — 145×40 · "방송국 전체" `Title/Small/Strong` · `text/dark/secondary` #131417D6
      - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 146×100 · row, gap 0, pad 12/0, main center, cross center
        - **Button** — 146×76 · row, gap 8, pad 18/14, cross center · r 12
          - **Button text** — 118×40 · "수동 조정" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Type=Phone_
  - **Title** ⟵ ivi_title › Type=Main — 1355×80 · row, gap 40, pad 0/24/0/40, main space-between, cross center
    - **title_group** — 1119×128 · row, gap 48, pad 0, cross center
      - **menu_group** — 363×80 · row, gap 16, pad 0, cross center
        - **Sources** ⟵ ic_app — 80×80 · icon
        - **primary_button** — 267×68 · col, gap 4, pad 8/16, main center · r 16
          - **Title** — 235×52 · row, gap 8, pad 0, cross center
      - **ivi_segmented_control/line** ⟵ ivi_segmented_control/line › Bottom line=False — 551×128 · row, gap 24, pad 0, cross center
        - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Selected, Margin=Large(Page Nav Only)) — 146×128 · row, gap 0, pad 26/0, main center, cross center · stroke `text/dark/primary` #131417 T0 R0 B4 L0px inside
          - **Button** — 146×76 · row, gap 8, pad 18/14, cross center · r 12
        - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Large(Page Nav Only)) — 111×128 · row, gap 0, pad 26/0, main center, cross center
          - **Button** — 111×76 · row, gap 8, pad 18/14, cross center · r 12
        - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Large(Page Nav Only)) — 111×128 · row, gap 0, pad 26/0, main center, cross center
          - **Button** — 111×76 · row, gap 8, pad 18/14, cross center · r 12
        - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Large(Page Nav Only)) — 111×128 · row, gap 0, pad 26/0, main center, cross center
          - **Button** — 111×76 · row, gap 8, pad 18/14, cross center · r 12
    - **suffix** — 172×80 · row, gap 12, pad 0, cross center
      - **btn2** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn3** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
- _Type=Phone_Segmented_control_
  - **Title** ⟵ ivi_title › Type=Main — 1355×80 · row, gap 40, pad 0/24/0/40, main space-between, cross center
    - **title_group** — 1119×80 · row, gap 48, pad 0, cross center
      - **menu_group** — 363×80 · row, gap 16, pad 0, cross center
        - **Sources** ⟵ ic_app — 80×80 · icon
        - **primary_button** — 267×68 · col, gap 4, pad 8/16, main center · r 16
          - **Title** — 235×52 · row, gap 8, pad 0, cross center
    - **suffix** — 172×80 · row, gap 12, pad 0, cross center
      - **btn2** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn3** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
  - **segmented_control_group** — 1355×100 · row, gap 24, pad 0/24/0/0, cross center
    - **ivi_segmented_control/line** ⟵ ivi_segmented_control/line › Bottom line=True — 1331×100 · row, gap 24, pad 0/28, cross center · stroke `divider/secondary` #1314171A T0 R0 B1 L0px inside
      - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Selected, Margin=Medium — 146×100 · row, gap 0, pad 12/0, main center, cross center · stroke `text/dark/primary` #131417 T0 R0 B4 L0px inside
        - **Button** — 146×76 · row, gap 8, pad 18/14, cross center · r 12
          - **Button text** — 118×40 · "최근 통화" `Title/Small/Strong` · `text/dark/primary` #131417
      - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 111×100 · row, gap 0, pad 12/0, main center, cross center
        - **Button** — 111×76 · row, gap 8, pad 18/14, cross center · r 12
          - **Button text** — 83×40 · "연락처" `Title/Small/Strong` · `text/dark/secondary` #131417D6
      - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 111×100 · row, gap 0, pad 12/0, main center, cross center
        - **Button** — 111×76 · row, gap 8, pad 18/14, cross center · r 12
          - **Button text** — 83×40 · "키패드" `Title/Small/Strong` · `text/dark/secondary` #131417D6
      - **segmented_controls/line_button** ⟵ segmented_controls/line_button › State=Enabled, Margin=Medium — 111×100 · row, gap 0, pad 12/0, main center, cross center
        - **Button** — 111×76 · row, gap 8, pad 18/14, cross center · r 12
          - **Button text** — 83×40 · "메시지" `Title/Small/Strong` · `text/dark/secondary` #131417D6
- _Type=Music ‖ Type=Music_background_
  - **Title** ⟵ ivi_title › Type=Main — 1355×80 · row, gap 40, pad 0/24/0/40, main space-between, cross center
    - **title_group** — 1027×80 · row, gap 48, pad 0, cross center
      - **menu_group** — 616×80 · row, gap 16, pad 0, cross center
        - **Sources** ⟵ ic_app — 80×80 · icon
        - **primary_button** — 183×68 · col, gap 4, pad 8/16, main center · r 16
          - **Title** — 151×52 · row, gap 8, pad 0, cross center
        - **Divider** — 2×32 · fill `divider/tertiary` #13141733
        - **secondary_button** — 303×60 · row, gap 8, pad 8/16, cross center · r 16
          - **FM** — 235×44 · "John’s iPhone" `Title/Medium/Strong` · `text/dark/primary` #FFFFFF
          - **Dropdown** ⟵ ic_dropdown › Direction=Down — 28×28 · icon `text/dark/primary` #131417 + #252525
    - **suffix** — 264×80 · row, gap 12, pad 0, cross center
      - **btn1** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn2** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
      - **btn3** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525

#### `ivi_title`

- Variant 축: **Type** (Main / Depth / Search)
- 속성: App (bool, 기본 true), Description Label (text, 기본 "Adjust the side mirrors using the left controls."), Description (bool, 기본 false), Source Label (text, 기본 "Title"), Band Label (text, 기본 "FM"), Secondary Menu (bool, 기본 true), Segmented control (bool, 기본 false), Btn1 (bool, 기본 true), Btn2 (bool, 기본 true), Btn3 (bool, 기본 true), Suffix (bool, 기본 true)
- 바인딩된 사이즈 토큰 그룹: `buttons/icon/medium/*`, `fields/text/medium/*`, `fields/text/small/*`, `line/*`, `page_navigation/*`, `page_navigation/title/*`, `page_navigation/title/app_icon/*`, `page_navigation/title/dropdown_menu_pressed/*`, `tabs/line/*`, `tabs/line/button/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Main | 988×80 | row, gap 24, pad 0/24/0/40, cross center |  |  |  |  |
| Type=Depth | 988×80 | row, gap 24, pad 0/24/0/40, cross center |  |  |  |  |
| Type=Search | 988×100 | row, gap 24, pad 0/24/0/40, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Main_
  - **title_group** — 636×80 · row, gap 48, pad 0, cross center
    - **menu_group** — 404×80 · row, gap 16, pad 0, cross center
      - **ic_app** — 80×80 · icon `divider/secondary` #1314171A + #FFFFFF
      - **primary_button** — 149×68 · col, gap 4, pad 8/16, main center · r 16
        - **Title** — 117×52 · row, gap 8, pad 0, cross center
          - **Title** — 81×52 · "Title" `Title/Large/Strong` · `text/dark/primary` #131417
          - **Icon** ⟵ ic_dropdown › Direction=Down — 28×28 · icon `text/dark/primary` #131417 + #252525
      - **Divider** — 2×32 · fill `divider/tertiary` #13141733
      - **secondary_button** — 125×68 · row, gap 8, pad 8/16, cross center · r 16
        - **FM** — 57×52 · "FM" `Title/Large/Strong` · `text/dark/primary` #131417
        - **Icon** ⟵ ic_dropdown › Direction=Down — 28×28 · icon `text/dark/primary` #131417 + #252525
  - **suffix** — 264×80 · row, gap 12, pad 0, cross center
    - **btn1** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
      - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
    - **btn2** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
      - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
    - **btn3** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
      - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
- _Type=Depth_
  - **Title** — 636×56 · row, gap 24, pad 0, cross center
    - **ic_arrow** ⟵ ic_arrow › Direction=left — 56×56 · icon `icon/dark/primary` #131417
    - **Title** — 556×56 · col, gap 4, pad 0, main center
      - **Title** — 556×52 · "Title" `Title/Large/Strong` · `text/dark/primary` #131417
  - **suffix** — 264×80 · row, gap 12, pad 0, cross center
    - **btn1** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
      - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
    - **btn2** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
      - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
    - **btn3** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
      - **ic_plus** ⟵ ic_more › Type=Horizontal — 56×56 · icon `icon/dark/primary` #131417 + #252525
- _Type=Search_
  - **Title** — 820×100 · row, gap 24, pad 0, cross center
    - **ic_arrow** ⟵ ic_arrow › Direction=left — 56×56 · icon `icon/dark/primary` #131417
    - **Title** — 740×100 · col, gap 4, pad 0/26/0/0, main center
      - **ivi_text_field** ⟵ ivi_text_field › Size=Medium, State=Enabled — 714×100 · col, gap 16, pad 0, main center
        - **Text Fields** — 714×100 · row, gap 16, pad 0/32, cross center · r 24 · fill `field/background` #FFFFFF · stroke `divider/secondary` #1314171A 2px inside
          - **Place holder** — 650×44 · "Place holder" `Title/Medium/Normal` · `text/dark/tertiary` #131417A3
  - **ivi_icon_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
    - **ic_plus** ⟵ ic_close › Type=Basic — 56×56 · icon `icon/dark/primary` #131417

### Popup

#### `ivi_system_popup`

- Variant 축: **Extended** (False / True) · **Size** (Medium / Large)
- 바인딩된 사이즈 토큰 그룹: `buttons/basic/large/*`, `buttons/icon/medium/*`, `fields/text/medium/*`, `fields/text/small/*`, `popup/system/*`, `popup/system/list/item/*`, `spinner/*`, `spinner/panel/*`, `spinner/wheel/*`, `vehicle_settings/list/*`, `vehicle_settings/list/item/*`, `vehicle_settings/list/item/container/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium, Extended=False | 808×366 | col, gap 40, pad 48, main center, cross center | 48 | `background/popup` #FFFFFF | `divider/primary` #1314170D 2px inside |  |
| Size=Large, Extended=False | 1200×366 | col, gap 40, pad 48, main center, cross center | 48 | `background/popup` #FFFFFF | `divider/primary` #1314170D 2px inside |  |
| Size=Medium, Extended=True | 720×308 | col, gap 33, pad 40, main center, cross center | 40 | `background/popup` #FFFFFF | `divider/primary` #1314170D 2px inside |  |
| Size=Large, Extended=True | 1000×308 | col, gap 33, pad 40, main center, cross center | 40 | `background/popup` #FFFFFF | `divider/primary` #1314170D 2px inside |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium, Extended=False_
  - **system_popup/header** ⟵ system_popup/header › Size=Medium — 712×130 · col, gap 0, pad 0/0/16/0, main center, cross center
    - **Title** — 712×114 · col, gap 24, pad 0, main center, cross center
      - **Title** — 712×52 · "Title" `Title/Large/Extra_Strong` · `text/dark/primary` #131417
      - **Description** — 712×38 · "Description" `Body/Large/Normal` · `text/dark/secondary` #131417D6
  - **system_popup/buttons** ⟵ system_popup/buttons › Type=Horizontal — 712×100 · row, gap 24, pad 0, main center, cross center
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Large, State=Enabled — 344×100 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/filled/enabled` #44464E
      - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/light/primary` #FFFFFF
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Large, State=Enabled — 344×100 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/basic/enabled` #1314170D
      - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
- _Size=Large, Extended=False_
  - **system_popup/header** ⟵ system_popup/header › Size=Large — 1104×130 · col, gap 0, pad 0/0/16/0, main center, cross center
    - **Title** — 1104×114 · col, gap 24, pad 0/32, main center, cross center
      - **Title** — 1040×52 · "Title" `Title/Large/Extra_Strong` · `text/dark/primary` #131417
      - **Description** — 1040×38 · "Description" `Body/Large/Normal` · `text/dark/secondary` #131417D6
  - **system_popup/buttons** ⟵ system_popup/buttons › Type=Horizontal — 1104×100 · row, gap 24, pad 0, main center, cross center
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Large, State=Enabled — 540×100 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/filled/enabled` #44464E
      - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/light/primary` #FFFFFF
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Large, State=Enabled — 540×100 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/basic/enabled` #1314170D
      - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
- _Size=Medium, Extended=True_
  - **system_popup/header** ⟵ system_popup/header › Size=Medium — 640×111 · col, gap 0, pad 0/0/12/0, main center, cross center
    - **Title** — 640×99 · col, gap 24, pad 0, main center, cross center
      - **Title** — 640×43 · "Title" `Title/Large/Extra_Strong` · `text/dark/primary` #131417
      - **Description** — 640×32 · "Description" `Body/Large/Normal` · `text/dark/secondary` #131417D6
  - **system_popup/buttons** ⟵ system_popup/buttons › Type=Horizontal — 640×84 · row, gap 24, pad 0, main center, cross center
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Large, State=Enabled — 308×84 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/filled/enabled` #44464E
      - **Label** — 68×33 · "Label" `Title/Small/Strong` · `text/light/primary` #FFFFFF
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Large, State=Enabled — 308×84 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/basic/enabled` #1314170D
      - **Label** — 68×33 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417
- _Size=Large, Extended=True_
  - **system_popup/header** ⟵ system_popup/header › Size=Large — 920×111 · col, gap 0, pad 0/0/12/0, main center, cross center
    - **Title** — 920×99 · col, gap 24, pad 0/32, main center, cross center
      - **Title** — 866×43 · "Title" `Title/Large/Extra_Strong` · `text/dark/primary` #131417
      - **Description** — 866×32 · "Description" `Body/Large/Normal` · `text/dark/secondary` #131417D6
  - **system_popup/buttons** ⟵ system_popup/buttons › Type=Horizontal — 920×84 · row, gap 24, pad 0, main center, cross center
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Large, State=Enabled — 448×84 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/filled/enabled` #44464E
      - **Label** — 68×33 · "Label" `Title/Small/Strong` · `text/light/primary` #FFFFFF
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Large, State=Enabled — 448×84 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/basic/enabled` #1314170D
      - **Label** — 68×33 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417

#### `system_popup/header`

- Variant 축: **Size** (Medium / Large)
- 속성: has Title (bool, 기본 true), Description (text, 기본 "Description"), Close btn (bool, 기본 false), has Description (bool, 기본 true), has Subtitle (bool, 기본 false), Subtitle (text, 기본 "Subtitle"), has Icon (bool, 기본 true), Title (text, 기본 "Title"), has Title Group (bool, 기본 true)
- 바인딩된 사이즈 토큰 그룹: `popup/system/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Size=Medium | 680×234 | col, gap 0, pad 0/0/16/0, main center, cross center |  |  |  |  |
| Size=Large | 680×234 | col, gap 0, pad 0/0/16/0, main center, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Size=Medium_
  - **Title** — 680×218 · col, gap 24, pad 0, main center, cross center
    - **ic_annotation** ⟵ ic_annotation › Type=alert — 80×80 · icon `icon/dark/secondary` #1B1C1ECC
    - **Title** — 680×52 · "Title" `Title/Large/Extra_Strong` · `text/dark/primary` #131417
    - **Description** — 680×38 · "Description" `Body/Large/Normal` · `text/dark/secondary` #131417D6
- _Size=Large_
  - **Title** — 680×218 · col, gap 24, pad 0/32, main center, cross center
    - **ic_annotation** ⟵ ic_annotation › Type=alert — 80×80 · icon `icon/dark/secondary` #1B1C1ECC
    - **Title** — 616×52 · "Title" `Title/Large/Extra_Strong` · `text/dark/primary` #131417
    - **Description** — 616×38 · "Description" `Body/Large/Normal` · `text/dark/secondary` #131417D6

#### `system_popup/buttons`

- Variant 축: **Type** (Horizontal / Vertical)
- 바인딩된 사이즈 토큰 그룹: `buttons/basic/large/*`, `popup/system/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Horizontal | 760×100 | row, gap 24, pad 0, main center, cross center |  |  |  |  |
| Type=Vertical | 760×224 | col, gap 24, pad 0, main center, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Horizontal ‖ Type=Vertical_
  - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Large, State=Enabled — 368×100 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/filled/enabled` #44464E
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/light/primary` #FFFFFF
  - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Large, State=Enabled — 368×100 · row, gap 16, pad 16/40, main center, cross center · r 32 · fill `button/basic/enabled` #1314170D
    - **Label** — 80×40 · "Label" `Title/Small/Strong` · `text/dark/primary` #131417

#### `system_popup/content`
- 바인딩된 사이즈 토큰 그룹: `buttons/icon/medium/*`, `fields/text/medium/*`, `fields/text/small/*`, `popup/system/*`, `popup/system/list/item/*`, `spinner/*`, `spinner/panel/*`, `spinner/wheel/*`, `vehicle_settings/list/*`, `vehicle_settings/list/item/*`, `vehicle_settings/list/item/container/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| (single) | 680×496 | col, gap 24, pad 0, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _system_popup/content_
  - **vehicle_setting_popup_content/List** ⟵ vehicle_setting_popup_content/List › Type=Hug — 680×496 · col, gap 0, pad 24/20 · r 32 · fill `dim/dark/primary` #1314170D
    - **vehicle_setting_popup_content/List/item** ⟵ vehicle_setting_popup_content/List/item › State=Enabled — 640×112 · row, gap 0, pad 16/20, cross center · r 24
      - **prefix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_menu › Type=2 — 56×56 · icon `icon/dark/primary` #131417
      - **Label** — 440×38 · col, gap 4, pad 0/16, main center
        - **Profile name 1** — 448×38 · "Profile name 1" `Body/Large/Strong` · `text/dark/primary` #131417
      - **suffix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_trash — 56×56 · icon `icon/dark/secondary` #131417D6
    - **vehicle_setting_popup_content/List/item** ⟵ vehicle_setting_popup_content/List/item › State=Enabled — 640×112 · row, gap 0, pad 16/20, cross center · r 24
      - **prefix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_menu › Type=2 — 56×56 · icon `icon/dark/primary` #131417
      - **Label** — 440×38 · col, gap 4, pad 0/16, main center
        - **Profile name 1** — 448×38 · "Profile name 2" `Body/Large/Strong` · `text/dark/primary` #131417
      - **suffix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_trash — 56×56 · icon `icon/dark/secondary` #131417D6
    - **vehicle_setting_popup_content/List/item** ⟵ vehicle_setting_popup_content/List/item › State=Enabled — 640×112 · row, gap 0, pad 16/20, cross center · r 24
      - **prefix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_menu › Type=2 — 56×56 · icon `icon/dark/primary` #131417
      - **Label** — 440×38 · col, gap 4, pad 0/16, main center
        - **Profile name 1** — 448×38 · "Profile name 3" `Body/Large/Strong` · `text/dark/primary` #131417
      - **suffix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_trash — 56×56 · icon `icon/dark/secondary` #131417D6
    - **vehicle_setting_popup_content/List/item** ⟵ vehicle_setting_popup_content/List/item › State=Enabled — 640×112 · row, gap 0, pad 16/20, cross center · r 24
      - **prefix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_menu › Type=2 — 56×56 · icon `icon/dark/primary` #131417
      - **Label** — 440×38 · col, gap 4, pad 0/16, main center
        - **Profile name 1** — 448×38 · "Profile name 4" `Body/Large/Strong` · `text/dark/primary` #131417
      - **suffix_button** ⟵ ivi_icon_button › Type=Plain, State=Enabled, Size=Medium — 80×80 · row, gap 0, pad 0, main center, cross center · r 20
        - **ic_plus** ⟵ ic_trash — 56×56 · icon `icon/dark/secondary` #131417D6

#### `ivi_toast_popup`

- Variant 축: **Margin(Default)** (on / off)
- 속성: Message (text, 기본 "Toast Message"), App Icon (bool, 기본 false), Icon (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `line/*`, `popup/system/*`, `popup/toast/*`, `radius/bottom_left/*`, `radius/bottom_right/*`, `radius/top_left/*`, `radius/top_right/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Margin(Default)=off | 261×82 | row, gap 16, pad 24/40, cross center | 16 | `basic/600` #44464E |  |  |
| Margin(Default)=on | 309×106 | col, gap 0, pad 0/24/24/24, main end, cross center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Margin(Default)=off_
  - **Toast Message** — 181×34 · "Toast Message" `Body/Small/Strong` · `basic/00` #FFFFFF
- _Margin(Default)=on_
  - **toast_container** — 261×82 · row, gap 16, pad 24/40, cross center · r 16 · fill `basic/600` #44464E
    - **Toast Message** — 181×34 · "Toast Message" `Body/Small/Strong` · `basic/00` #FFFFFF

### System Notification

#### `ivi_notification_system`

- Variant 축: **Type** (Image+Text / Only Text / Call)
- 속성: Title (text, 기본 "Title"), Description (text, 기본 "Description"), has Image (bool, 기본 true)
- 바인딩된 사이즈 토큰 그룹: `buttons/basic/medium/*`, `notification/*`, `notification/system/*`, `notification/system/images/*`, `notification/system/profile/*`, `os_notification/container/*`, `os_notification/contents/*`, `radius/bottom_left/*`, `radius/bottom_right/*`, `radius/top_left/*`, `radius/top_right/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Image+Text | 700×276 | col, gap 0, pad 0 | 48 | `gleo/Olf/surface_primary` #FFFFFF | `divider/secondary` #1314171A 1px inside | Shadow/Light/Level3 |
| Type=Only Text | 700×270 | col, gap 0, pad 0 | 48 | `gleo/Olf/surface_primary` #FFFFFF | `divider/secondary` #1314171A 1px inside | Shadow/Light/Level3 |
| Type=Call | 700×276 | col, gap 0, pad 0 | 48 | `gleo/Olf/surface_primary` #FFFFFF | `divider/secondary` #1314171A 1px inside | Shadow/Light/Level3 |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Image+Text_
  - **Header** — 700×148 · row, gap 24, pad 32/32/16/32
    - **system_notification/images** ⟵ system_notification/images › Type=Image — 100×100 · row, gap 0, pad 0, main center, cross center · r 24
      - **imagery_image** ⟵ imagery_image › Type=Image — 100×100 · icon `button/basic/enabled` #1314170D + `icon/dark/quaternary` #13141752
    - **text_group** — 512×94 · col, gap 12, pad 4/0, main center
      - **Title** — 512×44 · "Title" `Title/Medium/Extra_Strong` · `text/dark/primary` #131417
      - **Description** — 512×34 · "Description" `Body/Small/Normal` · `text/dark/tertiary` #131417A3
  - **system_notification/button** ⟵ system_notification/button › Type=Horizontal — 700×128 · row, gap 16, pad 24, main center
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Medium, State=Enabled — 318×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `button/filled/enabled` #44464E
      - **Label** — 75×38 · "CTA" `Body/Large/Strong` · `text/light/primary` #FFFFFF
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 318×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `button/basic/enabled` #1314170D
      - **Label** — 75×38 · "Sub action" `Body/Large/Strong` · `text/dark/primary` #131417
- _Type=Only Text_
  - **Header** — 700×142 · row, gap 24, pad 32/32/16/32
    - **text_group** — 636×94 · col, gap 12, pad 4/8, main center
      - **Title** — 620×44 · "Title" `Title/Medium/Extra_Strong` · `text/dark/primary` #131417
      - **Description** — 620×34 · "Description" `Body/Small/Normal` · `text/dark/tertiary` #131417A3
  - **system_notification/button** ⟵ system_notification/button › Type=Horizontal — 700×128 · row, gap 16, pad 24, main center
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Medium, State=Enabled — 318×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `button/filled/enabled` #44464E
      - **Label** — 75×38 · "CTA" `Body/Large/Strong` · `text/light/primary` #FFFFFF
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 318×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `button/basic/enabled` #1314170D
      - **Label** — 75×38 · "Sub action" `Body/Large/Strong` · `text/dark/primary` #131417
- _Type=Call_
  - **Header** — 700×148 · row, gap 24, pad 32/32/16/32
    - **system_notification/images** ⟵ system_notification/images › Type=Profile — 100×100 · row, gap 0, pad 0, main center, cross center
      - **imagery_profile** ⟵ imagery_profile › Fill=true, New=false — 100×100 · icon
      - **ic_app** — 48×48 · icon `divider/secondary` #1314171A + #30CF72
    - **text_group** — 512×94 · col, gap 12, pad 4/0, main center
      - **010-1234-5678** — 512×44 · "010-1234-5678" `Title/Medium/Extra_Strong` · `text/dark/primary` #131417
      - **전화 수신 중** — 512×34 · "전화 수신 중" `Body/Small/Normal` · `text/dark/tertiary` #131417A3
  - **system_notification/button** ⟵ system_notification/button › Type=Call — 700×128 · row, gap 16, pad 24, main center
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 318×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `phone/accept_normal` #32B957
      - **Label** — 75×38 · "받기" `Body/Large/Strong` · `text/light/primary` #FFFFFF
    - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 318×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `phone/end_normal` #FE3D16
      - **Label** — 75×38 · "거절" `Body/Large/Strong` · `text/light/primary` #FFFFFF

#### `system_notification/button`

- Variant 축: **Type** (Single / Horizontal / Vertical / Call)
- 바인딩된 사이즈 토큰 그룹: `buttons/basic/medium/*`, `notification/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Single | 1404.5×128 | row, gap 0, pad 24, main center |  |  |  |  |
| Type=Vertical | 1404.5×224 | col, gap 16, pad 24, main center |  |  |  |  |
| Type=Horizontal | 1404.5×128 | row, gap 16, pad 24, main center |  |  |  |  |
| Type=Call | 1404.5×128 | row, gap 16, pad 24, main center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Single_
  - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 1356.5×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `button/basic/enabled` #1314170D
    - **Label** — 56×38 · "CTA" `Body/Large/Strong` · `text/dark/primary` #131417
- _Type=Vertical ‖ Type=Horizontal_
  - **ivi_basic_button** ⟵ ivi_basic_button › Type=Secondary, Size=Medium, State=Enabled — 1356.5×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `button/filled/enabled` #44464E
    - **Label** — 56×38 · "CTA" `Body/Large/Strong` · `text/light/primary` #FFFFFF
  - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 1356.5×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `button/basic/enabled` #1314170D
    - **Label** — 149×38 · "Sub action" `Body/Large/Strong` · `text/dark/primary` #131417
- _Type=Call_
  - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 670.3×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `phone/accept_normal` #32B957
    - **Label** — 52×38 · "받기" `Body/Large/Strong` · `text/light/primary` #FFFFFF
  - **ivi_basic_button** ⟵ ivi_basic_button › Type=Primary, Size=Medium, State=Enabled — 670.3×80 · row, gap 14, pad 16/32, main center, cross center · r 24 · fill `phone/end_normal` #FE3D16
    - **Label** — 52×38 · "거절" `Body/Large/Strong` · `text/light/primary` #FFFFFF

#### `system_notification/images`

- Variant 축: **Type** (App / Profile / Image)
- 바인딩된 사이즈 토큰 그룹: `line/*`, `notification/system/*`, `notification/system/images/*`, `notification/system/profile/*`, `os_notification/contents/*`, `radius/bottom_left/*`, `radius/bottom_right/*`, `radius/top_left/*`, `radius/top_right/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=App | 100×100 | row, gap 0, pad 0, main center, cross center | 24 |  |  |  |
| Type=Profile | 100×100 | row, gap 0, pad 0, main center, cross center |  |  |  |  |
| Type=Image | 100×100 | row, gap 0, pad 0, main center, cross center | 24 |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=App_
  - **img_app** ⟵ ic_app — 100×100 · icon #000000
- _Type=Profile_
  - **imagery_profile** ⟵ imagery_profile › Fill=true, New=false — 100×100 · icon
  - **ic_app** — 48×48 · icon `divider/secondary` #1314171A + #30CF72
- _Type=Image_
  - **imagery_image** ⟵ imagery_image › Type=Image — 100×100 · icon `button/basic/enabled` #1314170D + `icon/dark/quaternary` #13141752

### Spinner

#### `ivi_spinner`

- Variant 축: **Size** (Large / Medium) · **Type** (Date / Time)
- 바인딩된 사이즈 토큰 그룹: `spinner/*`, `spinner/panel/*`, `spinner/wheel/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Date, Size=Large | 540×384 | col, gap 0, pad 0/16, main center, cross center | 32 | `background/primary` #F7F8FA |  |  |
| Type=Time, Size=Large | 480×384 | col, gap 0, pad 0/16, main center, cross center | 32 | `background/primary` #F7F8FA |  |  |
| Type=Date, Size=Medium | 540×288 | col, gap 0, pad 0/16, main center, cross center | 32 | `background/primary` #F7F8FA |  |  |
| Type=Time, Size=Medium | 480×288 | col, gap 0, pad 0/16, main center, cross center | 32 | `background/primary` #F7F8FA |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Date, Size=Large_
  - **Top** — 508×60 · row, gap 20, pad 0, main center, cross end
    - **10** — 110×88 · "10" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **23** — 110×88 · "23" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **2022** — 200×88 · "2022" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Prev** — 508×88 · row, gap 20, pad 0, main center, cross center
    - **11** — 110×88 · "11" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **24** — 110×88 · "24" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **2023** — 200×88 · "2023" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Focused** — 508×88 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
    - **12** — 110×88 · "12" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **25** — 110×88 · "25" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **2024** — 200×88 · "2024" `Headline/Large/Strong` · `text/dark/primary` #131417
  - **Next** — 508×88 · row, gap 20, pad 0, main center, cross center
    - **1** — 110×88 · "1" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **26** — 110×88 · "26" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **2025** — 200×88 · "2025" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Bottom** — 508×60 · row, gap 20, pad 0, main center
    - **2** — 110×88 · "2" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **27** — 110×88 · "27" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **2026** — 200×88 · "2026" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Mask-top** — 540×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
  - **Mask-bottm** — 540×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)
- _Type=Time, Size=Large_
  - **Top** — 448×60 · row, gap 20, pad 0, main center, cross end
    - **6** — 110×88 · "6" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **58** — 110×88 · "58" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Empty frame** — 140×88
  - **Prev** — 448×88 · row, gap 20, pad 0, main center, cross center
    - **7** — 110×88 · "7" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **59** — 110×88 · "59" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **AM** — 140×88 · "AM" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Focused** — 448×88 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
    - **8** — 110×88 · "8" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **00** — 110×88 · "00" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **PM** — 140×88 · "PM" `Headline/Large/Strong` · `text/dark/primary` #131417
  - **Next** — 448×88 · row, gap 20, pad 0, main center, cross center
    - **9** — 110×88 · "9" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **01** — 110×88 · "01" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Empty frame** — 140×88
  - **Bottom** — 448×60 · row, gap 20, pad 0, main center
    - **10** — 110×88 · "10" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **02** — 110×88 · "02" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Empty frame** — 140×88
  - **Mask-top** — 480×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
  - **Mask-bottm** — 480×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)
- _Type=Date, Size=Medium_
  - **Prev** — 508×96 · row, gap 20, pad 0, main center, cross center
    - **11** — 110×88 · "11" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **24** — 110×88 · "24" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **2023** — 200×88 · "2023" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Center** — 508×96 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
    - **12** — 110×88 · "12" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **25** — 110×88 · "25" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **2024** — 200×88 · "2024" `Headline/Large/Strong` · `text/dark/primary` #131417
  - **Next** — 508×96 · row, gap 20, pad 0, main center, cross center
    - **1** — 110×88 · "1" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **26** — 110×88 · "26" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **2025** — 200×88 · "2025" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Mask-top** — 540×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
  - **Mask-bottm** — 540×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)
- _Type=Time, Size=Medium_
  - **Prev** — 448×96 · row, gap 20, pad 0, main center, cross center
    - **7** — 110×88 · "7" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **59** — 110×88 · "59" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **AM** — 140×88 · "AM" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
  - **Focused** — 448×96 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
    - **8** — 110×88 · "8" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **00** — 110×88 · "00" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **PM** — 140×88 · "PM" `Headline/Large/Strong` · `text/dark/primary` #131417
  - **Next** — 448×96 · row, gap 20, pad 0, main center, cross center
    - **9** — 110×88 · "9" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **01** — 110×88 · "01" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Empty frame** — 140×96
  - **Mask-top** — 480×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
  - **Mask-bottm** — 480×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)

#### `spinner_wheels`

- Variant 축: **Type** (Date / Time / Date+Time)
- 속성: Title (bool, 기본 false)
- 바인딩된 사이즈 토큰 그룹: `size_sp/*`, `spinner/*`, `spinner/panel/*`, `spinner/wheel/*`

| Variant | W×H | Layout | Radius | Fill | Stroke | Effect |
|---|---|---|---|---|---|---|
| Type=Date | 540×384 | col, gap 16, pad 0 |  |  |  |  |
| Type=Time | 480×384 | col, gap 16, pad 0 |  |  |  |  |
| Type=Date+Time | 1104×384 | row, gap 24, pad 0, main center |  |  |  |  |

구성 레이어 (색·스타일이 같은 Variant는 묶음):

- _Type=Date_
  - **ivi_spinner** ⟵ ivi_spinner › Type=Date, Size=Large — 540×384 · col, gap 0, pad 0/16, main center, cross center · r 32 · fill `background/primary` #F7F8FA
    - **Top** — 508×60 · row, gap 20, pad 0, main center, cross end
      - **10** — 110×88 · "10" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **23** — 110×88 · "23" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **2022** — 200×88 · "2022" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Prev** — 508×88 · row, gap 20, pad 0, main center, cross center
      - **11** — 110×88 · "11" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **24** — 110×88 · "24" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **2023** — 200×88 · "2023" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Focused** — 508×88 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
      - **12** — 110×88 · "12" `Headline/Large/Strong` · `text/dark/primary` #131417
      - **25** — 110×88 · "25" `Headline/Large/Strong` · `text/dark/primary` #131417
      - **2024** — 200×88 · "2024" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **Next** — 508×88 · row, gap 20, pad 0, main center, cross center
      - **1** — 110×88 · "1" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **26** — 110×88 · "26" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **2025** — 200×88 · "2025" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Bottom** — 508×60 · row, gap 20, pad 0, main center
      - **2** — 110×88 · "2" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **27** — 110×88 · "27" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **2026** — 200×88 · "2026" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
    - **Mask-top** — 540×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
    - **Mask-bottm** — 540×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)
- _Type=Time_
  - **ivi_spinner** ⟵ ivi_spinner › Type=Time, Size=Large — 480×384 · col, gap 0, pad 0/16, main center, cross center · r 32 · fill `background/primary` #F7F8FA
    - **Top** — 448×60 · row, gap 20, pad 0, main center, cross end
      - **6** — 110×88 · "6" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
      - **58** — 110×88 · "58" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **Empty frame** — 140×88
    - **Prev** — 448×88 · row, gap 20, pad 0, main center, cross center
      - **7** — 110×88 · "7" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
      - **59** — 110×88 · "59" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
      - **AM** — 140×88 · "AM" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
    - **Focused** — 448×88 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
      - **8** — 110×88 · "8" `Headline/Large/Strong` · `text/dark/primary` #131417
      - **00** — 110×88 · "00" `Headline/Large/Strong` · `text/dark/primary` #131417
      - **PM** — 140×88 · "PM" `Headline/Large/Strong` · `text/dark/primary` #131417
    - **Next** — 448×88 · row, gap 20, pad 0, main center, cross center
      - **9** — 110×88 · "9" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
      - **01** — 110×88 · "01" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
      - **Empty frame** — 140×88
    - **Bottom** — 448×60 · row, gap 20, pad 0, main center
      - **10** — 110×88 · "10" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
      - **02** — 110×88 · "02" `Headline/Small/Extra_Strong` · `text/dark/quaternary` #13141752
      - **Empty frame** — 140×88
    - **Mask-top** — 480×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
    - **Mask-bottm** — 480×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)
- _Type=Date+Time_
  - **Date** — 540×384 · col, gap 16, pad 0
    - **ivi_spinner** ⟵ ivi_spinner › Type=Date, Size=Large — 540×384 · col, gap 0, pad 0/16, main center, cross center · r 32 · fill `background/primary` #F7F8FA
      - **Top** — 508×60 · row, gap 20, pad 0, main center, cross end
        - **10** — 110×88 · "10" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **23** — 110×88 · "23" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **2022** — 200×88 · "2022" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **Prev** — 508×88 · row, gap 20, pad 0, main center, cross center
        - **11** — 110×88 · "11" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **24** — 110×88 · "24" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **2023** — 200×88 · "2023" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **Focused** — 508×88 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
        - **12** — 110×88 · "12" `Headline/Large/Strong` · `text/dark/primary` #131417
        - **25** — 110×88 · "25" `Headline/Large/Strong` · `text/dark/primary` #131417
        - **2024** — 200×88 · "2024" `Headline/Large/Strong` · `text/dark/primary` #131417
      - **Next** — 508×88 · row, gap 20, pad 0, main center, cross center
        - **1** — 110×88 · "1" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **26** — 110×88 · "26" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **2025** — 200×88 · "2025" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **Bottom** — 508×60 · row, gap 20, pad 0, main center
        - **2** — 110×88 · "2" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **27** — 110×88 · "27" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **2026** — 200×88 · "2026" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **Mask-top** — 540×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
      - **Mask-bottm** — 540×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)
  - **Time** — 540×384 · col, gap 16, pad 0
    - **ivi_spinner** ⟵ ivi_spinner › Type=Time, Size=Large — 540×384 · col, gap 0, pad 0/16, main center, cross center · r 32 · fill `background/primary` #F7F8FA
      - **Top** — 508×60 · row, gap 20, pad 0, main center, cross end
        - **6** — 110×88 · "6" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **58** — 110×88 · "58" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **Empty frame** — 140×88
      - **Prev** — 508×88 · row, gap 20, pad 0, main center, cross center
        - **7** — 110×88 · "7" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **59** — 110×88 · "59" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **AM** — 140×88 · "AM" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
      - **Focused** — 508×88 · row, gap 20, pad 0, main center, cross center · r 24 · fill `dim/dark/primary` #1314170D
        - **8** — 110×88 · "8" `Headline/Large/Strong` · `text/dark/primary` #131417
        - **00** — 110×88 · "00" `Headline/Large/Strong` · `text/dark/primary` #131417
        - **PM** — 140×88 · "PM" `Headline/Large/Strong` · `text/dark/primary` #131417
      - **Next** — 508×88 · row, gap 20, pad 0, main center, cross center
        - **9** — 110×88 · "9" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **01** — 110×88 · "01" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **Empty frame** — 140×88
      - **Bottom** — 508×60 · row, gap 20, pad 0, main center
        - **10** — 110×88 · "10" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **02** — 110×88 · "02" `Headline/Small/Strong` · `text/dark/quaternary` #13141752
        - **Empty frame** — 140×88
      - **Mask-top** — 540×60 · fill linear-gradient(#F7F8FA 0%, #F7F8FA00 100%)
      - **Mask-bottm** — 540×60 · fill linear-gradient(#F7F8FA00 0%, #F7F8FA 100%)


## 2. 컴포넌트 사이즈 토큰 — 폼팩터 4종

`form_factor` 변수 컬렉션(design assets 파일). 네 모서리 반경 토큰(`radius_top_left` 등)은 값이 같아 `radius_*` 한 줄로 합쳤습니다. 원문 철자(`icon_sqaure`, `gap_samll` 등)는 그대로입니다.

### `app_market/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `app_market/header/title/height` | 80 | 70 | 66 | 85 |

### `bars/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `bars/app_control/container_height` | 60 | 53 | 100 | 128 |
| `bars/app_control/container_width` | 320 | 282 | 266 | 340 |
| `bars/app_control/handle_height` | 8 | 7 | 8 | 9 |
| `bars/app_control/handle_width_normal` | 140 | 123 | 116 | 148 |
| `bars/app_control/padding_top` | 16 | 14 | 14 | 17 |
| `bars/page_scroll/min_height` | 48 | 42 | 40 | 51 |
| `bars/page_scroll/width` | 6 | 5 | 6 | 6 |
| `bars/radius_*` | 999 | 999 | 999 | 999 |

### `buttons/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `buttons/basic/disabled_border` | 2 | 2 | 2 | 3 |
| `buttons/basic/large/gap_horizontal` | 16 | 14 | 14 | 17 |
| `buttons/basic/large/height` | 100 | 88 | 84 | 106 |
| `buttons/basic/large/icon_sqaure` | 52 | 46 | 43 | 55 |
| `buttons/basic/large/min_width` | 140 | 123 | 116 | 148 |
| `buttons/basic/large/padding_horizontal` | 40 | 35 | 34 | 42 |
| `buttons/basic/large/padding_vertical` | 16 | 14 | 14 | 17 |
| `buttons/basic/large/radius_*` | 32 | 28 | 27 | 35 |
| `buttons/basic/medium/gap_horizontal` | 14 | 12 | 12 | 15 |
| `buttons/basic/medium/height` | 80 | 70 | 66 | 84 |
| `buttons/basic/medium/icon_sqaure` | 40 | 35 | 33 | 42 |
| `buttons/basic/medium/min_width` | 120 | 106 | 100 | 128 |
| `buttons/basic/medium/padding_horizontal` | 32 | 28 | 27 | 35 |
| `buttons/basic/medium/padding_vertical` | 16 | 14 | 14 | 17 |
| `buttons/basic/medium/radius_*_medium` | 24 | 21 | 20 | 26 |
| `buttons/basic/small/gap_horizontal` | 12 | 11 | 10 | 13 |
| `buttons/basic/small/height` | 64 | 56 | 54 | 68 |
| `buttons/basic/small/icon_sqaure` | 32 | 28 | 27 | 35 |
| `buttons/basic/small/min_width` | 100 | 88 | 84 | 106 |
| `buttons/basic/small/padding_horizontal` | 24 | 21 | 20 | 26 |
| `buttons/basic/small/padding_vertical` | 8 | 7 | 8 | 10 |
| `buttons/basic/small/radius_*` | 16 | 14 | 13 | 17 |
| `buttons/icon/circle_radius_*` | 999 | 999 | 999 | 999 |
| `buttons/icon/medium/content` | 56 | 49 | 46 | 59 |
| `buttons/icon/medium/height` | 80 | 70 | 66 | 84 |
| `buttons/icon/medium/rounded_radius_*` | 20 | 18 | 17 | 22 |
| `buttons/icon/medium/width` | 80 | 70 | 66 | 84 |
| `buttons/icon/small/content` | 44 | 39 | 37 | 49 |
| `buttons/icon/small/height` | 64 | 56 | 54 | 68 |
| `buttons/icon/small/rounded_radius_*` | 16 | 14 | 13 | 17 |
| `buttons/icon/small/rounded_radius_*` | 16 | 14 | 1613 | 17 |
| `buttons/icon/small/width` | 64 | 56 | 54 | 68 |
| `buttons/keypad/border` | 4 | 4 | 3 | 4 |
| `buttons/keypad/height` | 108 | 95 | 80 | 116 |
| `buttons/keypad/icon` | 48 | 42 | 40 | 51 |
| `buttons/keypad/min_width` | 200 | 176 | 166 | 212 |
| `buttons/keypad/radius_*` | 32 | 28 | 27 | 35 |
| `buttons/text/medium/gap` | 8 | 7 | 8 | 9 |
| `buttons/text/medium/icon` | 32 | 28 | 27 | 35 |
| `buttons/text/small/gap` | 4 | 4 | 4 | 4 |
| `buttons/text/small/icon` | 28 | 25 | 23 | 29 |
| `buttons/toggle/disabled_border` | 2 | 2 | 2 | 3 |
| `buttons/toggle/large/gap_horizontal` | 16 | 14 | 14 | 17 |
| `buttons/toggle/large/height` | 100 | 88 | 84 | 106 |
| `buttons/toggle/large/icon_sqaure` | 52 | 46 | 43 | 55 |
| `buttons/toggle/large/min_width` | 140 | 123 | 116 | 148 |
| `buttons/toggle/large/padding_horizontal` | 40 | 35 | 34 | 42 |
| `buttons/toggle/large/padding_vertical` | 16 | 14 | 14 | 17 |
| `buttons/toggle/large/radius_*` | 32 | 28 | 27 | 35 |
| `buttons/toggle/medium/gap_horizontal` | 14 | 12 | 12 | 15 |
| `buttons/toggle/medium/height` | 80 | 70 | 66 | 84 |
| `buttons/toggle/medium/icon_square` | 40 | 35 | 33 | 42 |
| `buttons/toggle/medium/min_width` | 120 | 106 | 100 | 128 |
| `buttons/toggle/medium/padding_horizontal` | 32 | 28 | 28 | 35 |
| `buttons/toggle/medium/padding_vertical` | 16 | 14 | 14 | 16 |
| `buttons/toggle/medium/radius_*` | 24 | 21 | 20 | 26 |
| `buttons/toggle/small/gap_horizontal` | 12 | 11 | 10 | 12 |
| `buttons/toggle/small/height` | 64 | 56 | 54 | 68 |
| `buttons/toggle/small/icon_sqaure` | 32 | 28 | 27 | 35 |
| `buttons/toggle/small/min_width` | 100 | 88 | 84 | 106 |
| `buttons/toggle/small/padding_horizontal` | 24 | 21 | 20 | 26 |
| `buttons/toggle/small/padding_vertical` | 8 | 7 | 8 | 10 |
| `buttons/toggle/small/radius_*` | 16 | 14 | 13 | 17 |

### `controller/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `controller/slider/border_large` | 4 | 4 | 3 | 4 |
| `controller/slider/border_medium` | 3 | 3 | 3 | 3 |
| `controller/slider/border_small` | 2 | 2 | 2 | 3 |
| `controller/slider/centered/knob/enabled_circle` | 48 | 42 | 40 | 51 |
| `controller/slider/centered/knob/pressed_circle` | 56 | 49 | 46 | 59 |
| `controller/slider/centered/temporature/text_height` | 62 | 55 | 52 | 64 |
| `controller/slider/centered/track/height` | 8 | 7 | 8 | 9 |
| `controller/slider/centered/track/min_width` | 320 | 282 | 266 | 340 |
| `controller/slider/centered/track/radius_*` | 999 | 999 | 999 | 999 |
| `controller/slider/continuous/medium/button_medium` | 80 | 70 | 66 | 84 |
| `controller/slider/continuous/medium/icon_medium` | 56 | 49 | 46 | 59 |
| `controller/slider/continuous/medium/knob/radius_*` | 20 | 20 | 17 | 22 |
| `controller/slider/continuous/medium/knob/radius_*` | 20 | 18 | 17 | 22 |
| `controller/slider/continuous/medium/label_width` | 180 | 158 | 180 | 180 |
| `controller/slider/continuous/medium/radius_*` | 32 | 28 | 27 | 35 |
| `controller/slider/continuous/small/button_small` | 72 | 63 | 60 | 77 |
| `controller/slider/continuous/small/icon_small` | 48 | 42 | 40 | 51 |
| `controller/slider/continuous/small/knob/radius_*` | 16 | 14 | 13 | 17 |
| `controller/slider/continuous/small/radius_*` | 24 | 21 | 20 | 26 |
| `controller/slider/continuous/track/medium/icon` | 48 | 42 | 40 | 51 |
| `controller/slider/continuous/track/medium/item_padding` | 4 | 4 | 4 | 4 |
| `controller/slider/continuous/track/medium/radius_*` | 24 | 21 | 20 | 26 |
| `controller/slider/continuous/track/small/icon` | 40 | 35 | 33 | 42 |
| `controller/slider/continuous/track/small/item_padding` | 4 | 4 | 4 | 4 |
| `controller/slider/continuous/track/small/radius_*` | 20 | 18 | 17 | 22 |
| `controller/slider/gap_horizontal_large` | 16 | 14 | 14 | 17 |
| `controller/slider/gap_horizontal_small` | 12 | 11 | 10 | 13 |
| `controller/slider/height_large` | 100 | 88 | 84 | 106 |
| `controller/slider/height_medium` | 80 | 70 | 66 | 84 |
| `controller/slider/height_small` | 72 | 67 | 64 | 81 |
| `controller/slider/padding_horizontal_large` | 40 | 35 | 34 | 42 |
| `controller/slider/padding_horizontal_medium` | 20 | 18 | 18 | 22 |
| `controller/slider/padding_horizontal_small` | 10 | 9 | 8 | 10 |
| `controller/slider/padding_vertical_large` | 12 | 11 | 10 | 13 |
| `controller/slider/padding_vertical_medium` | 10 | 9 | 8 | 10 |
| `controller/slider/padding_vertical_small` | 8 | 7 | 8 | 9 |
| `controller/slider/radius_*` | 32 | 28 | 27 | 35 |
| `controller/stepper/border` | 2 | 2 | 2 | 3 |
| `controller/stepper/divider` | 2 | 2 | 2 | 3 |
| `controller/stepper/gap_horizontal` | 24 | 21 | 20 | 26 |
| `controller/stepper/height` | 100 | 88 | 84 | 106 |
| `controller/stepper/padding_horizontal` | 24 | 21 | 20 | 26 |
| `controller/stepper/padding_vertical` | 18 | 16 | 15 | 19 |
| `controller/stepper/radius_*` | 24 | 21 | 20 | 26 |
| `controller/stepper/width` | 420 | 352 | 340 | 426 |

### `dropdown/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `dropdown/border` | 2 | 2 | 2 | 3 |
| `dropdown/container/prefix_app_icon_border` | 1 | 1 | 1 | 1 |
| `dropdown/gap_vertical_medium` | 16 | 14 | 14 | 17 |
| `dropdown/gap_vertical_small` | 8 | 7 | 8 | 9 |
| `dropdown/medium/height` | 100 | 88 | 84 | 106 |
| `dropdown/medium/prefix/icon_square` | 40 | 35 | 33 | 40 |
| `dropdown/medium/prefix/padding_horizontal` | 4 | 4 | 4 | 4 |
| `dropdown/medium/prefix/padding_vertical` | 4 | 4 | 4 | 4 |
| `dropdown/medium/radius_*` | 32 | 28 | 27 | 35 |
| `dropdown/padding_large` | 20 | 18 | 18 | 22 |
| `dropdown/padding_medium` | 16 | 14 | 14 | 17 |
| `dropdown/padding_small` | 12 | 11 | 10 | 13 |
| `dropdown/prefix/app_radius_*` | 16 | 14 | 13 | 17 |
| `dropdown/prefix/container_square` | 56 | 49 | 46 | 59 |
| `dropdown/prefix/medium/app_icon_radius_*` | 12 | 11 | 10 | 12 |
| `dropdown/small/height` | 80 | 70 | 66 | 84 |
| `dropdown/small/radius_*` | 28 | 25 | 23 | 29 |
| `dropdown/suffix/dot_icon_square` | 16 | 14 | 13 | 17 |
| `dropdown/suffix/icon_square` | 48 | 42 | 40 | 51 |

### `fields/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `fields/number/border` | 4 | 4 | 3 | 4 |
| `fields/number/cursor_height` | 48 | 42 | 40 | 51 |
| `fields/number/cursor_width` | 4 | 4 | 4 | 4 |
| `fields/number/input_radius_*` | 32 | 28 | 20 | 35 |
| `fields/number/large_height` | 180 | 158 | 150 | 190 |
| `fields/number/large_width` | 140 | 123 | 116 | 148 |
| `fields/number/medium_square` | 128 | 113 | 80 | 136 |
| `fields/text/medium/border` | 3 | 3 | 3 | 3 |
| `fields/text/medium/gap_horizontal` | 16 | 14 | 14 | 17 |
| `fields/text/medium/height` | 100 | 88 | 84 | 106 |
| `fields/text/medium/help_text_gap_vertical` | 16 | 14 | 14 | 17 |
| `fields/text/medium/padding_horizontal` | 32 | 28 | 28 | 35 |
| `fields/text/medium/radius_*` | 24 | 21 | 20 | 26 |
| `fields/text/medium/suffix_icon_square` | 48 | 42 | 40 | 51 |
| `fields/text/small/border` | 2 | 2 | 2 | 3 |
| `fields/text/small/gap_horizontal` | 12 | 11 | 10 | 13 |
| `fields/text/small/height` | 80 | 70 | 66 | 84 |
| `fields/text/small/help_text_gap_vertical` | 12 | 11 | 10 | 13 |
| `fields/text/small/padding_horizontal` | 24 | 21 | 20 | 26 |
| `fields/text/small/suffix_icon_square` | 40 | 35 | 33 | 42 |

### `gnb/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `gnb/temperature/decimal_places_witdh` | 38 | 33 | 32 | 36 |
| `gnb/temperature/number_width` | 75 | 69 | 58 | 76 |

### `imagery/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `imagery/profile/circle` | 80 | 70.4 | 66 | 80 |
| `imagery/profile/radius_*` | 999 | 999 | 999 | 999 |

### `keyboard/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `keyboard/keyword/enter_width` | 200 | 176 | 166 | 212 |
| `keyboard/keyword/height` | 80 | 70 | 90 | 102 |
| `keyboard/keyword/icon_square` | 44 | 39 | 37 | 49 |
| `keyboard/keyword/normal_width` | 100 | 88 | 96 | 106 |
| `keyboard/keyword/radius_*` | 20 | 18 | 17 | 22 |
| `keyboard/keyword/shift_width` | 165 | 145 | 136 | 174 |
| `keyboard/keyword/special_width` | 120 | 106 | 100 | 128 |

### `notification/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `notification/border` | 1 | 1 | 1 | 1 |
| `notification/gap_large` | 24 | 21 | 20 | 26 |
| `notification/gap_medium` | 16 | 14 | 14 | 17 |
| `notification/padding_large` | 32 | 28 | 28 | 35 |
| `notification/padding_medium` | 24 | 21 | 20 | 26 |
| `notification/padding_small` | 16 | 14 | 14 | 16 |
| `notification/system/imagary_square` | 100 | 88 | 83 | 106 |
| `notification/system/images/radius_*` | 24 | 21 | 20 | 26 |
| `notification/system/profile/app_radius_*` | 16 | 14 | 13 | 17 |
| `notification/system/profile/app_square` | 48 | 42 | 40 | 51 |
| `notification/system/profile/radius_*` | 999 | 999 | 999 | 999 |
| `notification/system/radius_*` | 48 | 42 | 40 | 51 |
| `notification/system/text_gap_vertical` | 12 | 11 | 10 | 13 |
| `notification/system/text_padding_horizontal` | 8 | 7 | 8 | 10 |
| `notification/system/text_padding_top` | 4 | 3 | 4 | 5 |
| `notification/system/width` | 700 | 616 | 582 | 745 |

### `os_notification/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `os_notification/container/width` | 700 | 700 | 700 | 700 |
| `os_notification/contents/image_square` | 100 | 88 | 83 | 100 |
| `os_notification/contents/image_thumb_radius` | 16 | 14 | 13 | 16 |

### `page_navigation/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `page_navigation/border_bottom` | 1 | 1 | 1 | 1 |
| `page_navigation/container_height` | 80 | 70 | 66 | 84 |
| `page_navigation/divider_height` | 32 | 28 | 28 | 35 |
| `page_navigation/divider_width` | 2 | 2 | 2 | 3 |
| `page_navigation/gap_extrasmall` | 8 | 7 | 8 | 9 |
| `page_navigation/gap_large` | 24 | 21 | 20 | 26 |
| `page_navigation/gap_medium` | 16 | 14 | 14 | 17 |
| `page_navigation/gap_samll` | 12 | 11 | 10 | 13 |
| `page_navigation/padding_extralarge` | 40 | 35 | 32 | 42 |
| `page_navigation/padding_large` | 24 | 21 | 22 | 20 |
| `page_navigation/padding_medium` | 16 | 14 | 14 | 17 |
| `page_navigation/padding_small` | 8 | 7 | 8 | 9 |
| `page_navigation/sub_title_gap_vertical` | 4 | 4 | 4 | 4 |
| `page_navigation/title/app_icon/container_square` | 80 | 70 | 66 | 84 |
| `page_navigation/title/app_icon/radius_botttom_left` | 20 | 18 | 17 | 22 |
| `page_navigation/title/app_icon/radius_botttom_right` | 20 | 18 | 17 | 22 |
| `page_navigation/title/app_icon/radius_*` | 20 | 18 | 17 | 22 |
| `page_navigation/title/depth_gap_horizontal` | 24 | 21 | 20 | 26 |
| `page_navigation/title/depth_icon_square` | 56 | 49 | 46 | 59 |
| `page_navigation/title/dropdown_icon_square` | 28 | 25 | 23 | 29 |
| `page_navigation/title/dropdown_menu_pressed/radius_botttom_left` | 16 | 14 | 13 | 17 |
| `page_navigation/title/dropdown_menu_pressed/radius_botttom_right` | 16 | 14 | 13 | 17 |
| `page_navigation/title/dropdown_menu_pressed/radius_*` | 16 | 14 | 13 | 17 |
| `page_navigation/title/group_gap_horizontal` | 48 | 42 | 32 | 51 |

### `popup/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `popup/system/border` | 2 | 2 | 2 | 3 |
| `popup/system/close_icon_square` | 48 | 42 | 40 | 51 |
| `popup/system/gap_extralarge` | 40 | 35 | 33 | 42 |
| `popup/system/gap_extrasmall` | 4 | 4 | 3 | 4 |
| `popup/system/gap_large` | 24 | 21 | 24 | 24 |
| `popup/system/header_padding_horizontal` | 32 | 28 | 27 | 35 |
| `popup/system/icon_square` | 80 | 70 | 66 | 84 |
| `popup/system/large_width` | 1200 | 1056 | 1000 | 1275 |
| `popup/system/list/item/icon_square` | 80 | 70 | 66 | 80 |
| `popup/system/max_height` | 1152 | 827 | 770 | 810 |
| `popup/system/max_height_extended` | 0 | 0 | 1240 | 1240 |
| `popup/system/medium_width` | 808 | 614 | 720 | 860 |
| `popup/system/padding_large` | 48 | 35 | 40 | 40 |
| `popup/system/padding_small` | 16 | 14 | 12 | 12 |
| `popup/system/radius_*` | 48 | 42 | 40 | 51 |
| `popup/toast/icon` | 48 | 42 | 40 | 51 |
| `popup/toast/margin_bottom` | 24 | 21 | 20 | 26 |
| `popup/toast/margin_horizontal` | 24 | 21 | 20 | 26 |
| `popup/toast/max_width` | 792 | 696 | 760 | 840 |
| `popup/toast/padding_horizontal` | 40 | 35 | 34 | 42 |
| `popup/toast/padding_vertical` | 24 | 21 | 20 | 26 |
| `popup/toast/radius_*` | 16 | 14 | 13 | 17 |

### `scroll/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `scroll/gap` | 16 | 14 | 13 | 17 |
| `scroll/padding_left` | 12 | 11 | 10 | 13 |
| `scroll/padding_right` | 20 | 18 | 17 | 22 |
| `scroll/padding_vertical` | 16 | 14 | 13 | 17 |

### `selections/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `selections/border_large` | 12 | 11 | 10 | 13 |
| `selections/border_small` | 4 | 4 | 3 | 4 |
| `selections/checkbox/normal_button_border` | 4 | 4 | 3 | 4 |
| `selections/checkbox/radius_*` | 12 | 11 | 10 | 13 |
| `selections/container_large` | 64 | 56 | 54 | 68 |
| `selections/container_medium` | 48 | 42 | 40 | 51 |
| `selections/switch/medium/knob_radius_*` | 8 | 7 | 7 | 9 |
| `selections/switch/medium/knob_square` | 32 | 28 | 27 | 35 |
| `selections/switch/medium/padding` | 8 | 7 | 8 | 9 |
| `selections/switch/medium/radius_*` | 16 | 14 | 13 | 17 |
| `selections/switch/medium/width` | 80 | 70 | 70 | 84 |
| `selections/switch/small/knob_radius_*` | 8 | 7 | 7 | 9 |
| `selections/switch/small/knob_square` | 28 | 25 | 23 | 29 |
| `selections/switch/small/padding` | 6 | 5 | 6 | 6 |
| `selections/switch/small/radius_*` | 12 | 11 | 10 | 13 |
| `selections/switch/small/width` | 64 | 56 | 56 | 68 |

### `spinner/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `spinner/focus_radius_*` | 24 | 21 | 20 | 26 |
| `spinner/gap_large` | 24 | 28 | 28 | 35 |
| `spinner/gap_medium` | 20 | 18 | 18 | 22 |
| `spinner/gap_small` | 16 | 14 | 14 | 17 |
| `spinner/list_height` | 88 | 77 | 74 | 93 |
| `spinner/list_mask_height` | 60 | 53 | 50 | 64 |
| `spinner/list_medium_height` | 96 | 84 | 80 | 102 |
| `spinner/number_height` | 88 | 77 | 74 | 93 |
| `spinner/number_width_large` | 200 | 176 | 166 | 212 |
| `spinner/number_width_medium` | 140 | 123 | 116 | 148 |
| `spinner/number_width_small` | 110 | 97 | 92 | 116 |
| `spinner/panel/large_height` | 384 | 327 | 322 | 407 |
| `spinner/panel/medium_height` | 288 | 245 | 234 | 297 |
| `spinner/title_top_padding` | 16 | 14 | 14 | 17 |
| `spinner/wheel/date_min_width` | 540 | 475 | 448 | 574 |
| `spinner/wheel/padding_horizontal` | 16 | 14 | 14 | 17 |
| `spinner/wheel/radius_*` | 32 | 28 | 27 | 35 |
| `spinner/wheel/time_min_width` | 480 | 422 | 398 | 509 |

### `tabs/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `tabs/line/border_bottom` | 1 | 1 | 1 | 1 |
| `tabs/line/button/gap_horizontal` | 8 | 7 | 8 | 9 |
| `tabs/line/button/padding_horizontal` | 14 | 12 | 12 | 15 |
| `tabs/line/button/padding_vertical` | 18 | 16 | 16 | 19 |
| `tabs/line/button/prefix_square` | 40 | 35 | 33 | 42 |
| `tabs/line/button/pressed_radius_*` | 12 | 11 | 10 | 13 |
| `tabs/line/button/wrap_padding_vertical` | 12 | 11 | 10 | 13 |
| `tabs/line/button/wrap_padding_vertical_large` | 26 | 22 | 22 | 22 |
| `tabs/line/gap_horizontal` | 24 | 21 | 12 | 26 |
| `tabs/line/padding_horizontal` | 28 | 25 | 24 | 29 |
| `tabs/line/selected_border_bottom` | 4 | 4 | 3 | 4 |
| `tabs/solid/large/button/gap_horizontal` | 14 | 12 | 12 | 16 |
| `tabs/solid/large/button/height` | 84 | 74 | 70 | 90 |
| `tabs/solid/large/button/padding_horizontal` | 28 | 25 | 24 | 29 |
| `tabs/solid/large/button/padding_vertical` | 16 | 14 | 14 | 17 |
| `tabs/solid/large/button/prefix_icon_square` | 52 | 46 | 43 | 55 |
| `tabs/solid/large/button/radius_*` | 24 | 21 | 20 | 26 |
| `tabs/solid/large/button/width` | 200 | 176 | 166 | 212 |
| `tabs/solid/large/height` | 100 | 88 | 84 | 106 |
| `tabs/solid/large/radius_*` | 32 | 28 | 27 | 35 |
| `tabs/solid/large/three_segments_width` | 880 | 774 | 760 | 934 |
| `tabs/solid/large/two_segments_width` | 880 | 774 | 760 | 934 |
| `tabs/solid/medium/button/gap_horizontal` | 8 | 7 | 8 | 9 |
| `tabs/solid/medium/button/height` | 64 | 56 | 54 | 68 |
| `tabs/solid/medium/button/padding_horizontal` | 18 | 16 | 16 | 19 |
| `tabs/solid/medium/button/padding_vertical` | 12 | 11 | 10 | 13 |
| `tabs/solid/medium/button/prefix_square` | 40 | 35 | 33 | 42 |
| `tabs/solid/medium/button/radius_*` | 16 | 14 | 13 | 17 |
| `tabs/solid/medium/button/width` | 160 | 141 | 134 | 170 |
| `tabs/solid/medium/four_segments_width` | 960 | 845 | 800 | 1020 |
| `tabs/solid/medium/height` | 80 | 70 | 66 | 84 |
| `tabs/solid/medium/radius_*` | 24 | 21 | 20 | 26 |
| `tabs/solid/medium/three_segments_width` | 780 | 686 | 670 | 828 |
| `tabs/solid/medium/two_segments_width` | 780 | 686 | 670 | 828 |
| `tabs/solid/padding` | 8 | 7 | 8 | 9 |

### `vehicle_settings/*`

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `vehicle_settings/list/item/container/padding_horizontal` | 20 | 18 | 17 | 22 |
| `vehicle_settings/list/item/container/padding_vertical` | 16 | 14 | 13 | 17 |
| `vehicle_settings/list/item/container/radius_*` | 24 | 21 | 20 | 26 |
| `vehicle_settings/list/item/height` | 112 | 99 | 93 | 119 |
| `vehicle_settings/list/item/icon_container_square` | 80 | 70 | 66 | 84 |
| `vehicle_settings/list/padding_horizontal` | 20 | 18 | 20 | 20 |
| `vehicle_settings/list/padding_vertical` | 24 | 21 | 24 | 24 |
| `vehicle_settings/list/radius_*` | 32 | 28 | 27 | 35 |
| `vehicle_settings/list/scroll_type_max_height` | 528 | 465 | 324 | 560 |


## 3. 스케일 토큰 (글자 크기 · 줄 높이 · 반경 · 그림자)

`typo` 변수 컬렉션. 두 파일에 포함된 레벨을 합쳤습니다.

| Token | connect-s | connect-l | connect-w | connect-waterfall |
|---|---|---|---|---|
| `line/level1` | 1 | 1 | 1 | 1 |
| `line/level4` | 4 | 4 | 3 | 4 |
| `line_height_sp/level1` | 24 | 21 | 20 | 26 |
| `line_height_sp/level3` | 28 | 25 | 23 | 29 |
| `line_height_sp/level6` | 34 | 28 | 28 | 36 |
| `line_height_sp/level7` | 36 | 32 | 30 | 38 |
| `line_height_sp/level8` | 38 | 33 | 32 | 41 |
| `line_height_sp/level9` | 40 | 35 | 33 | 42 |
| `line_height_sp/level11` | 48 | 42 | 40 | 51 |
| `line_height_sp/level15` | 64 | 55 | 53 | 68 |
| `line_height_sp/level16` | 68 | 60 | 56 | 72 |
| `line_height_sp/level17` | 72 | 65 | 60 | 77 |
| `line_height_sp/level19` | 80 | 65 | 66 | 84 |
| `line_height_sp/level20` | 134 | 118 | 156 | 142 |
| `radius/*/level4` | 12 | 11 | 10 | 13 |
| `radius/*/level5` | 16 | 14 | 13 | 17 |
| `radius/*/level7` | 24 | 21 | 20 | 26 |
| `shadow/level1/blur` | 24 | 21 | 20 | 26 |
| `shadow/level1/y` | 6 | 5 | 5 | 6 |
| `shadow/level2/blur1` | 32 | 28 | 27 | 32 |
| `shadow/level2/blur2` | 2 | 2 | 2 | 3 |
| `shadow/level2/y1` | 8 | 7 | 7 | 9 |
| `shadow/level2/y2` | 2 | 2 | 2 | 3 |
| `shadow/level3/blur1` | 40 | 35 | 33 | 42 |
| `shadow/level3/blur2` | 4 | 4 | 3 | 4 |
| `shadow/level3/y1` | 20 | 18 | 17 | 22 |
| `shadow/level3/y2` | 2 | 2 | 2 | 3 |
| `size_sp/level3` | 20 | 18 | 17 | 22 |
| `size_sp/level5` | 24 | 21 | 20 | 26 |
| `size_sp/level6` | 26 | 23 | 22 | 28 |
| `size_sp/level7` | 28 | 25 | 23 | 29 |
| `size_sp/level8` | 30 | 26 | 25 | 34 |
| `size_sp/level9` | 32 | 28 | 27 | 35 |
| `size_sp/level11` | 36 | 32 | 30 | 38 |
| `size_sp/level13` | 40 | 35 | 33 | 42 |
| `size_sp/level14` | 44 | 39 | 37 | 47 |
| `size_sp/level15` | 48 | 42 | 40 | 51 |
| `size_sp/level16` | 52 | 46 | 43 | 55 |
| `size_sp/level17` | 56 | 49 | 46 | 59 |
| `size_sp/level18` | 60 | 53 | 50 | 64 |
| `size_sp/level19` | 64 | 56 | 53 | 68 |
| `size_sp/level20` | 112 | 99 | 130 | 119 |
| `square/level8` | 40 | 35 | 33 | 42 |
| `square/level10` | 48 | 42 | 40 | 51 |
| `square/level18` | 80 | 70 | 66 | 84 |
| `square/level22` | 100 | 88 | 83 | 106 |

## 4. 플랫폼 레이아웃 토큰 (display guide)

상태바·GNB·윈도우 등 시스템 영역 토큰입니다. display guide 파일에는 같은 이름의 컬렉션이 여러 버전 들어 있어, `connect-s-14` 모드를 포함한 최신 컬렉션만 실었습니다. Waterfall 값 일부는 Form factors 표(3072 × 816)와 다릅니다 — `DESIGN.md` 부록 7 참고.

**form_factor** (modes: connect-s, connect-l, connect-w, connect-waterfall, connect-s-14)

| Token | connect-s | connect-l | connect-w | connect-waterfall | connect-s-14 |
|---|---|---|---|---|---|
| `HMG_expansion/focus_border` | 6 | 6 | 6 | 6 | 6 |
| `app_market/app_item/app_icon_border` | 1 | 1 | 1 | 1 | 1 |
| `bars/radius_*` | 999 | 999 | 999 | 999 | 999 |
| `bars/window_control/container_height` | 200 | 176 | 240 | 192 | 200 |
| `bars/window_control/container_width` | 20 | 18 | 30 | 24 | 16 |
| `bars/window_control/handle_height` | 160 | 141 | 132 | 128 | 160 |
| `bars/window_control/handle_height_pressed` | 80 | 70 | 66 | 66 | 80 |
| `bars/window_control/handle_width` | 4 | 4 | 8 | 6 | 4 |
| `bars/window_control/padding_horizontal` | 8 | 7 | 16 | 8 | 8 |
| `gnb/application/app_activate_height` | 8 | 7 | 8 | 8 | 8 |
| `gnb/application/app_activate_width` | 8 | 7 | 8 | 8 | 8 |
| `gnb/application/app_square` | 84 | 74 | 70 | 70 | 74 |
| `gnb/controller/arrow_height` | 0 | 0 | 100 | 80 | 0 |
| `gnb/controller/arrow_icon_sqaure` | 64 | 56 | 53 | 53 | 52 |
| `gnb/controller/arrow_width` | 80 | 70 | 108 | 108 | 64 |
| `gnb/controller/pressed_square` | 100 | 88 | 96 | 96 | 88 |
| `gnb/gap_small` | 4 | 4 | 4 | 4 | 4 |
| `gnb/menu/HMG_app_icon_radius` | 24 | 21 | 20 | 18 | 20 |
| `gnb/menu/container_square` | 124 | 109 | 108 | 94 | 96 |
| `gnb/menu/radius_*` | 30 | 25 | 30 | 24 | 30 |
| `gnb/remove_button/background_square` | 40 | 35 | 36 | 36 | 40 |
| `gnb/remove_button/container_square` | 44 | 39 | 40 | 40 | 44 |
| `gnb/remove_button/icon_height` | 3 | 3 | 4 | 4 | 3 |
| `gnb/remove_button/icon_width` | 16 | 14 | 16 | 16 | 16 |
| `gnb/temperature/container_width` | 164 | 116 | 108 | 108 | 132 |
| `gnb/temperature/decimal_places_padding_top` | 12 | 11 | 14 | 0 | 6 |
| `gnb/temperature/decimal_places_witdh` | 38 | 33 | 32 | 32 | 36 |
| `gnb/temperature/gap_horizontal` | -2 | -2 | -4 | -6 | -2 |
| `gnb/temperature/number_width` | 75 | 69 | 58 | 58 | 60 |
| `gnb/temperature/wind_icon_square` | 48 | 40 | 27 | 27 | 40 |
| `gnb/width` | 0 | 0 | 140 | 112 | 0 |
| `imagery/cover/border` | 2 | 2 | 2 | 2 | 2 |
| `imagery/profile/radius_*` | 999 | 999 | 999 | 999 | 999 |
| `statusbar/HMG_extended_height_2` | 0 | 0 | 1440 | 0 | 0 |
| `statusbar/HMG_width_2` | 0 | 0 | 100 | 80 | 0 |
| `statusbar/height` | 96 | 84 | 850 | 680 | 76 |
| `statusbar/menus/HMG_icon_call` | 180 | 152 | 80 | 72 | 144 |
| `statusbar/menus/HMG_icon_voice` | 100 | 86 | 80 | 72 | 80 |
| `statusbar/menus/container_radius_*` | 20 | 18 | 17 | 17 | 20 |
| `statusbar/menus/container_square` | 80 | 68 | 80 | 80 | 64 |
| `statusbar/menus/icon_square` | 64 | 54 | 48 | 48 | 52 |
| `statusbar/menus/privacy/dot` | 16 | 12 | 14 | 12 | 12 |
| `statusbar/menus/privacy/padding` | 8 | 6 | 10 | 8 | 8 |
| `statusbar/menus/profile_square` | 80 | 60 | 70 | 70 | 56 |
| `window/apps/HMG_radius_app` | 40 | 35 | 33 | 33 | 32 |
| `window/apps/application_height` | 1184 | 855 | 810 | 664 | 948 |
| `window/apps/landscape_width` | 1700 | 1274 | 1640 | 1256 | 1360 |
| `window/apps/portrait_width` | 840 | 628 | 800 | 648 | 672 |
| `window/container_extended_height` | 0 | 0 | 1440 | 0 | 0 |
| `window/container_height` | 1440 | 1080 | 850 | 680 | 1152 |
| `window/container_width` | 2560 | 1920 | 3840 | 3072 | 2048 |

**form_factor_common** (modes: connect-s, connect-l, connect-w, connect-waterfall, connect-s-14)

| Token | connect-s | connect-l | connect-w | connect-waterfall | connect-s-14 |
|---|---|---|---|---|---|
| `font/line_height_dp/level11` | 48 | 42 | 42 | 42 | 42 |
| `font/line_height_dp/level14` | 60 | 46 | 50 | 50 | 46 |
| `font/line_height_dp/level5` | 32 | 28 | 30 | 30 | 28 |
| `font/size_dp/level12` | 38 | 33 | 34 | 32 | 33 |
| `font/size_dp/level15` | 46 | 42 | 40 | 40 | 42 |
| `font/size_dp/level5` | 24 | 21 | 23 | 23 | 21 |
| `font/size_sp/level12` | 38 | 33 | 34 | 34 | 33 |

**form_factor_common** (modes: connect-s, connect-l, connect-w, connect-waterfall, connect-s-14)

| Token | connect-s | connect-l | connect-w | connect-waterfall | connect-s-14 |
|---|---|---|---|---|---|
| `font/line_height_dp/level14` | 60 | 46 | 50 | 50 | 46 |
| `font/size_dp/level15` | 46 | 42 | 40 | 40 | 42 |

