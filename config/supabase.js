import { createClient } from '@supabase/supabase-js'

// Replace with your Supabase project details
const supabaseUrl = 'https://yimfqwmxgpawfttizfvu.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbWZxd214Z3Bhd2Z0dGl6ZnZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4OTEzMDcsImV4cCI6MjA2NDQ2NzMwN30.DccvTgHGiDJNudw8cT5lg2VZSELjAJ-Q5TdvVMnGB64'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Database schema for users table
/*
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  phone VARCHAR,
  role VARCHAR DEFAULT 'driver',
  status VARCHAR DEFAULT 'active',
  total_orders INTEGER DEFAULT 0,
  total_earnings DECIMAL DEFAULT 0,
  join_date TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON users FOR UPDATE USING (true);
*/ 