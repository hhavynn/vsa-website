import { render, screen } from '@testing-library/react';
import type { PublicMemberRole } from '../../../lib/memberRoles';
import { PublicMemberRoleBadges } from './PublicMemberRoleBadges';

const role = (kind: PublicMemberRole['kind'], label: string): PublicMemberRole => ({
  memberId: 'fictional-member',
  kind,
  label,
  academicYearStart: 2026,
  sourceType: 'cabinet_members',
});

describe('shared public member role badges (#627)', () => {
  it('renders all simultaneous published roles as separate wrapping chips', () => {
    render(<PublicMemberRoleBadges
      roles={[
        role('board', 'Board Member'),
        role('cabinet_position', 'Events Chair'),
        role('cabinet_position', 'PR Chair'),
        role('intern', 'Intern'),
      ]}
      compact
    />);
    expect(screen.getByLabelText('Verified VSA roles')).toHaveClass('flex-wrap', 'min-w-0');
    for (const label of ['Board Member', 'Events Chair', 'PR Chair', 'Intern']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText(/Board Member|Events Chair|PR Chair|Intern/)).toHaveLength(4);
  });

  it('renders nothing for a member without verified public identities', () => {
    const { container } = render(<PublicMemberRoleBadges roles={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('VSA MEMBER')).not.toBeInTheDocument();
  });

  it('escapes arbitrary published position labels as text instead of interpreting markup', () => {
    const scriptLike = '<img src=x onerror=alert(1)>';
    render(<PublicMemberRoleBadges roles={[role('cabinet_position', scriptLike)]} />);
    expect(screen.getByText(scriptLike)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
