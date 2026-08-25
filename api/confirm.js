/* =====================================================================
 * POST /api/confirm — 토스페이먼츠 결제 승인 검증 → 접근 토큰 발급
 *
 *  결제 위조 방지의 핵심. 클라이언트가 "결제했다"고 주장하는 것을 믿지 않고,
 *  토스 서버에 직접 조회해 실제 승인·금액을 확인한 뒤에만 토큰을 내줍니다.
 *
 *  요청: { paymentKey, orderId, amount, product, sig }
 *  응답: { ok, token, products }  또는  { ok:false, error }
 * ===================================================================== */
const { PRICES, COIN_PACKS, productsFor, signToken, sendJson, readBody } = require("./_lib");

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
async function kvIncr(wid, by) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(["INCRBY", "cyw:" + String(wid).slice(0, 40), by]),
  });
  const d = await r.json();
  return parseInt(d.result, 10) || 0;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method" });

  let body;
  try { body = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: "bad_body" }); }
  const { paymentKey, orderId, amount, product, sig, wid } = body || {};
  const isCoin = !!COIN_PACKS[product];

  if (!paymentKey || !orderId || !product || (!sig && !isCoin)) return sendJson(res, 400, { ok: false, error: "missing" });
  if (!PRICES[product]) return sendJson(res, 400, { ok: false, error: "unknown_product" });
  // 서버 가격표와 대조 — 금액 변조 차단
  if (Number(amount) !== PRICES[product]) return sendJson(res, 400, { ok: false, error: "amount_mismatch" });

  const secret = process.env.TOSS_SECRET_KEY;
  if (!secret) return sendJson(res, 500, { ok: false, error: "server_not_configured" });

  try {
    const auth = Buffer.from(secret + ":").toString("base64");
    const r = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: PRICES[product] }),
    });
    const data = await r.json();

    if (!r.ok || data.status !== "DONE") {
      // 승인 실패 → 토큰 발급 안 함 (콘텐츠 미제공 = 자동으로 과금 안 됨)
      return sendJson(res, 402, { ok: false, error: "payment_not_confirmed", detail: data.message || data.code || "" });
    }

    /* TODO [실서비스]: data(주문번호·결제키·금액·시각)와 sig, product 를
     *   DB(예: Vercel KV / Postgres)에 저장하세요. 환불 분쟁 시 '제공 개시 시점'
     *   증빙이 되고, 승인됐으나 콘텐츠 제공에 실패한 케이스를 결제취소 API로
     *   자동 환불 처리하는 근거가 됩니다. */

    // 코인 충전 패키지: KV가 있으면 서버 지갑에 적립, 없으면 클라이언트가 로컬 지급
    if (isCoin) {
      const coins = COIN_PACKS[product];
      let balance = null;
      if (KV_URL && KV_TOKEN && wid) {
        try { balance = await kvIncr(wid, coins); } catch (e) { balance = null; }
      }
      return sendJson(res, 200, { ok: true, coins, balance });
    }

    const products = productsFor(product);
    const token = signToken(sig, products);
    return sendJson(res, 200, { ok: true, token, products });
  } catch (e) {
    return sendJson(res, 502, { ok: false, error: "toss_unreachable" });
  }
};
