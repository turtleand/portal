const THREE = require('three');

const up = new THREE.Vector3(0, 1, 0);

// The small controls are modeled in their own face plane. Aim them outward
// and forward so their construction reads in the opening and side views.
function facePlane(position, facing) {
  const origin = new THREE.Vector3(...position);
  const normal = new THREE.Vector3(...facing).normalize();
  const horizontal = up.clone().cross(normal).normalize();
  const vertical = normal.clone().cross(horizontal);
  const rotation = new THREE.Matrix4().makeBasis(horizontal, vertical, normal);
  const point = (x, y, z) => origin.clone()
    .addScaledVector(horizontal, x).addScaledVector(vertical, y)
    .addScaledVector(normal, z).toArray();
  return { point, rotation };
}

function inPlane(art, name, geometry, material, plane, x, y, z, scale) {
  const object = art.mesh(name, geometry, material, plane.point(x, y, z), scale);
  object.setRotationFromMatrix(plane.rotation);
  return object;
}

function disk(art, name, plane, back, front, radius, material, edgeRadius = radius) {
  return art.rod(name, plane.point(0, 0, back), plane.point(0, 0, front), radius, material, edgeRadius);
}

function faceBox(art, name, plane, size, offset, corner, material) {
  const geometry = new art.RoundedBoxGeometry(...size, 2, corner);
  return inPlane(art, name, geometry, material, plane, ...offset);
}

function dialRing(art, name, plane, radius, thickness, depth, material) {
  const geometry = new THREE.TorusGeometry(radius, thickness, 6, 24);
  return inPlane(art, name, geometry, material, plane, 0, 0, depth);
}

function addHeadset(art, index) {
  const { mat, headSide } = art;
  const y = index === 4 ? 1.43 : 1.49;
  const z = 1.27;
  const x = headSide?.({ y, z, side: -1 }) ?? -0.547;
  const plane = facePlane([x, y, z], [-0.93, 0.035, 0.37]);

  disk(art, 'headset fitted gasket', plane, -0.033, 0.045, 0.174, mat.dark, 0.168);
  disk(art, 'headset beveled metal back', plane, 0.040, 0.070, 0.166, mat.metal, 0.151);
  disk(art, 'headset inset housing', plane, 0.067, 0.099, 0.149, mat.screen, 0.137);
  disk(art, 'headset recessed dial', plane, 0.097, 0.107, 0.120, mat.dark);
  dialRing(art, 'headset luminous bezel', plane, 0.096, 0.011, 0.106, mat.light);
  disk(art, 'headset teal dial well', plane, 0.103, 0.114, 0.060, mat.screen, 0.055);
  disk(art, 'headset central status light', plane, 0.113, 0.119, 0.039, mat.light, 0.034);

  if (index >= 4) {
    const arm = faceBox(art, 'headset swept receiver', plane, [0.143, 0.077, 0.042], [0.123, -0.061, 0.102], 0.019, mat.screen);
    arm.rotateZ(-0.34);
  }
}

function cuffGeometry(center, width, depth, profile, sectors = 28) {
  const positions = [];
  const indices = [];
  for (const [radius, height, slope] of profile) {
    for (let i = 0; i < sectors; i++) {
      const turn = Math.PI * 2 * i / sectors;
      const forward = Math.cos(turn);
      positions.push(
        center[0] + Math.sin(turn) * width * radius,
        center[1] + height + slope * forward,
        center[2] + forward * depth * radius,
      );
    }
  }
  for (let level = 0; level < profile.length; level++) {
    const nextLevel = (level + 1) % profile.length;
    for (let i = 0; i < sectors; i++) {
      const next = (i + 1) % sectors;
      const a = level * sectors + i;
      const b = level * sectors + next;
      const c = nextLevel * sectors + i;
      const d = nextLevel * sectors + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addWristTerminal(art, index) {
  const { mat, foreLimbX = 0.72, foreLimbZ = 0.8, limbWidth = 0.255, limbDepth = 0.28 } = art;
  const center = [-foreLimbX, 0.38, foreLimbZ + 0.018];
  art.mesh('wrist terminal strap', cuffGeometry(center, limbWidth + 0.013, limbDepth + 0.017, [
    [0.84, -0.066, 0], [0.98, -0.066, 0], [1, -0.052, 0],
    [1, 0.052, 0], [0.98, 0.066, 0], [0.84, 0.066, 0],
  ]), mat.dark);

  const plane = facePlane([center[0] - 0.092, center[1], center[2] + limbDepth * 0.87], [-0.36, 0.02, 0.93]);
  faceBox(art, 'wrist terminal case', plane, [0.326, 0.274, 0.094], [0, 0, 0.016], 0.03, mat.dark);
  faceBox(art, 'wrist terminal raised bezel', plane, [0.281, 0.231, 0.036], [0, 0, 0.061], 0.028, mat.metal);
  faceBox(art, 'wrist terminal glass inset', plane, [0.226, 0.177, 0.023], [0, 0, 0.079], 0.021, mat.screen);
  faceBox(art, 'wrist terminal lower indicator', plane, [0.125, 0.023, 0.009], [0, -0.036, 0.093], 0.005, mat.light);

  if (index === 2) {
    for (const x of [-0.044, 0, 0.044]) {
      art.ell('wrist terminal signal dot', mat.light, plane.point(x, 0.029, 0.091), [0.012, 0.012, 0.012]);
    }
  } else {
    faceBox(art, 'wrist terminal upper indicator', plane, [0.125, 0.023, 0.009], [0, 0.034, 0.093], 0.005, mat.light);
  }
}

function addHydraulicBrace(art, x, z, index) {
  const { mat, ankleWidth = 0.26, ankleDepth = 0.3, limbWidth = 0.255 } = art;
  const side = Math.sign(x);
  const center = [x + side * 0.006, 0.284, z + 0.105];
  const width = ankleWidth + 0.042;
  const depth = ankleDepth + 0.043;
  // A shallow lip and a curved front opening leave the organic nails exposed.
  art.mesh('brace ankle liner', cuffGeometry(center, width, depth, [
    [0.72, -0.094, 0.03], [0.971, -0.094, 0.03], [0.98, -0.079, 0.03],
    [0.88, 0.068, 0.04], [0.84, 0.083, 0.04], [0.67, 0.083, 0.04],
  ]), mat.dark);
  art.mesh('brace contoured silver ankle guard', cuffGeometry(center, width, depth, [
    [0.86, -0.078, 0.03], [0.987, -0.078, 0.03], [1.00, -0.059, 0.03],
    [0.94, 0.065, 0.04], [0.897, 0.088, 0.04], [0.73, 0.088, 0.04],
  ]), mat.metal);

  const anchor = new THREE.Vector3(x + side * limbWidth * 0.75, index === 4 ? 0.632 : 0.655, z + 0.124);
  const joint = new THREE.Vector3(center[0] + side * width * 0.70, 0.386, center[2] + depth * 0.68);
  const pointOnRail = (fraction) => anchor.clone().lerp(joint, fraction).toArray();
  const upperPlane = facePlane(anchor.toArray(), [side * 0.74, 0.32, 0.59]);
  disk(art, 'brace shoulder anchor', upperPlane, -0.058, 0.015, 0.106, mat.dark, 0.092);
  disk(art, 'brace beveled shoulder socket', upperPlane, 0.009, 0.03, 0.089, mat.metal, 0.073);
  art.rod('brace inner hydraulic shaft', pointOnRail(0.36), pointOnRail(1), 0.028, mat.chrome);
  art.rod('brace hydraulic cylinder', pointOnRail(-0.10), pointOnRail(0.53), 0.052, mat.metal, 0.041);
  art.rod('brace hydraulic gland', pointOnRail(0.45), pointOnRail(0.59), 0.044, mat.dark, 0.038);

  const plane = facePlane(joint.toArray(), [side * 0.66, 0.08, 0.75]);
  disk(art, 'brace joint isolator', plane, -0.045, 0.025, 0.114, mat.dark, 0.105);
  disk(art, 'brace brushed pivot', plane, 0.018, 0.055, 0.105, mat.metal, 0.086);
  disk(art, 'brace inset seal', plane, 0.050, 0.058, 0.071, mat.screen);
  disk(art, 'brace cyan pivot center', plane, 0.057, 0.065, 0.052, mat.light, 0.046);

  const inset = Array.from({ length: 7 }, (_, i) => {
    const turn = side * (0.58 + i * 0.132);
    const forward = Math.cos(turn);
    return [center[0] + width * Math.sin(turn), center[1] - 0.049 + 0.03 * forward, center[2] + depth * forward];
  });
  art.tube('brace narrow cyan edge inlay', inset, 0.009, mat.light);
}

function addCompass(art) {
  const { mat, foreLimbX = 0.72, foreLimbZ = 0.8 } = art;
  const plane = facePlane([-foreLimbX * 0.87, 0.803, foreLimbZ + 0.184], [-0.68, 0.105, 0.73]);
  disk(art, 'compass shoulder mount', plane, -0.060, 0.022, 0.112, mat.dark);
  disk(art, 'compass beveled metal bezel', plane, 0.015, 0.040, 0.110, mat.metal, 0.098);
  disk(art, 'compass dark dial', plane, 0.037, 0.048, 0.088, mat.screen);
  dialRing(art, 'compass hairline inlay', plane, 0.078, 0.005, 0.050, mat.light);

  const star = new THREE.Shape();
  [[0, 0.063], [0.013, 0.014], [0.055, 0], [0.013, -0.014], [0, -0.063],
    [-0.013, -0.014], [-0.055, 0], [-0.013, 0.014]].forEach(([x, y], index) => {
    if (index === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  });
  star.closePath();
  const geometry = new THREE.ExtrudeGeometry(star, {
    depth: 0.002, bevelEnabled: false, steps: 1,
  });
  inPlane(art, 'four-point compass star', geometry, mat.map, plane, 0, 0, 0.049);
}

function addEquipment(art, index) {
  if (index >= 3) addHeadset(art, index);
  if (index === 2 || index === 3) addWristTerminal(art, index);
  if (index === 5) addCompass(art);
}

module.exports = { addEquipment, addHydraulicBrace };
