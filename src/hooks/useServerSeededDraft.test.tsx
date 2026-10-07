import { act, renderHook } from '@testing-library/react';
import { useServerSeededDraft } from './useServerSeededDraft';

type Draft = { title: string };

function setup(initialKey: string, initialServer: Draft) {
  return renderHook(({ recordKey, server }) => useServerSeededDraft<Draft>(recordKey, server), {
    initialProps: { recordKey: initialKey, server: initialServer },
  });
}

describe('useServerSeededDraft', () => {
  it('starts from the server record', () => {
    const { result } = setup('a', { title: 'one' });
    expect(result.current.draft).toEqual({ title: 'one' });
    expect(result.current.isDirty).toBe(false);
  });

  it('follows the server while the draft is untouched', () => {
    const { result, rerender } = setup('a', { title: 'one' });
    rerender({ recordKey: 'a', server: { title: 'two' } });
    expect(result.current.draft).toEqual({ title: 'two' });
  });

  it('is not disturbed by a new but equal server object', () => {
    const { result, rerender } = setup('a', { title: 'one' });
    act(() => result.current.setDraft({ title: 'typed' }));
    rerender({ recordKey: 'a', server: { title: 'one' } });
    expect(result.current.draft).toEqual({ title: 'typed' });
    expect(result.current.isDirty).toBe(true);
  });

  it('keeps unsaved edits when the server record changes underneath them', () => {
    const { result, rerender } = setup('a', { title: 'one' });
    act(() => result.current.setDraft((current) => ({ ...current, title: 'typed' })));
    rerender({ recordKey: 'a', server: { title: 'changed elsewhere' } });
    expect(result.current.draft).toEqual({ title: 'typed' });
    expect(result.current.isDirty).toBe(true);
  });

  it('replaces the draft when a different record is opened, even if dirty', () => {
    const { result, rerender } = setup('a', { title: 'one' });
    act(() => result.current.setDraft({ title: 'typed' }));
    rerender({ recordKey: 'b', server: { title: 'other record' } });
    expect(result.current.draft).toEqual({ title: 'other record' });
    expect(result.current.isDirty).toBe(false);
  });

  it('lets the server copy in again once the draft is saved', () => {
    const { result, rerender } = setup('a', { title: 'one' });
    act(() => result.current.setDraft({ title: 'typed' }));
    rerender({ recordKey: 'a', server: { title: 'changed elsewhere' } });
    act(() => result.current.markSaved());
    // The held-back copy is adopted straight away...
    expect(result.current.draft).toEqual({ title: 'changed elsewhere' });
    // ...and later server changes keep flowing in.
    rerender({ recordKey: 'a', server: { title: 'normalized by save' } });
    expect(result.current.draft).toEqual({ title: 'normalized by save' });
    expect(result.current.isDirty).toBe(false);
  });

  it('keeps what was typed when saved and the server has nothing newer to say', () => {
    const { result } = setup('a', { title: 'one' });
    act(() => result.current.setDraft({ title: 'typed' }));
    act(() => result.current.markSaved());
    expect(result.current.draft).toEqual({ title: 'typed' });
    expect(result.current.isDirty).toBe(false);
  });

  it('discard shows the current server copy', () => {
    const { result, rerender } = setup('a', { title: 'one' });
    act(() => result.current.setDraft({ title: 'typed' }));
    rerender({ recordKey: 'a', server: { title: 'two' } });
    act(() => result.current.discard());
    expect(result.current.draft).toEqual({ title: 'two' });
    expect(result.current.isDirty).toBe(false);
  });
});
