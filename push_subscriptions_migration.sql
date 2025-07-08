-- Push Subscriptions Migration
-- Creates table to store push notification subscriptions for mobile notifications

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('driver', 'shop')),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate subscriptions per user
    UNIQUE(user_id, user_type)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Add comments for documentation
COMMENT ON TABLE public.push_subscriptions IS 'Stores push notification subscriptions for mobile notifications like Instagram/WhatsApp';
COMMENT ON COLUMN public.push_subscriptions.user_id IS 'ID of the user (driver or shop)';
COMMENT ON COLUMN public.push_subscriptions.user_type IS 'Type of user (driver or shop)';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'Push notification endpoint URL';
COMMENT ON COLUMN public.push_subscriptions.p256dh_key IS 'P256dh key for push encryption';
COMMENT ON COLUMN public.push_subscriptions.auth_key IS 'Auth key for push encryption';

-- Enable RLS (Row Level Security)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Grant necessary permissions
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.push_subscriptions_id_seq TO authenticated;

-- Optional: Insert sample data for testing (remove in production)
-- INSERT INTO public.push_subscriptions (user_id, user_type, endpoint, p256dh_key, auth_key) VALUES
-- (1, 'driver', 'https://example.com/push/endpoint', 'sample_p256dh_key', 'sample_auth_key');

COMMIT; 