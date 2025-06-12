-- Drop existing policies
DROP POLICY IF EXISTS "Check-in codes are viewable by admins" ON check_in_codes;
DROP POLICY IF EXISTS "Check-in codes are insertable by admins" ON check_in_codes;

-- Create new policies for check-in codes
CREATE POLICY "Check-in codes are viewable by everyone"
  ON check_in_codes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Check-in codes are insertable by admins"
  ON check_in_codes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Drop existing policies for check-in code usage
DROP POLICY IF EXISTS "Users can view their own code usage" ON check_in_code_usage;
DROP POLICY IF EXISTS "Users can insert their own code usage" ON check_in_code_usage;

-- Create new policies for check-in code usage
CREATE POLICY "Users can view their own code usage"
  ON check_in_code_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = used_by);

CREATE POLICY "Users can insert their own code usage"
  ON check_in_code_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = used_by); 