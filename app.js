/* =====================================================================
 * app.js — 위저드 · 결과 · 2단 결제(기본/프리미엄) · 질문5 · 기도올리기 · 공유
 * ===================================================================== */

/* 카카오톡 공유: developers.kakao.com에서 JavaScript 키 발급 후 입력 */
const KAKAO_JS_KEY = ""; // TODO

const PRICES = { report: 9900, questions: 7900, group: 6900, wish: 4900, allpass: 19900 };
const PRODUCT_NAMES = {
  report: "심층 풀이 (13개 섹션)",
  questions: "연화에게 질문 5개",
  group: "모임 궁합 (최대 10명)",
  wish: "소원부적 · 기도올리기",
  allpass: "자유이용권 — 모든 기능",
};
const PRODUCT_DESCS = {
  report: "배우자·궁합·조심할 시기·귀인 포함 전체 열람",
  questions: "내 사주를 근거로 한 맞춤 답변",
  group: "귀인·앙숙·중재자 관계 지도",
  wish: "연화의 축원 + 디지털 부적",
  allpass: "단품 합계 29,600원 → 33% 할인",
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

/* ---------- 실행 모드 (config.js) ----------
 * tossClientKey 가 채워져 있으면 실서비스(보안) 모드 — 결제 검증·리포트 본문·질문을
 * 서버 API로 처리. 비어 있으면 데모 모드 — 전부 브라우저에서 처리(로컬 미리보기용). */
const CFG = window.CHEONGIYEON_CONFIG || {};
const SECURE = !!(CFG.tossClientKey && CFG.tossClientKey.length > 5);
const API = (path) => (CFG.apiBase || "") + path;

// 실서비스 모드에서는 데모 배너 자동 제거
if (SECURE) document.getElementById("demo-banner")?.remove();

let currentSaju = null;
let currentInput = null;

/* 서버 발급 결제 토큰 보관 (보안 모드) */
function tokenKey() { return `cheongiyeon_tokens_${sig(currentInput)}`; }
function getTokens() { try { return JSON.parse(localStorage.getItem(tokenKey()) || "[]"); } catch { return []; } }
function addToken(t) { const a = getTokens(); a.push(t); localStorage.setItem(tokenKey(), JSON.stringify(a)); }

/* ---------- 유틸 ---------- */
function showToast(msg, ms = 2400) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), ms);
}

function sig(input) {
  return `${input.y}-${input.m}-${input.d}_${input.hour}_${input.minute}_${input.gender}`;
}
function ownStore() {
  if (!currentInput) return {};
  try { return JSON.parse(localStorage.getItem(`cheongiyeon_own_${sig(currentInput)}`) || "{}"); }
  catch { return {}; }
}
function owns(product) {
  const o = ownStore();
  return !!(o.allpass || o[product]);
}
function grant(product) {
  const o = ownStore();
  o[product] = true;
  localStorage.setItem(`cheongiyeon_own_${sig(currentInput)}`, JSON.stringify(o));
  /* 제공 개시(열람 가능) 시점 기록 — 열람 후 청약철회 불가의 기준점.
   * TODO [실서비스]: 상품별 제공 개시 시점을 서버 DB에 저장하세요 (환불 분쟁 증빙).
   * 결제 승인 후 콘텐츠 제공 실패 시 토스페이먼츠 결제취소 API로 자동 전액 환불 처리. */
  localStorage.setItem(`cheongiyeon_delivered_${product}_${sig(currentInput)}`, new Date().toISOString());
}
function ownsAll() {
  return owns("report") && owns("questions") && owns("group") && owns("wish");
}
function qaState() {
  const raw = localStorage.getItem(`cheongiyeon_qa_${sig(currentInput)}`);
  return raw ? JSON.parse(raw) : { remaining: 5, history: [] };
}
function saveQaState(s) {
  localStorage.setItem(`cheongiyeon_qa_${sig(currentInput)}`, JSON.stringify(s));
}
function wishState() {
  const raw = localStorage.getItem(`cheongiyeon_wish_${sig(currentInput)}`);
  return raw ? JSON.parse(raw) : null;
}

/* ---------- 스크롤 리빌 ---------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revealObserver.unobserve(e.target); } });
}, { threshold: 0.12 });
function observeReveals(root = document) {
  root.querySelectorAll(".reveal:not(.in)").forEach(el => revealObserver.observe(el));
}
observeReveals();

/* ---------- 셀렉트 옵션 ---------- */
(function initSelects() {
  const yearSel = $("#birth-year"), monthSel = $("#birth-month"), daySel = $("#birth-day");
  const nowY = new Date().getFullYear();
  yearSel.innerHTML = `<option value="">연도</option>` +
    Array.from({ length: nowY - 1929 }, (_, i) => nowY - i).map(y => `<option value="${y}">${y}년</option>`).join("");
  monthSel.innerHTML = `<option value="">월</option>` +
    Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join("");
  function fillDays() {
    const y = +yearSel.value || 2000, m = +monthSel.value || 1;
    const dim = new Date(y, m, 0).getDate();
    const prev = daySel.value;
    daySel.innerHTML = `<option value="">일</option>` +
      Array.from({ length: dim }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join("");
    if (prev && +prev <= dim) daySel.value = prev;
  }
  yearSel.addEventListener("change", fillDays);
  monthSel.addEventListener("change", fillDays);
  fillDays();

  $("#birth-hour").innerHTML = Array.from({ length: 24 }, (_, h) =>
    `<option value="${h}" ${h === 12 ? "selected" : ""}>${String(h).padStart(2, "0")}시</option>`).join("");
  $("#birth-minute").innerHTML = Array.from({ length: 12 }, (_, i) =>
    `<option value="${i * 5}">${String(i * 5).padStart(2, "0")}분</option>`).join("");

  $("#birth-region").innerHTML = REGIONS.map((r, i) => {
    const corr = r.lon == null ? null : Math.round((r.lon - 135) * 4);
    return `<option value="${i}" ${r.name === "서울" ? "selected" : ""}>${r.name}${corr != null ? ` (${corr}분 보정)` : ""}</option>`;
  }).join("");
})();

$("#time-unknown").addEventListener("change", (e) => {
  $("#time-row").classList.toggle("hidden", e.target.checked);
});
$$('input[name="caltype"]').forEach(r => r.addEventListener("change", () => {
  const isLunar = document.querySelector('input[name="caltype"]:checked').value === "lunar";
  $("#lunar-extra").classList.toggle("hidden", !isLunar);
  $("#birth-date-label").textContent = isLunar ? "생년월일 (음력)" : "생년월일 (양력)";
}));
$("#concern-chips").addEventListener("change", () => {
  const checked = $$('#concern-chips input:checked');
  if (checked.length > 3) {
    checked[checked.length - 1].checked = false;
    showToast("고민은 최대 3개까지 고를 수 있어요");
  }
});

/* ---------- 위저드 ---------- */
const WIZ_LABELS = { 1: "1 / 3 — 기본 정보", 2: "2 / 3 — 태어난 시간과 땅", 3: "3 / 3 — 지금의 고민" };
let wizStep = 1;

function showWizStep(n) {
  wizStep = n;
  $$(".wiz-step").forEach(s => s.classList.toggle("hidden", +s.dataset.step !== n));
  $("#wp-fill").style.width = `${(n / 3) * 100}%`;
  $("#wp-label").textContent = WIZ_LABELS[n];
  $("#wiz-prev").classList.toggle("hidden", n === 1);
  $("#wiz-next").classList.toggle("hidden", n === 3);
  $("#wiz-submit").classList.toggle("hidden", n !== 3);
}

function validateStep(n) {
  if (n === 1) {
    if (!$("#name").value.trim()) { showToast("이름을 입력해주세요"); return false; }
    if (!$("#birth-year").value || !$("#birth-month").value || !$("#birth-day").value) {
      showToast("생년월일을 선택해주세요"); return false;
    }
  }
  return true;
}

$("#wiz-next").addEventListener("click", () => {
  if (!validateStep(wizStep)) return;
  showWizStep(Math.min(3, wizStep + 1));
});
$("#wiz-prev").addEventListener("click", () => showWizStep(Math.max(1, wizStep - 1)));

/* ---------- 히어로 카운터 ---------- */
(function animateCounter() {
  const el = document.querySelector("[data-counter]");
  if (!el) return;
  const target = parseInt(el.dataset.counter, 10);
  let n = Math.floor(target * 0.985);
  const step = () => {
    n += Math.max(1, Math.floor((target - n) / 12));
    el.textContent = n.toLocaleString("ko-KR");
    if (n < target) requestAnimationFrame(step);
  };
  step();
})();

/* ---------- 특가 타이머 ---------- */
(function dealTimer() {
  const el = $("#deal-timer");
  if (!el) return;
  const tick = () => {
    const now = new Date();
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    let s = Math.max(0, Math.floor((end - now) / 1000));
    el.textContent = `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  tick();
  setInterval(tick, 1000);
})();

/* ---------- 제출 → 분석 ---------- */
$("#saju-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateStep(1)) { showWizStep(1); return; }
  const timeUnknown = $("#time-unknown").checked;

  let y = +$("#birth-year").value, m = +$("#birth-month").value, d = +$("#birth-day").value;
  let lunar = null;

  // 음력 → 양력 자동 변환 (한국천문연구원 기준)
  if (document.querySelector('input[name="caltype"]:checked').value === "lunar") {
    const leap = $("#lunar-leap").checked;
    if (leap && KLC.leapMonthOf(y) !== m) {
      showToast(`음력 ${y}년의 윤달은 ${KLC.leapMonthOf(y) ? KLC.leapMonthOf(y) + "월" : "없음"}입니다. 윤달 여부를 확인해주세요.`);
      showWizStep(1);
      return;
    }
    const conv = KLC.lunarToSolar(y, m, d, leap);
    if (!conv) {
      showToast("음력 날짜를 확인해주세요 — 해당 달에 없는 날짜입니다.");
      showWizStep(1);
      return;
    }
    lunar = { y, m, d, leap };
    y = conv.y; m = conv.m; d = conv.d;
  }

  runAnalysis({
    name: $("#name").value.trim() || "고객",
    gender: document.querySelector('input[name="gender"]:checked').value,
    y, m, d, lunar,
    hour: timeUnknown ? -1 : +$("#birth-hour").value,
    minute: timeUnknown ? 0 : +$("#birth-minute").value,
    regionIdx: +$("#birth-region").value,
    concerns: $$('#concern-chips input:checked').map(c => c.value),
    loveStatus: document.querySelector('input[name="lovestatus"]:checked').value,
    jobStatus: $("#job-status").value,
  });
});

const ANALYZE_STEPS = [
  "촛불을 밝히고 자네 생시를 받았네…",
  "태어난 땅의 경도로 시각을 바로잡고 있네…",
  "만세력을 한 장 한 장 넘겨보고 있네…",
  "여덟 글자의 십신과 신살을 짚는 중이네…",
  "대운의 물길이 어디로 흐르는지 살피고 있네…",
  "자네 고민에 들려줄 답을 고르고 있네…",
];

function runAnalysis(input) {
  currentInput = input;
  currentSaju = calculateSaju(input);

  $("#input-section").classList.add("hidden");
  $("#result").classList.add("hidden");
  $("#paybar").classList.add("hidden");
  $("#analyzing").classList.remove("hidden");
  $("#analyzing").scrollIntoView({ behavior: "smooth" });

  const fill = $("#progress-fill");
  const stepEl = $("#analyzing-step");
  let i = 0;
  fill.style.width = "6%";
  const iv = setInterval(() => {
    if (i < ANALYZE_STEPS.length) {
      stepEl.textContent = ANALYZE_STEPS[i];
      fill.style.width = `${((i + 1) / ANALYZE_STEPS.length) * 100}%`;
      i++;
    } else {
      clearInterval(iv);
      $("#analyzing").classList.add("hidden");
      renderResult();
    }
  }, 700);
}

/* ---------- 결과 렌더링 ---------- */
const PILLAR_LABELS = [
  { key: "hour",  label: "시주 時柱" },
  { key: "day",   label: "일주 日柱" },
  { key: "month", label: "월주 月柱" },
  { key: "year",  label: "연주 年柱" },
];

function pillarCharHTML(idx, list, godLabel) {
  const c = list[idx];
  const el = ELEMENTS[c.el];
  return `<div class="pillar-char">
      <span class="god-label">${godLabel || ""}</span>
      <span class="hanja tx-${c.el}">${c.han}</span>
      <span class="hangul">${c.kor} · ${el.kor}</span>
    </div>`;
}

function renderResult() {
  const saju = currentSaju;
  const input = currentInput;

  $("#result-title").textContent = `${input.name}님의 사주팔자`;

  let timeStr = "시간 미상";
  if (input.hour >= 0) {
    timeStr = `${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}`;
    if (saju.solarTime && saju.solarTime.corrMin !== 0) {
      timeStr += ` (진태양시 ${String(saju.solarTime.hour).padStart(2, "0")}:${String(saju.solarTime.minute).padStart(2, "0")})`;
    }
  }
  const regionName = REGIONS[input.regionIdx]?.name || "";
  const dateStr = input.lunar
    ? `음력 ${input.lunar.y}년 ${input.lunar.leap ? "윤" : ""}${input.lunar.m}월 ${input.lunar.d}일 (양력 ${input.y}.${input.m}.${input.d})`
    : `${input.y}년 ${input.m}월 ${input.d}일 (양력)`;
  $("#result-meta").textContent =
    `${dateStr} · ${timeStr} · ${regionName} · ${input.gender === "M" ? "남성" : "여성"} · ${saju.ganjiText.year}년 ${saju.zodiac}띠`;

  $("#persona-bubble").innerHTML = `
    <div class="persona-bubble">
      <div class="persona-avatar"><img src="assets/shaman-portrait.webp" alt="신녀 연화" /></div>
      <div class="bubble">${SHAMAN_QUOTES[saju.dayStem]}
        <span class="who">— 신녀 연화가 ${input.name}님의 ${saju.ganjiText.day}일주를 보고</span>
      </div>
    </div>`;

  const p = saju.pillars;
  $("#pillars").innerHTML = PILLAR_LABELS.map(({ key, label }) => {
    const pil = p[key];
    if (!pil) {
      return `<div class="pillar"><div class="pillar-label">${label}</div>
        <div class="pillar-char unknown"><span class="god-label">—</span><span class="hanja">?</span><span class="hangul">시간 미상</span></div>
        <div class="pillar-char unknown"><span class="god-label">—</span><span class="hanja">?</span><span class="hangul">시간 미상</span></div></div>`;
    }
    const g = saju.tenGods[key];
    const stemLabel = key === "day" ? "일간(나)" : g.stem;
    return `<div class="pillar"><div class="pillar-label">${label}</div>
      ${pillarCharHTML(pil.stem, STEMS, stemLabel)}${pillarCharHTML(pil.branch, BRANCHES, g.branch)}</div>`;
  }).join("");

  let note = "※ 절기 기준 만세력 방식 · 글자 위 표기는 일간 기준 십신(十神)입니다.";
  if (input.hour >= 0 && saju.solarTime && saju.solarTime.corrMin !== 0) {
    note += ` 출생지(${regionName}) 경도 보정 ${saju.solarTime.corrMin}분이 적용되었습니다.`;
  } else if (input.hour < 0) {
    note = "※ 태어난 시간을 입력하면 시주(時柱)까지 포함한 8글자 전체 분석이 가능합니다.";
  }
  $("#pillar-note").textContent = note;

  const maxCount = Math.max(...Object.values(saju.counts), 1);
  $("#element-bars").innerHTML = Object.entries(ELEMENTS).map(([key, el]) => {
    const cnt = saju.counts[key];
    return `<div class="el-row">
      <span class="el-name tx-${key}">${el.han} ${el.kor}</span>
      <div class="el-track"><div class="el-fill el-${key}" data-w="${(cnt / maxCount) * 100}"></div></div>
      <span class="el-count">${cnt}개</span></div>`;
  }).join("");
  requestAnimationFrame(() =>
    $$(".el-fill").forEach(f => (f.style.width = f.dataset.w + "%"))
  );
  $("#element-summary").innerHTML = elementSummaryText(saju);

  const free = buildFreeReport(saju);
  $("#daymaster-title").innerHTML = `일간 분석 · ${free.title}`;
  $("#free-report").innerHTML = free.html;

  renderFreeExtras();
  renderPremium();
  renderWish();
  renderGroupInit();

  $("#result").classList.remove("hidden");
  observeReveals();
  $("#result").scrollIntoView({ behavior: "smooth" });
}

/* ---------- 무료 확장 렌더링 ---------- */
function renderFreeExtras() {
  const ex = buildFreeExtras(currentSaju, currentInput);

  const talentsHtml = `
    <div class="card report-card">
      <div class="report-tag free-tag">무료 풀이</div>
      <h3 class="card-title">타고난 재능 <small>十神 구성</small></h3>
      <div class="talent-grid">${ex.talents.map(t => `
        <div class="talent-chip"><b>${t.god} · ${t.name}</b><span>${t.desc}</span></div>`).join("")}
      </div>
    </div>`;

  const scoresHtml = `
    <div class="card report-card score-card">
      <div class="report-tag free-tag">무료 풀이</div>
      <h3 class="card-title">2026 병오년 운세 지수</h3>
      <div class="score-hero"><span class="score-num">${ex.total}</span><span class="score-unit">점 / 100</span></div>
      <div class="score-grid">${ex.scores.map(s => `
        <div class="score-row"><span>${s.label}</span>
          <div class="score-track"><div class="score-fill" data-w="${s.score}"></div></div>
          <b>${s.score}</b></div>`).join("")}
      </div>
      <button type="button" class="score-why open-pay">이 점수가 나온 이유 — 심층 풀이에서 확인 →</button>
    </div>`;

  const sinsalHtml = ex.sinsal.length ? `
    <div class="card report-card sinsal-tease">
      <div class="report-tag free-tag">무료 풀이</div>
      <h3 class="card-title">발견된 신살 <small>神殺</small></h3>
      <div class="sinsal-badges">${ex.sinsal.map(s => `<span class="sinsal-badge">${s.han} ${s.name}</span>`).join("")}</div>
      <p class="sinsal-hint">흔치 않은 살(殺)이 자네 팔자에 박혀 있네. 복이 될지 화가 될지는 풀이를 봐야 알아.</p>
      <button type="button" class="score-why open-pay">내 신살, 무슨 뜻인지 마저 듣기 →</button>
    </div>` : "";

  const todayHtml = `
    <div class="today-line">
      <span class="today-label">오늘의 기운</span>
      <p>${ex.todayLine}</p>
      <small>매일 자정에 바뀝니다 — 내일 다시 확인해보세요</small>
    </div>`;

  $("#free-extras").innerHTML = talentsHtml + scoresHtml + sinsalHtml + todayHtml;
  requestAnimationFrame(() =>
    $$("#free-extras .score-fill").forEach(f => (f.style.width = f.dataset.w + "%"))
  );

  // 연화의 예고 멘트 (클리프행어)
  $("#cliffhanger").innerHTML = `
    <div class="persona-bubble">
      <div class="persona-avatar"><img src="assets/shaman-portrait.webp" alt="신녀 연화" /></div>
      <div class="bubble cliff">${ex.cliffhanger}
        <button type="button" class="cliff-btn open-pay">복채 놓고 마저 듣기</button>
      </div>
    </div>`;
}

/* ---------- 프리미엄 ---------- */
function premiumSectionHTML(sec, unlocked, bodyHtml, previewOverride) {
  const inner = bodyHtml ?? sec.html;
  let body;
  if (unlocked) {
    body = `<div class="report-body">${inner}</div>`;
  } else {
    const preview = previewOverride ?? previewSentence(inner);
    body = `<div class="locked-body">
         <p class="preview-line">${preview}</p>
         <div class="locked-content report-body">${inner}</div>
         <div class="lock-overlay">
           <button type="button" class="open-pay">이어서 읽기</button></div>
       </div>`;
  }
  return `<div class="premium-section">
    <div class="report-tag premium-tag">PREMIUM</div>
    <h3 class="card-title">${sec.icon} ${sec.title}</h3>
    <p class="teaser">${sec.teaser}</p>${body}</div>`;
}

function daeunTableHTML(saju, current) {
  const rows = saju.daeun.list.map(du => {
    const st = STEMS[du.stem], br = BRANCHES[du.branch];
    const isCur = du === current;
    return `<div class="daeun-cell ${isCur ? "current" : ""}">
      <b>${du.fromAge}~${du.toAge}세</b>
      <span class="daeun-ganji"><i class="tx-${st.el}">${st.han}</i><i class="tx-${br.el}">${br.han}</i></span>
      <span class="daeun-god">${du.tenGod}운${isCur ? " · 현재" : ""}</span>
    </div>`;
  }).join("");
  return `<div class="daeun-grid">${rows}</div>
    <p style="margin-top:14px"><b>지금 당신은 ${current.fromAge}~${current.toAge}세 ${current.tenGod} 대운</b>을 지나고 있습니다. ${DAEUN_BANK[current.tenGod]}</p>`;
}

function renderPremium() {
  const purchased = owns("report");
  // 보안 모드에서 결제자는 본문을 서버(/api/report)에서 받아 채웁니다.
  // 잠금 화면(티저)은 항상 클라이언트에서 렌더 → 결제자는 아래에서 서버 본문으로 교체.
  const unlocked = purchased && !SECURE;
  const pr = buildPremiumReport(currentSaju, currentInput);

  const sections = [];
  if (pr.concerns.length) {
    const html = pr.concerns.map(c => `<p><b class="highlight">[${c.label}]</b> ${c.answer}</p>`).join("");
    sections.push(premiumSectionHTML({
      icon: "問", title: "당신의 고민에 대한 연화의 답",
      teaser: `${currentInput.name}님이 고른 고민 ${pr.concerns.length}가지 — 사주에서 찾은 답입니다.`,
    }, unlocked, html));
  }
  sections.push(premiumSectionHTML(pr.daeunSection, unlocked, daeunTableHTML(currentSaju, pr.daeun.current),
    `지금 당신은 ${pr.daeun.current.fromAge}~${pr.daeun.current.toAge}세 ${pr.daeun.current.tenGod} 대운의 한가운데를 지나고 있습니다.`));
  sections.push(premiumSectionHTML(pr.year2026, unlocked));
  sections.push(premiumSectionHTML(pr.marriage, unlocked));
  sections.push(premiumSectionHTML(pr.match, unlocked));
  sections.push(premiumSectionHTML(pr.wealth, unlocked));
  sections.push(premiumSectionHTML(pr.love, unlocked));
  sections.push(premiumSectionHTML(pr.career, unlocked));
  sections.push(premiumSectionHTML(pr.caution, unlocked));
  sections.push(premiumSectionHTML(pr.helper, unlocked));
  sections.push(premiumSectionHTML(pr.health, unlocked));
  sections.push(premiumSectionHTML(pr.sinsalSection, unlocked));

  const monthsBody = `<div class="month-grid">${pr.months.map(mo =>
    `<div class="month-cell"><b>${mo.month}월 <span class="m-score">${"★".repeat(mo.score)}${"☆".repeat(5 - mo.score)}</span></b>${mo.text}</div>`
  ).join("")}</div>`;
  sections.push(premiumSectionHTML({ icon: "月", title: "12개월 월별 운세", teaser: "달마다 열리는 문과 닫히는 문이 다릅니다." }, unlocked, monthsBody,
    `1월 — ${pr.months[0].text.split(".")[0]}.`));

  const luckyBody = `<div class="lucky-grid">${pr.lucky.items.map(it =>
    `<div class="lucky-item"><span class="l-icon">${it.icon}</span>
      <span class="l-label">${it.label}</span><span class="l-value">${it.value}</span></div>`
  ).join("")}</div>`;
  sections.push(premiumSectionHTML({ icon: pr.lucky.icon, title: pr.lucky.title, teaser: pr.lucky.teaser }, unlocked, luckyBody,
    `당신에게 부족한 기운을 채워줄 행운 컬러·방위·숫자가 정해져 있습니다.`));

  $("#premium-sections").innerHTML = sections.join("");

  // 페이월: 보유한 단품은 숨기고, 전부 보유하면 통째로 숨김
  $("#paywall-cta").classList.toggle("hidden", ownsAll());
  $$(".single-item").forEach(b => b.classList.toggle("hidden", owns(b.dataset.product)));
  document.querySelector('.allpass-wrap .tier-card')?.classList.toggle("hidden", ownsAll());
  $("#paybar").classList.toggle("hidden", purchased);

  // 보안 모드 결제자 → 서버에서 본문을 받아 잠금 해제
  if (SECURE && purchased) fetchServerReport();

  renderQA(owns("questions"));

  $$(".open-pay").forEach(b => b.addEventListener("click", () => openPayModal("report")));
}

/* 보안 모드: 서버가 생성한 심층 리포트 본문으로 교체 */
async function fetchServerReport() {
  try {
    const r = await fetch(API("/api/report"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: getTokens(), input: currentInput }),
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "fail");
    renderServerSections(data);
  } catch (e) {
    // 서버 실패 시 클라이언트로 폴백 (결제자 보호)
    const saved = SECURE; // 임시로 클라 렌더
    const pr = buildPremiumReport(currentSaju, currentInput);
    renderClientUnlocked(pr);
  }
}

function daeunTableFromData(list, current) {
  const rows = list.map(du => {
    const st = STEMS[du.stem], br = BRANCHES[du.branch];
    const isCur = du.fromAge === current.fromAge;
    return `<div class="daeun-cell ${isCur ? "current" : ""}">
      <b>${du.fromAge}~${du.toAge}세</b>
      <span class="daeun-ganji"><i class="tx-${st.el}">${st.han}</i><i class="tx-${br.el}">${br.han}</i></span>
      <span class="daeun-god">${du.tenGod}운${isCur ? " · 현재" : ""}</span></div>`;
  }).join("");
  return `<div class="daeun-grid">${rows}</div>
    <p style="margin-top:14px"><b>지금 당신은 ${current.fromAge}~${current.toAge}세 ${current.tenGod} 대운</b>을 지나고 있습니다. ${DAEUN_BANK[current.tenGod]}</p>`;
}

function renderServerSections(data) {
  const html = data.sections.map(sec => {
    let body;
    if (sec.daeun) body = daeunTableFromData(data.daeun.list, data.daeun.current);
    else if (sec.months) body = `<div class="month-grid">${sec.months.map(mo =>
      `<div class="month-cell"><b>${mo.month}월 <span class="m-score">${"★".repeat(mo.score)}${"☆".repeat(5 - mo.score)}</span></b>${mo.text}</div>`).join("")}</div>`;
    else if (sec.lucky) body = `<div class="lucky-grid">${sec.lucky.map(it =>
      `<div class="lucky-item"><span class="l-icon">${it.icon}</span><span class="l-label">${it.label}</span><span class="l-value">${it.value}</span></div>`).join("")}</div>`;
    else body = sec.html;
    return `<div class="premium-section"><div class="report-tag premium-tag">PREMIUM</div>
      <h3 class="card-title">${sec.icon} ${sec.title}</h3>
      <div class="report-body">${body}</div></div>`;
  }).join("");
  $("#premium-sections").innerHTML = html;
}

/* 데모/폴백: 클라이언트 pr 로 전체 잠금 해제 렌더 */
function renderClientUnlocked(pr) {
  const parts = [];
  if (pr.concerns.length) parts.push(sectionUnlocked("問", "당신의 고민에 대한 연화의 답",
    pr.concerns.map(c => `<p><b class="highlight">[${c.label}]</b> ${c.answer}</p>`).join("")));
  parts.push(sectionUnlocked(pr.daeunSection.icon, pr.daeunSection.title, daeunTableHTML(currentSaju, pr.daeun.current)));
  [pr.year2026, pr.marriage, pr.match, pr.wealth, pr.love, pr.career, pr.caution, pr.helper, pr.health, pr.sinsalSection]
    .forEach(o => parts.push(sectionUnlocked(o.icon, o.title, o.html)));
  parts.push(sectionUnlocked("月", "12개월 월별 운세", `<div class="month-grid">${pr.months.map(mo =>
    `<div class="month-cell"><b>${mo.month}월 <span class="m-score">${"★".repeat(mo.score)}${"☆".repeat(5 - mo.score)}</span></b>${mo.text}</div>`).join("")}</div>`));
  parts.push(sectionUnlocked(pr.lucky.icon, pr.lucky.title, `<div class="lucky-grid">${pr.lucky.items.map(it =>
    `<div class="lucky-item"><span class="l-icon">${it.icon}</span><span class="l-label">${it.label}</span><span class="l-value">${it.value}</span></div>`).join("")}</div>`));
  $("#premium-sections").innerHTML = parts.join("");
}
function sectionUnlocked(icon, title, body) {
  return `<div class="premium-section"><div class="report-tag premium-tag">PREMIUM</div>
    <h3 class="card-title">${icon} ${title}</h3><div class="report-body">${body}</div></div>`;
}

/* ---------- 연화에게 질문 ---------- */
function renderQA(hasQuestions) {
  const card = $("#qa-card");
  if (!hasQuestions) { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");
  const st = qaState();
  $("#qa-quota").textContent = `남은 질문 ${st.remaining} / 5`;
  $("#qa-history").innerHTML = st.history.map(h => `
    <div class="qa-item">
      <p class="qa-q">${h.q}</p>
      <div class="qa-a"><div class="persona-avatar"><img src="assets/shaman-portrait.webp" alt="" /></div>
      <div class="bubble">${h.a}</div></div>
    </div>`).join("");
  const done = st.remaining <= 0;
  $("#qa-input-row").style.display = done ? "none" : "";
  $("#qa-done-hint").style.display = done ? "" : "none";
}

$("#qa-send").addEventListener("click", () => {
  const inp = $("#qa-input");
  const q = inp.value.trim();
  if (q.length < 3) { showToast("질문을 조금 더 자세히 적어주세요"); return; }
  const st = qaState();
  if (st.remaining <= 0) return;

  $("#qa-send").disabled = true;
  $("#qa-send").textContent = "…";

  const finish = (a) => {
    st.history.push({ q, a });
    st.remaining -= 1;
    saveQaState(st);
    inp.value = "";
    $("#qa-send").disabled = false;
    $("#qa-send").textContent = "묻기";
    renderQA(true);
    $("#qa-history").lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (SECURE) {
    // 서버(claude-haiku-4-5)에서 답변 생성 — API 키는 서버에만
    fetch(API("/api/ask"), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: getTokens(), input: currentInput, question: q }),
    }).then(r => r.json())
      .then(d => finish(d.ok ? d.answer : answerQuestion(q, currentSaju, currentInput)))
      .catch(() => finish(answerQuestion(q, currentSaju, currentInput)));
  } else {
    // 데모: 사주 데이터 기반 템플릿 답변
    setTimeout(() => finish(answerQuestion(q, currentSaju, currentInput)), 900);
  }
});
$("#qa-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#qa-send").click(); } });

/* ---------- 결제 (단품 + 자유이용권) ---------- */
let payBusy = false;

function selectedProduct() {
  return document.querySelector('input[name="payproduct"]:checked')?.value || "allpass";
}
function updatePayButton() {
  $("#pay-confirm").textContent = `${PRICES[selectedProduct()].toLocaleString("ko-KR")}원 결제하기`;
}

function openPayModal(product = "allpass") {
  // 이미 보유한 상품이면 자유이용권으로 대체
  if (product !== "allpass" && owns(product)) product = "allpass";
  const options = product === "allpass" ? ["allpass"] : [product, "allpass"];
  $("#pay-options").innerHTML = options.map((key, i) => `
    <label class="pay-tier">
      <input type="radio" name="payproduct" value="${key}" ${i === 0 ? "checked" : ""} />
      <div><b>${PRODUCT_NAMES[key]}</b><span>${PRODUCT_DESCS[key]}</span></div>
      <strong>${PRICES[key].toLocaleString("ko-KR")}원</strong>
    </label>`).join("");
  $$('input[name="payproduct"]').forEach(r => r.addEventListener("change", updatePayButton));
  updatePayButton();
  $("#pay-modal").classList.remove("hidden");
  $("#pay-step-select").classList.remove("hidden");
  $("#pay-step-processing").classList.add("hidden");
  $("#pay-step-done").classList.add("hidden");
  document.body.style.overflow = "hidden";
}
function closePayModal() {
  $("#pay-modal").classList.add("hidden");
  document.body.style.overflow = "";
}

$$(".tier-card, .single-item").forEach(c => c.addEventListener("click", () => openPayModal(c.dataset.product)));
$("#paybar-btn").addEventListener("click", () => openPayModal("allpass"));
$("#pay-close").addEventListener("click", closePayModal);
$("#pay-modal").addEventListener("click", (e) => { if (e.target === $("#pay-modal")) closePayModal(); });

$("#pay-confirm").addEventListener("click", () => {
  if (payBusy) return;
  if (!$("#refund-agree").checked) {
    showToast("환불 정책 동의에 체크해주세요");
    return;
  }
  const product = selectedProduct();

  if (SECURE) {
    // ===== 실결제: 토스페이먼츠 결제창 → 성공 시 successUrl로 복귀 → /api/confirm 검증 =====
    // 복귀 후 사주를 다시 계산할 수 있도록 입력값을 잠시 보관
    localStorage.setItem("cheongiyeon_pending", JSON.stringify({ input: currentInput, product }));
    const orderId = `cy_${product}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const base = location.origin + location.pathname;
    const success = `${base}?pay=success&product=${product}&sig=${encodeURIComponent(sig(currentInput))}`;
    const fail = `${base}?pay=fail`;
    try {
      const tp = TossPayments(CFG.tossClientKey);
      tp.requestPayment("카드", {
        amount: PRICES[product],
        orderId,
        orderName: PRODUCT_NAMES[product],
        customerName: currentInput.name || "고객",
        successUrl: success,
        failUrl: fail,
      }).catch(() => showToast("결제가 취소되었습니다"));
    } catch (e) {
      showToast("결제창을 여는 중 문제가 발생했습니다");
    }
    return;
  }

  // ===== 데모 모드: 실제 결제 없이 성공 처리 =====
  payBusy = true;
  $("#pay-step-select").classList.add("hidden");
  $("#pay-step-processing").classList.remove("hidden");
  setTimeout(() => {
    grant(product);
    payBusy = false;
    $("#pay-step-processing").classList.add("hidden");
    $("#pay-step-done").classList.remove("hidden");
  }, 1800);
});

$("#pay-view").addEventListener("click", () => {
  closePayModal();
  renderPremium();
  renderWish();
  renderGroupResult(); // 대기 중이던 그룹 분석이 있으면 전체 공개
  $("#premium-sections").scrollIntoView({ behavior: "smooth" });
  showToast("결제한 기능이 열렸습니다");
});

/* ---------- 기도올리기 (소원 부적) ---------- */
function renderWish() {
  const w = wishState();
  $("#wish-locked").classList.toggle("hidden", !!w);
  $("#wish-done").classList.toggle("hidden", !w);
  if (w) $("#wish-blessing").textContent = w.blessing;
  $("#wish-btn").textContent = owns("wish")
    ? "소원 올리기 (결제 완료)"
    : `소원 올리기 · ${PRICES.wish.toLocaleString("ko-KR")}원`;
}

$("#wish-btn").addEventListener("click", () => {
  const wish = $("#wish-input").value.trim();
  if (wish.length < 4) { showToast("소원을 조금 더 자세히 적어주세요"); return; }
  if (!owns("wish")) { openPayModal("wish"); return; }
  const blessing = wishBlessing(currentInput.name, wish, currentSaju);
  localStorage.setItem(`cheongiyeon_wish_${sig(currentInput)}`, JSON.stringify({ wish, blessing, date: new Date().toISOString().slice(0, 10) }));
  renderWish();
  showToast("소원이 신당에 올랐습니다");
});

/* 부적 이미지 생성 (황지·주사 전통 부적 스타일) */
$("#wish-download").addEventListener("click", () => {
  const w = wishState();
  if (!w) return;
  const cv = document.createElement("canvas");
  cv.width = 720; cv.height = 1280;
  const ctx = cv.getContext("2d");

  // 황지 배경
  const bg = ctx.createLinearGradient(0, 0, 0, 1280);
  bg.addColorStop(0, "#f0d98f"); bg.addColorStop(1, "#e6c76e");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 720, 1280);

  const red = "#b3261e";
  // 이중 테두리
  ctx.strokeStyle = red; ctx.lineWidth = 6; ctx.strokeRect(30, 30, 660, 1220);
  ctx.lineWidth = 2; ctx.strokeRect(48, 48, 624, 1184);

  ctx.fillStyle = red; ctx.textAlign = "center";

  // 상단 표제
  ctx.font = "700 30px 'Noto Serif KR', serif";
  ctx.fillText("天 機 緣 神 堂", 360, 110);
  ctx.beginPath(); ctx.moveTo(140, 140); ctx.lineTo(580, 140); ctx.lineWidth = 2; ctx.stroke();

  // 세로 대자: 所願成就
  ctx.font = "900 150px 'Noto Serif KR', serif";
  const chars = ["所", "願", "成", "就"];
  chars.forEach((ch, i) => ctx.fillText(ch, 360, 320 + i * 180));

  // 소원
  ctx.font = "500 26px 'Noto Sans KR', sans-serif";
  const wrap = (t, max) => {
    const out = []; let line = "";
    for (const ch of t) { line += ch; if (line.length >= max) { out.push(line); line = ""; } }
    if (line) out.push(line);
    return out;
  };
  wrap(`“${w.wish}”`, 22).forEach((ln, i) => ctx.fillText(ln, 360, 1050 + i * 38));

  // 이름·날짜
  ctx.font = "400 22px 'Noto Sans KR', sans-serif";
  ctx.fillText(`${currentInput.name} · ${w.date}`, 360, 1150);

  // 인장
  ctx.fillStyle = red; ctx.fillRect(320, 1170, 80, 56);
  ctx.fillStyle = "#f0d98f"; ctx.font = "700 34px 'Noto Serif KR', serif";
  ctx.fillText("緣", 360, 1212);

  cv.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `천기연_소원부적_${currentInput.name}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("소원부적이 저장되었습니다");
  }, "image/png");
});

/* ---------- 모임 궁합 (최대 10명) ---------- */
let lastGroupAnalysis = null;

function groupRowHTML(name = "", date = "") {
  return `<div class="gp-row">
    <input type="text" class="gp-name" maxlength="8" placeholder="이름" value="${name}" />
    <input type="date" class="gp-date" min="1930-01-01" max="2026-12-31" value="${date}" />
    <button type="button" class="gp-del" aria-label="삭제">✕</button>
  </div>`;
}

function renderGroupInit() {
  const me = currentInput;
  const meDate = `${me.y}-${String(me.m).padStart(2, "0")}-${String(me.d).padStart(2, "0")}`;
  $("#group-people").innerHTML = groupRowHTML(me.name, meDate) + groupRowHTML() + groupRowHTML();
  lastGroupAnalysis = null;
  $("#group-result").innerHTML = "";
}

$("#group-add").addEventListener("click", () => {
  if ($$("#group-people .gp-row").length >= 10) { showToast("최대 10명까지 넣을 수 있어요"); return; }
  $("#group-people").insertAdjacentHTML("beforeend", groupRowHTML());
});
$("#group-people").addEventListener("click", (e) => {
  if (e.target.classList.contains("gp-del")) {
    if ($$("#group-people .gp-row").length <= 2) { showToast("최소 2명은 필요해요"); return; }
    e.target.closest(".gp-row").remove();
  }
});

$("#group-run").addEventListener("click", () => {
  const people = $$("#group-people .gp-row").map(r => {
    const name = r.querySelector(".gp-name").value.trim();
    const date = r.querySelector(".gp-date").value;
    if (!name || !date) return null;
    const [y, m, d] = date.split("-").map(Number);
    return { name, y, m, d };
  }).filter(Boolean);
  if (people.length < 2) { showToast("이름과 생년월일을 2명 이상 입력해주세요"); return; }
  if (new Set(people.map(p => p.name)).size !== people.length) { showToast("이름이 겹치지 않게 입력해주세요"); return; }
  lastGroupAnalysis = analyzeGroup(people);
  renderGroupResult();
  $("#group-result").scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (!owns("group")) showToast("베스트 궁합만 무료 공개 — 전체 지도는 잠금 해제");
});

function renderGroupResult() {
  if (!lastGroupAnalysis) return;
  const g = lastGroupAnalysis;
  const unlocked = owns("group");

  const pairRow = p => `
    <div class="gp-pair">
      <div class="gp-head"><span class="gp-names">${p.a} · ${p.b}</span>
        <div class="gp-track"><div class="gp-fill" style="width:${p.score}%"></div></div><b>${p.score}</b></div>
      <div class="gp-tags">${p.tags.map(t => `<i class="${t === "충" ? "bad" : ""}">${t}</i>`).join("")}</div>
      <p>${p.desc}${p.notes.length ? " " + p.notes.join(". ") + "." : ""}</p>
    </div>`;

  const insights = `
    <div class="gp-insights">
      <div class="gp-insight">🏆 <b>최고 궁합</b> — ${g.best.a} · ${g.best.b} (${g.best.score}점). ${g.best.desc}</div>
      ${g.chungPairs.length
        ? g.chungPairs.map(c => `<div class="gp-insight bad">⚡ <b>앙숙 주의</b> — ${c.a} · ${c.b} (${c.score}점). 정면으로 충(沖)이 드는 사이입니다.</div>`).join("")
        : `<div class="gp-insight">이 모임엔 정면으로 충하는 앙숙이 없습니다 — 보기 드물게 순한 조합입니다.</div>`}
      ${g.bridges.map(b => `<div class="gp-insight">🌉 <b>중재자</b> — ${b.pair.a}·${b.pair.b} 사이가 틀어질 땐 <b>${b.bridge}</b>를 부르세요. 양쪽 모두와 합이 좋아 다리가 됩니다.</div>`).join("")}
      ${g.gwiinNotes.map(n => `<div class="gp-insight">🤝 ${n}</div>`).join("")}
      <div class="gp-insight">🍀 <b>모임의 복덩이</b> — <b>${g.lucky}</b>. 이 사람이 있는 자리에서 전체 운기가 올라갑니다.</div>
    </div>
    <div class="gp-pairs">${g.pairs.map(pairRow).join("")}</div>`;

  if (unlocked) {
    $("#group-result").innerHTML = `<div class="report-body gp-wrap">${insights}</div>`;
  } else {
    $("#group-result").innerHTML = `
      <div class="locked-body gp-wrap">
        <p class="preview-line">🏆 최고 궁합 — ${g.best.a} · ${g.best.b} (${g.best.score}점)</p>
        <div class="locked-content report-body">${insights}</div>
        <div class="lock-overlay"><button type="button" class="gp-unlock">전체 관계 지도 열기 · ${PRICES.group.toLocaleString("ko-KR")}원</button></div>
      </div>`;
    $("#group-result").querySelector(".gp-unlock").addEventListener("click", () => openPayModal("group"));
  }
}

/* ---------- 다시하기 ---------- */
$("#retry-btn").addEventListener("click", () => {
  $("#result").classList.add("hidden");
  $("#paybar").classList.add("hidden");
  $("#input-section").classList.remove("hidden");
  showWizStep(1);
  $("#input-section").scrollIntoView({ behavior: "smooth" });
});

/* ---------- SNS 공유 ---------- */
function shareURL() {
  const u = new URL(location.origin + location.pathname);
  const i = currentInput;
  u.searchParams.set("n", i.name);
  u.searchParams.set("b", `${i.y}-${String(i.m).padStart(2, "0")}-${String(i.d).padStart(2, "0")}`);
  u.searchParams.set("h", i.hour);
  u.searchParams.set("mi", i.minute);
  u.searchParams.set("r", i.regionIdx);
  u.searchParams.set("g", i.gender);
  return u.toString();
}
function shareText() {
  const s = currentSaju;
  return `${currentInput.name}님은 ${s.ganjiText.day}일주 — "${DAY_MASTER_TEXT[s.dayStem].title.split(" — ")[1]}" 내 사주도 무료로 확인해보세요!`;
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareURL());
    showToast("링크가 복사되었습니다. 친구에게 붙여넣어 보내세요.");
  } catch {
    prompt("아래 링크를 복사하세요", shareURL());
  }
}

$("#share-link").addEventListener("click", copyLink);
$("#share-x").addEventListener("click", () => {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(shareURL())}`, "_blank", "width=560,height=640");
});
$("#share-kakao").addEventListener("click", () => {
  if (KAKAO_JS_KEY && window.Kakao) {
    if (!Kakao.isInitialized()) Kakao.init(KAKAO_JS_KEY);
    Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "천기연 — 신녀 연화의 AI 사주 풀이",
        description: shareText(),
        imageUrl: location.origin + "/assets/shaman-portrait.webp",
        link: { mobileWebUrl: shareURL(), webUrl: shareURL() },
      },
      buttons: [{ title: "내 사주 무료로 보기", link: { mobileWebUrl: shareURL(), webUrl: shareURL() } }],
    });
  } else if (navigator.share) {
    navigator.share({ title: "천기연 — AI 사주 풀이", text: shareText(), url: shareURL() }).catch(() => {});
  } else {
    copyLink();
  }
});

/* ---------- 결과 카드 이미지 ---------- */
$("#share-image").addEventListener("click", () => {
  const s = currentSaju;
  const cv = document.createElement("canvas");
  cv.width = 1080; cv.height = 1350;
  const ctx = cv.getContext("2d");

  ctx.fillStyle = "#faf7f1"; ctx.fillRect(0, 0, 1080, 1350);
  ctx.strokeStyle = "#221d15"; ctx.lineWidth = 2; ctx.strokeRect(40, 40, 1000, 1270);
  ctx.strokeStyle = "#a83a26"; ctx.lineWidth = 1; ctx.strokeRect(52, 52, 976, 1246);

  ctx.textAlign = "center";
  ctx.fillStyle = "#a83a26"; ctx.fillRect(506, 92, 68, 68);
  ctx.fillStyle = "#fff"; ctx.font = "700 40px 'Noto Serif KR', serif";
  ctx.fillText("緣", 540, 142);
  ctx.fillStyle = "#6f675a"; ctx.font = "500 24px 'Noto Sans KR', sans-serif";
  ctx.fillText("천기연 · 신녀 연화의 사주 풀이", 540, 205);

  ctx.fillStyle = "#221d15"; ctx.font = "900 60px 'Noto Serif KR', serif";
  ctx.fillText(`${currentInput.name}님의 사주팔자`, 540, 285);

  ctx.fillStyle = "#6f675a"; ctx.font = "400 28px 'Noto Sans KR', sans-serif";
  ctx.fillText(`${currentInput.y}년 ${currentInput.m}월 ${currentInput.d}일생 · ${s.ganjiText.year}년 ${s.zodiac}띠`, 540, 335);

  const elColors = { wood: "#3d7a5c", fire: "#a83a26", earth: "#a8842f", metal: "#82868f", water: "#2f5d8a" };
  const cols = [["시주", s.pillars.hour], ["일주", s.pillars.day], ["월주", s.pillars.month], ["연주", s.pillars.year]];
  const colW = 220, startX = 540 - colW * 2 + colW / 2;
  cols.forEach(([label, pil], i) => {
    const x = startX + i * colW;
    ctx.fillStyle = "#a09786"; ctx.font = "400 26px 'Noto Sans KR', sans-serif";
    ctx.fillText(label, x, 420);
    if (pil) {
      const st = STEMS[pil.stem], br = BRANCHES[pil.branch];
      ctx.font = "900 110px 'Noto Serif KR', serif";
      ctx.fillStyle = elColors[st.el]; ctx.fillText(st.han, x, 550);
      ctx.fillStyle = elColors[br.el]; ctx.fillText(br.han, x, 690);
      ctx.fillStyle = "#6f675a"; ctx.font = "400 28px 'Noto Sans KR', sans-serif";
      ctx.fillText(`${st.kor}${br.kor}`, x, 745);
    } else {
      ctx.fillStyle = "#cfc8b8"; ctx.font = "900 110px 'Noto Serif KR', serif";
      ctx.fillText("?", x, 550); ctx.fillText("?", x, 690);
    }
  });

  ctx.strokeStyle = "#d9d1c0"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(120, 800); ctx.lineTo(960, 800); ctx.stroke();

  const dm = DAY_MASTER_TEXT[s.dayStem];
  ctx.fillStyle = "#a83a26"; ctx.font = "700 40px 'Noto Serif KR', serif";
  ctx.fillText(dm.title.split(" — ")[0] + " 일간", 540, 880);
  ctx.fillStyle = "#221d15"; ctx.font = "400 34px 'Noto Sans KR', sans-serif";
  ctx.fillText(`"${dm.title.split(" — ")[1]}"`, 540, 940);
  ctx.fillStyle = "#6f675a"; ctx.font = "500 30px 'Noto Sans KR', sans-serif";
  ctx.fillText(dm.keywords.map(k => "#" + k).join("   "), 540, 1005);

  const els = Object.entries(s.counts);
  const barW = 130, bStartX = 540 - (els.length * barW) / 2 + barW / 2;
  els.forEach(([key, cnt], i) => {
    const x = bStartX + i * barW;
    const h = Math.max(12, cnt * 30);
    ctx.fillStyle = elColors[key];
    ctx.fillRect(x - 30, 1160 - h, 60, h);
    ctx.font = "400 24px 'Noto Sans KR', sans-serif";
    ctx.fillText(`${ELEMENTS[key].kor} ${cnt}`, x, 1200);
  });

  ctx.fillStyle = "#a09786"; ctx.font = "400 26px 'Noto Sans KR', sans-serif";
  ctx.fillText("나의 사주도 무료로 — 천기연 AI 사주 풀이", 540, 1272);

  cv.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `천기연_사주카드_${currentInput.name}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("결과 카드가 저장되었습니다. SNS에 올려보세요.");
  }, "image/png");
});

/* ---------- 토스 결제 복귀 처리 (보안 모드) ---------- */
(function bootFromPayment() {
  const q = new URLSearchParams(location.search);
  const pay = q.get("pay");
  if (!pay) return true; // 결제 복귀 아님 → 다음 부트로 진행

  const cleanUrl = () => history.replaceState(null, "", location.origin + location.pathname);

  if (pay === "fail") {
    cleanUrl();
    setTimeout(() => showToast("결제가 완료되지 않았습니다"), 500);
    return false;
  }

  // pay === success
  let pending;
  try { pending = JSON.parse(localStorage.getItem("cheongiyeon_pending") || "null"); } catch { pending = null; }
  const paymentKey = q.get("paymentKey"), orderId = q.get("orderId"), amount = q.get("amount");
  const product = q.get("product"), sigParam = q.get("sig");

  if (!pending || !paymentKey || !orderId) { cleanUrl(); return true; }

  currentInput = pending.input;
  runAnalysis(pending.input); // 분석 화면 먼저 보여주고

  fetch(API("/api/confirm"), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount: Number(amount), product: pending.product || product, sig: sigParam }),
  }).then(r => r.json()).then(d => {
    localStorage.removeItem("cheongiyeon_pending");
    cleanUrl();
    if (d.ok && d.token) {
      addToken(d.token);
      (d.products || []).forEach(grant);
      // 결과가 이미 렌더된 뒤일 수 있으므로 잠금 해제 반영
      setTimeout(() => { renderPremium(); renderWish(); renderGroupResult(); showToast("결제가 완료되어 열렸습니다"); }, 300);
    } else {
      showToast("결제 확인에 실패했습니다. 고객센터로 문의해주세요.");
    }
  }).catch(() => { cleanUrl(); showToast("결제 확인 중 오류가 발생했습니다"); });

  return false; // 공유링크 부트는 건너뜀
})() &&
/* ---------- 공유 링크 자동 분석 ---------- */
(function bootFromURL() {
  const q = new URLSearchParams(location.search);
  const b = q.get("b");
  if (!b || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return;
  const [y, m, d] = b.split("-").map(Number);
  const hour = Math.min(23, Math.max(-1, parseInt(q.get("h") ?? "-1", 10) || -1));
  const minute = Math.min(59, Math.max(0, parseInt(q.get("mi") ?? "0", 10) || 0));
  const regionIdx = Math.min(REGIONS.length - 1, Math.max(0, parseInt(q.get("r") ?? "17", 10) || 17));
  const input = {
    name: (q.get("n") || "친구").slice(0, 12),
    gender: q.get("g") === "F" ? "F" : "M",
    y, m, d, hour, minute, regionIdx,
    concerns: [], loveStatus: "solo", jobStatus: "employee",
  };
  setTimeout(() => runAnalysis(input), 400);
})();
