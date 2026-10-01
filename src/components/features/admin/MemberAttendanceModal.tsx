import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "react-query";
import toast from "react-hot-toast";
import {
  adminMembersRepository,
  AdminAttendanceRecord,
} from "../../../data/repos/adminMembers";
import { toUserMessage } from "../../../data/errors";
import { Button } from "../../ui/Button";
import { MemberWorkflowDialog } from "./MemberWorkflowDialog";

export function MemberAttendanceModal({
  memberId,
  onClose,
  onChanged,
}: {
  memberId: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const client = useQueryClient();
  const history = useQuery(
    ["admin-member-history", memberId],
    () => adminMembersRepository.getHistory(memberId),
    { staleTime: 0 },
  );
  const events = useQuery(
    ["admin-member-attendance-events"],
    () => adminMembersRepository.getAttendanceEvents(),
    { staleTime: 0 },
  );
  const [eventId, setEventId] = useState("");
  const [removing, setRemoving] = useState<AdminAttendanceRecord | null>(null);
  const change = useMutation(
    async (action: { type: "add" | "remove"; eventId: string }) =>
      action.type === "add"
        ? adminMembersRepository.addAttendance(memberId, action.eventId)
        : adminMembersRepository.removeAttendance(memberId, action.eventId),
    {
      onSuccess: async (added, action) => {
        setEventId("");
        setRemoving(null);
        await Promise.all([
          client.invalidateQueries(["admin-member-history", memberId]),
          client.invalidateQueries(["find-my-points"]),
          client.invalidateQueries(["leaderboard-years"]),
          client.invalidateQueries(["member-attendance", memberId]),
          client.invalidateQueries(["house-detail", "standings"]),
          onChanged(),
        ]);
        toast.success(
          action.type === "remove"
            ? "Attendance removed."
            : added
              ? "Attendance added."
              : "Attendance already recorded.",
        );
      },
    },
  );
  const attended = new Set(
    history.data?.records.map((record) => record.event_id),
  );
  const selectedEvent = events.data?.find((event) => event.id === eventId);
  const blocked = change.isLoading || history.isFetching || history.isError;
  const member = history.data?.member;
  const memberName = member
    ? `${member.first_name} ${member.last_name}`
    : "Member";
  const dateLabel = (date: string) =>
    date
      ? new Date(date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Date unavailable";

  return (
    <MemberWorkflowDialog
      title={`Attendance for ${memberName}`}
      busy={change.isLoading}
      onClose={onClose}
    >
      <h2 className="text-lg font-semibold">{memberName}</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Attendance &amp; points
      </p>
      {history.isLoading && (
        <p role="status" className="mt-5 text-sm">
          Loading attendance…
        </p>
      )}
      {history.isError && (
        <div
          role="alert"
          className="mt-4 text-sm text-red-700 dark:text-red-400"
        >
          {toUserMessage(
            history.error,
            "Could not load attendance. Try again.",
          )}
          <Button
            variant="outline"
            className="ml-2"
            onClick={() => history.refetch()}
          >
            Retry
          </Button>
        </div>
      )}
      {member && history.data && (
        <div className="mt-5 space-y-5">
          <p aria-live="polite" className="font-medium">
            {member.points} pts (All-Time) · {member.events_attended} event
            {member.events_attended !== 1 ? "s" : ""}
          </p>
          <section aria-label="Add attendance" className="space-y-2">
            <label
              htmlFor="member-attendance-event"
              className="block text-sm font-medium"
            >
              Add event attendance
            </label>
            {events.isError ? (
              <div
                role="alert"
                className="text-sm text-red-700 dark:text-red-400"
              >
                Could not load available events.
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={() => events.refetch()}
                >
                  Retry events
                </Button>
              </div>
            ) : (
              <>
                <select
                  id="member-attendance-event"
                  value={eventId}
                  disabled={blocked || events.isFetching || !!removing}
                  onChange={(event) => {
                    setEventId(event.target.value);
                    change.reset();
                  }}
                  className="w-full rounded border border-border-strong bg-surface2 p-2.5 text-sm"
                >
                  <option value="">
                    {events.isLoading ? "Loading events…" : "Select an event"}
                  </option>
                  {events.data?.map((event) => (
                    <option
                      key={event.id}
                      value={event.id}
                      disabled={
                        attended.has(event.id) || !event.academic_term_id
                      }
                    >
                      {event.name} — {dateLabel(event.date)} · {event.points}{" "}
                      pts
                      {attended.has(event.id)
                        ? " · Attended"
                        : !event.academic_term_id
                          ? " · No academic term"
                          : ""}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-text-secondary">
                  Events without an academic term need a term assigned in Admin
                  Events first.
                </p>
                <Button
                  disabled={
                    blocked ||
                    events.isFetching ||
                    events.isError ||
                    !selectedEvent?.academic_term_id ||
                    attended.has(eventId) ||
                    !!removing
                  }
                  onClick={() => change.mutate({ type: "add", eventId })}
                >
                  Add attendance
                </Button>
              </>
            )}
          </section>
          {history.data.yearly.length > 0 && (
            <section aria-label="Yearly breakdown" className="space-y-2">
              <h3 className="text-sm font-semibold">Yearly breakdown</h3>
              {history.data.yearly.map((year) => (
                <p
                  key={year.academic_year_start}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {year.academic_year_start}–{year.academic_year_end}
                  </span>
                  <span>{year.total_points} pts</span>
                </p>
              ))}
            </section>
          )}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Attended events</h3>
            {history.data.records.length === 0 && (
              <p className="text-sm text-text-secondary">
                No attendance yet. Select an event above to add it.
              </p>
            )}
            <ul className="divide-y divide-border">
              {history.data.records.map((record) => (
                <li
                  key={record.event_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {record.events?.name ?? "Unknown event"}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {dateLabel(record.events?.date ?? "")} ·{" "}
                      {record.events?.academic_terms?.label ??
                        "No academic term"}{" "}
                      · {record.points_earned} pts
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={blocked || !!removing}
                    aria-label={`Remove ${record.events?.name ?? "unknown event"} attendance`}
                    onClick={() => {
                      setRemoving(record);
                      change.reset();
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
          {removing && (
            <div className="space-y-3 rounded border border-border-strong bg-surface2 p-4">
              <p className="text-sm">
                Remove {memberName}’s attendance at{" "}
                {removing.events?.name ?? "this event"}? Their points will be
                recalculated without this {removing.points_earned} point record.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  disabled={blocked}
                  onClick={() =>
                    change.mutate({
                      type: "remove",
                      eventId: removing.event_id,
                    })
                  }
                >
                  Confirm removal
                </Button>
                <Button
                  variant="outline"
                  disabled={change.isLoading}
                  onClick={() => {
                    setRemoving(null);
                    change.reset();
                  }}
                >
                  Keep attendance
                </Button>
              </div>
            </div>
          )}
          {change.isLoading && (
            <p role="status" className="text-sm">
              Saving attendance and refreshing points…
            </p>
          )}
          {change.isError && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {toUserMessage(
                change.error,
                "Could not save attendance. Try again.",
              )}
            </p>
          )}
        </div>
      )}
      <Button
        className="mt-5"
        fullWidth
        variant="outline"
        onClick={onClose}
        disabled={change.isLoading}
      >
        Close
      </Button>
    </MemberWorkflowDialog>
  );
}
