-- Simple Admin Account Setup
-- Run this in your Supabase SQL Editor

-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create admin_users table if it doesn't exist
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

-- Create admin_sessions table for session management
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

-- Create admin_login_logs table for logging
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

-- Create the password verification function
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

-- Create function to update login attempts
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

-- Insert the admin user with the specified credentials
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
    'admin@example.com',
    'System Administrator',
    'admin',
    TRUE
) ON CONFLICT (username) DO UPDATE SET
    password_hash = crypt('asdq12kaAdkaweql1283458asdka!@#', gen_salt('bf', 12)),
    email = 'admin@example.com',
    full_name = 'System Administrator',
    role = 'admin',
    is_active = TRUE,
    updated_at = NOW();

-- Test the admin user creation
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

-- Test password verification
SELECT 'Testing password verification...' as status;
SELECT * FROM verify_admin_password('Admin1234', 'asdq12kaAdkaweql1283458asdka!@#');

-- Enable Row Level Security (RLS)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_logs ENABLE ROW LEVEL SECURITY;

-- Create basic policies (adjust based on your security requirements)
CREATE POLICY "Allow admin access" ON admin_users FOR ALL USING (true);
CREATE POLICY "Allow session access" ON admin_sessions FOR ALL USING (true);
CREATE POLICY "Allow log access" ON admin_login_logs FOR ALL USING (true);

-- Success message
SELECT 'Admin account setup completed successfully!' as message;
SELECT 'Username: Admin1234' as login_info;
SELECT 'Password: asdq12kaAdkaweql1283458asdka!@#' as password_info; 