-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view all points" ON user_points;

-- Create policy to allow viewing all profiles for the leaderboard
CREATE POLICY "Users can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow viewing all points for the leaderboard
CREATE POLICY "Users can view all points"
  ON user_points
  FOR SELECT
  TO authenticated
  USING (true); 