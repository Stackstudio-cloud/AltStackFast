AltStackFast (Workflow Architect)
Motto: Build fast, but build right.

AltStackFast is an intelligent application and backend service designed to help developers architect software projects for the modern AI-powered development landscape. It analyzes high-level ideas, recommends optimal development workflows across specialized tools, and generates detailed, actionable prompts to accelerate the building process.

At its core, the project is powered by a dynamic, self-updating Tool Registry, which will be exposed via a Model Context Protocol (MCP) server, allowing any AI agent to query it as a trusted tool.

Core Features
AI-Powered Blueprint Generation: Takes a high-level project idea and uses a large language model to generate a structured, technical blueprint.

Intelligent Workflow Recommendation: Analyates a project idea against the Tool Registry to recommend the most efficient development workflow (single-tool or multi-stage).

Platform-Optimized Prompt Generation: Creates detailed prompts tailored to the strengths of each tool in a recommended workflow.

Dynamic Tool Registry: A database of AI development tools, automatically updated by an "AI Analyst" worker.

MCP Server: The tool registry will be exposed via a secure, versioned API that implements the Model Context Protocol, turning our database into a queryable tool for the broader AI agent ecosystem.

Production Architecture
The backend is designed as a decoupled system to ensure scalability and reliability, separating the lightweight API from the heavy-lifting background worker.

API Server (Vercel): A stateless Express.js server responsible for handling incoming HTTP requests, validating input, and adding jobs to the queue.

Background Worker (Fly.io): A long-running Node.js process that listens for jobs from the queue. It handles the intensive tasks of web scraping (Playwright) and AI analysis (Gemini API).

Database (Firestore): The primary data store for all tool profiles.

Job Queue (Upstash Redis + BullMQ): Manages the queue of analysis jobs, ensuring reliability with retries and backoff.

Schema Validation: zod and json-schema-to-ts are used to enforce a strict, versioned schema for all data entering the database.

Development Roadmap
This project is divided into distinct phases. We have completed the initial in-app prototyping and are now beginning the formal development of the standalone MCP server based on the following 4-week sprint plan.

Week

Deliverable

Key Tasks

1

Skeleton API + Firestore

1. Bootstrap the Express.js repository with TypeScript. <br> 2. Establish a secure connection to Firestore. <br> 3. Implement the GET /v1/tools endpoint with mock data. <br> 4. Define the toolProfile.schema.json and generate Zod/TypeScript types.

2

Job Queue & Worker PoC

1. Set up a Redis instance on Upstash. <br> 2. Integrate BullMQ into the API server and create a separate worker service. <br> 3. Implement the POST /v1/analyze endpoint to add jobs to the queue. <br> 4. Build a basic worker that logs job payloads and includes a health check.

3

AI Analyst v1

1. Integrate Playwright into the worker to scrape content from a target URL. <br> 2. Create the Gemini API client and a prompt template with strict guardrails. <br> 3. Implement the full analysis pipeline: Scrape → Analyze → Validate with Zod → Save to Firestore.

4

MCP Endpoint & Productionization

1. Implement the GET /mcp/v1 endpoint. <br> 2. Add JWT middleware for admin routes. <br> 3. Add rate-limiting to all public endpoints. <br> 4. Deploy the API to Vercel and the worker to Fly.io.

Getting Started
To set up the project locally, follow these initial steps:

Create toolProfile.schema.json: Define the central schema for a tool profile.

Bootstrap Repository: Initialize an Express.js project with TypeScript, Firestore, and minimal endpoints.

Provision Infrastructure: Choose hosting for Redis (Upstash recommended) and the worker (Fly.io Machines recommended).

Draft and Test AI Analyst Prompt: Use the Gemini playground to test and refine the prompt for structuring scraped data.

Lock in Authentication: Set up jsonwebtoken for securing admin endpoints.

CI/CD: Set up GitHub Actions to run tests and validation on every push.