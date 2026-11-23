/**
 * Builds public/models/head.glb from the raw Sketchfab download in angelica/.
 *
 *   npm run build:head
 *
 * Steps:
 *  1. Swap the skin texture for the makeup-free version (assets-src/head/,
 *     produced by tools/demakeup.py).
 *  2. Convert spec/gloss materials to metal/rough — three.js no longer reads
 *     KHR_materials_pbrSpecularGlossiness.
 *  3. Turn off the hair's emissive "glow" (a Sketchfab presentation trick that
 *     would make the hair shine in a dark scene).
 *  4. Drop unused nodes, re-encode textures as WebP, write a single .glb.
 *
 * Model: "Angelica" by NikZava284, CC-BY-4.0 — see angelica/license.txt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { metalRough, prune, dedup, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const SRC = 'angelica/scene.gltf';
const SKIN = 'assets-src/head/Head_diffuse_nomakeup.jpeg';
const OUT = 'public/models/head.glb';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SRC);
const root = doc.getRoot();

// 1. makeup-free skin
const skinTex = root.listTextures().find((t) => t.getURI() === 'textures/Head_diffuse.jpeg');
if (!skinTex) throw new Error('Head_diffuse.jpeg not found in source model');
skinTex.setImage(fs.readFileSync(SKIN));

// 2. spec/gloss -> metal/rough
await doc.transform(metalRough());

// 3. no glowing hair
for (const mat of root.listMaterials()) {
  if (mat.getName() === 'Hair') {
    mat.setEmissiveFactor([0, 0, 0]);
    mat.setEmissiveTexture(null);
  }
}

// 4. tidy + compress
await doc.transform(
  prune(),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92, resize: [2048, 2048] }),
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);

const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
console.log(`Wrote ${OUT} (${mb} MB)`);
for (const mat of root.listMaterials()) {
  console.log(`  material: ${mat.getName()}  alpha=${mat.getAlphaMode()}`);
}
