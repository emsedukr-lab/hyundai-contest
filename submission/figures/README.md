# 접수양식 그림

`../기획서_초안.md`의 `![설명](figures/파일.png)` 줄이 가리키는 그림입니다. `tools/fill_form.py`가 각 답변 칸에 넣습니다.

- `fig01·02·06·09·13`: three.js로 그린 3D 장면(`src/lib3d.js` 공용 도우미). 강릉 샘플 여행의 실제 좌표, 에뮬레이터 내비가 잰 값을 씁니다.
- 나머지: 실제 앱 화면(`../img`)을 엮은 HTML 그림(`src/fig.css`).

다시 그리기(헤드리스 Chrome, three.js는 jsDelivr에서 불러옴):

```sh
cd submission && python3 -m http.server 8765 --bind 127.0.0.1 &
node figures/src/render.mjs fig01 fig02 …     # → figures/figNN.raw.png
```

그다음 흰 여백을 잘라 가로 1800px로 줄여 `figNN.png`로 저장합니다(PIL). 여백 자르기 전 원본(`*.raw.png`)은 커밋하지 않습니다.
