-- Clear All Data Script
-- This script deletes all data from tables while preserving table structure
-- Run this in your SQL editor to reset the database for testing

-- IMPORTANT: This will delete ALL data. Make sure you have backups if needed!

-- Disable foreign key checks temporarily (if your database supports it)
-- For PostgreSQL, we'll delete in the right order to avoid FK constraint issues

-- 1. Clear dependent tables first (tables that reference others)

-- Clear orders (references users and shops)
DELETE FROM orders;

-- Clear driver notifications (references users and shop_accounts)  
DELETE FROM driver_notifications;

-- Clear notifications (references users and shop_accounts)
DELETE FROM notifications;

-- Clear partner shops (references users and categories)
DELETE FROM partner_shops;

-- Clear shop accounts (may reference categories)
DELETE FROM shop_accounts;

-- Clear user settings (references users)
DELETE FROM user_settings;

-- Clear push subscriptions (if exists, references users)
DELETE FROM push_subscriptions;

-- 2. Clear parent tables (tables that are referenced by others)

-- Clear users table
DELETE FROM users;

-- Clear categories (referenced by shops)
DELETE FROM categories;

-- 3. Reset any sequences (auto-increment counters) to start from 1 again
-- This ensures IDs start from 1 when you add new data

-- Reset categories sequence
ALTER SEQUENCE categories_id_seq RESTART WITH 1;

-- Reset orders sequence  
ALTER SEQUENCE orders_id_seq RESTART WITH 1;

-- Reset notifications sequence
ALTER SEQUENCE notifications_id_seq RESTART WITH 1;

-- Reset any other sequences if they exist
-- ALTER SEQUENCE partner_shops_id_seq RESTART WITH 1;
-- ALTER SEQUENCE shop_accounts_id_seq RESTART WITH 1;

-- 4. Optional: Insert a default "Uncategorized" category to start with
INSERT INTO categories (name, description, icon, color, is_active) 
VALUES ('Uncategorized', 'Default category for shops', 'fas fa-utensils', '#ff6b35', true);

-- 5. Show confirmation message
SELECT 'All data cleared successfully! Database is ready for fresh testing.' as status;

-- 6. Optional: Show table counts to verify everything is cleared
SELECT 
    'users' as table_name, COUNT(*) as record_count FROM users
UNION ALL
SELECT 
    'categories', COUNT(*) FROM categories  
UNION ALL
SELECT 
    'partner_shops', COUNT(*) FROM partner_shops
UNION ALL  
SELECT 
    'shop_accounts', COUNT(*) FROM shop_accounts
UNION ALL
SELECT 
    'orders', COUNT(*) FROM orders
UNION ALL
SELECT 
    'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 
    'driver_notifications', COUNT(*) FROM driver_notifications
UNION ALL
SELECT 
    'user_settings', COUNT(*) FROM user_settings; 