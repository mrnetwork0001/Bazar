/**
 * Score formatting shared by the detail page rail and the reputation panel.
 *
 * The index publishes fractional scores (49.06, 30.48), so a raw render is
 * noisy and a rounded one loses the ordering that separates two agents a
 * hundredth apart. One decimal, and no trailing ".0" on whole numbers.
 */
export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
