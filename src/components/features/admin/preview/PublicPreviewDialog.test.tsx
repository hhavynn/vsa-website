import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { PublicPreviewDialog } from './PublicPreviewDialog';

function frameDocument() {
  const frame = screen.getByTitle(/Public preview of/) as HTMLIFrameElement;
  return frame.contentDocument!;
}

describe('PublicPreviewDialog', () => {
  it('labels the preview and renders the content inside the preview frame', () => {
    render(
      <PublicPreviewDialog title="Fall GBM" surface="/events" notice="Draft — hidden" onClose={jest.fn()}>
        <h2>Public card</h2>
      </PublicPreviewDialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Fall GBM' })).toBeInTheDocument();
    expect(screen.getByText(/Preview · Not published/)).toBeInTheDocument();
    expect(screen.getByText('Draft — hidden')).toBeInTheDocument();
    expect(frameDocument().body.textContent).toContain('Public card');
  });

  it('blocks links and buttons inside the preview from acting', () => {
    const onPublicAction = jest.fn();
    render(
      <PublicPreviewDialog title="Fall GBM" surface="/events" onClose={jest.fn()}>
        <button type="button" onClick={onPublicAction}>Going</button>
        <a href="https://forms.example/apply">Apply</a>
      </PublicPreviewDialog>,
    );

    const frame = within(frameDocument().body);
    const button = frame.getByRole('button', { name: 'Going' });
    const link = frame.getByRole('link', { name: 'Apply' });
    act(() => {
      button.click();
    });
    const linkClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => {
      link.dispatchEvent(linkClick);
    });

    expect(onPublicAction).not.toHaveBeenCalled();
    expect(linkClick.defaultPrevented).toBe(true);
  });

  it('switches placements and closes on Escape, restoring focus to the opener', () => {
    const onClose = jest.fn();
    const onPlacementChange = jest.fn();
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(
      <PublicPreviewDialog
        title="Fall GBM"
        surface="/events"
        placements={[{ key: 'featured', label: 'Next up' }, { key: 'memory', label: 'Memory wall' }]}
        placement="featured"
        onPlacementChange={onPlacementChange}
        onClose={onClose}
      >
        <p>Card</p>
      </PublicPreviewDialog>,
    );

    expect(screen.getByRole('button', { name: /Back to editing/ })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Memory wall' }));
    expect(onPlacementChange).toHaveBeenCalledWith('memory');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
