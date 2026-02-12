
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { logActivity } from '../services/auditLogger';

export interface AppUser {
    id: string;
    email: string;
    role: string;
    last_sign_in_at: string | null;
    created_at: string;
}

export const useUserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            // Requires "get_users_list" RPC function
            const { data, error } = await supabase.rpc('get_users_list');
            if (error) throw error;
            setUsers(data as AppUser[]);
        } catch (err: any) {
            console.error("Fetch Users Error:", err);
            
            let errorMessage = "Gagal memuat daftar user.";
            
            if (err) {
                if (typeof err === 'string') {
                    errorMessage = err;
                } else if (err.message) {
                    errorMessage = err.message;
                } else if (err.error_description) {
                    errorMessage = err.error_description;
                } else {
                    errorMessage = JSON.stringify(err);
                }
            }

            if (errorMessage.includes("does not exist") || errorMessage.includes("get_users_list") || errorMessage.includes("in the schema cache")) {
                errorMessage = "Fungsi Database belum di-setup. Silakan jalankan SQL di bawah.";
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const createUser = async (email: string, password: string, role: string) => {
        setIsUpdating(true);
        try {
            const { error } = await supabase.rpc('create_user_by_admin', {
                email_input: email,
                password_input: password,
                role_input: role
            });

            if (error) throw error;

            await logActivity(user, 'CREATE_USER', `Created new user: ${email} with role ${role}`);
            await fetchUsers();
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message || JSON.stringify(err) };
        } finally {
            setIsUpdating(false);
        }
    };

    const updateUserRole = async (targetUserId: string, newRole: string) => {
        setIsUpdating(true);
        try {
            const { error } = await supabase.rpc('update_user_role', { 
                target_user_id: targetUserId, 
                new_role: newRole 
            });
            if (error) throw error;
            
            await logActivity(user, 'UPDATE_USER_ROLE', `Updated role for user ${targetUserId} to ${newRole}`);
            await fetchUsers();
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message || JSON.stringify(err) };
        } finally {
            setIsUpdating(false);
        }
    };

    const updateUserPassword = async (targetUserId: string, newPassword: string) => {
        setIsUpdating(true);
        try {
            const { error } = await supabase.rpc('update_password_by_admin', { 
                target_user_id: targetUserId, 
                new_password: newPassword 
            });
            if (error) throw error;

            await logActivity(user, 'UPDATE_USER_PASSWORD', `Changed password for user ${targetUserId}`);
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message || JSON.stringify(err) };
        } finally {
            setIsUpdating(false);
        }
    };

    const deleteUser = async (targetUserId: string) => {
        setIsUpdating(true);
        try {
            const { error } = await supabase.rpc('delete_user_by_admin', { 
                target_user_id: targetUserId 
            });
            if (error) throw error;

            await logActivity(user, 'DELETE_USER', `Deleted user ${targetUserId}`);
            await fetchUsers();
            return { success: true };
        } catch (err: any) {
            return { success: false, message: err.message || JSON.stringify(err) };
        } finally {
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return {
        users,
        loading,
        error,
        isUpdating,
        fetchUsers,
        createUser,
        updateUserRole,
        updateUserPassword,
        deleteUser
    };
};
