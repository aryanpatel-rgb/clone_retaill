# AI Messaging Agent

A sophisticated AI messaging agent similar to Retell AI, built with React and Node.js, featuring custom and fixed functions, Cal.com integration, and OpenAI GPT-4 support.

## Features

- **Custom Functions**: Create custom API callers with JSON schema definitions
- **Fixed Functions**: Built-in functions for common operations (end conversation, check availability, book appointments)
- **Cal.com Integration**: Seamless appointment booking and availability checking
- **OpenAI Integration**: Powered by GPT-4 for natural conversation
- **Real-time Chat Interface**: Test your agent with a beautiful chat UI
- **Function Configuration**: Easy-to-use interface for setting up functions

## Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- OpenAI API key
- Cal.com API key (optional, for appointment booking)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd messaging-ai-agent
```

2. Install dependencies:
```bash
npm run install-all
```

3. Set up environment variables:
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your API keys
OPENAI_API_KEY=your-openai-api-key-here
CAL_COM_API_KEY=your-cal-com-api-key-here
CAL_COM_EVENT_ID=your-cal-com-event-id-here
```

4. Start the development servers:
```bash
npm run dev
```

This will start both the frontend (React) and backend (Node.js) servers.

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## Usage

### 1. Configure Your Agent

1. **Set API Keys**: Enter your OpenAI API key and Cal.com credentials in the configuration panel
2. **Customize Prompt**: Edit the agent prompt with your specific instructions and conversation flow
3. **Add Functions**: Configure custom and fixed functions as needed

### 2. Fixed Functions

The system includes these built-in functions:

- **end_conversation**: Gracefully end the conversation
- **check_availability_cal**: Check calendar availability for a specific date/time
- **book_appointment_cal**: Book an appointment using Cal.com

### 3. Custom Functions

Create custom API callers with:

- **Method**: GET, POST, PUT, DELETE
- **URL**: Full API endpoint
- **Headers**: Custom HTTP headers
- **Query Parameters**: URL query parameters
- **Body**: Request body for POST/PUT requests
- **Response Variables**: Extract specific data from API responses

### 4. Testing Your Agent

Click the "Test Agent" button to open the chat interface and test your agent's responses and function calls.

## Agent Prompt Template

The system comes with a pre-configured Anna assistant prompt for Textdrip, including:

- Introduction and callback handling
- Service confirmation and exploration
- Information verification
- Time selection and instant booking
- Recap and close procedures
- Service description table

## API Endpoints

### POST /api/chat
Send messages to the AI agent.

**Request Body:**
```json
{
  "message": "User message",
  "messages": [...], // Conversation history
  "agentConfig": {
    "prompt": "Agent instructions",
    "functions": [...], // Function configurations
    "openaiApiKey": "sk-...",
    "calComApiKey": "cal_...",
    "calComEventId": "event-id"
  }
}
```

**Response:**
```json
{
  "message": "Agent response",
  "functionCall": {
    "name": "function_name",
    "arguments": {...},
    "result": {...}
  }
}
```

### GET /api/health
Health check endpoint.

## Function Configuration

### Custom Function Schema Example

```json
{
  "type": "object",
  "properties": {
    "method": {
      "type": "string",
      "enum": ["GET", "POST", "PUT", "DELETE"],
      "description": "HTTP method for the API call"
    },
    "url": {
      "type": "string",
      "description": "Full API URL"
    },
    "headers": {
      "type": "object",
      "description": "HTTP headers (optional)"
    },
    "queryParams": {
      "type": "object",
      "description": "Query parameters (optional)"
    },
    "body": {
      "type": "object",
      "description": "Request body (for POST/PUT only)"
    }
  },
  "required": ["method", "url"]
}
```

## Cal.com Integration

To use Cal.com integration:

1. Get your API key from Cal.com dashboard
2. Create an event type and note the event ID
3. Configure these in the agent settings
4. Use `check_availability_cal` and `book_appointment_cal` functions in your prompt

## Development

### Project Structure

```
messaging-ai-agent/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   └── App.js         # Main app component
│   └── package.json
├── server/                # Node.js backend
│   ├── index.js          # Express server
│   └── package.json
└── package.json          # Root package.json
```

### Available Scripts

- `npm run dev`: Start both frontend and backend in development mode
- `npm run client`: Start only the React frontend
- `npm run server`: Start only the Node.js backend
- `npm run build`: Build the React app for production
- `npm run install-all`: Install dependencies for all packages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions, please open an issue in the repository.
