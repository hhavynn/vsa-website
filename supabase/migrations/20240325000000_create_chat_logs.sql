-- Create chat_logs table for analytics and debugging
CREATE TABLE IF NOT EXISTS public.chat_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    assistant_response TEXT NOT NULL,
    conversation_length INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_logs_user_id ON public.chat_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON public.chat_logs(created_at);

-- Enable RLS
ALTER TABLE public.chat_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own chat logs
CREATE POLICY "Users can view own chat logs" ON public.chat_logs
    FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own chat logs
CREATE POLICY "Users can insert own chat logs" ON public.chat_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Admins can view all chat logs
CREATE POLICY "Admins can view all chat logs" ON public.chat_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_logs_updated_at 
    BEFORE UPDATE ON public.chat_logs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
