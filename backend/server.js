const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

Common Questions You Can Help With:
- Event information and details
- Points system and how to earn points
- VSA mission and values
- How to check in to events
- General VSA policies and procedures
- Cultural events and traditions

Always be friendly, helpful, and accurate. If you don't know something specific about VSA, say so and suggest they contact the VSA board or check the website for more information.`;

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Prepare conversation history for OpenAI
    const messages = [
      {
        role: 'system',
        content: VSA_SYSTEM_PROMPT,
      },
    ];

    // Add conversation history (last 10 messages)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.forEach((msg) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: message,
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

    res.json({ message: response });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to get response from chat assistant' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`VSA Chat Backend running on port ${port}`);
});
