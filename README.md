# 🎙️ AI Travel Agent - Voice-Enabled Travel Booking System

An intelligent, voice-enabled travel assistant that helps users search for flights and hotels, and complete bookings through natural conversation.

## 🌟 Features

- 🎤 **Voice Input/Output** - Speak naturally, hear responses
- ✈️ **Flight Search & Booking** - Real-time Amadeus API integration
- 🏨 **Hotel Search & Booking** - Google Places API with mock bookings
- 🤖 **AI-Powered** - AWS Bedrock/Claude for intelligent conversations
- 🔄 **MCP Architecture** - Modular, scalable intent routing system
- 💬 **Natural Conversation** - Multi-turn dialogues with context awareness
- 🌐 **Modern Web App** - React + TypeScript + Tailwind CSS

## 🏗️ Architecture

**Hybrid Voice + MCP Backend:**
- **Voice Layer:** Google Gemini Live API (speech-to-text)
- **AI Layer:** AWS Bedrock/Claude (intent extraction & slot filling)
- **MCP Layer:** Intent routing & tool execution
- **Tools:** Amadeus (flights), Google Places (hotels), Mock booking engines

**For complete architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- Node.js 16+
- API Keys: Amadeus, Google Places, Google Gemini, AWS Bedrock

### Installation

```bash
# 1. Clone & Navigate
cd travel-agent

# 2. Backend Setup
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt

# 3. Configure .env file with your API keys

# 4. Frontend Setup
npm install

# 5. Run Backend (Terminal 1)
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000

# 6. Run Frontend (Terminal 2)
npm run dev
```

### Access
- **App:** http://localhost:3000
- **API:** http://localhost:8000
- **Docs:** http://localhost:8000/docs

## 🎯 Usage

1. Open http://localhost:3000
2. Click "**MCP + Claude (Bedrock)**" mode
3. Click "**Start MCP Voice Session**"
4. **Speak:** "Find flights from San Jose to New York on December 25th"
5. **AI asks:** "One-way or round-trip?"
6. **You:** "Round trip, returning January 2nd"
7. **AI asks:** "Do you have a maximum budget?"
8. **You:** "$600"
9. **AI searches and shows results**
10. **You:** "Book the first flight"
11. **Done!** Confirmation: FLT-XXXXXX

## 📁 Project Structure

```
travel-agent/
├── backend/              # FastAPI backend
│   ├── core/            # MCP routing, LLM orchestration
│   ├── tools/           # Flight & hotel booking tools
│   └── app.py           # Main application
├── src/                 # React frontend
│   ├── components/      # UI components
│   └── services/        # Voice & MCP services
└── ARCHITECTURE.md      # Complete documentation
```

## 🛠️ Technology Stack

**Backend:**
- FastAPI, AWS Bedrock (Claude), Amadeus API, Google Places API

**Frontend:**
- React, TypeScript, Vite, Tailwind CSS, Google Gemini Live API, Web Speech API

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete system architecture, MCP implementation, request/response flows, and technical details

## 🎓 Key Concepts

### MCP (Model Context Protocol)
An architectural pattern that separates:
- **AI Reasoning** (Claude extracts intent)
- **Tool Routing** (MCP Router maps to functions)
- **Execution** (Tools call APIs & process data)

### Voice Processing
- **Gemini Live API:** Real-time speech-to-text transcription
- **Web Speech API:** Text-to-speech for AI responses
- **Feedback Prevention:** Microphone pauses during AI speech

### Slot Filling
Progressive information gathering:
- System asks for required info one question at a time
- Maintains context across conversation turns
- Validates and fills slots before executing actions

## 🌟 Highlights

✅ **Natural Conversations** - Multi-turn dialogues with context  
✅ **Smart Slot Filling** - Asks only what's needed  
✅ **Real-Time Search** - Actual flight & hotel data  
✅ **Voice Enabled** - Speak and hear responses  
✅ **MCP Architecture** - Modular & scalable  
✅ **English-Only** - Enforced transcription  
✅ **Budget Filtering** - Asks for price preferences  
✅ **Polite Farewells** - "Anything else?" handling  

## 📄 License

Educational & demonstration purposes.

## 🙏 Credits

Built with FastAPI, React, AWS Bedrock/Claude, Google Gemini, Amadeus API, and Google Places API.

---
Demo: https://www.youtube.com/watch?v=tbL1enGz8eg

**For detailed architecture, setup instructions, and technical documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

**Enjoy your AI travel assistant!** ✈️🏨🎤
