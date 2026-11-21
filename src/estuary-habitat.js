import {terrain} from './world.js';

const smooth = (lo, hi, value) => {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
};

// The crossing's two banks share a tidal band. On the forest side, oblique
// stone seams frame a sheltered ascent into the existing fern and tree cover.
export function estuaryHabitat(x, z, height, slope) {
  const weight = smooth(12, 34, x) * (1 - smooth(130, 158, x)) *
    smooth(-64, -43, z) * (1 - smooth(28, 58, z));
  if (weight === 0) return null;
  if (slope === undefined) {
    slope = Math.hypot(
      terrain(x + .5, z) - terrain(x - .5, z),
      terrain(x, z + .5) - terrain(x, z - .5)
    );
  }

  const bend = Math.sin(z * .077 + x * .041);
  const gravel = weight * smooth(-.85, .15, height) *
    (1 - smooth(1.2 + bend * .28, 3.6 + bend * .7, height));
  const seam = Math.sin((x + z * .53) * .22 + bend * .81);
  const bedrock = weight * smooth(1.55, 4, height) *
    smooth(.23, .68, Math.max(seam * .5 + .28, slope * .95));
  const shelter = weight * smooth(1.8, 4.2, height) *
    (1 - smooth(14, 22, height)) * (1 - smooth(.36, .78, slope)) *
    (1 - smooth(-.15, .6, seam));
  const reed = weight * smooth(.45, 1, height) * (1 - smooth(1.45, 2.6, height)) *
    (1 - smooth(.24, .51, slope)) * smooth(-.2, .65, bend);
  return {gravel, bedrock, shelter, reed};
}
