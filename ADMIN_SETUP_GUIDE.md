# Admin Dashboard Setup Guide

## Overview
This guide will help you set up a secure admin login system for your Padoo Delivery dashboard using Supabase authentication.

## Prerequisites
- Supabase account and project
- Basic understanding of SQL

## Step 1: Configure Supabase

### 1.1 Get Your Supabase Credentials
1. Go to your Supabase project dashboard
2. Navigate to **Settings > API**
3. Copy your:
   - Project URL
   - Anon/public key

### 1.2 Update Configuration
Edit the following files and replace the placeholder values:

**File: `dashboard/index.html`**
```javascript
// Line ~340 - Update these values
const supabaseUrl = 'YOUR_SUPABASE_URL';        // Replace with your project URL
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';   // Replace with your anon key
```

**File: `config/supabase.js`**
```javascript
// Update these values
const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'
```

## Step 2: Set Up Database

### 2.1 Run SQL Commands
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `create_admin_user.sql`
4. Click **Run** to execute all commands

### 2.2 Verify Setup
After running the SQL commands, you should see:
- Success message: "Admin user setup completed successfully!"
- Admin user details displayed
- Password verification result

## Step 3: Test the Login System

### 3.1 Access the Dashboard
1. Open your dashboard: `http://localhost:3000/dashboard` (or your domain)
2. You should see the login screen

### 3.2 Login Credentials
- **Username:** `Admin1234`
- **Password:** `asdq12kaAdkaweql1283458asdka!@#`

### 3.3 Expected Behavior
✅ **Successful Login:**
- Login button shows "Success!" with green color
- Dashboard loads with sidebar and main content
- Logout button appears in header

❌ **Failed Login:**
- Error message appears below login form
- Form clears for security
- Login attempts are logged

## Step 4: Security Features

### 4.1 Account Lockout
- Account locks after 5 failed login attempts
- Lockout duration: 30 minutes
- Automatic unlock after lockout period

### 4.2 Session Management
- Sessions expire after 24 hours
- Automatic logout after 8 hours of inactivity
- Session data stored securely in database

### 4.3 Security Logging
- All login attempts logged with IP address
- Failed login reasons tracked
- Session activity monitored

## Step 5: Database Tables Created

The setup creates these tables:

### `admin_users`
- Stores admin user credentials
- Bcrypt password hashing
- Account lockout functionality

### `admin_sessions`
- Manages active sessions
- Tracks IP addresses and user agents
- Automatic session cleanup

### `admin_login_logs`
- Logs all login attempts
- Security audit trail
- Failed login tracking

## Step 6: Advanced Configuration

### 6.1 Add More Admin Users
```sql
INSERT INTO admin_users (username, password_hash, email, full_name, role, is_active)
VALUES (
    'NewAdmin',
    crypt('YourSecurePassword123!', gen_salt('bf', 12)),
    'newadmin@yourdomain.com',
    'New Administrator',
    'admin',
    TRUE
);
```

### 6.2 View Admin Stats
```sql
SELECT * FROM admin_dashboard_stats;
```

### 6.3 Clean Up Expired Sessions
```sql
SELECT cleanup_expired_sessions();
```

## Step 7: Production Considerations

### 7.1 Environment Variables
For production, store sensitive data in environment variables:
```javascript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
```

### 7.2 HTTPS Only
- Always use HTTPS in production
- Update Content Security Policy
- Configure secure headers

### 7.3 Rate Limiting
Consider adding rate limiting to prevent brute force attacks:
```javascript
// Add to your server middleware
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
```

## Step 8: Troubleshooting

### 8.1 Common Issues

**Login not working:**
- Check Supabase credentials are correct
- Verify SQL commands executed successfully
- Check browser console for errors

**Session not persisting:**
- Ensure localStorage is enabled
- Check for JavaScript errors
- Verify session table exists

**Database connection failed:**
- Confirm Supabase URL and key are correct
- Check network connectivity
- Verify RLS policies are set up

### 8.2 Debug Mode
Enable debug logging by adding to console:
```javascript
// In browser console
localStorage.setItem('admin_debug', 'true');
```

## Step 9: Maintenance

### 9.1 Regular Tasks
- Monitor failed login attempts
- Clean up expired sessions
- Update admin passwords periodically
- Review security logs

### 9.2 Database Maintenance
```sql
-- Clean up old login logs (older than 30 days)
DELETE FROM admin_login_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- View active sessions
SELECT * FROM admin_sessions 
WHERE is_active = TRUE AND expires_at > NOW();
```

## Security Best Practices

1. **Strong Passwords:** Use complex passwords with special characters
2. **Regular Updates:** Keep dependencies updated
3. **Monitor Logs:** Review login logs regularly
4. **Backup:** Regular database backups
5. **Network Security:** Use VPN for admin access if possible

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify database tables exist
3. Confirm Supabase credentials
4. Test with provided credentials first

---

**Important:** Change the default admin password immediately after setup for security! 