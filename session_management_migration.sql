-- Session Management Migration
-- This migration adds session tracking to prevent multiple users from using the same account simultaneously

-- Create user_sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    user_type character varying NOT NULL CHECK (user_type::text = ANY (ARRAY['driver'::character varying, 'shop'::character varying]::text[])),
    session_token character varying NOT NULL UNIQUE,
    user_agent text,
    ip_address inet,
    created_at timestamp without time zone DEFAULT now(),
    last_activity timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + interval '24 hours'),
    is_active boolean DEFAULT true,
    CONSTRAINT user_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create shop_sessions table for shop accounts
CREATE TABLE IF NOT EXISTS public.shop_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    shop_id integer NOT NULL,
    session_token character varying NOT NULL UNIQUE,
    user_agent text,
    ip_address inet,
    created_at timestamp without time zone DEFAULT now(),
    last_activity timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + interval '24 hours'),
    is_active boolean DEFAULT true,
    CONSTRAINT shop_sessions_pkey PRIMARY KEY (id),
    CONSTRAINT shop_sessions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_accounts(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON public.user_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_shop_sessions_shop_id ON public.shop_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_sessions_session_token ON public.shop_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_shop_sessions_expires_at ON public.shop_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_shop_sessions_is_active ON public.shop_sessions(is_active);

-- Create session conflict log table
CREATE TABLE IF NOT EXISTS public.session_conflicts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid,
    shop_id integer,
    user_type character varying NOT NULL CHECK (user_type::text = ANY (ARRAY['driver'::character varying, 'shop'::character varying]::text[])),
    old_session_id uuid,
    new_session_id uuid,
    conflict_reason character varying DEFAULT 'concurrent_login',
    ip_address inet,
    user_agent text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT session_conflicts_pkey PRIMARY KEY (id),
    CONSTRAINT session_conflicts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT session_conflicts_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES public.shop_accounts(id) ON DELETE SET NULL,
    CONSTRAINT session_conflicts_old_session_fkey FOREIGN KEY (old_session_id) REFERENCES public.user_sessions(id) ON DELETE SET NULL,
    CONSTRAINT session_conflicts_new_session_fkey FOREIGN KEY (new_session_id) REFERENCES public.user_sessions(id) ON DELETE SET NULL
);

-- Create indexes for session conflicts
CREATE INDEX IF NOT EXISTS idx_session_conflicts_user_id ON public.session_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_session_conflicts_shop_id ON public.session_conflicts(shop_id);
CREATE INDEX IF NOT EXISTS idx_session_conflicts_created_at ON public.session_conflicts(created_at);

-- Enable Row Level Security
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_conflicts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_sessions
CREATE POLICY "Enable read access for authenticated users" ON public.user_sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.user_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for session owner" ON public.user_sessions
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for session owner" ON public.user_sessions
    FOR DELETE USING (true);

-- Create RLS policies for shop_sessions
CREATE POLICY "Enable read access for authenticated shops" ON public.shop_sessions
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated shops" ON public.shop_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for session owner" ON public.shop_sessions
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for session owner" ON public.shop_sessions
    FOR DELETE USING (true);

-- Create RLS policies for session_conflicts (read-only for admins)
CREATE POLICY "Enable read access for all users" ON public.session_conflicts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for system" ON public.session_conflicts
    FOR INSERT WITH CHECK (true);

-- Create function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    -- Clean up expired user sessions
    DELETE FROM public.user_sessions 
    WHERE expires_at < now() OR is_active = false;
    
    -- Clean up expired shop sessions
    DELETE FROM public.shop_sessions 
    WHERE expires_at < now() OR is_active = false;
    
    -- Log cleanup activity
    INSERT INTO public.system_logs (action_type, description, metadata)
    VALUES (
        'session_cleanup',
        'Cleaned up expired sessions',
        jsonb_build_object('timestamp', now())
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to get active session count for a user
CREATE OR REPLACE FUNCTION get_active_session_count(p_user_id uuid, p_user_type text)
RETURNS integer AS $$
DECLARE
    session_count integer;
BEGIN
    IF p_user_type = 'driver' THEN
        SELECT COUNT(*) INTO session_count
        FROM public.user_sessions
        WHERE user_id = p_user_id AND is_active = true AND expires_at > now();
    ELSIF p_user_type = 'shop' THEN
        SELECT COUNT(*) INTO session_count
        FROM public.shop_sessions
        WHERE shop_id = p_user_id::integer AND is_active = true AND expires_at > now();
    ELSE
        session_count := 0;
    END IF;
    
    RETURN session_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to invalidate all sessions for a user
CREATE OR REPLACE FUNCTION invalidate_user_sessions(p_user_id uuid, p_user_type text)
RETURNS void AS $$
BEGIN
    IF p_user_type = 'driver' THEN
        UPDATE public.user_sessions 
        SET is_active = false 
        WHERE user_id = p_user_id AND is_active = true;
    ELSIF p_user_type = 'shop' THEN
        UPDATE public.shop_sessions 
        SET is_active = false 
        WHERE shop_id = p_user_id::integer AND is_active = true;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to log session conflict
CREATE OR REPLACE FUNCTION log_session_conflict(
    p_user_id uuid,
    p_shop_id integer,
    p_user_type text,
    p_old_session_id uuid,
    p_new_session_id uuid,
    p_ip_address inet,
    p_user_agent text
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.session_conflicts (
        user_id, 
        shop_id, 
        user_type, 
        old_session_id, 
        new_session_id, 
        ip_address, 
        user_agent
    ) VALUES (
        p_user_id,
        p_shop_id,
        p_user_type,
        p_old_session_id,
        p_new_session_id,
        p_ip_address,
        p_user_agent
    );
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired sessions (if using pg_cron)
-- Note: This requires pg_cron extension to be installed
-- SELECT cron.schedule('cleanup-expired-sessions', '*/5 * * * *', 'SELECT cleanup_expired_sessions();');

-- Insert initial system log entry
INSERT INTO public.system_logs (action_type, description, metadata)
VALUES (
    'migration',
    'Session management tables created',
    jsonb_build_object(
        'migration_version', '1.0.0',
        'tables_created', ARRAY['user_sessions', 'shop_sessions', 'session_conflicts'],
        'timestamp', now()
    )
);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_sessions TO authenticated;
GRANT SELECT, INSERT ON public.session_conflicts TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_session_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION invalidate_user_sessions(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_session_conflict(uuid, integer, text, uuid, uuid, inet, text) TO authenticated; 