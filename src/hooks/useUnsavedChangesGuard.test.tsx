import { fireEvent, render, screen } from '@testing-library/react';
import {
  confirmLeaveIfUnsaved,
  hasUnsavedChanges,
  useUnsavedChangesGuard,
} from './useUnsavedChangesGuard';

function Guard({ dirty }: { dirty: boolean }) {
  useUnsavedChangesGuard(dirty);
  return null;
}

function TwoEditors({ first, second }: { first: boolean; second: boolean }) {
  return (
    <div>
      <Guard dirty={first} />
      <Guard dirty={second} />
      {/* Suppress JSDOM's navigation after a successful confirmation. */}
      <a href="/admin/events" onClick={(event) => event.preventDefault()}>Other admin page</a>
    </div>
  );
}

describe('shared admin unsaved-navigation guard (#258)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('asks only once for two dirty editors when the user cancels navigation', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const { unmount } = render(<TwoEditors first second />);
    expect(hasUnsavedChanges()).toBe(true);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    screen.getByRole('link', { name: 'Other admin page' }).dispatchEvent(event);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('asks only once for two dirty editors when the user agrees to leave', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { unmount } = render(<TwoEditors first second />);
    fireEvent.click(screen.getByRole('link', { name: 'Other admin page' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('promotes the other dirty editor after the first is saved or unmounted', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const { rerender, unmount } = render(<TwoEditors first second />);
    rerender(<TwoEditors first={false} second />);
    expect(hasUnsavedChanges()).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Other admin page' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    rerender(<TwoEditors first={false} second={false} />);
    expect(hasUnsavedChanges()).toBe(false);
    fireEvent.click(screen.getByRole('link', { name: 'Other admin page' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('keeps programmatic navigation on the shared single confirmation path', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const { unmount } = render(<TwoEditors first second />);
    expect(confirmLeaveIfUnsaved()).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    expect(confirmLeaveIfUnsaved()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
    unmount();
    expect(confirmLeaveIfUnsaved()).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
