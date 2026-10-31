// Admin-only list of the addresses that identify a member on future imports.
// Removing one never touches attendance or points; it only stops that address
// from matching this member (for example an address remembered for the wrong
// person). Emails are private: this renders only inside Admin → Members.
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { memberIdentityRepository, MemberIdentityEmail } from '../../../data/repos/memberIdentity';
import { normalizeEmail } from '../../../lib/memberMatching';
import { cn } from '../../../lib/utils';

const HOW: Record<MemberIdentityEmail['verification_method'], string> = {
  primary_email: 'contact email',
  unique_name_college_year: 'import: same name, college and year',
  admin_confirmed: 'import: matched by an admin',
  same_submission: 'import: same sign-in as a known email',
  admin_entered: 'added by an admin',
};

export function MemberIdentityEmails({ memberId, contactEmail }: { memberId: string; contactEmail: string | null }) {
  const queryClient = useQueryClient();
  const key = ['member-identity-emails', memberId];
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => memberIdentityRepository.listMemberEmails(memberId),
  });
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: (email: string) => memberIdentityRepository.addMemberEmail(memberId, email),
    onSuccess: () => { setDraft(''); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => memberIdentityRepository.removeMemberEmail(id),
    onSuccess: () => { setConfirming(null); refresh(); },
  });
  const normalized = normalizeEmail(draft);
  // The contact email identifies the member on its own (imports read members.email
  // too), so removing only its alias would change nothing: change the email first.
  const contact = normalizeEmail(contactEmail);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);

  return (
    <section aria-label="Emails that identify this member" className="space-y-2 rounded-md border border-[var(--color-border)] px-3 py-2.5">
      <div>
        <h3 className="text-xs font-semibold text-text-primary">Emails that identify this member</h3>
        <p className="text-[11px] text-text-muted">
          Attendance imports match these addresses to this member. Changing the contact email above keeps the old address here.
        </p>
      </div>
      {isLoading && <p className="text-[11px] text-text-muted">Loading…</p>}
      {error ? (
        <p role="alert" className="text-[11px] text-red-700 dark:text-red-400">
          Could not load the emails. <button type="button" className="underline" onClick={() => refetch()}>Retry</button>
        </p>
      ) : null}
      {data && data.length === 0 && <p className="text-[11px] text-text-muted">No confirmed emails yet.</p>}
      {data && data.length > 0 && (
        <ul className="space-y-1">
          {data.map((alias) => (
            <li key={alias.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                <span className="font-medium text-text-primary">{alias.email}</span>
                <span className="ml-1 text-[11px] text-text-muted">· {HOW[alias.verification_method]}{alias.moved_from_member_id ? ' · kept from a merged duplicate' : ''}</span>
              </span>
              {alias.email === contact ? (
                <span className="text-[11px] text-text-muted">Contact email: change it above to stop matching it</span>
              ) : confirming === alias.id ? (
                <span className="flex gap-2">
                  <button type="button" disabled={remove.isPending} onClick={() => remove.mutate(alias.id)}
                    className="text-[11px] font-medium text-red-700 hover:underline dark:text-red-400">
                    Confirm remove
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="text-[11px] text-text-muted hover:underline">Cancel</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming(alias.id)} aria-label={`Remove ${alias.email}`}
                  className="text-[11px] text-text-secondary hover:text-text-primary hover:underline">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {remove.error ? <p role="alert" className="text-[11px] text-red-700 dark:text-red-400">{(remove.error as Error).message}</p> : null}
      <div className="flex gap-2">
        <input
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an address this member uses"
          aria-label="Add an email that identifies this member"
          className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-text-primary"
        />
        <button
          type="button"
          disabled={!valid || add.isPending}
          onClick={() => add.mutate(normalized)}
          className={cn('rounded border px-2 py-1 text-xs font-medium', valid ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400' : 'border-[var(--color-border)] text-text-muted')}
        >
          Add
        </button>
      </div>
      {add.error ? (
        <p role="alert" className="text-[11px] text-red-700 dark:text-red-400">
          {/already exists/i.test((add.error as Error).message)
            ? 'That address already identifies a member. Use Merge Suggestions if they are the same person.'
            : (add.error as Error).message}
        </p>
      ) : null}
    </section>
  );
}
