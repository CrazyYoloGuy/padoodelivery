-- Migration to standardize all timestamp columns to 'timestamp with time zone'
-- Run this to fix timestamp inconsistencies

-- Fix driver_notifications table
ALTER TABLE public.driver_notifications 
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN confirmed_at TYPE timestamp with time zone USING confirmed_at AT TIME ZONE 'Europe/Athens';

-- Fix notifications table  3
ALTER TABLE public.notifications
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens';

-- Fix shop_notifications table
ALTER TABLE public.shop_notifications
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'Europe/Athens';

-- Fix shop_orders table
ALTER TABLE public.shop_orders
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'Europe/Athens';

-- Fix shop_sessions table
ALTER TABLE public.shop_sessions
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN expires_at TYPE timestamp with time zone USING expires_at AT TIME ZONE 'Europe/Athens';

-- Fix shop_team_members table
ALTER TABLE public.shop_team_members
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'Europe/Athens';

-- Fix user_sessions table
ALTER TABLE public.user_sessions
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN last_activity TYPE timestamp with time zone USING last_activity AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN expires_at TYPE timestamp with time zone USING expires_at AT TIME ZONE 'Europe/Athens';

-- Fix user_settings table
ALTER TABLE public.user_settings
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens',
  ALTER COLUMN updated_at TYPE timestamp with time zone USING updated_at AT TIME ZONE 'Europe/Athens';

-- Fix session_conflicts table
ALTER TABLE public.session_conflicts
  ALTER COLUMN created_at TYPE timestamp with time zone USING created_at AT TIME ZONE 'Europe/Athens';

-- Update default values to use timezone-aware functions
ALTER TABLE public.driver_notifications 
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.notifications
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.shop_notifications
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.shop_orders
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.shop_sessions
  ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.shop_team_members
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.user_sessions
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN last_activity SET DEFAULT now(),
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

ALTER TABLE public.user_settings
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.session_conflicts
  ALTER COLUMN created_at SET DEFAULT now();

-- Verify the changes
SELECT 
  table_name, 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND column_name LIKE '%_at'
  AND table_name IN (
    'driver_notifications', 'notifications', 'shop_notifications', 
    'shop_orders', 'shop_sessions', 'shop_team_members', 
    'user_sessions', 'user_settings', 'session_conflicts'
  )
ORDER BY table_name, column_name; 