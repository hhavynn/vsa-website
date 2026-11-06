import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useVsaAiConversation } from './useVsaAiConversation';

const initialFetch = globalThis.fetch;
const originalUrl = process.env.REACT_APP_SUPABASE_URL;
const originalKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
function Probe() {
  const { messages, sendMessage } = useVsaAiConversation('/events');
  return <div>
    <button onClick={() => { void sendMessage('When is the next GBM?'); }}>Ask</button>
    {messages.filter((message) => message.role === 'assistant').map((message) =>
      <p key={message.id}>{message.content}</p>)}
  </div>;
}

beforeEach(() => {
  localStorage.clear();
  process.env.REACT_APP_SUPABASE_URL = 'https://example.supabase.co';
  process.env.REACT_APP_SUPABASE_ANON_KEY = 'synthetic-key';
  globalThis.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ answer: 'Check the Events page.', status: 'answered', sources: [] }),
  }) as unknown as typeof fetch;
});
afterEach(() => {
  jest.restoreAllMocks();
  globalThis.fetch = initialFetch;
  if (originalUrl === undefined) delete process.env.REACT_APP_SUPABASE_URL;
  else process.env.REACT_APP_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.REACT_APP_SUPABASE_ANON_KEY;
  else process.env.REACT_APP_SUPABASE_ANON_KEY = originalKey;
});

describe('Ask VSA browser-storage fallback', () => {
  it.each(['getItem', 'setItem'] as const)('still sends a question if storage %s throws', async (method) => {
    jest.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    render(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Check the Events page.')).toBeInTheDocument();
    const calls = (globalThis.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0][1].body)) as { sessionId: string; message: string };
    expect(body).toMatchObject({ message: 'When is the next GBM?' });
    expect(body.sessionId.length).toBeGreaterThan(0);
  });

  it('preserves the existing session when browser storage works', async () => {
    localStorage.setItem('vsa-ai-assistant-session', 'existing-session');
    render(<Probe />);
    await userEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Check the Events page.')).toBeInTheDocument();
    const calls = (globalThis.fetch as jest.Mock).mock.calls;
    const body = JSON.parse(String(calls[0][1].body)) as { sessionId: string };
    expect(body.sessionId).toBe('existing-session');
  });
});
