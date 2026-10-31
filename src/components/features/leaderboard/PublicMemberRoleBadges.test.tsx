import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PublicMemberRole } from '../../../lib/memberRoles';
import { PublicMemberRoleBadges } from './PublicMemberRoleBadges';

const role = (kind: PublicMemberRole['kind'], label: string): PublicMemberRole => ({
  memberId: 'fictional-member',
  kind,
  label,
  academicYearStart: 2026,
  sourceType: 'cabinet_members',
  relatedKey: null,
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


describe('House navigation confined to member profile (#627)', () => {
  const house = { houseProfileId: 'fictional-profile', houseKey: 'fictional',
    label: 'Fictional House', accentColor: null, academicYearStart: 2026 };
  it('keeps House a non-interactive span by default (inside row buttons)', () => {
    render(<PublicMemberRoleBadges roles={[]} house={house} compact />);
    expect(screen.getByText('House · Fictional House')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('links a modal House to the verified exact year, without nesting a button', () => {
    render(<MemoryRouter><PublicMemberRoleBadges roles={[]}
      house={house} houseTo="/house/year/2026-2027/fictional"
      houseYearLabel="2026-2027" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Open Fictional House House page for 2026-2027' }))
      .toHaveAttribute('href', '/house/year/2026-2027/fictional');
    expect(screen.getByText('House · Fictional House · 2026-2027')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
  it('styles all nine allowlisted roles and never renders HTML from role labels', () => {
    const kinds: PublicMemberRole['kind'][] = [
      'board', 'cabinet_position', 'house_parent', 'ace_fam_head', 'intern',
      'vcn_choreographer', 'vcn_dancer', 'vcn_stage_ninja', 'vcn_props_member',
    ];
    render(<PublicMemberRoleBadges roles={kinds.map((kind) => role(kind, kind + '<b>'))} />);
    for (const kind of kinds) expect(screen.getByText(kind + '<b>')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
