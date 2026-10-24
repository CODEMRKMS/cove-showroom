import axe from 'axe-core';

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
