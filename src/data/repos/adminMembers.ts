import { supabase } from "../../lib/supabase";
import { AdminMemberSchema, AdminMemberInput } from "../../schemas";
import { Database } from "../../types/database";
import { ValidationError, withErrorHandling } from "../errors";

type MemberRow = Database["public"]["Tables"]["members"]["Row"];
export type AdminMemberSummary = Pick<
  MemberRow,
  "id" | "first_name" | "last_name" | "points" | "events_attended"
>;

export interface AdminAttendanceEvent {
  id: string;
  name: string;
  date: string;
  points: number;
  academic_term_id: string | null;
  academic_terms: { label: string } | null;
}

export interface AdminAttendanceRecord {
  event_id: string;
  points_earned: number;
  events: Omit<AdminAttendanceEvent, "id" | "points"> | null;
}

export interface AdminYearlyTotal {
  academic_year_start: number;
  academic_year_end: number;
  total_points: number;
}

export class AdminMembersRepository {
  async createMember(input: AdminMemberInput): Promise<AdminMemberSummary> {
    return withErrorHandling(async () => {
      const result = AdminMemberSchema.safeParse(input);
      if (!result.success)
        throw new ValidationError(result.error.issues[0].message);
      const member = result.data;
      if (member.email) {
        const { data: existing, error } = await supabase
          .from("members")
          .select("id")
          .eq("email", member.email)
          .limit(1);
        if (error) throw error;
        if (existing?.length)
          throw new ValidationError(
            "A member with this email already exists. Search Members to edit their attendance.",
          );
      }
      const { data, error } = await supabase
        .from("members")
        .insert({
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email || null,
          college: member.college || null,
          year: member.year || null,
        })
        .select("id, first_name, last_name, points, events_attended")
        .single();
      if (error) throw error;
      return data as AdminMemberSummary;
    }, "Failed to create member");
  }

  async getAttendanceEvents(): Promise<AdminAttendanceEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, name, date, points, academic_term_id, academic_terms(label)",
        )
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AdminAttendanceEvent[];
    }, "Failed to load attendance events");
  }

  async getHistory(memberId: string) {
    return withErrorHandling(async () => {
      const [member, attendance, yearly] = await Promise.all([
        supabase
          .from("members")
          .select("id, first_name, last_name, points, events_attended")
          .eq("id", memberId)
          .single(),
        supabase
          .from("member_event_attendance")
          .select(
            "event_id, points_earned, events(name, date, academic_term_id, academic_terms(label))",
          )
          .eq("member_id", memberId),
        supabase
          .from("member_yearly_points")
          .select("academic_year_start, academic_year_end, total_points")
          .eq("member_id", memberId)
          .order("academic_year_start", { ascending: false }),
      ]);
      if (member.error) throw member.error;
      if (attendance.error) throw attendance.error;
      if (yearly.error) throw yearly.error;
      return {
        member: member.data as AdminMemberSummary,
        records: ((attendance.data ?? []) as AdminAttendanceRecord[]).sort(
          (a, b) => (b.events?.date ?? "").localeCompare(a.events?.date ?? ""),
        ),
        yearly: (yearly.data ?? []) as AdminYearlyTotal[],
      };
    }, "Failed to load member attendance");
  }

  async addAttendance(memberId: string, eventId: string): Promise<boolean> {
    return withErrorHandling(async () => {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id, points, academic_term_id")
        .eq("id", eventId)
        .single();
      if (eventError) throw eventError;
      if (!event?.academic_term_id) {
        throw new ValidationError(
          "Assign an academic term in Admin Events before adding attendance.",
        );
      }
      const { data, error } = await supabase
        .from("member_event_attendance")
        .upsert(
          {
            member_id: memberId,
            event_id: eventId,
            points_earned: event.points ?? 0,
          },
          { onConflict: "member_id,event_id", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw error;
      return !!data?.length;
    }, "Failed to add attendance");
  }

  async removeAttendance(memberId: string, eventId: string): Promise<void> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from("member_event_attendance")
        .delete()
        .eq("member_id", memberId)
        .eq("event_id", eventId)
        .select("id");
      if (error) throw error;
      if (!data?.length)
        throw new ValidationError(
          "Attendance was not removed. Refresh and check your admin permissions.",
        );
    }, "Failed to remove attendance");
  }
}

export const adminMembersRepository = new AdminMembersRepository();
