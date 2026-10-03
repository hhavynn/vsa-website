import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describeUploadRejection } from '../../../lib/imageUpload';
import { ImageDropzone } from './ImageDropzone';

const png = (name = 'a.png', bytes = 1024) => new File([new Uint8Array(bytes)], name, { type: 'image/png' });

function drop(input: HTMLElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

describe('ImageDropzone', () => {
  it('previews a valid file and reports it to the form', async () => {
    const onSelect = jest.fn();
    render(<ImageDropzone preset="event" onSelect={onSelect} />);
    drop(screen.getByTestId('image-dropzone-input'), [png()]);
    // The file is reported first (preview still the old one), then again with the preview.
    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    expect(onSelect.mock.calls[0][0].name).toBe('a.png');
    expect(onSelect.mock.calls[0][1]).toBeNull();
    await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(2));
    expect(onSelect.mock.calls[1][0]).toBe(onSelect.mock.calls[0][0]);
    expect(onSelect.mock.calls[1][1]).toMatch(/^data:image\/png/);
  });

  it('tells the admin when a file is too large instead of dropping it silently', async () => {
    const onSelect = jest.fn();
    render(<ImageDropzone preset="event" onSelect={onSelect} />);
    drop(screen.getByTestId('image-dropzone-input'), [png('huge.png', 11 * 1024 * 1024)]);
    expect(await screen.findByRole('alert')).toHaveTextContent('huge.png is 11.0 MB. The limit is 10.0 MB');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('tells the admin when the type is unsupported', async () => {
    render(<ImageDropzone preset="event" onSelect={jest.fn()} />);
    drop(screen.getByTestId('image-dropzone-input'), [
      new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
    ]);
    expect(await screen.findByRole('alert')).toHaveTextContent("doc.pdf isn't a supported image");
  });

  it('shows the current preview, file details and a remove button', () => {
    const onClear = jest.fn();
    render(
      <ImageDropzone
        preset="cabinet"
        previewUrl="data:image/png;base64,AAAA"
        file={png('me.png', 2048)}
        onSelect={jest.fn()}
        onClear={onClear}
      />,
    );
    expect(screen.getByAltText('Preview')).toBeInTheDocument();
    expect(screen.getByText('me.png · 2 KB')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('accepts SVG only when the form opts in (site logo)', async () => {
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' });
    const refused = jest.fn();
    const { unmount } = render(<ImageDropzone preset="logo" onSelect={refused} />);
    drop(screen.getByTestId('image-dropzone-input'), [svg]);
    expect(await screen.findByRole('alert')).toHaveTextContent("logo.svg isn't a supported image");
    expect(refused).not.toHaveBeenCalled();
    unmount();

    const accepted = jest.fn();
    render(<ImageDropzone preset="logo" allowSvg onSelect={accepted} />);
    drop(screen.getByTestId('image-dropzone-input'), [svg]);
    await waitFor(() => expect(accepted).toHaveBeenCalled());
  });

  it('explains the preset limits up front', () => {
    render(<ImageDropzone preset="galleryCover" onSelect={jest.fn()} />);
    expect(screen.getByText(/up to 10\.0 MB.*1400×900/)).toBeInTheDocument();
  });
});

describe('describeUploadRejection', () => {
  it('falls back to a generic message for unknown errors', () => {
    expect(
      describeUploadRejection({ file: { name: 'x.png', size: 1 }, errors: [{ code: 'weird' }] }, 'avatar'),
    ).toContain('x.png');
  });
});
