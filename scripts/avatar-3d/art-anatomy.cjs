const THREE = require("three");

const Vector = THREE.Vector3;
const tau = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;

function skinProfile(position, normal, look, skin, ochre, brow) {
  const lengthwise = smooth(position.z, 1.08, 1.59);
  const muzzleEdge = 1.39 + .105 * Math.exp(-((position.x / .18) ** 2));
  const muzzle = lengthwise * (1 - smooth(position.y - muzzleEdge, -.043, .036));
  const facing = smooth(normal.z, -.36, .37);
  const pigment = skin.clone().lerp(ochre, muzzle * facing);
  if (brow) {
    const crown = smooth(position.y, 1.49, 1.72) * smooth(position.z, 1.29, 1.66);
    pigment.lerp(brow, crown);
  }
  const jawShade = 1 - .11 * smooth(-normal.y, .1, .96);
  const mottling = Math.sin(21 * position.x + 11 * position.y) *
    Math.sin(17 * position.z - 12 * position.y);
  return pigment.multiplyScalar(jawShade * (.987 + look.grain * .05 * mottling));
}

function headShape(look) {
  const components = [
    { center: [0, 1.49, 1.32], size: [.554, .412, .468] },
    { center: [0, 1.298, 1.614], size: [.557, .263, .333] },
    { center: [0, 1.018, 1.028], size: [.388, .334, .399] },
  ];
  if (look.organic) {
    components[1].size[0] += .015;
    components[2].size[0] += .014;
  }
  const brow = [-1, 1].map(side => ({
    center: [side * .295, 1.725, 1.506], size: [.245, .172, .214],
  }));
  function ellipsoid(point, { center, size }) {
    const x = (point.x - center[0]) / size[0];
    const y = (point.y - center[1]) / size[1];
    const z = (point.z - center[2]) / size[2];
    return Math.hypot(x, y, z) * (Math.hypot(x, y, z) - 1) /
      Math.max(.0001, Math.hypot(x / size[0], y / size[1], z / size[2]));
  }
  function union(first, second, blend) {
    const overlap = Math.max(blend - Math.abs(first - second), 0) / blend;
    return Math.min(first, second) - blend * overlap * overlap * .25;
  }
  function distance(point) {
    const forehead = union(ellipsoid(point, components[0]), ellipsoid(point, brow[0]), .074);
    const skull = union(forehead, ellipsoid(point, brow[1]), .074);
    const face = union(skull, ellipsoid(point, components[1]), .14);
    return union(face, ellipsoid(point, components[2]), .18);
  }

  function normal(p) {
    const e = .002;
    return new Vector(
      distance(new Vector(p.x + e, p.y, p.z)) - distance(new Vector(p.x - e, p.y, p.z)),
      distance(new Vector(p.x, p.y + e, p.z)) - distance(new Vector(p.x, p.y - e, p.z)),
      distance(new Vector(p.x, p.y, p.z + e)) - distance(new Vector(p.x, p.y, p.z - e)),
    ).normalize();
  }

  // Trace from outside the head along the local outward direction. Each lid,
  // cheek mark and accessory attaches to the same surface that we polygonize.
  function surface(origin, outward) {
    let outside = 1.35;
    let inside = outside;
    for (; inside > -.55; inside -= .025) {
      if (distance(origin.clone().addScaledVector(outward, inside)) < 0) break;
      outside = inside;
    }
    if (inside <= -.55) return origin.clone();
    for (let i = 0; i < 12; i++) {
      const mid = (inside + outside) * .5;
      if (distance(origin.clone().addScaledVector(outward, mid)) < 0) inside = mid;
      else outside = mid;
    }
    return origin.clone().addScaledVector(outward, (inside + outside) * .5);
  }

  return { distance, normal, surface };
}

function paintSkin(geometry, look, contact = []) {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const colors = [];
  const skin = new THREE.Color(look.skin);
  const muzzle = new THREE.Color(look.muzzle);
  const brow = look.brow ? new THREE.Color(look.brow) : null;
  for (let i = 0; i < positions.count; i++) {
    const p = new Vector().fromBufferAttribute(positions, i);
    const n = new Vector().fromBufferAttribute(normals, i);
    const pigment = skinProfile(p, n, look, skin, muzzle, brow).multiplyScalar(1 - (contact[i] ?? 0));
    colors.push(pigment.r, pigment.g, pigment.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function headMesh(shape, MarchingCubes, mergeVertices, look) {
  const resolution = 46;
  const bounds = new Vector(1.47, 1.53, 1.73);
  const minimum = new Vector(-.735, .485, .39);
  const model = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, 30000);
  model.isolation = 0;
  for (let z = 0; z < resolution; z++) {
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const point = new Vector(x, y, z).divideScalar(resolution).multiply(bounds).add(minimum);
        model.field[(z * resolution + y) * resolution + x] = -shape.distance(point);
      }
    }
  }
  model.update();
  const positions = model.geometry.attributes.position.array.slice(0, model.count * 3);
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const point = new Vector().fromArray(positions, i).addScalar(1)
      .multiplyScalar(.5).multiply(bounds).add(minimum);
    point.toArray(positions, i);
    shape.normal(point).toArray(normals, i);
  }
  model.geometry.dispose();
  model.material.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return paintSkin(mergeVertices(geometry, .00001), look);
}

function ellipse(cx, cy, rx, ry, count = 32) {
  return Array.from({ length: count }, (_, i) => {
    const angle = i / count * tau;
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)];
  });
}

function facePatch(contour, project, outward, rings = 6) {
  const size = contour.length;
  const center = contour.reduce(([x, y], p) => [x + p[0] / size, y + p[1] / size], [0, 0]);
  const positions = project(...center).toArray();
  const indices = [];
  for (let i = 1; i <= rings; i++) {
    for (const [x, y] of contour) {
      positions.push(...project(
        THREE.MathUtils.lerp(center[0], x, i / rings),
        THREE.MathUtils.lerp(center[1], y, i / rings),
      ).toArray());
    }
  }
  for (let j = 0; j < size; j++) {
    const next = (j + 1) % size;
    indices.push(0, 1 + j, 1 + next);
    for (let r = 1; r < rings; r++) {
      const a = 1 + (r - 1) * size + j;
      const b = 1 + (r - 1) * size + next;
      indices.push(a, a + size, b, b, a + size, b + size);
    }
  }
  return surfaceGeometry(positions, indices, outward);
}

function surfaceGeometry(positions, indices, outward) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const n = new Vector().fromBufferAttribute(geometry.attributes.normal, 0);
  if (n.dot(outward) < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  }
  return geometry;
}

function insetCircle(radius, x, y, aperture) {
  let points = ellipse(x, y, radius, radius, 40);
  for (let i = 0; i < aperture.length; i++) {
    const [fx, fy] = aperture[i];
    const [tx, ty] = aperture[(i + 1) % aperture.length];
    const side = point => (tx - fx) * (point[1] - fy) - (ty - fy) * (point[0] - fx);
    const next = [];
    for (let j = 0; j < points.length; j++) {
      const before = points[j], after = points[(j + 1) % points.length];
      const a = side(before), b = side(after);
      if (a >= 0) next.push(before);
      if ((a >= 0) !== (b >= 0)) {
        const t = a / (a - b);
        next.push([THREE.MathUtils.lerp(before[0], after[0], t), THREE.MathUtils.lerp(before[1], after[1], t)]);
      }
    }
    points = next;
  }
  return points;
}

function taperedSeam(points, width) {
  const curve = new THREE.CatmullRomCurve3(points);
  const longitudinal = 56, sides = 6;
  const geometry = new THREE.TubeGeometry(curve, longitudinal, width, sides, false);
  const positions = geometry.attributes.position;
  for (let i = 0; i <= longitudinal; i++) {
    const t = i / longitudinal;
    const center = curve.getPointAt(t);
    const taper = .15 + .85 * Math.pow(Math.sin(t * Math.PI), .55);
    for (let j = 0; j <= sides; j++) {
      const vertex = i * (sides + 1) + j;
      const p = new Vector().fromBufferAttribute(positions, vertex).lerp(center, 1 - taper);
      positions.setXYZ(vertex, p.x, p.y, p.z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function face(art, shape, geometry, look, index) {
  const { mesh, mat, root, rigParts } = art;
  mesh("sculpted cheeks, muzzle and throat", geometry, mat.headSkin);
  for (const sign of [-1, 1]) {
    const angle = sign * .53;
    const center = new Vector(sign * .309, 1.615, 1.56);
    const outward = new Vector(Math.sin(angle), 0, Math.cos(angle));
    const tangent = new Vector(Math.cos(angle), 0, -Math.sin(angle));
    const project = (x, y, offset = 0) => {
      const target = center.clone().addScaledVector(tangent, x);
      target.y += y;
      return shape.surface(target, outward).addScaledVector(outward, offset);
    };
    const width = .190;
    const aperture = Array.from({ length: 48 }, (_, i) => {
      const a = i / 48 * tau;
      const x = Math.cos(a);
      const height = Math.sin(a) >= 0 ? (index === 0 ? .116 : .109) : .140;
      return [width * x, height * Math.sin(a) + sign * x * .009];
    });
    const eyePoint = (depth = 0) => (x, y) => {
      const inset = .018 * clamp(1 - (x / width) ** 2 - (y / .143) ** 2, 0, 1);
      return project(x, y, .009 + inset + depth);
    };
    const eyeStart = root.children.length;
    mesh("warm ivory eye", facePatch(aperture, eyePoint(), outward), mat.sclera);
    const gazeX = sign * -.023;
    const gazeY = -.011;
    const irisRadius = index === 0 ? .143 : .150;
    const iris = facePatch(insetCircle(irisRadius, gazeX, gazeY, aperture), eyePoint(.005), outward, 7);
    const irisColors = [];
    const nearGold = new THREE.Color(index === 0 ? "#896130" : "#4d5330");
    const outer = new THREE.Color(index === 0 ? "#322319" : "#1b291e");
    const irisPositions = iris.attributes.position;
    for (let i = 0; i < irisPositions.count; i++) {
      const point = new Vector().fromBufferAttribute(irisPositions, i).sub(center);
      const x = point.dot(tangent) - gazeX, y = point.y - gazeY;
      const radius = clamp(Math.hypot(x, y) / irisRadius, 0, 1);
      const fiber = .97 + .055 * Math.sin(33 * Math.atan2(y, x)) * Math.sin(radius * Math.PI);
      const pigment = nearGold.clone().lerp(outer, smooth(radius, .55, 1)).multiplyScalar(fiber);
      irisColors.push(pigment.r, pigment.g, pigment.b);
    }
    iris.setAttribute("color", new THREE.Float32BufferAttribute(irisColors, 3));
    mesh("radial iris", iris, mat.iris);
    mesh("deep pupil", facePatch(insetCircle(.086, gazeX, gazeY, aperture), eyePoint(.009), outward), mat.pupil);
    mesh("quiet catchlight", facePatch(ellipse(gazeX - .025, gazeY + .039, .013, .011, 16), eyePoint(.012), outward, 2), mat.white);
    const blinkLine = aperture.slice(0, 25).map(([x, y]) => eyePoint(.003)(x, y));
    mesh("upper lash crease", taperedSeam(blinkLine, .008), mat.mouth);
    const pivot = project(0, 0, .018);
    rigParts(sign < 0 ? "EyeRig_L" : "EyeRig_R", pivot.toArray(), root.children.slice(eyeStart));

    // A low broad upper hood grows out of the skull and wraps the aperture.
    // Its outer edge is below the head surface so orbit never exposes a rim.
    const positions = [], indices = [], contact = [];
    const crossSections = 7;
    for (let row = 0; row <= crossSections; row++) {
      const t = row / crossSections;
      for (let i = 0; i < aperture.length; i++) {
        const [x, y] = aperture[i];
        const theta = i / aperture.length * tau;
        const upper = Math.max(0, Math.sin(theta));
        const lower = Math.max(0, -Math.sin(theta));
        const height = (index === 0 ? .089 : .101) * upper - .033 * lower;
        const hood = ((index === 0 ? .035 : .046) * upper + .008 * lower) * Math.sin(t * Math.PI);
        contact.push(.22 * upper * (1 - t) ** 2);
        positions.push(...project(x * (1 + t * .17), y + height * t, .014 * (1 - t) + hood - .007 * t).toArray());
        if (row > 0) {
          const a = (row - 1) * aperture.length + i;
          const b = (row - 1) * aperture.length + (i + 1) % aperture.length;
          indices.push(a, a + aperture.length, b, b, a + aperture.length, b + aperture.length);
        }
      }
    }
    const lid = surfaceGeometry(positions, indices, outward);
    const normals = lid.attributes.normal;
    for (let row = 4; row <= crossSections; row++) {
      for (let j = 0; j < aperture.length; j++) {
        const i = row * aperture.length + j;
        const p = new Vector().fromArray(positions, i * 3);
        const n = new Vector().fromBufferAttribute(normals, i)
          .lerp(shape.normal(p), (row - 3) / (crossSections - 3)).normalize();
        normals.setXYZ(i, n.x, n.y, n.z);
      }
    }
    mesh("skin brow and cheeks around eye", paintSkin(lid, look, contact), mat.headSkin);

    const cheekPoint = (x, y) => project(x, y, .006);
    const spots = [
      [sign * .191, -.192, .039, .051],
      [sign * .183, -.262, .032, .034],
    ];
    for (const [x, y, rx, ry] of spots) {
      mesh("cheek pigment", facePatch(ellipse(x, y, rx, ry), cheekPoint, outward, 4), mat.spot);
    }
  }

  const smile = Array.from({ length: 45 }, (_, i) => {
    const u = i / 22 - 1, angle = u * 1.035;
    const outward = new Vector(Math.sin(angle), 0, Math.cos(angle));
    const wave = .013 * Math.cos(u * Math.PI * 2) - .013 * Math.cos(u * Math.PI);
    const origin = new Vector(0, 1.198 + .096 * u ** 4 + wave, 1.38);
    return shape.surface(origin, outward).addScaledVector(outward, .003);
  });
  mesh("tapered closed smile", taperedSeam(smile, .011), mat.mouth);
  return {
    headSide: ({ y, z, side }) => shape.surface(new Vector(0, y, z), new Vector(side, 0, 0)).x,
  };
}

function loft(rings, segments, sample) {
  const positions = [], indices = [];
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      positions.push(...sample(i / (rings - 1), j / segments * tau));
      if (i < rings - 1) {
        const a = i * segments + j, b = i * segments + (j + 1) % segments;
        indices.push(a, a + segments, b, b, a + segments, b + segments);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function drawLimb(art, x, z, index, front, look) {
  const { mesh, mat } = art;
  const side = Math.sign(x);
  const flat = look.carved ? .075 : 0;
  const toeSpread = front ? .131 : .12;
  const profiles = [
    [.012, .205, .242, .114, .025],
    [.075, .253, .292, .105, .013],
    [.176, .266 + flat * .25, .305, .094, 0],
    [.32, .252, .289, .076, -.014],
    [.53 - flat, .233, .243, .027, -.042],
    [.708 - flat, .204, .216, -.013, -.07],
    [.806 - flat, .131, .156, -.032, -.085],
    [.858 - flat, .005, .005, -.035, -.09],
  ];
  const radiusCurve = new THREE.CatmullRomCurve3(profiles.map(([y, w, d]) => new Vector(y, w, d)));
  const centerCurve = new THREE.CatmullRomCurve3(profiles.map(([y, , , tip, wid]) => new Vector(y, tip, wid)));
  const footprint = (t, angle) => {
    const p = radiusCurve.getPoint(t);
    const c = centerCurve.getPoint(t);
    const roundness = look.carved ? .9 : .94;
    function rounded(value) {
      return Math.sign(value) * Math.pow(Math.abs(value), roundness);
    }
    return [x + side * c.z + p.y * rounded(Math.cos(angle)), p.x, z + c.y + p.z * rounded(Math.sin(angle))];
  };
  const geometry = loft(25, 36, footprint);
  const normals = geometry.attributes.normal;
  const orientation = new Vector().fromBufferAttribute(normals, 36 * 8);
  if (orientation.x < 0) {
    const ix = geometry.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    geometry.computeVertexNormals();
  }
  const leg = mesh(front ? "planted foreleg" : "planted hindleg", geometry, mat.skin);
  leg.userData.skinOrigin = [x, z + .07];
  function soleIntersection(xAt, y) {
    let lo = 0, hi = .45;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (radiusCurve.getPoint(mid).x < y) lo = mid;
      else hi = mid;
    }
    const at = (lo + hi) / 2;
    const p = radiusCurve.getPoint(at), c = centerCurve.getPoint(at);
    const ratio = clamp((xAt - x - side * c.z) / p.y, -.998, .998);
    const exponent = look.carved ? .9 : .94;
    const angle = Math.acos(Math.sign(ratio) * Math.abs(ratio) ** (1 / exponent));
    return footprint(at, angle)[2];
  }
  for (let i = -1; i <= 1; i++) {
    const length = i === 0 ? .159 : .14;
    const position = x + i * toeSpread;
    const outline = Array.from({ length: 24 }, (_, j) => {
      const a = j / 24 * tau;
      return [Math.cos(a) * (.9 - .24 * Math.sin(a)), Math.max(-.8, Math.sin(a))];
    });
    const nail = facePatch(outline, (u, v) => {
      const y = .013 + (v + .8) / 1.8 * length;
      const across = position + u * .071;
      const bulge = .053 * Math.max(0, 1 - u ** 2 - v ** 2) ** .65;
      return new Vector(across, y, soleIntersection(across, y) + .006 + bulge);
    }, new Vector(0, 0, 1), 5);
    mesh("ochre nail seated in toe", nail, mat.nail);
  }
  if (index >= 4) return;
  const patches = [
    [side < 0 ? 2.33 : .81, .59, .19, .063],
    [side < 0 ? 2.67 : .47, .49, .16, .056],
    [side < 0 ? 2.05 : 1.09, .45, .135, .051],
  ];
  for (const [angle, t, width, height] of patches) {
    const outward = new Vector(Math.cos(angle), 0, Math.sin(angle));
    const project = (u, v) => new Vector(...footprint(v, u)).addScaledVector(outward, .003);
    const inset = facePatch(ellipse(angle, t, width, height), project, outward, 4);
    mesh("organic leg spots", inset, mat.spot);
  }
}

function tail({ mesh, mat }) {
  const axis = new THREE.CatmullRomCurve3([
    new Vector(0, .47, -1.02), new Vector(.012, .4, -1.21),
    new Vector(-.036, .365, -1.42), new Vector(-.113, .414, -1.655),
  ]);
  const geometry = loft(18, 14, (t, angle) => {
    const point = axis.getPoint(t);
    const radius = .102 * Math.pow(1 - t, .9) + .0015;
    return [point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius * .73, point.z];
  });
  return mesh("tapered organic tail", geometry, mat.skin);
}

module.exports = { headShape, headMesh, face, drawLimb, tail };
