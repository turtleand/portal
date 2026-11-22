/* Reproducible selected 3D derivatives of the canonical Turtleand SVGs.
 * Geometry, expression profiles and studio materials are authored here.
 * Run npm run generate:avatar-3d. Canonical SVGs remain authoritative.
 */
const THREE = require("three");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { applySurfaceDetail, makeSkinNormalTile, unwrapSkin, skinNormalPlugin } = require('./art-surfaces.cjs');
const { face, headMesh, headShape, drawLimb, tail } = require('./art-anatomy.cjs');
const { addShell } = require('./art-shell.cjs');
const { addHydraulicBrace, addEquipment } = require('./art-hardware.cjs');
const manifest = require('../../src/data/avatarVersions.json');
const directions = require('./directions.json');
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
const palettes = {
  'genesis-shell': { skin: '#a88a44', brow: '#7c702e', muzzle: '#d9a44d', shell: '#442410', plate: '#844c2c', belly: '#a66b22', nail: '#e1bd72', spot: '#745523' },
  'quantum-shell': { skin: '#73792d', muzzle: '#c6a145', shell: '#311c11', plate: '#5b3822', belly: '#aa7426', nail: '#d6ae51', spot: '#4d541b' },
  'tech-nomad': { skin: '#606d32', muzzle: '#b19943', shell: '#2d1a10', plate: '#56391f', belly: '#9f742d', nail: '#cba34d', spot: '#424c20' },
  'network-visitor': { skin: '#687232', muzzle: '#b79e45', shell: '#2f1d13', plate: '#604127', belly: '#a4722b', nail: '#d5ad52', spot: '#465020' },
  'hydraulic-brace': { skin: '#626930', muzzle: '#9e8c42', shell: '#291d16', plate: '#58402b', belly: '#946a2d', nail: '#c69d4e', spot: '#454b21' },
  'frontier-cartographer': { skin: '#687135', muzzle: '#a48f44', shell: '#2b1c13', plate: '#604127', belly: '#a07633', nail: '#cda650', spot: '#444f27' },
};
const finishes = {
  'Illustrated Sculpt': { rough: .57, coat: .09, grain: .08, emission: .79 },
  'Living Shell': { rough: .65, coat: .08, grain: .88, emission: .68, organic: true },
  'Carved Patina': { rough: .62, coat: .07, grain: .22, emission: .76, carved: true },
};
let root, mat, RoundedBoxGeometry;
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
const sphere = new THREE.SphereGeometry(1, 20, 12);
const detailSphere = new THREE.SphereGeometry(1, 12, 8);
function ell(name, m, p, s) {
  return mesh(name, Math.max(...s) < .14 ? detailSphere : sphere, m, p, s);
}
function tube(name, points, r, m) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new V(...p)));
  return mesh(
    name,
    new THREE.TubeGeometry(
      c,
      Math.min(56, Math.max(6, points.length * 3)),
      r,
      5,
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
// Rigid anatomical pivots keep eyes and equipment together. The idle is tiny
// enough that planted feet and the shell/neck overlap remain stable.
function rigParts(name, pivot, parts) {
  const rig = new THREE.Group();
  rig.name = name;
  rig.position.set(...pivot);
  root.add(rig);
  root.updateMatrixWorld(true);
  for (const part of parts) rig.attach(part);
  return rig;
}
function plastron() {
  ell("gold plastron", mat.belly, [0, .51, .015], [.89, .413, 1.18]);
  for (const [y, radius] of [[.797, .714], [.656, .937], [.48, .997]]) {
    const seam = Array.from({ length: 15 }, (_, i) => {
      const a = (i - 7) / 7 * .79;
      const yy = y + .035 * Math.abs(a);
      const r = Math.sqrt(1 - ((yy - .51) / .413) ** 2);
      return [Math.sin(a) * (.89 * r + .002), yy, .015 + Math.cos(a) * (1.18 * Math.min(radius, r) + .003)];
    });
    tube("plastron articulation", seam, .008, mat.plastronSeam);
  }
}
function make(idx, stage, look, shape, geometry) {
  root = new THREE.Group();
  root.name = `Turtleand ${stage.version} ${look.direction}`;
  root.userData = {
    avatarId: stage.id,
    avatarVersion: stage.version,
    direction: look.direction,
  };
  mat = {
    skin: material(look.skin, look.rough, 0, { vertexColors: true, specularIntensity: .3 }),
    headSkin: material("#ffffff", look.rough, 0, { vertexColors: true, specularIntensity: .3 }),
    shell: material(look.shell, .7),
    plate: material(look.plate, look.rough, .025, {
      vertexColors: true, clearcoat: look.coat, clearcoatRoughness: .45,
    }),
    belly: material(look.belly, .66, 0, { vertexColors: true }),
    plastronSeam: material(new THREE.Color(look.belly).multiplyScalar(.52), .72),
    spot: material(look.spot, .76),
    nail: material(look.nail, .54),
    sclera: material(idx === 0 ? "#b4a281" : "#b0ac8e", .38, 0, { specularIntensity: .3 }),
    iris: material("#ffffff", .26, 0, { vertexColors: true, specularIntensity: .39, clearcoat: .19 }),
    pupil: material("#111611", .23, 0, { specularIntensity: .33 }),
    white: material("#e6d8b5", .6, 0, { specularIntensity: 0 }),
    mouth: material(idx === 0 ? "#56381e" : "#3e341e", .8),
    metal: material("#a7b6bc", look.carved ? .39 : .34, .62),
    chrome: material("#c0cbd0", .25, .74),
    dark: material("#172221", .59, .20),
    light: material(idx === 1 ? "#318f50" : "#1eb9ae", .34, .10, {
      emissive: idx === 1 ? "#28ae50" : "#12b5a8",
      emissiveIntensity: look.emission,
    }),
    map: material("#b2c9a6", .47, .14, {
      emissive: "#73c5af", emissiveIntensity: .31,
    }),
    screen: material("#093e38", .29, .15),
    underlight: material("#22a299", .34, .11, {
      emissive: "#17b3a7", emissiveIntensity: .68,
    }),
  };
  for (const [name, surface] of Object.entries(mat)) surface.name ||= name;
  const art = { root, mat, mesh, ell, tube, rod, rigParts, RoundedBoxGeometry };
  plastron();
  const spread = look.carved ? .053 : 0;
  const foreLimbX = .746 + spread, foreLimbZ = .82;
  tail(art);
  for (const side of [-1, 1]) {
    drawLimb(art, side * (.72 + spread), -.795, idx, false, look);
    drawLimb(art, side * foreLimbX, foreLimbZ, idx, true, look);
    if (idx >= 4) {
      addHydraulicBrace(art, side * (.72 + spread), -.795, idx);
      addHydraulicBrace(art, side * foreLimbX, foreLimbZ, idx);
    }
  }
  const shellStart = root.children.length;
  addShell(art, idx, look);
  rigParts("ShellRig", [0, .77, -.12], root.children.slice(shellStart));
  const headStart = root.children.length;
  const { headSide } = face(art, shape, geometry, look, idx);
  const headParts = root.children.slice(headStart);
  const accessoryStart = root.children.length;
  addEquipment({ ...art, foreLimbX, foreLimbZ, headSide }, idx);
  headParts.push(...root.children.slice(accessoryStart).filter(part => /headset/.test(part.name)));
  const head = rigParts("HeadRig", [0, .86, 1.05], headParts);
  head.scale.set(look.carved ? 1.085 : 1.025, look.carved ? .91 : 1, 1);
  root.updateMatrixWorld(true);
  return root;
}
function idleClip() {
  const duration = 8, times = [], shell = [], head = [], gaze = [];
  // Sample smooth loop curves offline; no procedural animation work at runtime.
  for(let i=0;i<=64;i++) {
    const t=duration*i/64, phase=t/duration*Math.PI*2;
    times.push(t);
    shell.push(0, .77 + .014*(1-Math.cos(phase*2)), -.12);
    head.push(0, .86 + .008*(1-Math.cos(phase*2)), 1.05);
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.012*Math.sin(phase*2),.038*Math.sin(phase),.012*Math.sin(phase)));
    gaze.push(q.x,q.y,q.z,q.w);
  }
  const blinkTimes=[0,2.7,2.82,2.94,3.12,6.5,6.62,6.74,6.92,8];
  const blink=blinkTimes.flatMap((_,i)=>[1, i===2||i===6 ? .07 : 1, 1]);
  return new THREE.AnimationClip('Idle',duration,[
    new THREE.VectorKeyframeTrack('ShellRig.position',times,shell),
    new THREE.VectorKeyframeTrack('HeadRig.position',times,head),
    new THREE.QuaternionKeyframeTrack('HeadRig.quaternion',times,gaze),
    new THREE.VectorKeyframeTrack('EyeRig_L.scale',blinkTimes,blink),
    new THREE.VectorKeyframeTrack('EyeRig_R.scale',blinkTimes,blink),
  ]);
}
(async () => {
  ({RoundedBoxGeometry}=await import(pathToFileURL(require.resolve('three/addons/geometries/RoundedBoxGeometry.js')).href));
  const { GLTFExporter } = await import(
    pathToFileURL(require.resolve("three/addons/exporters/GLTFExporter.js"))
      .href
  );
  const { MarchingCubes } = await import(
    pathToFileURL(require.resolve("three/addons/objects/MarchingCubes.js")).href
  );
  const { mergeVertices } = await import(
    pathToFileURL(require.resolve("three/addons/utils/BufferGeometryUtils.js"))
      .href
  );
  const { mergeGeometries } = await import(
    pathToFileURL(require.resolve("three/addons/utils/BufferGeometryUtils.js"))
      .href
  );
  fs.mkdirSync(out, { recursive: true });
  const inventory = [];
  const skinNormalTile = makeSkinNormalTile();
  for (const [i, stage] of manifest.entries()) {
    const direction = directions[stage.id];
    if (!finishes[direction] || !palettes[stage.id]) {
      throw new Error(`Missing 3D art settings for ${stage.id}`);
    }
    const look = { ...palettes[stage.id], ...finishes[direction], direction };
    const shape = headShape(look);
    const geometry = headMesh(shape, MarchingCubes, mergeVertices, look);
    const authored = make(i, stage, look, shape, geometry);
    const group = new THREE.Group();
    group.name = authored.name;
    group.userData = authored.userData;
    // Eye pigmentation shares one glossy surface per blinking aperture.
    // It retains authored iris fibers while avoiding four draw calls per eye.
    const eyeMaterial = mat.iris.clone();
    eyeMaterial.name = 'glossy layered eye';
    const eyePigments = new Set([mat.sclera, mat.iris, mat.pupil, mat.white]);
    // Batch within animated anatomy instead of flattening the whole character.
    // Detail is baked in world space; the merged result returns to its pivot.
    function batchNode(source, target) {
      const batches = new Map();
      for (const object of source.children) {
        if (!object.isMesh) {
          const child = new THREE.Group();
          child.name = object.name;
          child.position.copy(object.position);
          child.quaternion.copy(object.quaternion);
          child.scale.copy(object.scale);
          target.add(child);
          batchNode(object, child);
          continue;
        }
        let g = object.geometry.clone().applyMatrix4(object.matrixWorld);
        const batchMaterial = eyePigments.has(object.material) ? eyeMaterial : object.material;
        if (eyePigments.has(object.material) && !g.hasAttribute('color')) {
          const color = object.material.color, values = [];
          for(let j=0;j<g.getAttribute('position').count;j++) values.push(color.r,color.g,color.b);
          g.setAttribute('color',new THREE.Float32BufferAttribute(values,3));
        }
        if (object.material === mat.skin) applySurfaceDetail(g, "skin", look);
        if (object.material === mat.belly) applySurfaceDetail(g, "belly", look);
        g.applyMatrix4(source.matrixWorld.clone().invert());
        for (const attribute of Object.keys(g.attributes))
          if (!['position','normal','color'].includes(attribute)) g.deleteAttribute(attribute);
        if (g.index) g = g.toNonIndexed();
        if (look.organic && object.material === mat.headSkin) unwrapSkin(g, [0, 1.32], 9);
        if (look.organic && object.material === mat.skin) unwrapSkin(g, object.userData.skinOrigin ?? [0, -1.19], 5);
        if (!batches.has(batchMaterial)) batches.set(batchMaterial, []);
        batches.get(batchMaterial).push(g);
      }
      for (const [material, geometries] of batches) {
        const geometry = mergeVertices(mergeGeometries(geometries, false), 1e-5);
        const colors = geometry.getAttribute('color');
        if (colors) {
          // glTF permits normalized byte vertex colors. Save nine bytes per
          // vertex while keeping continuous baked shading and iris fibers.
          const packed = new Uint8Array(colors.count * 3);
          for(let j=0;j<packed.length;j++) packed[j]=Math.round(Math.max(0,Math.min(1,colors.array[j]))*255);
          geometry.setAttribute('color', new THREE.BufferAttribute(packed,3,true));
        }
        const part = new THREE.Mesh(geometry, material);
        part.name = target.name + ' ' + material.name;
        target.add(part);
      }
    }
    batchNode(authored, group);
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
    const exporter = new GLTFExporter();
    if (look.organic) exporter.register(skinNormalPlugin(skinNormalTile, new Map([
      [mat.skin, .24], [mat.headSkin, .12],
    ])));
    const buf = await exporter.parseAsync(group, {
      binary: true,
      onlyVisible: true,
      animations: [idleClip()],
    });
    const filename = "turtleand-" + stage.version.slice(1) + ".glb";
    fs.writeFileSync(path.join(out, filename), Buffer.from(buf));
    inventory.push({
      direction,
      version: stage.version,
      file: filename,
      bytes: buf.byteLength,
      triangles: tris,
      meshes,
      animations: ["Idle"],
    });
    console.log(filename, buf.byteLength, tris);
  }
  fs.writeFileSync(
    path.resolve(__dirname, "inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );
})();
