import { render, screen } from '@testing-library/react';
import { AiSourceChips, safeAssistantSourceUrl } from './AiSourceChips';

const sources = [
  { title: 'VSA Events', source_url: '/events', category: 'events' },
  { title: 'External Guide', source_url: 'https://example.com/guide', category: 'resources' },
  { title: 'Malicious source', source_url: 'javascript:alert(1)', category: 'other' },
  { title: 'Protocol relative', source_url: '//evil.example/path', category: 'other' },
  { title: 'Fifth source', source_url: 'https://example.com/fifth', category: 'other' },
];

describe('Ask VSA source chips (#241)', () => {
  it('keeps safe source destinations clickable and limits the visible chips to four', () => {
    render(<AiSourceChips messageId="test-message" sources={sources} />);
    expect(screen.getByRole('link', { name: 'Source: VSA Events' })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: 'Source: External Guide' })).toHaveAttribute('href', 'https://example.com/guide');
    expect(screen.queryByText('Fifth source')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('renders unsafe model-provided source URLs as plain text, never anchors', () => {
    render(<AiSourceChips messageId="test-message" sources={sources} />);
    expect(screen.getByText('Malicious source')).toBeInTheDocument();
    expect(screen.getByText('Protocol relative')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Source: Malicious source' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Source: Protocol relative' })).not.toBeInTheDocument();
  });

  it('keeps distinct sources with the same title independently clickable', () => {
    render(<AiSourceChips messageId="duplicate-titles" sources={[
      { title: 'Official VSA info', source_url: '/events', category: 'events' },
      { title: 'Official VSA info', source_url: '/ace', category: 'ace' },
    ]} />);
    const links = screen.getAllByRole('link', { name: 'Source: Official VSA info' });
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/events', '/ace']);
  });

  it('blocks backslash host tricks and malformed Unicode from model-provided links', () => {
    expect(safeAssistantSourceUrl('/\\\\evil.example')).toBe('/%5C%5Cevil.example');
    expect(safeAssistantSourceUrl('\uD800')).toBeNull();
  });

  it('renders no UI when the model supplies no citations', () => {
    const { container } = render(<AiSourceChips messageId="test-message" sources={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
