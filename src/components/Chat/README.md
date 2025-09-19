# VSA Chat Assistant

This is an AI-powered chat assistant for the VSA website that helps members with questions about events, points, and general VSA information.

## Setup

1. **Get an OpenAI API Key:**
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Create an account or sign in
   - Navigate to API Keys section
   - Create a new API key

2. **Add Environment Variable:**
   Create a `.env` file in the root directory with:
   ```
   REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Install Dependencies:**
   The OpenAI package is already included in package.json

## Features

- **VSA-Specific Knowledge:** Trained on VSA mission, events, points system, and policies
- **Real-time Chat:** Instant responses to member questions
- **Context Awareness:** Remembers conversation history for better responses
- **Mobile Responsive:** Works on all device sizes
- **Dark Mode Support:** Matches the website's theme

## Usage

The chat widget appears as a floating button in the bottom-right corner of the website. Members can:

- Ask about upcoming events
- Learn about the points system
- Get information about VSA's mission and values
- Ask general questions about VSA policies

## Customization

The chat assistant's knowledge can be updated by modifying the `VSA_SYSTEM_PROMPT` in `src/lib/chatApi.ts`.

## Security Note

The current implementation uses client-side OpenAI API calls. For production use, consider implementing a backend API endpoint to keep your API key secure.
