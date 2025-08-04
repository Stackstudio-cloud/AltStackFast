# Week 1 Implementation: MCP Server Foundation

This document outlines the Week 1 implementation of the AltStackFast MCP server, providing the foundational code and structure for the backend API.

## 🏗️ Architecture Overview

```
AltStackFast/
├── toolProfile.schema.json     # Central JSON schema
├── src/
│   ├── schemas/
│   │   └── toolProfile.ts      # Zod validation schema
│   └── api/
│       ├── server.ts           # Express server setup
│       └── routes/
│           └── tools.ts        # Tools API endpoints
├── tsconfig.server.json        # TypeScript config for server
└── env.example                 # Environment variables template
```

## 📋 What's Implemented

### 1. Central Schema (`toolProfile.schema.json`)
- **Single source of truth** for tool profile data structure
- JSON Schema Draft-07 compliant
- Defines all required and optional fields
- Used for generating TypeScript types and validation

### 2. Zod Schema (`src/schemas/toolProfile.ts`)
- **Type-safe validation** using Zod
- Generated from the JSON schema
- Provides TypeScript types via `z.infer`
- Ensures data integrity before database operations

### 3. Express API Server (`src/api/server.ts`)
- **Production-ready setup** with CORS, JSON parsing
- Firestore integration (ready for Week 2)
- Health check endpoint for deployment platforms
- Environment variable configuration

### 4. Tools API Routes (`src/api/routes/tools.ts`)
- **GET /v1/tools** - List all tools with validation
- **GET /v1/tools/:toolId** - Get specific tool by ID
- Mock data for Week 1 development
- Comprehensive error handling
- Structured JSON responses

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Start Development Server
```bash
npm run server:dev
```

The server will start on `http://localhost:8080`

## 📡 API Endpoints

### Health Check
```bash
GET /healthz
```
Returns: `200 OK` with "ok" message

### Root Endpoint
```bash
GET /
```
Returns server information and available endpoints

### List All Tools
```bash
GET /v1/tools
```
Returns:
```json
{
  "success": true,
  "data": [...],
  "count": 3,
  "timestamp": "2025-08-04T..."
}
```

### Get Specific Tool
```bash
GET /v1/tools/replit
```
Returns:
```json
{
  "success": true,
  "data": {
    "tool_id": "replit",
    "name": "Replit",
    ...
  }
}
```

## 🔧 Development Commands

```bash
# Start development server with hot reload
npm run server:dev

# Build for production
npm run server:build

# Start production server
npm run server:start
```

## 🧪 Testing the API

### Using curl
```bash
# Health check
curl http://localhost:8080/healthz

# Get all tools
curl http://localhost:8080/v1/tools

# Get specific tool
curl http://localhost:8080/v1/tools/replit
```

### Using the frontend
The existing React frontend can now connect to this API instead of using mock data.

## 📊 Mock Data

Week 1 includes mock data for three tools:
- **Replit** - Browser-based IDE
- **Cursor IDE** - AI-first code editor
- **Bolt.new** - AI-powered web app builder

Each tool includes all required fields and demonstrates the schema structure.

## 🔒 Validation

All API responses are validated against the Zod schema before being sent. This ensures:
- Data integrity
- Type safety
- Consistent API responses
- Early error detection

## 🚧 Next Steps (Week 2)

1. **Firestore Integration**: Replace mock data with real Firestore queries
2. **Job Queue Setup**: Implement BullMQ with Upstash Redis
3. **Worker Service**: Create background job processing
4. **Error Handling**: Add comprehensive error logging and monitoring

## 🔍 Code Quality Features

- **TypeScript**: Full type safety for the backend
- **ESLint**: Code quality and consistency
- **Structured Logging**: Console output with timestamps
- **Error Boundaries**: Graceful error handling
- **CORS**: Cross-origin request support
- **Environment Configuration**: Flexible deployment setup

## 📝 Notes

- The server uses ES modules (`import/export`)
- Firestore is initialized but not yet used (Week 2)
- All endpoints return structured JSON responses
- Error responses include helpful messages
- The schema version is set to "2025-08-04" for tracking

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**: Change `PORT` in `.env`
2. **TypeScript errors**: Run `npm run server:build` to check for issues
3. **Firestore connection**: Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set correctly

### Debug Mode
```bash
DEBUG=* npm run server:dev
```

This implementation provides a solid foundation for the MCP server and follows the Week 1 roadmap outlined in the main README. 