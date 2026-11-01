import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AceRowApplication } from '../../../hooks/useAceApplicationProfiles';
import { AceProfileDetails } from './AceProfileDetails';

const application: AceRowApplication = {
  little: null,
  big: null,
  bigName: null,
  warnings: [],
  suggestions: [
    { nodeId: 'fictional-big-1', name: 'Fictional Big One', score: 97, reasons: ['Same morning/night answer'] },
    { nodeId: 'fictional-big-2', name: 'Fictional Big Two', score: 43, reasons: ['Similar VSA activity'] },
  ],
};

describe('ACE application suggestion presentation (#647)', () => {
  it('keeps explainable order without displaying numeric compatibility ratings', () => {
    const onPickBig = jest.fn();
    render(
      <AceProfileDetails application={application} littleName="Fictional Little"
        editable busy={false} onPickBig={onPickBig} />,
    );
    const suggestions = screen.getByRole('list', { name: 'Suggested Bigs for Fictional Little' });
    const rows = within(suggestions).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Fictional Big One');
    expect(rows[0]).toHaveTextContent('Same morning/night answer');
    expect(rows[1]).toHaveTextContent('Fictional Big Two');
    expect(rows[1]).toHaveTextContent('Similar VSA activity');
    expect(screen.queryByText(/fit\s*\d+\s*\/\s*100/i)).not.toBeInTheDocument();
    expect(suggestions).not.toHaveTextContent('97/100');
    expect(suggestions).not.toHaveTextContent('43/100');
    expect(onPickBig).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {
      name: 'Assign Fictional Big Two as Big for Fictional Little',
    }));
    expect(onPickBig).toHaveBeenCalledTimes(1);
    expect(onPickBig).toHaveBeenCalledWith('fictional-big-2');
  });

  it('never shows a selection action on a read-only review', () => {
    const onPickBig = jest.fn();
    const { rerender } = render(
      <AceProfileDetails application={application} littleName="Fictional Little"
        editable={false} busy={false} onPickBig={onPickBig} />,
    );
    expect(screen.queryByRole('button', {
      name: 'Assign Fictional Big One as Big for Fictional Little',
    })).not.toBeInTheDocument();
    expect(screen.getByText('Same morning/night answer')).toBeInTheDocument();

    rerender(
      <AceProfileDetails application={application} littleName="Fictional Little"
        editable busy onPickBig={onPickBig} />,
    );
    expect(screen.getByRole('button', {
      name: 'Assign Fictional Big One as Big for Fictional Little',
    })).toBeDisabled();
    expect(onPickBig).not.toHaveBeenCalled();
  });
});
