import { Link } from 'react-router-dom';
import { HouseYearlyPoints } from '../../../types';
import { HOUSE_COLORS, normalizeHouse } from '../../../constants/houses';
import { formatStatNumber, pickHouseWinner, sortHouseStandings } from '../../../utils/wrapped';
import { getSupabaseImageUrl } from '../../../lib/supabaseImages';

const HOUSE_EMOJI: Record<string, string> = {
  Bowser: '🐢',
  'Donkey Kong': '🦍',
  Boo: '👻',
  Toad: '🍄',
};

function houseColor(house: HouseYearlyPoints): string {
  const name = normalizeHouse(house.house || house.display_name);
  return house.accent_color || (name ? HOUSE_COLORS[name] : 'var(--brand)');
}

interface Props {
  houses: HouseYearlyPoints[];
}

/**
 * House Cup recap: winner spotlight + full standings bars. All values come
 * from the public house_yearly_points aggregate view (house-level only — the
 * same numbers already shown on /leaderboard).
 */
export function HouseCup({ houses }: Props) {
  const standings = sortHouseStandings(houses);
  const winner = pickHouseWinner(houses);
  const maxPoints = standings[0]?.total_points || 1;

  if (standings.length === 0) {
    return (
      <div className="scrapbook-empty py-8 text-center">
        <p className="font-sans text-[14px] text-text-secondary">
          Four houses. One year of friendly chaos. See the full story on the leaderboard.
        </p>
        <Link
          to="/leaderboard"
          className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-wider text-brand-600 dark:text-brand-400"
        >
          View the leaderboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      {winner && (
        <div
          className="scrapbook-photo relative overflow-hidden p-6 text-center scrapbook-rotate-sm-left"
          style={{ borderColor: `${houseColor(winner)}88` }}
        >
          <span className="scrapbook-sticker scrapbook-sticker-gold px-2.5 py-1 text-[10px]">
            House Cup Champions
          </span>
          {winner.image_url && (
            <img
              src={getSupabaseImageUrl(winner.image_url, { width: 480 }) || winner.image_url}
              alt={`${winner.display_name} crest`}
              className="mx-auto mt-4 h-28 w-28 rounded-full object-cover"
              loading="lazy"
            />
          )}
          <div className="mt-4 text-4xl" aria-hidden>
            {HOUSE_EMOJI[normalizeHouse(winner.house || winner.display_name) ?? ''] ?? '🏆'}
          </div>
          <h3 className="mt-2 font-serif text-[34px] font-black leading-none" style={{ color: houseColor(winner) }}>
            {winner.display_name}
          </h3>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.1em] text-text-muted">
            {formatStatNumber(winner.total_points)} points
            {winner.unique_events > 0 && ` · ${formatStatNumber(winner.unique_events)} events`}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {standings.map((house, index) => {
          const color = houseColor(house);
          const width = Math.max(8, Math.round(((house.total_points ?? 0) / maxPoints) * 100));
          return (
            <div key={house.house_profile_id} className="scrapbook-paper p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-sans text-[14px] font-bold text-text-primary">
                  <span className="mr-2 font-mono text-[11px] text-text-muted">#{index + 1}</span>
                  {HOUSE_EMOJI[normalizeHouse(house.house || house.display_name) ?? ''] ?? ''}{' '}
                  {house.display_name}
                </span>
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
                  {formatStatNumber(house.total_points)} pts
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${width}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
        <p className="pt-1 font-sans text-[12px] text-text-muted">
          House totals are community aggregates — dive deeper on the{' '}
          <Link to="/leaderboard" className="underline underline-offset-2 text-brand-600 dark:text-brand-400">
            leaderboard
          </Link>{' '}
          or the{' '}
          <Link to="/house" className="underline underline-offset-2 text-brand-600 dark:text-brand-400">
            House page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
