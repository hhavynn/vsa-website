import { render, screen, within } from '@testing-library/react';
import { ImportStepper } from './ImportStepper';

describe('ImportStepper', () => {
  it('says nothing is written while choosing the event and sheet', () => {
    render(<ImportStepper step="configure" />);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing has been written');
    const steps = within(screen.getByRole('list', { name: 'Import progress' })).getAllByRole('listitem');
    expect(steps[0]).toHaveAttribute('aria-current', 'step');
    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual(['current', 'todo', 'todo']);
  });

  it('marks the review step as preview-only, with the write boundary spelled out', () => {
    render(<ImportStepper step="preview" />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Preview only. Nothing has been saved yet.');
    expect(banner).toHaveTextContent('written only when you press Import');
    const steps = screen.getAllByRole('listitem');
    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual(['done', 'current', 'todo']);
  });

  it('flags rows that still need a decision on the review step', () => {
    const { rerender } = render(<ImportStepper step="preview" unresolved={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('3 rows need your decision');
    rerender(<ImportStepper step="preview" unresolved={1} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 row needs your decision');
    rerender(<ImportStepper step="preview" unresolved={0} />);
    expect(screen.getByRole('status')).not.toHaveTextContent('decision');
  });

  it('confirms the write only after the import has finished', () => {
    render(<ImportStepper step="done" unresolved={5} />);
    expect(screen.getByRole('status')).toHaveTextContent('Import finished.');
    expect(screen.getByRole('status')).not.toHaveTextContent('decision');
    expect(screen.getAllByRole('listitem').map((step) => step.getAttribute('data-state'))).toEqual(['done', 'done', 'current']);
  });
});
