# NAMU 주택관리

건물·호실별 임대 현황, 월세·관리비 입금내역, 만기 알림, 매물장·수익률, 이자계산을 관리하는 웹앱입니다.

- 앱 주소: https://namu-home.github.io/namu/
- 데이터: Firebase Firestore (서울, asia-northeast3) — 이 저장소에는 세입자 데이터가 들어 있지 않습니다.
- 로그인: Firebase Authentication 이메일/비밀번호. 가입 기능 없음, 관리자가 승인한 계정만 접근.

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `index.html` | 화면과 기능 전부 |
| `firebase-app.js` | 로그인, 승인 확인, Firestore 연결, 관리 메뉴(사용자 승인·백업·가져오기) |
| `firestore.rules` | Firestore 접근 규칙 (Firebase 콘솔 → Firestore → 규칙에 붙여넣어 게시) |
| `manifest.webmanifest`, `sw.js`, `icon-*.png` | PC·휴대폰 설치(PWA) |

## 주의

- 세입자 데이터 파일(엑셀, 백업 JSON, 단독 HTML)을 이 저장소에 올리지 마세요. 저장소는 공개입니다.
- `firebase-app.js`의 `OWNER`와 `firestore.rules`의 이메일은 같아야 합니다.
