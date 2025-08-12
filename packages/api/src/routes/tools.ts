import { Router } from 'express';
import { firestore } from '../server';
import { FieldValue } from '@google-cloud/firestore';
import { toolProfileSchema } from '@stackfast/schemas';
import { adminAuthMiddleware } from '../middleware/auth';

const router = Router();

// Mock data for Week 1
export const mockTools = [
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
    // Query params: limit, offset, category, q (name substring)
    const limit = Math.max(0, Math.min(Number(req.query.limit ?? 50), 100));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    const cursorParam = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    let cursor: { last_updated: string; tool_id?: string } | undefined;
    if (cursorParam) {
      try { cursor = JSON.parse(Buffer.from(cursorParam, 'base64').toString('utf-8')); } catch {}
    }
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const requiresReview = typeof req.query.requires_review === 'string' ? req.query.requires_review === 'true' : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : undefined;

    const source = (process.env.TOOLS_SOURCE || 'mock').toLowerCase();
    let page: any[] = [];
    let total = 0;

    if (source === 'firestore' && firestore) {
      // Firestore-backed listing; be lenient with existing docs that may miss fields
      const baseRef = firestore.collection('tools');
      let snap: FirebaseFirestore.QuerySnapshot | null = await baseRef
        .orderBy('last_updated', 'desc')
        .limit(limit)
        .get()
        .catch(() => null);
      // If ordering by last_updated yields no docs or fails (missing field), fallback to unordered
      if (!snap || snap.empty) {
        snap = await baseRef.limit(limit).get();
      }
      // Normalize docs to the schema shape (fill sensible defaults if missing)
      let all: any[] = (snap?.docs || []).map((d: FirebaseFirestore.QueryDocumentSnapshot) => {
        const raw: any = d.data() || {};
        const toArray = (v: any): string[] => Array.isArray(v) ? v : (typeof v === 'string' && v ? [v] : []);
        const normalized = {
          tool_id: typeof raw.tool_id === 'string' && raw.tool_id ? raw.tool_id : d.id,
          name: typeof raw.name === 'string' && raw.name ? raw.name : (typeof raw.tool_id === 'string' && raw.tool_id ? raw.tool_id : d.id),
          description: typeof raw.description === 'string' ? raw.description : '',
          category: toArray(raw.category),
          last_updated: typeof raw.last_updated === 'string' ? raw.last_updated : new Date().toISOString(),
          schema_version: typeof raw.schema_version === 'string' ? raw.schema_version : '2025-08-04',
          // pass through optional known fields if present
          notable_strengths: toArray(raw.notable_strengths),
          known_limitations: toArray(raw.known_limitations),
          output_types: toArray(raw.output_types),
          integrations: toArray(raw.integrations),
          license: typeof raw.license === 'string' ? raw.license : null,
          maturity_score: typeof raw.maturity_score === 'number' ? raw.maturity_score : null,
          popularity_score: typeof raw.popularity_score === 'number' ? raw.popularity_score : null,
          requires_review: typeof raw.requires_review === 'boolean' ? raw.requires_review : false,
          source_url: typeof raw.source_url === 'string' ? raw.source_url : undefined,
          source_description: typeof raw.source_description === 'string' ? raw.source_description : undefined,
          scraping_failed: typeof raw.scraping_failed === 'boolean' ? raw.scraping_failed : undefined,
        };
        return normalized;
      });
      if (category) all = all.filter((t) => Array.isArray(t.category) && t.category.includes(category));
      if (q) all = all.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q));
      if (typeof requiresReview === 'boolean') all = all.filter((t) => Boolean(t.requires_review) === requiresReview);
      // Use counters doc for accurate total if present
      const countersSnap = await firestore.collection('metadata').doc('tools-counters').get();
      const counterTotal = countersSnap.exists ? (countersSnap.data()?.total as number | undefined) : undefined;
      total = typeof counterTotal === 'number' ? counterTotal : all.length + (offset || 0);
      page = all;
    } else {
      // Mock data fallback
      let tools = mockTools;
      if (category) {
        tools = tools.filter((t) => (t.category || []).includes(category));
      }
      if (q) {
        tools = tools.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q));
      }
      if (typeof requiresReview === 'boolean') {
        tools = tools.filter((t) => Boolean(t.requires_review) === requiresReview);
      }
      total = tools.length;
      page = tools.slice(offset, offset + limit);
    }

    // Validate every tool against our Zod schema before sending
    const validatedTools = page.map(tool => toolProfileSchema.parse(tool));

    // ETag for simple client caching
    const etag = `W/"tools-${validatedTools.length}-${validatedTools[0]?.last_updated || ''}"`;
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    const last = validatedTools[validatedTools.length - 1];
    const nextCursor = last?.last_updated
      ? Buffer.from(JSON.stringify({ last_updated: last.last_updated })).toString('base64')
      : undefined;

    res.status(200).json({
      success: true,
      data: validatedTools,
      count: validatedTools.length,
      total,
      limit,
      offset,
      nextCursor,
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
      const existed = (await docRef.get()).exists;
      await docRef.set(validatedTool, { merge: true });
      if (!existed) {
        const countersRef = firestore.collection('metadata').doc('tools-counters');
        await countersRef.set({ total: FieldValue.increment(1), updated_at: new Date() }, { merge: true });
      }
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

// Admin: approve a tool (sets requires_review=false, reviewed metadata)
router.post('/:toolId/approve', adminAuthMiddleware, async (req, res) => {
  try {
    const { toolId } = req.params;
    if (!firestore) return res.status(500).json({ success: false, error: 'Firestore unavailable' });
    const reviewed_at = new Date().toISOString();
    const reviewer = (req as any).user?.email || (req as any).user?.sub || 'admin';
    await firestore.collection('tools').doc(toolId).set({ requires_review: false, reviewed_at, reviewed_by: reviewer }, { merge: true });
    return res.json({ success: true, toolId, reviewed_at });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Approve failed' });
  }
});

// Admin: reject a tool (records rejection reason)
router.post('/:toolId/reject', adminAuthMiddleware, async (req, res) => {
  try {
    const { toolId } = req.params;
    const { reason } = req.body || {};
    if (!firestore) return res.status(500).json({ success: false, error: 'Firestore unavailable' });
    const reviewed_at = new Date().toISOString();
    const reviewer = (req as any).user?.email || (req as any).user?.sub || 'admin';
    await firestore.collection('tools').doc(toolId).set({ requires_review: true, rejected_reason: reason || 'unspecified', reviewed_at, reviewed_by: reviewer }, { merge: true });
    return res.json({ success: true, toolId, reviewed_at });
  } catch (error) {
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Reject failed' });
  }
});

export default router; 