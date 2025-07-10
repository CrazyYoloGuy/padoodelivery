-- Fix Category Constraints Migration
-- This script helps manage category foreign key constraints and fix orphaned data

-- 1. Create a default "Uncategorized" category if it doesn't exist
INSERT INTO categories (name, description, icon, color, is_active) 
SELECT 'Uncategorized', 'Default category for shops without a specific category', 'fas fa-question-circle', '#6b7280', true
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Uncategorized'
);

-- 2. Get the ID of the Uncategorized category for use in updates
-- You'll need to replace {UNCATEGORIZED_ID} with the actual ID after running the above query

-- 3. Fix orphaned partner_shops (shops with invalid category_id or NULL category_id)
UPDATE partner_shops 
SET category_id = (SELECT id FROM categories WHERE name = 'Uncategorized' LIMIT 1)
WHERE category_id IS NULL 
   OR category_id NOT IN (SELECT id FROM categories);

-- 4. Fix orphaned shop_accounts (shop accounts with invalid category_id or NULL category_id)
UPDATE shop_accounts 
SET category_id = (SELECT id FROM categories WHERE name = 'Uncategorized' LIMIT 1)
WHERE category_id IS NULL 
   OR category_id NOT IN (SELECT id FROM categories);

-- 5. Report on the fixes made
SELECT 
    'partner_shops' as table_name,
    COUNT(*) as shops_fixed
FROM partner_shops 
WHERE category_id = (SELECT id FROM categories WHERE name = 'Uncategorized' LIMIT 1)
UNION ALL
SELECT 
    'shop_accounts' as table_name,
    COUNT(*) as shops_fixed
FROM shop_accounts 
WHERE category_id = (SELECT id FROM categories WHERE name = 'Uncategorized' LIMIT 1);

-- 6. Show current category usage statistics
SELECT 
    c.name as category_name,
    c.is_active,
    COALESCE(ps.partner_shops_count, 0) as partner_shops_count,
    COALESCE(sa.shop_accounts_count, 0) as shop_accounts_count,
    COALESCE(ps.partner_shops_count, 0) + COALESCE(sa.shop_accounts_count, 0) as total_shops
FROM categories c
LEFT JOIN (
    SELECT category_id, COUNT(*) as partner_shops_count
    FROM partner_shops 
    GROUP BY category_id
) ps ON c.id = ps.category_id
LEFT JOIN (
    SELECT category_id, COUNT(*) as shop_accounts_count
    FROM shop_accounts 
    GROUP BY category_id
) sa ON c.id = sa.category_id
ORDER BY total_shops DESC, c.name;

-- 7. Identify any remaining constraint issues (should be empty after the fixes above)
SELECT 
    'partner_shops' as table_name,
    id::text,
    name,
    category_id,
    'Invalid category_id' as issue
FROM partner_shops 
WHERE category_id IS NOT NULL 
  AND category_id NOT IN (SELECT id FROM categories)
UNION ALL
SELECT 
    'shop_accounts' as table_name,
    id::text,
    shop_name as name,
    category_id,
    'Invalid category_id' as issue
FROM shop_accounts 
WHERE category_id IS NOT NULL 
  AND category_id NOT IN (SELECT id FROM categories);

-- 8. Instructions for safe category deletion
/*
IMPORTANT: To safely delete a category, follow these steps:

1. First, reassign all shops to a different category:
   UPDATE partner_shops SET category_id = {NEW_CATEGORY_ID} WHERE category_id = {OLD_CATEGORY_ID};
   UPDATE shop_accounts SET category_id = {NEW_CATEGORY_ID} WHERE category_id = {OLD_CATEGORY_ID};

2. Then you can safely delete the category:
   DELETE FROM categories WHERE id = {OLD_CATEGORY_ID};

Replace {NEW_CATEGORY_ID} and {OLD_CATEGORY_ID} with the actual category IDs.
*/ 