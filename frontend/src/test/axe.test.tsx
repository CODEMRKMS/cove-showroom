import { render } from '@testing-library/react';
import { axeViolations } from './axe';

describe('axeViolations helper', () => {
  it('reports a real problem, so a clean result elsewhere means something', async () => {
    render(<img src="car.png" />);
    const found = await axeViolations();
    expect(found.join('\n')).toContain('image-alt');
  });

  it('reports nothing for an accessible snippet', async () => {
    render(<img src="car.png" alt="A white sedan" />);
    expect(await axeViolations()).toEqual([]);
  });
});
