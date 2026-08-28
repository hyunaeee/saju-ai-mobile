/* =====================================================================
 * saju.js — 만세력 기반 사주팔자 계산 엔진 (확장판)
 *
 *  - 연주: 입춘 기준 / 월주: 절기 기준 / 일주: 60갑자 순환(1900-01-01=갑술)
 *  - 시주: 진태양시(출생지 경도) 보정 후 산출
 *  - 십신(十神): 일간 대비 여덟 글자 각각의 관계 (지지는 본기 기준)
 *  - 대운(大運): 성별·연간 음양으로 순행/역행, 절기 거리로 시작 나이 산출
 *  - 신살(神殺): 천을귀인·도화·역마·화개 (일지·일간 기준)
 *
 *  ※ 절기 경계는 평균 절입일(±1일 오차 가능)을 사용합니다.
 * ===================================================================== */

const STEMS = [
  { han: "甲", kor: "갑", el: "wood",  yin: false },
  { han: "乙", kor: "을", el: "wood",  yin: true  },
  { han: "丙", kor: "병", el: "fire",  yin: false },
  { han: "丁", kor: "정", el: "fire",  yin: true  },
  { han: "戊", kor: "무", el: "earth", yin: false },
  { han: "己", kor: "기", el: "earth", yin: true  },
  { han: "庚", kor: "경", el: "metal", yin: false },
  { han: "辛", kor: "신", el: "metal", yin: true  },
  { han: "壬", kor: "임", el: "water", yin: false },
  { han: "癸", kor: "계", el: "water", yin: true  },
];

const BRANCHES = [
  { han: "子", kor: "자", el: "water", animal: "쥐",     main: 9 },
  { han: "丑", kor: "축", el: "earth", animal: "소",     main: 5 },
  { han: "寅", kor: "인", el: "wood",  animal: "호랑이", main: 0 },
  { han: "卯", kor: "묘", el: "wood",  animal: "토끼",   main: 1 },
  { han: "辰", kor: "진", el: "earth", animal: "용",     main: 4 },
  { han: "巳", kor: "사", el: "fire",  animal: "뱀",     main: 2 },
  { han: "午", kor: "오", el: "fire",  animal: "말",     main: 3 },
  { han: "未", kor: "미", el: "earth", animal: "양",     main: 5 },
  { han: "申", kor: "신", el: "metal", animal: "원숭이", main: 6 },
  { han: "酉", kor: "유", el: "metal", animal: "닭",     main: 7 },
  { han: "戌", kor: "술", el: "earth", animal: "개",     main: 4 },
  { han: "亥", kor: "해", el: "water", animal: "돼지",   main: 8 },
];

const ELEMENTS = {
  wood:  { kor: "목", han: "木" },
  fire:  { kor: "화", han: "火" },
  earth: { kor: "토", han: "土" },
  metal: { kor: "금", han: "金" },
  water: { kor: "수", han: "水" },
};

const GENERATES = { wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" };
const CONTROLS  = { wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" };

/* 출생 지역 → 대표 경도 (진태양시 보정: (경도-135°) × 4분) */
const REGIONS = [
  { name: "서울",        lon: 126.98 },
  { name: "부산",        lon: 129.08 },
  { name: "대구",        lon: 128.60 },
  { name: "인천",        lon: 126.70 },
  { name: "광주",        lon: 126.85 },
  { name: "대전",        lon: 127.38 },
  { name: "울산",        lon: 129.31 },
  { name: "세종",        lon: 127.29 },
  { name: "경기",        lon: 127.02 },
  { name: "강원",        lon: 127.92 },
  { name: "충북",        lon: 127.49 },
  { name: "충남",        lon: 126.66 },
  { name: "전북",        lon: 127.15 },
  { name: "전남",        lon: 126.46 },
  { name: "경북",        lon: 128.73 },
  { name: "경남",        lon: 128.68 },
  { name: "제주",        lon: 126.53 },
  { name: "해외 / 모름", lon: null },
];

function regionCorrectionMin(regionIdx) {
  const r = REGIONS[regionIdx];
  if (!r || r.lon == null) return 0;
  return Math.round((r.lon - 135) * 4);
}

const SOLAR_TERMS = [
  { m: 2,  d: 4, branch: 2  },
  { m: 3,  d: 6, branch: 3  },
  { m: 4,  d: 5, branch: 4  },
  { m: 5,  d: 6, branch: 5  },
  { m: 6,  d: 6, branch: 6  },
  { m: 7,  d: 7, branch: 7  },
  { m: 8,  d: 8, branch: 8  },
  { m: 9,  d: 8, branch: 9  },
  { m: 10, d: 8, branch: 10 },
  { m: 11, d: 7, branch: 11 },
  { m: 12, d: 7, branch: 0  },
  { m: 1,  d: 6, branch: 1  },
];

function daysBetweenUTC(y1, m1, d1, y2, m2, d2) {
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function sajuYear(y, m, d) {
  return (m < 2 || (m === 2 && d < 4)) ? y - 1 : y;
}

function yearPillar(y, m, d) {
  const sy = sajuYear(y, m, d);
  return { stem: ((sy - 4) % 10 + 10) % 10, branch: ((sy - 4) % 12 + 12) % 12 };
}

function monthPillar(y, m, d, yStem) {
  let branch = 1;
  const ORDER_BY_BRANCH = { 2:1, 3:2, 4:3, 5:4, 6:5, 7:6, 8:7, 9:8, 10:9, 11:10, 0:11, 1:12 };
  for (const t of SOLAR_TERMS) {
    if (m > t.m || (m === t.m && d >= t.d)) {
      if (t.m === 1 && m > 1) continue;
      branch = t.branch;
    }
  }
  if (m === 1 && d < 6) branch = 0;
  const monthOrder = ORDER_BY_BRANCH[branch];
  const firstStem = (yStem % 5) * 2 + 2;
  return { stem: (firstStem + monthOrder - 1) % 10, branch };
}

function dayPillar(y, m, d) {
  const diff = daysBetweenUTC(1900, 1, 1, y, m, d);
  const idx = ((10 + diff) % 60 + 60) % 60;
  return { stem: idx % 10, branch: idx % 12 };
}

function hourPillarFromHour(dayStem, hour) {
  const branch = Math.floor(((hour + 1) % 24) / 2) % 12;
  return { stem: ((dayStem % 5) * 2 + branch) % 10, branch };
}

/* ---------- 십신(十神) ---------- */
function tenGodOfStem(dayStemIdx, otherStemIdx) {
  const d = STEMS[dayStemIdx], o = STEMS[otherStemIdx];
  const same = d.yin === o.yin;
  if (d.el === o.el) return same ? "비견" : "겁재";
  if (GENERATES[d.el] === o.el) return same ? "식신" : "상관";
  if (CONTROLS[d.el] === o.el) return same ? "편재" : "정재";
  if (CONTROLS[o.el] === d.el) return same ? "편관" : "정관";
  if (GENERATES[o.el] === d.el) return same ? "편인" : "정인";
  return "비견";
}
function tenGodOfBranch(dayStemIdx, branchIdx) {
  return tenGodOfStem(dayStemIdx, BRANCHES[branchIdx].main);
}
/* 십신 → 오성(五星) 그룹 */
function tenGodGroup(name) {
  if (name === "비견" || name === "겁재") return "비겁";
  if (name === "식신" || name === "상관") return "식상";
  if (name === "편재" || name === "정재") return "재성";
  if (name === "편관" || name === "정관") return "관성";
  return "인성";
}
function tenGodRelation(dayEl, targetEl) {
  if (dayEl === targetEl) return "비겁";
  if (GENERATES[dayEl] === targetEl) return "식상";
  if (CONTROLS[dayEl] === targetEl) return "재성";
  if (CONTROLS[targetEl] === dayEl) return "관성";
  return "인성";
}

/* ---------- 신살(神殺) ---------- */
const SAMHAP_GROUP = { 2:0, 6:0, 10:0, 8:1, 0:1, 4:1, 5:2, 9:2, 1:2, 11:3, 3:3, 7:3 };
const DOHWA  = [3, 9, 6, 0];   // 인오술→묘, 신자진→유, 사유축→오, 해묘미→자
const YEOKMA = [8, 2, 11, 5];  // 인오술→신, 신자진→인, 사유축→해, 해묘미→사
const HWAGAE = [10, 4, 1, 7];  // 인오술→술, 신자진→진, 사유축→축, 해묘미→미
const CHEONEUL = { 0:[1,7], 4:[1,7], 6:[1,7], 1:[0,8], 5:[0,8], 2:[11,9], 3:[11,9], 8:[3,5], 9:[3,5], 7:[6,2] };

function findSinsal(pillars) {
  const branches = [pillars.year, pillars.month, pillars.day, pillars.hour]
    .filter(Boolean).map(p => p.branch);
  const dayBranch = pillars.day.branch;
  const dayStem = pillars.day.stem;
  const g = SAMHAP_GROUP[dayBranch];
  const found = [];
  if (branches.includes(DOHWA[g]))  found.push({ key: "dohwa",  name: "도화살", han: "桃花" });
  if (branches.includes(YEOKMA[g])) found.push({ key: "yeokma", name: "역마살", han: "驛馬" });
  if (branches.includes(HWAGAE[g])) found.push({ key: "hwagae", name: "화개살", han: "華蓋" });
  if ((CHEONEUL[dayStem] || []).some(b => branches.includes(b)))
    found.push({ key: "cheoneul", name: "천을귀인", han: "天乙貴人" });
  return found;
}

/* ---------- 대운(大運) ---------- */
function sixtyIndex(stem, branch) {
  for (let k = 0; k < 60; k++) if (k % 10 === stem && k % 12 === branch) return k;
  return 0;
}

/** 생일 전후로 가장 가까운 절기일까지의 일수 (forward: true=다음 절기) */
function daysToTerm(y, m, d, forward) {
  const dates = [];
  for (const yy of [y - 1, y, y + 1]) {
    for (const t of SOLAR_TERMS) dates.push({ y: yy, m: t.m, d: t.d });
  }
  let best = null;
  for (const t of dates) {
    const diff = daysBetweenUTC(y, m, d, t.y, t.m, t.d);
    if (forward && diff > 0 && (best === null || diff < best)) best = diff;
    if (!forward && diff < 0 && (best === null || -diff < best)) best = -diff;
  }
  return best ?? 15;
}

/**
 * 대운 산출: 양남음녀 순행, 음남양녀 역행 / 3일 = 1년
 * @returns { forward, startAge, list: [{stem, branch, fromAge, toAge, tenGod}] }
 */
function calcDaeun(y, m, d, gender, yearStemIdx, monthP, dayStemIdx) {
  const yangYear = !STEMS[yearStemIdx].yin;
  const forward = (yangYear && gender === "M") || (!yangYear && gender === "F");
  const days = daysToTerm(y, m, d, forward);
  const startAge = Math.min(10, Math.max(1, Math.round(days / 3)));
  const base = sixtyIndex(monthP.stem, monthP.branch);
  const list = [];
  for (let i = 1; i <= 8; i++) {
    const k = ((base + (forward ? i : -i)) % 60 + 60) % 60;
    const stem = k % 10, branch = k % 12;
    list.push({
      stem, branch,
      fromAge: startAge + (i - 1) * 10,
      toAge: startAge + i * 10 - 1,
      tenGod: tenGodGroup(tenGodOfStem(dayStemIdx, stem)),
    });
  }
  return { forward, startAge, list };
}

/* ---------- 진태양시 보정 ---------- */
function applyTrueSolarTime(y, m, d, hour, minute, regionIdx) {
  const corr = regionCorrectionMin(regionIdx);
  let total = hour * 60 + minute + corr;
  let dayShift = 0;
  if (total < 0) { total += 1440; dayShift = -1; }
  else if (total >= 1440) { total -= 1440; dayShift = 1; }
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dayShift);
  return {
    y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(),
    hour: Math.floor(total / 60), minute: total % 60,
    corrMin: corr,
  };
}

/* ---------- 합(合)·충(沖) — 궁합/시기 계산 ---------- */
/* 천간합: 갑기·을경·병신·정임·무계 → 합이 되는 상대 일간 */
function hapStem(stemIdx) { return (stemIdx + 5) % 10; }
/* 육합: 자축·인해·묘술·진유·사신·오미 */
const YUKHAP = { 0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6 };
/* 충: 마주보는 지지 */
function chungBranch(b) { return (b + 6) % 12; }
/* 삼합 그룹 멤버 */
const SAMHAP_MEMBERS = [[2, 6, 10], [8, 0, 4], [5, 9, 1], [11, 3, 7]];
/* 지지 → 절기월(대략) / 시간대 / 방위 */
const MONTH_OF_BRANCH = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 0: 12, 1: 1 };
const HOUR_OF_BRANCH = ["23시~1시", "1시~3시", "3시~5시", "5시~7시", "7시~9시", "9시~11시", "11시~13시", "13시~15시", "15시~17시", "17시~19시", "19시~21시", "21시~23시"];
const DIR_OF_BRANCH = ["북쪽", "북동쪽", "북동쪽", "동쪽", "남동쪽", "남동쪽", "남쪽", "남서쪽", "남서쪽", "서쪽", "북서쪽", "북서쪽"];
/* 오행 기운이 차오르는 달 */
const ELEMENT_MONTHS = { wood: "2~3월", fire: "5~6월", earth: "1·4·7·10월", metal: "8~9월", water: "11~12월" };

/* ---------- 개인화 심화 지표: 신강약 · 용신 · 조후 · 원국 합충 ---------- */

/* 월지 → 계절 (인묘진=봄, 사오미=여름, 신유술=가을, 해자축=겨울) */
const SEASON_OF_BRANCH = {
  2: "spring", 3: "spring", 4: "spring",
  5: "summer", 6: "summer", 7: "summer",
  8: "autumn", 9: "autumn", 10: "autumn",
  11: "winter", 0: "winter", 1: "winter",
};

/* 일간 세력(신강·신약) — 월지(득령)>일지(득지)>기타 가중 합산 */
function assessStrength(pillars, dayEl) {
  let sup = 0, tot = 0;
  const add = (el, w) => { tot += w; if (el === dayEl || GENERATES[el] === dayEl) sup += w; };
  add(STEMS[pillars.year.stem].el, 1.0);
  add(BRANCHES[pillars.year.branch].el, 1.0);
  add(STEMS[pillars.month.stem].el, 1.2);
  add(BRANCHES[pillars.month.branch].el, 2.6);  // 득령
  add(BRANCHES[pillars.day.branch].el, 1.6);    // 득지
  if (pillars.hour) {
    add(STEMS[pillars.hour.stem].el, 1.0);
    add(BRANCHES[pillars.hour.branch].el, 1.0);
  }
  const ratio = sup / tot;
  const mEl = BRANCHES[pillars.month.branch].el;
  const dEl = BRANCHES[pillars.day.branch].el;
  let category;
  if (ratio >= 0.62) category = "극신강";
  else if (ratio >= 0.47) category = "신강";
  else if (ratio >= 0.33) category = "중화";
  else if (ratio >= 0.20) category = "신약";
  else category = "극신약";
  return {
    ratio: Math.round(ratio * 100), category,
    gotMonth: mEl === dayEl || GENERATES[mEl] === dayEl,  // 득령
    gotDay: dEl === dayEl || GENERATES[dEl] === dayEl,    // 득지
  };
}

/* 용신 추정 — 신강이면 흘려보낼 출구(식상·재성·관성), 신약이면 채울 뿌리(인성·비겁),
 * 중화면 조후(겨울생→화, 여름생→수) 또는 최약 오행 보완 */
function pickYongsin(counts, dayEl, strengthCat, monthBranch, weakest) {
  const officerEl = Object.keys(CONTROLS).find(k => CONTROLS[k] === dayEl);
  const resourceEl = Object.keys(GENERATES).find(k => GENERATES[k] === dayEl);
  if (strengthCat === "극신강" || strengthCat === "신강") {
    const cands = [
      { god: "재성", el: CONTROLS[dayEl] },
      { god: "식상", el: GENERATES[dayEl] },
      { god: "관성", el: officerEl },
    ];
    const best = cands.reduce((a, b) => (counts[b.el] > counts[a.el] ? b : a));
    return { el: best.el, god: best.god, method: "억부", reason: "넘치는 일간의 힘을 흘려보내는 출구" };
  }
  if (strengthCat === "신약" || strengthCat === "극신약") {
    const best = counts[dayEl] > counts[resourceEl]
      ? { god: "비겁", el: dayEl }
      : { god: "인성", el: resourceEl };
    return { el: best.el, god: best.god, method: "억부", reason: "모자란 일간의 힘을 채워주는 뿌리" };
  }
  if ([11, 0, 1].includes(monthBranch)) return { el: "fire", god: null, method: "조후", reason: "겨울에 태어난 사주를 데우는 온기" };
  if ([5, 6, 7].includes(monthBranch)) return { el: "water", god: null, method: "조후", reason: "여름에 태어난 사주를 식히는 물" };
  return { el: weakest, god: null, method: "보완", reason: "판을 고르게 만드는 가장 옅은 기운" };
}

/* 원국 안 인접 지지끼리의 충·육합·삼합 (ym=연월, md=월일, dh=일시) */
function findNatalRelations(pillars) {
  const pairs = [["year", "month", "ym"], ["month", "day", "md"], ["day", "hour", "dh"]];
  const out = [];
  for (const [a, b, pos] of pairs) {
    const pa = pillars[a], pb = pillars[b];
    if (!pa || !pb) continue;
    if (chungBranch(pa.branch) === pb.branch) out.push({ kind: "충", pos, branches: [pa.branch, pb.branch] });
    else if (YUKHAP[pa.branch] === pb.branch) out.push({ kind: "육합", pos, branches: [pa.branch, pb.branch] });
    else if (pa.branch !== pb.branch && SAMHAP_GROUP[pa.branch] === SAMHAP_GROUP[pb.branch])
      out.push({ kind: "삼합", pos, branches: [pa.branch, pb.branch] });
  }
  return out;
}

/* ---------- 배우자·직업 리포트용 헬퍼 ---------- */

/* 연도만으로 그 해의 간지 (연운·세운용, 입춘 이후 기준) */
function yearPillarOf(y) {
  return { stem: ((y - 4) % 10 + 10) % 10, branch: ((y - 4) % 12 + 12) % 12 };
}

/* 앞으로 n년의 세운: 연도별 간지와 십신 그룹 */
function seunList(dayStemIdx, fromYear, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = fromYear + i;
    const p = yearPillarOf(y);
    out.push({
      year: y, stem: p.stem, branch: p.branch,
      god: tenGodGroup(tenGodOfStem(dayStemIdx, p.stem)),
      ganji: STEMS[p.stem].kor + BRANCHES[p.branch].kor,
    });
  }
  return out;
}

/* 배우자성(남=재성, 여=관성)이 놓인 궁: 월>일>시>연 순으로 천간 먼저 탐색 */
function spouseStarPosition(saju, gender) {
  const dayEl = saju.dayEl;
  const starEl = gender === "M" ? CONTROLS[dayEl] : Object.keys(CONTROLS).find(k => CONTROLS[k] === dayEl);
  const order = ["month", "day", "hour", "year"];
  for (const key of order) {
    const p = saju.pillars[key];
    if (p && key !== "day" && STEMS[p.stem].el === starEl) return { pos: key, via: "stem", starEl };
  }
  for (const key of order) {
    const p = saju.pillars[key];
    if (p && BRANCHES[p.branch].el === starEl) return { pos: key, via: "branch", starEl };
  }
  return { pos: "day", via: "none", starEl };  // 배우자성 미노출 → 배우자궁(일지)으로 봄
}

/* ---------- 메인 ----------
 * input: { y, m, d, hour(-1=모름), minute, regionIdx, gender("M"|"F") }
 */
function calculateSaju(input) {
  const { y, m, d, gender } = input;
  const hasTime = input.hour >= 0;

  // 진태양시 보정 (시간을 아는 경우만)
  // 단, 시진(십이지시)을 직접 고른 경우(timeMode === "sijin")는 이미 시주 단위 선택이므로 보정 생략
  let eff = { y, m, d, hour: input.hour, minute: input.minute || 0, corrMin: 0 };
  if (hasTime && input.timeMode !== "sijin") eff = applyTrueSolarTime(y, m, d, input.hour, input.minute || 0, input.regionIdx ?? 17);

  const yp = yearPillar(eff.y, eff.m, eff.d);
  const mp = monthPillar(eff.y, eff.m, eff.d, yp.stem);
  const dp = dayPillar(eff.y, eff.m, eff.d);
  const hp = hasTime ? hourPillarFromHour(dp.stem, eff.hour) : null;

  const pillars = { year: yp, month: mp, day: dp, hour: hp };

  // 오행 집계
  const counts = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const chars = [yp, mp, dp].concat(hp ? [hp] : []);
  for (const p of chars) {
    counts[STEMS[p.stem].el]++;
    counts[BRANCHES[p.branch].el]++;
  }
  const total = chars.length * 2;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  // 십신 (기둥별: 천간/지지)
  const tenGods = {};
  for (const key of ["year", "month", "day", "hour"]) {
    const p = pillars[key];
    if (!p) { tenGods[key] = null; continue; }
    tenGods[key] = {
      stem: key === "day" ? "일간" : tenGodOfStem(dp.stem, p.stem),
      branch: tenGodOfBranch(dp.stem, p.branch),
    };
  }

  // 십신 그룹 개수 (일간 제외 글자들)
  const godCounts = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const key of ["year", "month", "day", "hour"]) {
    const p = pillars[key];
    if (!p) continue;
    if (key !== "day") godCounts[tenGodGroup(tenGodOfStem(dp.stem, p.stem))]++;
    godCounts[tenGodGroup(tenGodOfBranch(dp.stem, p.branch))]++;
  }

  const sinsal = findSinsal(pillars);
  const daeun = calcDaeun(y, m, d, gender, yp.stem, mp, dp.stem);

  // 개인화 심화 지표
  const dayElement = STEMS[dp.stem].el;
  const strength = assessStrength(pillars, dayElement);
  const weakestEl = sorted[sorted.length - 1][0];
  const yongsin = pickYongsin(counts, dayElement, strength.category, mp.branch, weakestEl);

  return {
    pillars, counts, total,
    dominant: sorted[0][0],
    weakest: sorted[sorted.length - 1][0],
    dayStem: dp.stem,
    dayEl: STEMS[dp.stem].el,
    dayYin: STEMS[dp.stem].yin,
    zodiac: BRANCHES[yp.branch].animal,
    tenGods, godCounts, sinsal, daeun,
    strength, yongsin,
    missing: Object.keys(counts).filter(k => counts[k] === 0),
    season: SEASON_OF_BRANCH[mp.branch],
    natalRelations: findNatalRelations(pillars),
    iljuIdx: sixtyIndex(dp.stem, dp.branch),
    hourBranch: hp ? hp.branch : null,
    solarTime: hasTime ? eff : null,
    ganjiText: {
      year:  STEMS[yp.stem].kor + BRANCHES[yp.branch].kor,
      month: STEMS[mp.stem].kor + BRANCHES[mp.branch].kor,
      day:   STEMS[dp.stem].kor + BRANCHES[dp.branch].kor,
      hour:  hp ? STEMS[hp.stem].kor + BRANCHES[hp.branch].kor : null,
    },
  };
}

/* ---------- Node(서버) 환경 지원 ----------
 * 브라우저에서는 이 블록이 무시되고(top-level const가 전역으로 노출),
 * Node에서 require 하면 content.js가 참조하는 이름들을 globalThis로 올려
 * 두 파일이 서버에서도 동작하게 합니다. */
if (typeof module !== "undefined" && module.exports) {
  const _E = {
    STEMS, BRANCHES, ELEMENTS, GENERATES, CONTROLS, REGIONS,
    calculateSaju, tenGodRelation, tenGodOfStem, tenGodOfBranch, tenGodGroup,
    hapStem, YUKHAP, chungBranch, SAMHAP_GROUP, SAMHAP_MEMBERS, CHEONEUL,
    DOHWA, YEOKMA, HWAGAE, MONTH_OF_BRANCH, HOUR_OF_BRANCH, DIR_OF_BRANCH,
    ELEMENT_MONTHS, dayPillar, sixtyIndex,
    SEASON_OF_BRANCH, assessStrength, pickYongsin, findNatalRelations,
    yearPillarOf, seunList, spouseStarPosition,
  };
  module.exports = _E;
  if (typeof globalThis !== "undefined") Object.assign(globalThis, _E);
}
