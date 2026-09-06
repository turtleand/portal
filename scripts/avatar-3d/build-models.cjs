/* Reproducible Sculpted Warmth derivatives of the canonical Turtleand SVGs.
 * Geometry, expression profiles and studio materials are authored here.
 * Run npm run generate:avatar-3d. Canonical SVGs remain authoritative.
 */
const THREE = require("three");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
class FileReaderPolyfill {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((x) => {
      this.result = x;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((x) => {
      this.result =
        "data:" + blob.type + ";base64," + Buffer.from(x).toString("base64");
      this.onloadend?.();
    });
  }
}
global.FileReader = FileReaderPolyfill;
const V = THREE.Vector3;
const out = path.resolve(__dirname, "../../src/images/avatar/3d");
const versions = ["0.0.1", "0.0.2", "0.0.3", "0.0.4", "0.1.0", "0.1.1"];
const looks = {
  warm: {
    skin: "#888d38",
    young: "#b79a4c",
    shell: "#68472c",
    plate: "#926039",
    belly: "#b08d3c",
    metal: "#9facaa",
    rough: 0.57,
    coat: 0.1,
    emission: 0.32,
  },
};
let root, mat, stats, headGeometry;
function material(color, rough = 0.6, metal = 0, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: rough,
    metalness: metal,
    ...extra,
  });
}
function mesh(name, g, m, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const o = new THREE.Mesh(g, m);
  o.name = name;
  o.position.set(...pos);
  o.scale.set(...scale);
  root.add(o);
  return o;
}
const sphere = new THREE.SphereGeometry(1, 24, 16);
function ell(name, m, p, s) {
  return mesh(name, sphere, m, p, s);
}
function tube(name, points, r, m) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new V(...p)));
  return mesh(
    name,
    new THREE.TubeGeometry(
      c,
      Math.min(144, Math.max(12, points.length * 6)),
      r,
      7,
      false,
    ),
    m,
  );
}
function rod(name, a, b, r, m, r2 = r) {
  const av = new V(...a),
    bv = new V(...b);
  const o = mesh(
    name,
    new THREE.CylinderGeometry(r2, r, av.distanceTo(bv), 16),
    m,
    av.clone().add(bv).multiplyScalar(0.5).toArray(),
  );
  o.quaternion.setFromUnitVectors(new V(0, 1, 0), bv.sub(av).normalize());
  return o;
}
function ring(name, p, r, th, m, rot = [Math.PI / 2, 0, 0], scale = [1, 1, 1]) {
  const o = mesh(name, new THREE.TorusGeometry(r, th, 8, 36), m, p, scale);
  o.rotation.set(...rot);
  return o;
}
function clip(poly, nx, nz, k) {
  let o = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      fa = a[0] * nx + a[1] * nz - k,
      fb = b[0] * nx + b[1] * nz - k;
    if (fa <= 0) o.push(a);
    if (fa < 0 !== fb < 0) {
      const t = fa / (fa - fb);
      o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return o;
}
function surface(x, z, offset = 0) {
  return [
    x * 1.06,
    0.77 + 1.06 * Math.sqrt(Math.max(0.006, 1 - x * x - z * z)) + offset,
    z * 1.2 - 0.12,
  ];
}
function plate(poly, m, name) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length,
    cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const border = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    for (let j = 0; j < 4; j++) {
      const t = j / 4;
      const px = a[0] + (b[0] - a[0]) * t,
        pz = a[1] + (b[1] - a[1]) * t,
        rr = Math.hypot(px, pz);
      border.push(
        rr > 0.987
          ? [(px / rr) * 0.9997, (pz / rr) * 0.9997]
          : [(px - cx) * 0.977 + cx, (pz - cz) * 0.977 + cz],
      );
    }
  }
  const n = border.length,
    positions = [],
    indices = [],
    rings = 7;
  positions.push(...surface(cx, cz, 0.019));
  for (let r = 1; r <= rings; r++) {
    const t = r / rings;
    for (const p of border) {
      const x = cx + (p[0] - cx) * t,
        z = cz + (p[1] - cz) * t;
      positions.push(...surface(x, z, 0.018 + Math.sin(t * Math.PI) * 0.007));
    }
  }
  for (let j = 0; j < n; j++) indices.push(0, 1 + ((j + 1) % n), 1 + j);
  for (let r = 1; r < rings; r++)
    for (let j = 0; j < n; j++) {
      const a = 1 + (r - 1) * n + j,
        b = 1 + (r - 1) * n + ((j + 1) % n),
        c = 1 + r * n + j,
        d = 1 + r * n + ((j + 1) % n);
      indices.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  const ns = [];
  for (let j = 0; j < positions.length; j += 3) {
    const n = new V(
      positions[j] / 1.06 ** 2,
      (positions[j + 1] - 0.77) / 1.06 ** 2,
      (positions[j + 2] + 0.12) / 1.2 ** 2,
    ).normalize();
    ns.push(n.x, n.y, n.z);
  }
  g.setAttribute("normal", new THREE.Float32BufferAttribute(ns, 3));
  mesh(name, g, m);
  return [cx, cz];
}
function projectedRoute(name, points, r, m) {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new V(x, 0, z)),
  );
  const projected = curve.getPoints(90).map((p) => surface(p.x, p.z, 0.048));
  tube(name, projected, r, m);
}
function shell(idx, look) {
  mesh(
    "carapace dark recessed seams",
    new THREE.SphereGeometry(1, 64, 36, 0, Math.PI * 2, 0, Math.PI / 2),
    mat.shell,
    [0, 0.77, -0.12],
    [1.036, 1.027, 1.174],
  );
  const seeds = [
    [0, -0.72],
    [0, -0.32],
    [0, 0.12],
    [0, 0.59],
    [-0.5, -0.52],
    [0.5, -0.52],
    [-0.57, -0.02],
    [0.57, -0.02],
    [-0.46, 0.49],
    [0.46, 0.49],
    [-0.86, -0.18],
    [0.86, -0.18],
    [-0.78, 0.35],
    [0.78, 0.35],
    [-0.57, -0.77],
    [0.57, -0.77],
  ];
  const boundary = Array.from({ length: 84 }, (_, i) => [
    Math.cos((i / 84) * Math.PI * 2) * 0.9997,
    Math.sin((i / 84) * Math.PI * 2) * 0.9997,
  ]);
  seeds.forEach((seed, i) => {
    let p = boundary;
    seeds.forEach((other) => {
      if (other === seed) return;
      const nx = other[0] - seed[0],
        nz = other[1] - seed[1],
        k = (other[0] ** 2 + other[1] ** 2 - seed[0] ** 2 - seed[1] ** 2) / 2;
      p = clip(p, nx, nz, k);
    });
    if (p.length < 3) return;
    const c = new THREE.Color(look.plate);
    c.offsetHSL(0, 0, ((i % 4) - 1.5) * 0.014);
    mat.scutes ??= [];
    const pm = (mat.scutes[i % 4] ??= material(c, look.rough, 0.02, {
      clearcoat: look.coat,
      clearcoatRoughness: 0.5,
    }));
    pm.name = "shell scutes " + (i % 4);
    plate(p, pm, "scute " + i);
    // Inlaid circuit lines follow the curved scute surface, never flat decals.
    if (idx > 0) {
      const minX = Math.min(...p.map((q) => q[0])),
        maxX = Math.max(...p.map((q) => q[0]));
      const minZ = Math.min(...p.map((q) => q[1])),
        maxZ = Math.max(...p.map((q) => q[1]));
      const cx = (minX + maxX) * 0.5,
        cz = (minZ + maxZ) * 0.5,
        dx = (maxX - minX) * 0.5,
        dz = (maxZ - minZ) * 0.5;
      const glyph = [
        [-0.58, -0.62],
        [-0.58, 0.64],
        [-0.08, 0.64],
        [-0.08, 0.02],
        [0.56, 0.02],
        [0.56, -0.63],
      ];
      const curvePoints = glyph.map(([x, z]) => [cx + x * dx, cz + z * dz]);
      const project = ([x, z]) => {
        const p = surface(x, z, 0.025),
          normal = new V(
            x / 1.06,
            Math.sqrt(Math.max(0.006, 1 - x * x - z * z)) / 1.06,
            z / 1.2,
          ).normalize();
        return new V(...p).addScaledVector(normal, 0.011);
      };
      for (let j = 0; j < curvePoints.length - 1; j++) {
        let a = [...curvePoints[j]],
          b = [...curvePoints[j + 1]],
          visible = true;
        // Keep the inlay within its scute, including the steep side panels.
        for (let k = 0; k < p.length; k++) {
          const u = p[k],
            v = p[(k + 1) % p.length],
            nx = v[1] - u[1],
            nz = u[0] - v[0],
            limit = nx * u[0] + nz * u[1] - 0.02 * Math.hypot(nx, nz);
          const fa = nx * a[0] + nz * a[1] - limit,
            fb = nx * b[0] + nz * b[1] - limit;
          if (fa > 0 && fb > 0) {
            visible = false;
            break;
          }
          if (fa > 0 !== fb > 0) {
            const t = fa / (fa - fb),
              q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            if (fa > 0) a = q;
            else b = q;
          }
        }
        if (!visible || Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.012) continue;
        const path = new THREE.CatmullRomCurve3(
          Array.from({ length: 13 }, (_, k) =>
            project([
              a[0] + ((b[0] - a[0]) * k) / 12,
              a[1] + ((b[1] - a[1]) * k) / 12,
            ]),
          ),
        );
        mesh(
          "inlaid shell circuit " + i + " segment " + j,
          new THREE.TubeGeometry(
            path,
            20,
            idx === 1 ? 0.0065 : 0.0085,
            6,
            false,
          ),
          mat.light,
        );
      }
    }
  });
  ring(
    "rounded marginal shell lip",
    [0, 0.795, -0.12],
    1,
    0.058,
    mat.edge,
    [Math.PI / 2, 0, 0],
    [1.055, 1.2, 1],
  );
  for (let i = 0; i < 30; i++) {
    const t = (i / 30) * Math.PI * 2;
    const x = Math.cos(t),
      z = Math.sin(t);
    tube(
      "marginal scute seam",
      [
        [x * 1.032, 0.75, z * 1.174 - 0.12],
        [x * 1.058, 0.8, z * 1.205 - 0.12],
        [x * 1.025, 0.91, z * 1.164 - 0.12],
      ],
      0.007,
      mat.shell,
    );
  }
  if (idx > 0) {
    ring(
      "subshell illuminated inlay",
      [0, 0.659, -0.12],
      1,
      0.021,
      mat.underlight,
      [Math.PI / 2, 0, 0],
      [0.96, 1.12, 1],
    );
  }
  if (idx === 5) {
    const map = [
      [-0.65, -0.55],
      [-0.4, -0.3],
      [0.04, -0.48],
      [0.32, -0.13],
      [0.15, 0.25],
      [0.48, 0.51],
      [0.73, 0.18],
    ];
    projectedRoute("cartographer route", map, 0.009, mat.map);
    for (let i = 0; i < map.length; i++) {
      ell(
        "route constellation waypoint",
        mat.map,
        surface(...map[i], 0.052),
        [0.035, 0.026, 0.035],
      );
    }
    projectedRoute(
      "cartographer secondary branch",
      [
        [-0.4, -0.3],
        [-0.56, 0.04],
        [-0.3, 0.39],
        [0.15, 0.25],
      ],
      0.006,
      mat.map,
    );
  }
}
function limb(x, z, idx, front) {
  const s = Math.sign(x);
  ell(
    (front ? "fore" : "hind") + " upper limb",
    mat.skin,
    [x, 0.44, z],
    [0.255, 0.4, 0.28],
  );
  ell("rounded foot", mat.skin, [x, 0.17, z + 0.08], [0.26, 0.17, 0.3]);
  for (let j = -1; j <= 1; j++) {
    ell(
      "ivory toe nail",
      mat.nail,
      [x + j * 0.126, 0.12, z + 0.317],
      [0.061, 0.075, 0.094],
    );
  }
  for (const [dx, dy, rx, ry] of [
    [-0.11, 0.55, 0.045, 0.071],
    [0.055, 0.59, 0.036, 0.06],
    [-0.065, 0.405, 0.033, 0.049],
  ].filter((_, i) => idx < 4 || i < 2)) {
    const px = x + s * dx,
      yy = dy;
    const zz =
      z +
      0.28 *
        Math.sqrt(
          Math.max(
            0.05,
            1 - ((px - x) / 0.255) ** 2 - ((yy - 0.44) / 0.4) ** 2,
          ),
        ) +
      0.006;
    ell("broad organic limb marking", mat.spot, [px, yy, zz], [rx, ry, 0.016]);
  }
  if (idx >= 4) {
    ring(
      "ankle cuff",
      [x, 0.245, z],
      0.238,
      0.041,
      mat.metal,
      [Math.PI / 2, 0, 0],
      [1, 1.09, 1],
    );
    ring(
      "upper brace anchor cuff",
      [x, 0.65, z],
      0.215,
      0.027,
      mat.metal,
      [Math.PI / 2, 0, 0],
      [1, 1.09, 1],
    );
    rod(
      "hydraulic upper rail",
      [x + s * 0.214, 0.65, z - 0.04],
      [x + s * 0.26, 0.44, z + 0.09],
      0.05,
      mat.metal,
    );
    rod(
      "polished piston",
      [x + s * 0.26, 0.45, z + 0.08],
      [x + s * 0.245, 0.25, z + 0.15],
      0.033,
      mat.chrome,
    );
    ell(
      "rounded armored shin",
      mat.metal,
      [x, 0.28, z + 0.26],
      [0.222, 0.152, 0.07],
    );
    ell(
      "joint housing",
      mat.dark,
      [x + s * 0.245, 0.48, z + 0.065],
      [0.066, 0.116, 0.113],
    );
    ell(
      "joint inset",
      mat.metal,
      [x + s * 0.283, 0.48, z + 0.065],
      [0.021, 0.091, 0.091],
    );
    ell(
      "joint luminous core",
      mat.light,
      [x + s * 0.307, 0.48, z + 0.065],
      [0.013, 0.057, 0.057],
    );
  }
}
// Selected Warm Presence expression across the lineage. Genesis keeps a slightly softer gaze.
const warmPresence = {
  width: .176, top: .105, lower: .141, tilt: -.004,
  iris: .135, pupil: .078, gazeY: .005, hood: .072,
  smile: .042, mouthWidth: .36, mouthY: 1.206,
};
function headSdf(p) {
  function e(c, r) {
    const a = p.map((v, i) => (v - c[i]) / r[i]);
    const k0 = Math.hypot(...a),
      k1 = Math.hypot(...a.map((v, i) => v / r[i]));
    return (k0 * (k0 - 1)) / Math.max(k1, 0.0001);
  }
  function sm(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  return sm(
    sm(
      e([0, 1.48, 1.36], [0.555, 0.505, 0.48]),
      e([0, 1.255, 1.63], [0.49, 0.285, 0.355]),
      0.125,
    ),
    e([0, 0.99, 0.99], [0.35, 0.45, 0.39]),
    0.14,
  );
}
function headFront(x, y) {
  let hi = 2.13,
    lo = hi;
  for (let z = hi; z >= 0.6; z -= 0.018) {
    if (headSdf([x, y, z]) <= 0) {
      lo = z;
      hi = z + 0.018;
      break;
    }
  }
  if (lo === 2.13) return 1.54;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (headSdf([x, y, mid]) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) * 0.5;
}
function fanSurface(name, polygon, project, m, rings = 5) {
  if (polygon.length < 3) return;
  const center = polygon.reduce(
    (a, p) => [a[0] + p[0] / polygon.length, a[1] + p[1] / polygon.length],
    [0, 0],
  );
  const positions = [...project(...center)],
    indices = [],
    n = polygon.length;
  for (let r = 1; r <= rings; r++)
    for (const p of polygon)
      positions.push(
        ...project(
          center[0] + ((p[0] - center[0]) * r) / rings,
          center[1] + ((p[1] - center[1]) * r) / rings,
        ),
      );
  for (let j = 0; j < n; j++) indices.push(0, 1 + j, 1 + ((j + 1) % n));
  for (let r = 1; r < rings; r++)
    for (let j = 0; j < n; j++) {
      const a = 1 + (r - 1) * n + j,
        b = 1 + (r - 1) * n + ((j + 1) % n),
        c = 1 + r * n + j,
        d = 1 + r * n + ((j + 1) % n);
      indices.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Eye/skin patches are clockwise in XY; orient normals toward the visitor.
  if (g.getAttribute("normal").getZ(0) < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3)
      [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    g.computeVertexNormals();
  }
  return mesh(name, g, m);
}
function clippedCircle(radius, cx, cy, boundary) {
  let poly = Array.from({ length: 64 }, (_, i) => [
    cx + radius * Math.cos((-i / 64) * Math.PI * 2),
    cy + radius * Math.sin((-i / 64) * Math.PI * 2),
  ]);
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length],
      nx = -(b[1] - a[1]),
      ny = b[0] - a[0];
    poly = clip(poly, nx, ny, nx * a[0] + ny * a[1]);
  }
  return poly;
}
function face(idx) {
  mesh("continuous sculpted head and neck", headGeometry, mat.skin);
  const ex = warmPresence;
  for (const s of [-1, 1]) {
    const cx = s * .288, cy = 1.66, w = ex.width;
    const border = [];
    for (let i = 0; i <= 40; i++) {
      const u = -1 + i / 20;
      border.push([u*w, ex.tilt*s*u + (ex.top + (idx === 0 ? .004 : 0))*Math.sqrt(Math.max(0,1-u*u))]);
    }
    for (let i = 39; i > 0; i--) {
      const u = -1 + i / 20;
      border.push([u*w, ex.tilt*s*u - ex.lower*Math.sqrt(Math.max(0,1-u*u))]);
    }
    // A gently convex eye surface follows an explicit gaze plane instead of
    // warping iris circles over the full curvature of the head.
    const yaw = s * .43, pitch = .055;
    const H = new V(Math.cos(yaw), 0, -Math.sin(yaw));
    const U = new V(-Math.sin(yaw)*Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw)*Math.sin(pitch));
    const N = H.clone().cross(U).normalize();
    const center = new V(cx, cy, headFront(cx, cy) + .042);
    const dome = (x,y) => .07*(Math.sqrt(Math.max(.04,1-(x/.212)**2-(y/.198)**2))-1);
    const rawPoint = (x,y,offset=0) => center.clone().addScaledVector(H,x).addScaledVector(U,y).addScaledVector(N,dome(x,y)+offset);
    let lift=0;
    for(let r=0;r<=8;r++) for(const [bx,by]of border){
      const p=rawPoint(bx*r/8,by*r/8);
      lift=Math.max(lift,headFront(p.x,p.y)+.006-p.z);
    }
    center.z += lift;
    const eyePoint = (offset=0)=>(x,y)=>rawPoint(x,y,offset).toArray();
    fanSurface("rounded warm ivory eye",border,eyePoint(),mat.sclera,10);
    const iris = fanSurface("hazel iris with quiet radial depth",clippedCircle(ex.iris,0,ex.gazeY,border),eyePoint(.0018),mat.iris,12);
    // Subtle authored iris color variation remains geometry-native and embedded.
    const colors=[], ap=iris.geometry.getAttribute("position");
    const dark=new THREE.Color("#635333"), honey=new THREE.Color("#9b844d"), centerGold=new THREE.Color("#baa168");
    for(let i=0;i<ap.count;i++){
      const p=new V(ap.getX(i),ap.getY(i),ap.getZ(i)).sub(center);
      const x=p.dot(H),y=p.dot(U)-ex.gazeY,r=Math.min(1,Math.hypot(x,y)/ex.iris),angle=Math.atan2(y,x);
      const col = r>.92 ? honey.clone().lerp(dark,(r-.92)/.08) : centerGold.clone().lerp(honey,r/.92);
      const fiber=(Math.sin(angle*37+.7)+Math.sin(angle*61+1.3))*.022*Math.sin(r*Math.PI);
      col.multiplyScalar(1+fiber);colors.push(col.r,col.g,col.b);
    }
    iris.geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
    fanSurface("rounded attentive pupil",clippedCircle(ex.pupil,0,ex.gazeY,border),eyePoint(.0035),mat.pupil,9);
    const glint=Array.from({length:32},(_,i)=>[-.023+.008*Math.cos(i/32*Math.PI*2),ex.gazeY+.036+.011*Math.sin(i/32*Math.PI*2)]);
    fanSurface("small soft studio catchlight",glint,eyePoint(.0049),mat.white,4);
    // Skin band connects the aperture to the real head surface. The upper
    // band is a broad sculpted hood, not a detached eyebrow strip.
    const positions = [], indices = [], n = border.length;
    for (let r=0;r<=5;r++) for(let j=0;j<n;j++){
      const [x,y]=border[j], upper=j<=40, t=r/5;
      const aperture=rawPoint(x,y,.004);
      const edgeX=aperture.x+(aperture.x-cx)*.15;
      const edgeY=aperture.y+(upper?ex.hood:-.029)*Math.sqrt(Math.max(.08,1-(x/w)**2));
      const edge=new V(edgeX,edgeY,headFront(edgeX,edgeY)-.001);
      const p=aperture.clone().lerp(edge,t);
      p.z+=Math.sin(t*Math.PI)*.004;
      positions.push(p.x,p.y,p.z);
    }
    for (let r = 0; r < 5; r++)
      for (let j = 0; j < n; j++) {
        const a = r * n + j,
          b = r * n + ((j + 1) % n),
          c = a + n,
          d = b + n;
        indices.push(a, b, c, b, d, c);
      }
    const hood = new THREE.BufferGeometry();
    hood.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    hood.setIndex(indices);
    hood.computeVertexNormals();
    const hn = hood.getAttribute("normal");
    for (let r = 3; r <= 5; r++)
      for (let j = 0; j < n; j++) {
        const i = r * n + j,
          x = positions[i * 3],
          y = positions[i * 3 + 1],
          z = positions[i * 3 + 2],
          e = 0.002;
        const surfaceNormal = new V(
          headSdf([x + e, y, z]) - headSdf([x - e, y, z]),
          headSdf([x, y + e, z]) - headSdf([x, y - e, z]),
          headSdf([x, y, z + e]) - headSdf([x, y, z - e]),
        ).normalize();
        const normal = new V(hn.getX(i), hn.getY(i), hn.getZ(i))
          .lerp(surfaceNormal, (r - 2) / 3)
          .normalize();
        hn.setXYZ(i, normal.x, normal.y, normal.z);
      }
    mesh("integrated soft upper lid and lower rim", hood, mat.skin);
    for (const [x, y, rx, ry] of [
      [s * 0.448, 1.407, 0.033, 0.063],
      [s * 0.453, 1.291, 0.025, 0.043],
    ]) {
      const p = Array.from({ length: 36 }, (_, i) => [
        x + rx * Math.cos((i / 36) * Math.PI * 2),
        y + ry * Math.sin((i / 36) * Math.PI * 2),
      ]);
      fanSurface(
        "canonical broad cheek marking",
        p,
        (xx, yy) => [xx, yy, headFront(xx, yy) + 0.004],
        mat.spot,
        4,
      );
    }
  }
  const smile = [];
  for(let i=0;i<=48;i++){
    const u=-1+i/24,x=u*ex.mouthWidth;
    const y=ex.mouthY+ex.smile*u*u;
    smile.push([x,y,headFront(x,y)+.0035]);
  }
  const smileCurve=new THREE.CatmullRomCurve3(smile.map(p=>new V(...p)));
  const segments=96, radial=8;
  const mouthGeometry=new THREE.TubeGeometry(smileCurve,segments,.007,radial,false);
  const mouthPositions=mouthGeometry.getAttribute("position");
  for(let i=0;i<=segments;i++){
    const t=i/segments,c=smileCurve.getPointAt(t),taper=.22+.78*Math.pow(Math.sin(t*Math.PI),.45);
    for(let j=0;j<=radial;j++){
      const at=i*(radial+1)+j,p=new V(mouthPositions.getX(at),mouthPositions.getY(at),mouthPositions.getZ(at));
      p.sub(c).multiplyScalar(taper).add(c);mouthPositions.setXYZ(at,p.x,p.y,p.z);
    }
  }
  mouthGeometry.computeVertexNormals();
  mesh("soft tapered closed smile",mouthGeometry,mat.mouth);
  if (idx >= 3) {
    ell(
      "headset soft cushion",
      mat.dark,
      [-0.575, 1.54, 1.39],
      [0.072, 0.224, 0.211],
    );
    ell(
      "headset metal shell",
      mat.metal,
      [-0.628, 1.54, 1.39],
      [0.055, 0.194, 0.18],
    );
  }
}
function accessories(idx) {
  if (idx >= 3) {
    ring("headset teal ring", [-0.686, 1.54, 1.39], 0.137, 0.024, mat.light, [
      0,
      Math.PI / 2,
      0,
    ]);
    ell("headset center", mat.dark, [-0.69, 1.54, 1.39], [0.016, 0.112, 0.112]);
    ell(
      "headset inset center",
      mat.light,
      [-0.707, 1.54, 1.39],
      [0.008, 0.055, 0.055],
    );
    const band = Array.from({ length: 25 }, (_, i) => {
      const t = -1.42 + (i / 24) * 2.67;
      return [0.546 * Math.sin(t), 1.48 + 0.482 * Math.cos(t) + 0.028, 1.22];
    });
    tube("fitted headset band", band, 0.026, mat.dark);
  }
  if (idx === 2 || idx === 3) {
    const x = -0.72,
      z = 0.8;
    ring(
      "wrist terminal strap",
      [x, 0.4, z],
      0.26,
      0.043,
      mat.dark,
      [Math.PI / 2, 0, 0],
      [1, 1.08, 1],
    );
    const b = mesh(
      "wrist terminal case",
      new THREE.BoxGeometry(0.31, 0.26, 0.11, 1, 1, 1),
      mat.dark,
      [x, 0.4, z + 0.288],
    );
    const screen = mesh(
      "teal wrist display",
      new THREE.BoxGeometry(0.235, 0.172, 0.012),
      mat.screen,
      [x, 0.4, z + 0.35],
    );
    tube(
      "wrist display bars",
      [
        [x - 0.075, 0.435, z + 0.36],
        [x + 0.06, 0.435, z + 0.36],
      ],
      0.013,
      mat.light,
    );
    tube(
      "wrist display bar",
      [
        [x - 0.07, 0.378, z + 0.36],
        [x + 0.025, 0.378, z + 0.36],
      ],
      0.01,
      mat.light,
    );
  }
  if (idx === 5) {
    const p = [-0.4, 0.895, 1.07];
    ell("navigation compass dark bezel", mat.dark, p, [0.12, 0.12, 0.055]);
    ring(
      "compass fine rim",
      [p[0], p[1], p[2] + 0.05],
      0.092,
      0.012,
      mat.map,
      [0, 0, 0],
    );
    const star = new THREE.Shape();
    [
      [0, 0.061],
      [0.016, 0.018],
      [0.054, 0],
      [0.016, -0.018],
      [0, -0.061],
      [-0.016, -0.018],
      [-0.054, 0],
      [-0.016, 0.018],
    ].forEach(([x, y], i) => (i ? star.lineTo(x, y) : star.moveTo(x, y)));
    star.closePath();
    mesh(
      "four-point compass star",
      new THREE.ExtrudeGeometry(star, {
        depth: 0.006,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.002,
        bevelThickness: 0.002,
      }),
      mat.map,
      [p[0], p[1], p[2] + 0.057],
    );
  }
}
function make(idx, look) {
  root = new THREE.Group();
  root.name = "Turtleand " + versions[idx] + " Sculpted Warmth";
  root.userData = {
    avatarId: JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, "../../src/data/avatarVersions.json"),
      ),
    )[idx].id,
    avatarVersion: "v" + versions[idx],
    direction: "Sculpted Warmth",
  };
  const sk = idx === 0 ? look.young : look.skin;
  mat = {
    skin: material(sk, look.rough + 0.1, 0, {
      clearcoat: look.coat * 0.4,
      specularIntensity: 0.4,
    }),
    shell: material(look.shell, 0.62),
    edge: material(look.plate, 0.5),
    belly: material(look.belly, 0.65),
    spot: material(new THREE.Color(sk).multiplyScalar(0.62), 0.8),
    nail: material("#ccae58", 0.5),
    sclera: material("#c7c7aa", .57, 0, {specularIntensity:.23}),
    iris: material("#ffffff", .28, 0, {vertexColors:true, specularIntensity:.35, clearcoat:.18, clearcoatRoughness:.25}),
    pupil: material("#1a2117", .24, 0, {specularIntensity:.35, clearcoat:.18, clearcoatRoughness:.25}),
    white: material("#dfdac8", .6, 0, {specularIntensity:0}),
    mouth: material("#4b482c", .8),
    metal: material(look.metal, 0.33, 0.62),
    chrome: material("#c7d8cd", 0.19, 0.86),
    dark: material("#21382f", 0.51, 0.18),
    light: material(idx === 1 ? "#70d477" : "#33dcc5", 0.26, 0.18, {
      emissive: idx === 1 ? "#45d05b" : "#19cbb2",
      emissiveIntensity: look.emission,
    }),
    map: material("#9fe6d9", 0.3, 0.26, {
      emissive: "#49c6b8",
      emissiveIntensity: 0.68,
    }),
    screen: material("#073b36", 0.22, 0.15),
  };
  mat.underlight =
    idx === 1
      ? material("#39d9c5", 0.32, 0.12, {
          emissive: "#1acbb7",
          emissiveIntensity: 0.32,
        })
      : mat.light;
  ell("body underside", mat.belly, [0, 0.53, -0.015], [0.89, 0.42, 1.09]);
  for (let i = -2; i <= 2; i++) {
    const z = i * 0.31;
    const y = 0.279 + Math.abs(i) * 0.03;
    tube(
      "plastron segment",
      [
        [-0.57, y + 0.08, z],
        [0, y, z + 0.03],
        [0.57, y + 0.08, z],
      ],
      0.01,
      mat.edge,
    );
  }
  for (const s of [-1, 1]) {
    limb(s * 0.7, -0.76, idx, false);
    limb(s * 0.72, 0.8, idx, true);
  }
  rod(
    "tapered tail base",
    [0, 0.43, -0.98],
    [0.015, 0.36, -1.28],
    0.083,
    mat.skin,
    0.05,
  );
  rod(
    "closed tail tip",
    [0.015, 0.36, -1.28],
    [0.09, 0.34, -1.47],
    0.05,
    mat.skin,
    0.001,
  );
  shell(idx, look);
  face(idx);
  accessories(idx);
  root.updateMatrixWorld(true);
  return root;
}
(async () => {
  const { GLTFExporter } = await import(
    pathToFileURL(require.resolve("three/addons/exporters/GLTFExporter.js"))
      .href
  );
  const { MarchingCubes } = await import(
    pathToFileURL(require.resolve("three/addons/objects/MarchingCubes.js")).href
  );
  const size = 68,
    mc = new MarchingCubes(
      size,
      new THREE.MeshBasicMaterial(),
      false,
      false,
      65000,
    );
  mc.isolation = 0;
  const lo = [-0.74, 0.49, 0.48],
    hi = [0.74, 2.09, 2.12];
  function sdf(p, c, r) {
    const a = p.map((v, i) => (v - c[i]) / r[i]);
    const k0 = Math.hypot(...a),
      k1 = Math.hypot(...a.map((v, i) => v / r[i]));
    return (k0 * (k0 - 1)) / Math.max(k1, 0.0001);
  }
  function smin(a, b, k) {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - h * h * k * 0.25;
  }
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const p = [x, y, z].map((v, i) => lo[i] + (v / size) * (hi[i] - lo[i]));
        let d = sdf(p, [0, 1.48, 1.36], [0.555, 0.505, 0.48]);
        d = smin(d, sdf(p, [0, 1.255, 1.63], [0.49, 0.285, 0.355]), 0.125);
        d = smin(d, sdf(p, [0, 0.99, 0.99], [0.35, 0.45, 0.39]), 0.14);
        mc.field[z * size * size + y * size + x] = -d;
      }
  mc.update();
  headGeometry = new THREE.BufferGeometry();
  const pa = mc.geometry.attributes.position.array.slice(0, mc.count * 3);
  for (let j = 0; j < pa.length; j += 3)
    for (let k = 0; k < 3; k++)
      pa[j + k] = lo[k] + (pa[j + k] + 1) * 0.5 * (hi[k] - lo[k]);
  headGeometry.setAttribute("position", new THREE.BufferAttribute(pa, 3));
  const na = mc.geometry.attributes.normal.array.slice(0, mc.count * 3);
  for (let j = 0; j < na.length; j += 3) {
    const n = new V(
      na[j] / (hi[0] - lo[0]),
      na[j + 1] / (hi[1] - lo[1]),
      na[j + 2] / (hi[2] - lo[2]),
    ).normalize();
    na[j] = n.x;
    na[j + 1] = n.y;
    na[j + 2] = n.z;
  }
  headGeometry.setAttribute("normal", new THREE.BufferAttribute(na, 3));
  const { mergeVertices } = await import(
    pathToFileURL(require.resolve("three/addons/utils/BufferGeometryUtils.js"))
      .href
  );
  headGeometry = mergeVertices(headGeometry, 1e-5);
  const { mergeGeometries } = await import(
    pathToFileURL(require.resolve("three/addons/utils/BufferGeometryUtils.js"))
      .href
  );
  fs.mkdirSync(out, { recursive: true });
  const inventory = [];
  for (const [name, look] of Object.entries(looks)) {
    for (let i = 0; i < versions.length; i++) {
      const authored = make(i, look),
        group = new THREE.Group();
      group.name = authored.name;
      group.userData = authored.userData;
      const batches = new Map();
      authored.traverse((o) => {
        if (!o.isMesh) return;
        let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        for (const a of Object.keys(g.attributes))
          if (a !== "position" && a !== "normal" && a !== "color") g.deleteAttribute(a);
        if (g.index) g = g.toNonIndexed();
        if (!batches.has(o.material)) batches.set(o.material, []);
        batches.get(o.material).push(g);
      });
      for (const [material, geometries] of batches) {
        const geometry = mergeVertices(
          mergeGeometries(geometries, false),
          1e-5,
        );
        const part = new THREE.Mesh(geometry, material);
        part.name = material.name || "Sculpted Warmth surface";
        group.add(part);
      }
      let tris = 0,
        meshes = 0;
      group.traverse((o) => {
        if (o.isMesh) {
          meshes++;
          tris +=
            (o.geometry.index?.count || o.geometry.attributes.position.count) /
            3;
        }
      });
      const buf = await new GLTFExporter().parseAsync(group, {
        binary: true,
        onlyVisible: true,
      });
      const filename = "turtleand-" + versions[i] + ".glb";
      fs.writeFileSync(path.join(out, filename), Buffer.from(buf));
      inventory.push({
        look: name,
        version: versions[i],
        file: filename,
        bytes: buf.byteLength,
        triangles: tris,
        meshes,
      });
      console.log(filename, buf.byteLength, tris);
    }
  }
  fs.writeFileSync(
    path.resolve(__dirname, "inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );
})();
