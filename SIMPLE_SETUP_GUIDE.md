# Simple Admin Login Setup

## Quick Setup (3 Steps)

### Step 1: Update Supabase Configuration
In `dashboard/index.html` (around line 340), replace:
```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
```

With your actual Supabase credentials from your project settings.

### Step 2: Run Database Setup
1. Go to your Supabase project
2. Open **SQL Editor**
3. Copy and paste the entire contents of `simple_admin_setup.sql`
4. Click **Run**

### Step 3: Login
Visit your dashboard and use these credentials:
- **Username:** `Admin1234`
- **Password:** `asdq12kaAdkaweql1283458asdka!@#`

## Design Features
✅ **Clean black and white theme**
✅ **No images or logos**
✅ **Simple, professional interface**
✅ **Mobile responsive**
✅ **Secure authentication**

## Security Features
- Bcrypt password hashing
- Session management
- Auto-logout after inactivity
- Failed login tracking
- Account lockout after 5 attempts

## That's It!
Your admin login is now ready with a clean, professional black and white design.

---

**Note:** Make sure to update your Supabase credentials in the configuration files before testing. 