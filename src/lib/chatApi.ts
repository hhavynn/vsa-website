import OpenAI from 'openai';
import { ChatMessage } from '../context/ChatContext';

// Initialize OpenAI client only if API key is available
const getOpenAIClient = () => {
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    return null;
  }
  return new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true, // Only for client-side usage
  });
};

// VSA-specific system prompt with knowledge about the organization
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

Common Questions You Can Help With:
- Event information and details
- Points system and how to earn points
- VSA mission and values
- How to check in to events
- General VSA policies and procedures
- Cultural events and traditions

Always be friendly, helpful, and accurate. If you don't know something specific about VSA, say so and suggest they contact the VSA board or check the website for more information.`;

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

    // Get OpenAI client
    const openai = getOpenAIClient();
    
    // Check if API key is configured
    if (!openai) {
      return {
        message: getFallbackResponse(request.message, false)
      };
    }

    // Prepare conversation history for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: VSA_SYSTEM_PROMPT,
      },
    ];

    // Add conversation history (last 10 messages)
    request.conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // Add the current user message
    messages.push({
      role: 'user',
      content: request.message,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return {
      message: response,
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('OpenAI API key not configured. Please contact the administrator.');
      } else if (error.message.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please contact the administrator.');
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        // Set rate limit state
        isRateLimited = true;
        rateLimitResetTime = Date.now() + (60 * 1000); // Reset in 1 minute
        
        // Try to get fallback response
        const fallbackResponse = getFallbackResponse(request.message, true);
        return { message: fallbackResponse };
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
    }
    
    // For any other error, try fallback response
    const fallbackResponse = getFallbackResponse(request.message, false);
    return { message: fallbackResponse };
  }
};

// For server-side usage (if you implement a backend API)
export const sendChatMessageServer = async (request: ChatRequest): Promise<ChatResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      message: getFallbackResponse(request.message, false)
    };
  }
  
  const openaiServer = new OpenAI({
    apiKey,
  });

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: VSA_SYSTEM_PROMPT,
      },
    ];

    request.conversationHistory.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    messages.push({
      role: 'user',
      content: request.message,
    });

    const completion = await openaiServer.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return {
      message: response,
    };
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw new Error('Failed to get response from chat assistant');
  }
};
