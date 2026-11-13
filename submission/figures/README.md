# 접수양식 그림

`../기획서_초안.md`의 `![설명](figures/파일.png)` 줄이 가리키는 그림입니다. `tools/fill_form.py`가 각 답변 칸에 넣습니다.

- `fig01·02·06·09·13`: three.js로 그린 3D 장면(`src/lib3d.js` 공용 도우미). 강릉 샘플 여행의 실제 좌표, 에뮬레이터 내비가 잰 값을 씁니다.
- 나머지: 실제 앱 화면(`../img`)을 엮은 HTML 그림(`src/fig.css`).
- `fig02a`(세 가지 불편 카드)는 양식에서 빠졌습니다. 2절은 불편마다 AI 생성 연출 이미지를 붙입니다.
- `fig10`(SDK·API와 기능 매트릭스)은 양식에서 쓰지 않습니다. 그림으로는 글자가 작아 `기획서_초안.md` 5절의 마크다운 표(양식의 표 1)로 바꿨습니다. 소개서 등에 다시 쓸 수 있게 파일은 남겨 둡니다.

다시 그리기(헤드리스 Chrome, three.js는 jsDelivr에서 불러옴):

```sh
cd submission && python3 -m http.server 8765 --bind 127.0.0.1 &
node figures/src/render.mjs fig01 fig02 …     # → figures/figNN.raw.png
```

그다음 흰 여백을 잘라 가로 1800px로 줄여 `figNN.png`로 저장합니다(PIL). 여백 자르기 전 원본(`*.raw.png`)은 커밋하지 않습니다.

## AI 생성 연출 이미지(`ph-*.jpg`)

GPT Image로 만든 실사풍 장면입니다(ChatGPT 구독, Codex CLI 브리지의 내장 image_gen — API 키를 쓰지 않으므로 렌더러 모델을 고를 수 없음). 실제 사용자·실제 앱 화면이 아니므로 양식 캡션은 모두 'AI 생성 연출 이미지'로 시작합니다. 프롬프트는 `src/photos.json`에 있습니다.

프롬프트 공통 원칙: 16:9 실사 다큐멘터리 사진(렌즈·조리개·빛 지정, 자연스러운 피부 질감·필름 그레인), 강릉 바닷가 맥락, 화면은 흐리거나 도형만(생성 글자 깨짐 방지), 글자·숫자·번호판·로고·핸들 엠블럼 없음(익명 심사·브랜드 표기 회피), 주행 중 휴대폰을 쓰는 운전자 없음, QR은 읽히지 않는 추상 패턴.

- `ph-pain-reservation` — 2절 불편 ②: 연휴 해안 도로 정체, 운전자는 시계를, 동승자는 식당에 전화
- `ph-pain-reentry` — 2절 불편 ③: 렌터카에서 목적지를 하나씩 다시 입력, 가족은 밖에서 대기
- `ph-handoff` — 3절 차로 옮기기: 주차 중(P단) 차 화면의 QR을 휴대폰으로 찍기
- `ph-navi` — 3절 차량이기에 가능한 것: 주행 중 차 화면에는 경로·일정 상태만
- `ph-storyboard` — 4절: 집에서 계획 → QR → 주행 → 제시간 도착 4컷(같은 가족)
- `ph-fleet` — 6절 확장 ①: 렌터카 영업소의 출고 전 충전 점검
- `ph-pain-planning` — 2절 불편 ①: 자정 가까이 지도의 핀을 보며 날짜·순서를 정하지 못하는 부부

다시 만들기: `node ~/.claude/skills/gpt-image/scripts/gpt_image.mjs batch --manifest <photos.json 복사본> --concurrency 1` → 결과 PNG를 가로 1600px, JPEG 품질 86으로 줄여 `ph-*.jpg`로 저장(양식 용량 때문에 JPEG). 브리지 실행마다 처음 시작한 작업은 이미지 없이 끝나는 일이 반복됐습니다(일곱 번 연속). 꼭 필요한 이미지는 같은 문안을 두 작업으로 연달아 넣으면 두 번째가 만들어집니다. 생성 원본 폴더 `generated-images/`는 커밋하지 않습니다.

## 제품 컷 (`fig00-product.png`, M65)

[stageshow](https://github.com/benjitaylor/skills) 방식으로 만든 제품 화면 연출 이미지입니다. 차 화면(Pleos Connect 앱 창)이 주인공이고 휴대폰이 오른쪽 가장자리에 걸칩니다. 실제 글자는 여행 이름·1일차·장소 3곳·내비 측정 구간·더 빠른 순서 결과만 쓰고 나머지는 자리 막대입니다. 장소·시각·구간 값은 샘플 여행 1일차의 실제 측정값(fig06, docs/evidence/m63)이고 '22분 줄어요'는 fig02의 측정값입니다. 원본은 `src/stageshow/`(stageshow 저장소의 `examples/`에 넣고 `npm run dev` → `node scripts/film.mjs "<preview>/?capture=tteonaljido" --still`), 색은 design/TOSS.md 토큰.

M65부터 모든 그림의 색·글꼴은 토스 토큰(`src/fig.css`, `src/lib3d.js`)과 Pretendard(`src/fonts/`, OFL)입니다.
