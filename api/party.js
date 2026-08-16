/* =====================================================================
 * POST /api/party — 모임 관계 지도의 공동 저장소 (Upstash/Vercel KV)
 *
 *  KV 미설정 시 {ok:false, kv:false} 를 돌려주고, 프론트는 URL 링크 체인
 *  모드로 자동 폴백합니다. (데모/초기엔 설정 없이도 동작)
 *
 *  action:
 *    ping   → {ok:true, kv:bool}          서버 저장 가능 여부
 *    create → {ok, id}                    새 모임 생성
 *    join   → {ok, group}                 나를 추가
 *    get    → {ok, group}                 모임 조회
 * ===================================================================== */

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const HAS_KV = !!(KV_URL && KV_TOKEN);
const TTL = 60 * 60 * 24 * 45; // 45일
const MAX = 12;

async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const d = await r.json();
  return d.result;
}
function send(res, status, obj) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve, reject) => {
    let d = ""; req.on("data", c => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
function cleanMember(m) {
  if (!m) return null;
  const name = String(m.name || "").trim().slice(0, 8);
  const y = parseInt(m.y, 10), mm = parseInt(m.m, 10), d = parseInt(m.d, 10);
  if (!name || !(y >= 1930 && y <= 2026) || !(mm >= 1 && mm <= 12) || !(d >= 1 && d <= 31)) return null;
  return { name, y, m: mm, d };
}
function dedupe(list) {
  const seen = new Set(), out = [];
  for (const m of list) { const k = `${m.name}_${m.y}_${m.m}_${m.d}`; if (!seen.has(k)) { seen.add(k); out.push(m); } }
  return out.slice(0, MAX);
}
function newId() {
  return (Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 5)).slice(0, 7);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return send(res, 405, { ok: false });
  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { ok: false, error: "bad_body" }); }
  const action = body.action;

  if (action === "ping") return send(res, 200, { ok: true, kv: HAS_KV });
  if (!HAS_KV) return send(res, 200, { ok: false, kv: false, error: "kv_not_configured" });

  try {
    if (action === "create") {
      const name = String(body.party || "우리 모임").trim().slice(0, 20);
      const members = dedupe((body.members || []).map(cleanMember).filter(Boolean));
      const id = newId();
      const group = { name, members, created: Date.now() };
      await kv(["SET", "party:" + id, JSON.stringify(group), "EX", TTL]);
      return send(res, 200, { ok: true, id });
    }

    if (action === "get") {
      const id = String(body.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
      const raw = await kv(["GET", "party:" + id]);
      if (!raw) return send(res, 404, { ok: false, error: "not_found" });
      return send(res, 200, { ok: true, group: JSON.parse(raw) });
    }

    if (action === "join") {
      const id = String(body.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
      const me = cleanMember(body.member);
      if (!me) return send(res, 400, { ok: false, error: "bad_member" });
      const raw = await kv(["GET", "party:" + id]);
      if (!raw) return send(res, 404, { ok: false, error: "not_found" });
      const group = JSON.parse(raw);
      group.members = dedupe([...(group.members || []), me]);
      await kv(["SET", "party:" + id, JSON.stringify(group), "EX", TTL]);
      return send(res, 200, { ok: true, group });
    }

    return send(res, 400, { ok: false, error: "unknown_action" });
  } catch (e) {
    return send(res, 500, { ok: false, error: "server" });
  }
};
