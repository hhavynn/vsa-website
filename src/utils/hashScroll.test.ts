import { keepHashTargetInView } from './hashScroll';

describe('keepHashTargetInView', () => {
  const frames: FrameRequestCallback[] = [];
  let requestAnimationFrameSpy: jest.SpyInstance;
  let cancelAnimationFrameSpy: jest.SpyInstance;

  beforeEach(() => {
    frames.length = 0;
    requestAnimationFrameSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frames.push(callback);
        return frames.length;
      });
    cancelAnimationFrameSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
    jest.restoreAllMocks();
  });

  it('continues scrolling after an asynchronously rendered target appears', () => {
    const stop = keepHashTargetInView('wrapped');

    frames.shift()?.(0);

    const target = document.createElement('section');
    target.id = 'wrapped';
    const scrollIntoView = jest.fn();
    Object.defineProperty(target, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    document.body.append(target);

    frames.shift()?.(16);
    frames.shift()?.(32);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);

    stop();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(4);
  });
});
