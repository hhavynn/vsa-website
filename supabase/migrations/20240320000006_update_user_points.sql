-- Drop existing table if it exists
DROP TABLE IF EXISTS user_points CASCADE;

-- Create user_points table with updated schema
CREATE TABLE user_points (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  points INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- Create policies for user_points
CREATE POLICY "Users can view their own points"
  ON user_points
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own points"
  ON user_points
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own points"
  ON user_points
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Insert points for existing users
INSERT INTO user_points (user_id, points)
SELECT id, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_points); 