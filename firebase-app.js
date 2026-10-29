/* NAMU 주택관리 — Firebase 연결 (로그인 · 승인 확인 · 저장소 · 관리 메뉴)
   index.html 의 화면 코드는 window.claude.use("db" | "user" | "downloads") 로 저장소를 씁니다.
   이 파일이 그 자리를 Firebase(Firestore + Authentication)로 채웁니다. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc as fdoc, collection as fcol, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgc-StFXLkq0tKjJop2mTPlOxRJLvVzG4",
  authDomain: "namu-hj.firebaseapp.com",
  projectId: "namu-hj",
  storageBucket: "namu-hj.firebasestorage.app",
  messagingSenderId: "719484124331",
  appId: "1:719484124331:web:f6e071034da5482b000bee"
};
/* 관리자(승인 목록을 고칠 수 있는 사람). firestore.rules 의 이메일과 같아야 합니다. */
const OWNER = "matht2353@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let fs;
try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { fs = initializeFirestore(app, {}); }

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clean = (o) => JSON.parse(JSON.stringify(o)); /* Firestore 는 undefined 를 받지 않음 */
const mapErr = (e) => ({ code: e && e.code === "permission-denied" ? "invalid_argument" : (e && e.code) || "unavailable", message: (e && e.message) || String(e) });

/* ---------- 저장소: 화면 코드가 쓰는 모양 그대로 ---------- */
function snapDoc(s) { return { id: s.id, exists: s.exists(), data: () => (s.exists() ? s.data() : undefined), metadata: { fromCache: s.metadata.fromCache, hasPendingWrites: s.metadata.hasPendingWrites } }; }
function docRef(path) {
  const r = fdoc(fs, path);
  return {
    id: r.id, path,
    get: () => getDoc(r).then(snapDoc, (e) => Promise.reject(mapErr(e))),
    set: (d) => setDoc(r, clean(d)).catch((e) => Promise.reject(mapErr(e))),
    update: (d) => updateDoc(r, clean(d)).catch((e) => Promise.reject(mapErr(e))),
    delete: () => deleteDoc(r).catch((e) => Promise.reject(mapErr(e))),
    onSnapshot: (next, err) => onSnapshot(r, (s) => next(snapDoc(s)), (e) => err && err(mapErr(e))),
    /* 자동 청구가 여러 기기에서 겹치지 않게 하는 짧은 잠금 */
    acquire: (o) => runTransaction(fs, async (tx) => {
      const s = await tx.get(r), now = Date.now(), cur = s.exists() ? s.data() : {};
      if (cur.leaseUntil && cur.leaseUntil > now && cur.holder !== o.holder) return { acquired: false };
      tx.set(r, { holder: o.holder, leaseUntil: now + (o.ttlMs || 30000) }, { merge: true });
      return { acquired: true };
    }).catch(() => ({ acquired: false })),
    collection: (c) => colRef(path + "/" + c)
  };
}
function colRef(path) {
  const r = fcol(fs, path);
  return {
    path,
    doc: (id) => docRef(path + "/" + (id || Math.random().toString(36).slice(2, 12))),
    get: () => getDocs(r).then((q) => ({ docs: q.docs.map(snapDoc), size: q.size, empty: q.empty })),
    onSnapshot: (next, err) => onSnapshot(r, (q) => next({ docs: q.docs.map(snapDoc), size: q.size, empty: q.empty, metadata: { fromCache: q.metadata.fromCache, hasPendingWrites: q.metadata.hasPendingWrites }, docChanges: () => [] }), (e) => err && err(mapErr(e)))
  };
}
const db = { doc: docRef, collection: colRef };

const downloads = { save: (o) => { const b = o.data instanceof Blob ? o.data : new Blob([o.data]); const u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = o.filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 1500); return Promise.resolve({ status: "saved" }); } };

/* ---------- 로그인 화면 ---------- */
let role = null, me = null, started = false, pending = null;
function loginView(msg, kind) {
  const L = $("#login"); L.hidden = false;
  L.innerHTML = `<div class="lg-card"><div class="lg-brand"><img src="./logo-lg.png?v=3" alt="NAMU" width="260" height="130"><em>주택관리</em></div>
  <form id="lg-form" autocomplete="on"><label for="lg-email">이메일</label><input class="inp" id="lg-email" type="email" autocomplete="username" required>
  <label for="lg-pw">비밀번호</label><input class="inp" id="lg-pw" type="password" autocomplete="current-password" required>
  <button type="submit" class="btn p lg-go" id="lg-go">로그인</button></form>
  <button type="button" class="btn ghost sm" id="lg-reset">비밀번호를 잊으셨나요? 재설정 메일 받기</button>
  <p class="lg-msg ${kind || ""}" id="lg-msg">${msg ? esc(msg) : "승인받은 계정만 들어올 수 있습니다. 계정이 필요하면 관리자에게 요청하세요."}</p></div>`;
  const lg = $("#lg-logo"); if (lg && window.__namuTree) lg.innerHTML = window.__namuTree(42);
  $("#lg-form").addEventListener("submit", (e) => {
    e.preventDefault(); const em = $("#lg-email").value.trim(), pw = $("#lg-pw").value;
    $("#lg-go").disabled = true; $("#lg-msg").textContent = "로그인 중…"; $("#lg-msg").className = "lg-msg";
    signInWithEmailAndPassword(auth, em, pw).catch((err) => {
      $("#lg-go").disabled = false;
      const c = err && err.code || "";
      $("#lg-msg").className = "lg-msg bad";
      $("#lg-msg").textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? "이메일 또는 비밀번호가 맞지 않습니다." :
        /too-many-requests/.test(c) ? "여러 번 틀려서 잠시 막혔습니다. 몇 분 뒤 다시 시도하거나 비밀번호를 재설정하세요." :
        /user-disabled/.test(c) ? "사용이 중지된 계정입니다. 관리자에게 문의하세요." :
        /unauthorized-domain/.test(c) ? "이 주소가 Firebase 승인된 도메인에 없습니다 (관리자 설정 필요)." :
        /network/.test(c) ? "인터넷 연결을 확인해 주세요." : "로그인하지 못했습니다: " + c;
    });
  });
  $("#lg-reset").addEventListener("click", () => {
    const em = $("#lg-email").value.trim(); if (!em) { $("#lg-msg").className = "lg-msg bad"; $("#lg-msg").textContent = "위에 이메일을 먼저 적어 주세요."; return; }
    sendPasswordResetEmail(auth, em).then(() => { $("#lg-msg").className = "lg-msg ok"; $("#lg-msg").textContent = em + " 로 재설정 메일을 보냈습니다(등록된 계정인 경우). 받은편지함과 스팸함을 확인하세요."; })
      .catch(() => { $("#lg-msg").className = "lg-msg bad"; $("#lg-msg").textContent = "재설정 메일을 보내지 못했습니다. 이메일을 확인해 주세요."; });
  });
  setTimeout(() => { const e = $("#lg-email"); if (e) e.focus(); }, 50);
}

function startApp() {
  if (started) return; started = true;
  $("#login").hidden = true;
  window.__namuIsOwner = role === "owner";
  const who = $("#who"); if (who) { who.hidden = false; who.title = me.email; who.innerHTML = `<span>${esc(me.email)}${role === "view" ? " · 보기 전용" : role === "owner" ? " · 관리자" : ""}</span>${role === "owner" ? '<button type="button" class="btn sm" id="bk-go" title="지금 데이터를 백업 파일로 내려받기">⤓ 백업</button><button type="button" class="btn sm" id="adm-open">관리</button>' : ""}<button type="button" class="btn sm ghost" id="lg-out">로그아웃</button>`; }
  if (role === "owner") onSnapshot(fdoc(fs, "meta/backup"), (d) => { lastBk = d.exists() ? d.data().at : ""; bkLabel(); }, () => {});
  window.__namuResolve({ db, user: { can: (n) => n === "data.write" ? role !== "view" : true, isOwner: () => role === "owner", canEdit: () => role !== "view" }, downloads });
}

onAuthStateChanged(auth, async (u) => {
  if (!u) { if (started) { location.reload(); return; } const m = pending; pending = null; loginView(m && m[0], m && m[1]); return; }
  me = u; const em = (u.email || "").toLowerCase();
  if (em === OWNER) { role = "owner"; startApp(); return; }
  try {
    const s = await getDoc(fdoc(fs, "access/" + em));
    if (!s.exists()) { pending = ["승인되지 않은 계정입니다. 관리자에게 승인을 요청하세요.", "bad"]; await signOut(auth); return; }
    role = s.data().role === "view" ? "view" : "edit"; startApp();
  } catch (e) { pending = ["승인 여부를 확인하지 못했습니다. 잠시 뒤 다시 로그인해 주세요.", "bad"]; await signOut(auth); }
});
setPersistence(auth, browserLocalPersistence).catch(() => {});

/* ---------- 관리 메뉴 (관리자만) ---------- */
let accUnsub = null, acc = [];
function adminView() {
  let o = $("#adm"); if (!o) { o = document.createElement("div"); o.id = "adm"; o.className = "pm-bg"; o.setAttribute("role", "dialog"); o.setAttribute("aria-label", "관리"); document.body.appendChild(o); }
  const rows = acc.map((a) => `<tr><td class="l">${esc(a.id)}</td><td><select class="sel" data-adm-role="${esc(a.id)}"><option value="edit"${a.role !== "view" ? " selected" : ""}>편집</option><option value="view"${a.role === "view" ? " selected" : ""}>보기</option></select></td><td class="num muted">${esc(a.at || "")}</td><td><button type="button" class="btn sm ghost danger" data-adm-del="${esc(a.id)}">승인 취소</button></td></tr>`).join("");
  o.innerHTML = `<div class="pm-card"><div class="pm-h"><b>관리</b><button type="button" class="btn sm ghost" id="adm-close">✕ 닫기</button></div>
  <div class="adm-sec"><h4>사용자 승인</h4><p class="note">Firebase 콘솔 → Authentication → 사용자 추가로 계정을 만든 뒤, 여기서 그 이메일을 승인해야 데이터가 보입니다. 승인을 취소하면 바로 막힙니다.</p>
  <form id="adm-add" class="adm-add"><input class="inp" id="adm-email" type="email" placeholder="승인할 이메일" required><select class="sel" id="adm-role"><option value="edit">편집 (입력·수정)</option><option value="view">보기 (읽기만)</option></select><button type="submit" class="btn p">승인</button></form>
  <div class="scroller"><table class="tbl"><thead><tr><th class="l">이메일</th><th>권한</th><th>승인일</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">아직 승인한 사람이 없습니다. 관리자(본인)는 승인 없이 들어올 수 있습니다.</td></tr>'}</tbody></table></div></div>
  <div class="adm-sec"><h4>데이터</h4><div class="adm-btns"><button type="button" class="btn" id="adm-backup">⤓ 백업 파일 내려받기</button><button type="button" class="btn t" id="adm-import">⤒ 단독 파일·백업 가져오기</button></div>
  <p class="note">위쪽 <b>⤓ 백업</b> 버튼으로도 한 번에 받을 수 있고, 30일이 지나면 버튼이 진하게 바뀝니다. 받은 파일을 Claude 채팅에 올리면 Claude 프로젝트에도 보관됩니다. 백업 파일과 claude.ai에서 만든 단독 HTML 파일 모두 가져올 수 있고, 가져오기 전에 달라진 내용을 먼저 보여줍니다.</p></div></div>`;
}
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.id === "lg-out") { signOut(auth); return; }
  if (t.id === "adm-open") {
    if (!accUnsub) accUnsub = onSnapshot(fcol(fs, "access"), (q) => { acc = q.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id < b.id ? -1 : 1); if ($("#adm")) adminView(); }, () => {});
    adminView(); return;
  }
  if (t.id === "adm-close" || t.id === "adm") { const o = $("#adm"); if (o) o.remove(); return; }
  if (t.getAttribute && t.getAttribute("data-adm-del")) {
    const em = t.getAttribute("data-adm-del");
    if (t.dataset.armed !== "1") { t.dataset.armed = "1"; t.textContent = "정말 취소?"; t.classList.add("armed"); setTimeout(() => { if (t.isConnected) { t.dataset.armed = ""; t.textContent = "승인 취소"; t.classList.remove("armed"); } }, 3000); return; }
    deleteDoc(fdoc(fs, "access/" + em)); return;
  }
  if (t.id === "adm-backup" || t.id === "bk-go") { backup(); return; }
  if (t.id === "adm-import") { const o = $("#adm"); if (o) o.remove(); const b = document.createElement("button"); b.setAttribute("data-act", "imp-open"); b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); return; }
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "adm-add") return; e.preventDefault();
  const em = $("#adm-email").value.trim().toLowerCase(), r = $("#adm-role").value; if (!em) return;
  if (em === OWNER) { alertMsg("관리자는 따로 승인하지 않아도 됩니다."); return; }
  const d = new Date(), at = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  setDoc(fdoc(fs, "access/" + em), { role: r, at }).then(() => alertMsg(em + " 승인 완료"), (er) => alertMsg("승인하지 못했습니다: " + (er.code || er)));
});
document.addEventListener("change", (e) => {
  const em = e.target.getAttribute && e.target.getAttribute("data-adm-role"); if (!em) return;
  updateDoc(fdoc(fs, "access/" + em), { role: e.target.value });
});
function alertMsg(m, ms) { const t = $("#toast"); if (!t) return; t.textContent = m; t.hidden = false; clearTimeout(alertMsg.t); alertMsg.t = setTimeout(() => { t.hidden = true; }, ms || 2600); }
/* 백업: 머리글 ⤓ 백업 버튼 한 번. 마지막 백업 날짜는 meta/backup 에 적고, 30일 지나면 버튼을 강조 */
let lastBk = "", bkBusy = false;
function bkLabel() {
  const b = $("#bk-go"); if (!b) return;
  const days = lastBk ? Math.floor((Date.now() - new Date(lastBk).getTime()) / 864e5) : null, due = days === null || days >= 30;
  b.className = "btn sm" + (due ? " p" : "");
  b.textContent = bkBusy ? "백업 중…" : due ? (days === null ? "⤓ 백업 필요" : `⤓ 백업 필요 (${days}일 전)`) : `⤓ 백업 · ${lastBk.slice(5, 7)}/${lastBk.slice(8, 10)}`;
  b.title = lastBk ? `마지막 백업 ${lastBk.slice(0, 16).replace("T", " ")}` : "아직 백업한 적이 없습니다";
}
async function backup() {
  if (bkBusy) return; bkBusy = true; bkLabel();
  try {
  alertMsg("백업 파일을 만드는 중입니다…");
  const cols = {};
  for (const c of ["buildings", "units", "ledgers", "market", "meta", "photos"]) { cols[c] = {}; const q = await getDocs(fcol(fs, c)); q.forEach((d) => { if (!(c === "meta" && d.id !== "loans" && d.id !== "expenses" && d.id !== "hug" && d.id !== "departed")) cols[c][d.id] = d.data(); }); }
  const d = new Date(), p = (n) => String(n).padStart(2, "0"), at = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  const id = at.replace(/\D/g, "");
  await downloads.save({ filename: `NAMU_backup_${at.slice(0, 10)}_${p(d.getHours())}${p(d.getMinutes())}.json`, data: new Blob([JSON.stringify({ id, at, cols })], { type: "application/json" }) });
  const iso = new Date().toISOString();
  try { await setDoc(fdoc(fs, "meta/backup"), { at: iso, by: me.email }); lastBk = iso; } catch (e) {}
  alertMsg("백업 파일을 내려받았습니다. 이 파일을 Claude 채팅에 올리고 '백업해줘'라고 하시면 Claude에도 보관됩니다.", 7000);
  } catch (e) { alertMsg("백업하지 못했습니다: " + (e && e.message || e), 6000); }
  finally { bkBusy = false; bkLabel(); }
}

/* PC·휴대폰 설치(PWA) */
if ("serviceWorker" in navigator) { window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => {}); }); }
