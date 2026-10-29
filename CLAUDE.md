# NAMU 주택관리 — Claude 작업 안내

이 저장소는 이슬비(관리자 matht2353@gmail.com)가 쓰는 임대 건물·호실·입금 관리 웹앱입니다.
사용자는 코드를 다루지 않고 채팅으로만 수정을 요청합니다. 요청을 받으면 아래 순서대로 직접 고치고 올립니다.

- 앱 주소: https://namu-home.github.io/namu/ (GitHub Pages, `main` 브랜치 루트를 그대로 배포)
- 데이터: Firebase 프로젝트 `namu-hj`, Firestore(서울 asia-northeast3), 무료 Spark 요금제
- 로그인: Firebase Authentication 이메일/비밀번호, 가입 기능 없음. 관리자 + `access/{email}` 승인 목록에 있는 사람만 접근

## 파일

| 파일 | 내용 |
| --- | --- |
| `index.html` | 화면·기능 전부 (CSS + 화면 스크립트). 수정은 대부분 여기서 합니다. 이 파일이 원본입니다. |
| `firebase-app.js` | 로그인 화면, 승인 확인, Firestore 연결(화면 코드가 쓰는 `window.claude.use("db" \| "user" \| "downloads")` 모양으로 감쌈), 관리 메뉴(사용자 승인·백업·가져오기), 서비스 워커 등록 |
| `firestore.rules` | 접근 규칙 사본. 바꾸면 사용자가 Firebase 콘솔 → Firestore → 규칙에 붙여넣고 게시해야 반영됩니다(저장소에 올려도 자동 반영 안 됨). |
| `manifest.webmanifest`, `sw.js`, `icon-*.png`, `namu.ico` | PC·휴대폰 설치(PWA), 앱 아이콘 |
| `logo.png`, `thumb.png` | 왼쪽 위 로고(나무+NAMU), 사진 없는 건물 카드 그림 |

## 데이터 구조 (Firestore 컬렉션)

- `buildings/{bid}`: 건물 (name, addr, order, price·loan(만원), rate, land, bldg, gfa, parking, approved(사용승인일), usage(건축물 용도), zone(용도지역), structure(구조), floors(층수), comp, memo, footer, 허그: hugAppr(감정평가액), hugPub(공시가격) — 예전 hugPrice+hugSrc도 읽음, hugDate(감정평가일자), hugPrelim(예비 감정평가 — 실제는 공시가격×140%로 계산, '예비 감정평가로 예상 계산' 버튼으로 예상치 보기), hugLord·hugTen(적용 %, 기본 100·90), hugMort(근저당 채권최고액 합계), hugUnit(계약 호실 uid), hugDep(계약 보증금, 0이면 그 호실 보증금), hugLordIssued·hugLordDate(임대인 보증 발급 여부·발급일), hugMulti(다세대 호실별 계산 — 현화리 290-4), hugRefUnit·hugRefPrice(기준 호실과 그 감정평가금액 → 1㎡당 금액; 다세대면 건물 감정평가액 = 1㎡당 × 전체 면적 합으로 자동))
- `units/{uid}`: 호실 (bid, ho, order, name, phone, deposit, rent, mgmt, payDay, moveIn, expiry, term, carry, limit, memo, type, autoBill, terminate·termExpiry·termBase·termMode·noticeDate·termRenewed, implied·prevExpiry·origExpiry, newContract·newAt·moveInPlan, foreign(외국인 — 허그 선순위 계산에 최우선변제금 4,800만), area(전용면적 ㎡, 다세대 허그 계산용), next(새 계약 때 들어올 임차인 {name, phone, deposit, rent, mgmt, payDay, expiry, memo} — 호실 화면 '입주 처리'로 지금 임차인 자리에 옮김), prevTenants(옛 형식 — 열면 meta/departed로 옮겨짐), pub(호실 공시가격 — 다세대는 호실별 합이 건물 공시가격, 호실 주택가격 = pub×140%))
- `ledgers/{uid}`: `{rows:[{due, rent, mgmt, rDate, rType, rAmt, mDate, mType, mAmt, note, sub?}]}` — 입금은 rDate/rAmt 한 칸에 적음(mDate/mAmt는 옛 자료 호환용), `sub:true` = 위 청구에 딸린 추가 입금 줄
- `market/{bid}`: 매물장 시세 (price, loan, rate, rows:[{floor, ho, dep, rent, type, note}], footer) — 단위 만원
- `meta/loans`: `{rows:[{bid, label, bank, amount, rate, kind, months, start, memo}]}` 이자·지출 화면 (`bid:"etc"` = 건물과 상관없는 기타 대출; kind `int`=이자만(기본) · `eq`=원리금균등 · `pr`=원금균등, months=총 기간(개월), start=대출 시작일 → 이번 달 이자·남은 원금·월 상환액 계산. rate는 소수(0.045))
- `meta/expenses`: `{rows:[{bid, name, amount, cycle:"m"|"y", memo}], jong:[{label, amount, memo}×3]}` 건물별 공과금·관리 비용과 종부세 3칸(1년 금액) — 둘 다 **지출** 탭(`#costs`)에서 입력, 이자는 이자계산(`#loans`)에서 가져와 한 달 지출 정리. 순수익 = 월세+관리비(자동 청구 되는 호실만, `totals().ia`) − 이자 − 지출(1년 금액은 ÷12). 자동 청구 안 하는 호실 금액은 "포함 시"로 따로 표시 · `meta/autobill`: 자동 청구 잠금
- `meta/hug`: 허그 기준 비율 `{lm:.6, ld:.9, tm:.6, tp:.8, td:1}` (임대인 담보·부채, 임차인 담보·선순위채권·부채). 건물별 화면 **허그 보증보험 확인** 카드: 선순위 보증금 = 계약 호실 뺀 나머지 보증금, 외국인은 max(보증금, 4,800만), 101호 공실은 1,000만, 그 밖의 공실은 4,800만(따로 표시). 주택가액 = 감정평가액(있고 유효하면), 아니면 공시가격×140%, 그 뒤 임대인 100%·임차인 90%. 감정평가 유효기간 = 평가일+6개월(임대인 보증 발급 시 평가일+2년, 연장) → 허그 칸과 Home 다가오는 일정에 표시. 원본 엑셀 '허그 보증보험 계산.xlsx'와 같은 식
- `meta/departed`: `{rows:[{uid, bid, ho, name, phone, deposit, rent, mgmt, moveIn, expiry, out}]}` 나간 임차인(입주 처리 때 추가). 만기 알림 화면 아래에 모아 보여주고, 퇴실일+3개월 지나면 앱을 열 때 자동 삭제
- `photos/{bid}`: 건물 사진 `{data: JPEG data URI, w, h, at}` — 화면에서 최대 1280px로 줄여 약 700KB 이하로 저장. Firebase Storage는 결제 요금제가 필요해서 쓰지 않음
- `access/{email}`: `{role: "edit" | "view", at}` 승인 목록 (관리자만 쓰기)
- `meta/backup`: `{at, by}` 마지막 백업 시각. 머리글 **⤓ 백업** 버튼(관리자만)이 30일 지나면 진하게 바뀜

## 백업

머리글 ⤓ 백업 = 관리 → 백업 파일 내려받기: buildings·units·ledgers·market·meta(loans)·photos를 `NAMU_backup_YYYY-MM-DD_HHMM.json` `{id, at, cols}`로 받음. 가져오기는 사진까지 되돌림(사진은 파일에 없어도 지우지 않음).
사용자가 이 파일을 채팅에 올리고 "백업해줘"라고 하면 claude.ai 프로젝트 "희재 작업장"의 `백업/` 폴더에 `project_write`(local_path)로 원래 이름 그대로 저장하고 건물·호실·입금내역·사진 수를 알린다. 자세한 절차는 프로젝트 문서 `claude/NAMU 앱 수정 안내.md`. 백업 파일은 이 저장소에 절대 넣지 않는다.

화면: 첫 화면은 **오늘의 요약**(`#sum`, 빈 주소도 여기) — 간단한 핵심 지표 7칸, 이번 달 수금(지난달 같은 날 비교), 3개월 안 일정(만기·해지 퇴실·입주 예정), 건물 카드. 전체 현황은 `#home`.

입력 중 화면 갱신: `sched()`는 30ms 뒤 포커스를 보고 입력 칸에 있으면 미룸(칸을 옮기는 순간 다시 그려 다음 칸 입력이 날아가던 문제 방지). 이자계산의 대출 줄은 건물을 바꿔도 그 줄을 다 채우고 나갈 때 건물 묶음으로 옮김(`S.lfz`).

주요 계산: 미납 = 월세+관리비−입금(청구일이 지난 줄만, sub 줄은 입금만 뺌). 만기는 계약기간(입주일~만기일)만큼 묵시적갱신. 자동 청구는 차임일 당일, 마지막 청구 후 92일 넘으면 멈춤.

## 수정하는 순서

1. `git pull` 후 `index.html`(필요하면 `firebase-app.js`)을 고칩니다. 바꾼 곳 외에는 건드리지 않습니다.
2. 스크립트 문법을 확인합니다: `index.html`의 각 `<script>` 블록을 꺼내 `node --check`, `firebase-app.js`는 `node --check --input-type=module`.
3. 화면을 봅니다: `python3 -m http.server 8765 &` 후 `node dev/smoke-test.js` (Firebase SDK를 `dev/fbstub/`의 가짜 모듈로 바꿔 끼워 관리자 로그인까지 확인, `BACKUP=<백업 json 경로>`를 주면 가져오기까지). 백업 json은 사용자에게 받은 것을 작업 폴더 밖에만 두고 저장소에 넣지 않습니다. PC 폭과 휴대폰 폭(390px), 밝은/어두운 화면을 봅니다.
4. 커밋 메시지는 한국어로 무엇을 바꿨는지 씁니다. `main`에 바로 push 하면 1~2분 뒤 앱에 반영됩니다.
5. `sw.js`가 화면 파일을 저장해 두므로, 큰 변경 뒤에는 `CACHE` 이름 숫자를 올려(`namu-shell-v2` …) 새 버전을 바로 받게 합니다.

## 꼭 지킬 것

- 세입자 데이터(이름·연락처·입금, 백업 json, 단독 html, 엑셀)를 저장소에 절대 올리지 않습니다. 저장소는 공개입니다.
- 저장 형식이 바뀌는 수정(필드 이름 변경, 구조 변경)은 먼저 사용자에게 알리고, 기존 데이터를 새 형식으로 읽거나 옮기는 코드를 함께 넣습니다. 데이터를 지우는 변경은 사용자 확인 없이 하지 않습니다.
- `firebase-app.js`의 `OWNER`와 `firestore.rules`의 관리자 이메일은 항상 같아야 합니다. 규칙을 바꾸면 사용자에게 붙여넣을 전체 규칙을 채팅으로 줍니다.
- 결제(Blaze) 요금제가 필요한 기능(Cloud Functions, Storage 등)은 쓰지 않습니다.
- 화면 글은 한국어, 숫자는 가운데 정렬, 색은 CSS 토큰(`--accent`, `--renew-bg`, `--term-bg`, `--new-bg` 등)만 씁니다. 묵시적갱신=초록 배경, 계약 해지=빨강 배경, 새 계약=파랑 배경입니다.
- 사용자에게 설명할 때는 코드 용어 대신 화면에서 보이는 말로 짧게 말합니다.
