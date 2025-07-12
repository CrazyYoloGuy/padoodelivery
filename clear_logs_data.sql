-- Clear All Logs Data (Keep Table Structures)
-- Run this in your Supabase SQL Editor to delete all log data and start fresh

-- Clear admin login logs
DELETE FROM admin_login_logs;

-- Clear admin session logs  
DELETE FROM admin_session_logs;

-- Clear admin activity logs
DELETE FROM admin_activity_logs;

-- Clear admin security events
DELETE FROM admin_security_events;

-- Reset any auto-increment sequences (if any)
-- Note: UUID primary keys don't use sequences, but this is here for completeness

-- Optional: Reset statistics and clean up any orphaned data
-- This ensures a completely fresh start

-- Success message
SELECT 'All log data cleared successfully!' as message;
SELECT 'Tables preserved: admin_login_logs, admin_session_logs, admin_activity_logs, admin_security_events' as tables_info;
SELECT 'You can now start with fresh logging data' as note; 