-- Admin User Setup SQL Commands
-- Run these commands in your Supabase SQL Editor

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Enable Row Level Security for admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for admin_users table
CREATE POLICY "Enable read access for authenticated admins" ON admin_users
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated admins" ON admin_users
    FOR UPDATE USING (auth.role() = 'authenticated');

-- 4. Create admin_sessions table for session management
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Enable RLS for admin_sessions
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- 6. Create session policies
CREATE POLICY "Enable session access for authenticated admins" ON admin_sessions
    FOR ALL USING (auth.role() = 'authenticated');

-- 7. Create admin_login_logs table for security logging
CREATE TABLE IF NOT EXISTS admin_login_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    username VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    login_successful BOOLEAN,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Enable RLS for admin_login_logs
ALTER TABLE admin_login_logs ENABLE ROW LEVEL SECURITY;

-- 9. Create login logs policies
CREATE POLICY "Enable log access for authenticated admins" ON admin_login_logs
    FOR ALL USING (auth.role() = 'authenticated');

-- 10. Create function to hash passwords (using pgcrypto extension)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 11. Create function to verify password
CREATE OR REPLACE FUNCTION verify_admin_password(input_username TEXT, input_password TEXT)
RETURNS TABLE(
    user_id UUID,
    username VARCHAR(50),
    full_name VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN,
    login_attempts INTEGER,
    locked_until TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.username,
        a.full_name,
        a.email,
        a.is_active,
        a.login_attempts,
        a.locked_until
    FROM admin_users a
    WHERE a.username = input_username 
    AND a.password_hash = crypt(input_password, a.password_hash)
    AND a.is_active = TRUE
    AND (a.locked_until IS NULL OR a.locked_until < NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create function to update login attempts
CREATE OR REPLACE FUNCTION update_login_attempts(input_username TEXT, success BOOLEAN)
RETURNS VOID AS $$
BEGIN
    IF success THEN
        UPDATE admin_users 
        SET login_attempts = 0, 
            last_login = NOW(),
            locked_until = NULL
        WHERE username = input_username;
    ELSE
        UPDATE admin_users 
        SET login_attempts = login_attempts + 1,
            locked_until = CASE 
                WHEN login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
                ELSE locked_until
            END
        WHERE username = input_username;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Create function to clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS VOID AS $$
BEGIN
    DELETE FROM admin_sessions 
    WHERE expires_at < NOW() OR is_active = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create the main admin user with your specified credentials
INSERT INTO admin_users (
    username, 
    password_hash, 
    email, 
    full_name, 
    role,
    is_active
) VALUES (
    'Admin1234',
    crypt('asdq12kaAdkaweql1283458asdka!@#', gen_salt('bf', 12)),
    'admin@padoodelivery.com',
    'System Administrator',
    'super_admin',
    TRUE
) ON CONFLICT (username) DO UPDATE SET
    password_hash = crypt('asdq12kaAdkaweql1283458asdka!@#', gen_salt('bf', 12)),
    email = 'admin@padoodelivery.com',
    full_name = 'System Administrator',
    role = 'super_admin',
    is_active = TRUE,
    updated_at = NOW();

-- 15. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_admin_id ON admin_login_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_logs_created_at ON admin_login_logs(created_at);

-- 16. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 17. Create scheduled job to clean up expired sessions (run every hour)
-- Note: This requires pg_cron extension which may not be available in all Supabase plans
-- You can also create a cron job in your application to call cleanup_expired_sessions()

-- 18. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON admin_users TO authenticated;
GRANT ALL ON admin_sessions TO authenticated;
GRANT ALL ON admin_login_logs TO authenticated;
GRANT EXECUTE ON FUNCTION verify_admin_password TO authenticated;
GRANT EXECUTE ON FUNCTION update_login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions TO authenticated;

-- 19. Create view for admin dashboard stats (optional)
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    'total_admins' as stat_name,
    COUNT(*)::TEXT as stat_value
FROM admin_users WHERE is_active = TRUE
UNION ALL
SELECT 
    'active_sessions' as stat_name,
    COUNT(*)::TEXT as stat_value
FROM admin_sessions WHERE is_active = TRUE AND expires_at > NOW()
UNION ALL
SELECT 
    'login_attempts_today' as stat_name,
    COUNT(*)::TEXT as stat_value
FROM admin_login_logs WHERE created_at >= CURRENT_DATE;

-- 20. Test the admin user creation
-- This will return the admin user details if successful
SELECT 
    id,
    username,
    email,
    full_name,
    role,
    is_active,
    created_at
FROM admin_users 
WHERE username = 'Admin1234';

-- 21. Test password verification
-- This should return the admin user details if the password is correct
SELECT * FROM verify_admin_password('Admin1234', 'asdq12kaAdkaweql1283458asdka!@#');

-- Success message
SELECT 'Admin user setup completed successfully!' as message; 