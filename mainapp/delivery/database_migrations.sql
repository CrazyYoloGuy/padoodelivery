-- Create logs table (run this in your Supabase SQL editor)
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action_type ON system_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- Enable RLS
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Create policy (allow all authenticated users to view logs)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'system_logs' 
        AND policyname = 'System logs are viewable by authenticated users'
    ) THEN
        CREATE POLICY "System logs are viewable by authenticated users" ON system_logs
            FOR SELECT USING (true);
    END IF;
END $$;

-- Grant necessary permissions
GRANT SELECT ON system_logs TO authenticated;
GRANT INSERT ON system_logs TO service_role;

-- Add status column to user_shops table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_shops' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE user_shops ADD COLUMN status VARCHAR(20) DEFAULT 'active';
    END IF;
END $$;

-- Update existing shops to have active status
UPDATE user_shops SET status = 'active' WHERE status IS NULL;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_user_shops_status ON user_shops(status);

-- Create user_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_orders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    earnings DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_orders_user_id ON user_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orders_created_at ON user_orders(created_at DESC);

-- Enable RLS
ALTER TABLE user_orders ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_orders' 
        AND policyname = 'Users can view own orders'
    ) THEN
        CREATE POLICY "Users can view own orders" ON user_orders
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_orders' 
        AND policyname = 'Users can insert own orders'
    ) THEN
        CREATE POLICY "Users can insert own orders" ON user_orders
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_orders' 
        AND policyname = 'Users can update own orders'
    ) THEN
        CREATE POLICY "Users can update own orders" ON user_orders
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_orders' 
        AND policyname = 'Users can delete own orders'
    ) THEN
        CREATE POLICY "Users can delete own orders" ON user_orders
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON user_orders TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE user_orders_id_seq TO authenticated;

-- Create users table for user profiles
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    phone VARCHAR,
    role VARCHAR DEFAULT 'driver',
    status VARCHAR DEFAULT 'active',
    total_orders INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_type ENUM('driver', 'shop') DEFAULT 'driver'
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile" ON users
            FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON users
            FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON users TO authenticated;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Add shop accounts table (separate from partner shops that drivers deliver to)
CREATE TABLE shop_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rename existing shops table to partner_shops for clarity
RENAME TABLE shops TO partner_shops;

-- Update partner_shops to link with shop_accounts (optional)
ALTER TABLE partner_shops ADD COLUMN shop_account_id INT NULL;
ALTER TABLE partner_shops ADD FOREIGN KEY (shop_account_id) REFERENCES shop_accounts(id);

-- Create shop_orders table for shops to manage their orders
CREATE TABLE shop_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    shop_account_id INT NOT NULL,
    driver_id INT,
    order_amount DECIMAL(10,2) NOT NULL,
    driver_earnings DECIMAL(10,2),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(50),
    delivery_address TEXT,
    status ENUM('pending', 'assigned', 'picked_up', 'delivered', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_account_id) REFERENCES shop_accounts(id),
    FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- Create notifications/alerts table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_type ENUM('driver', 'shop') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'success', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create shop_team_members table to permanently store shop's delivery team
CREATE TABLE IF NOT EXISTS shop_team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id INT NOT NULL REFERENCES shop_accounts(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(shop_id, driver_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shop_team_shop_id ON shop_team_members(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_team_driver_id ON shop_team_members(driver_id);

-- Create driver_notifications table to store notifications for drivers
CREATE TABLE IF NOT EXISTS driver_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id INT NOT NULL REFERENCES shop_accounts(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_driver_id ON driver_notifications(driver_id);
CREATE INDEX IF NOT EXISTS idx_notifications_shop_id ON driver_notifications(shop_id);

-- Enable Row Level Security
ALTER TABLE shop_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON shop_team_members FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON shop_team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON shop_team_members FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON shop_team_members FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON driver_notifications FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON driver_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON driver_notifications FOR UPDATE USING (true);
CREATE POLICY "Enable delete for authenticated users only" ON driver_notifications FOR DELETE USING (true);

-- Add notificationSettings column to user_settings table
ALTER TABLE public.user_settings
ADD COLUMN notificationSettings JSONB DEFAULT '{}'::jsonb;

-- Add address and payment_method columns to orders table if they don't exist
DO $$ 
BEGIN
    -- Check if address column exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'address'
    ) THEN
        ALTER TABLE orders ADD COLUMN address TEXT;
    END IF;
    
    -- Check if payment_method column exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE orders ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash';
    END IF;
END $$; 

-- Add language field to user_settings table
-- This migration adds a language preference field to store user's language choice

-- Add the language column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS language character varying(5) DEFAULT 'en';

-- Add a check constraint to ensure only valid language codes are stored
ALTER TABLE public.user_settings 
ADD CONSTRAINT user_settings_language_check 
CHECK (language IN ('en', 'el'));

-- Create an index for better performance when filtering by language
CREATE INDEX IF NOT EXISTS idx_user_settings_language 
ON public.user_settings(language);

-- Add a comment to document the column
COMMENT ON COLUMN public.user_settings.language IS 'User preferred language: en for English, el for Greek';

-- Update existing records to have default language 'en'
UPDATE public.user_settings 
SET language = 'en' 
WHERE language IS NULL;

-- Migration completed successfully
SELECT 'Language settings migration completed successfully!' as result; 