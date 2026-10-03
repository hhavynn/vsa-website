import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('ImageDropzone stale reads', () => {
  // Controllable FileReader: reads finish only when the test says so.
  class FakeReader {
    static all: FakeReader[] = [];
    static ignoreAbort = false;
    result: string | null = null;
    aborted = false;
    onload: (() => void) | null = null;
    file!: File;
    readAsDataURL(file: File) {
      this.file = file;
      FakeReader.all.push(this);
    }
    abort() {
      if (!FakeReader.ignoreAbort) this.aborted = true;
    }
    finish() {
      if (this.aborted) return;
      this.result = `data:image/png;base64,${this.file.name}`;
      this.onload?.();
    }
  }

  const realReader = global.FileReader;
  beforeEach(() => {
    FakeReader.all = [];
    FakeReader.ignoreAbort = false;
    (global as unknown as { FileReader: unknown }).FileReader = FakeReader;
  });
  afterEach(() => {
    (global as unknown as { FileReader: unknown }).FileReader = realReader;
  });

  function Harness({ initialPreview = null }: { initialPreview?: string | null }) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(initialPreview);
    return (
      <>
        <ImageDropzone
          preset="event"
          file={file}
          previewUrl={preview}
          onSelect={(f, p) => {
            setFile(f);
            setPreview(p);
          }}
          onClear={() => {
            setFile(null);
            setPreview(null);
          }}
        />
        <button type="button" onClick={() => { setFile(null); setPreview(null); }}>
          external reset
        </button>
      </>
    );
  }

  const pick = async (name: string, expectedReaders: number) => {
    drop(screen.getByTestId('image-dropzone-input'), [png(name)]);
    await waitFor(() => expect(FakeReader.all).toHaveLength(expectedReaders));
  };

  it.each([
    ['abort() works', false],
    ['abort() is ignored (generation check alone must hold)', true],
  ])('keeps B when A finishes last (%s)', async (_label, ignoreAbort) => {
    FakeReader.ignoreAbort = ignoreAbort;
    render(<Harness />);

    await pick('a.png', 1);
    await pick('b.png', 2);
    // B is the current file immediately, before any read has finished.
    expect(screen.getByText(/^b\.png ·/)).toBeInTheDocument();

    act(() => FakeReader.all[1].finish()); // B finishes first
    act(() => FakeReader.all[0].finish()); // A finishes last: must be ignored

    expect(screen.getByText(/^b\.png ·/)).toBeInTheDocument();
    expect(screen.queryByText(/^a\.png ·/)).not.toBeInTheDocument();
    expect(screen.getByAltText('Preview')).toHaveAttribute('src', 'data:image/png;base64,b.png');
  });

  it('aborts the previous read when a new file is picked', async () => {
    render(<Harness />);
    await pick('a.png', 1);
    await pick('b.png', 2);
    expect(FakeReader.all[0].aborted).toBe(true);
    expect(FakeReader.all[1].aborted).toBe(false);
  });

  it('does not resurrect an image that was cleared while a read was active', async () => {
    FakeReader.ignoreAbort = true;
    render(<Harness initialPreview="data:image/png;base64,old" />);
    await pick('a.png', 1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    act(() => FakeReader.all[0].finish());

    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    expect(screen.queryByText(/^a\.png ·/)).not.toBeInTheDocument();
  });

  it('does not resurrect an image the form reset itself while a read was active', async () => {
    FakeReader.ignoreAbort = true;
    render(<Harness />);
    await pick('a.png', 1);

    fireEvent.click(screen.getByRole('button', { name: 'external reset' }));
    act(() => FakeReader.all[0].finish());

    expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
    expect(screen.queryByText(/^a\.png ·/)).not.toBeInTheDocument();
  });

  it('ignores a read that finishes after unmount', async () => {
    FakeReader.ignoreAbort = true;
    const onSelect = jest.fn();
    const { unmount } = render(<ImageDropzone preset="event" onSelect={onSelect} />);
    drop(screen.getByTestId('image-dropzone-input'), [png('a.png')]);
    await waitFor(() => expect(FakeReader.all).toHaveLength(1));
    const callsBefore = onSelect.mock.calls.length;
    unmount();
    act(() => FakeReader.all[0].finish());
    expect(onSelect.mock.calls.length).toBe(callsBefore);
  });
});
