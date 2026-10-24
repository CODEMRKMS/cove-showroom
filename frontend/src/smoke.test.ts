describe('test setup', () => {
  it('runs vitest with jsdom and jest-dom matchers', () => {
    document.body.innerHTML = '<p>hello</p>';
    expect(document.body.querySelector('p')).toBeInTheDocument();
  });
});
