import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildCarSpec } from '../lib/carSpec';
import { HoverTurnFrame, HoverTurnProvider } from './HoverTurn';

// The shared canvas and the 3D car need a GPU; stand-ins record that they were mounted.
const hover = vi.hoisted(() => ({ ready: null as null | (() => void) }));
vi.mock('./HoverStage', () => ({ default: () => <div data-testid="hover-stage" /> }));
vi.mock('./HoverCar', () => ({
  default: ({ spec, onReady }: { spec: { description: string }; onReady: () => void }) => {
    hover.ready = onReady;
    return <div data-testid="hover-car">{spec.description}</div>;
  },
}));
vi.mock('./quality', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  probeFrameTime: () => Promise.resolve(8),
}));

const specFor = (model: string) =>
  buildCarSpec({
    make: 'Honda',
    model,
    year: 2025,
    bodyStyle: 'SEDAN',
    colorOptions: ['#c0392b'],
  });

type Device = { webgl?: boolean; reduced?: boolean; hoverable?: boolean; cores?: number };

function stubDevice({ webgl = true, reduced = false, hoverable = true, cores = 12 }: Device = {}) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    webgl ? {} : null) as never);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce')
      ? reduced
      : query.includes('hover: hover')
        ? hoverable
        : query.includes('coarse')
          ? !hoverable
          : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal('navigator', { hardwareConcurrency: cores, deviceMemory: 16 });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const showroom = () =>
  render(
    <HoverTurnProvider>
      <HoverTurnFrame spec={specFor('City')}>
        <p>City picture</p>
      </HoverTurnFrame>
      <HoverTurnFrame spec={specFor('Amaze')}>
        <p>Amaze picture</p>
      </HoverTurnFrame>
      <HoverTurnFrame spec={specFor('Elevate')}>
        <p>Elevate picture</p>
      </HoverTurnFrame>
    </HoverTurnProvider>,
  );

describe('hover turn', () => {
  it('mounts exactly one shared canvas for any number of cards', async () => {
    stubDevice();
    showroom();
    expect(await screen.findAllByTestId('hover-stage')).toHaveLength(1);
  });

  it('turns only the hovered card in 3D, and puts the picture back on leaving', async () => {
    stubDevice();
    const user = userEvent.setup();
    showroom();
    await screen.findByTestId('hover-stage');
    expect(screen.queryByTestId('hover-car')).not.toBeInTheDocument();

    await user.hover(screen.getByText('Amaze picture'));
    const car = await screen.findByTestId('hover-car');
    expect(car).toHaveTextContent('Amaze');
    expect(screen.getAllByTestId('hover-car')).toHaveLength(1);

    await user.unhover(screen.getByText('Amaze picture'));
    expect(screen.queryByTestId('hover-car')).not.toBeInTheDocument();
    expect(screen.getByText('Amaze picture')).toBeVisible();
  });

  it('fades the flat picture out once the 3D car has drawn its first frame', async () => {
    stubDevice();
    const user = userEvent.setup();
    showroom();
    await screen.findByTestId('hover-stage');
    await user.hover(screen.getByText('City picture'));
    await screen.findByTestId('hover-car');
    const picture = screen.getByText('City picture').parentElement!;
    expect(picture).toHaveStyle({ opacity: '1' });
    act(() => hover.ready?.());
    expect(picture).toHaveStyle({ opacity: '0' });
  });

  it('keeps every card as a plain picture, with no canvas, when WebGL is missing', async () => {
    stubDevice({ webgl: false });
    const user = userEvent.setup();
    showroom();
    await user.hover(screen.getByText('City picture'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId('hover-stage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hover-car')).not.toBeInTheDocument();
  });

  it.each([
    ['the visitor prefers reduced motion', { reduced: true }],
    ['the device is on the low tier', { cores: 2 }],
    ['the device has no hover (touch)', { hoverable: false }],
  ])('does nothing when %s', async (_name, device) => {
    stubDevice(device);
    const user = userEvent.setup();
    showroom();
    await user.hover(screen.getByText('City picture'));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId('hover-stage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hover-car')).not.toBeInTheDocument();
  });

  it('works on a page with no provider: cards are just pictures', async () => {
    stubDevice();
    const user = userEvent.setup();
    render(
      <HoverTurnFrame spec={specFor('City')}>
        <p>City picture</p>
      </HoverTurnFrame>,
    );
    await user.hover(screen.getByText('City picture'));
    await waitFor(() => expect(screen.getByText('City picture')).toBeVisible());
    expect(screen.queryByTestId('hover-car')).not.toBeInTheDocument();
  });
});
