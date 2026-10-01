import { useMemo, useState } from 'react';

/**
 * TEMPORARY, deliberately small. A client-side name filter over a member list
 * the caller already holds. Now used only by the House assignment draft editor
 * (the Intern cohort editor uses the shared `MemberLinkPicker`).
 *
 * It is NOT a member-lookup architecture. When the House draft editor moves to
 * the shared `MemberLinkPicker` / `memberLookupRepository`, replace the
 * usages of this component and delete this file. The option shape matches
 * `MemberOption` there (id, first_name, last_name, college, year) so the swap is
 * mechanical.
 */
export interface MemberChoice {
  id: string;
  first_name: string;
  last_name: string;
  college: string | null;
  year: string | null;
}

export function memberChoiceName(member: Pick<MemberChoice, 'first_name' | 'last_name'>) {
  return `${member.first_name} ${member.last_name}`.trim();
}

export function memberChoiceDetail(member: Pick<MemberChoice, 'college' | 'year'>) {
  return [member.college, member.year].filter(Boolean).join(' · ');
}

interface MemberSearchSelectProps {
  members: MemberChoice[];
  value: string | null;
  onChange: (memberId: string | null) => void;
  disabled?: boolean;
  label: string;
  placeholder?: string;
}

const MAX_RESULTS = 8;

export function MemberSearchSelect({
  members,
  value,
  onChange,
  disabled = false,
  label,
  placeholder = 'Search members…',
}: MemberSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const selected = useMemo(() => members.find((member) => member.id === value) ?? null, [members, value]);

  const results = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (needle.length < 2) return [];
    const tokens = needle.split(/\s+/);
    return members
      .filter((member) => {
        const haystack = memberChoiceName(member).toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .slice(0, MAX_RESULTS);
  }, [members, term]);

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs" style={{ color: selected ? 'var(--color-text)' : 'var(--color-text3)' }}>
          {selected ? (
            <>
              {memberChoiceName(selected)}
              {memberChoiceDetail(selected) && <span style={{ color: 'var(--color-text3)' }}> · {memberChoiceDetail(selected)}</span>}
            </>
          ) : (
            'Not linked'
          )}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          aria-label={`${selected ? 'Change' : 'Link'} member for ${label}`}
          className="rounded border bg-transparent px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-[var(--color-surface2)] disabled:opacity-50"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          {selected ? 'Change' : 'Link'}
        </button>
        {selected && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label={`Unlink member for ${label}`}
            className="bg-transparent p-0 text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-50"
            style={{ color: 'var(--color-text2)' }}
          >
            Unlink
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-[220px]">
      <div className="flex gap-2">
        <input
          autoFocus
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={placeholder}
          aria-label={`Search members for ${label}`}
          className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)', color: 'var(--color-text)' }}
        />
        <button
          type="button"
          onClick={() => { setOpen(false); setTerm(''); }}
          className="bg-transparent p-0 text-[11px] font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--color-text2)' }}
        >
          Cancel
        </button>
      </div>
      {term.trim().length >= 2 && (
        <ul className="mt-1 divide-y rounded border" style={{ borderColor: 'var(--color-border)' }}>
          {results.length === 0 ? (
            <li className="px-2 py-1.5 text-[11px]" style={{ color: 'var(--color-text3)' }}>No members found.</li>
          ) : (
            results.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => { onChange(member.id); setOpen(false); setTerm(''); }}
                  className="block w-full bg-transparent px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface2)]"
                  style={{ color: 'var(--color-text)' }}
                >
                  {memberChoiceName(member)}
                  {memberChoiceDetail(member) && <span style={{ color: 'var(--color-text3)' }}> · {memberChoiceDetail(member)}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
