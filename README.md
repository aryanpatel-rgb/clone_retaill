# 🚀 Retail AI Platform

An AI-powered voice calling platform that enables businesses to make intelligent, automated calls using custom AI agents with contact management and real-time conversation capabilities.

## ✨ Features

### 🤖 **AI Agent Management**
- Create and configure custom AI agents with unique personalities
- Agent prompt validation (required for calling)
- Multiple AI model support (OpenAI, Azure, OpenRouter)
- Voice and language customization

### 📞 **Voice Calling System**
- Real-time voice conversations with AI agents
- Twilio integration for actual phone calls
- Text-to-speech with ElevenLabs
- Speech-to-text processing
- Call recording and analytics

### 👥 **Contact Management**
- Add and manage contacts with Twilio validation
- Phone number auto-formatting and verification
- Contact tagging and organization
- Call history tracking per contact

### 📊 **Analytics & Monitoring**
- Real-time call analytics
- Agent performance metrics
- Contact interaction history
- Success rate tracking

### 🔧 **Advanced Features**
- WebSocket support for real-time communication
- Custom function calling for AI agents
- Calendar integration (Cal.com)
- Multi-provider LLM support
- Form-to-call automation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │  Node.js Backend │    │   External APIs │
│                 │    │                 │    │                 │
│ • Contact Mgmt   │◄──►│ • Agent Service │◄──►│ • Twilio        │
│ • Call Interface │    │ • AI Service    │    │ • OpenAI        │
│ • Analytics      │    │ • WebSocket     │    │ • ElevenLabs    │
│ • Agent Config   │    │ • Database      │    │ • Cal.com       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 8+
- PostgreSQL database (or NeonDB)
- Twilio account with phone number
- OpenAI API key
- ElevenLabs API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd retail-ai-platform
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Setup environment variables**
   ```bash
   npm run setup
   ```
   Or manually copy and configure:
   ```bash
   cp backend/env.example backend/.env
   cp vite-project/env.example vite-project/.env
   ```

4. **Configure your services**
   - Edit `backend/.env` with your API keys
   - Edit `vite-project/.env` with your configuration

5. **Start the application**
   ```bash
   # Start both backend and frontend
   npm run dev
   
   # Or start separately
   npm run dev:backend    # Backend on http://localhost:5000
   npm run dev:frontend   # Frontend on http://localhost:5173
   ```

## 🔧 Configuration

### Required Environment Variables

#### Backend (`backend/.env`)
```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Twilio (Required for calls)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_secret
TWILIO_PHONE_NUMBER=+1234567890

# OpenAI (Required for AI)
OPENAI_API_KEY=sk-your_openai_api_key

# ElevenLabs (Required for TTS)
ELEVENLABS_API_KEY=sk_your_elevenlabs_key
ELEVENLABS_VOICE_ID=your_voice_id

# Security
JWT_SECRET=your-super-secret-jwt-key
```

#### Frontend (`vite-project/.env`)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_APP_NAME=Retail AI Platform
```

For detailed configuration, see [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)

## 📖 Usage Guide

### 1. **Setup Your First Agent**
1. Go to the **Agents** page
2. Click **"Create Agent"**
3. Fill in agent details:
   - Name and description
   - **Custom AI prompt** (required for calling)
   - Voice and language settings
4. Set status to **"Active"**

### 2. **Add Contacts**
1. Go to the **Contacts** page
2. Click **"Add Contact"**
3. Enter contact information:
   - Name (required)
   - Phone number with country code (required)
   - Email, company, notes (optional)
4. System validates phone number with Twilio

### 3. **Make Your First Call**
1. Go to the **Calls** page
2. Click **"New Call"**
3. Select an agent (must have prompt configured)
4. Enter phone number to call
5. Click **"Start Call"**
6. AI agent will call the number and have a conversation

### 4. **Monitor Performance**
1. Check **Analytics** for call statistics
2. Review **Sessions** for call history
3. Track agent performance metrics

## 🛠️ Development

### Project Structure
```
retail-ai-platform/
├── backend/                 # Node.js API server
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic
│   ├── database/           # Database connection
│   └── middleware/         # Express middleware
├── vite-project/           # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── context/        # State management
├── setup-env.js           # Environment setup script
└── ENVIRONMENT_SETUP.md   # Detailed setup guide
```

### Available Scripts

```bash
# Development
npm run dev                 # Start both backend and frontend
npm run dev:backend         # Start backend only
npm run dev:frontend        # Start frontend only

# Setup
npm run setup              # Configure environment variables
npm run install:all        # Install all dependencies

# Production
npm run build:frontend     # Build frontend for production
npm run start:backend      # Start backend in production mode

# Utilities
npm run lint:frontend      # Lint frontend code
npm run clean              # Clean all node_modules
```

## 🔌 API Endpoints

### Agents
- `GET /api/agents` - List all agents
- `POST /api/agents` - Create new agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Add contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/contacts/:id/verify` - Verify contact phone

### Calls
- `POST /api/calls/initiate-with-validation` - Start call with validation
- `GET /api/calls` - List calls
- `GET /api/calls/:id/status` - Get call status
- `POST /api/calls/:id/hangup` - End call

### Analytics
- `GET /api/analytics` - Get analytics data
- `GET /api/analytics/realtime` - Real-time analytics

## 🧪 Testing

The platform includes comprehensive testing capabilities:

### Agent Validation
- Ensures agents have prompts before calling
- Validates Twilio configuration
- Checks agent status and permissions

### Contact Management
- Phone number format validation
- Twilio number verification
- Duplicate contact prevention

### Call Testing
- Mock calls for development
- Real Twilio integration for production
- Call status tracking and monitoring

## 🚀 Deployment

### Backend Deployment
1. Set production environment variables
2. Configure database connection
3. Set up Twilio webhooks
4. Deploy to your hosting platform

### Frontend Deployment
1. Build the frontend: `npm run build:frontend`
2. Deploy the `dist` folder to your CDN/hosting
3. Update API URLs for production

### Environment Considerations
- Use production database
- Set secure JWT secrets
- Configure proper CORS origins
- Set up monitoring and logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- 📚 Documentation: [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/retail-ai-platform/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/retail-ai-platform/discussions)

## 🙏 Acknowledgments

- [Twilio](https://www.twilio.com/) for voice calling infrastructure
- [OpenAI](https://openai.com/) for AI language models
- [ElevenLabs](https://elevenlabs.io/) for text-to-speech
- [React](https://reactjs.org/) and [Vite](https://vitejs.dev/) for the frontend
- [Node.js](https://nodejs.org/) and [Express](https://expressjs.com/) for the backend

---

**Built with ❤️ for the future of AI-powered communication**
