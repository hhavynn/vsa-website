import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3.22.4'

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Validation schema for chat requests
const ChatRequestSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    id: z.string(),
    content: z.string(),
    role: z.enum(['user', 'assistant']),
    timestamp: z.string().datetime(),
  })).max(20).optional().default([]),
})

// VSA-specific system prompt
const VSA_SYSTEM_PROMPT = `You are a helpful AI assistant for the Vietnamese Student Association (VSA) at UCSD. You help members with questions about events, points, and general VSA information.

VSA Mission Statement:
The Vietnamese Student Association of UCSD strives to promote and preserve the Vietnamese culture. We are dedicated to providing resources and a safe space for students to unite as a Vietnamese-American community. This organization is for nonprofit.

VSA's 4 Pillars:
1. Social: meeting new people and building bonds with one another such as the ACE Program and House System
2. Cultural: stay in touch with cultural roots through our events such as Vietnamese Culture Night and Black April
3. Community: continue to strive to create a supportive and cooperative community for those of Vietnamese and non-Vietnamese descent
4. Academic: main priority of obtaining good grades and graduating within a reasonable amount of time

Event Types:
- GBM (General Body Meeting): Regular meetings for all members
- Mixer: Social events for members to meet and interact
- Winter Retreat: Annual retreat event
- VCN (Vietnamese Culture Night): Cultural performance event
- Wild N Culture: Cultural celebration event
- External Event: Events hosted by other organizations
- Other: Miscellaneous events

Points System:
- Members earn points by attending events
- Different events have different point values
- Points are tracked and displayed on a leaderboard
- Members can check in to events using codes or manual check-in

Always be friendly, helpful, and accurate. If you don't know something specific about VSA, say so and suggest they contact the VSA board or check the website for more information.`

// Fallback responses for common questions
const FALLBACK_RESPONSES: Record<string, string> = {
  'mission': 'The Vietnamese Student Association of UCSD strives to promote and preserve the Vietnamese culture. We are dedicated to providing resources and a safe space for students to unite as a Vietnamese-American community. This organization is for nonprofit.',
  '4 pillars': 'VSA has 4 pillars:\n1. Social: meeting new people and building bonds through ACE Program and House System\n2. Cultural: staying in touch with cultural roots through events like Vietnamese Culture Night and Black April\n3. Community: creating a supportive community for Vietnamese and non-Vietnamese students\n4. Academic: focusing on good grades and graduating in reasonable time',
  'points': 'Members earn points by attending VSA events. Different events have different point values. You can check in to events using codes or manual check-in. Points are tracked and displayed on the leaderboard.',
  'events': 'VSA hosts various events including GBMs (General Body Meetings), mixers, cultural events like Vietnamese Culture Night, and social events. Check the Events page for upcoming events and their details.',
  'check in': 'You can check in to events by entering the check-in code provided at the event, or through manual check-in by an admin. Check-in codes are usually provided during the event.',
  'vsa': 'VSA (Vietnamese Student Association) is a student organization at UCSD that promotes Vietnamese culture and creates a supportive community for students.',
  'hello': 'Hello! I\'m your VSA assistant. I can help you with information about VSA events, points system, mission, and more!',
  'help': 'I can help you with:\n• VSA mission and 4 pillars\n• Events and how to check in\n• Points system\n• General VSA information\n\nJust ask me anything!',
}

function getFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase()
  
  for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (lowerMessage.includes(key)) {
      return response + '\n\n*Note: This is a basic response. Full AI functionality requires proper configuration.*'
    }
  }
  
  return 'I can help with VSA questions, but I need to be configured with an OpenAI API key for full functionality. Please ask about VSA mission, 4 pillars, points, events, or check-in process.'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify user authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse and validate request body
    const body = await req.json()
    const validationResult = ChatRequestSchema.safeParse(body)
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request format',
          details: validationResult.error.issues 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const { message, conversationHistory } = validationResult.data

    // Check if OpenAI API key is configured
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ 
          message: getFallbackResponse(message)
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Prepare OpenAI request
    const messages = [
      {
        role: 'system',
        content: VSA_SYSTEM_PROMPT,
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      }
    ]

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      console.error('OpenAI API error:', errorData)
      
      // Fallback to basic response on API error
      return new Response(
        JSON.stringify({ 
          message: getFallbackResponse(message)
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const aiData = await openaiResponse.json()
    const aiMessage = aiData.choices?.[0]?.message?.content

    if (!aiMessage) {
      throw new Error('No response from OpenAI')
    }

    // Log the interaction for analytics (optional)
    await supabaseClient
      .from('chat_logs')
      .insert({
        user_id: user.id,
        user_message: message,
        assistant_response: aiMessage,
        conversation_length: conversationHistory.length + 1,
      })
      .then(() => console.log('Chat logged successfully'))
      .catch(err => console.error('Failed to log chat:', err))

    return new Response(
      JSON.stringify({ 
        message: aiMessage
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'I\'m experiencing technical difficulties. Please try again later or ask about VSA mission, 4 pillars, points, events, or check-in process for basic information.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
