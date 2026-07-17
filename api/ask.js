/* =====================================================================
 * POST /api/ask — 연화에게 질문 (프리미엄) : claude-haiku-4-5로 답변 생성
 *
 *  질문 5개 권한(questions/allpass)이 있는 사용자만.
 *  ANTHROPIC_API_KEY 는 서버 환경변수에만 두고 절대 프론트로 노출하지 마세요.
 *  (키 미설정 시 템플릿 답변으로 자동 폴백 → 배포 전에도 동작)
 *
 *  요청: { tokens:[...], input:{...}, question:"..." }
 *  응답: { ok, answer, via:"ai"|"template" }
 * ===================================================================== */
const { sajuEngine, grantedProducts, sigOf, sendJson, readBody } = require("./_lib");

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method" });

  let body;
  try { body = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: "bad_body" }); }
  const { tokens, input, question } = body || {};
  if (!input || typeof input.y !== "number") return sendJson(res, 400, { ok: false, error: "bad_input" });
  const q = (question || "").toString().trim().slice(0, 120);
  if (q.length < 3) return sendJson(res, 400, { ok: false, error: "too_short" });

  const sig = sigOf(input);
  const granted = grantedProducts(tokens, sig);
  if (!granted.has("questions")) return sendJson(res, 403, { ok: false, error: "not_purchased" });

  /* TODO [실서비스]: DB에 (sig, 사용한 질문 수)를 저장해 5개 초과 호출을 서버에서 차단하세요.
   *   지금은 클라이언트가 5개 쿼터를 관리하고, 서버는 권한만 확인합니다. */

  const saju = sajuEngine.calculateSaju(input);

  // API 키가 없으면 템플릿 답변으로 폴백 (배포 전/장애 시에도 서비스 유지)
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const answer = globalThis.answerQuestion(q, saju, input);
    return sendJson(res, 200, { ok: true, answer, via: "template" });
  }

  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: key });

    const facts = buildFacts(saju, input);
    const system =
      "당신은 '신녀 연화'라는 이름의 한국 무속인 캐릭터입니다. 정통 명리학(사주팔자)에 근거해 상담합니다.\n" +
      "말투: 나이 지긋한 무당의 반말체. '자네', '~게', '~구먼', '~네' 같은 어미를 자연스럽게 씁니다. 과장·저주·공포 조장 금지.\n" +
      "규칙: 제공된 '사주 데이터'에 근거해서만 답합니다. 3~5문장으로 따뜻하고 구체적으로. 의료·법률·투자에 대한 단정적 지시는 피하고 참고용 조언으로 말합니다. 데이터에 없는 수치를 지어내지 않습니다.";
    const user = `[사주 데이터]\n${facts}\n\n[질문]\n${q}\n\n위 사주 데이터에 근거해 연화의 말투로 답해주게.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: user }],
    });
    const answer = (msg.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim()
      || globalThis.answerQuestion(q, saju, input);
    return sendJson(res, 200, { ok: true, answer, via: "ai" });
  } catch (e) {
    // AI 실패 시에도 답변은 제공 (유료 이용자 보호)
    const answer = globalThis.answerQuestion(q, saju, input);
    return sendJson(res, 200, { ok: true, answer, via: "template" });
  }
};

/* 사주 핵심 데이터를 자연어 요약으로 (Claude 시스템 입력용) */
function buildFacts(saju, input) {
  const g = saju.ganjiText;
  const els = Object.entries(saju.counts).map(([k, v]) =>
    `${sajuEngine.ELEMENTS[k].kor}${v}`).join(" ");
  const gods = Object.entries(saju.godCounts).map(([k, v]) => `${k}${v}`).join(" ");
  const nowY = new Date().getFullYear();
  const age = Math.max(0, nowY - input.y);
  const cur = saju.daeun.list.find(d => age >= d.fromAge && age <= d.toAge) || saju.daeun.list[0];
  const sinsal = saju.sinsal.length ? saju.sinsal.map(s => s.name).join(", ") : "특별한 신살 없음";
  const dm = sajuEngine.STEMS[saju.dayStem];
  return [
    `이름: ${input.name} / 성별: ${input.gender === "M" ? "남" : "여"} / 나이: 약 ${age}세`,
    `사주팔자: ${g.year}년 ${g.month}월 ${g.day}일 ${g.hour || "(시 미상)"}`,
    `일간(본인): ${dm.kor}${sajuEngine.ELEMENTS[dm.el].kor} (${dm.el})`,
    `오행 분포: ${els} / 가장 약한 오행: ${sajuEngine.ELEMENTS[saju.weakest].kor}`,
    `십성 구성: ${gods}`,
    `현재 대운: ${cur.fromAge}~${cur.toAge}세 ${cur.tenGod}운`,
    `신살: ${sinsal}`,
    `연애상태: ${input.loveStatus} / 직업상태: ${input.jobStatus}`,
  ].join("\n");
}
