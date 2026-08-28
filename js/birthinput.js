/* =====================================================================
 * birthinput.js — 공용 생년월일시 입력 컴포넌트
 *
 *  연화 사주 페이지와 "완전히 같은 기준"으로 입력을 받습니다.
 *   · 양력 / 음력(윤달 포함) 선택 → 음력은 KARI 기준으로 양력 자동 변환
 *   · 태어난 시각을 시 + 분 단위로 (모름 선택 가능)
 *   · 출생 지역 → 경도 기반 진태양시 보정
 *   · 성별 (대운 방향·배우자성 판정에 사용)
 *
 *  사용:  BirthInput.mount("#host", { onSubmit(input){...}, submitLabel:"보기" })
 *  반환 input: { y,m,d, lunar, hour, minute, regionIdx, gender }  ← calculateSaju 호환
 * ===================================================================== */
(function () {
  const LAST_KEY = "cheongiyeon_last_input";
  const nowY = new Date().getFullYear();

  function opts(from, to, fmt, sel) {
    let h = "";
    for (let v = from; from < to ? v <= to : v >= to; from < to ? v++ : v--)
      h += `<option value="${v}"${v === sel ? " selected" : ""}>${fmt(v)}</option>`;
    return h;
  }

  /* 십이지시 — 라벨과 대표 시(범위의 한가운데) */
  const SIJIN = [
    { kor: "자시", han: "子", range: "밤 11시~새벽 1시", hour: 0 },
    { kor: "축시", han: "丑", range: "새벽 1시~3시", hour: 2 },
    { kor: "인시", han: "寅", range: "새벽 3시~5시", hour: 4 },
    { kor: "묘시", han: "卯", range: "새벽 5시~아침 7시", hour: 6 },
    { kor: "진시", han: "辰", range: "아침 7시~9시", hour: 8 },
    { kor: "사시", han: "巳", range: "오전 9시~11시", hour: 10 },
    { kor: "오시", han: "午", range: "낮 11시~오후 1시", hour: 12 },
    { kor: "미시", han: "未", range: "오후 1시~3시", hour: 14 },
    { kor: "신시", han: "申", range: "오후 3시~5시", hour: 16 },
    { kor: "유시", han: "酉", range: "오후 5시~저녁 7시", hour: 18 },
    { kor: "술시", han: "戌", range: "저녁 7시~9시", hour: 20 },
    { kor: "해시", han: "亥", range: "밤 9시~11시", hour: 22 },
  ];

  const api = {
    SIJIN,
    /** 폼을 host 안에 렌더 */
    mount(hostSel, o) {
      const host = document.querySelector(hostSel);
      if (!host) return null;
      const id = o.idPrefix || "bi";
      const label = o.submitLabel || "결과 보기";

      let last = null;
      try { last = JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch (e) {}
      const L = last || {};
      const defY = L.y || 1995, defM = L.m || 6, defD = L.d || 15;
      const defH = typeof L.hour === "number" ? L.hour : 12;
      const defMin = typeof L.minute === "number" ? L.minute : 0;
      const defR = typeof L.regionIdx === "number" ? L.regionIdx : 0;
      const defG = L.gender === "F" ? "F" : "M";
      // 시각 입력 방식 복원: 몰라요 > 이전 방식 > 시진(기본)
      const defMode = defH < 0 ? "unknown" : (L.timeMode === "exact" ? "exact" : "sijin");
      // 이전 입력의 시각 → 시진 (엔진과 같은 규칙: branch = floor(((h+1)%24)/2))
      const defSijin = typeof L.hourBranch === "number" ? L.hourBranch
        : defH >= 0 ? Math.floor(((defH + 1) % 24) / 2) : 6;

      host.innerHTML = `
        <div class="bi">
          <div class="bi-row bi-seg2">
            <label class="bi-opt"><input type="radio" name="${id}-cal" value="solar" checked /><span>양력</span></label>
            <label class="bi-opt"><input type="radio" name="${id}-cal" value="lunar" /><span>음력</span></label>
          </div>
          <label class="bi-leap hidden" id="${id}-leapwrap">
            <input type="checkbox" id="${id}-leap" /> <span>윤달로 태어났어요</span>
          </label>
          <div class="bi-row bi-date">
            <select id="${id}-y" aria-label="태어난 해">${opts(nowY, 1930, v => v + "년", defY)}</select>
            <select id="${id}-m" aria-label="태어난 달">${opts(1, 12, v => v + "월", defM)}</select>
            <select id="${id}-d" aria-label="태어난 날">${opts(1, 31, v => v + "일", defD)}</select>
          </div>

          <div class="bi-row bi-seg3" role="radiogroup" aria-label="시각 입력 방식">
            <label class="bi-opt"><input type="radio" name="${id}-tm" value="sijin"${defMode === "sijin" ? " checked" : ""} /><span>시진으로</span></label>
            <label class="bi-opt"><input type="radio" name="${id}-tm" value="exact"${defMode === "exact" ? " checked" : ""} /><span>정확한 시각</span></label>
            <label class="bi-opt"><input type="radio" name="${id}-tm" value="unknown"${defMode === "unknown" ? " checked" : ""} /><span>몰라요</span></label>
          </div>

          <div class="bi-row" id="${id}-sijinwrap">
            <select id="${id}-sijin" aria-label="태어난 시진">${SIJIN.map((s, i) =>
              `<option value="${i}"${i === (defSijin >= 0 ? defSijin : 6) ? " selected" : ""}>${s.kor}(${s.han}) · ${s.range}</option>`).join("")}</select>
          </div>
          <div class="bi-row bi-time hidden" id="${id}-exactwrap">
            <select id="${id}-h" aria-label="태어난 시">${opts(0, 23, v => String(v).padStart(2, "0") + "시", defH >= 0 ? defH : 12)}</select>
            <select id="${id}-min" aria-label="태어난 분">${opts(0, 59, v => String(v).padStart(2, "0") + "분", defMin)}</select>
          </div>
          <div class="bi-row" id="${id}-regionwrap">
            <select id="${id}-r" aria-label="태어난 지역">${REGIONS.map((r, i) =>
              `<option value="${i}"${i === defR ? " selected" : ""}>${r.name} 출생</option>`).join("")}</select>
          </div>
          <p class="bi-timenote" id="${id}-timenote"></p>

          <div class="bi-row bi-seg2">
            <label class="bi-opt"><input type="radio" name="${id}-g" value="M"${defG === "M" ? " checked" : ""} /><span>남자</span></label>
            <label class="bi-opt"><input type="radio" name="${id}-g" value="F"${defG === "F" ? " checked" : ""} /><span>여자</span></label>
          </div>
          <button type="button" class="bi-go" id="${id}-go">${label}</button>
          <p class="bi-note">음력은 한국천문연구원 기준으로 <b>양력 자동 변환</b>합니다. 입력은 이 기기에만 저장됩니다.</p>
        </div>`;

      const $ = (s) => host.querySelector(s);
      const calRadios = host.querySelectorAll(`input[name="${id}-cal"]`);
      const toggleLunar = () => {
        const isL = [...calRadios].find(r => r.checked).value === "lunar";
        $(`#${id}-leapwrap`).classList.toggle("hidden", !isL);
      };
      calRadios.forEach(r => r.addEventListener("change", toggleLunar));

      const tmRadios = host.querySelectorAll(`input[name="${id}-tm"]`);
      const NOTES = {
        sijin: "시진을 고르면 그 시진 그대로 시주를 세웁니다 (분 단위 보정 불필요).",
        exact: "정확한 시각은 태어난 지역의 경도로 <b>진태양시</b>를 보정해 시주를 세웁니다.",
        unknown: "시각을 모르면 시주(時柱) 없이 연·월·일주로 봅니다 — 그래도 충분히 깊게 볼 수 있어요.",
      };
      const toggleTime = () => {
        const mode = [...tmRadios].find(r => r.checked).value;
        $(`#${id}-sijinwrap`).classList.toggle("hidden", mode !== "sijin");
        $(`#${id}-exactwrap`).classList.toggle("hidden", mode !== "exact");
        $(`#${id}-regionwrap`).classList.toggle("hidden", mode !== "exact");
        $(`#${id}-timenote`).innerHTML = NOTES[mode];
      };
      tmRadios.forEach(r => r.addEventListener("change", toggleTime));
      toggleTime();

      $(`#${id}-go`).addEventListener("click", () => {
        const input = api.read(host, id);
        if (!input) return;
        try { localStorage.setItem(LAST_KEY, JSON.stringify(input)); } catch (e) {}
        o.onSubmit(input);
      });
      return host;
    },

    /** 폼 → input 객체 (음력 변환·검증 포함). 실패 시 null + 안내 */
    read(host, id) {
      const $ = (s) => host.querySelector(s);
      let y = +$(`#${id}-y`).value, m = +$(`#${id}-m`).value, d = +$(`#${id}-d`).value;
      let lunar = null;

      const isLunar = [...host.querySelectorAll(`input[name="${id}-cal"]`)].find(r => r.checked).value === "lunar";
      if (isLunar) {
        if (typeof KLC === "undefined") { api.toast("음력 변환 데이터를 불러오지 못했습니다."); return null; }
        const leap = $(`#${id}-leap`).checked;
        if (leap && KLC.leapMonthOf(y) !== m) {
          const lm = KLC.leapMonthOf(y);
          api.toast(`음력 ${y}년의 윤달은 ${lm ? lm + "월" : "없습니다"} — 윤달 여부를 확인해주세요.`);
          return null;
        }
        const conv = KLC.lunarToSolar(y, m, d, leap);
        if (!conv) { api.toast("음력 날짜를 확인해주세요 — 해당 달에 없는 날짜입니다."); return null; }
        lunar = { y, m, d, leap };
        y = conv.y; m = conv.m; d = conv.d;
      } else {
        // 양력 날짜 유효성 (2월 30일 등 방지)
        const dt = new Date(y, m - 1, d);
        if (dt.getMonth() !== m - 1 || dt.getDate() !== d) { api.toast("없는 날짜입니다 — 생년월일을 확인해주세요."); return null; }
      }

      const mode = [...host.querySelectorAll(`input[name="${id}-tm"]`)].find(r => r.checked).value;
      const base = {
        y, m, d, lunar,
        timeMode: mode,
        regionIdx: +$(`#${id}-r`).value,
        gender: [...host.querySelectorAll(`input[name="${id}-g"]`)].find(r => r.checked).value,
      };
      if (mode === "unknown") return { ...base, hour: -1, minute: 0 };
      if (mode === "sijin") {
        const bi = +$(`#${id}-sijin`).value;
        return { ...base, hour: SIJIN[bi].hour, minute: 0, hourBranch: bi };
      }
      return { ...base, hour: +$(`#${id}-h`).value, minute: +$(`#${id}-min`).value };
    },

    /** 결과 상단에 쓰는 "적용된 기준" 한 줄 */
    metaLine(input, saju) {
      const dateStr = input.lunar
        ? `음력 ${input.lunar.y}. ${input.lunar.leap ? "윤" : ""}${input.lunar.m}. ${input.lunar.d} → 양력 ${input.y}. ${input.m}. ${input.d}`
        : `양력 ${input.y}. ${input.m}. ${input.d}`;
      let timeStr = "시각 미상 (시주 제외)";
      let region = "";
      if (input.hour >= 0 && input.timeMode === "sijin" && typeof input.hourBranch === "number") {
        const s = SIJIN[input.hourBranch];
        timeStr = `${s.kor}(${s.han}) · ${s.range} 출생`;
      } else if (input.hour >= 0) {
        timeStr = `${String(input.hour).padStart(2, "0")}:${String(input.minute).padStart(2, "0")}`;
        if (saju && saju.solarTime && saju.solarTime.corrMin !== 0) {
          const c = saju.solarTime.corrMin;
          timeStr += ` → 진태양시 ${String(saju.solarTime.hour).padStart(2, "0")}:${String(saju.solarTime.minute).padStart(2, "0")} (${c > 0 ? "+" : ""}${c}분)`;
        }
        region = (typeof REGIONS !== "undefined" && REGIONS[input.regionIdx]) ? REGIONS[input.regionIdx].name : "";
      }
      const ganji = saju ? `${saju.ganjiText.year}년 ${saju.ganjiText.month}월 ${saju.ganjiText.day}일${saju.ganjiText.hour ? " " + saju.ganjiText.hour + "시" : ""}` : "";
      return `${dateStr} · ${timeStr}${region ? " · " + region : ""}${ganji ? "<br /><b>" + ganji + "</b>" : ""}`;
    },

    toast(msg) {
      let t = document.getElementById("toast");
      if (t) {
        t.textContent = msg; t.classList.remove("hidden");
        clearTimeout(api._t); api._t = setTimeout(() => t.classList.add("hidden"), 3000);
      } else { alert(msg); }
    },
  };

  /* 공용 스타일 — 각 페이지 테마 변수를 상속해 자연스럽게 녹아듭니다 */
  const css = document.createElement("style");
  css.textContent = `
  /* 테마 훅: 페이지에서 --bi-* 를 덮어쓰면 그 페이지 색으로 입혀집니다 */
  .bi { --bi-accent:currentColor; --bi-text:#2a2028; --bi-field:rgba(255,255,255,.75);
        --bi-line:rgba(120,110,100,.3); --bi-btn-txt:#fff;
        display:grid; gap:9px; }
  .bi-row { display:grid; gap:8px; }
  .bi-date { grid-template-columns:1.15fr 1fr 1fr; }
  .bi-time { grid-template-columns:1fr 1fr; }
  .bi-seg2 { grid-template-columns:1fr 1fr; }
  .bi-seg3 { grid-template-columns:1.1fr 1.2fr .9fr; }
  .bi-row.hidden { display:none; }
  .bi-timenote { font-size:11.5px; line-height:1.65; opacity:.72; padding:0 2px; }
  .bi-timenote b { color:var(--bi-accent); }
  .bi select { width:100%; padding:12px 6px; font-size:15px; font-family:inherit; text-align:center;
    border-radius:8px; border:1px solid var(--bi-line); background:var(--bi-field); color:var(--bi-text); outline:none; appearance:none; }
  .bi select:focus { border-color:var(--bi-accent); }
  .bi select:disabled { cursor:not-allowed; }
  .bi-opt input { display:none; }
  .bi-opt span { display:block; text-align:center; padding:11px 0; font-size:13.5px; cursor:pointer; border-radius:8px;
    color:var(--bi-text); border:1px solid var(--bi-line); background:var(--bi-field); opacity:.68; }
  .bi-opt input:checked + span { opacity:1; font-weight:700; color:var(--bi-accent); border-color:var(--bi-accent); box-shadow:inset 0 0 0 1px var(--bi-accent); }
  .bi-leap, .bi-unknown { display:flex; align-items:center; gap:7px; font-size:12.5px; opacity:.82; cursor:pointer; padding:2px; }
  .bi-leap.hidden { display:none; }
  .bi-leap input, .bi-unknown input { width:15px; height:15px; accent-color:var(--bi-accent); }
  .bi-go { border:0; cursor:pointer; font-family:inherit; font-weight:700; border-radius:9px; padding:15px; font-size:15.5px;
    background:var(--bi-accent); color:var(--bi-btn-txt); margin-top:2px; }
  .bi-go:active { transform:scale(.99); }
  .bi-note { font-size:10.5px; line-height:1.65; opacity:.62; text-align:center; margin-top:2px; }
  `;
  document.head.appendChild(css);

  window.BirthInput = api;
})();
