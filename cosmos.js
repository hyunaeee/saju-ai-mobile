/* =====================================================================
 * cosmos.js — 오늘의 하늘 (Three.js 태양계 + 점성술 × 사주 결합 분석)
 *
 *  1) 천문 엔진: NASA/JPL 근사 평균 궤도 요소(J2000 + 세기당 변화율)로
 *     케플러 방정식을 풀어 행성의 실제 현재 위치(황경)를 계산합니다.
 *     달은 주항 보정 근사식. 별자리 배정 기준 정확도 ±1° 수준.
 *  2) Three.js 씬: 실제 현재 각도에 행성 배치, 실제 공전 속도 비율로 진행.
 *  3) 분석: 현재 하늘(행성×별자리→원소 기운) + 내 출생(태양궁, 사주 일진·세운)
 *  saju.js / content.js 전역을 재사용합니다.
 * ===================================================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const DEG = Math.PI / 180;

/* ================= 천문 계산 ================= */

/* JPL 근사 평균 궤도 요소 (J2000 기준값, 세기당 변화율) — 단위 au, deg */
const ORBITS = {
  mercury: { a:[0.38709927,0.00000037], e:[0.20563593,0.00001906], I:[7.00497902,-0.00594749], L:[252.25032350,149472.67411175], w:[77.45779628,0.16047689], O:[48.33076593,-0.12534081] },
  venus:   { a:[0.72333566,0.00000390], e:[0.00677672,-0.00004107], I:[3.39467605,-0.00078890], L:[181.97909950,58517.81538729], w:[131.60246718,0.00268329], O:[76.67984255,-0.27769418] },
  earth:   { a:[1.00000261,0.00000562], e:[0.01671123,-0.00004392], I:[-0.00001531,-0.01294668], L:[100.46457166,35999.37244981], w:[102.93768193,0.32327364], O:[0,0] },
  mars:    { a:[1.52371034,0.00001847], e:[0.09339410,0.00007882], I:[1.84969142,-0.00813131], L:[-4.55343205,19140.30268499], w:[-23.94362959,0.44441088], O:[49.55953891,-0.29257343] },
  jupiter: { a:[5.20288700,-0.00011607], e:[0.04838624,-0.00013253], I:[1.30439695,-0.00183714], L:[34.39644051,3034.74612775], w:[14.72847983,0.21252668], O:[100.47390909,0.20469106] },
  saturn:  { a:[9.53667594,-0.00125060], e:[0.05386179,-0.00050991], I:[2.48599187,0.00193609], L:[49.95424423,1222.49362201], w:[92.59887831,-0.41897216], O:[113.66242448,-0.28867794] },
  uranus:  { a:[19.18916464,-0.00196176], e:[0.04725744,-0.00004397], I:[0.77263783,-0.00242939], L:[313.23810451,428.48202785], w:[170.95427630,0.40805281], O:[74.01692503,0.04240589] },
  neptune: { a:[30.06992276,0.00026291], e:[0.00859048,0.00005105], I:[1.77004347,0.00035372], L:[-55.12002969,218.45945325], w:[44.96476227,-0.32241464], O:[131.78422574,-0.00508664] },
};

function toJD(date) { return date.getTime() / 86400000 + 2440587.5; }
const norm360 = (x) => ((x % 360) + 360) % 360;

/* 태양 중심 황도 좌표 (au) */
function helio(planet, jd) {
  const T = (jd - 2451545.0) / 36525;
  const o = ORBITS[planet];
  const a = o.a[0] + o.a[1] * T, e = o.e[0] + o.e[1] * T;
  const I = (o.I[0] + o.I[1] * T) * DEG;
  const L = norm360(o.L[0] + o.L[1] * T);
  const w = o.w[0] + o.w[1] * T;       // 근일점 황경(varpi)
  const O = o.O[0] + o.O[1] * T;       // 승교점 황경
  const M = norm360(L - w) * DEG;      // 평균근점이각
  const om = (w - O) * DEG;            // 근일점 편각(omega)
  const Om = O * DEG;
  // 케플러 방정식 (뉴턴법)
  let E = M;
  for (let i = 0; i < 8; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  // 궤도면 → 황도면
  const cosom = Math.cos(om), sinom = Math.sin(om);
  const cosI = Math.cos(I), sinI = Math.sin(I);
  const cosOm = Math.cos(Om), sinOm = Math.sin(Om);
  const x = (cosom * cosOm - sinom * sinOm * cosI) * xv + (-sinom * cosOm - cosom * sinOm * cosI) * yv;
  const y = (cosom * sinOm + sinom * cosOm * cosI) * xv + (-sinom * sinOm + cosom * cosOm * cosI) * yv;
  const z = (sinom * sinI) * xv + (cosom * sinI) * yv;
  return { x, y, z };
}

/* 지구 중심 황경(deg) — 점성술 별자리 배정용 */
function geoLongitude(planet, jd) {
  const e = helio("earth", jd);
  if (planet === "sun") return norm360(Math.atan2(-e.y, -e.x) / DEG);
  if (planet === "moon") return moonLongitude(jd);
  const p = helio(planet, jd);
  return norm360(Math.atan2(p.y - e.y, p.x - e.x) / DEG);
}

/* 달 황경 근사 (주요 섭동항 포함, ±0.5° 수준) */
function moonLongitude(jd) {
  const d = jd - 2451545.0;
  const L = 218.316 + 13.176396 * d;      // 평균 황경
  const M = 134.963 + 13.064993 * d;      // 달 평균근점이각
  const Ms = 357.529 + 0.985600 * d;      // 태양 평균근점이각
  const D = 297.850 + 12.190749 * d;      // 이각
  return norm360(L + 6.289 * Math.sin(M * DEG)
    - 1.274 * Math.sin((M - 2 * D) * DEG)
    + 0.658 * Math.sin(2 * D * DEG)
    - 0.214 * Math.sin(2 * M * DEG)
    - 0.186 * Math.sin(Ms * DEG));
}

/* ================= 별자리(황도 12궁) ================= */
const SIGNS = [
  { kor: "양자리",     sym: "♈", el: "fire",  key: "개척과 시작" },
  { kor: "황소자리",   sym: "♉", el: "earth", key: "안정과 소유" },
  { kor: "쌍둥이자리", sym: "♊", el: "air",   key: "소통과 호기심" },
  { kor: "게자리",     sym: "♋", el: "water", key: "가족과 보호" },
  { kor: "사자자리",   sym: "♌", el: "fire",  key: "표현과 주인공" },
  { kor: "처녀자리",   sym: "♍", el: "earth", key: "분석과 완성" },
  { kor: "천칭자리",   sym: "♎", el: "air",   key: "관계와 균형" },
  { kor: "전갈자리",   sym: "♏", el: "water", key: "몰입과 재생" },
  { kor: "사수자리",   sym: "♐", el: "fire",  key: "모험과 확장" },
  { kor: "염소자리",   sym: "♑", el: "earth", key: "성취와 책임" },
  { kor: "물병자리",   sym: "♒", el: "air",   key: "혁신과 자유" },
  { kor: "물고기자리", sym: "♓", el: "water", key: "공감과 상상" },
];
const signOf = (lon) => SIGNS[Math.floor(norm360(lon) / 30)];
const signIdx = (lon) => Math.floor(norm360(lon) / 30);

const AST_EL = {
  fire:  { kor: "불", saju: "화(火)", desc: "도전·표현·추진의 기운이 하늘을 달굽니다. 미루던 일을 시작하고, 나를 드러내기 좋은 흐름입니다." },
  earth: { kor: "흙", saju: "토(土)", desc: "실속·안정·마무리의 기운이 짙습니다. 벌이기보다 다지고, 계약과 정리에 유리한 흐름입니다." },
  air:   { kor: "바람", saju: "금(金)", desc: "소통·아이디어·연결의 기운이 흐릅니다. 대화와 협상, 새로운 사람을 만나기 좋은 흐름입니다." },
  water: { kor: "물", saju: "수(水)", desc: "감정·직관·치유의 기운이 깊어집니다. 밀어붙이기보다 마음을 읽고 다독이는 게 통하는 흐름입니다." },
};

const PLANETS_META = {
  sun:     { kor: "태양", icon: "☀️", theme: "자아·생명력", color: 0xffc266, size: 5.2 },
  moon:    { kor: "달",   icon: "🌙", theme: "감정·일상", color: 0xd8d8e6, size: 1.4 },
  mercury: { kor: "수성", icon: "☿", theme: "소통·문서", color: 0x9aa0a8, size: 1.1, orbit: 10 },
  venus:   { kor: "금성", icon: "♀", theme: "사랑·재물", color: 0xe8c9a0, size: 1.7, orbit: 14.5 },
  earth:   { kor: "지구", icon: "🌍", theme: "나", color: 0x4f7fd9, size: 1.8, orbit: 19.5 },
  mars:    { kor: "화성", icon: "♂", theme: "추진·경쟁", color: 0xc0563b, size: 1.4, orbit: 25 },
  jupiter: { kor: "목성", icon: "♃", theme: "행운·확장", color: 0xd8a56a, size: 3.6, orbit: 33 },
  saturn:  { kor: "토성", icon: "♄", theme: "책임·시련", color: 0xcbb787, size: 3.0, orbit: 42 },
  uranus:  { kor: "천왕성", icon: "♅", theme: "변화·각성", color: 0xa9dfe9, size: 2.4, orbit: 50 },
  neptune: { kor: "해왕성", icon: "♆", theme: "꿈·직관", color: 0x4a6fd6, size: 2.3, orbit: 57 },
};
/* 실제 공전주기(년) — 애니메이션 속도 비율에 사용 */
const PERIODS = { mercury: 0.241, venus: 0.615, earth: 1, mars: 1.881, jupiter: 11.86, saturn: 29.46, uranus: 84.01, neptune: 164.8 };
/* 황도 12궁 링 반지름 (해왕성 궤도 바깥) */
const ZODIAC_R = 68;

/* ================= 현재 하늘 스냅샷 ================= */
function skySnapshot(date) {
  const jd = toJD(date);
  const list = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune"].map(p => {
    const lon = geoLongitude(p, jd);
    return { p, lon, sign: signOf(lon), idx: signIdx(lon) };
  });
  // 원소 기운 집계 (태양·목성·토성 가중 2)
  const elCount = { fire: 0, earth: 0, air: 0, water: 0 };
  list.forEach(x => { elCount[x.sign.el] += (x.p === "sun" || x.p === "jupiter" || x.p === "saturn") ? 2 : 1; });
  const domEl = Object.entries(elCount).sort((a, b) => b[1] - a[1])[0][0];
  return { jd, list, elCount, domEl };
}

/* ================= 렌더: 현재 하늘 ================= */
const sky = skySnapshot(new Date());

function renderSkyNow() {
  const rows = sky.list.map(x => {
    const m = PLANETS_META[x.p];
    return `<div class="sky-row">
      <span class="sr-ic">${m.icon}</span>
      <span class="sr-name">${m.kor}<small>${m.theme}</small></span>
      <span class="sr-sign">${x.sign.sym} ${x.sign.kor}</span>
      <span class="sr-key">${x.sign.key}</span>
    </div>`;
  }).join("");

  const el = AST_EL[sky.domEl];
  const today = new Date();
  $("#sky-date").textContent = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일의 하늘`;
  $("#sky-rows").innerHTML = rows;
  $("#sky-summary").innerHTML =
    `지금 하늘은 <b>${el.kor}의 기운</b>이 가장 강합니다 — 동양 오행으로 치면 <b>${el.saju}</b>의 흐름. ${el.desc}`;
}

/* ================= Three.js 태양계 ================= */
let renderer, scene, camera, planetMeshes = {}, rafId = null;
let camRot = { theta: 0.0, phi: 1.05, dist: 112 }, dragging = false, lastPt = null;

function buildScene() {
  const wrap = $("#space");
  const W = wrap.clientWidth, H = wrap.clientHeight;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(W, H);
  wrap.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070f);
  camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 1000);

  // 실제 행성 텍스처 (Solar System Scope, CC BY 4.0)
  const texLoader = new THREE.TextureLoader();
  const TEX = (f) => {
    const t = texLoader.load(`assets/planets/${f}`);
    t.anisotropy = 4;
    return t;
  };

  // 은하수 배경 구 (안쪽면) + 별 포인트
  const milky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 48, 32),
    new THREE.MeshBasicMaterial({ map: TEX("2k_stars_milky_way.jpg"), side: THREE.BackSide })
  );
  milky.rotation.x = 0.35;
  scene.add(milky);
  const starGeo = new THREE.BufferGeometry();
  const starN = 500, pos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const r = 300 + Math.random() * 180, t = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(t);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(t);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xdfe2f2, size: 0.8, sizeAttenuation: true })));

  // 태양 (절차적 표면 텍스처) + 글로우
  const sun = new THREE.Mesh(new THREE.SphereGeometry(PLANETS_META.sun.size, 48, 48),
    new THREE.MeshBasicMaterial({ map: makeSunTexture() }));
  sun.userData.spin = 0.0016;
  scene.add(sun);
  planetMeshes._sun = sun;
  const glowTex = makeGlowTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa64d, transparent: true, opacity: 0.9, depthWrite: false }));
  glow.scale.set(26, 26, 1);
  scene.add(glow);
  scene.add(new THREE.PointLight(0xfff0d8, 2.6, 500));
  scene.add(new THREE.AmbientLight(0x8888a8, 1.15)); // 텍스처가 잘 보이도록 밝게

  // 황도 12궁 링 + 기호
  const zr = ZODIAC_R;
  const ringGeo = new THREE.RingGeometry(zr - 0.25, zr + 0.25, 128);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x8a7a55, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  SIGNS.forEach((s, i) => {
    const ang = (i * 30 + 15) * DEG;
    const spr = textSprite(s.sym, "#cdbd90", 46);
    spr.position.set(zr * Math.cos(ang), 0.5, -zr * Math.sin(ang));
    spr.scale.set(5.4, 5.4, 1);
    scene.add(spr);
    // 구간 눈금
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 2.6), new THREE.MeshBasicMaterial({ color: 0x6a5f45 }));
    const ta = i * 30 * DEG;
    tick.position.set(zr * Math.cos(ta), 0, -zr * Math.sin(ta));
    tick.rotation.y = ta;
    scene.add(tick);
  });

  // 행성 + 궤도 (실제 현재 heliocentric 각도에 배치)
  const jd = sky.jd;
  ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"].forEach(p => {
    const meta = PLANETS_META[p];
    // 궤도선
    const og = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = i / 96 * Math.PI * 2;
      pts.push(meta.orbit * Math.cos(a), 0, meta.orbit * Math.sin(a));
    }
    og.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    scene.add(new THREE.LineLoop(og, new THREE.LineBasicMaterial({ color: 0x3a3a52, transparent: true, opacity: 0.8 })));

    const h = helio(p, jd);
    const lon = Math.atan2(h.y, h.x); // heliocentric 황경
    const TEX_FILE = {
      mercury: "2k_mercury.jpg", venus: "2k_venus_atmosphere.jpg", earth: "2k_earth_daymap.jpg",
      mars: "2k_mars.jpg", jupiter: "2k_jupiter.jpg", saturn: "2k_saturn.jpg", neptune: "2k_neptune.jpg",
    };
    // 천왕성은 실제로도 거의 무늬가 없어 절차적(청록 그라데이션+희미한 띠) 텍스처 사용
    const mapTex = p === "uranus" ? makeUranusTexture() : TEX(TEX_FILE[p]);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(meta.size, 40, 40),
      new THREE.MeshStandardMaterial({ map: mapTex, roughness: 0.92, metalness: 0 }));
    mesh.rotation.z = 0.1; // 살짝 기울인 자전축
    mesh.userData = { p, angle: lon, r: meta.orbit, spin: 0.004 / Math.max(0.4, meta.size / 2) };
    mesh.position.set(meta.orbit * Math.cos(lon), 0, -meta.orbit * Math.sin(lon));
    scene.add(mesh);
    planetMeshes[p] = mesh;

    // 라벨
    const lab = textSprite(meta.kor, "#e8e2d2", 34);
    lab.scale.set(6.2, 3.1, 1);
    mesh.add(lab);
    lab.position.set(0, meta.size + 2.2, 0);

    if (p === "saturn") {
      // 실제 고리 텍스처 — RingGeometry UV를 방사형으로 재매핑
      const rgeo = new THREE.RingGeometry(meta.size + 1.0, meta.size + 3.2, 96, 1);
      const uv = rgeo.attributes.uv, ppos = rgeo.attributes.position;
      const v3 = new THREE.Vector3();
      for (let i = 0; i < ppos.count; i++) {
        v3.fromBufferAttribute(ppos, i);
        uv.setXY(i, v3.length() < meta.size + 2.1 ? 0 : 1, 1);
      }
      const rg = new THREE.Mesh(rgeo, new THREE.MeshBasicMaterial({
        map: TEX("2k_saturn_ring_alpha.png"), side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false,
      }));
      rg.rotation.x = -Math.PI / 2 + 0.45;
      mesh.add(rg);
    }
    if (p === "uranus") {
      // 천왕성의 희미한 고리 — 자전축이 98° 누워 있어 고리가 거의 세로로 섭니다
      const ug = new THREE.RingGeometry(meta.size + 0.9, meta.size + 1.7, 80, 1);
      const ur = new THREE.Mesh(ug, new THREE.MeshBasicMaterial({ color: 0xbfe6ee, side: THREE.DoubleSide, transparent: true, opacity: 0.32, depthWrite: false }));
      ur.rotation.x = -Math.PI / 2 + 1.72;
      mesh.add(ur);
    }
    if (p === "earth") {
      const mk = textSprite("나", "#7fb2ff", 40);
      mk.scale.set(3, 3, 1); mk.position.set(0, -meta.size - 2.0, 0);
      mesh.add(mk);
    }
  });

  // 인터랙션 (드래그 회전 + 휠 줌)
  const el = renderer.domElement;
  const down = (x, y) => { dragging = true; lastPt = { x, y }; };
  const move = (x, y) => {
    if (!dragging) return;
    camRot.theta -= (x - lastPt.x) * 0.005;
    camRot.phi = Math.max(0.25, Math.min(1.45, camRot.phi - (y - lastPt.y) * 0.004));
    lastPt = { x, y };
  };
  el.addEventListener("mousedown", e => down(e.clientX, e.clientY));
  window.addEventListener("mousemove", e => move(e.clientX, e.clientY));
  window.addEventListener("mouseup", () => dragging = false);
  el.addEventListener("touchstart", e => down(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  el.addEventListener("touchmove", e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  el.addEventListener("touchend", () => dragging = false);
  el.addEventListener("wheel", e => { camRot.dist = Math.max(50, Math.min(230, camRot.dist + e.deltaY * 0.06)); }, { passive: true });

  // 크기 추적: 백그라운드 탭에서 초기화돼 0px였다가 표시되는 경우까지 자동 복구
  const fit = () => {
    const W2 = wrap.clientWidth, H2 = wrap.clientHeight;
    if (!W2 || !H2) return;
    if (renderer.domElement.width !== Math.floor(W2 * renderer.getPixelRatio())) {
      camera.aspect = W2 / H2; camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    }
  };
  window.addEventListener("resize", fit);
  new ResizeObserver(fit).observe(wrap);
  document.addEventListener("visibilitychange", fit);
  fit();

  animate();
}

/* 태양 표면 절차적 텍스처 (과립 무늬) */
function makeSunTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const base = g.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, "#ffcf6e"); base.addColorStop(0.5, "#ffab3d"); base.addColorStop(1, "#ff8c2e");
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512, y = Math.random() * 256, r = 2 + Math.random() * 9;
    const bright = Math.random() > 0.5;
    g.fillStyle = bright ? `rgba(255,${200 + Math.random() * 40 | 0},120,0.16)` : `rgba(200,90,20,0.14)`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/* 천왕성 절차적 텍스처 — 옅은 청록 바탕에 희미한 위도 띠 */
function makeUranusTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const base = g.createLinearGradient(0, 0, 0, 256);
  base.addColorStop(0, "#b9e7ee"); base.addColorStop(0.5, "#a3dbe6"); base.addColorStop(1, "#8fcfdc");
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 14; i++) {
    const y = 20 + i * 16 + (Math.random() * 6 - 3), h = 3 + Math.random() * 5;
    g.fillStyle = `rgba(255,255,255,${(0.05 + Math.random() * 0.08).toFixed(3)})`;
    g.fillRect(0, y, 512, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function makeGlowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,200,120,1)");
  gr.addColorStop(0.35, "rgba(255,160,70,0.45)");
  gr.addColorStop(1, "rgba(255,140,50,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function textSprite(text, color, px) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  g.font = `700 ${px}px 'Noto Sans KR', sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,.8)"; g.shadowBlur = 8;
  g.fillStyle = color; g.fillText(text, 128, 64);
  const t = new THREE.CanvasTexture(c);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
}

let simSpeed = 1; // 1 = 실시간(거의 정지), 슬라이더로 가속
function animate() {
  rafId = requestAnimationFrame(animate);
  // 카메라
  const { theta, phi, dist } = camRot;
  camRot.theta += dragging ? 0 : 0.0006; // 천천히 자동 회전
  camera.position.set(dist * Math.sin(phi) * Math.cos(theta), dist * Math.cos(phi), dist * Math.sin(phi) * Math.sin(theta));
  camera.lookAt(0, 0, 0);
  // 행성 공전 (실제 주기 비율) + 자전 (텍스처가 살아 보이게)
  const dayPerFrame = simSpeed / 60; // speed=1 → 하루/초
  Object.values(planetMeshes).forEach(m => {
    if (m.userData.spin) m.rotation.y += m.userData.spin;
    const per = PERIODS[m.userData.p];
    if (!per) return; // 태양 등 비공전체
    m.userData.angle += (2 * Math.PI / (per * 365.25)) * dayPerFrame;
    m.position.set(m.userData.r * Math.cos(m.userData.angle), 0, -m.userData.r * Math.sin(m.userData.angle));
  });
  renderer.render(scene, camera);
}

/* ================= 내 운세 (사주 × 별자리) ================= */

/* 오늘 일진 vs 내 일간 — 십신 그룹별 오늘 테마 */
const TODAY_BANK = {
  비겁: "오늘은 내 기운이 서는 날입니다. 주도권을 쥐고 밀어붙이기 좋지만, 같은 이유로 고집 대 고집의 충돌도 생기기 쉬우니 '이기는 것'보다 '얻는 것'에 집중하세요.",
  식상: "오늘은 표현의 날입니다. 말과 결과물이 평소보다 좋게 받아들여지니 발표·제안·고백처럼 내보이는 일을 오늘로 당기세요. 다만 말이 앞서지 않게 한 번 다듬고 내놓을 것.",
  재성: "오늘은 재물이 움직이는 날입니다. 거래·협상·정산에 유리하고 좋은 물건·기회가 눈에 들어옵니다. 대신 충동 지출도 같이 커지는 날이니 큰 결제는 장바구니에 하루 재우세요.",
  관성: "오늘은 평가받는 날입니다. 윗사람·조직의 시선이 나에게 닿기 쉬우니 기본기를 지키는 것만으로 점수를 법니다. 서류·규정·약속 시간을 특히 깔끔하게.",
  인성: "오늘은 채우는 날입니다. 공부·문서·조언운이 밝아 배우거나 결재받는 일이 순조롭습니다. 결정이 어려웠던 문제는 오늘 연장자의 조언을 구하면 실마리가 잡힙니다.",
};

function renderMyFortune(input) {
  const saju = calculateSaju(input);
  const today = new Date();
  const jd = toJD(today);

  // ---- 별자리 파트 ----
  const birthDateUTCnoon = new Date(Date.UTC(input.y, input.m - 1, input.d, 3)); // KST 정오≈UTC 3시
  const mySunLon = geoLongitude("sun", toJD(birthDateUTCnoon));
  const mySign = signOf(mySunLon), myIdx = signIdx(mySunLon);

  const jup = sky.list.find(x => x.p === "jupiter");
  const sat = sky.list.find(x => x.p === "saturn");
  const mar = sky.list.find(x => x.p === "mars");

  const astLines = [];
  astLines.push(`당신의 태양은 <b>${mySign.sym} ${mySign.kor}</b>에 떠 있었습니다 — ${mySign.key}의 별 아래 태어난 사람입니다.`);
  if (jup.idx === myIdx) astLines.push(`지금 <b>행운의 목성이 당신의 별자리를 지나는 중</b>입니다. 약 12년에 한 번 오는 확장의 시기 — 기회가 오면 재지 말고 잡으세요.`);
  else if (jup.sign.el === mySign.el) astLines.push(`목성이 당신과 같은 ${AST_EL[mySign.el].kor}의 별자리(${jup.sign.kor})를 지나며 순풍을 보태고 있습니다. 넓히는 시도에 유리한 흐름입니다.`);
  else astLines.push(`목성은 지금 ${jup.sign.kor}에 있습니다 — '${jup.sign.key}'의 영역에서 당신에게 기회가 자랍니다.`);
  if (sat.idx === myIdx) astLines.push(`동시에 <b>토성이 당신의 별자리를 통과 중</b> — 약 2년 반의 담금질 구간입니다. 이 시기의 노력은 유난히 오래 남습니다.`);
  else if (sat.sign.el === mySign.el) astLines.push(`토성이 같은 원소를 지나 책임의 무게가 다소 실리지만, 그만큼 기초를 다지기 좋은 때입니다.`);
  if (mar.sign.el === mySign.el) astLines.push(`화성까지 같은 ${AST_EL[mySign.el].kor} 기운이라 에너지가 오르는 시기 — 몸을 쓰는 시작에 좋습니다.`);
  // 외행성(세대 행성) — 내 별자리를 직접 지날 때만 언급 (7년·14년에 한 번 오는 드문 시기)
  const ura = sky.list.find(x => x.p === "uranus");
  const nep = sky.list.find(x => x.p === "neptune");
  if (ura && ura.idx === myIdx) astLines.push(`<b>천왕성이 당신의 별자리를 지나는 중</b>입니다 — 84년 주기 중 약 7년만 머무는 '각성의 구간'. 익숙한 틀이 흔들리고 새 길이 열리는 시기이니, 변화를 두려워하지 마세요.`);
  if (nep && nep.idx === myIdx) astLines.push(`<b>해왕성이 당신의 별자리에 머물고 있습니다</b> — 165년 주기 중 약 14년의 '꿈과 직관의 구간'. 영감은 풍부해지지만 현실 판단이 흐려지기 쉬우니 큰 결정은 근거를 한 번 더 확인하세요.`);

  // ---- 사주 파트: 오늘 일진 ----
  const tdp = dayPillar(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const todayGanji = STEMS[tdp.stem].kor + BRANCHES[tdp.branch].kor;
  const relGroup = tenGodGroup(tenGodOfStem(saju.dayStem, tdp.stem));
  const myDayBranch = saju.pillars.day.branch;
  const chungToday = chungBranch(myDayBranch) === tdp.branch;
  const hapToday = YUKHAP[myDayBranch] === tdp.branch;

  const sjLines = [];
  const regionName = REGIONS[input.regionIdx]?.name || "한국";
  const corr = saju.solarTime ? saju.solarTime.corrMin : null;
  sjLines.push(`당신은 지구 위 <b>${regionName}</b>${corr != null ? ` (표준시보다 태양이 ${Math.abs(corr)}분 ${corr < 0 ? "늦게" : "빠르게"} 뜨는 경도)` : ""}에서, <b>${saju.ganjiText.day}일주</b>의 시각에 태어났습니다. 일간은 ${DAY_MASTER_TEXT[saju.dayStem].title.split(" — ")[0]}.`);
  sjLines.push(`오늘은 <b>${todayGanji}일</b> — 당신에게 <b>${relGroup}의 날</b>입니다. ${TODAY_BANK[relGroup]}`);
  if (chungToday) sjLines.push(`⚠️ 다만 오늘 일진이 당신의 일지와 <b>충(沖)</b>을 이룹니다. 큰 계약·수술·언쟁은 하루만 미루는 게 좋습니다.`);
  if (hapToday) sjLines.push(`오늘 일진이 당신의 일지와 <b>합(合)</b>을 이룹니다 — 인연과 부탁이 순하게 풀리는 날입니다.`);

  // ---- 올해 ----
  const rel2026 = tenGodRelation(saju.dayEl, "fire");
  const yearLine = YEAR2026_TEXT[rel2026];

  $("#my-result").innerHTML = `
    <div class="cos-card">
      <h3>🔭 별자리로 본 지금의 나</h3>
      ${astLines.map(l => `<p>${l}</p>`).join("")}
    </div>
    <div class="cos-card">
      <h3>📅 사주로 본 오늘 — ${today.getMonth() + 1}월 ${today.getDate()}일 (${todayGanji}일)</h3>
      ${sjLines.map(l => `<p>${l}</p>`).join("")}
    </div>
    <div class="cos-card">
      <h3>🐎 사주로 본 올해 — 2026 병오년</h3>
      <p>${yearLine}</p>
      <a class="cos-more" href="index.html">배우자·재물·대운까지 — 전체 심층 풀이 보러 가기 →</a>
    </div>`;
  $("#my-result").classList.remove("hidden");
  $("#my-result").scrollIntoView({ behavior: "smooth", block: "start" });

  // 씬에 내 별자리 하이라이트
  highlightMySign(myIdx);
}

let myHalo = null;
function highlightMySign(idx) {
  if (myHalo) { scene.remove(myHalo); myHalo = null; }
  const zr = ZODIAC_R, ang = (idx * 30 + 15) * DEG;
  const spr = textSprite("★ 내 별자리", "#ffd27f", 30);
  spr.position.set((zr + 7) * Math.cos(ang), 2.5, -(zr + 7) * Math.sin(ang));
  spr.scale.set(9, 4.5, 1);
  scene.add(spr);
  myHalo = spr;
}

/* ================= 입력 폼 ================= */
(function initForm() {
  const ySel = $("#c-year"), mSel = $("#c-month"), dSel = $("#c-day");
  const nowY = new Date().getFullYear();
  ySel.innerHTML = `<option value="">연도</option>` + Array.from({ length: nowY - 1929 }, (_, i) => `<option>${nowY - i}</option>`).join("");
  mSel.innerHTML = `<option value="">월</option>` + Array.from({ length: 12 }, (_, i) => `<option>${i + 1}</option>`).join("");
  const fillD = () => {
    const dim = new Date(+ySel.value || 2000, +mSel.value || 1, 0).getDate();
    const prev = dSel.value;
    dSel.innerHTML = `<option value="">일</option>` + Array.from({ length: dim }, (_, i) => `<option>${i + 1}</option>`).join("");
    if (prev && +prev <= dim) dSel.value = prev;
  };
  ySel.onchange = mSel.onchange = fillD; fillD();
  $("#c-hour").innerHTML = `<option value="-1">시간 모름</option>` + Array.from({ length: 24 }, (_, h) => `<option value="${h}">${String(h).padStart(2, "0")}시</option>`).join("");
  $("#c-region").innerHTML = REGIONS.map((r, i) => `<option value="${i}" ${r.name === "서울" ? "selected" : ""}>${r.name}</option>`).join("");

  // 메인에서 분석했던 정보 프리필
  try {
    const last = JSON.parse(localStorage.getItem("cheongiyeon_last_input") || "null");
    if (last && last.y) {
      ySel.value = last.y; mSel.value = last.m; fillD(); dSel.value = last.d;
      $("#c-hour").value = String(last.hour);
      $("#c-region").value = String(last.regionIdx ?? 0);
      if (last.gender === "F") $("#c-gf").checked = true;
    }
  } catch {}
})();

$("#c-run").addEventListener("click", () => {
  const y = +$("#c-year").value, m = +$("#c-month").value, d = +$("#c-day").value;
  if (!y || !m || !d) {
    const t = $("#toast"); t.textContent = "생년월일을 선택해주세요"; t.classList.remove("hidden");
    setTimeout(() => t.classList.add("hidden"), 2200);
    return;
  }
  const input = {
    name: "나", gender: $("#c-gf").checked ? "F" : "M",
    y, m, d,
    hour: +$("#c-hour").value, minute: 0,
    regionIdx: +$("#c-region").value,
    concerns: [], loveStatus: "solo", jobStatus: "employee",
  };
  localStorage.setItem("cheongiyeon_last_input", JSON.stringify(input));
  renderMyFortune(input);
});

/* 속도 슬라이더 */
$("#speed").addEventListener("input", (e) => {
  simSpeed = Math.pow(10, +e.target.value); // 0→1일/초, 3→1000일/초
  $("#speed-label").textContent = simSpeed >= 365 ? `${(simSpeed / 365).toFixed(1)}년/초` : `${Math.round(simSpeed)}일/초`;
});

/* 시작 */
renderSkyNow();
buildScene();
