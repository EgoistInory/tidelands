const smooth = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

// West inlet of Amber Shoal. Height contours connect the submerged sand,
// wash line and dry dune pockets without changing the walkable ground.
export function shoalHabitat(x, z, height, slope = 0) {
  if (height <= -1.9 || height >= 10) return null;
  const shore = smooth(56, 75, x) * (1 - smooth(126, 152, x)) *
    smooth(114, 133, z) * (1 - smooth(168, 188, z));
  if (!shore) return null;

  const bend = Math.sin(x * .11 + z * .07);
  const wash = shore * smooth(-1.9, -.4, height) *
    (1 - smooth(.45 + bend * .2, 2.6 + bend * .45, height));
  const crest = 2.75 + .46 * bend + .24 * Math.sin(z * .24 - x * .13);
  const strand = shore * (1 - smooth(.19, 1.16, Math.abs(height - crest))) *
    (.37 + .63 * smooth(-.35, .58, Math.sin(z * .17 + x * .09))) *
    (1 - smooth(.32, .68, slope));
  const dune = shore * smooth(2.7, 4.3, height) * (1 - smooth(6.7, 9.8, height)) *
    (1 - smooth(.37, .74, slope)) *
    (.37 + .63 * smooth(-.27, .56, Math.sin(x * .19 - z * .12 + bend)));
  return { wash, strand, dune };
}

// Inland of the wash line, exposed shoulders frame a shallow sandy passage.
export function shoalInterior(x, z, height, slope = 0) {
  const spread = smooth(98, 115, x) * (1 - smooth(158, 178, x)) *
    smooth(144, 159, z) * (1 - smooth(194, 218, z)) * smooth(3.8, 8, height);
  if (!spread) return null;

  const trough = 157 + (x - 108) * .94 + 3 * Math.sin((x - 106) * .105);
  const opening = 1 - smooth(2.9, 9.2, Math.abs(z - trough));
  const patch = Math.sin(x * .105 + Math.sin(z * .15) * .8) * Math.cos(z * .11 - x * .045);
  const heath = spread * (1 - .9 * opening) * (.36 + .64 * smooth(-.46, .47, patch)) *
    (1 - smooth(.39, .8, slope));
  const seam = Math.sin(height * 1.22 + x * .085 - z * .061 + patch);
  const ledge = spread * (1 - opening) * smooth(.28, .66, slope) *
    (.36 + .64 * smooth(-.3, .55, seam));
  return { sand:spread * opening, heath, ledge };
}
