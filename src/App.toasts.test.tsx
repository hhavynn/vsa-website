import fs from 'fs';
import path from 'path';
import { act, render, screen } from '@testing-library/react';
import toast from 'react-hot-toast';
import App from './App';

// react-hot-toast draws every toast once per mounted <Toaster>, so App's must
// stay the only one.

jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('./data/repos/photoRequests', () => ({
  photoRequestsRepository: { listPhotoRequests: async () => [] },
}));
jest.mock('./routes', () => {
  const { default: PhotoRequestsTab } = jest.requireActual('./components/features/admin/PhotoRequestsTab');
  const { MemoryRouter: Router } = jest.requireActual('react-router-dom');
  return { __esModule: true, default: () => <Router><PhotoRequestsTab /></Router> };
});

afterEach(() => {
  act(() => toast.remove());
});

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('toasts', () => {
  it('shows one toast when an admin page is open inside App', async () => {
    render(<App />);
    await screen.findByRole('button', { name: /pending/i });

    act(() => {
      toast.success('Saved the thing');
    });

    expect(await screen.findAllByText('Saved the thing')).toHaveLength(1);
  });

  it('mounts a Toaster only in App', () => {
    const src = path.resolve(__dirname);
    const mounts = sourceFiles(src)
      .filter((file) => /<Toaster\b/.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(src, file).split(path.sep).join('/'));

    expect(mounts).toEqual(['App.tsx']);
  });
});
