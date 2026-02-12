
import { supabase } from './supabase';
import { User } from '../types';

export const logActivity = async (user: User | null, action: string, details: string) => {
    if (!user) return;

    try {
        await supabase.from('audit_logs').insert({
            user_email: user.email,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("Failed to log activity:", error);
        // Fail silently so we don't block the main user action
    }
};
