# VSA Chat Assistant Setup Guide

## Overview
The VSA Chat Assistant is an AI-powered feature that helps members with questions about events, points, and general VSA information. It uses OpenAI's GPT-3.5-turbo model with VSA-specific knowledge.

## Features Implemented ✅

1. **Chat Widget UI** - Floating chat button with modern, responsive design
2. **VSA-Specific Knowledge** - Trained on VSA mission, events, points system
3. **Real-time Messaging** - Instant responses with conversation history
4. **Dark Mode Support** - Matches website theme
5. **Mobile Responsive** - Works on all device sizes
6. **Context Awareness** - Remembers conversation history

## Setup Instructions

### Option 1: Client-Side Implementation (Current)

1. **Get OpenAI API Key:**
   - Visit [OpenAI Platform](https://platform.openai.com/)
   - Create account and get API key
   - Add to `.env` file: `REACT_APP_OPENAI_API_KEY=your_key_here`

2. **Install Dependencies:**
   ```bash
   npm install openai
   ```

3. **Start the Application:**
   ```bash
   npm start
   ```

### Option 2: Backend Implementation (Recommended for Production)

1. **Set up Backend:**
   ```bash
   cd backend
   npm install
   ```

2. **Create Backend .env:**
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   ```

3. **Start Backend:**
   ```bash
   npm run dev
   ```

4. **Update Frontend API:**
   - Modify `src/context/ChatContext.tsx` to use backend endpoint
   - Change API call from `sendChatMessage` to fetch from `http://localhost:3001/api/chat`

## Files Created/Modified

### New Files:
- `src/context/ChatContext.tsx` - Chat state management
- `src/components/Chat/ChatWidget.tsx` - Chat UI component
- `src/components/Chat/ChatTest.tsx` - Test component
- `src/lib/chatApi.ts` - OpenAI API integration
- `backend/server.js` - Express.js backend (optional)
- `backend/package.json` - Backend dependencies

### Modified Files:
- `src/App.tsx` - Added ChatProvider and ChatWidget

## Usage

1. **For Members:**
   - Click the chat button (💬) in bottom-right corner
   - Ask questions about events, points, VSA info
   - Get instant, helpful responses

2. **For Testing:**
   - Use the `ChatTest` component on any page
   - Try pre-written test questions
   - Verify responses are VSA-specific

## Example Questions to Test

- "What is VSA's mission?"
- "How do I earn points?"
- "What events are coming up?"
- "Tell me about the 4 pillars"
- "How do I check in to events?"

## Customization

### Adding More Knowledge
Edit `VSA_SYSTEM_PROMPT` in `src/lib/chatApi.ts` to include:
- New event types
- Updated policies
- Additional VSA information

### Styling
Modify `src/components/Chat/ChatWidget.tsx` to:
- Change colors/theme
- Adjust size/position
- Add animations

## Security Considerations

- **Client-side**: API key exposed in browser (not recommended for production)
- **Backend**: API key secure on server (recommended for production)
- Consider rate limiting and user authentication for production

## Troubleshooting

1. **Chat not responding:**
   - Check OpenAI API key is correct
   - Verify internet connection
   - Check browser console for errors

2. **Styling issues:**
   - Ensure Tailwind CSS is properly configured
   - Check for CSS conflicts

3. **Backend issues:**
   - Verify backend is running on correct port
   - Check CORS settings
   - Verify environment variables

## Next Steps

1. **Add Authentication:** Require login to use chat
2. **Analytics:** Track popular questions and responses
3. **Feedback System:** Let users rate responses
4. **Admin Dashboard:** View chat logs and analytics
5. **Integration:** Connect with events/points data for real-time info

## Support

For issues or questions about the chat assistant implementation, check:
- OpenAI API documentation
- React Context documentation
- Tailwind CSS documentation
