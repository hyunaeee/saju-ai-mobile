# 천기연 天機緣

정통 만세력 기반 AI 사주 플랫폼. 바닐라 HTML/CSS/JS 정적 사이트 + Vercel 서버리스 함수.

| 페이지 | 내용 |
|---|---|
| `index.html` | 플랫폼 홈 — 서비스 허브 · 오늘의 일진 |
| `saju.html` | 연화 사주 — 만세력·진태양시·대운·신살 풀이, 결제(토스), 질문5, 기도올리기 |
| `party.html` | 모임 관계 지도 — 친구 생일로 관계망 그래프 (최대 100명, 링크 공유) |
| `cosmos.html` | 오늘의 하늘 — Three.js 실시간 태양계(태양~해왕성) + 별자리×사주 |

## 구조

```
├─ index/saju/party/cosmos/privacy/terms.html
├─ css/      style.css(사주 페이지 전용) · nav.css(공통 탭바)
├─ js/
│   ├─ config.js   실행 모드 스위치 (데모 ↔ 실서비스) — 배포 전 여기만 수정
│   ├─ saju.js     만세력 엔진 (브라우저·서버 공용: 60갑자·절기·십신·대운·신살·신강약·용신)
│   ├─ content.js  해석 텍스트 생성기 (브라우저·서버 공용)
│   ├─ lunar.js    음↔양력 변환 (KARI 데이터 1000~2050)
│   └─ app.js / party.js / cosmos.js   페이지별 로직
├─ api/      Vercel 서버리스 — confirm(결제검증) · report · ask(Claude) · party(KV)
├─ assets/   이미지·영상·행성 텍스처 (텍스처 © Solar System Scope, CC BY 4.0)
└─ docs/     배포안내.md(배포·PG·환경변수) · 실행체크리스트.md(사업 준비·마케팅)
```

## 로컬 실행

```bash
npx http-server -p 5311
```

정적 서버만으로 전 기능이 **데모 모드**로 동작합니다 (결제·AI는 시뮬레이션).

## 배포

- 데모: https://saju-ai-mobile-demo.vercel.app (영구 데모 잠금)
- 실서비스: https://saju-ai-mobile.vercel.app

```bash
vercel --prod
```

실서비스 전환(토스 키·환경변수·사업자 표기)은 [docs/배포안내.md](docs/배포안내.md), 오픈 준비 전체 목록은 [docs/실행체크리스트.md](docs/실행체크리스트.md) 참고.

## 라이선스

All rights reserved. 서드파티 고지는 [NOTICE](NOTICE) 참고.
