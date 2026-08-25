/* =====================================================================
 * spouse.js — 미래 배우자 리포트 (연서 테마)
 *  saju.js·content2.js·coins.js 전역을 사용합니다.
 *  가격: 기본 리포트 spouse(5코인) · 디테일 팩 spouse_detail(+4코인) · 묶음 8코인
 * ===================================================================== */
(function () {
  const $ = (s) => document.querySelector(s);
  const LAST_KEY = "cheongiyeon_last_input";
  const sigOf = (i) => `${i.y}-${i.m}-${i.d}_${i.hour}_${i.minute || 0}_${i.gender}`;
  const ownKey = (p, sig) => `cgy_own_${p}_${sig}`;
  const owns = (p, sig) => localStorage.getItem(ownKey(p, sig)) === "1";
  const grant = (p, sig) => localStorage.setItem(ownKey(p, sig), "1");
  const BUNDLE = 8; // spouse(5) + detail(4) 묶음가

  let cur = null; // { input, saju, rep }

  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2400); }

  /* ---------- 셀렉트 초기화 ---------- */
  function fill(sel, from, to, fmt, sel0) {
    const el = $(sel);
    el.innerHTML = "";
    for (let v = from; from < to ? v <= to : v >= to; from < to ? v++ : v--) {
      const o = document.createElement("option"); o.value = v; o.textContent = fmt(v); el.appendChild(o);
    }
    if (sel0 != null) el.value = sel0;
  }
  fill("#sp-year", 2010, 1940, y => y + "년", 1995);
  fill("#sp-month", 1, 12, m => m + "월", 6);
  fill("#sp-day", 1, 31, d => d + "일", 15);
  (function () {
    const el = $("#sp-hour");
    el.innerHTML = `<option value="-1">태어난 시 모름</option>` +
      Array.from({ length: 24 }, (_, h) => `<option value="${h}">${h}시</option>`).join("");
  })();
  (function () {
    const el = $("#sp-region");
    el.innerHTML = REGIONS.map((r, i) => `<option value="${i}">${r.name}</option>`).join("");
    el.value = 0;
  })();
  // 다른 서비스 입력값 자동 채움
  try {
    const last = JSON.parse(localStorage.getItem(LAST_KEY) || "null");
    if (last) {
      $("#sp-year").value = last.y; $("#sp-month").value = last.m; $("#sp-day").value = last.d;
      $("#sp-hour").value = last.hour ?? -1; $("#sp-region").value = last.regionIdx ?? 0;
      if (last.gender === "F") $("#sp-gf").checked = true;
    }
  } catch (e) {}

  /* ---------- 렌더 ---------- */
  function sectionHTML(sec, unlocked) {
    const tag = sec.detail ? `<span class="detail-tag">디테일</span>` : "";
    if (unlocked) {
      return `<div class="sec-card">${tag}<h3><span class="ic">${sec.icon}</span>${sec.title}</h3>
        <div class="sec-body">${sec.html}</div></div>`;
    }
    return `<div class="sec-card locked">${tag}<h3><span class="ic">${sec.icon}</span>${sec.title}</h3>
      <p class="tz">${sec.teaser}</p>
      <div class="sec-body">${sec.html}</div>
      <div class="lock-cta"><button type="button" class="open-unlock">🪙 열어보기</button></div></div>`;
  }

  function render() {
    const { input, saju, rep } = cur;
    const sig = sigOf(input);
    const hasBasic = owns("spouse", sig);
    const hasDetail = owns("spouse_detail", sig);
    const elK = ELEMENTS[rep.starEl];

    const secs = rep.sections.map(sec =>
      sectionHTML(sec, sec.detail ? hasDetail : hasBasic)).join("");

    const priceBasic = Coins.PRICE.spouse, priceDetail = Coins.PRICE.spouse_detail;
    let unlockBar = "";
    if (!hasBasic || !hasDetail) {
      const btns = [];
      if (!hasBasic && !hasDetail) {
        btns.push(`<button class="btn u-all" data-buy="bundle">🪙 ${BUNDLE}코인 — 전체 리포트 한 번에 (${priceBasic + priceDetail}코인 → ${BUNDLE}코인)</button>`);
        btns.push(`<button class="btn u-basic" data-buy="spouse">🪙 ${priceBasic}코인 — 기본 리포트 (생김새·성격·장소·시기)</button>`);
      } else if (!hasDetail) {
        btns.push(`<button class="btn u-all" data-buy="spouse_detail">🪙 ${priceDetail}코인 — 디테일 팩 (나이차·직업·이성기류·짝꿍유형)</button>`);
      } else if (!hasBasic) {
        btns.push(`<button class="btn u-basic" data-buy="spouse">🪙 ${priceBasic}코인 — 기본 리포트 열기</button>`);
      }
      unlockBar = `<div class="unlock-bar">
        <h4>초상화의 나머지를 열어보세요</h4>
        <p>내 코인 🪙 <b id="sp-bal">${Coins.balance()}</b>개 · 광고를 보면 +1코인</p>
        <div class="unlock-btns">${btns.join("")}</div>
        <p class="u-note">코인이 모자라면 충전 창이 열립니다 · 열람 후에는 환불되지 않습니다</p>
      </div>`;
    }

    $("#sp-result").innerHTML = `
      <div class="letter-card">
        <div class="portrait-seal">
          <span class="ps-el el-${rep.starEl}">${elK.han}</span>
          <span class="ps-txt"><b>당신의 배우자성 — ${elK.kor}(${elK.han})</b>
          <small>${input.gender === "M" ? "재성(내가 품는 기운)" : "관성(나를 이끄는 기운)"} · ${rep.appearKey.endsWith("yin") ? "음" : "양"}의 결</small></span>
        </div>
        <p class="free-line">${rep.freeLine}</p>
        <p class="meet-chip">인연의 창 — <b>${rep.meetLine}</b> <small>(자세한 해와 달은 아래에)</small></p>
      </div>
      ${secs}
      ${unlockBar}`;
    $("#sp-result").classList.remove("hidden");

    document.querySelectorAll("#sp-result [data-buy]").forEach(b =>
      b.addEventListener("click", () => buy(b.dataset.buy)));
    document.querySelectorAll("#sp-result .open-unlock").forEach(b =>
      b.addEventListener("click", () => $(".unlock-bar")?.scrollIntoView({ behavior: "smooth", block: "center" })));
  }

  function buy(what) {
    const sig = sigOf(cur.input);
    const cost = what === "bundle" ? BUNDLE : Coins.PRICE[what];
    if (Coins.balance() < cost) {
      Coins.openShop(`이 리포트를 열려면 🪙 ${cost}코인이 필요해요 (지금 ${Coins.balance()}개)`);
      return;
    }
    if (!Coins.spend(cost, what === "bundle" ? "배우자 리포트(전체)" : what === "spouse" ? "배우자 리포트(기본)" : "배우자 디테일 팩")) return;
    if (what === "bundle") { grant("spouse", sig); grant("spouse_detail", sig); }
    else grant(what, sig);
    toast(`🪙 ${cost}코인으로 열었습니다`);
    render();
  }

  /* ---------- 실행 ---------- */
  $("#sp-run").addEventListener("click", () => {
    const input = {
      y: +$("#sp-year").value, m: +$("#sp-month").value, d: +$("#sp-day").value,
      hour: +$("#sp-hour").value, minute: 0, regionIdx: +$("#sp-region").value,
      gender: $("#sp-gf").checked ? "F" : "M",
    };
    localStorage.setItem(LAST_KEY, JSON.stringify(input));
    const saju = calculateSaju(input);
    const rep = buildSpouseReport(saju, input);
    cur = { input, saju, rep };
    render();
    setTimeout(() => $("#sp-result").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  });

  Coins.renderPill(".hd-in");
  Coins.onChange(() => { const b = $("#sp-bal"); if (b) b.textContent = Coins.balance(); });
  document.querySelector(".cnav-item.active")?.scrollIntoView({ inline: "center", block: "nearest" });
})();
