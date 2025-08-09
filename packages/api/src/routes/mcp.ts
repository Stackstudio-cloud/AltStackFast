import { Router } from 'express';
import { firestore } from '../server';
import { toolProfileSchema } from '@stackfast/schemas';

const router = Router();

// Mock data for testing (same as in tools.ts)
const mockTools = [
  {
    tool_id: "replit",
    name: "Replit",
    description: "Browser-based IDE with instant hosting and AI-assisted coding.",
    category: ["Vibe Coding Tool", "Cloud IDE"],
    notable_strengths: ["Instant dev environment", "Ghostwriter AI"],
    known_limitations: ["Limited offline access", "Resource constraints"],
    output_types: ["code", "live_preview"],
    integrations: ["GitHub", "Vercel", "Netlify"],
    license: "Proprietary",
    maturity_score: 0.9,
    last_updated: new Date().toISOString(),
    schema_version: "2025-08-04",
    requires_review: false
  },
  {
    tool_id: "cursor",
    name: "Cursor IDE",
    description: "AI-first code editor built on VS Code with advanced AI capabilities.",
    category: ["Agentic Tool", "Code Editor"],
    notable_strengths: ["Advanced AI chat", "Codebase understanding"],
    known_limitations: ["Resource intensive", "Requires internet"],
    output_types: ["code", "explanations"],
    integrations: ["Git", "GitHub", "VS Code extensions"],
    license: "Proprietary",
    maturity_score: 0.8,
    last_updated: new Date().toISOString(),
    schema_version: "2025-08-04",
    requires_review: false
  },
  {
    tool_id: "bolt",
    name: "Bolt.new",
    description: "AI-powered web app builder with instant deployment.",
    category: ["Vibe Coding Tool", "No-Code Platform"],
    notable_strengths: ["Instant deployment", "AI generation"],
    known_limitations: ["Limited customization", "Vendor lock-in"],
    output_types: ["hosted_app", "code"],
    integrations: ["Vercel", "GitHub"],
    license: "Proprietary",
    maturity_score: 0.7,
    last_updated: new Date().toISOString(),
    schema_version: "2025-08-04",
    requires_review: false
  }
];

// Handle GET requests to /mcp/v1?q=<tool_id>
router.get('/', async (req, res) => {
  const toolId = req.query.q;

  if (typeof toolId !== 'string' || !toolId) {
    return res.status(400).json({ error: 'Query parameter "q" (tool_id) is required.' });
  }

  try {
    // For now, just use mock data to avoid Firestore issues
    const mockTool = mockTools.find(t => t.tool_id === toolId);
    if (mockTool) {
      const validatedProfile = toolProfileSchema.parse(mockTool);
      return res.status(200).json(validatedProfile);
    }

    return res.status(404).json({ error: `Tool with ID "${toolId}" not found.` });
  } catch (error) {
    console.error(`Error fetching tool ${toolId} for MCP:`, error);
    res.status(500).json({ error: 'Failed to retrieve tool profile.' });
  }
});

export default router; 