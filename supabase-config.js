// CarePro - Supabase Configuration
// Actual project credentials

const SUPABASE_URL = 'https://kqslxxtksqshfratlyhs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3e30upvmFvxawBzQ6Q6dHw_mGrzhKr6';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
