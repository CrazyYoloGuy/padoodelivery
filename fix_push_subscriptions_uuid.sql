-- Fix Push Subscriptions Table Migration
-- Updates the user_id column from INTEGER to UUID to match the actual user ID format

-- Begin transaction
BEGIN;

-- Step 1: Drop all policies first (they prevent column type changes)
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;

-- Step 2: Drop all constraints and indexes that depend on user_id
DROP INDEX IF EXISTS idx_push_subscriptions_user;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_user_type_key;

-- Step 3: Remove any existing data to avoid type conversion issues
DELETE FROM public.push_subscriptions;

-- Step 4: Now safely alter the column type from INTEGER to UUID
ALTER TABLE public.push_subscriptions 
ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;

-- Step 5: Recreate the constraints and indexes
CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id, user_type);
ALTER TABLE public.push_subscriptions 
ADD CONSTRAINT push_subscriptions_user_id_user_type_key UNIQUE(user_id, user_type);

-- Step 6: Recreate the RLS policy with proper UUID handling
CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions
    FOR ALL USING (auth.uid() = user_id OR auth.uid()::text = user_id::text);

-- Step 7: Update the column comment
COMMENT ON COLUMN public.push_subscriptions.user_id IS 'ID of the user (driver or shop) - UUID format';

-- Commit the transaction
COMMIT;

-- Display success message
SELECT 'Push subscriptions table successfully updated to use UUID for user_id' as result; 