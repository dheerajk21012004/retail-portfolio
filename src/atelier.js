// The 3D atelier: a dim round boutique with a curved brass rail. Each look hangs on a walnut hanger,
// sways when you hover it and turns round on its hook when opened. Only loaded on capable desktops.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gsap } from 'gsap';

const R = 5; // rail radius, metres
const RAIL_Y = 2.08;
const CAM_R = 1.2; // camera distance from the centre while browsing (a longer lens, less edge stretch)
const EYE = 1.3;
const ROOM = 7.4;
const CEIL = 5;

const rnd = (a, b) => a + Math.random() * (b - a);
const onArc = (a, r, y, v = new THREE.Vector3()) => v.set(Math.sin(a) * r, y, -Math.cos(a) * r);

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

function walnut(g, w, h, rows = 8) {
  const ph = h / rows;
  for (let i = 0; i < rows; i++) {
    const hue = 24 + rnd(-3, 3);
    const l = 15 + rnd(-3, 3);
    g.fillStyle = `hsl(${hue} 45% ${l}%)`;
    g.fillRect(0, i * ph, w, ph);
    for (let k = 0; k < 46; k++) {
      g.strokeStyle = `hsl(${hue} 42% ${l + rnd(-7, 6)}% / ${rnd(0.12, 0.45)})`;
      g.lineWidth = rnd(0.6, 2.2);
      const y0 = i * ph + rnd(2, ph - 2);
      const amp = rnd(0.5, 3);
      g.beginPath();
      g.moveTo(0, y0);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.012 + k) * amp);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(0, i * ph, w, 2);
    g.fillRect(rnd(0.15, 0.85) * w, i * ph, 2, ph);
  }
}

function tweed(g, w, h) {
  g.fillStyle = '#2b261d';
  g.fillRect(0, 0, w, h);
  const col = 16;
  g.lineWidth = 2;
  for (let x = 0; x < w; x += col) {
    const dir = (x / col) % 2 ? 1 : -1;
    for (let y = -col; y < h + col; y += 5) {
      g.strokeStyle = `rgba(${rnd(120, 170)},${rnd(105, 140)},${rnd(80, 100)},${rnd(0.12, 0.28)})`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + col, y + dir * col * 0.6);
      g.stroke();
    }
  }
  const flecks = ['#8a3b26', '#c9a35f', '#4d5a3a', '#d8cbb2'];
  for (let i = 0; i < 900; i++) {
    g.fillStyle = flecks[i % 4];
    g.globalAlpha = rnd(0.15, 0.5);
    g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 2.5), rnd(1, 2));
  }
  g.globalAlpha = 1;
}

const photoVert = /* glsl */ `
uniform float uTime, uHover;
uniform vec2 uMouse;
varying vec2 vUv;
varying float vFold;
void main() {
  vUv = uv;
  vec3 p = position;
  float hang = 1.0 - uv.y; // pinned at the hanger, free at the hem
  float d = distance(uv, uMouse);
  float ripple = sin(d * 24.0 - uTime * 5.0) * exp(-d * 5.0) * uHover;
  float cloth = sin(uv.x * 7.0 + uTime * 1.3) * sin(uv.y * 4.0 - uTime * 0.9);
  float z = (cloth * (0.008 + 0.04 * uHover) + ripple * 0.05) * hang;
  p.z += z;
  vFold = z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const photoFrag = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uReady, uLight;
varying vec2 vUv;
varying float vFold;
void main() {
  vec2 uv = vUv + vec2(vFold * 0.5, vFold * 0.25);
  vec3 col = mix(uColor, texture2D(uMap, uv).rgb, uReady);
  float spot = smoothstep(1.15, 0.2, distance(vUv * vec2(1.0, 0.8), vec2(0.5, 0.86)));
  col *= mix(0.7, 1.06, spot) * uLight;
  col *= 1.0 + vFold * 7.0; // folds catch and lose the light
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createAtelier(canvas, entries, base) {
  const n = entries.length;
  // A short rail faces you; a long one wraps round the room, starting just left of the door.
  const STEP = Math.min(0.27, 5.3 / Math.max(n - 1, 1));
  const span = (n - 1) * STEP;
  const A0 = span < 3 ? -span / 2 : -0.35;
  const lo = A0 - 0.3;
  const hi = A0 + span + 0.3;
  const gap = A0 + span / 2 + Math.PI; // the bare stretch of wall opposite the middle of the rail
  const eager = span < 3 ? n : 6; // looks visible from the door load first, the rest lazily
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const dpr = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0806);
  scene.fog = new THREE.FogExp2(0x0b0806, 0.085);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
  const time = { value: 0 };

  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25e, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 0.9 });
  const wood = canvasTexture(1024, 1024, walnut, [3, 3]);
  const walnutMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.55 });

  // Room
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM, 72), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6, envMap: env, envMapIntensity: 0.15 }));
  floor.rotation.x = -Math.PI / 2;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(ROOM, ROOM, CEIL, 96, 1, true),
    new THREE.MeshStandardMaterial({ map: canvasTexture(256, 256, tweed, [44, 5]), roughness: 1, side: THREE.BackSide }),
  );
  wall.position.y = CEIL / 2;
  const panelTex = canvasTexture(512, 256, (g, w, h) => {
    walnut(g, w, h, 4);
    g.strokeStyle = 'rgba(0,0,0,.55)';
    g.lineWidth = 6;
    g.strokeRect(28, 28, w - 56, h - 56);
    g.strokeStyle = 'rgba(255,220,170,.12)';
    g.lineWidth = 2;
    g.strokeRect(34, 34, w - 68, h - 68);
  }, [30, 1]);
  const dado = new THREE.Mesh(new THREE.CylinderGeometry(ROOM - 0.04, ROOM - 0.04, 1.05, 96, 1, true), new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.5, side: THREE.BackSide }));
  dado.position.y = 0.525;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(ROOM - 0.06, 0.02, 6, 200), brass);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 1.06;
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(ROOM, 48), new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEIL;
  scene.add(floor, wall, dado, trim, ceiling);

  // Rail: a brass arc hung from the ceiling
  class Arc extends THREE.Curve {
    getPoint(t, v = new THREE.Vector3()) {
      return onArc(lo + (hi - lo) * t, R, RAIL_Y, v);
    }
  }
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new Arc(), Math.ceil((hi - lo) * 60), 0.022, 10), brass));
  for (const a of [lo, hi]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), brass);
    onArc(a, R, RAIL_Y, cap.position);
    scene.add(cap);
  }
  const rodGeo = new THREE.CylinderGeometry(0.009, 0.009, CEIL - RAIL_Y, 8);
  const rods = Math.max(2, Math.round((hi - lo) / 1.1));
  for (let r = 0; r <= rods; r++) {
    const rod = new THREE.Mesh(rodGeo, brass);
    onArc(lo + 0.1 + ((hi - lo - 0.2) * r) / rods, R, (CEIL + RAIL_Y) / 2, rod.position);
    scene.add(rod);
  }

  // Light: a soft wash over the rail plus a key spot that follows you along it
  scene.add(new THREE.HemisphereLight(0xffe3bd, 0x120a06, 0.22));
  const wash = new THREE.SpotLight(0xffc98f, 30, 0, 0.75, 1, 1.5);
  wash.position.set(0, 4.6, 1.4);
  wash.target.position.set(0, 1.5, -R);
  const key = new THREE.SpotLight(0xffd8a8, 55, 0, 0.36, 0.9, 1.6);
  scene.add(wash, wash.target, key, key.target);

  // Fake light: pools on the floor and soft beams above each look (additive, no real lights)
  const poolMat = new THREE.MeshBasicMaterial({
    map: canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,214,160,1)');
      gr.addColorStop(1, 'rgba(255,214,160,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    }),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.22,
  });
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main() { vY = uv.y; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main() { float a = pow(abs(dot(vN, vV)), 2.5) * vY * vY * 0.07;
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * a, 1.0); }`,
  });
  const beamGeo = new THREE.ConeGeometry(0.85, CEIL - 0.3, 32, 1, true);
  const poolGeo = new THREE.PlaneGeometry(2, 2);
  const glowMat = poolMat.clone();
  glowMat.opacity = 0.16;
  const glowGeo = new THREE.PlaneGeometry(2.6, 4.2);
  // one draw call each for every look's floor pool, beam and wall wash
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, n);
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, n);
  const glows = new THREE.InstancedMesh(glowGeo, glowMat, n);
  const dummy = new THREE.Object3D();
  const place = (mesh, i, x, y) => {
    dummy.rotation.set(x, y, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  };

  // Dust drifting through the light
  const dustN = 420;
  const dustPos = new Float32Array(dustN * 3);
  const dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dustPos.set([rnd(-4.5, 4.5), rnd(0, 3.8), rnd(-5.8, -0.5)], i * 3);
    dustSeed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(dustSeed, 1));
  const dustScale = { value: 1 };
  const dust = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      uniforms: { uTime: time, uScale: dustScale },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float seed; uniform float uTime, uScale; varying float vA;
        void main() { vec3 p = position;
          p.y = mod(p.y + uTime * (0.02 + 0.03 * seed), 3.8);
          p.x += sin(uTime * 0.2 + seed * 40.0) * 0.15; p.z += cos(uTime * 0.17 + seed * 30.0) * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.004 + 0.007 * seed) * uScale / -mv.z; vA = 0.3 + 0.7 * seed; }`,
      fragmentShader: `varying float vA; void main() { float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * smoothstep(0.5, 0.0, d) * vA * 0.45, 1.0); }`,
    }),
  );
  scene.add(dust);

  // A dress form at one end of the rail and a floor lamp at the other
  const form = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.LatheGeometry(
      [[0, 0.8], [0.12, 0.81], [0.165, 0.88], [0.178, 0.97], [0.152, 1.07], [0.132, 1.14], [0.152, 1.24], [0.176, 1.33], [0.182, 1.4], [0.166, 1.46], [0.112, 1.5], [0.055, 1.53], [0.05, 1.6], [0, 1.62]].map(([x, y]) => new THREE.Vector2(x, y)),
      40,
    ),
    new THREE.MeshStandardMaterial({ color: 0xcbb594, roughness: 0.95 }),
  );
  torso.scale.z = 0.72;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 10), walnutMat);
  pole.position.y = 0.4;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.04, 32), walnutMat);
  foot.position.y = 0.02;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), brass);
  knob.position.y = 1.63;
  const tape = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.006, 6, 40), new THREE.MeshStandardMaterial({ color: 0xe6c65c, roughness: 0.6 }));
  tape.position.y = 1.53;
  tape.rotation.x = Math.PI / 2 - 0.25;
  form.add(torso, pole, foot, knob, tape);
  onArc(gap, 3.6, 0, form.position);
  form.rotation.y = -gap;
  scene.add(form);

  const lamp = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.62, 10), brass);
  stem.position.y = 0.81;
  const lampFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 28), brass);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.3, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd08a, side: THREE.DoubleSide }));
  shade.position.y = 1.7;
  const bulb = new THREE.PointLight(0xffb36b, 3, 6, 1.5);
  bulb.position.y = 1.62;
  lamp.add(stem, lampFoot, shade, bulb);
  onArc(gap + 0.12, R + 0.5, 0, lamp.position);
  scene.add(lamp);

  // Hangers and looks
  const hookGeo = new THREE.TorusGeometry(0.036, 0.0055, 8, 24, Math.PI * 1.3).rotateZ(-Math.PI / 2).rotateY(Math.PI / 2);
  const neckGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.1, 8).translate(0, -0.095, 0);
  const hangerGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([[-0.23, -0.25], [-0.12, -0.18], [0, -0.145], [0.12, -0.18], [0.23, -0.25]].map(([x, y]) => new THREE.Vector3(x, y, 0))),
    32,
    0.017,
    8,
  );
  const linings = [0x4f1a1c, 0x1f3a2c, 0x1d2541, 0x6b4a1f].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.38, envMap: env, envMapIntensity: 0.35 }));
  const label = new THREE.MeshBasicMaterial({
    map: canvasTexture(256, 96, (g, w, h) => {
      g.fillStyle = '#efe5d3';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#8a6a3a';
      g.setLineDash([6, 5]);
      g.lineWidth = 3;
      g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#2a1d12';
      g.textAlign = 'center';
      g.font = 'italic 600 40px "Bodoni Moda Variable", Georgia, serif';
      g.fillText('DK', w / 2, 52);
      g.font = '600 15px Georgia, serif';
      g.fillText('CAMBRIDGE', w / 2, 78);
    }),
  });
  const labelGeo = new THREE.PlaneGeometry(0.17, 0.064);
  const tagMat = new THREE.MeshStandardMaterial({
    map: canvasTexture(96, 144, (g, w, h) => {
      g.fillStyle = '#dcc79b';
      g.beginPath();
      g.moveTo(w * 0.22, 0);
      g.lineTo(w * 0.78, 0);
      g.lineTo(w, h * 0.12);
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.lineTo(0, h * 0.12);
      g.fill();
      g.fillStyle = '#120d0a';
      g.beginPath();
      g.arc(w / 2, 16, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#5a3f1f';
      for (let y = 46; y < h - 14; y += 16) g.fillRect(16, y, w - 32 - (y % 3) * 8, 3);
    }),
    transparent: true,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  const tagGeo = new THREE.PlaneGeometry(0.065, 0.0975).translate(0, -0.049, 0);
  const stringMat = new THREE.LineBasicMaterial({ color: 0xd8cbb2, transparent: true, opacity: 0.7 });
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;

  const garments = entries.map((e, i) => {
    const ar = e.w / e.h;
    const h = Math.min(1.34, 1.12 / ar);
    const w = h * ar;
    const a = A0 + i * STEP;
    const root = new THREE.Group();
    const swing = new THREE.Group();
    const turn = new THREE.Group();
    onArc(a, R, RAIL_Y, root.position);
    root.rotation.y = -a;
    root.add(swing);
    swing.add(turn);

    const hook = new THREE.Mesh(hookGeo, brass);
    hook.position.y = -0.012;
    const hanger = new THREE.Mesh(hangerGeo, walnutMat);
    hanger.scale.x = Math.min(1, (w * 0.62) / 0.46);
    turn.add(hook, new THREE.Mesh(neckGeo, brass), hanger);

    const uniforms = {
      uMap: { value: blank },
      uColor: { value: new THREE.Color(e.color) },
      uReady: { value: 0 },
      uLight: { value: 1 },
      uHover: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uTime: time,
    };
    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h, 20, 32).translate(0, -h / 2, 0),
      new THREE.ShaderMaterial({ uniforms, vertexShader: photoVert, fragmentShader: photoFrag }),
    );
    photo.position.set(0, -0.15, 0.024);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, -h / 2, 0), linings[i % linings.length]);
    back.rotation.y = Math.PI;
    back.position.set(0, -0.15, -0.024);
    const woven = new THREE.Mesh(labelGeo, label);
    woven.rotation.y = Math.PI;
    woven.position.set(0, -0.27, -0.027);

    const tagAt = new THREE.Vector3(w * 0.3, -0.36, 0.036);
    const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.006, -0.12, 0.03), tagAt]), stringMat);
    const tag = new THREE.Mesh(tagGeo, tagMat);
    tag.position.copy(tagAt);
    turn.add(photo, back, woven, string, tag);

    onArc(a, R - 0.2, 0.004, dummy.position);
    place(pools, i, -Math.PI / 2, 0);
    onArc(a, R - 0.1, 0.3 + (CEIL - 0.3) / 2, dummy.position);
    place(beams, i, 0, 0);
    onArc(a, ROOM - 0.1, 2.1, dummy.position); // the spotlight's wash on the wall behind
    place(glows, i, 0, -a);
    scene.add(root);

    return { e, a, w, h, root, swing, turn, photo, tag, uniforms, ang: rnd(-0.03, 0.03), vel: 0, hover: 0, hoverTarget: 0, turnAngle: 0 };
  });

  scene.add(pools, beams, glows);

  const urlFor = (e) => `${base}looks/${e.id}.jpg`;

  async function loadTexture(url) {
    const img = new Image();
    img.src = url;
    await img.decode(); // decode off the main thread before upload
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    renderer.initTexture(t);
    return t;
  }

  function setMap(g, t) {
    if (g.uniforms.uMap.value === blank) gsap.to(g.uniforms.uReady, { value: 1, duration: 0.8 });
    g.uniforms.uMap.value = t;
  }

  function loadPhoto(g) {
    return (g.loading ||= loadTexture(urlFor(g.e)).then((t) => setMap(g, t), () => {}));
  }

  // Camera
  const pos = new THREE.Vector3(0, 1.6, 3.7);
  const look = onArc(span < 3 ? 0 : A0 + 0.5, R, 1.18);
  const heroPos = pos.clone();
  const heroLook = look.clone();
  const tPos = new THREE.Vector3();
  const tLook = new THREE.Vector3();
  const right = new THREE.Vector3();
  const mouse = { x: 0, y: 0 };
  let mx = 0;
  let my = 0;
  let lastA = null;
  addEventListener('pointermove', (ev) => {
    mouse.x = (ev.clientX / innerWidth) * 2 - 1;
    mouse.y = -((ev.clientY / innerHeight) * 2 - 1);
  });

  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.3 ? 36 : 30;
    camera.updateProjectionMatrix();
    dustScale.value = (h * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  resize();

  // intro: 0 = wide shot from the door, 1 = standing at the first look. rail: 0..1 along the rail.
  function frame(intro, rail, dt) {
    time.value += dt;
    const u = rail * (n - 1);
    const i = Math.max(0, Math.min(Math.floor(u), n - 2));
    const f = n > 1 ? u - i : 0;
    const eased = f * 0.4 + (0.5 - 0.5 * Math.cos(Math.PI * f)) * 0.6; // linger a little at each look
    const a = A0 + (i + eased) * STEP;
    const k = intro * intro * (3 - 2 * intro);

    onArc(a, CAM_R, EYE, tPos).lerpVectors(heroPos, tPos, k);
    onArc(a, R, 1.2, tLook).lerpVectors(heroLook, tLook, k);
    const damp = 1 - Math.exp(-dt * 5);
    pos.lerp(tPos, damp);
    look.lerp(tLook, damp);
    mx += (mouse.x - mx) * damp;
    my += (mouse.y - my) * damp;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    camera.position.copy(pos).addScaledVector(right, mx * 0.06);
    camera.position.y += my * 0.04;
    camera.lookAt(look.x + right.x * mx * 0.2, look.y + my * 0.1, look.z + right.z * mx * 0.2);

    const keyA = (span < 3 ? 0 : A0 + 0.5) * (1 - k) + a * k;
    onArc(keyA, 2.2, 4.3, key.position);
    onArc(keyA, R, 1.0, key.target.position);

    // how fast you walk the rail, capped so a big jump only nudges the garments
    const av = lastA === null || dt === 0 ? 0 : Math.max(-1.2, Math.min(1.2, (a - lastA) / dt));
    lastA = a;
    const focus = Math.round(u);
    for (let j = 0; j < n; j++) {
      const g = garments[j];
      g.hover += (g.hoverTarget - g.hover) * (1 - Math.exp(-dt * 4));
      g.uniforms.uHover.value = g.hover;
      const force = -av * 0.9 * k + Math.sin(time.value * 2.1 + g.a * 9) * 0.6 * g.hover;
      g.vel += (-g.ang * 16 - g.vel * 2.4 + force) * dt;
      g.ang += g.vel * dt;
      g.swing.rotation.z = g.ang;
      g.swing.rotation.x = g.ang * 0.3;
      g.turn.rotation.y = g.turnAngle;
      g.tag.rotation.z = 0.1 + g.ang * 2.5;
      const lit = k < 0.5 || j === focus ? 1 : 0.82;
      g.uniforms.uLight.value += (lit - g.uniforms.uLight.value) * damp;
      const dist = Math.abs(j - focus);
      if (k > 0.5 && dist <= 2) loadPhoto(g); // jumped ahead of the lazy loader
    }
    renderer.render(scene, camera);
  }

  const v = new THREE.Vector3();
  const d = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const off = { on: false };
  // Screen rectangle of a look's photo, so the page can lay a real button over it.
  function rect(i) {
    const g = garments[i];
    camera.getWorldDirection(fwd);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of [[-g.w / 2, 0], [g.w / 2, 0], [-g.w / 2, -g.h], [g.w / 2, -g.h]]) {
      v.set(x, y, 0).applyMatrix4(g.photo.matrixWorld);
      if (fwd.dot(d.subVectors(v, camera.position)) < 0.3) return off;
      v.project(camera);
      const sx = ((v.x + 1) / 2) * innerWidth;
      const sy = ((1 - v.y) / 2) * innerHeight;
      x0 = Math.min(x0, sx);
      x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy);
      y1 = Math.max(y1, sy);
    }
    return { on: x1 > 0 && x0 < innerWidth && y1 > 0 && y0 < innerHeight, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  return {
    frame,
    rect,
    resize,
    eager,
    async load(onEach) {
      await Promise.all(garments.slice(0, eager).map((g) => loadPhoto(g).finally(onEach)));
      await renderer.compileAsync(scene, camera).catch(() => {});
    },
    async loadRest() {
      for (const g of garments) await loadPhoto(g);
    },
    // Average fps over a short burst, so slow machines can fall back to the flat lookbook.
    benchmark(frames = 45) {
      return new Promise((resolve) => {
        let count = 0;
        let t0 = 0;
        const tick = (t) => {
          frame(0, 0, 1 / 60);
          if (++count === 6) t0 = t;
          if (count < frames) requestAnimationFrame(tick);
          else resolve(((count - 6) * 1000) / (t - t0));
        };
        requestAnimationFrame(tick);
        setTimeout(() => resolve(60), 4000); // hidden tab: no frames, assume it copes
      });
    },
    hover(i, on) {
      const g = garments[i];
      if (on && !g.hoverTarget) g.vel += 0.5;
      g.hoverTarget = on ? 1 : 0;
    },
    pointer(i, x, y) {
      garments[i].uniforms.uMouse.value.set(x, y);
    },
    turn(i, open) {
      const g = garments[i];
      gsap.to(g, { turnAngle: open ? Math.PI : 0, duration: 1.1, ease: 'power3.inOut' });
      g.vel += open ? 0.7 : -0.7;
    },
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
