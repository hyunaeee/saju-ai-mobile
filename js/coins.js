/* =====================================================================
 * coins.js — 천기연 공용 코인 지갑 (전 서비스 공유)
 *
 *  · 처음 방문: 웰컴 3코인 (브라우저 기준)
 *  · 충전: 패키지 3종 (데모=즉시 지급 / 실서비스=토스 결제 → 페이지가 buyHook 제공)
 *  · 광고 보상: 하루 3회, 1회 +1코인 (데모=시뮬레이션 / 실서비스=광고 SDK 연동 자리)
 *  · UI: 헤더 잔액 pill + 충전 바텀시트 — 어느 페이지 테마 위에서도 동작
 * ===================================================================== */
(function () {
  const KEY = "cgy_wallet_v1";
  const AD_LIMIT = 3;

  /* 콘텐츠 가격 (코인) — api/_lib.js COIN_PRICE 와 반드시 일치 */
  const PRICE = {
    report: 9, questions: 7, group: 6, wish: 4, allpass: 18,
    spouse: 5, spouse_detail: 4, career: 5, career_detail: 4, verify: 5,
  };
  /* 충전 패키지 — api/_lib.js PRICES(coin_*) 와 반드시 일치 */
  const PACKAGES = [
    { id: "coin_c5",  coins: 5,  price: 4900,  tag: "" },
    { id: "coin_c12", coins: 13, price: 9900,  tag: "+1 보너스" },
    { id: "coin_c30", coins: 35, price: 19900, tag: "+5 보너스 · 인기" },
  ];

  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }

  function load() {
    let s;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { s = null; }
    if (!s) s = { bal: 0, welcomed: false, adDay: todayKey(), adCount: 0, ledger: [], wid: null };
    if (s.adDay !== todayKey()) { s.adDay = todayKey(); s.adCount = 0; }
    if (!s.welcomed) { s.welcomed = true; s.bal += 3; s.ledger.push({ amt: +3, why: "웰컴 코인", ts: Date.now() }); }
    return s;
  }
  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
  let st = load(); save(st);
  const listeners = [];
  function emit() { save(st); listeners.forEach(f => { try { f(st.bal); } catch (e) {} }); updatePill(); }

  /* 실서비스 지갑 id (서버 KV 원장 키) */
  function walletId() {
    if (!st.wid) { st.wid = "w" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); save(st); }
    return st.wid;
  }

  const api = {
    PRICE, PACKAGES, AD_LIMIT,
    balance: () => st.bal,
    walletId,
    onChange: (f) => listeners.push(f),
    setBalance(n) { st.bal = Math.max(0, n | 0); emit(); },  // 서버 지갑 동기화용
    grant(n, why) { st.bal += n; st.ledger.push({ amt: +n, why: why || "지급", ts: Date.now() }); emit(); },
    spend(n, why) {
      if (st.bal < n) return false;
      st.bal -= n; st.ledger.push({ amt: -n, why: why || "사용", ts: Date.now() }); emit();
      return true;
    },
    adRemaining: () => Math.max(0, AD_LIMIT - st.adCount),
    priceOf: (product) => PRICE[product] ?? null,

    /* 페이지가 주입하는 훅: 실서비스 결제 (없으면 데모 지급) */
    buyHook: null,     // (pkg) => void  — 토스 결제창 등
    adHook: null,      // (done) => void — 실제 광고 SDK. 없으면 시뮬레이션

    /* ---------- UI ---------- */
    renderPill(sel) {
      const host = document.querySelector(sel || ".hd-in, .header-inner");
      if (!host || document.getElementById("coin-pill")) return;
      const b = document.createElement("button");
      b.id = "coin-pill"; b.type = "button";
      b.innerHTML = `🪙 <b>${st.bal}</b>`;
      b.addEventListener("click", () => api.openShop());
      host.insertBefore(b, host.lastElementChild);
      updatePill();
    },
    openShop(reason) {
      closeShop();
      const wrap = document.createElement("div");
      wrap.id = "coin-shop";
      const pk = PACKAGES.map(p => `
        <button type="button" class="cs-pk" data-id="${p.id}">
          <span class="cs-coins">🪙 ${p.coins}코인</span>
          ${p.tag ? `<span class="cs-tag">${p.tag}</span>` : ""}
          <span class="cs-price">${p.price.toLocaleString()}원</span>
        </button>`).join("");
      const adLeft = api.adRemaining();
      wrap.innerHTML = `
        <div class="cs-veil"></div>
        <div class="cs-sheet" role="dialog" aria-label="코인 충전">
          <div class="cs-head">
            <b>🪙 내 코인 <em id="cs-bal">${st.bal}</em>개</b>
            <button type="button" class="cs-x" aria-label="닫기">✕</button>
          </div>
          ${reason ? `<p class="cs-reason">${reason}</p>` : ""}
          <div class="cs-pks">${pk}</div>
          <button type="button" class="cs-ad" ${adLeft ? "" : "disabled"}>
            📺 광고 보고 +1코인 <small>(오늘 ${adLeft}회 남음)</small>
          </button>
          <p class="cs-note">코인은 이 브라우저에 보관되며 콘텐츠 열람에 사용됩니다. 충전 결제는 이용약관·환불 규정을 따릅니다.</p>
        </div>`;
      document.body.appendChild(wrap);
      wrap.querySelector(".cs-veil").addEventListener("click", closeShop);
      wrap.querySelector(".cs-x").addEventListener("click", closeShop);
      wrap.querySelectorAll(".cs-pk").forEach(btn => btn.addEventListener("click", () => {
        const pkg = PACKAGES.find(p => p.id === btn.dataset.id);
        if (api.buyHook) { api.buyHook(pkg); }
        else { // 데모: 즉시 지급
          btn.disabled = true; btn.style.opacity = ".55";
          setTimeout(() => { api.grant(pkg.coins, "충전(데모)"); closeShop(); toast(`🪙 ${pkg.coins}코인이 충전되었습니다 (데모)`); }, 900);
        }
      }));
      wrap.querySelector(".cs-ad").addEventListener("click", () => {
        if (!api.adRemaining()) return;
        if (api.adHook) { api.adHook(() => finishAd()); } else { simulateAd(); }
      });
    },
  };

  function closeShop() { document.getElementById("coin-shop")?.remove(); }
  function finishAd() {
    st.adCount += 1; api.grant(1, "광고 보상");
    const bal = document.getElementById("cs-bal"); if (bal) bal.textContent = st.bal;
    const adBtn = document.querySelector("#coin-shop .cs-ad");
    if (adBtn) { const left = api.adRemaining(); adBtn.disabled = !left; adBtn.innerHTML = `📺 광고 보고 +1코인 <small>(오늘 ${left}회 남음)</small>`; }
    toast("🪙 +1코인이 지급되었습니다");
  }
  function simulateAd() {
    const ad = document.createElement("div");
    ad.id = "coin-ad";
    ad.innerHTML = `<div class="ca-box"><p class="ca-t">광고 시청 중…</p><p class="ca-n" id="ca-n">5</p><p class="ca-s">잠시만 기다리면 코인이 지급됩니다</p></div>`;
    document.body.appendChild(ad);
    let n = 5;
    const t = setInterval(() => {
      n -= 1;
      const el = document.getElementById("ca-n");
      if (el) el.textContent = n;
      if (n <= 0) { clearInterval(t); ad.remove(); finishAd(); }
    }, 1000);
  }
  function updatePill() { const p = document.getElementById("coin-pill"); if (p) p.innerHTML = `🪙 <b>${st.bal}</b>`; }
  function toast(msg) {
    let t = document.getElementById("coin-toast");
    if (!t) { t = document.createElement("div"); t.id = "coin-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2200);
  }

  /* 어느 테마 위에서도 동작하는 자체 스타일 */
  const css = document.createElement("style");
  css.textContent = `
  #coin-pill{display:inline-flex;align-items:center;gap:5px;border:0;cursor:pointer;margin-right:10px;
    background:rgba(120,120,140,.14);backdrop-filter:blur(4px);border-radius:100px;padding:7px 12px;
    font-size:12.5px;font-weight:700;color:inherit;font-family:inherit;-webkit-tap-highlight-color:transparent}
  #coin-pill b{font-size:13.5px}
  #coin-shop{position:fixed;inset:0;z-index:120}
  #coin-shop .cs-veil{position:absolute;inset:0;background:rgba(12,12,20,.55);backdrop-filter:blur(3px)}
  #coin-shop .cs-sheet{position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:100%;max-width:520px;
    background:#fff;color:#1c1c28;border-radius:22px 22px 0 0;padding:20px 20px 28px;box-shadow:0 -12px 40px rgba(0,0,0,.25);
    animation:csUp .25s ease}
  @keyframes csUp{from{transform:translate(-50%,40px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
  #coin-shop .cs-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
  #coin-shop .cs-head b{font-size:17px}
  #coin-shop .cs-head em{font-style:normal;color:#c98a12}
  #coin-shop .cs-x{border:0;background:#f1f1f6;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:13px;color:#666}
  #coin-shop .cs-reason{font-size:13px;color:#7a6a2a;background:#fdf6e0;border-radius:10px;padding:9px 12px;margin:8px 0 2px}
  #coin-shop .cs-pks{display:grid;gap:9px;margin:14px 0 10px}
  #coin-shop .cs-pk{display:flex;align-items:center;gap:10px;border:1.5px solid #e8e8f0;background:#fafaff;border-radius:14px;
    padding:14px 16px;cursor:pointer;font-family:inherit;font-size:14.5px;transition:border-color .15s}
  #coin-shop .cs-pk:hover{border-color:#c98a12}
  #coin-shop .cs-coins{font-weight:800}
  #coin-shop .cs-tag{font-size:11px;color:#c98a12;font-weight:700;border:1px solid #ecd9a8;border-radius:100px;padding:2px 8px}
  #coin-shop .cs-price{margin-left:auto;font-weight:800;color:#333}
  #coin-shop .cs-ad{width:100%;border:0;cursor:pointer;background:#20242e;color:#fff;border-radius:12px;padding:13px;
    font-size:14px;font-weight:700;font-family:inherit}
  #coin-shop .cs-ad:disabled{opacity:.45;cursor:default}
  #coin-shop .cs-ad small{font-weight:400;opacity:.7;margin-left:4px}
  #coin-shop .cs-note{font-size:11px;color:#9a9aa8;line-height:1.6;margin-top:10px;text-align:center}
  #coin-ad{position:fixed;inset:0;z-index:130;background:rgba(8,8,14,.88);display:grid;place-items:center}
  #coin-ad .ca-box{text-align:center;color:#fff}
  #coin-ad .ca-t{font-size:14px;opacity:.8}
  #coin-ad .ca-n{font-size:54px;font-weight:900;margin:10px 0}
  #coin-ad .ca-s{font-size:12px;opacity:.6}
  #coin-toast{position:fixed;bottom:24px;left:50%;transform:translate(-50%,16px);z-index:140;background:#20242e;color:#fff;
    border-radius:100px;padding:12px 22px;font-size:13px;opacity:0;pointer-events:none;transition:all .25s;box-shadow:0 10px 30px rgba(0,0,0,.4)}
  #coin-toast.on{opacity:1;transform:translate(-50%,0)}`;
  document.head.appendChild(css);

  window.Coins = api;
})();
