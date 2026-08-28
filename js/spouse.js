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

  /* ---------- 공용 생년월일시 입력 (양/음력·분 단위·진태양시 — 사주 페이지와 동일 기준) ---------- */
  BirthInput.mount("#sp-birth", {
    idPrefix: "sp",
    submitLabel: "내 배우자의 초상 열어보기",
    onSubmit(input) {
      const saju = calculateSaju(input);
      const rep = buildSpouseReport(saju, input);
      cur = { input, saju, rep };
      render();
      setTimeout(() => $("#sp-result").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    },
  });

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
    void saju;
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

    // 몽타주 (기본 리포트 구매 전에는 베일)
    const face = typeof buildSpouseFace === "function" ? buildSpouseFace(saju, input) : null;
    const montage = face ? `
      <div class="mont-card">
        <p class="mont-kick">豫想 肖像 · 예상 몽타주</p>
        <div class="mont-frame ${hasBasic ? "" : "veiled"}">
          ${face.img
            ? `<img class="face-svg" src="${face.img}" alt="배우자 예상 몽타주" width="420" height="420" />`
            : face.svg}
          ${hasBasic ? "" : `<div class="mont-veil"><b>아직 베일에 가려 있습니다</b>
            <button type="button" data-buy="spouse">🪙 ${Coins.PRICE.spouse}코인으로 얼굴 보기</button></div>`}
        </div>
        <p class="mont-name">${input.gender === "M" ? "당신의 <em>아내</em>가 될 사람" : "당신의 <em>남편</em>이 될 사람"}
          — ${ELEMENTS[face.el].kor}(${ELEMENTS[face.el].han})의 기운</p>
        <div class="mont-traits">${face.traits.map(t => `<span>${t}</span>`).join("")}</div>
        <p class="mont-note">사주의 배우자성 오행·음양·배우자궁 십신을 얼굴 특징으로 옮겨 그린 <b>인상 스케치</b>입니다.<br />실존 인물과는 무관하며, 재미로 봐주세요.</p>
      </div>` : "";

    const metaLine = typeof BirthInput !== "undefined"
      ? `<p class="sp-meta">${BirthInput.metaLine(input, cur.saju)}</p>` : "";

    // 인연 지수 — 총점은 항상 공개(훅), 5축 상세는 기본 리포트에 포함
    const sc = rep.score;
    const scoreCard = sc ? `
      <div class="score-card">
        <p class="mont-kick">因緣 指數 · 인연 지수</p>
        <div class="sc-total"><em>${sc.total}</em><span>점</span></div>
        <p class="sc-title">${sc.grade.title}</p>
        <div class="sc-axes ${hasBasic ? "" : "veiled"}">
          ${sc.axes.map(a => `<div class="sc-axis"><span class="sa-name">${a.name.split(" — ")[0]}</span>
            <div class="sa-track"><i style="width:${a.val}%"></i></div><b>${a.val}</b></div>`).join("")}
          ${hasBasic ? `<p class="sc-text">${sc.grade.text}</p>` : `<div class="sc-lock"><button type="button" data-buy="spouse">🪙 ${Coins.PRICE.spouse}코인으로 상세 채점표 보기</button></div>`}
        </div>
      </div>` : "";

    $("#sp-result").innerHTML = metaLine + montage + scoreCard + `
      <div class="letter-card" style="margin-top:14px">
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

  Coins.renderPill(".hd-in");
  Coins.onChange(() => { const b = $("#sp-bal"); if (b) b.textContent = Coins.balance(); });
  document.querySelector(".cnav-item.active")?.scrollIntoView({ inline: "center", block: "nearest" });
})();
