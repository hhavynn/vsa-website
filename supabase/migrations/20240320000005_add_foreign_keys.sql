-- Add foreign key relationships
ALTER TABLE user_points
ADD CONSTRAINT fk_user_points_user_profiles
FOREIGN KEY (user_id)
REFERENCES user_profiles(id)
ON DELETE CASCADE;

-- Enable RLS on user_points if not already enabled
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own points" ON user_points;
DROP POLICY IF EXISTS "Users can view all points" ON user_points;

-- Create policies for user_points
CREATE POLICY "Users can view their own points"
ON user_points
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view all points"
ON user_points
FOR SELECT
USING (true); 