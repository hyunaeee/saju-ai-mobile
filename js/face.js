/* =====================================================================
 * face.js — 미래 배우자 예상 몽타주 선택기
 *
 *  사주의 배우자성(남=재성/여=관성) 오행 × 음양 × 일주로
 *  40종의 일러스트(assets/faces/, 남20·여20) 중 한 장을 결정합니다.
 *  같은 사주는 항상 같은 얼굴 — 결정적(deterministic) 선택.
 *
 *  ※ 명리 물상에 근거한 '인상 스케치'이며 실존 인물과 무관합니다.
 * ===================================================================== */

/* 오행별 얼굴 인상 라벨 */
const FACE_SHAPE_LABEL = {
  wood:  "길고 갸름한 얼굴형",
  fire:  "턱이 갸름한 화사한 얼굴형",
  earth: "둥글고 넉넉한 얼굴형",
  metal: "턱선이 반듯한 단정한 얼굴형",
  water: "선이 부드러운 계란형",
};

/* 배우자궁 십신 → 분위기 */
const FACE_MOOD = {
  비견: "당당하고 또렷한 인상",
  겁재: "생기 있고 승부욕이 비치는 인상",
  식신: "잘 웃고 편안한 인상",
  상관: "재치가 눈에 먼저 보이는 인상",
  편재: "활달하고 사교적인 인상",
  정재: "단정하고 성실해 보이는 인상",
  편관: "눈빛에 힘이 있는 인상",
  정관: "반듯하고 품위 있는 인상",
  편인: "생각이 깊어 보이는 인상",
  정인: "온화하고 어진 인상",
};

/**
 * 배우자 몽타주 선택
 * @returns {{img:string, sex:"M"|"F", el:string, yinKey:string, traits:string[], note:string}}
 */
/* 배우자궁 십신 → 무드 계열 (이미지 변형 번호)
 *  1 밝음·사교(식신·편재·비견) / 2 단정·품위(정관·정재·정인)
 *  3 강렬·카리스마(편관·겁재) / 4 지적·신비(편인·상관)
 *  → 오행5 × 음양2 × 무드4 = 성별당 40종, 성격 텍스트와 얼굴이 맞아떨어집니다. */
const MOOD_OF_GOD = { 식신: 1, 편재: 1, 비견: 1, 정관: 2, 정재: 2, 정인: 2, 편관: 3, 겁재: 3, 편인: 4, 상관: 4 };
const MOOD_NAME = { 1: "밝고 사교적인 계열", 2: "단정하고 품위 있는 계열", 3: "강렬한 카리스마 계열", 4: "지적이고 신비로운 계열" };

function buildSpouseFace(saju, input) {
  const myGender = input.gender === "F" ? "F" : "M";
  const sex = myGender === "M" ? "F" : "M";              // 배우자는 반대 성별
  const star = spouseStarPosition(saju, myGender);
  const el = star.starEl;
  const partnerYin = !saju.dayYin;                        // 짝은 나와 반대 음양이 합
  const yinKey = partnerYin ? "yin" : "yang";
  const godRaw = saju.tenGods.day.branch;
  const variant = MOOD_OF_GOD[godRaw] || ((saju.iljuIdx % 4) + 1);  // 배우자궁 십신이 무드를 결정
  const img = `assets/faces/${sex === "F" ? "w" : "m"}_${el}_${yinKey}_${variant}.webp`;

  const mood = FACE_MOOD[godRaw] || FACE_MOOD["정관"];
  const dohwa = saju.sinsal.some(s => s.key === "dohwa");

  const yk = `${el}_${yinKey}`;
  const traits = [
    (typeof SPOUSE_BODY !== "undefined" && SPOUSE_BODY[yk]) ? SPOUSE_BODY[yk].label : FACE_SHAPE_LABEL[el],
    partnerYin ? "부드럽고 그윽한 눈매" : "크고 또렷한 눈매",
    (typeof SPOUSE_VOICE !== "undefined" && SPOUSE_VOICE[yk]) ? SPOUSE_VOICE[yk].label : mood,
    dohwa ? "혈색이 좋고 시선을 끄는 분위기" : "차분하고 단정한 분위기",
  ];

  return { img, sex, el, yinKey, variant, moodName: MOOD_NAME[variant], traits, note: mood };
}

/* ---------- Node(서버) 환경 지원 ---------- */
if (typeof module !== "undefined" && module.exports) {
  const _F = { buildSpouseFace, FACE_SHAPE_LABEL, FACE_MOOD, MOOD_OF_GOD, MOOD_NAME };
  module.exports = _F;
  if (typeof globalThis !== "undefined") Object.assign(globalThis, _F);
}
