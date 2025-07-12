-- Fix for the verify_admin_password function type mismatch
-- Run this SQL to fix the function definition

-- Drop the existing function first
DROP FUNCTION IF EXISTS verify_admin_password(text, text);

-- Create the corrected function with proper return types
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

-- Test the function
SELECT * FROM verify_admin_password('Admin1234', 'asdq12kaAdkaweql1283458asdka!@#');

-- Success message
SELECT 'Function fixed successfully!' as message; 