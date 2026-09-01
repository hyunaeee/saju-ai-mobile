/* =====================================================================
 * career.js — 직업운 리포트 (지면 테마)
 *  saju.js·content.js·content2.js·coins.js 전역을 사용합니다.
 *  가격: 직업운 리포트 전체 career(8코인) · 전 서비스 패스 allpass(18코인)
 * ===================================================================== */
(function () {
  const $ = (s) => document.querySelector(s);
  const LAST_KEY = "cheongiyeon_last_input";
  const sigOf = (i) => `${i.y}-${i.m}-${i.d}_${i.hour}_${i.minute || 0}_${i.gender}`;
  const ownKey = (p, sig) => `cgy_own_${p}_${sig}`;
  const hasPass = (sig) => { try { return JSON.parse(localStorage.getItem(`cheongiyeon_own_${sig}`) || "{}").allpass === true; } catch (e) { return false; } };
  const owns = (p, sig) => hasPass(sig) || localStorage.getItem(ownKey(p, sig)) === "1";
  const grant = (p, sig) => localStorage.setItem(ownKey(p, sig), "1");
  const grantPass = (sig) => { try { const k = `cheongiyeon_own_${sig}`; const o = JSON.parse(localStorage.getItem(k) || "{}"); o.allpass = true; localStorage.setItem(k, JSON.stringify(o)); } catch (e) {} };

  let cur = null;

  function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), 2400); }

  const today = new Date();
  $("#paper-date").textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 · 제1판`;

  /* ---------- 공용 생년월일시 입력 (양/음력·분 단위·진태양시 — 사주 페이지와 동일 기준) ---------- */
  BirthInput.mount("#ca-birth", {
    idPrefix: "ca",
    submitLabel: "내 커리어 지도 발행하기",
    onSubmit(input) {
      const saju = calculateSaju(input);
      const rep = buildCareerReport(saju, input);
      cur = { input, saju, rep };
      render();
      setTimeout(() => $("#ca-result").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    },
  });

  function sectionHTML(sec, unlocked) {
    // 도장(閱覽必)과 '디테일' 태그가 같은 자리를 두고 겹치지 않게:
    // 태그는 제목 뒤 인라인, 도장은 태그 없는 섹션에만 찍는다.
    const tag = sec.detail ? ` <span class="detail-tag">디테일</span>` : "";
    if (unlocked) {
      return `<div class="art unlocked">${sec.detail ? "" : `<span class="stamp-mark">閱覽必</span>`}
        <h3>${sec.icon} ${sec.title}${tag}</h3><div class="art-body">${sec.html}</div></div>`;
    }
    return `<div class="art locked"><h3>${sec.icon} ${sec.title}${tag}</h3>
      <p class="tz">${sec.teaser}</p><div class="art-body">${sec.html}</div>
      <div class="lock-cta"><button type="button" class="open-unlock">🪙 기사 전문 읽기</button></div></div>`;
  }

  function render() {
    const { input, rep } = cur;
    const sig = sigOf(input);
    const hasBasic = owns("career", sig) || owns("career_detail", sig);
    const hasDetail = hasBasic;   // 단일 상품: 열면 전체가 열립니다
    const secs = rep.sections.map(sec => sectionHTML(sec, sec.detail ? hasDetail : hasBasic)).join("");

    let unlockBar = "";
    if (!hasBasic) {
      unlockBar = `<div class="unlock-bar">
        <h4>기사 전문을 발행해 드립니다</h4>
        <p>내 코인 🪙 <b id="ca-bal">${Coins.balance()}</b>개 · 광고를 보면 +1코인</p>
        <div class="unlock-btns">
          <button class="btn u-basic" data-buy="career">🪙 ${Coins.PRICE.career}코인 — 직업운 리포트 전체 (적성·캘린더·이직·재물 곡선·10년 지도)</button>
          <button class="btn u-all" data-buy="pass">🪙 ${Coins.PRICE.allpass}코인 — 전 서비스 패스 (사주·배우자·검증까지 전부)</button>
        </div>
        <p class="u-note">코인이 모자라면 충전 창이 열립니다 · 열람 후에는 환불되지 않습니다</p>
      </div>`;
    }

    const metaLine = typeof BirthInput !== "undefined"
      ? `<div class="art unlocked" style="padding:12px 16px"><p style="font-size:11.5px;color:var(--dim);line-height:1.7;margin:0;text-align:center">${BirthInput.metaLine(input, cur.saju)}</p></div>` : "";

    $("#ca-result").innerHTML = metaLine + `
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
    const cost = what === "pass" ? Coins.PRICE.allpass : Coins.PRICE[what];
    if (Coins.balance() < cost) {
      Coins.openShop(`이 리포트를 열려면 🪙 ${cost}코인이 필요해요 (지금 ${Coins.balance()}개)`);
      return;
    }
    if (!Coins.spend(cost, what === "pass" ? "전 서비스 패스" : "직업운 리포트")) return;
    if (what === "pass") { grantPass(sig); toast(`🪙 전 서비스 패스가 열렸습니다 — 사주·배우자·검증까지 전부`); }
    else { grant("career", sig); grant("career_detail", sig); toast(`🪙 ${cost}코인으로 발행되었습니다`); }
    render();
  }

  Coins.renderPill(".hd-in");
  Coins.onChange(() => { const b = $("#ca-bal"); if (b) b.textContent = Coins.balance(); });
  document.querySelector(".cnav-item.active")?.scrollIntoView({ inline: "center", block: "nearest" });
})();
