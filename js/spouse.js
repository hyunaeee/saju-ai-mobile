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
    const tag = sec.detail ? ` <span class="detail-tag">디테일</span>` : "";
    if (unlocked) {
      return `<div class="sec-card"><h3><span class="ic">${sec.icon}</span>${sec.title}${tag}</h3>
        <div class="sec-body">${sec.html}</div></div>`;
    }
    return `<div class="sec-card locked"><h3><span class="ic">${sec.icon}</span>${sec.title}${tag}</h3>
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
        btns.push(`<button class="btn u-basic" data-buy="spouse">🪙 ${priceBasic}코인 — 기본 리포트 (생김새·키·목소리·말투·장소·시기)</button>`);
      } else if (!hasDetail) {
        btns.push(`<button class="btn u-all" data-buy="spouse_detail">🪙 ${priceDetail}코인 — 디테일 팩 (나이차·직업·취미·이성기류·짝꿍유형)</button>`);
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
          — ${ELEMENTS[face.el].kor}(${ELEMENTS[face.el].han}) · ${face.moodName || ""}</p>
        <div class="mont-traits">${face.traits.map(t => `<span>${t}</span>`).join("")}</div>
        <p class="mont-note">배우자궁(일지)의 오행·음양·십신을 얼굴 특징으로 옮겨 그린 <b>인상 스케치</b>입니다.<br />실존 인물과는 무관하며, 재미로 봐주세요.</p>
      </div>` : "";

    const metaLine = typeof BirthInput !== "undefined"
      ? `<p class="sp-meta">${BirthInput.metaLine(input, cur.saju)}</p>` : "";

    // 運 지수 3종 — 총점 숫자는 항상 공개(훅), 한 줄 총평·5축 상세는 기본 리포트에 포함
    const sc = rep.score;
    const mateLabel = input.gender === "M" ? "아내운" : "남편운";
    const scoreCard = sc ? `
      <div class="score-card">
        <p class="mont-kick">運 指數 · 세 가지 지수</p>
        <div class="sc-tri">
          <div class="sc-tile"><em>${sc.love.val}</em><span>총 연애운</span></div>
          <div class="sc-tile main"><em>${sc.total}</em><span>인연 지수</span></div>
          <div class="sc-tile"><em>${sc.mate.val}</em><span>총 ${mateLabel}</span></div>
        </div>
        <p class="sc-title">${sc.grade.title}</p>
        <div class="sc-axes ${hasBasic ? "" : "veiled"}">
          <div class="sc-lines">
            <p><b>연애운 ${sc.love.val}</b> — ${sc.love.line}</p>
            <p><b>${mateLabel} ${sc.mate.val}</b> — ${sc.mate.line}</p>
          </div>
          <p class="sc-axhead">인연 지수 상세 채점표</p>
          ${sc.axes.map(a => `<div class="sc-axis"><span class="sa-name">${a.name.split(" — ")[0]}</span>
            <div class="sa-track"><i style="width:${a.val}%"></i></div><b>${a.val}</b></div>`).join("")}
          ${hasBasic ? `<p class="sc-text">${sc.grade.text}</p>` : `<div class="sc-lock"><button type="button" data-buy="spouse">🪙 ${Coins.PRICE.spouse}코인으로 세 지수 풀이 보기</button></div>`}
        </div>
        <p class="sc-note">연애운은 만남이 붙는 힘, ${mateLabel}은 결혼 뒤 배우자가 복이 되는 정도, 인연 지수는 이 인연 자체의 합입니다.</p>
      </div>` : "";

    $("#sp-result").innerHTML = metaLine + montage + scoreCard + `
      <div class="letter-card" style="margin-top:14px">
        <div class="portrait-seal">
          <span class="ps-el el-${rep.palaceEl}">${ELEMENTS[rep.palaceEl].han}</span>
          <span class="ps-txt"><b>배우자궁의 기운 — ${ELEMENTS[rep.palaceEl].kor}(${ELEMENTS[rep.palaceEl].han}) · ${rep.appearKey.endsWith("yin") ? "음" : "양"}</b>
          <small>사람의 결은 궁(宮)을 따릅니다 · 관계의 별(${input.gender === "M" ? "재성" : "관성"})은 ${elK.kor}(${elK.han})</small></span>
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

  /* ---------- 우리 궁합 검증 (배우자 실제 사주와 대조) ---------- */
  let vf = null; // { vin, s2, v }

  BirthInput.mount("#vf-birth", {
    idPrefix: "vf",
    submitLabel: "궁합 검증하기",
    noSave: true,  // 상대 정보가 내 기본값을 덮어쓰지 않게
    onSubmit(vin) {
      if (!cur) {
        toast("먼저 위에서 내 리포트를 열어주세요 — 대조할 배우자상이 필요해요");
        $("#sp-birth").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const s2 = calculateSaju(vin);
      vf = { vin, s2, v: buildCoupleVerify(cur.saju, cur.input, s2, vin) };
      renderVerify();
      setTimeout(() => $("#vf-result").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    },
  });

  function renderVerify() {
    if (!vf) return;
    const { vin, s2, v } = vf;
    const sig = sigOf(cur.input);
    const hasV = owns("verify", sig);
    const scCls = (s) => s >= 85 ? "hi" : s >= 60 ? "mid" : "lo";

    const axesHtml = v.axes.map(a => `<div class="vf-axis">
      <span class="va-n">${a.name}</span><span class="va-s ${scCls(a.score)}">${a.score}</span><p>${a.note}</p></div>`).join("");
    const dynHtml = v.dyn.map(d => `<div class="vd"><b>${d.label}</b> — ${d.text}</div>`).join("");
    const yearsHtml = v.years.length
      ? `<div class="vf-years">${v.years.map(x => `<span class="yr-${x.kind}">${x.y}${x.kind === "both" ? " ⚠︎ 함께 주의" : x.kind === "one" ? " 주의" : " 길년"}</span>`).join("")}</div>`
        + (v.crisis ? `<div class="vf-crisis">${["both", "one", "good"].filter(k => v.years.some(x => x.kind === k))
          .map(k => `<p>${v.crisis.find(c => c.key === k)?.text || ""}</p>`).join("")}</div>` : "")
      : `<p class="vf-crisis">앞으로 8년 안에 부부궁을 흔드는 충의 해가 없습니다 — 시기 걱정 없이 관계 자체에 집중하면 되는 구간입니다.</p>`;

    const body = `
      ${v.matchGrade ? `<p class="sc-title" style="margin-top:2px">${v.matchGrade.title}</p>` : ""}
      <div class="vf-axes">${axesHtml}</div>
      ${v.matchGrade ? `<p class="vf-crisis">${v.matchGrade.text}</p>` : ""}
      <p class="lc-title" style="font-size:15px;margin-top:18px">두 사주를 겹쳐 본 궁합</p>
      ${v.coupleGrade ? `<p class="sc-title" style="margin-top:2px">${v.coupleGrade.title}</p>` : ""}
      <div class="vf-dyn">${dynHtml}</div>
      ${v.coupleGrade ? `<p class="vf-crisis">${v.coupleGrade.text}</p>` : ""}
      <p class="lc-title" style="font-size:15px;margin-top:18px">흔들리기 쉬운 해 · 정 다지는 해</p>
      ${yearsHtml}`;

    $("#vf-result").innerHTML = `
      <div class="letter-card" style="margin-top:14px">
        <p class="sp-meta" style="margin:0 0 12px">${BirthInput.metaLine(vin, s2)} <br /><b>그 사람: ${s2.ganjiText.day}일주 · ${ELEMENTS[s2.dayEl].kor}(${ELEMENTS[s2.dayEl].han})의 ${s2.dayYin ? "음" : "양"}</b></p>
        <div class="vf-duo">
          <div class="vf-score"><em>${v.matchScore}</em><span>배우자상 일치율</span>${v.matchGrade ? `<small>${v.matchGrade.title}</small>` : ""}</div>
          <div class="vf-score"><em>${v.coupleScore}</em><span>궁합 점수</span>${v.coupleGrade ? `<small>${v.coupleGrade.title}</small>` : ""}</div>
        </div>
        <div class="${hasV ? "" : "vf-locked"}">
          <div class="vf-body">${body}</div>
          ${hasV ? "" : `<div class="vf-cta"><button type="button" id="vf-buy">🪙 ${Coins.PRICE.verify}코인 — 검증 전체 보기</button></div>`}
        </div>
        <p class="mont-note" style="margin-top:14px">두 분의 생일은 이 기기에서만 계산되며 저장·전송되지 않습니다. 참고용 콘텐츠입니다.</p>
      </div>`;
    $("#vf-result").classList.remove("hidden");
    $("#vf-buy")?.addEventListener("click", () => {
      const cost = Coins.PRICE.verify;
      if (Coins.balance() < cost) { Coins.openShop(`궁합 검증에 🪙 ${cost}코인이 필요해요 (지금 ${Coins.balance()}개)`); return; }
      if (!Coins.spend(cost, "궁합 검증")) return;
      grant("verify", sigOf(cur.input));
      toast(`🪙 ${cost}코인으로 검증이 열렸습니다`);
      renderVerify();
    });
  }

  Coins.renderPill(".hd-in");
  Coins.onChange(() => { const b = $("#sp-bal"); if (b) b.textContent = Coins.balance(); });
  document.querySelector(".cnav-item.active")?.scrollIntoView({ inline: "center", block: "nearest" });
})();
