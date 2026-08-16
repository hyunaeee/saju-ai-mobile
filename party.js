/* =====================================================================
 * party.js — 모임 관계 탐험 (친구들끼리 각자 입력 → 관계망 랭킹·그래프)
 *   · 사주 일주(일간·일지) 기반: 천간합·육합·삼합·충·천을귀인·오행 상생/상극
 *   · 서버(KV) 있으면 실시간 공동 파티, 없으면 URL 링크 체인으로 동작
 *   saju.js 의 전역(dayPillar, STEMS, BRANCHES, ELEMENTS, GENERATES, CONTROLS,
 *   hapStem, YUKHAP, SAMHAP_GROUP, SAMHAP_MEMBERS, chungBranch, CHEONEUL,
 *   DIR_OF_BRANCH)을 재사용합니다.
 * ===================================================================== */

const CFG = window.CHEONGIYEON_CONFIG || {};
const API = (p) => (CFG.apiBase || "") + p;
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ---------- 관계 유형 메타 ---------- */
const REL = {
  overcome:  { icon: "🔥", label: "운명을 극복한 인연", color: "#8e44ad",
    desc: "부딪히는 기운이 있는데도 서로를 살리는 사이입니다. 티격태격해도 결국 서로를 더 단단하게 만드는, 악연을 이겨낸 귀한 인연입니다." },
  spouse:    { icon: "💞", label: "전생의 부부", color: "#c0392b",
    desc: "천간이 하나로 합쳐지는 기운. 전생에 부부였다 할 만큼 서로에게 끌리고 편안한 운명의 짝입니다." },
  lifelong:  { icon: "🌿", label: "평생 인연", color: "#b8860b",
    desc: "육합(六合)의 인연. 곁에 두면 오래도록 편안하고, 평생 함께 가면 좋은 사이입니다." },
  season:    { icon: "🍀", label: "시절인연", color: "#3d7a5c",
    desc: "삼합(三合)의 인연. 한 시절 함께 도모하면 서로의 운을 크게 끌어올리는 사이 — 같이 일을 벌이기 좋습니다." },
  benefactor:{ icon: "🤝", label: "서로의 귀인", color: "#2f5d8a",
    desc: "천을귀인(天乙貴人)으로 이어진 사이. 결정적인 순간에 서로를 끌어주는, 어려울 때 먼저 찾게 되는 인연입니다." },
  helpEach:  { icon: "♻️", label: "서로 돕는 사이", color: "#0e8a8a",
    desc: "오행이 서로를 살리는 상생(相生). 함께 있을수록 둘 다 기운이 오르는 사이입니다." },
  helpOne:   { icon: "➡️", label: "한쪽이 밀어주는 사이", color: "#4f9d9d",
    desc: "한 사람이 다른 사람의 기운을 살려주는 관계. 응원하고 이끌어주는 든든한 사이입니다." },
  sibling:   { icon: "👫", label: "전생의 형제자매", color: "#a8842f",
    desc: "같은 기운을 타고난 동기(同氣). 전생에 피를 나눈 듯 말이 통하고, 내 편 같은 사이입니다." },
  enemy:     { icon: "⚡", label: "전생의 악연", color: "#7a3a2a",
    desc: "정면으로 부딪히는 충(沖)의 기운. 오래 붙어 있으면 감정 소모가 크니, 적당한 거리가 오히려 약이 되는 사이입니다." },
  tension:   { icon: "〰️", label: "긴장 관계", color: "#8a6d3b",
    desc: "한쪽이 다른 쪽을 누르는 상극(相剋). 역할이 분명하면 오히려 시너지가 나기도 합니다." },
  neutral:   { icon: "·", label: "무던한 사이", color: "#b0a692",
    desc: "특별한 끌림도 부딪힘도 적은, 담백하고 편한 사이입니다." },
};
const REL_ORDER = ["spouse", "lifelong", "season", "benefactor", "helpEach", "overcome", "sibling", "helpOne", "enemy", "tension", "neutral"];

/* ---------- 한 쌍 분석 ---------- */
function analyzePair(A, B) {
  const stemHap = hapStem(A.stem) === B.stem;
  const yukhap = YUKHAP[A.branch] === B.branch;
  const samhap = SAMHAP_GROUP[A.branch] === SAMHAP_GROUP[B.branch] && A.branch !== B.branch;
  const chung = chungBranch(A.branch) === B.branch;
  const gwiinAB = (CHEONEUL[A.stem] || []).includes(B.branch); // B가 A의 귀인
  const gwiinBA = (CHEONEUL[B.stem] || []).includes(A.branch); // A가 B의 귀인
  const shengAB = GENERATES[A.el] === B.el; // A가 B를 살림
  const shengBA = GENERATES[B.el] === A.el;
  const keAB = CONTROLS[A.el] === B.el;
  const keBA = CONTROLS[B.el] === A.el;
  const sameEl = A.el === B.el;
  const overcome = chung && (stemHap || yukhap || samhap || shengAB || shengBA);

  // 점수(친밀도) 0~100
  let s = 50;
  if (stemHap) s += 25;
  if (yukhap) s += 22;
  if (samhap) s += 16;
  if (gwiinAB || gwiinBA) s += 12;
  if (shengAB) s += 6; if (shengBA) s += 6;
  if (sameEl) s += 8;
  if (chung) s -= 28;
  if (keAB) s -= 6; if (keBA) s -= 6;
  if (overcome) s += 20;
  s += ((A.stem * 3 + B.branch * 5 + A.branch + B.stem) % 7) - 3;
  s = Math.max(8, Math.min(98, s));

  let type;
  if (overcome) type = "overcome";
  else if (stemHap) type = "spouse";
  else if (yukhap) type = "lifelong";
  else if (samhap) type = "season";
  else if (gwiinAB || gwiinBA) type = "benefactor";
  else if (shengAB && shengBA) type = "helpEach";
  else if (sameEl) type = "sibling";
  else if (shengAB || shengBA) type = "helpOne";
  else if (chung) type = "enemy";
  else if (keAB || keBA) type = "tension";
  else type = "neutral";

  // 방향 문구(귀인/밀어주기)
  let dirNote = "";
  if (type === "benefactor") {
    if (gwiinAB && gwiinBA) dirNote = `서로가 서로의 귀인입니다.`;
    else if (gwiinAB) dirNote = `${B.name}가 ${A.name}의 귀인입니다.`;
    else dirNote = `${A.name}가 ${B.name}의 귀인입니다.`;
  } else if (type === "helpOne") {
    dirNote = shengAB ? `${A.name}가 ${B.name}의 기운을 밀어줍니다.` : `${B.name}가 ${A.name}의 기운을 밀어줍니다.`;
  }

  return { a: A.name, b: B.name, ai: A.idx, bi: B.idx, type, score: s, dirNote,
           flags: { gwiinAB, gwiinBA, shengAB, shengBA } };
}

/* ---------- 모임 전체 분석 ---------- */
function analyzeParty(rawPeople) {
  const members = rawPeople.map((p, idx) => {
    const dp = dayPillar(p.y, p.m, p.d);
    return { ...p, idx, stem: dp.stem, branch: dp.branch, el: STEMS[dp.stem].el,
             ganji: STEMS[dp.stem].kor + BRANCHES[dp.branch].kor };
  });

  const pairs = [];
  for (let i = 0; i < members.length; i++)
    for (let j = i + 1; j < members.length; j++)
      pairs.push(analyzePair(members[i], members[j]));

  // 사람별 집계
  const sum = members.map(() => 0);
  const help = members.map(() => 0); // 남을 돕는(귀인/밀어주기) 횟수
  pairs.forEach(p => {
    sum[p.ai] += p.score; sum[p.bi] += p.score;
    if (p.flags.gwiinAB || p.flags.shengBA) help[p.bi]++; // b가 a를 도움
    if (p.flags.gwiinBA || p.flags.shengAB) help[p.ai]++;
  });
  const avg = members.map((m, i) => members.length > 1 ? sum[i] / (members.length - 1) : 0);

  // 중심: 평균 친밀도 최고
  const centerIdx = members.map((_, i) => i).sort((a, b) => avg[b] - avg[a])[0];
  // 조력자: 남을 가장 많이 돕는 사람
  const helperIdx = members.map((_, i) => i).sort((a, b) => help[b] - help[a])[0];

  const byType = {};
  REL_ORDER.forEach(t => { byType[t] = pairs.filter(p => p.type === t); });

  const bestPair = [...pairs].sort((a, b) => b.score - a.score)[0];
  const worstPair = [...pairs].sort((a, b) => a.score - b.score)[0];

  return { members, pairs, byType, avg, help,
    center: members[centerIdx], helper: members[helperIdx],
    bestPair, worstPair };
}

/* ---------- 관계망 그래프 (SVG) ---------- */
function graphSVG(an) {
  const n = an.members.length;
  const S = 380, cx = S / 2, cy = S / 2, R = n <= 2 ? 90 : 138, nr = n > 8 ? 22 : 26;
  const pos = an.members.map((_, i) => {
    const ang = (-90 + i * 360 / n) * Math.PI / 180;
    return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });

  // 엣지 (약한 건 흐리게, 특수 관계는 진하게 위로)
  const strong = ["spouse", "lifelong", "season", "benefactor", "helpEach", "overcome"];
  const edges = an.pairs.slice().sort((a, b) => a.score - b.score).map(p => {
    const A = pos[p.ai], B = pos[p.bi], meta = REL[p.type];
    const w = 1 + (p.score / 100) * 4.5;
    const op = p.type === "neutral" ? 0.18 : Math.max(0.3, Math.min(0.85, p.score / 110));
    const dash = (p.type === "enemy") ? ` stroke-dasharray="5 4"` : "";
    return `<line x1="${A.x.toFixed(1)}" y1="${A.y.toFixed(1)}" x2="${B.x.toFixed(1)}" y2="${B.y.toFixed(1)}" stroke="${meta.color}" stroke-width="${w.toFixed(1)}" stroke-opacity="${op.toFixed(2)}" stroke-linecap="round"${dash}/>`;
  }).join("");

  const nodes = an.members.map((m, i) => {
    const isCenter = m.idx === an.center.idx;
    const nm = m.name.length > 4 ? m.name.slice(0, 3) + "…" : m.name;
    return `<g>
      ${isCenter ? `<circle cx="${pos[i].x.toFixed(1)}" cy="${pos[i].y.toFixed(1)}" r="${nr + 5}" fill="none" stroke="#b8860b" stroke-width="2.5"/>` : ""}
      <circle cx="${pos[i].x.toFixed(1)}" cy="${pos[i].y.toFixed(1)}" r="${nr}" fill="${isCenter ? "#fbeee0" : "#fffefb"}" stroke="${isCenter ? "#b8860b" : "#d6cdb8"}" stroke-width="1.5"/>
      <text x="${pos[i].x.toFixed(1)}" y="${(pos[i].y + 1).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${nr > 24 ? 12 : 11}" font-weight="700" fill="#221d15" font-family="'Noto Sans KR',sans-serif">${nm}</text>
      ${isCenter ? `<text x="${pos[i].x.toFixed(1)}" y="${(pos[i].y + nr + 12).toFixed(1)}" text-anchor="middle" font-size="9" fill="#b8860b" font-weight="700">중심</text>` : ""}
    </g>`;
  }).join("");

  return `<svg viewBox="0 0 ${S} ${S}" class="party-graph" xmlns="http://www.w3.org/2000/svg">${edges}${nodes}</svg>`;
}

/* ---------- 결과 렌더 ---------- */
function renderResults(an) {
  const box = $("#party-result");
  const n = an.members.length;

  const legendTypes = REL_ORDER.filter(t => an.byType[t].length && t !== "neutral");
  const legend = legendTypes.map(t =>
    `<span class="lg"><i style="background:${REL[t].color}"></i>${REL[t].icon} ${REL[t].label}</span>`).join("");

  // 랭킹 하이라이트
  const chips = [];
  chips.push(`<div class="rk"><b>🌟 이 모임의 중심</b><p><b>${an.center.name}</b> — 모두와 두루 잘 통해, 이 사람이 있으면 자리가 화목해집니다.</p></div>`);
  if (an.helper.idx !== an.center.idx)
    chips.push(`<div class="rk"><b>🤝 최고의 조력자</b><p><b>${an.helper.name}</b> — 남을 가장 많이 밀어주고 챙기는, 모임의 든든한 버팀목입니다.</p></div>`);
  if (an.bestPair) chips.push(`<div class="rk"><b>${REL[an.bestPair.type].icon} 최고의 케미</b><p><b>${an.bestPair.a} · ${an.bestPair.b}</b> (${an.bestPair.score}점) — ${REL[an.bestPair.type].label}</p></div>`);
  const spouse = an.byType.spouse[0];
  if (spouse) chips.push(`<div class="rk"><b>💞 전생의 부부</b><p><b>${spouse.a} · ${spouse.b}</b> — 전생에 부부였다 할 만큼 끌리는 짝입니다.</p></div>`);
  const enemy = an.byType.enemy[0];
  if (enemy) chips.push(`<div class="rk bad"><b>⚡ 전생의 악연</b><p><b>${enemy.a} · ${enemy.b}</b> — 부딪히기 쉬우니 적당한 거리가 약입니다.</p></div>`);
  const oc = an.byType.overcome[0];
  if (oc) chips.push(`<div class="rk"><b>🔥 운명을 극복한 인연</b><p><b>${oc.a} · ${oc.b}</b> — 부딪혀도 끝내 서로를 살리는 사이입니다.</p></div>`);

  // 관계 유형별 목록
  const groups = REL_ORDER.filter(t => an.byType[t].length).map(t => {
    const meta = REL[t];
    const items = an.byType[t].map(p =>
      `<div class="pair"><span class="pn">${p.a} <em>·</em> ${p.b}</span><span class="ps">${p.score}점</span>
        <p>${p.dirNote || meta.desc}</p></div>`).join("");
    return `<div class="rel-group">
      <h4 style="color:${meta.color}">${meta.icon} ${meta.label} <small>${an.byType[t].length}쌍</small></h4>
      ${items}</div>`;
  }).join("");

  box.innerHTML = `
    <div class="party-card">
      <h3 class="pc-title">관계망 지도 <small>${n}명</small></h3>
      <div class="graph-wrap">${graphSVG(an)}</div>
      <div class="legend">${legend}</div>
    </div>
    <div class="party-card">
      <h3 class="pc-title">하이라이트</h3>
      <div class="rk-grid">${chips.join("")}</div>
    </div>
    <div class="party-card">
      <h3 class="pc-title">관계 유형별 전체 보기</h3>
      ${groups}
    </div>`;
  box.classList.remove("hidden");
}

/* ===================================================================
 *  파티 상태 · 서버/URL 모드 · 화면 전환
 * =================================================================== */
let party = { name: "우리 모임", members: [] };  // members: [{name,y,m,d}]
let serverMode = null; // null=미정, true/false 캐시
let groupId = null;

function validMember(m) {
  return m && m.name && Number.isInteger(m.y) && Number.isInteger(m.m) && Number.isInteger(m.d);
}
function dedupe(list) {
  const seen = new Set(); const out = [];
  for (const m of list) { const k = `${m.name}_${m.y}_${m.m}_${m.d}`; if (!seen.has(k)) { seen.add(k); out.push(m); } }
  return out.slice(0, 12);
}

async function serverAvailable() {
  if (serverMode !== null) return serverMode;
  if (CFG.isDemoHost) { serverMode = false; return false; } // 데모는 항상 URL 모드
  try {
    const r = await fetch(API("/api/party"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ping" }) });
    const d = await r.json();
    serverMode = !!(d && d.ok && d.kv);
  } catch { serverMode = false; }
  return serverMode;
}

/* URL(#) 인코딩 — 서버 없을 때 링크 체인용 */
function encodeParty(p) {
  const compact = { n: p.name, p: p.members.map(m => [m.name, m.y, m.m, m.d]) };
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact)))).replace(/=+$/, "");
}
function decodeParty(str) {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(str))));
    return { name: o.n || "우리 모임", members: (o.p || []).map(a => ({ name: a[0], y: a[1], m: a[2], d: a[3] })).filter(validMember) };
  } catch { return null; }
}

function shareLink() {
  const base = location.origin + location.pathname;
  if (serverMode && groupId) return `${base}?g=${groupId}`;
  return `${base}#d=${encodeParty(party)}`;
}

async function copyShare() {
  const link = shareLink();
  try { await navigator.clipboard.writeText(link); toast("링크가 복사됐어요! 단톡방에 붙여넣으세요"); }
  catch { prompt("이 링크를 복사해 친구에게 보내세요", link); }
}

function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.add("hidden"), ms);
}

/* ---------- 입력 폼(생성/참여 공용) ---------- */
function memberRowHTML(name = "", date = "") {
  return `<div class="pm-row">
    <input type="text" class="pm-name" maxlength="8" placeholder="이름" value="${name}" />
    <input type="date" class="pm-date" min="1930-01-01" max="2026-12-31" value="${date}" />
    <button type="button" class="pm-del" aria-label="삭제">✕</button>
  </div>`;
}
function readRows() {
  return $$("#pm-rows .pm-row").map(r => {
    const name = r.querySelector(".pm-name").value.trim();
    const date = r.querySelector(".pm-date").value;
    if (!name || !date) return null;
    const [y, m, d] = date.split("-").map(Number);
    return { name, y, m, d };
  }).filter(Boolean);
}

/* ---------- 화면들 ---------- */
async function showCreate() {
  await serverAvailable();
  $("#view-create").classList.remove("hidden");
  $("#view-join").classList.add("hidden");
  $("#pm-rows").innerHTML = memberRowHTML() + memberRowHTML() + memberRowHTML();
}

async function showJoin() {
  $("#view-create").classList.add("hidden");
  $("#view-join").classList.remove("hidden");
  refreshJoinView();
}

function refreshJoinView() {
  $("#join-title").textContent = party.name;
  $("#join-count").textContent = `현재 ${party.members.length}명 참여 중`;
  $("#join-names").innerHTML = party.members.map(m => `<span class="tagname">${m.name}</span>`).join("") || `<span class="muted">아직 아무도 없어요 — 첫 번째로 참여해보세요!</span>`;
  if (party.members.length >= 2) renderResults(analyzeParty(party.members));
  else $("#party-result").classList.add("hidden");
}

/* ---------- 서버 헬퍼 ---------- */
async function srv(action, body) {
  const r = await fetch(API("/api/party"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
  return r.json();
}

/* ---------- 부트 ---------- */
(async function boot() {
  const qs = new URLSearchParams(location.search);
  const gid = qs.get("g");
  const hash = location.hash.startsWith("#d=") ? location.hash.slice(3) : null;

  if (gid) {
    // 서버 그룹 참여
    groupId = gid; serverMode = true;
    const d = await srv("get", { id: gid });
    if (d && d.ok && d.group) { party = d.group; showJoin(); return; }
    toast("모임을 찾을 수 없어요. 새로 만들어볼까요?");
  } else if (hash) {
    // URL 링크 체인 참여
    const p = decodeParty(hash);
    if (p) { party = p; serverMode = false; showJoin(); return; }
  }
  showCreate();
})();

// 같은 페이지에서 해시(#d=)만 바뀌는 경우에도 반영
window.addEventListener("hashchange", () => location.reload());

/* ---------- 이벤트 ---------- */
$("#pm-add").addEventListener("click", () => {
  if ($$("#pm-rows .pm-row").length >= 12) { toast("최대 12명까지 넣을 수 있어요"); return; }
  $("#pm-rows").insertAdjacentHTML("beforeend", memberRowHTML());
});
$("#pm-rows").addEventListener("click", (e) => {
  if (e.target.classList.contains("pm-del")) {
    if ($$("#pm-rows .pm-row").length <= 1) return;
    e.target.closest(".pm-row").remove();
  }
});

$("#create-run").addEventListener("click", async () => {
  const people = readRows();
  if (people.length < 2) { toast("이름과 생일을 2명 이상 입력해주세요"); return; }
  if (new Set(people.map(p => p.name)).size !== people.length) { toast("이름이 겹치지 않게 입력해주세요"); return; }
  const nm = $("#party-name").value.trim() || "우리 모임";
  party = { name: nm, members: dedupe(people) };

  renderResults(analyzeParty(party.members));
  $("#share-row").classList.remove("hidden");
  $("#party-result").scrollIntoView({ behavior: "smooth", block: "start" });

  // 공유 준비: 서버 있으면 그룹 생성해 짧은 링크
  if (await serverAvailable()) {
    const d = await srv("create", { party: party.name, members: party.members });
    if (d && d.ok) { groupId = d.id; }
  }
  $("#share-hint").textContent = serverMode
    ? "링크를 받은 친구가 본인 생일을 넣으면 자동으로 이 지도에 추가돼요."
    : "링크를 받은 친구가 본인을 추가하면 새 링크가 만들어져요. 그 링크를 다시 단톡방에 공유하면 계속 이어집니다.";
});

$("#share-copy").addEventListener("click", copyShare);
$("#share-kakao").addEventListener("click", () => {
  const link = shareLink();
  if (navigator.share) navigator.share({ title: "우리 모임 관계 지도 🔮", text: `${party.name} — 사주로 보는 우리 사이! 너도 생일 넣어봐`, url: link }).catch(() => {});
  else copyShare();
});

/* 참여 화면: 나도 추가 */
$("#join-add").addEventListener("click", async () => {
  const name = $("#join-name").value.trim();
  const date = $("#join-date").value;
  if (!name || !date) { toast("이름과 생일을 입력해주세요"); return; }
  const [y, m, d] = date.split("-").map(Number);
  const me = { name, y, m, d };
  if (party.members.some(x => x.name === name && x.y === y && x.m === m && x.d === d)) { toast("이미 참여했어요"); return; }

  if (serverMode && groupId) {
    const r = await srv("join", { id: groupId, member: me });
    if (r && r.ok) { party = r.group; $("#join-name").value = ""; $("#join-date").value = ""; refreshJoinView(); toast("추가됐어요! 지도가 업데이트됐어요"); return; }
    toast("추가에 실패했어요. 잠시 후 다시 시도해주세요"); return;
  }
  // URL 모드: 나를 넣고 새 링크 생성
  party.members = dedupe([...party.members, me]);
  refreshJoinView();
  $("#join-name").value = ""; $("#join-date").value = "";
  $("#join-share").classList.remove("hidden");
  toast("추가됐어요! 아래 새 링크를 단톡방에 다시 공유해주세요");
});
$("#join-copy").addEventListener("click", copyShare);
