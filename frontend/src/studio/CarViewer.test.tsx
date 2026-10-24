import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { buildCarSpec } from '../lib/carSpec';
import { CarViewer } from './CarViewer';
import type { SceneProps } from './types';

// The real scene needs a GPU. This stand-in records what it was given and lets a test drive its callbacks.
const scene = vi.hoisted(() => ({
  props: null as unknown,
  throwOnRender: false,
}));
vi.mock('./StudioScene', () => ({
  default: (props: SceneProps) => {
    scene.props = props;
    if (scene.throwOnRender) throw new Error('shader failed to compile');
    return (
      <div data-testid="scene" data-tier={props.tier} data-dpr={props.dpr} data-view={props.view} />
    );
  },
}));
// The real probe waits for twenty animation frames.
vi.mock('./quality', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  probeFrameTime: () => Promise.resolve(8),
}));

const spec = buildCarSpec({
  make: 'Honda',
  model: 'City',
  year: 2025,
  bodyStyle: 'SEDAN',
  colorOptions: ['#c0392b'],
});
const sceneProps = () => scene.props as SceneProps;

type Device = {
  webgl?: boolean;
  reducedMotion?: boolean;
  coarse?: boolean;
  saveData?: boolean;
  cores?: number;
  memory?: number;
};

function stubDevice({
  webgl = true,
  reducedMotion = false,
  coarse = false,
  saveData = false,
  cores = 12,
  memory = 16,
}: Device = {}) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
    webgl ? {} : null) as never);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') ? reducedMotion : query.includes('coarse') ? coarse : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal('devicePixelRatio', 2);
  vi.stubGlobal('navigator', {
    hardwareConcurrency: cores,
    deviceMemory: memory,
    connection: { saveData },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  scene.throwOnRender = false;
  scene.props = null;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const svgCar = () => screen.queryByRole('img', { name: spec.description });

describe('CarViewer with WebGL', () => {
  it('draws the SVG car at once, then swaps in the 3D scene once it reports ready', async () => {
    stubDevice();
    render(<CarViewer spec={spec} />);
    expect(svgCar()).toBeInTheDocument();
    const stage = await screen.findByTestId('scene');
    expect(stage).toHaveAttribute('data-tier', 'high');
    expect(stage).toHaveAttribute('data-dpr', '1.5');
    act(() => sceneProps().onReady());
    expect(svgCar()).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: new RegExp(spec.description) })).toBeInTheDocument();
  });

  it('describes the 3D view to screen readers with the same description as the SVG', async () => {
    stubDevice();
    render(<CarViewer spec={spec} />);
    await screen.findByTestId('scene');
    act(() => sceneProps().onReady());
    expect(screen.getByRole('img', { name: /Honda City.*sedan.*red.*3D/i })).toBeInTheDocument();
  });

  it('passes the chosen view to the scene and rotates with the arrow keys', async () => {
    stubDevice();
    const user = userEvent.setup();
    render(<CarViewer spec={spec} interactive />);
    await screen.findByTestId('scene');
    act(() => sceneProps().onReady());
    await user.selectOptions(screen.getByLabelText('View'), 'rear');
    expect(screen.getByTestId('scene')).toHaveAttribute('data-view', 'rear');
    expect(sceneProps().nudge).toBe(0);
    screen.getByRole('group', { name: /3D viewer/i }).focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}');
    expect(sceneProps().nudge).toBe(1);
  });
});

describe('CarViewer hotspots', () => {
  it('hands the markers and an overlay element to the scene', async () => {
    stubDevice();
    const hotspots = [{ id: 'body' as const, label: 'Body', text: 'Sedan, 2025' }];
    render(<CarViewer spec={spec} hotspots={hotspots} />);
    await screen.findByTestId('scene');
    expect(sceneProps().hotspots).toEqual(hotspots);
    expect(sceneProps().overlay?.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe('CarViewer quality tier', () => {
  it('records the chosen tier on the 3D area, for debugging and checks', async () => {
    stubDevice();
    render(<CarViewer spec={spec} />);
    await screen.findByTestId('scene');
    expect(screen.getByTestId('scene').closest('[data-tier]')).toHaveAttribute('data-tier', 'high');
  });
});

describe('CarViewer purchase moment', () => {
  it('passes a moment counter to the scene that rises with each purchase', async () => {
    stubDevice();
    const { rerender } = render(<CarViewer spec={spec} moment={0} />);
    await screen.findByTestId('scene');
    expect(sceneProps().moment).toBe(0);
    rerender(<CarViewer spec={spec} moment={1} />);
    expect(sceneProps().moment).toBe(1);
  });

  it('defaults to no moment', async () => {
    stubDevice();
    render(<CarViewer spec={spec} />);
    await screen.findByTestId('scene');
    expect(sceneProps().moment).toBe(0);
  });
});

describe('CarViewer intro', () => {
  it('plays the clay-to-render intro once per session and lets the visitor skip it', async () => {
    stubDevice();
    const user = userEvent.setup();
    const { unmount } = render(<CarViewer spec={spec} intro />);
    await screen.findByTestId('scene');
    expect(sceneProps().intro).toBe(true);
    expect(screen.queryByRole('button', { name: /skip intro/i })).not.toBeInTheDocument();
    act(() => sceneProps().onReady());
    await user.click(screen.getByRole('button', { name: /skip intro/i }));
    expect(sceneProps().intro).toBe(false);
    expect(screen.queryByRole('button', { name: /skip intro/i })).not.toBeInTheDocument();
    unmount();

    render(<CarViewer spec={spec} intro />);
    await screen.findByTestId('scene');
    expect(sceneProps().intro).toBe(false);
  });

  it('ends by itself when the scene says the intro is over', async () => {
    stubDevice();
    render(<CarViewer spec={spec} intro />);
    await screen.findByTestId('scene');
    act(() => sceneProps().onReady());
    act(() => sceneProps().onIntroDone?.());
    expect(screen.queryByRole('button', { name: /skip intro/i })).not.toBeInTheDocument();
  });

  it('does nothing unless the page asks for it', async () => {
    stubDevice();
    render(<CarViewer spec={spec} />);
    await screen.findByTestId('scene');
    expect(sceneProps().intro).toBe(false);
  });
});

describe('CarViewer fallbacks to the SVG car', () => {
  async function staysSvg() {
    expect(svgCar()).toBeInTheDocument();
    // Give a wrongly mounted scene time to appear.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    expect(svgCar()).toBeInTheDocument();
  }

  it('without WebGL', async () => {
    stubDevice({ webgl: false });
    render(<CarViewer spec={spec} />);
    await staysSvg();
  });

  it('when the visitor prefers reduced motion', async () => {
    stubDevice({ reducedMotion: true });
    render(<CarViewer spec={spec} />);
    await staysSvg();
  });

  it('when Save-Data is on', async () => {
    stubDevice({ saveData: true });
    render(<CarViewer spec={spec} />);
    await staysSvg();
  });

  it('on a low-tier phone', async () => {
    stubDevice({ coarse: true, cores: 4 });
    render(<CarViewer spec={spec} />);
    await staysSvg();
  });

  it('hides the view controls while the SVG is showing', async () => {
    stubDevice({ webgl: false });
    render(<CarViewer spec={spec} interactive />);
    await staysSvg();
    expect(screen.queryByLabelText('View')).not.toBeInTheDocument();
  });

  it('when the scene throws, and says nothing alarming', async () => {
    stubDevice();
    scene.throwOnRender = true;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CarViewer spec={spec} />);
    await waitFor(() => expect(quiet).toHaveBeenCalled());
    await waitFor(() => expect(svgCar()).toBeInTheDocument());
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('while the WebGL context is lost, and back to 3D when it is restored', async () => {
    stubDevice();
    render(<CarViewer spec={spec} />);
    await screen.findByTestId('scene');
    act(() => sceneProps().onReady());
    act(() => sceneProps().onContextLost());
    expect(svgCar()).toBeInTheDocument();
    act(() => sceneProps().onContextRestored());
    expect(svgCar()).not.toBeInTheDocument();
    expect(screen.getByTestId('scene')).toBeInTheDocument();
  });
});
