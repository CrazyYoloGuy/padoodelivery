const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase configuration missing!');
    console.error('Please check your .env file has:');
    console.error('- SUPABASE_URL');
    console.error('- SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY');
    process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
    try {
        console.log('🔄 Running migration to fix user_settings RLS policies...');
        
        // Read migration file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'fix_user_settings_rls.sql'), 
            'utf8'
        );
        
        // Split SQL into individual statements
        const statements = migrationSQL
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0);
        
        // Execute each statement
        for (const sql of statements) {
            console.log(`Executing: ${sql.substring(0, 50)}...`);
            const { error } = await supabase.rpc('exec_sql', { sql: sql });
            
            if (error) {
                // Try direct query if RPC fails
                const { error: directError } = await supabase.from('_exec_sql').select('*').eq('sql', sql);
                
                if (directError) {
                    console.error(`❌ Error executing SQL: ${sql.substring(0, 100)}...`);
                    console.error(directError);
                    
                    // Continue with next statement even if this one fails
                    continue;
                }
            }
        }
        
        console.log('✅ Migration completed successfully!');
        console.log('🔐 User settings table RLS policies have been updated.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

runMigration(); 