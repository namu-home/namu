/* 로컬 화면 확인용 (Firebase 대신 가짜 모듈). 사용법:
   cd 저장소 && python3 -m http.server 8765 &   그리고   node dev/smoke-test.js
   관리자 로그인 → 빈 화면 → (선택) 백업 파일 가져오기 경로를 BACKUP 환경변수로 주면 가져오기까지 확인 */
const { chromium } = require("playwright");
const D = __dirname + "/fbstub/";
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
  const errs = []; p.on("pageerror", (x) => errs.push(x.message));
  for (const [u, f] of [["firebase-app.js", "app.js"], ["firebase-auth.js", "auth.js"], ["firebase-firestore.js", "fs.js"]])
    await p.route("**/firebasejs/10.12.2/" + u, (r) => r.fulfill({ path: D + f, contentType: "text/javascript" }));
  await p.goto("http://localhost:8765/"); await p.waitForTimeout(800);
  await p.evaluate(() => (window.__stubUser = "matht2353@gmail.com"));
  await p.fill("#lg-email", "matht2353@gmail.com"); await p.fill("#lg-pw", "pw"); await p.click("#lg-go"); await p.waitForTimeout(1200);
  console.log("로그인:", (await p.textContent("#who")).trim());
  if (process.env.BACKUP) {
    const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click("[data-act=imp-open]")]);
    await fc.setFiles(process.env.BACKUP); await p.waitForTimeout(500); await p.click("[data-act=imp-go]"); await p.waitForTimeout(2500);
    console.log("가져오기:", await p.textContent("#toast"), "호실 링크", await p.$$eval("a.holink", (x) => x.length));
  }
  await p.screenshot({ path: "/tmp/namu-smoke.png", fullPage: false }); console.log("스크린샷: /tmp/namu-smoke.png", "오류:", errs);
  await b.close();
})();
