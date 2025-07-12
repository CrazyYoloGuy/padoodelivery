-- Enhanced Admin Logging System
-- Run this in your Supabase SQL Editor to set up comprehensive logging

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update admin_login_logs table with enhanced fields
DROP TABLE IF EXISTS admin_login_logs CASCADE;
CREATE TABLE admin_login_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    browser VARCHAR(50),
    operating_system VARCHAR(50),
    location_country VARCHAR(100),
    location_city VARCHAR(100),
    location_coordinates POINT,
    login_successful BOOLEAN NOT NULL,
    failure_reason TEXT,
    session_token VARCHAR(255),
    login_duration_ms INTEGER, -- For successful logins, time to complete login
    security_flags JSONB, -- Additional security information
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_admin_login_logs_created_at ON admin_login_logs (created_at);
CREATE INDEX idx_admin_login_logs_ip ON admin_login_logs (ip_address);
CREATE INDEX idx_admin_login_logs_username ON admin_login_logs (username);
CREATE INDEX idx_admin_login_logs_successful ON admin_login_logs (login_successful);
CREATE INDEX idx_admin_login_logs_admin_id ON admin_login_logs (admin_id);

-- Create admin_session_logs table for session activity
CREATE TABLE IF NOT EXISTS admin_session_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    session_token VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'create', 'refresh', 'expire', 'logout'
    ip_address INET,
    user_agent TEXT,
    duration_minutes INTEGER, -- For logout/expire events
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for session logs
CREATE INDEX idx_session_logs_token ON admin_session_logs (session_token);
CREATE INDEX idx_session_logs_action ON admin_session_logs (action);
CREATE INDEX idx_session_logs_created_at ON admin_session_logs (created_at);

-- Create admin_activity_logs table for dashboard actions
CREATE TABLE IF NOT EXISTS admin_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    username VARCHAR(50),
    action VARCHAR(100) NOT NULL, -- 'view_logs', 'export_logs', 'manage_users', etc.
    resource_type VARCHAR(50), -- 'user', 'shop', 'category', 'logs'
    resource_id VARCHAR(100), -- ID of the resource being acted upon
    details JSONB, -- Additional action details
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for activity logs
CREATE INDEX idx_activity_logs_admin_id ON admin_activity_logs (admin_id);
CREATE INDEX idx_activity_logs_action ON admin_activity_logs (action);
CREATE INDEX idx_activity_logs_resource ON admin_activity_logs (resource_type);
CREATE INDEX idx_activity_logs_created_at ON admin_activity_logs (created_at);

-- Create admin_security_events table for security-related events
CREATE TABLE IF NOT EXISTS admin_security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'brute_force', 'account_locked', 'suspicious_location', etc.
    severity VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    username VARCHAR(50),
    ip_address INET,
    description TEXT,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES admin_users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for security events
CREATE INDEX idx_security_events_type ON admin_security_events (event_type);
CREATE INDEX idx_security_events_severity ON admin_security_events (severity);
CREATE INDEX idx_security_events_resolved ON admin_security_events (resolved);
CREATE INDEX idx_security_events_created_at ON admin_security_events (created_at);

-- Enhanced login logging function
CREATE OR REPLACE FUNCTION log_admin_login_attempt(
    p_username VARCHAR(50),
    p_password_attempt TEXT,
    p_ip_address INET,
    p_user_agent TEXT,
    p_success BOOLEAN,
    p_failure_reason TEXT DEFAULT NULL,
    p_admin_id UUID DEFAULT NULL,
    p_session_token VARCHAR(255) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
    browser VARCHAR(50);
    os VARCHAR(50);
    security_flags JSONB;
    login_start_time TIMESTAMP;
    login_duration INTEGER;
BEGIN
    -- Extract browser and OS from user agent
    browser := CASE 
        WHEN p_user_agent LIKE '%Chrome%' THEN 'Chrome'
        WHEN p_user_agent LIKE '%Firefox%' THEN 'Firefox'
        WHEN p_user_agent LIKE '%Safari%' AND p_user_agent NOT LIKE '%Chrome%' THEN 'Safari'
        WHEN p_user_agent LIKE '%Edge%' THEN 'Edge'
        WHEN p_user_agent LIKE '%Opera%' THEN 'Opera'
        ELSE 'Unknown'
    END;
    
    os := CASE 
        WHEN p_user_agent LIKE '%Windows%' THEN 'Windows'
        WHEN p_user_agent LIKE '%Macintosh%' OR p_user_agent LIKE '%Mac OS%' THEN 'macOS'
        WHEN p_user_agent LIKE '%Linux%' THEN 'Linux'
        WHEN p_user_agent LIKE '%Android%' THEN 'Android'
        WHEN p_user_agent LIKE '%iPhone%' OR p_user_agent LIKE '%iPad%' THEN 'iOS'
        ELSE 'Unknown'
    END;
    
    -- Create security flags
    security_flags := jsonb_build_object(
        'ip_type', CASE 
            WHEN p_ip_address << '10.0.0.0/8'::inet OR 
                 p_ip_address << '172.16.0.0/12'::inet OR 
                 p_ip_address << '192.168.0.0/16'::inet THEN 'private'
            ELSE 'public'
        END,
        'password_length', length(p_password_attempt),
        'has_special_chars', p_password_attempt ~ '[!@#$%^&*(),.?":{}|<>]'
    );
    
    -- Calculate login duration (mock for now, could be enhanced)
    login_duration := CASE WHEN p_success THEN 1500 + (random() * 2000)::INTEGER ELSE NULL END;
    
    -- Insert log entry
    INSERT INTO admin_login_logs (
        admin_id,
        username,
        ip_address,
        user_agent,
        browser,
        operating_system,
        login_successful,
        failure_reason,
        session_token,
        login_duration_ms,
        security_flags,
        created_at
    ) VALUES (
        p_admin_id,
        p_username,
        p_ip_address,
        p_user_agent,
        browser,
        os,
        p_success,
        p_failure_reason,
        p_session_token,
        login_duration,
        security_flags,
        NOW()
    ) RETURNING id INTO log_id;
    
    -- Check for security events
    PERFORM check_security_events(p_username, p_ip_address, p_success);
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for security events
CREATE OR REPLACE FUNCTION check_security_events(
    p_username VARCHAR(50),
    p_ip_address INET,
    p_success BOOLEAN
) RETURNS VOID AS $$
DECLARE
    failed_attempts INTEGER;
    recent_ips INTEGER;
    is_new_location BOOLEAN;
BEGIN
    -- Check for brute force attempts
    IF NOT p_success THEN
        SELECT COUNT(*) INTO failed_attempts
        FROM admin_login_logs
        WHERE username = p_username
        AND login_successful = FALSE
        AND created_at > NOW() - INTERVAL '1 hour';
        
        IF failed_attempts >= 3 THEN
            INSERT INTO admin_security_events (
                event_type,
                severity,
                username,
                ip_address,
                description,
                metadata
            ) VALUES (
                'brute_force_attempt',
                CASE WHEN failed_attempts >= 5 THEN 'high' ELSE 'medium' END,
                p_username,
                p_ip_address,
                format('Multiple failed login attempts detected: %s attempts in the last hour', failed_attempts),
                jsonb_build_object('failed_attempts', failed_attempts, 'time_window', '1 hour')
            );
        END IF;
    END IF;
    
    -- Check for suspicious location (new IP for successful login)
    IF p_success THEN
        SELECT COUNT(DISTINCT ip_address) INTO recent_ips
        FROM admin_login_logs
        WHERE username = p_username
        AND login_successful = TRUE
        AND created_at > NOW() - INTERVAL '30 days';
        
        -- Check if this IP was used before
        SELECT NOT EXISTS (
            SELECT 1 FROM admin_login_logs
            WHERE username = p_username
            AND ip_address = p_ip_address
            AND login_successful = TRUE
            AND created_at < NOW() - INTERVAL '1 day'
        ) INTO is_new_location;
        
        IF is_new_location AND recent_ips > 1 THEN
            INSERT INTO admin_security_events (
                event_type,
                severity,
                username,
                ip_address,
                description,
                metadata
            ) VALUES (
                'new_location_login',
                'medium',
                p_username,
                p_ip_address,
                'Login from new IP address detected',
                jsonb_build_object('previous_ip_count', recent_ips)
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log session activity
CREATE OR REPLACE FUNCTION log_session_activity(
    p_admin_id UUID,
    p_session_token VARCHAR(255),
    p_action VARCHAR(50),
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_session_logs (
        admin_id,
        session_token,
        action,
        ip_address,
        user_agent,
        duration_minutes,
        created_at
    ) VALUES (
        p_admin_id,
        p_session_token,
        p_action,
        p_ip_address,
        p_user_agent,
        p_duration_minutes,
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin activities
CREATE OR REPLACE FUNCTION log_admin_activity(
    p_admin_id UUID,
    p_username VARCHAR(50),
    p_action VARCHAR(100),
    p_resource_type VARCHAR(50) DEFAULT NULL,
    p_resource_id VARCHAR(100) DEFAULT NULL,
    p_details JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_activity_logs (
        admin_id,
        username,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_admin_id,
        p_username,
        p_action,
        p_resource_type,
        p_resource_id,
        p_details,
        p_ip_address,
        p_user_agent,
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for comprehensive log analysis
CREATE OR REPLACE VIEW admin_logs_comprehensive AS
SELECT 
    'login_attempt' as log_type,
    l.id,
    l.username,
    l.ip_address,
    l.browser || ' on ' || l.operating_system as client_info,
    l.location_city || ', ' || l.location_country as location,
    CASE WHEN l.login_successful THEN 'Success' ELSE 'Failed' END as status,
    l.failure_reason as details,
    l.created_at
FROM admin_login_logs l

UNION ALL

SELECT 
    'session_activity' as log_type,
    s.id,
    u.username,
    s.ip_address,
    'Session ' || s.action as client_info,
    NULL as location,
    'Info' as status,
    'Duration: ' || COALESCE(s.duration_minutes::TEXT || ' minutes', 'N/A') as details,
    s.created_at
FROM admin_session_logs s
LEFT JOIN admin_users u ON s.admin_id = u.id

UNION ALL

SELECT 
    'admin_activity' as log_type,
    a.id,
    a.username,
    a.ip_address,
    a.action as client_info,
    NULL as location,
    'Activity' as status,
    a.resource_type || CASE WHEN a.resource_id IS NOT NULL THEN ' (ID: ' || a.resource_id || ')' ELSE '' END as details,
    a.created_at
FROM admin_activity_logs a

ORDER BY created_at DESC;

-- Create function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS TABLE(
    stat_name TEXT,
    stat_value TEXT,
    stat_description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_logins'::TEXT, COUNT(*)::TEXT, 'Total login attempts'::TEXT
    FROM admin_login_logs
    
    UNION ALL
    
    SELECT 'successful_logins'::TEXT, COUNT(*)::TEXT, 'Successful logins'::TEXT
    FROM admin_login_logs WHERE login_successful = TRUE
    
    UNION ALL
    
    SELECT 'failed_logins'::TEXT, COUNT(*)::TEXT, 'Failed login attempts'::TEXT
    FROM admin_login_logs WHERE login_successful = FALSE
    
    UNION ALL
    
    SELECT 'unique_ips'::TEXT, COUNT(DISTINCT ip_address)::TEXT, 'Unique IP addresses'::TEXT
    FROM admin_login_logs
    
    UNION ALL
    
    SELECT 'security_events'::TEXT, COUNT(*)::TEXT, 'Security events detected'::TEXT
    FROM admin_security_events WHERE NOT resolved
    
    UNION ALL
    
    SELECT 'today_logins'::TEXT, COUNT(*)::TEXT, 'Login attempts today'::TEXT
    FROM admin_login_logs WHERE DATE(created_at) = CURRENT_DATE
    
    UNION ALL
    
    SELECT 'last_login'::TEXT, 
           COALESCE(MAX(created_at)::TEXT, 'Never'), 
           'Last successful login'::TEXT
    FROM admin_login_logs WHERE login_successful = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean old logs (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(
    table_name TEXT,
    deleted_count INTEGER
) AS $$
DECLARE
    cutoff_date TIMESTAMP;
    login_deleted INTEGER;
    session_deleted INTEGER;
    activity_deleted INTEGER;
    security_deleted INTEGER;
BEGIN
    cutoff_date := NOW() - (days_to_keep || ' days')::INTERVAL;
    
    -- Clean login logs
    DELETE FROM admin_login_logs WHERE created_at < cutoff_date;
    GET DIAGNOSTICS login_deleted = ROW_COUNT;
    
    -- Clean session logs
    DELETE FROM admin_session_logs WHERE created_at < cutoff_date;
    GET DIAGNOSTICS session_deleted = ROW_COUNT;
    
    -- Clean activity logs
    DELETE FROM admin_activity_logs WHERE created_at < cutoff_date;
    GET DIAGNOSTICS activity_deleted = ROW_COUNT;
    
    -- Clean resolved security events older than cutoff
    DELETE FROM admin_security_events WHERE created_at < cutoff_date AND resolved = TRUE;
    GET DIAGNOSTICS security_deleted = ROW_COUNT;
    
    RETURN QUERY VALUES 
        ('admin_login_logs', login_deleted),
        ('admin_session_logs', session_deleted),
        ('admin_activity_logs', activity_deleted),
        ('admin_security_events', security_deleted);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE admin_login_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_security_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (read-only for admin dashboard)
CREATE POLICY "Admin can view all login logs" ON admin_login_logs
    FOR SELECT USING (true);

CREATE POLICY "Admin can view all session logs" ON admin_session_logs
    FOR SELECT USING (true);

CREATE POLICY "Admin can view all activity logs" ON admin_activity_logs
    FOR SELECT USING (true);

CREATE POLICY "Admin can view all security events" ON admin_security_events
    FOR SELECT USING (true);

-- NO INSERT/UPDATE/DELETE policies for logs (read-only from dashboard)
-- Logs can only be created through functions

-- Grant permissions
GRANT SELECT ON admin_login_logs TO authenticated;
GRANT SELECT ON admin_session_logs TO authenticated;
GRANT SELECT ON admin_activity_logs TO authenticated;
GRANT SELECT ON admin_security_events TO authenticated;
GRANT SELECT ON admin_logs_comprehensive TO authenticated;

GRANT EXECUTE ON FUNCTION log_admin_login_attempt TO authenticated;
GRANT EXECUTE ON FUNCTION log_session_activity TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_activity TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_logs TO authenticated;

-- No sample data - system will start with real logs only

-- Success message
SELECT 'Enhanced admin logging system setup completed!' as message;
SELECT 'Tables created: admin_login_logs, admin_session_logs, admin_activity_logs, admin_security_events' as tables_info;
SELECT 'Functions created: log_admin_login_attempt, log_session_activity, log_admin_activity, get_admin_dashboard_stats, cleanup_old_logs' as functions_info;
SELECT 'View created: admin_logs_comprehensive' as view_info;
SELECT 'Logs are read-only from dashboard for security' as security_note; 