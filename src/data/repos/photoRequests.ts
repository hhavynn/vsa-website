import { supabase } from '../../lib/supabase';
import { Database } from '../../types/database';
import { withErrorHandling, ValidationError } from '../errors';
import { prepareImageForUpload, getUploadExtension } from '../../lib/imageUpload';

export type MemberPhotoRequest = Database['public']['Tables']['member_photo_requests']['Row'];
export type MemberPhotoRequestEvent =
  Database['public']['Tables']['member_photo_request_events']['Row'];
export type MyMemberPhotoRequest = Database['public']['Views']['my_member_photo_requests']['Row'];
export type PublicMemberAvatar = Database['public']['Views']['public_member_avatars']['Row'];

export const PENDING_PHOTO_BUCKET = 'member-photo-requests';
export const AVATARS_BUCKET = 'avatars';

const REQUEST_SELECT =
  'id, user_id, matched_member_id, submitted_name, submitted_email, note_to_admins, consent_confirmed, storage_path_pending, storage_path_approved, approved_avatar_url, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at' as const;

export interface SubmitPhotoRequestInput {
  matchedMemberId: string;
  file: File;
  submittedName: string;
  submittedEmail: string;
  noteToAdmins?: string;
  consentConfirmed: boolean;
}

export interface MemberMatchOption {
  id: string;
  displayName: string;
}

export class PhotoRequestsRepository {
  /**
   * Public flow: compress the photo client-side, upload it to the PRIVATE
   * pending bucket under a non-readable public-submission folder, then create
   * the request row. RLS only allows pending, consented, matched-member rows.
   */
  async submitPhotoRequest(input: SubmitPhotoRequestInput): Promise<void> {
    return withErrorHandling(async () => {
      if (!input.consentConfirmed) {
        throw new ValidationError('Consent is required to submit a photo request.');
      }

      const matchedMemberId = input.matchedMemberId.trim();
      if (!matchedMemberId) {
        throw new ValidationError('Choose a member before submitting a photo request.');
      }

      const { file } = await prepareImageForUpload(input.file, 'avatar');
      const ext = getUploadExtension(file);
      const pendingPath = `pending/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(PENDING_PHOTO_BUCKET)
        .upload(pendingPath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('member_photo_requests').insert({
        user_id: null,
        matched_member_id: matchedMemberId,
        submitted_name: input.submittedName.trim(),
        submitted_email: input.submittedEmail.trim(),
        note_to_admins: input.noteToAdmins?.trim() || null,
        consent_confirmed: true,
        storage_path_pending: pendingPath,
      });
      if (insertError) {
        await supabase.storage.from(PENDING_PHOTO_BUCKET).remove([pendingPath]);
        throw insertError;
      }
    }, 'Failed to submit photo request');
  }

  /** Member flow: own request history via the safe-columns view. */
  async getMyPhotoRequests(): Promise<MyMemberPhotoRequest[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('my_member_photo_requests')
        .select('id, status, submitted_name, storage_path_pending, created_at, reviewed_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MyMemberPhotoRequest[];
    }, 'Failed to fetch your photo requests');
  }

  /** Public flow: approved avatars keyed by member_id, one bulk query. */
  async getPublicMemberAvatars(): Promise<Map<string, string>> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('public_member_avatars')
        .select('member_id, avatar_url');
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.member_id, row.avatar_url]));
    }, 'Failed to fetch member avatars');
  }

  // ─── Admin flows (RLS: is_admin_user) ────────────────────────────────────

  async listPhotoRequests(): Promise<MemberPhotoRequest[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('member_photo_requests')
        .select(REQUEST_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemberPhotoRequest[];
    }, 'Failed to fetch photo requests');
  }

  async listRequestEvents(requestId: string): Promise<MemberPhotoRequestEvent[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('member_photo_request_events')
        .select('id, request_id, action, actor, note, created_at')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemberPhotoRequestEvent[];
    }, 'Failed to fetch photo request events');
  }

  /** Short-lived signed URL so admins can preview a pending (private) photo. */
  async getPendingPreviewUrl(pendingPath: string): Promise<string> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase.storage
        .from(PENDING_PHOTO_BUCKET)
        .createSignedUrl(pendingPath, 300);
      if (error) throw error;
      return data.signedUrl;
    }, 'Failed to load photo preview');
  }

  /**
   * Approve: download the pending original, re-compress to a 256px web
   * thumbnail, publish it to the public avatars bucket with a 1-year cache
   * header, then run the transactional approval RPC (request row +
   * user_profiles.avatar_url + audit event).
   */
  async approveRequest(
    request: Pick<MemberPhotoRequest, 'id' | 'storage_path_pending'>,
    matchedMemberId?: string | null,
  ): Promise<void> {
    return withErrorHandling(async () => {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(PENDING_PHOTO_BUCKET)
        .download(request.storage_path_pending);
      if (downloadError) throw downloadError;

      const original = new File([blob], 'pending-photo', { type: blob.type || 'image/webp' });
      const { file: thumbnail } = await prepareImageForUpload(original, 'avatarThumbnail');
      const approvedPath = `approved/${request.id}.${getUploadExtension(thumbnail)}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(approvedPath, thumbnail, {
          cacheControl: '31536000',
          contentType: thumbnail.type,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(approvedPath);

      const { error: rpcError } = await supabase.rpc('approve_member_photo_request', {
        p_request_id: request.id,
        p_approved_path: approvedPath,
        p_public_url: urlData.publicUrl,
        p_matched_member_id: matchedMemberId ?? null,
      });
      if (rpcError) {
        // Don't leave an unapproved image published in the public bucket.
        await supabase.storage.from(AVATARS_BUCKET).remove([approvedPath]);
        throw rpcError;
      }
    }, 'Failed to approve photo request');
  }

  /**
   * Reject with an internal admin note, then delete the pending object so
   * unpublished photos are not retained. Object deletion is best-effort:
   * the rejection itself is already recorded when it runs.
   */
  async rejectRequest(
    request: Pick<MemberPhotoRequest, 'id' | 'storage_path_pending'>,
    adminNote?: string,
  ): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.rpc('reject_member_photo_request', {
        p_request_id: request.id,
        p_admin_note: adminNote?.trim() || null,
      });
      if (error) throw error;

      await supabase.storage.from(PENDING_PHOTO_BUCKET).remove([request.storage_path_pending]);
    }, 'Failed to reject photo request');
  }

  /**
   * Privacy/data-rights removal: clear the member's published avatar
   * reference (RPC), then delete this request's own objects — the approved
   * thumbnail and the pending original. Never touches other buckets or
   * other requests' files. CDN caches may serve the old image until TTL
   * expiry; see docs/member-photo-requests.md.
   */
  async removeApprovedAvatar(
    request: Pick<MemberPhotoRequest, 'id' | 'storage_path_pending' | 'storage_path_approved'>,
    adminNote?: string,
  ): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.rpc('remove_member_photo_request', {
        p_request_id: request.id,
        p_admin_note: adminNote?.trim() || null,
      });
      if (error) throw error;

      if (request.storage_path_approved) {
        await supabase.storage.from(AVATARS_BUCKET).remove([request.storage_path_approved]);
      }
      await supabase.storage.from(PENDING_PHOTO_BUCKET).remove([request.storage_path_pending]);
    }, 'Failed to remove approved photo');
  }

  /** Admin helper: search members by name to confirm/override the match. */
  async searchMembers(query: string): Promise<MemberMatchOption[]> {
    return withErrorHandling(async () => {
      // Strip PostgREST filter metacharacters so the term cannot malform the
      // .or() expression below.
      const term = query.trim().replace(/[,()%.]/g, '');
      if (term.length < 2) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, college, year')
        .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .order('last_name', { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.id,
        displayName: [`${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(), m.college, m.year]
          .filter(Boolean)
          .join(' · '),
      }));
    }, 'Failed to search members');
  }

  /** Admin helper: auto-match a request's auth user to a member row. */
  async findMemberById(memberId: string | null | undefined): Promise<MemberMatchOption | null> {
    if (!memberId) return null;
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, college, year')
        .eq('id', memberId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        displayName: [`${data.first_name ?? ''} ${data.last_name ?? ''}`.trim(), data.college, data.year]
          .filter(Boolean)
          .join(' · '),
      };
    }, 'Failed to look up matching member');
  }

  async findMemberForUser(userId: string | null | undefined): Promise<MemberMatchOption | null> {
    if (!userId) return null;
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, college, year')
        .eq('user_id', userId)
        .limit(1);
      if (error) throw error;
      const m: any = data?.[0];
      if (!m) return null;
      return {
        id: m.id,
        displayName: [`${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(), m.college, m.year]
          .filter(Boolean)
          .join(' · '),
      };
    }, 'Failed to look up matching member');
  }
}

export const photoRequestsRepository = new PhotoRequestsRepository();
