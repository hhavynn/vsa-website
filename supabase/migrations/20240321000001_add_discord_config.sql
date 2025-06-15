-- Create table for Discord configuration
CREATE TABLE IF NOT EXISTS discord_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    channel_id TEXT NOT NULL,
    announcement_role_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE discord_config ENABLE ROW LEVEL SECURITY;

-- Create policies for discord_config
CREATE POLICY "Discord config is viewable by admins"
    ON discord_config
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
        )
    );

CREATE POLICY "Discord config is insertable by admins"
    ON discord_config
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
        )
    );

CREATE POLICY "Discord config is updatable by admins"
    ON discord_config
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND user_profiles.is_admin = true
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_discord_config_updated_at
    BEFORE UPDATE ON discord_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 