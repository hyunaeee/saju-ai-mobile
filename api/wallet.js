/* =====================================================================
 * POST /api/wallet — 코인 지갑 원장 (Upstash/Vercel KV)
 *
 *  실서비스에서 코인 잔액을 서버가 관리해 위·변조를 막습니다.
 *  KV 미설정 시 {ok:false, kv:false} — 프론트는 로컬 지갑으로 폴백.
 *
 *  action:
 *    get   {wid}                → {ok, balance}
 *    debit {wid, product, sig}  → 잔액 차감 + 해당 상품 접근 토큰 발급
 * ===================================================================== */
const { COIN_PRICE, productsFor, signToken, sendJson, readBody } = require("./_lib");

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const HAS_KV = !!(KV_URL && KV_TOKEN);

async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const d = await r.json();
  return d.result;
}
const key = (wid) => "cyw:" + String(wid).slice(0, 40);

module.exports = async (req, res) => {
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method" });
  if (!HAS_KV) return sendJson(res, 200, { ok: false, kv: false });

  let body;
  try { body = await readBody(req); } catch { return sendJson(res, 400, { ok: false, error: "bad_body" }); }
  const { action, wid, product, sig } = body || {};
  if (!wid || typeof wid !== "string") return sendJson(res, 400, { ok: false, error: "no_wid" });

  try {
    if (action === "get") {
      const bal = parseInt(await kv(["GET", key(wid)]), 10) || 0;
      return sendJson(res, 200, { ok: true, kv: true, balance: bal });
    }
    if (action === "debit") {
      const price = COIN_PRICE[product];
      if (!price) return sendJson(res, 400, { ok: false, error: "bad_product" });
      const bal = parseInt(await kv(["GET", key(wid)]), 10) || 0;
      if (bal < price) return sendJson(res, 200, { ok: false, kv: true, error: "insufficient", balance: bal });
      const after = await kv(["DECRBY", key(wid), price]);
      // 서버 API가 지키는 상품(report/questions 등)에 접근 토큰 발급
      const base = product.replace(/_detail$/, "");
      const token = sig ? signToken(sig, productsFor(base)) : null;
      return sendJson(res, 200, { ok: true, kv: true, balance: parseInt(after, 10) || 0, token, products: productsFor(base) });
    }
    return sendJson(res, 400, { ok: false, error: "bad_action" });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: "kv_error" });
  }
};
