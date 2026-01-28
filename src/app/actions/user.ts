'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionState = {
    message: string;
    status: 'idle' | 'success' | 'error';
};

export async function updateProfile(prevState: ActionState, formData: FormData): Promise<ActionState> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { message: 'Unauthorized', status: 'error' };
    }

    const fullName = formData.get('fullName') as string;
    // const avatarUrl = formData.get('avatarUrl') as string; // Optional for now

    const updates: any = {};
    if (fullName !== null) updates.full_name = fullName;
    // if (avatarUrl) updates.avatar_url = avatarUrl;

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

    if (error) {
        console.error('Profile update error:', error);
        return { message: 'Failed to update profile', status: 'error' };
    }

    revalidatePath('/personalization');
    return { message: 'Profile updated successfully', status: 'success' };
}

export async function getProfile() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return data;
}
