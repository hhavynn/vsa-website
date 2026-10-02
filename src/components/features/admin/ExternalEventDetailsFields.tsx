import { useId } from 'react';
import { UVSASchool } from '../../../types';
import {
  buildHostOptions,
  ExternalDetailsForm,
  resolveExternalHost,
  UVSA_SOCAL_HOST_VALUE,
} from '../../../lib/externalEventLinking';
import { ExternalHostMark } from '../uvsa/ExternalHostMark';

const inputCls = 'mt-1 block w-full rounded border px-3 py-2.5 text-[15px] sm:py-2 sm:text-sm focus:outline-none focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand)] bg-[var(--color-surface2)] border-[var(--color-border)] text-[var(--color-text)] placeholder-[var(--color-text3)]';
const labelCls = 'block text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--color-text3)]';

/**
 * The UVSA-specific fields revealed when Event Type = External Event. The
 * organizer's logo and social links are shown for reference only: they come
 * from `uvsa_schools` and are never copied onto the event.
 */
export function ExternalEventDetailsFields({
  value,
  onChange,
  schools,
  schoolsLoading = false,
}: {
  value: ExternalDetailsForm;
  onChange: (next: ExternalDetailsForm) => void;
  /** Active schools; the current host is kept even if it was since deactivated. */
  schools: UVSASchool[];
  schoolsLoading?: boolean;
}) {
  const id = useId();
  const options = buildHostOptions(schools, value.host);
  const host = value.host
    ? resolveExternalHost(
        value.host === UVSA_SOCAL_HOST_VALUE
          ? { host_type: 'uvsa_socal', uvsa_school: undefined }
          : { host_type: 'school', uvsa_school: schools.find((school) => school.id === value.host) },
      )
    : null;
  const set = <K extends keyof ExternalDetailsForm>(key: K, next: ExternalDetailsForm[K]) =>
    onChange({ ...value, [key]: next });

  const shortcuts = host
    ? [
        { label: 'Instagram', url: host.instagramUrl },
        { label: 'Linktree', url: host.linktreeUrl },
        { label: 'Website', url: host.websiteUrl },
      ].filter((link): link is { label: string; url: string } => Boolean(link.url))
    : [];

  return (
    <fieldset
      className="col-span-full space-y-5 rounded border p-4 sm:p-5"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface2)' }}
    >
      <legend className="px-2 font-serif text-base font-bold" style={{ color: 'var(--color-text)' }}>
        External Event Details
      </legend>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
        Saving this event also lists it on /uvsa-network under Upcoming Externals. No separate entry in Admin → External Events is needed.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-host`} className={labelCls}>Host / Organizer *</label>
          <select
            id={`${id}-host`}
            value={value.host}
            onChange={(e) => set('host', e.target.value)}
            className={inputCls}
            required
            disabled={schoolsLoading}
          >
            <option value="">{schoolsLoading ? 'Loading hosts...' : 'Choose a host'}</option>
            <option value={options.socal.value}>{options.socal.label}</option>
            <option disabled value="__divider">────────────</option>
            {options.schools.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text3)' }}>
            Pick the school that hosts it, or UVSA SoCal for a network-wide event.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {host ? (
            <>
              <ExternalHostMark host={host} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{host.name}</p>
                {shortcuts.length > 0 && (
                  <ul className="mt-1 flex list-none flex-wrap gap-3 p-0 text-xs">
                    {shortcuts.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--brand)] hover:underline"
                        >
                          {link.label} ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text3)' }}>
              The host's logo and links appear here once chosen.
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-rsvp`} className={labelCls}>RSVP / Tickets</label>
          <input id={`${id}-rsvp`} type="url" value={value.rsvp_url} onChange={(e) => set('rsvp_url', e.target.value)} className={inputCls} placeholder="https://..." />
        </div>
        <div>
          <label htmlFor={`${id}-info`} className={labelCls}>Event Info</label>
          <input id={`${id}-info`} type="url" value={value.host_info_url} onChange={(e) => set('host_info_url', e.target.value)} className={inputCls} placeholder="https://..." />
        </div>
        <div>
          <label htmlFor={`${id}-ig`} className={labelCls}>Instagram Post</label>
          <input id={`${id}-ig`} type="url" value={value.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} className={inputCls} placeholder="https://..." />
        </div>
        <div>
          <label htmlFor={`${id}-ride`} className={labelCls}>UCSD Ride Form</label>
          <input id={`${id}-ride`} type="url" value={value.ride_form_url} onChange={(e) => set('ride_form_url', e.target.value)} className={inputCls} placeholder="https://..." />
        </div>
        <div className="md:col-span-2">
          <label htmlFor={`${id}-rideinfo`} className={labelCls}>Ride Info</label>
          <input id={`${id}-rideinfo`} type="text" value={value.ride_info} onChange={(e) => set('ride_info', e.target.value)} className={inputCls} placeholder="Meet at Gilman parking structure at 5:30 PM." />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={value.show_on_network}
          onChange={(e) => set('show_on_network', e.target.checked)}
          className="mt-1 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--brand)] focus:ring-[var(--brand)]"
        />
        <span>
          <span className="block text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Show on UVSA Network</span>
          <span className="mt-1 block text-xs leading-relaxed" style={{ color: 'var(--color-text3)' }}>
            Lists the event on /uvsa-network once it is published. Turn off to hide the listing and the host details from the public pages; the saved host and links are kept.
          </span>
        </span>
      </label>
    </fieldset>
  );
}
