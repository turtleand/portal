const THREE = require("three");
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

// The atlas uses distance from the crown as latitude. This leaves room to
// model the tall side scutes and their inlays all the way down to the lip.
const scuteSites = [
  { x: 0, z: -.67, motif: "end" },
  { x: 0, z: -.26, motif: "crown" },
  { x: 0, z: .18, motif: "crown" },
  { x: 0, z: .59, motif: "end" },
  ...[-1, 1].flatMap((side) => [
    { x: side * .41, z: -.63, motif: "loop" },
    { x: side * .55, z: -.37, motif: "step" },
    { x: side * .73, z: -.09, motif: "loop" },
    { x: side * .58, z: .405, motif: "flank" },
    { x: side * .37, z: .8, motif: "front" },
  ]),
];

const motifs = {
  flank: [
    [[-.74, -.88], [-.74, -.48], [-.96, -.48], [-.96, -.07], [-.68, -.04], [-.68, .46], [-.4, .46], [-.39, .85], [-.04, .88], [-.04, .58], [.28, .59], [.28, .37], [.63, .37], [.63, .02], [.4, -.1], [.37, -.84]],
    [[-.49, -.9], [-.49, .21], [.19, .21], [.19, -.1], [-.095, -.24], [-.095, -.91]],
    [[-.7, -.26], [-.49, -.26]],
    [[-.28, -.89], [-.28, -.17], [-.05, -.12]],
  ],
  front: [
    [[-.88, -.56], [-.48, -.56], [-.48, .52], [.55, .54]],
    [[-.48, -.34], [.07, -.34], [.07, .12], [.48, .15], [.48, .3]],
  ],
  step: [[[-.72, -.62], [-.28, -.62], [-.28, -.12], [.39, -.12], [.39, .68], [.7, .68]]],
  loop: [[[-.57, -.54], [-.57, .58], [.46, .58], [.46, -.23], [.16, -.23], [.16, -.54], [-.57, -.54]]],
  crown: [
    [[-.62, -.66], [-.63, .67], [.43, .67], [.43, -.15], [.71, -.15]],
    [[-.61, -.29], [.1, -.29], [.1, .23]],
  ],
  end: [[[-.68, -.38], [0, -.38], [0, .52], [.65, .52]]],
};

function clipCell(polygon, nx, nz, distance) {
  const vertices = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const ad = a[0] * nx + a[1] * nz - distance;
    const bd = b[0] * nx + b[1] * nz - distance;
    if (ad <= 0) vertices.push(a);
    if ((ad < 0) !== (bd < 0)) vertices.push(mix(a, b, ad / (ad - bd)));
  }
  return vertices;
}

function polygonCenter(polygon) {
  let area = 0, x = 0, z = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const cross = a[0] * b[1] - a[1] * b[0];
    area += cross;
    x += (a[0] + b[0]) * cross;
    z += (a[1] + b[1]) * cross;
  }
  return [x / (3 * area), z / (3 * area)];
}

function roundedBorder(polygon, center, carved) {
  const rim = polygon.map((point) => mix(point, center, carved ? .061 : .043));
  return rim.flatMap((p, i) => {
    const prev = rim[(i + rim.length - 1) % rim.length];
    const next = rim[(i + 1) % rim.length];
    const rounding = Math.min(.16, .031 / Math.max(.001, Math.hypot(next[0] - p[0], next[1] - p[1])));
    return [mix(p, prev, rounding), mix(p, next, rounding), mix(p, next, .5)];
  });
}

function cellRadius(center, polygon, x, z) {
  const dx = x - center[0], dz = z - center[1];
  let scale = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const nx = b[1] - a[1], nz = a[0] - b[0];
    const wall = (a[0] - center[0]) * nx + (a[1] - center[1]) * nz;
    scale = Math.max(scale, (dx * nx + dz * nz) / wall);
  }
  return scale;
}

function shellShape(look) {
  const width = look.carved ? 1.13 : 1.084;
  const length = look.carved ? 1.25 : 1.236;
  const height = look.carved ? .946 : look.organic ? 1.058 : 1.018;
  const originY = .825, originZ = -.115;
  function sample(x, z) {
    const radius = Math.hypot(x, z);
    const angle = clamp(radius, 0, 1) * Math.PI / 2;
    const horizontal = radius > 1e-6 ? Math.sin(angle) / radius : Math.PI / 2;
    const y = Math.cos(angle);
    return {
      point: new THREE.Vector3(width * x * horizontal, originY + height * y, originZ + length * z * horizontal),
      normal: new THREE.Vector3(x * horizontal / width, y / height, z * horizontal / length).normalize(),
    };
  }
  return { width, length, height, originY, originZ, sample };
}

function surfaceGeometry(positions, indices, colors) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (colors) geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function grid(columns, rows, sample, paint) {
  const positions = [], indices = [], colors = paint ? [] : undefined;
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= columns; x++) {
      const u = x / columns, v = y / rows;
      positions.push(...sample(u, v).toArray());
      if (paint) colors.push(...paint(u, v));
      if (y === 0 || x === 0) continue;
      const d = y * (columns + 1) + x, c = d - 1, b = d - columns - 1, a = b - 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return surfaceGeometry(positions, indices, colors);
}

const profile = [[0, .027], [.18, .033], [.36, .039], [.54, .043], [.68, .044], [.79, .043], [.875, .038], [.93, .028], [.974, .014], [1, -.005]];
function relief(t, look) {
  if (t > 1) return 0;
  const hi = profile.findIndex(([fraction]) => fraction >= t);
  const a = profile[Math.max(0, hi - 1)], b = profile[hi];
  const lift = hi === 0 ? b[1] : lerp(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
  return lift * (look.carved ? 1.72 : look.organic ? 1.11 : 1.28);
}

function addScute(art, shape, border, center, look, index) {
  const positions = [], colors = [], indices = [];
  const n = border.length;
  const tone = .955 + .043 * Math.cos(index * 2.42);
  const textured = look.organic ? .98 : look.carved ? .29 : .11;
  const variability = look.organic ? .0043 : look.carved ? .00075 : .00023;
  function vertex(x, z, t) {
    const { point, normal } = shape.sample(x, z);
    // Irregular radial growth follows the perimeter of each curved scute.
    // The pattern in relief and pigment fades into the rounded edge.
    const angle = Math.atan2(z - center[1], x - center[0]);
    const phase = t * (30 + index % 4 * 2) + .68 * Math.sin(angle * 3 + index) + .26 * Math.sin(angle * 7);
    const grain = (.59 * Math.sin(phase) + .41 * Math.cos(phase * .61 + index)) * Math.sin(t * Math.PI);
    point.addScaledVector(normal, relief(t, look) + variability * grain);
    positions.push(...point.toArray());
    const bevel = Math.exp(-((t - .9) ** 2) * 185);
    const rim = clamp((t - .89) / .11, 0, 1);
    const warm = bevel * (look.carved ? .129 : .062);
    const depth = (1 - .19 * rim) * tone * (.96 + .04 * normal.y) + textured * grain * .15;
    colors.push(depth + warm, depth + warm * .7, depth * .963 + warm * .32);
  }
  vertex(...center, 0);
  for (const [t] of profile.slice(1)) {
    for (const point of border) vertex(...mix(center, point, t), t);
  }
  for (let i = 0; i < n; i++) indices.push(0, 1 + (i + 1) % n, 1 + i);
  for (let j = 1; j < profile.length - 1; j++) {
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      const a = 1 + (j - 1) * n + i, b = 1 + (j - 1) * n + k;
      const c = 1 + j * n + i, d = 1 + j * n + k;
      indices.push(a, b, c, b, d, c);
    }
  }
  art.mesh("beveled shell scute " + index, surfaceGeometry(positions, indices, colors), art.mat.plate);
}

// A narrow surface ribbon maintains sharp, flush circuit corners through orbit.
// It rounds only the scute edge around the inlay, rather than presenting a wire.
function ribbon(art, name, samples, project, width, material, offset) {
  const points = samples.map(([u, v]) => {
    const { point, normal } = project(u, v);
    return { point: point.addScaledVector(normal, offset), normal };
  });
  const positions = [], normals = [], indices = [];
  for (let i = 0; i < points.length; i++) {
    const { point, normal } = points[i];
    const previous = points[Math.max(0, i - 1)].point;
    const next = points[Math.min(points.length - 1, i + 1)].point;
    const past = new THREE.Vector3().subVectors(point, previous);
    const future = new THREE.Vector3().subVectors(next, point);
    if (i === 0) past.copy(future);
    if (i === points.length - 1) future.copy(past);
    const sideA = new THREE.Vector3().crossVectors(normal, past).normalize();
    const sideB = new THREE.Vector3().crossVectors(normal, future).normalize();
    const side = sideA.add(sideB).normalize().multiplyScalar(width / Math.max(.64, sideA.clone().normalize().dot(sideB)));
    positions.push(...point.clone().add(side).toArray(), ...point.clone().sub(side).toArray());
    normals.push(...normal.toArray(), ...normal.toArray());
    if (i === 0) continue;
    const a = 2 * (i - 1), b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, b, c, b, d, c);
  }
  const geometry = surfaceGeometry(positions, indices);
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  art.mesh(name, geometry, material);
}

function stepSamples(points, density = 30) {
  const samples = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const count = Math.max(1, Math.ceil(density * Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let j = 1; j <= count; j++) samples.push(mix(a, b, j / count));
  }
  return samples;
}

function inlay(art, shape, cell, look, idx) {
  const { site, center, border } = cell;
  const [cx, cz] = center;
  const radial = Math.hypot(cx, cz);
  const up = [-cx / radial, -cz / radial];
  const across = [-up[1], up[0]];
  const offsets = border.map(([x, z]) => [x - cx, z - cz]);
  const extent = (axis) => {
    const projections = offsets.map((v) => v[0] * axis[0] + v[1] * axis[1]);
    return Math.min(Math.max(...projections), -Math.min(...projections));
  };
  const horizontal = extent(across), vertical = extent(up);
  const project = (x, z) => {
    const { point, normal } = shape.sample(x, z);
    point.addScaledVector(normal, relief(cellRadius(center, border, x, z), look));
    return { point, normal };
  };
  for (const path of motifs[site.motif]) {
    const curve = path.map(([u, v]) => [
      cx + u * horizontal * across[0] + v * vertical * up[0],
      cz + u * horizontal * across[1] + v * vertical * up[1],
    ]);
    const maximum = Math.max(...curve.map(([x, z]) => cellRadius(center, border, x, z)));
    const contour = curve.map((point) => mix(center, point, Math.min(1, .88 / maximum)));
    const samples = stepSamples(contour);
    const width = (idx === 1 ? .009 : site.motif === "flank" ? .0145 : .011) * (look.carved ? 1.1 : 1);
    ribbon(art, "groove around shell circuit", samples, project, width * 1.36, art.mat.shell, .007);
    ribbon(art, "angular shell circuit", samples, project, width, art.mat.light, .0096);
  }
}

const rimCrossSection = [
  [.945, .923], [.982, .9], [1.037, .852], [1.092, .801],
  [1.112, .776], [1.109, .754], [1.083, .727], [1.017, .713], [.956, .729],
];
function rimPoint(shape, angle, t, backing = false) {
  const at = t * (rimCrossSection.length - 1);
  const i = Math.min(rimCrossSection.length - 2, Math.floor(at));
  const [r, y] = mix(rimCrossSection[i], rimCrossSection[i + 1], at - i);
  const lift = .037 * Math.pow(Math.max(0, Math.sin(angle)), 2);
  const inset = backing ? .008 : 0;
  return new THREE.Vector3(
    Math.cos(angle) * (r - inset) * shape.width,
    y + lift - inset,
    shape.originZ + Math.sin(angle) * (r - inset) * shape.length,
  );
}

function addRim(art, shape, look, idx) {
  const count = look.carved ? 20 : 22, arc = TAU / count;
  art.mesh("base of marginal scutes", grid(44, 8, (u, v) => rimPoint(shape, TAU * u, v, true)), art.mat.shell);
  for (let i = 0; i < count; i++) {
    const middle = (i + .5) * arc;
    const point = (u, v) => {
      const angle = middle + (u - .5) * arc * .957;
      const p = rimPoint(shape, angle, v);
      const roundedEnds = Math.pow(2 * Math.abs(u - .5), 10) * Math.sin(Math.PI * v) * .006;
      return p.addScaledVector(new THREE.Vector3(Math.cos(angle), .38, Math.sin(angle)), -roundedEnds);
    };
    const tone = .94 + Math.sin(i * 2.17) * .048;
    art.mesh("flared marginal scute", grid(6, 8, point, (u, v) => {
      const edge = .07 * Math.pow(Math.abs(u - .5) * 2, 4);
      const polish = .08 * Math.exp(-((v - .48) ** 2) * 70);
      const grain = (look.organic ? .028 : .008) * Math.sin(u * 9 + v * 24 + i * 2.3);
      const color = tone - edge - .17 * v + grain;
      return [color + polish, color + polish * .57, color * .945];
    }), art.mat.plate);
    if (idx < 3 || Math.abs(Math.cos(middle)) < .91 || i % 3 === 0) continue;
    const project = (u, v) => {
      const angle = middle + (u - .5) * arc * .957;
      return {
        point: point(u, v),
        normal: new THREE.Vector3(Math.cos(angle), .55, Math.sin(angle)).normalize(),
      };
    };
    const marks = idx === 3 ? [[.28, .34], [.7, .34], [.7, .57], [.28, .57], [.28, .34]]
      : [[.21, .46], [.79, .46]];
    ribbon(art, "rim status inlay", stepSamples(marks, 12), project, idx === 3 ? .005 : .008, art.mat.light, .0045);
  }
}

function addSubshell(art, shape, idx) {
  const quantum = idx === 1;
  const traces = quantum ? [
    [[.1, .48], [.9, .48]], [[.28, .24], [.28, .78]],
    [[.62, .48], [.62, .78]], [[.76, .24], [.76, .48]],
  ] : [
    [[.22, .09], [.22, .39], [.37, .44], [.37, .86]],
    [[.09, .45], [.2, .78], [.43, .85], [.64, .85]],
    [[.62, .12], [.72, .37], [.63, .55], [.8, .81]],
  ];
  for (const side of [0, Math.PI]) {
    const sample = (u, v) => {
      const angle = side + (u - .5) * (1.36 - .23 * v);
      const perimeter = .091 * (2 * u - 1) ** 8 + .036 * v ** 12;
      const radius = 1.014 - .25 * v ** 1.64 - perimeter;
      const y = .777 - .464 * v + .075 * (2 * u - 1) ** 2 * v;
      return new THREE.Vector3(
        Math.cos(angle) * radius * shape.width,
        y,
        shape.originZ + Math.sin(angle) * radius * shape.length,
      );
    };
    const project = (u, v) => {
      const point = sample(u, v);
      const tangent = sample(u + .001, v).sub(point);
      const normal = tangent.cross(sample(u, v + .001).sub(point)).normalize();
      return { point, normal };
    };
    art.mesh("curved cyan subshell panel", grid(22, 12, sample), art.mat.screen);
    for (const path of traces)
      ribbon(art, "subshell panel routing", stepSamples(path, 18), project, quantum ? .014 : .018, art.mat.underlight, .005);
    for (const u of [.315, .679])
      ribbon(art, "subshell panel seam", stepSamples([[u, .045], [u, .93]], 15), project, .005, art.mat.shell, .002);
  }
}

function addMap(art, shape, cells, look) {
  const routes = [
    [[-.87, -.35], [-.7, -.38], [-.62, -.27], [-.47, -.28], [-.34, -.17], [-.27, -.02], [-.09, .09], [.09, .03], [.2, .12], [.43, .19], [.63, .37]],
    [[-.85, .35], [-.73, .29], [-.62, .31], [-.54, .13], [-.39, .12], [-.27, -.02], [-.19, -.32], [-.08, -.46], [.16, -.52], [.34, -.36], [.61, -.44]],
    [[-.62, -.27], [-.59, -.03], [-.51, .03], [-.54, .13], [-.46, .37], [-.25, .49], [-.08, .44], [.02, .57], [.26, .65], [.44, .51]],
    [[-.52, -.64], [-.4, -.52], [-.19, -.32], [-.01, -.23], [.09, .03]],
    [[.2, .12], [.19, .36], [.32, .43], [.26, .65]],
  ];
  const project = (x, z) => {
    const { point, normal } = shape.sample(x, z);
    const radii = cells.map(({ center, border }) => cellRadius(center, border, x, z));
    point.addScaledVector(normal, relief(Math.min(...radii), look));
    return { point, normal };
  };
  for (const route of routes)
    ribbon(art, "fine cartographic routes", stepSamples(route, 48), project, .0034, art.mat.map, .012);
  const waypoints = [[-.7, -.38], [-.62, -.27], [-.54, .13], [-.46, .37], [-.27, -.02], [-.19, -.32], [-.08, -.46], [-.08, .44], [.09, .03], [.34, -.36], [.44, .51], [.63, .37]];
  for (const [i, [x, z]] of waypoints.entries()) {
    const { point, normal } = project(x, z);
    point.addScaledVector(normal, .014);
    const waypoint = art.mesh("cartographic waypoint", new THREE.CircleGeometry(i % 3 === 0 ? .017 : .012, 10), art.mat.map, point.toArray());
    waypoint.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }
}

function addShell(art, idx, look) {
  const shape = shellShape(look);
  art.mesh("carapace recessed core",
    new THREE.SphereGeometry(1, 48, 19, 0, TAU, 0, Math.PI / 2),
    art.mat.shell, [0, shape.originY - .01, shape.originZ], [shape.width, shape.height, shape.length]);
  art.mesh("marginal scute backing below the dome",
    new THREE.SphereGeometry(1, 30, 10, 0, TAU, Math.PI / 2, Math.PI / 2),
    art.mat.shell, [0, .813, shape.originZ], [shape.width * 1.006, .213, shape.length * 1.006]);
  const outline = Array.from({ length: 56 }, (_, i) => [Math.cos(i / 56 * TAU), Math.sin(i / 56 * TAU)]);
  const cells = scuteSites.map((site, i) => {
    let polygon = outline;
    for (const other of scuteSites) {
      if (other === site) continue;
      const nx = other.x - site.x, nz = other.z - site.z;
      const distance = (other.x ** 2 + other.z ** 2 - site.x ** 2 - site.z ** 2) / 2;
      polygon = clipCell(polygon, nx, nz, distance);
    }
    const center = polygonCenter(polygon);
    const border = roundedBorder(polygon, center, look.carved);
    addScute(art, shape, border, center, look, i);
    return { site, center, border };
  });
  addRim(art, shape, look, idx);
  if (idx === 0) return;
  for (const cell of cells) inlay(art, shape, cell, look, idx);
  addSubshell(art, shape, idx);
  if (idx === 5) addMap(art, shape, cells, look);
}

module.exports = { addShell };
