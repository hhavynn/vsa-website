import { supabase } from './supabase';
import { ChatMessage } from '../context/ChatContext';

// Note: VSA_SYSTEM_PROMPT is now handled in the Supabase Edge Function

export interface ChatRequest {
  message: string;
  conversationHistory: ChatMessage[];
}

export interface ChatResponse {
  message: string;
}

// Fallback responses for common VSA questions when API is not available
const FALLBACK_RESPONSES: { [key: string]: string } = {
  'mission': 'The Vietnamese Student Association of UCSD strives to promote and preserve the Vietnamese culture. We are dedicated to providing resources and a safe space for students to unite as a Vietnamese-American community. This organization is for nonprofit.',
  '4 pillars': 'VSA has 4 pillars:\n1. Social: meeting new people and building bonds through ACE Program and House System\n2. Cultural: staying in touch with cultural roots through events like Vietnamese Culture Night and Black April\n3. Community: creating a supportive community for Vietnamese and non-Vietnamese students\n4. Academic: focusing on good grades and graduating in reasonable time',
  'points': 'Members earn points by attending VSA events. Different events have different point values. You can check in to events using codes or manual check-in. Points are tracked and displayed on the leaderboard.',
  'events': 'VSA hosts various events including GBMs (General Body Meetings), mixers, cultural events like Vietnamese Culture Night, and social events. Check the Events page for upcoming events and their details.',
  'check in': 'You can check in to events by entering the check-in code provided at the event, or through manual check-in by an admin. Check-in codes are usually provided during the event.',
  'vsa': 'VSA (Vietnamese Student Association) is a student organization at UCSD that promotes Vietnamese culture and creates a supportive community for students.',
  'hello': 'Hello! I\'m your VSA assistant. I can help you with information about VSA events, points system, mission, and more!',
  'help': 'I can help you with:\n• VSA mission and 4 pillars\n• Events and how to check in\n• Points system\n• General VSA information\n\nJust ask me anything!',
  'who are you': 'I\'m the VSA Assistant, here to help you with questions about the Vietnamese Student Association at UCSD. I can tell you about our mission, events, points system, and more!'
};

// Rate limit tracking
let rateLimitResetTime = 0;
let isRateLimited = false;

// Function to reset rate limit (can be called externally)
export const resetRateLimit = () => {
  isRateLimited = false;
  rateLimitResetTime = 0;
};

// Function to get fallback response
const getFallbackResponse = (message: string, isRateLimited: boolean = false): string => {
  const lowerMessage = message.toLowerCase();
  
  for (const [key, response] of Object.entries(FALLBACK_RESPONSES)) {
    if (lowerMessage.includes(key)) {
      const note = isRateLimited 
        ? '\n\n*Note: Using basic response due to rate limits. Full AI responses will resume shortly.*'
        : '\n\n*Note: This is a basic response. For full AI assistance, please configure your OpenAI API key.*';
      return response + note;
    }
  }
  
  if (isRateLimited) {
    return 'I\'m currently experiencing high demand. Please try again in a moment, or ask about VSA mission, 4 pillars, points, events, or check-in process for basic information.';
  }
  
  return 'I can help with VSA questions, but I need to be configured with an OpenAI API key for full functionality. Please ask about VSA mission, 4 pillars, points, events, or check-in process.';
};

export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    // Check if currently rate limited
    if (isRateLimited && Date.now() < rateLimitResetTime) {
      const waitTime = Math.ceil((rateLimitResetTime - Date.now()) / 1000 / 60);
      return {
        message: `I'm currently rate limited. Please wait ${waitTime} minute(s) before trying again, or ask about VSA mission, 4 pillars, points, events, or check-in process for basic information.`
      };
    }

    // Get current session for authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return {
        message: 'Please sign in to use the chat assistant.'
      };
    }

    // Check if OpenAI API key is available in the frontend
    const openaiApiKey = process.env.REACT_APP_OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      return {
        message: getFallbackResponse(request.message, false)
      };
    }

    // Call OpenAI API directly from frontend
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI assistant for the Vietnamese Student Association (VSA) at UCSD. You help members with questions about events, points, and general VSA information.

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
          },
          ...request.conversationHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role: 'user',
            content: request.message,
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      console.error('OpenAI API error:', await openaiResponse.text());
      return {
        message: getFallbackResponse(request.message, false)
      };
    }

    const aiData = await openaiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content;

    if (!aiMessage) {
      return {
        message: getFallbackResponse(request.message, false)
      };
    }

    return {
      message: aiMessage
    };
  } catch (error) {
    console.error('Error calling chat API:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return { 
          message: 'Network error. Please check your internet connection and try again.' 
        };
      }
    }
    
    // For any other error, try fallback response
    const fallbackResponse = getFallbackResponse(request.message, false);
    return { message: fallbackResponse };
  }
};

