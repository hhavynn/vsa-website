import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout';

// Simulate a rejected dynamic import of the optional Ask VSA module. The main
// public page must remain usable even if its assistant bundle cannot load.
jest.mock('../features/ai/VsaAiAssistant', () => {
  throw new Error('Synthetic Ask VSA module load failure');
});
jest.mock('./navigation/NavigationShell', () => ({ NavigationShell: () => <nav>Site navigation</nav> }));
jest.mock('./navigation/MobileQuickDock', () => ({ MobileQuickDock: () => <aside>Mobile navigation</aside> }));
jest.mock('./Footer', () => ({ __esModule: true, default: () => <footer>Site footer</footer> }));
jest.mock('./BackToTop', () => ({ BackToTop: () => null }));
jest.mock('../features/search/PublicSearchProvider', () => ({
  PublicSearchProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

it('keeps the public page, navigation and footer when the optional assistant chunk fails', async () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  const originalScrollTo = window.scrollTo;
  window.scrollTo = jest.fn();
  try {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<h1>Fictional public content</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('status')).toHaveTextContent('Ask VSA is temporarily unavailable.');
    expect(screen.getByRole('heading', { name: 'Fictional public content' })).toBeInTheDocument();
    expect(screen.getByText('Site navigation')).toBeInTheDocument();
    expect(screen.getByText('Site footer')).toBeInTheDocument();
    expect(screen.getByText('Mobile navigation')).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  } finally {
    window.scrollTo = originalScrollTo;
    errorSpy.mockRestore();
  }
});
