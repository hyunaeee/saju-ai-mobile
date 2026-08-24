/* =====================================================================
 * POST /api/report — 결제 검증된 사용자에게만 심층 리포트 본문 생성·반환
 *
 *  콘텐츠 보호의 핵심. 유효한 결제 토큰(report/allpass 권한)이 없으면
 *  서버가 본문을 아예 만들어 주지 않습니다.
 *
 *  요청: { tokens:[...], input:{...} }
 *  응답: { ok, sections:[{key,icon,title,html}], months, lucky, daeun }
 * ===================================================================== */
const { sajuEngine, grantedProducts, sigOf, sendJson, readBody } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method" });

  let body;
  try { body = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: "bad_body" }); }
  const { tokens, input } = body || {};
  if (!input || typeof input.y !== "number") return sendJson(res, 400, { ok: false, error: "bad_input" });

  const sig = sigOf(input);
  const granted = grantedProducts(tokens, sig);
  if (!granted.has("report")) return sendJson(res, 403, { ok: false, error: "not_purchased" });

  try {
    const saju = sajuEngine.calculateSaju(input);
    const pr = globalThis.buildPremiumReport(saju, input);

    // 프리미엄 섹션 순서 (app.js와 동일)
    const sections = [];
    if (pr.concerns && pr.concerns.length) {
      sections.push({
        key: "concerns", icon: "問", title: "당신의 고민에 대한 연화의 답",
        html: pr.concerns.map(c => `<p><b class="highlight">[${c.label}]</b> ${c.answer}</p>`).join(""),
      });
    }
    const push = (o, key) => sections.push({ key, icon: o.icon, title: o.title, html: o.html });
    // 대운은 표 형태라 데이터로 별도 전달
    sections.push({ key: "daeun", icon: pr.daeunSection.icon, title: pr.daeunSection.title, daeun: true });
    push(pr.iljuSection, "ilju");
    push(pr.frame, "frame");
    push(pr.godBalance, "godBalance");
    push(pr.seasonSection, "season");
    push(pr.year2026, "year2026");
    push(pr.marriage, "marriage");
    push(pr.match, "match");
    push(pr.wealth, "wealth");
    push(pr.love, "love");
    push(pr.career, "career");
    push(pr.caution, "caution");
    push(pr.helper, "helper");
    push(pr.health, "health");
    push(pr.sinsalSection, "sinsal");
    sections.push({ key: "months", icon: "月", title: "12개월 월별 운세", months: pr.months });
    sections.push({ key: "lucky", icon: pr.lucky.icon, title: pr.lucky.title, lucky: pr.lucky.items });

    return sendJson(res, 200, {
      ok: true,
      sections,
      daeun: { current: pr.daeun.current, list: saju.daeun.list, forward: saju.daeun.forward, startAge: saju.daeun.startAge },
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: "gen_failed" });
  }
};
