import axe from 'axe-core';

// axe's icon-ligature check asks a <canvas> for a 2D context. jsdom has none and reports "Not
// implemented" on every call, even though axe copes with a null answer (as in a browser without
// canvas). Answering null here silences only that probe; every other jsdom gap still reports.
HTMLCanvasElement.prototype.getContext = () => null;

/**
 * Runs axe-core on the page and returns readable violation lines. jsdom has no layout or CSS, so the
 * colour-contrast rule cannot run here; contrast is covered by the accent tests and checked by eye in a
 * real browser instead.
 */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const results = await axe.run(root, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join('; ')})`,
  );
}
