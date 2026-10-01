import { supabase } from '../../lib/supabase';
import { Database } from '../../types/database';
import { withErrorHandling, ValidationError } from '../errors';
import { prepareImageForUpload, getUploadExtension } from '../../lib/imageUpload';
import { MemberOption, toMemberOption } from '../../lib/memberLinkMatching';

export type MemberPhotoRequest = Database['public']['Tables']['member_photo_requests']['Row'];
export type MemberPhotoRequestEvent =
  Database['public']['Tables']['member_photo_request_events']['Row'];
export type MyMemberPhotoRequest = Database['public']['Views']['my_member_photo_requests']['Row'];
export type PublicMemberAvatar = Database['public']['Views']['public_member_avatars']['Row'];

export const PENDING_PHOTO_BUCKET = 'member-photo-requests';
export const AVATARS_BUCKET = 'avatars';

/** Mirrors the pending bucket's allowed_mime_types. */
const ADMIN_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

/** Member search/lookup lives in memberLookupRepository. */
export type MemberMatchOption = Pick<MemberOption, 'id' | 'displayName'>;

export class PhotoRequestsRepository {
  /** Public submissions reserve server quota before a one-object signed upload. */
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
      const { data, error } = await supabase.functions.invoke<{
        path?: string;
        token?: string;
      }>('member-photo-upload', {
        body: {
          matchedMemberId,
          submittedName: input.submittedName.trim(),
          submittedEmail: input.submittedEmail.trim(),
          noteToAdmins: input.noteToAdmins?.trim() || null,
          consentConfirmed: true,
          contentType: file.type,
          size: file.size,
        },
      });
      if (error) throw error;
      if (!data?.path || !data.token || !/^pending\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(data.path)) {
        throw new ValidationError('Photo upload is unavailable. Please try again later.');
      }
      const { error: uploadError } = await supabase.storage
        .from(PENDING_PHOTO_BUCKET)
        .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
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
      const avatars = new Map<string, string>();
      for (const row of data ?? []) {
        if (row.member_id && row.avatar_url) avatars.set(row.member_id, row.avatar_url);
      }
      return avatars;
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
        p_matched_member_id: matchedMemberId ?? undefined,
      });
      if (rpcError) {
        // Don't leave an unapproved image published in the public bucket.
        await supabase.storage.from(AVATARS_BUCKET).remove([approvedPath]);
        throw rpcError;
      }
    }, 'Failed to approve photo request');
  }

  /**
   * Admin flow from Admin -> Members: publish a photo for a member without a
   * member-submitted request. Stores the original in the private pending
   * bucket and a 256px thumbnail in the public avatars bucket, then the
   * admin-guarded RPC records it as an approved request, so it shows up in
   * Photo requests with an audit trail and can be removed there. The caller
   * must have confirmed the member agreed to the photo being public.
   */
  async adminPublishMemberPhoto(memberId: string, file: File): Promise<void> {
    return withErrorHandling(async () => {
      if (!ADMIN_UPLOAD_TYPES.includes(file.type)) {
        throw new ValidationError('Choose a JPEG, PNG, or WebP image.', 'file');
      }

      const requestId = crypto.randomUUID();
      const { file: original } = await prepareImageForUpload(file, 'avatar');
      const pendingPath = `pending/${crypto.randomUUID()}.${getUploadExtension(original)}`;

      const { error: pendingError } = await supabase.storage
        .from(PENDING_PHOTO_BUCKET)
        .upload(pendingPath, original, { contentType: original.type });
      if (pendingError) throw pendingError;

      const { file: thumbnail } = await prepareImageForUpload(original, 'avatarThumbnail');
      const approvedPath = `approved/${requestId}.${getUploadExtension(thumbnail)}`;

      const { error: approvedError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(approvedPath, thumbnail, {
          cacheControl: '31536000',
          contentType: thumbnail.type,
          upsert: true,
        });
      if (approvedError) {
        await this.discardUnrecordedUploads([[PENDING_PHOTO_BUCKET, pendingPath]]);
        throw approvedError;
      }

      const { data: urlData } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(approvedPath);

      const { error: rpcError } = await supabase.rpc('admin_publish_member_photo', {
        p_request_id: requestId,
        p_member_id: memberId,
        p_pending_path: pendingPath,
        p_approved_path: approvedPath,
        p_public_url: urlData.publicUrl,
      });
      if (rpcError) {
        // A call that committed but lost its response still reports an
        // error. Deleting then would leave the approved row pointing at a
        // missing image, so clean up only once the row is confirmed absent.
        const { data: recorded, error: lookupError } = await supabase
          .from('member_photo_requests')
          .select('id')
          .eq('id', requestId)
          .maybeSingle();
        if (lookupError) {
          throw new ValidationError(
            'Could not confirm whether the photo was published. Check Photo requests before trying again.',
          );
        }
        if (recorded) return;

        await this.discardUnrecordedUploads([
          [AVATARS_BUCKET, approvedPath],
          [PENDING_PHOTO_BUCKET, pendingPath],
        ]);
        throw rpcError;
      }
    }, 'Failed to publish member photo');
  }

  /**
   * Deletes uploads that no request row references. Nothing in the admin UI
   * can find such an object, so a failed delete is reported rather than
   * swallowed.
   */
  private async discardUnrecordedUploads(objects: Array<[bucket: string, path: string]>): Promise<void> {
    const leftovers: string[] = [];
    for (const [bucket, path] of objects) {
      const { data, error } = await supabase.storage.from(bucket).remove([path]);
      // A delete that storage RLS filters out returns no error and no objects.
      if (error || !data?.length) leftovers.push(`${bucket}/${path}`);
    }
    if (leftovers.length > 0) {
      throw new ValidationError(
        `The photo was not published, and its uploaded files could not be deleted: ${leftovers.join(', ')}. Ask a maintainer to remove them from Supabase Storage.`,
      );
    }
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
        p_admin_note: adminNote?.trim() || undefined,
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
        p_admin_note: adminNote?.trim() || undefined,
      });
      if (error) throw error;

      if (request.storage_path_approved) {
        await supabase.storage.from(AVATARS_BUCKET).remove([request.storage_path_approved]);
      }
      await supabase.storage.from(PENDING_PHOTO_BUCKET).remove([request.storage_path_pending]);
    }, 'Failed to remove approved photo');
  }

  /** Admin helper: auto-match a request's auth user to a member row. */
  async findMemberForUser(userId: string | null | undefined): Promise<MemberOption | null> {
    if (!userId) return null;
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, first_name, last_name, college, year')
        .eq('user_id', userId)
        .limit(1);
      if (error) throw error;
      const m = data?.[0];
      return m ? toMemberOption(m) : null;
    }, 'Failed to look up matching member');
  }
}

export const photoRequestsRepository = new PhotoRequestsRepository();
