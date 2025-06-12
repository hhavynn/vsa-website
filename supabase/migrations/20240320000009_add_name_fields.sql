-- Add name fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- Create policy to allow users to update their own profile
CREATE POLICY "Users can update their own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id); 