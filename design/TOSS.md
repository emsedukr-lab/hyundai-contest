# 떠날지도 디자인 체계 — 토스 시각 언어 + Pleos 안전 기준

2026-11-14 사용자 결정: 휴대폰·차량 두 앱의 **디자인 체계(색·글꼴·모서리·컴포넌트 모양)** 를 토스 디자인 시스템(TDS) 시각 언어로 바꾼다. **화면 배치와 흐름, 문구, 기능은 그대로** 둔다. 차량은 Pleos Connect의 **주행 안전 기준**(글자 20sp 이상, 터치 64dp 이상, 대비, 주행 중 제한, 화면 구역)을 그대로 지킨다.

- 원본 참고: `design/reference/toss.md`(getdesign.kr의 토스 design.md, 2026-11-02). 그 문서의 권고대로 **시각 언어만** 빌린다 — 토스의 금융 흐름·로고·Tossface·토스 이름은 쓰지 않는다.
- Pleos 공식 명세 `design/DESIGN.md`는 차량의 **치수·글자 크기·화면 구역·주행 규칙**의 기준으로 남는다(색·글꼴·버튼 모양은 이 문서가 우선).
- 이 문서가 두 앱 색의 단일 출처다. 휴대폰은 `--tn-*` CSS 변수(`packages/web/src/components/shell/shell.css` `:root`)와 Astryx 테마(`packages/web/src/tossTheme.ts`), 차량은 `@color/tn_*`(`car/app/src/main/res/values{,-night}/tn_colors.xml`)로만 쓴다. 코드에 hex 직접 금지.

## 1. 원칙 (toss.md Do's and Don'ts 요약)

- **강조색은 토스 블루 하나.** 그 색으로 채운 주 버튼은 화면(또는 한 덩어리)당 하나. 보조 동작은 옅은 회색 채움, 약한 동작은 파란 글자(ghost). 선택·포커스·진행·스위치 켜짐도 같은 블루.
- **시맨틱 색은 뜻이 있을 때만**: 빨강 = 오류·늦음·충돌·파괴적 동작, 초록 = 여유·완료, 주황 = 확인 필요(점·아이콘만, 글자는 잉크). 장식에 색을 쓰지 않는다.
- **평면 + 헤어라인.** 회색 바탕 위 흰 카드(카드에는 보더·그림자 없음). 그림자는 떠 있는 것(시트·팝업·토스트·선택된 세그먼트·스위치 노브)에만. 장식용 2px 보더·컬러 왼쪽 띠·그라데이션 금지(예외: 하단 고정 버튼 위 흰→투명 보호 그라데이션).
- **둥글게, 그러나 귀엽지 않게.** 모서리 사다리만 쓰고 칩·알약은 완전한 원형(999).
- **눌림은 한 단계 진하게, 비활성은 전체 30% 불투명도**(부분 회색 처리 안 함).
- **모션** 120(누름)·200(토글)·320(시트) ms, ease `cubic-bezier(0.22,0.61,0.36,1)`, 바운스·320ms 넘는 페이드·스켈레톤 반짝임 없음. 차량은 주행 중 시선을 끄는 모션 없음(Pleos).
- **숫자**는 시각·거리·시간에 고정폭(`tabular-nums`).
- **문구**는 해요체(이미 그렇다), 이모지·느낌표·격식체 없음.

## 2. 색 역할 (라이트 / 다크)

| 역할 (휴대폰 `--tn-` / 차량 `tn_`) | 라이트 | 다크 | 쓰임 |
|---|---|---|---|
| `canvas` | #F2F4F6 (grey-100) | #17171C | 화면 바탕 |
| `surface` | #FFFFFF | #202027 | 카드·컨테이너·탭바 |
| `surface-float` | #FFFFFF | #2C2C35 | 시트·팝업·메뉴 |
| `fill-weak` | #F2F4F6 | #2C2C35 | 보조 버튼·입력칸 평소·세그먼트 트랙·중립 태그 (흰 면 위에서) |
| `fill-weak-on-canvas` | #E5E8EB | #2C2C35 | 회색 바탕 위에 바로 놓이는 옅은 면 |
| `fill-weak-pressed` | #E5E8EB | #3C3C47 | 보조 버튼·행 눌림 |
| `hairline` | #E5E8EB (grey-200) | #3C3C47 | 구분선·입력칸 보더·칩 보더 |
| `text-primary` | #191F28 (grey-900) | #FFFFFF | 본문·제목 (흰 면 16.6:1) |
| `text-secondary` | #4E5968 (grey-700) | #C3C3C6 | 보조 문장 (7.1:1 / 9.2:1) |
| `text-tertiary` | #6B7684 (grey-600) | #9E9EA4 | 메타·캡션 — **흰 면 위에서만**(4.6:1). 회색 바탕 위는 secondary |
| `text-disabled` | #B0B8C1 (grey-400) | #62626D | 비활성 글자(비활성 컨트롤은 전체 30%) |
| `accent` | #3182F6 (blue-500) | #3485FA | 주 버튼 채움·선택·포커스 보더·스위치 켜짐·진행·강조 경로선 |
| `accent-pressed` | #1B64DA | #2272EB | 주 버튼 눌림 |
| `on-accent` | #FFFFFF | #FFFFFF | 주 버튼 글자 (3.7:1 — 차량 버튼 글자는 26sp 굵게 이상이라 큰 글자 기준 통과. 휴대폰 17px 굵게는 4.5:1에 못 미치지만 토스 블루를 유지하기로 한 **알려진 예외**: 2026-11-14 UX 점검 뒤 사용자 결정) |
| `accent-text` | #1065CC | #6AA8FF | 파란 글자(링크·ghost 버튼·정보 태그 글자) — 4.5:1 이상 |
| `accent-weak` | #E8F3FF (blue-50) | #202C4D | 정보 태그·브랜드 칩 바탕 |
| `positive` | #007738 | #3CC57A | 여유·완료 점·아이콘·글자 |
| `positive-weak` | #E6F4EA | #16302A | 여유·완료 태그 바탕 |
| `negative` | #F04452 (red-500) | #F04251 | 오류 보더·점·아이콘·파괴적 버튼 채움 |
| `negative-text` | #D22030 | #FF6B76 | 빨간 글자(오류 문장·늦음 태그) — 4.5:1 이상 |
| `negative-weak` | #FFEEEE | #3A1F24 | 늦음·충돌 태그 바탕 |
| `warning` | #FF8800 | #FFA552 | 확인 필요 점·아이콘만(글자 금지, 2.4:1) |
| `warning-weak` | #FFF3E0 | #3A2A1A | 확인 필요 태그 바탕(글자는 text-primary) |
| `switch-off` | #D1D6DB (grey-300) | #4D4D59 | 스위치 꺼짐 트랙 |
| `toast` | #191F28 | #3C3C47 | 토스트·스낵바 면(글자 흰색) |
| `overlay` | 검정 56% | 검정 56% | 시트·팝업 뒤 가림 |
| `press-overlay` | 검정 26% | 흰 12% | 사진·지도 위 눌림 겹침 |
| QR | #FFFFFF 바탕 · #000000 모듈 | 같음 | 야간에도 반전 없음(24-7) |

## 3. 글꼴

**Pretendard Variable**(OFL, 토스 권장 대체 서체). 휴대폰은 자체 호스팅(가변 woff2 조각, CSP `default-src 'self'` 유지), 차량은 `design/fonts/pretendard_variable.ttf`. 굵기 400·500·600·700.

휴대폰은 클 필요가 없다(2026-11-14 사용자 지시): 본문 15가 기준이고 제목도 사다리에서 한 단계씩 낮춰 쓴다.

| 휴대폰 (px) | 크기/줄높이/굵기 | 쓰임 |
|---|---|---|
| h3 | 22/29/700 | 탭 첫 화면 큰 제목 · 새 여행 단계 제목 |
| h4 | 20/27/700 | 다음 여행 이름 · 여행 이름 입력 · 머무는 시간 값 |
| title-1 | 18/26/600 | 일차 제목 · 시트 제목 · 이동 값 |
| title-2 | 17/25/600 | 상단 바 제목 |
| body-1 | 17/26/400 | 입력값만(입력칸·검색·시각 선택 — 16px 미만이면 iOS가 화면을 확대) |
| body-2 / label-m | 15/23/400 · 15/23/600 | 기본 본문 · 목록 행 제목·장소 이름·섹션 제목·버튼 M(48) |
| body-3 / label-s | 13/20/400 · 13/16/600 | 보조 줄 · 버튼 S |
| label-l | 17/21/700 | 하단 고정 버튼 XL(56)만 |
| caption | 12/17/500 | 태그·메타 (가장 작은 글자 12) |

차량은 **Pleos 글자 스케일 그대로**(Headline 60/56/48 · Title 40/36/32 · Body 30/28/26 · Label 24/20, 20sp 미만 없음)에 글꼴만 Pretendard. 굵기는 Strong 700 → 제목 700, 버튼·라벨 600~700.

## 4. 모양

| 항목 | 휴대폰 | 차량 (Pleos 치수 유지) |
|---|---|---|
| 모서리 | 4 · 8 · 12(입력칸·버튼 M) · 14(버튼 L) · 16(버튼 XL) · 20(카드·시트·대화상자) · 24(큰 섹션) · 999(칩·알약) | 16(Small 버튼) · 24(Medium 버튼·세그먼트 바) · 32(Large 버튼·카드) · 48(팝업) · 999 |
| 컨트롤 높이 | 버튼 S 32·M 40·L 48·XL 56(하단 고정), 입력칸 48, 칩 34, 터치 영역 44 이상 | 버튼 64·80·100, 행 112, 세그먼트 64(바 80), 터치 64dp 이상 |
| 간격 | 4의 배수, 화면 좌우 20(토스 24 → 좁은 폰 20), 목록 행 간 16, 붙은 요소 8 | Pleos 간격 4·8·12·16·20·24·32·40·48 |
| 그림자 | shadow-1 `0 1px 2px #0E142A0A, 0 1px 1px #0E142A0A`(세그먼트·노브) · shadow-2 `0 4px 12px #0E142A0F, 0 1px 2px #0E142A0A`(메뉴) · shadow-3 `0 12px 32px #0E142A1A, 0 2px 6px #0E142A0F`(대화상자) · toast `0 8px 24px #0E142A29` · 시트 `0 -2px 12px #0E142A0F` | Pleos Level1~3 치수에 같은 색(낮은 알파 navy) |

## 5. 컴포넌트 규칙 (두 앱 공통 모양, 크기는 위 표)

| 컴포넌트 | 모양 |
|---|---|
| 주 버튼 (차량 `FILLED`) | `accent` 채움 + `on-accent` 굵은 글자, 눌림 `accent-pressed` |
| 보조 버튼 (차량 `BASIC`) | `fill-weak` 채움 + `text-primary` 글자, 눌림 `fill-weak-pressed`. 회색 바탕 위에 바로 놓이면 `fill-weak-on-canvas` |
| 약한 버튼·링크 | 면 없음 + `accent-text` |
| 파괴적 버튼 | 확인 단계에서만 `negative` 채움 + 흰 글자 (밀어서 삭제 드러나는 면도 `negative`) |
| 비활성 | 컴포넌트 전체 30% 불투명도 |
| 카드·컨테이너 | `canvas` 위 `surface`, 보더·그림자 없음 |
| 머리말(상단 바) | `canvas`와 같은 면, 아래 구분선 없음, 왼쪽 정렬 제목 |
| 목록 행 | 흰 컨테이너 안, 행 사이 `hairline` 구분선(글자 열부터), 오른쪽 꺾쇠 `text-disabled` |
| 입력칸·검색창 | 평소 `fill-weak` + 보더 없음, 포커스 `surface` + 1.5px(차량 3dp) `accent` 보더, 오류 1.5px `negative` 보더 + `negative-text` 도움말 |
| 칩 | 34 알약, 평소 `surface` + 1px `hairline`, 선택 `text-primary` 채움 + 흰 글자(토스 chip active). 브랜드 칩 `accent-weak` + `accent-text` |
| 세그먼트(일차 선택) | 트랙 `fill-weak`, 선택된 칸 `surface` + shadow-1 + `text-primary` 굵게, 나머지 `text-secondary` |
| 스위치 | 트랙 꺼짐 `switch-off`, 켜짐 `accent`, 흰 노브 + shadow-1 |
| 태그(배지) | 옅은 바탕 + 같은 계열 글자, 점 없음: 정보 `accent-weak`/`accent-text`, 여유·완료 `positive-weak`/`positive`, 늦음·충돌 `negative-weak`/`negative-text`, 확인 필요 `warning-weak`/`text-primary`(앞에 `warning` 점), 중립 `fill-weak`/`text-secondary` |
| 상태 줄 | 상태 점(`positive`·`warning`·`negative`·`accent`) + 문장 — 뜻은 항상 글에 있음 |
| 시트·대화상자(차량 팝업) | `surface-float`, 보더 없음, 시트 shadow·대화상자 shadow-3, 뒤 `overlay`. 차량 팝업 버튼 배치(동작 → 취소)는 그대로 |
| 토스트·스낵바 | `toast` 면 + 흰 글자, 모서리 14(차량 24), 되돌리기 글자는 흰색 굵게 |
| 플로팅 추가 버튼(휴대폰, 탭바는 없앰) | 56 원형 `accent` + `on-accent` 아이콘, 그림자 Level2, 눌러 `surface` 메뉴(r24, 항목 56)를 위로 펼침. 상단 바 오른쪽은 아이콘 버튼(44) |
| 하단 고정 버튼(휴대폰) | XL 56 주 버튼, 좌우 20, 위로 24px `canvas`→투명 보호 그라데이션 |
| 진행 단계 막대 | 완료·현재 `accent`, 남은 칸 `hairline` |
| 타임라인 | 레일 `hairline` 점선, 번호 원 `fill-weak` + `text-primary`(지난 곳 `text-tertiary`), 고정 시각은 자물쇠 + `accent-text` 굵은 시각 |
| 지도·동선 스케치 | 강조하는 날 경로 `accent` 실선(흰 테두리) + 번호 원, 나머지 `text-disabled` 점선 |
| 아이콘 | 선 아이콘, 색은 글자색 상속(`text-secondary` 기본), 활성 탭만 Filled |

## 6. 차량에서 그대로 지키는 Pleos 안전 기준

- 글자 20sp 미만 금지, 터치 요소 64dp 이상, 문장 3줄 이하, 1~2초 안에 읽히는 핵심만.
- 대비 4.5:1 이상(큰 글자 — 24sp 이상 또는 19sp 굵게 — 는 3:1. 주 버튼 흰 글자 3.7:1은 모두 26sp 굵게 이상이라 통과).
- 주행 중: QR·승인·안내·측정 버튼과 팝업 숨김, 시선을 끄는 모션 없음(`CarUxRestrictions`).
- 화면 구역(Connect-S Landscape 1700×1184 · Portrait 840×1184), 주·야간, 한국어/영어.
- 반경·간격·컴포넌트 크기는 `@dimen/pleos_*` 그대로(`Space`·`Radius` 헬퍼).
