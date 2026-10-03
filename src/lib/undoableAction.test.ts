import { flushAllPendingUndoables, pendingUndoableCount, scheduleUndoable } from './undoableAction';

describe('scheduleUndoable', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('commits only after the undo window', async () => {
    const commit = jest.fn().mockResolvedValue(undefined);
    const onCommitted = jest.fn();
    scheduleUndoable({ commit, onCommitted, delayMs: 5000 });
    jest.advanceTimersByTime(4999);
    expect(commit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it('never commits once undone', () => {
    const commit = jest.fn();
    const handle = scheduleUndoable({ commit, delayMs: 1000 });
    expect(handle.cancel()).toBe(true);
    jest.advanceTimersByTime(5000);
    expect(commit).not.toHaveBeenCalled();
    expect(pendingUndoableCount()).toBe(0);
  });

  it('cannot undo after the write has started', async () => {
    const handle = scheduleUndoable({ commit: jest.fn(), delayMs: 100 });
    jest.advanceTimersByTime(100);
    expect(handle.cancel()).toBe(false);
    expect(handle.settled).toBe(true);
  });

  it('reports a failed commit so the page can restore the row', async () => {
    const onError = jest.fn();
    const onCommitted = jest.fn();
    const handle = scheduleUndoable({ commit: () => Promise.reject(new Error('fk')), onError, onCommitted, delayMs: 10 });
    await handle.flush();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onCommitted).not.toHaveBeenCalled();
  });

  it('flushes everything pending exactly once when the page is left', async () => {
    const a = jest.fn();
    const b = jest.fn();
    scheduleUndoable({ commit: a, delayMs: 60000 });
    scheduleUndoable({ commit: b, delayMs: 60000 });
    await flushAllPendingUndoables();
    await flushAllPendingUndoables();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
