import { supabase } from '../../lib/supabase';
import { AceFamily, AceFamilyMember } from '../../types';
import { withErrorHandling } from '../errors';
import { ImportPlan } from '../../lib/aceFamilyImport';

export type AceFamilyFormData = Omit<AceFamily, 'id' | 'created_at' | 'updated_at'>;
export type AceFamilyMemberFormData = Omit<AceFamilyMember, 'id' | 'created_at' | 'updated_at'>;

export class AceFamiliesRepository {
  async getPublishedFamilies(): Promise<AceFamily[]> {
    try {
      const { data, error } = await supabase
        .from('published_ace_families')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) {
        console.warn('Using fallback published ace families:', error.message);
        return [];
      }
      return (data ?? []).map((row) => ({ ...(row as AceFamily), is_published: true }));
    } catch (error) {
      console.warn('Using fallback published ace families:', error);
      return [];
    }
  }

  async getAllPublishedMembers(): Promise<AceFamilyMember[]> {
    try {
      const { data, error } = await supabase
        .from('published_ace_family_members')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        console.warn('Using fallback published ace members (all):', error.message);
        return [];
      }
      return (data ?? []).map((row) => ({ ...(row as AceFamilyMember), is_published: true }));
    } catch (error) {
      console.warn('Using fallback published ace members (all):', error);
      return [];
    }
  }

  async getPublishedMembersForFamily(familyId: string): Promise<AceFamilyMember[]> {
    try {
      const { data, error } = await supabase
        .from('published_ace_family_members')
        .select('*')
        .eq('family_id', familyId)
        .order('name', { ascending: true });
      if (error) {
        console.warn('Using fallback published ace members:', error.message);
        return [];
      }
      return (data ?? []).map((row) => ({ ...(row as AceFamilyMember), is_published: true }));
    } catch (error) {
      console.warn('Using fallback published ace members:', error);
      return [];
    }
  }

  async getAdminFamilies(): Promise<AceFamily[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_families')
        .select('*')
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AceFamily[];
    }, 'Failed to fetch ACE families');
  }

  async getAdminMembersForFamily(familyId: string): Promise<AceFamilyMember[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_family_members')
        .select('*')
        .eq('family_id', familyId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AceFamilyMember[];
    }, 'Failed to fetch ACE family members');
  }

  async createFamily(family: AceFamilyFormData): Promise<AceFamily> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_families')
        .insert({ ...family, updated_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error) throw error;
      return data as AceFamily;
    }, 'Failed to create ACE family');
  }

  async updateFamily(id: string, family: Partial<AceFamilyFormData>): Promise<AceFamily> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_families')
        .update({ ...family, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as AceFamily;
    }, 'Failed to update ACE family');
  }

  async deleteFamily(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('ace_families').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to delete ACE family');
  }

  async createMember(member: AceFamilyMemberFormData): Promise<AceFamilyMember> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_family_members')
        .insert({ ...member, updated_at: new Date().toISOString() })
        .select('*')
        .single();
      if (error) throw error;
      return data as AceFamilyMember;
    }, 'Failed to create ACE family member');
  }

  async updateMember(id: string, member: Partial<AceFamilyMemberFormData>): Promise<AceFamilyMember> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('ace_family_members')
        .update({ ...member, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data as AceFamilyMember;
    }, 'Failed to update ACE family member');
  }

  async deleteMember(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase.from('ace_family_members').delete().eq('id', id);
      if (error) throw error;
    }, 'Failed to delete ACE family member');
  }

  /**
   * Create a family plus every member in the plan in one operation.
   *
   * Two-pass to keep FK validation simple:
   *   1) insert every member with parent_member_id = null
   *   2) update parent_member_id on the rows that have a parent
   */
  async bulkCreateFamily(
    famFields: Pick<AceFamily, 'theme_color' | 'cover_image_url' | 'display_order' | 'is_published'>,
    plan: ImportPlan,
  ): Promise<{ family: AceFamily; memberCount: number }> {
    return withErrorHandling(async () => {
      // 1. Family row.
      const { data: famRow, error: famErr } = await supabase
        .from('ace_families')
        .insert({
          name: plan.familyName,
          slug: plan.familySlug,
          description: plan.description,
          academic_year_start: null,
          academic_year_end: null,
          theme_color: famFields.theme_color,
          cover_image_url: famFields.cover_image_url,
          display_order: famFields.display_order,
          is_published: famFields.is_published,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (famErr) throw famErr;
      const family = famRow as AceFamily;

      // 2. Pass 1: insert all members with NULL parents.
      const passOnePayload = plan.people.map((p) => ({
        id: p.id,
        family_id: family.id,
        name: p.name,
        role_label: p.role_label,
        photo_url: null,
        parent_member_id: null,
        display_order: p.display_order,
        is_published: true,
      }));

      const { error: insErr } = await supabase
        .from('ace_family_members')
        .insert(passOnePayload);
      if (insErr) {
        // Best-effort rollback: delete the fam (cascades to any inserted members).
        await supabase.from('ace_families').delete().eq('id', family.id);
        throw insErr;
      }

      // 3. Pass 2: set parent_member_id for everyone who has a parent.
      const needsParent = plan.people.filter((p) => p.parent_id !== null);
      // Run sequentially. Volume is small (< 200) and we want stable errors.
      for (const p of needsParent) {
        const { error: updErr } = await supabase
          .from('ace_family_members')
          .update({ parent_member_id: p.parent_id, updated_at: new Date().toISOString() })
          .eq('id', p.id);
        if (updErr) {
          await supabase.from('ace_families').delete().eq('id', family.id);
          throw updErr;
        }
      }

      return { family, memberCount: plan.people.length };
    }, 'Failed to import ACE family');
  }

  async uploadImage(file: File, prefix: 'family' | 'member'): Promise<string> {
    const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `${prefix}/${crypto.randomUUID()}.${fileExt}`;
    const { error } = await supabase.storage.from('ace_family_images').upload(fileName, file);
    if (error) throw error;
    const { data } = supabase.storage.from('ace_family_images').getPublicUrl(fileName);
    return data.publicUrl;
  }
}

export const aceFamiliesRepository = new AceFamiliesRepository();
