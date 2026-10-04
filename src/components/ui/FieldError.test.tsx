import { render, screen } from '@testing-library/react';
import { FieldError, FormAlert } from './FieldError';

describe('FieldError', () => {
  it('carries the error in an icon and message, announced to assistive tech', () => {
    render(<FieldError id="email-error" message="Enter a valid email address" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('id', 'email-error');
    expect(alert).toHaveTextContent('Enter a valid email address');
    expect(screen.getByTestId('error-icon')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses readable red tokens for both themes instead of red-400 on cream', () => {
    render(<FieldError message="Required" />);
    const alert = screen.getByRole('alert');
    expect(alert.className).toMatch(/text-red-700/);
    expect(alert.className).toMatch(/dark:text-red-300/);
    expect(alert.className).not.toMatch(/text-red-400/);
  });

  it('can stay silent when a form summary already announces the problem', () => {
    render(<FieldError announce={false} message="Pick a photo" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Pick a photo')).toBeInTheDocument();
  });

  it('renders nothing without a message', () => {
    const { container } = render(<FieldError message="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FormAlert', () => {
  it('pairs an icon with the message text', () => {
    render(<FormAlert>Sign-in failed</FormAlert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed');
    expect(screen.getByTestId('error-icon')).toHaveAttribute('aria-hidden', 'true');
  });
});
