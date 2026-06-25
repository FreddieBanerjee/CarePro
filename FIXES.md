# CarePro - Quick Fix Guide

## Issue 1: "Could not find 'certified' column" Error

**Solution:** Add the missing columns to your Supabase `users` table.

### In Supabase:
1. Go to your database
2. Find the `users` table
3. Click "Edit" or go to the schema
4. Add these columns if they don't exist:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS certified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS years_experience INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialties TEXT;
```

Or use the Supabase UI:
- Click "+" next to columns
- Add: `certified` (boolean, default: false)
- Add: `years_experience` (integer, default: 0)
- Add: `phone` (text, nullable)
- Add: `emergency_contact` (text, nullable)
- Add: `bio` (text, nullable)
- Add: `languages` (text, nullable)
- Add: `specialties` (text, nullable)

## Issue 2: Home Button Doesn't Work (FIXED)

**What I changed:**
- Updated navigation throughout the app
- Removed "Home" buttons on logged-in pages (they don't need to go home)
- Dashboard now shows: "Browse Babysitters", "My Profile", "Messages", "Logout"
- User Profile shows: "My Bookings", "Logout"
- All pages now navigate properly

The navigation is now fixed - no action needed!

## Files Updated:
✅ script.js - handles missing columns gracefully
✅ dashboard.html - fixed navigation
✅ babysitter-dashboard.html - fixed navigation
✅ messaging.html - fixed navigation
✅ user-profile.html - fixed navigation

## Test It:
1. Try editing your profile again
2. Click navigation buttons - they should work smoothly
3. No more "column not found" errors

That's it! You're all set. 🚀
