/* =====================================================================
 * career.js — 직업운 리포트 (지면 테마)
 *  saju.js·content.js·content2.js·coins.js 전역을 사용합니다.
 *  가격: 기본 career(5코인) · 디테일 career_detail(+4코인) · 묶음 8코인
 * ===================================================================== */
(function () {
  const $ = (s) => document.querySelector(s);
  const LAST_KEY = "cheongiyeon_last_input";
  const sigOf = (i) => `${i.y}-${i.m}-${i.d}_${i.hour}_${i.minute || 0}_${i.gender}`;
  const ownKey = (p, sig) => `cgy_own_${p}_${sig}`;
  const owns = (p, sig) => localStorage.getItem(ownKey(p, sig)) === "1";
  const grant = (p, sig) => localStorage.setItem(ownKey(p, sig), "1");
  const BUNDLE = 8;

  let cur = null;

  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2400); }

  const today = new Date();
  $("#paper-date").textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 · 제1판`;

  function fill(sel, from, to, fmt, sel0) {
    const el = $(sel);
    el.innerHTML = "";
    for (let v = from; from < to ? v <= to : v >= to; from < to ? v++ : v--) {
      const o = document.createElement("option"); o.value = v; o.textContent = fmt(v); el.appendChild(o);
    }
    if (sel0 != null) el.value = sel0;
  }
  fill("#ca-year", 2010, 1940, y => y + "년", 1995);
  fill("#ca-month", 1, 12, m => m + "월", 6);
  fill("#ca-day", 1, 31, d => d + "일", 15);
  $("#ca-hour").innerHTML = `<option value="-1">태어난 시 모름</option>` +
    Array.from({ length: 24 }, (_, h) => `<option value="${h}">${h}시</option>`).join("");
  $("#ca-region").innerHTML = REGIONS.map((r, i) => `<option value="${i}">${r.name}</option>`).join("");
  $("#ca-region").value = 0;
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY) || "null");
    if (last) {
      $("#ca-year").value = last.y; $("#ca-month").value = last.m; $("#ca-day").value = last.d;
      $("#ca-hour").value = last.hour ?? -1; $("#ca-region").value = last.regionIdx ?? 0;
      if (last.gender === "F") $("#ca-gf").checked = true;
    }
  } catch (e) {}

  function sectionHTML(sec, unlocked) {
    const tag = sec.detail ? `<span class="detail-tag">디테일</span>` : "";
    if (unlocked) {
      return `<div class="art unlocked">${tag}<span class="stamp-mark">閱覽必</span>
        <h3>${sec.icon} ${sec.title}</h3><div class="art-body">${sec.html}</div></div>`;
    }
    return `<div class="art locked">${tag}<h3>${sec.icon} ${sec.title}</h3>
      <p class="tz">${sec.teaser}</p><div class="art-body">${sec.html}</div>
      <div class="lock-cta"><button type="button" class="open-unlock">🪙 기사 전문 읽기</button></div></div>`;
  }

  function render() {
    const { input, rep } = cur;
    const sig = sigOf(input);
    const hasBasic = owns("career", sig);
    const hasDetail = owns("career_detail", sig);
    const secs = rep.sections.map(sec => sectionHTML(sec, sec.detail ? hasDetail : hasBasic)).join("");

    const pB = Coins.PRICE.career, pD = Coins.PRICE.career_detail;
    let unlockBar = "";
    if (!hasBasic || !hasDetail) {
      const btns = [];
      if (!hasBasic && !hasDetail) {
        btns.push(`<button class="btn u-all" data-buy="bundle">🪙 ${BUNDLE}코인 — 전 지면 한 번에 (${pB + pD}코인 → ${BUNDLE}코인)</button>`);
        btns.push(`<button class="btn u-basic" data-buy="career">🪙 ${pB}코인 — 기본 리포트 (적성·분야·캘린더·이직)</button>`);
      } else if (!hasDetail) {
        btns.push(`<button class="btn u-all" data-buy="career_detail">🪙 ${pD}코인 — 디테일 팩 (재물 곡선·10년 지도)</button>`);
      } else if (!hasBasic) {
        btns.push(`<button class="btn u-basic" data-buy="career">🪙 ${pB}코인 — 기본 리포트 열기</button>`);
      }
      unlockBar = `<div class="unlock-bar">
        <h4>기사 전문을 발행해 드립니다</h4>
        <p>내 코인 🪙 <b id="ca-bal">${Coins.balance()}</b>개 · 광고를 보면 +1코인</p>
        <div class="unlock-btns">${btns.join("")}</div>
        <p class="u-note">코인이 모자라면 충전 창이 열립니다 · 열람 후에는 환불되지 않습니다</p>
      </div>`;
    }

    $("#ca-result").innerHTML = `
      <div class="art unlocked">
        <h3>📌 오늘의 헤드라인</h3>
        <div class="art-body">
          <p>${rep.freeLine}</p>
          <p>앞으로 5년 중 당신의 승부의 해는 <b>${rep.bestYear}년</b>으로 관측됩니다. 연도별 상세 캘린더는 아래 지면에서 이어집니다.</p>
        </div>
      </div>
      ${secs}
      ${unlockBar}`;
    $("#ca-result").classList.remove("hidden");

    document.querySelectorAll("#ca-result [data-buy]").forEach(b =>
      b.addEventListener("click", () => buy(b.dataset.buy)));
    document.querySelectorAll("#ca-result .open-unlock").forEach(b =>
      b.addEventListener("click", () => $(".unlock-bar")?.scrollIntoView({ behavior: "smooth", block: "center" })));
  }

  function buy(what) {
    const sig = sigOf(cur.input);
    const cost = what === "bundle" ? BUNDLE : Coins.PRICE[what];
    if (Coins.balance() < cost) {
      Coins.openShop(`이 리포트를 열려면 🪙 ${cost}코인이 필요해요 (지금 ${Coins.balance()}개)`);
      return;
    }
    if (!Coins.spend(cost, what === "bundle" ? "직업 리포트(전체)" : what === "career" ? "직업 리포트(기본)" : "직업 디테일 팩")) return;
    if (what === "bundle") { grant("career", sig); grant("career_detail", sig); }
    else grant(what, sig);
    toast(`🪙 ${cost}코인으로 발행되었습니다`);
    render();
  }

  $("#ca-run").addEventListener("click", () => {
    const input = {
      y: +$("#ca-year").value, m: +$("#ca-month").value, d: +$("#ca-day").value,
      hour: +$("#ca-hour").value, minute: 0, regionIdx: +$("#ca-region").value,
      gender: $("#ca-gf").checked ? "F" : "M",
    };
    localStorage.setItem(LAST_KEY, JSON.stringify(input));
    const saju = calculateSaju(input);
    const rep = buildCareerReport(saju, input);
    cur = { input, saju, rep };
    render();
    setTimeout(() => $("#ca-result").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  });

  Coins.renderPill(".hd-in");
  Coins.onChange(() => { const b = $("#ca-bal"); if (b) b.textContent = Coins.balance(); });
  document.querySelector(".cnav-item.active")?.scrollIntoView({ inline: "center", block: "nearest" });
})();
