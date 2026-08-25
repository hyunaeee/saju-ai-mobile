/* =====================================================================
 * api/_lib.js — 서버 공용 유틸 (엔진 로드 · 상품가격 · 서명 토큰)
 * ===================================================================== */
const crypto = require("crypto");

// 사주/콘텐츠 엔진 (순서 중요: saju 먼저 → globalThis 세팅 → content)
const sajuEngine = require("../js/saju.js");
require("../js/content.js");

// 서버가 신뢰하는 가격표 (원). 클라이언트가 보낸 금액을 이 값과 대조.
const PRICES = {
  report: 9900, questions: 7900, group: 6900, wish: 4900, allpass: 19900,
  // 코인 충전 패키지 (js/coins.js PACKAGES 와 일치)
  coin_c5: 4900, coin_c12: 9900, coin_c30: 19900,
};
// 패키지별 지급 코인 수
const COIN_PACKS = { coin_c5: 5, coin_c12: 13, coin_c30: 35 };
// 콘텐츠별 코인 가격 (js/coins.js PRICE 와 일치)
const COIN_PRICE = {
  report: 9, questions: 7, group: 6, wish: 4, allpass: 18,
  spouse: 5, spouse_detail: 4, career: 5, career_detail: 4,
};

// 각 상품이 부여하는 권한(products)
function productsFor(product) {
  return product === "allpass"
    ? ["report", "questions", "group", "wish"]
    : [product];
}

const TOKEN_SECRET = process.env.TOKEN_SECRET || "dev-insecure-secret-change-me";
const TOKEN_TTL_DAYS = 365;

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlJson(obj) { return b64url(JSON.stringify(obj)); }
function fromB64url(str) {
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}
function hmac(data) {
  return b64url(crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest());
}

/** 결제 검증 성공 후 발급하는 접근 토큰 (HMAC 서명, 위조 불가) */
function signToken(sig, products) {
  const payload = { sig, products, exp: Date.now() + TOKEN_TTL_DAYS * 864e5 };
  const body = b64urlJson(payload);
  return body + "." + hmac(body);
}

/** 토큰 검증 → payload 또는 null */
function verifyToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (hmac(body) !== sig) return null;
  let p;
  try { p = JSON.parse(fromB64url(body)); } catch { return null; }
  if (!p || typeof p.exp !== "number" || p.exp < Date.now()) return null;
  return p;
}

/** 여러 토큰을 검증해, 특정 birth-sig 에 대해 보유한 권한 집합을 반환 */
function grantedProducts(tokens, sig) {
  const set = new Set();
  for (const t of tokens || []) {
    const p = verifyToken(t);
    if (p && p.sig === sig && Array.isArray(p.products)) p.products.forEach(x => set.add(x));
  }
  return set;
}

/** 클라이언트 input → 서버 birth signature (app.js sig()와 동일 규칙) */
function sigOf(input) {
  return `${input.y}-${input.m}-${input.d}_${input.hour}_${input.minute}_${input.gender}`;
}

// 공통 CORS/JSON 헬퍼
function sendJson(res, status, obj) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = status;
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  return await new Promise((resolve, reject) => {
    let d = "";
    req.on("data", c => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

module.exports = {
  sajuEngine, PRICES, COIN_PACKS, COIN_PRICE, productsFor, signToken, verifyToken,
  grantedProducts, sigOf, sendJson, readBody,
};
