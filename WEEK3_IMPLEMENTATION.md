# Week 3 Implementation: AI Analyst v1 with Guardrails

This document outlines the Week 3 implementation of the AltStackFast AI Analyst system, providing intelligent web scraping and AI-powered analysis with comprehensive guardrails.

## 🏗️ Architecture Overview

```
AltStackFast/
├── src/
│   ├── lib/
│   │   ├── gemini.ts           # Gemini API client with guardrails
│   │   └── redis.ts            # Redis connection for BullMQ
│   ├── queues/
│   │   └── analyze.queue.ts    # BullMQ queue configuration
│   ├── workers/
│   │   └── analyze.worker.ts   # Intelligent analysis worker
│   ├── api/
│   │   ├── server.ts           # Express server with queue integration
│   │   └── routes/
│   │       └── analyze.ts      # Updated analysis endpoints
│   └── schemas/
│       └── toolProfile.ts      # Zod validation schema
├── tsconfig.worker.json        # TypeScript config for worker
└── package.json               # Updated with Playwright dependencies
```

## 📋 What's Implemented

### 1. Gemini API Client (`src/lib/gemini.ts`)
- **Structured JSON output** using response schema
- **Low temperature (0.1)** for factual responses
- **Strict prompt template** with guardrails
- **Error handling** and validation
- **Zod schema integration** for type safety

### 2. Redis Configuration (`src/lib/redis.ts`)
- **BullMQ-compatible** Redis connection
- **Connection monitoring** and error handling
- **Upstash support** for production deployment
- **Graceful shutdown** handling

### 3. BullMQ Queue System (`src/queues/analyze.queue.ts`)
- **Priority queuing** (low/normal/high)
- **Exponential backoff** retry strategy
- **Job status tracking** and monitoring
- **Queue statistics** and health checks

### 4. Intelligent Worker (`src/workers/analyze.worker.ts`)
- **Playwright web scraping** for dynamic content
- **AI analysis pipeline** with Gemini API
- **Zod validation** of AI responses
- **Firestore integration** for data storage
- **Progress tracking** and error handling

### 5. Enhanced API Routes (`src/api/routes/analyze.ts`)
- **Updated request schema** for tool analysis
- **BullMQ integration** for job queuing
- **Comprehensive error handling**
- **Job status monitoring**

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
npx playwright install chromium
```

### 2. Set Up Environment
Add your Gemini API key to `.env.local`:
```bash
GEMINI_API_KEY=your-actual-gemini-api-key
```

Get your API key from: https://makersuite.google.com/app/apikey

### 3. Start the Services

#### Start API Server
```bash
npm run server:dev
```

#### Start Intelligent Worker (in separate terminal)
```bash
npm run analyze-worker:dev
```

## 📡 API Endpoints

### Add Analysis Job
```bash
POST /v1/analyze
Content-Type: application/json

{
  "tool_name": "replit",
  "url": "https://replit.com",
  "priority": "normal"
}
```

### Get Job Status
```bash
GET /v1/analyze/{jobId}
```

### Queue Health Check
```bash
GET /queue/health
```

## 🔧 Development Commands

```bash
# Start API server with hot reload
npm run server:dev

# Start intelligent worker with hot reload
npm run analyze-worker:dev

# Build for production
npm run server:build
npm run analyze-worker:build

# Start production services
npm run server:start
npm run analyze-worker:start
```

## 🧪 Testing the AI Analyst

### 1. Add an Analysis Job
```bash
curl -X POST http://localhost:8080/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "replit",
    "url": "https://replit.com",
    "priority": "high"
  }'
```

### 2. Monitor Job Progress
```bash
# Replace {jobId} with the ID from step 1
curl http://localhost:8080/v1/analyze/{jobId}
```

### 3. Check Queue Health
```bash
curl http://localhost:8080/queue/health
```

## 🔍 Analysis Pipeline

### 1. Web Scraping (Playwright)
- **Headless browser** for JavaScript-heavy sites
- **Dynamic content** extraction
- **Timeout handling** and error recovery
- **Content sanitization** and processing

### 2. AI Analysis (Gemini API)
- **Structured prompt** with clear instructions
- **JSON schema** enforcement
- **Low temperature** for factual responses
- **Hallucination prevention** guardrails

### 3. Data Validation (Zod)
- **Schema validation** of AI responses
- **Type safety** enforcement
- **Error handling** for invalid data
- **Automatic correction** where possible

### 4. Data Storage (Firestore)
- **Structured storage** with validation
- **Version tracking** and timestamps
- **Review flags** for AI-generated content
- **Merge strategy** for updates

## 🛡️ Guardrails & Safety

### AI Response Validation
- **Structured JSON** output only
- **Schema enforcement** via Zod
- **Null values** for missing data
- **No hallucination** policy

### Error Handling
- **Graceful failures** with retries
- **Comprehensive logging** for debugging
- **Timeout protection** for long operations
- **Resource cleanup** on errors

### Data Quality
- **Content sanitization** before AI analysis
- **Length limits** to prevent token overflow
- **Format validation** at multiple stages
- **Human review** flags for AI content

## 📊 Monitoring & Observability

### Job Progress Tracking
```json
{
  "jobId": "analyze_1234567890_abc123",
  "status": "active",
  "progress": 60,
  "result": null,
  "timestamp": "2025-08-04T..."
}
```

### Queue Statistics
```json
{
  "status": "healthy",
  "stats": {
    "waiting": 2,
    "active": 1,
    "completed": 15,
    "failed": 0
  },
  "timestamp": "2025-08-04T..."
}
```

### Worker Health
- **Process monitoring** and restart capability
- **Memory usage** tracking
- **Concurrency limits** and management
- **Graceful shutdown** handling

## 🚧 Next Steps (Week 4)

1. **MCP Endpoint**: Implement `/mcp/v1` endpoint
2. **Authentication**: Add JWT middleware for admin routes
3. **Rate Limiting**: Implement rate limiting on public endpoints
4. **Deployment**: Deploy to Vercel (API) and Fly.io (Worker)
5. **CI/CD**: Set up GitHub Actions for automated testing

## 🔍 Code Quality Features

- **TypeScript**: Full type safety throughout
- **Zod Validation**: Request/response validation
- **Error Boundaries**: Comprehensive error handling
- **Progress Tracking**: Real-time job progress updates
- **Resource Management**: Proper cleanup and shutdown
- **Logging**: Structured logging for debugging

## 📝 Notes

- **Playwright** requires Chromium browser installation
- **Gemini API** requires API key from Google AI Studio
- **Redis** connection needed for BullMQ (local or Upstash)
- **Firestore** integration for data persistence
- **Concurrent processing** with configurable limits

## 🐛 Troubleshooting

### Common Issues

1. **Playwright browser not found**: Run `npx playwright install chromium`
2. **Gemini API errors**: Check API key and quota limits
3. **Redis connection failed**: Verify Redis configuration
4. **Memory issues**: Reduce concurrency in worker settings
5. **Timeout errors**: Increase timeout values for slow sites

### Debug Mode
```bash
# Enable debug logging
DEBUG=playwright:* npm run analyze-worker:dev
```

### Performance Tuning
- **Concurrency**: Adjust worker concurrency (default: 3)
- **Timeouts**: Modify scraping and API timeouts
- **Memory**: Monitor memory usage and adjust limits
- **Retries**: Configure retry strategies for failures

This implementation provides a production-ready AI analysis system with comprehensive guardrails and monitoring capabilities. 