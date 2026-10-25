import { MOMENT, momentState, pullScale } from './moment';

describe('momentState (the purchase moment)', () => {
  it('pulls the camera back and returns it: zero at both ends, one at the midpoint', () => {
    expect(momentState(0).pull).toBe(0);
    expect(momentState(MOMENT.pullMs / 2).pull).toBeCloseTo(1);
    expect(momentState(MOMENT.pullMs).pull).toBeCloseTo(0);
    expect(momentState(MOMENT.totalMs).pull).toBe(0);
  });

  it('never pulls by a negative amount or more than one', () => {
    for (let ms = -100; ms < MOMENT.totalMs + 500; ms += 25) {
      const { pull } = momentState(ms);
      expect(pull).toBeGreaterThanOrEqual(0);
      expect(pull).toBeLessThanOrEqual(1);
    }
  });

  it('starts the light sweep after the pull has begun, eased from 0 to 1', () => {
    expect(momentState(0).sweep).toBeNull();
    expect(momentState(MOMENT.sweepStartMs - 1).sweep).toBeNull();
    const first = momentState(MOMENT.sweepStartMs + 1).sweep!;
    const last = momentState(MOMENT.sweepStartMs + MOMENT.sweepMs - 1).sweep!;
    expect(first).toBeLessThan(0.01);
    expect(last).toBeGreaterThan(0.99);
    let previous = 0;
    for (let ms = MOMENT.sweepStartMs; ms < MOMENT.sweepStartMs + MOMENT.sweepMs; ms += 30) {
      const { sweep } = momentState(ms);
      expect(sweep!).toBeGreaterThanOrEqual(previous);
      previous = sweep!;
    }
  });

  it('is over once the total time has passed, with no sweep left running', () => {
    expect(momentState(MOMENT.totalMs - 1).done).toBe(false);
    expect(momentState(MOMENT.totalMs)).toMatchObject({ done: true, sweep: null });
  });

  it('is short: under three seconds, and the sweep ends inside the total', () => {
    expect(MOMENT.totalMs).toBeLessThan(3000);
    expect(MOMENT.sweepStartMs + MOMENT.sweepMs).toBeLessThanOrEqual(MOMENT.totalMs);
  });
});

describe('pullScale', () => {
  it('is 1 at rest and grows by at most a quarter-ish at the peak', () => {
    expect(pullScale(0)).toBe(1);
    expect(pullScale(1)).toBeGreaterThan(1.15);
    expect(pullScale(1)).toBeLessThan(1.4);
  });
});
