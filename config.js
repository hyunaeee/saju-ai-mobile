/* =====================================================================
 * config.js — 프론트엔드 실행 모드 설정
 *
 *  ▸ 데모 주소 (DEMO_HOSTS 에 포함된 도메인)
 *      : 아래 tossClientKey 를 채워도 **영구히 데모 모드로 잠깁니다.**
 *        결제·AI 호출이 일어나지 않고 상단에 DEMO 배너가 표시됩니다.
 *        → 홍보/시연/공유용으로 안전하게 쓰세요.
 *
 *  ▸ 실서비스 주소 (그 외 모든 도메인 = 내 도메인)
 *      : tossClientKey 를 채우면 실서비스(보안) 모드로 켜집니다.
 *        결제는 토스 결제창 → 서버(/api/confirm)가 승인 검증,
 *        리포트 본문은 서버(/api/report), 질문은 서버(/api/ask, claude-haiku-4-5).
 *
 *  ⚠️ 시크릿 키(test_sk_/live_sk_, ANTHROPIC_API_KEY)는 절대 여기 넣지 마세요.
 *     그건 Vercel 환경변수(서버)에만 넣습니다.
 * ===================================================================== */

/* 이 도메인들은 무슨 일이 있어도 데모로만 동작합니다 */
const DEMO_HOSTS = [
  "saju-ai-test.vercel.app",
  "saju-ai-mobile-demo.vercel.app",
  "localhost",
  "127.0.0.1",
];

const _host = location.hostname;
const _isDemoHost = DEMO_HOSTS.some(h => _host === h || _host.startsWith(h)) || _host.includes("demo");

window.CHEONGIYEON_CONFIG = {
  // API 서버 주소. 같은 도메인에 배포했으면 "" 그대로 두세요.
  apiBase: "",

  /* 토스페이먼츠 "클라이언트 키" (test_ck_... / live_ck_...) — 공개돼도 되는 키.
     여기를 채우면 실서비스 주소에서만 결제가 켜집니다. (데모 주소는 그대로 데모) */
  tossClientKey: _isDemoHost ? "" : "",
  //                            ↑ 실서비스 오픈 시 여기에 "test_ck_..." → "live_ck_..." 입력

  isDemoHost: _isDemoHost,
};
