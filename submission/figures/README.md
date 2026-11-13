# 접수양식 그림

`../기획서_초안.md`의 `![설명](figures/파일.png)` 줄이 가리키는 그림입니다. `tools/fill_form.py`가 각 답변 칸에 넣습니다.

- `fig01·02·06·09·13`: three.js로 그린 3D 장면(`src/lib3d.js` 공용 도우미). 강릉 샘플 여행의 실제 좌표, 에뮬레이터 내비가 잰 값을 씁니다.
- 나머지: 실제 앱 화면(`../img`)을 엮은 HTML 그림(`src/fig.css`).
- `fig10`(SDK·API와 기능 매트릭스)은 양식에서 쓰지 않습니다. 그림으로는 글자가 작아 `기획서_초안.md` 5절의 마크다운 표(양식의 표 1)로 바꿨습니다. 소개서 등에 다시 쓸 수 있게 파일은 남겨 둡니다.

다시 그리기(헤드리스 Chrome, three.js는 jsDelivr에서 불러옴):

```sh
cd submission && python3 -m http.server 8765 --bind 127.0.0.1 &
node figures/src/render.mjs fig01 fig02 …     # → figures/figNN.raw.png
```

그다음 흰 여백을 잘라 가로 1800px로 줄여 `figNN.png`로 저장합니다(PIL). 여백 자르기 전 원본(`*.raw.png`)은 커밋하지 않습니다.

## 개념 일러스트(`il-*.jpg`)

GPT Image(ChatGPT 구독, Codex CLI 브리지 — API 키 사용 안 함)로 그린 장면입니다. 실제 앱 화면이 아니므로 양식 캡션은 모두 '개념 일러스트'로 시작합니다. 프롬프트는 `src/illustrations.json`에 있고, 공통 조건은 16:9, 남색·하늘색·모래색 팔레트, 글자·숫자·로고·엠블럼 없음(익명 심사·브랜드 표기 회피), 주행 중 휴대폰 사용 장면 없음입니다.

- `il-handoff` — 주차 중 차 화면의 일회용 QR을 휴대폰으로 찍기(3절 차로 옮기기). QR은 그림일 뿐 실제로 읽히는 코드가 아닙니다.
- `il-navi` — 운전석 시점, 차 화면에는 경로와 일정 상태만(3절 차량이기에 가능한 것)
- `il-storyboard` — 집에서 계획 → QR → 주행 → 제시간 도착 4컷(4절)
- `il-fleet` — 렌터카 영업소의 출고 전 충전 점검(6절 확장 ①)
- `planning`(가족이 동선을 짜며 헤매는 장면)은 생성이 세 번 모두 실패해 넣지 않았습니다.

다시 만들기: `node ~/.claude/skills/gpt-image/scripts/gpt_image.mjs batch --manifest <illustrations.json 복사본>` → 결과 PNG를 가로 1600px, JPEG 품질 85로 줄여 `il-*.jpg`로 저장(양식 용량을 줄이려고 JPEG). 생성 원본 폴더 `generated-images/`는 커밋하지 않습니다.
