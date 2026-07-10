import { supabase } from '../../lib/supabase';
import { Database } from '../../types/database';
import { withErrorHandling, DatabaseError } from '../errors';

export type CabinetRoleDescription = Database['public']['Tables']['cabinet_role_descriptions']['Row'];
export type CabinetRoleDescriptionUpdate = Database['public']['Tables']['cabinet_role_descriptions']['Update'];
export type CabinetRoleDescriptionInsert = Database['public']['Tables']['cabinet_role_descriptions']['Insert'];

class CabinetRolesRepository {
  async getAllRoles(): Promise<CabinetRoleDescription[]> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_role_descriptions')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    }, 'Failed to fetch cabinet role descriptions');
  }

  async createRole(role: CabinetRoleDescriptionInsert): Promise<CabinetRoleDescription> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_role_descriptions')
        .insert(role)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new DatabaseError('Failed to create cabinet role description');
      return data;
    }, 'Failed to create cabinet role description');
  }

  async updateRole(roleSlug: string, updates: CabinetRoleDescriptionUpdate): Promise<CabinetRoleDescription> {
    return withErrorHandling(async () => {
      const { data, error } = await supabase
        .from('cabinet_role_descriptions')
        .update(updates)
        .eq('role_slug', roleSlug)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new DatabaseError('Failed to update cabinet role description');
      return data;
    }, 'Failed to update cabinet role description');
  }

  async deleteRole(roleSlug: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await supabase
        .from('cabinet_role_descriptions')
        .delete()
        .eq('role_slug', roleSlug);

      if (error) throw error;
    }, 'Failed to delete cabinet role description');
  }
}

export const cabinetRolesRepository = new CabinetRolesRepository();
