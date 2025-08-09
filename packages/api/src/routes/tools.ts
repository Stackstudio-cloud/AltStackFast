import { Router } from 'express';
import { firestore } from '../server';
import { toolProfileSchema } from '@stackfast/schemas';
import { adminAuthMiddleware } from '../middleware/auth';

const router = Router();

// Mock data for Week 1
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

router.get('/', async (req, res) => {
  try {
    // In the future, this will be:
    // const snapshot = await firestore.collection('tools').get();
    // const tools = snapshot.docs.map(doc => doc.data());

    // For now, use mock data
    const tools = mockTools;

    // Validate every tool against our Zod schema before sending
    const validatedTools = tools.map(tool => toolProfileSchema.parse(tool));

    // ETag for simple client caching
    const etag = `W/"tools-${validatedTools.length}-${validatedTools[0]?.last_updated || ''}"`;
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.status(200).json({
      success: true,
      data: validatedTools,
      count: validatedTools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Validation failed or server error:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to retrieve tools.",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get a specific tool by ID
router.get('/:toolId', async (req, res) => {
  try {
    const { toolId } = req.params;
    
    // Find tool in mock data
    const tool = mockTools.find(t => t.tool_id === toolId);
    
    if (!tool) {
      return res.status(404).json({
        success: false,
        error: "Tool not found",
        toolId
      });
    }

    // Validate the tool
    const validatedTool = toolProfileSchema.parse(tool);

    res.status(200).json({
      success: true,
      data: validatedTool
    });
  } catch (error) {
    console.error("Error retrieving tool:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve tool.",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Admin endpoint to add a new tool (requires authentication)
router.post('/', adminAuthMiddleware, async (req, res) => {
  try {
    const toolData = req.body;
    
    // Validate the incoming data
    const validatedTool = toolProfileSchema.parse({
      ...toolData,
      last_updated: new Date().toISOString(),
      schema_version: "2025-08-04"
    });

    // Save to Firestore (if available)
    if (firestore) {
      const docRef = firestore.collection('tools').doc(validatedTool.tool_id);
      await docRef.set(validatedTool);
    } else {
      console.warn('⚠️ Firestore not available - tool not saved to database');
    }

    res.status(201).json({
      success: true,
      message: "Tool added successfully",
      data: validatedTool
    });
  } catch (error) {
    console.error("Error adding tool:", error);
    res.status(400).json({
      success: false,
      error: "Failed to add tool.",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router; 