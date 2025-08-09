import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const requestSchema = z.object({
  rawIdea: z.string().min(1),
  stackRegistry: z.any().optional(),
});

// Strict response schema returned to the client
export const blueprintSchema = z.object({
  title: z.string().default('Untitled Project'),
  techStack: z.string().optional().default(''),
  backendLogic: z.array(z.string()).default([]),
  frontendLogic: z.array(z.string()).default([]),
  recommendedWorkflow: z
    .object({
      name: z.string().default('Recommended Workflow'),
      stages: z.array(z.string()).default([]),
      reasoning: z.string().optional().default('')
    })
    .default({ name: 'Recommended Workflow', stages: [], reasoning: '' }),
  recommendedBackend: z.object({ name: z.string(), reasoning: z.string().optional().default('') }).optional(),
  recommendedFrontend: z.object({ name: z.string(), reasoning: z.string().optional().default('') }).optional(),
  recommendedBoilerplate: z.object({ name: z.string(), reasoning: z.string().optional().default('') }).optional()
});

const callGeminiWithRetry = async (apiUrl: string, payload: any, { attempts = 2, timeoutMs = 30000 }: { attempts?: number; timeoutMs?: number }) => {
  let lastErr: any;
  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await resp.text();
      if (!resp.ok) {
        // Retry on 429/5xx
        if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
          lastErr = new Error(`Gemini ${resp.status}: ${text}`);
          continue;
        }
        throw new Error(`Gemini ${resp.status}: ${text}`);
      }

      // Parse outer and inner JSON
      const outer = JSON.parse(text);
      const content = outer?.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;
      return parsed;
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      // Retry on abort/timeout or fetch network errors
      continue;
    }
  }
  throw lastErr || new Error('Gemini call failed');
};

router.post('/', async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request', details: parsed.error.flatten() });
  }

  const { rawIdea, stackRegistry } = parsed.data;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'Server is missing GEMINI_API_KEY' });
  }

  const stackContext = JSON.stringify(stackRegistry ?? {}, null, 2);
  const metaPrompt = `You are a world-class software architect. A user has provided an idea for a web application. You also have access to a database of AI development tools, backends, frontends, and boilerplates.\n\nUser's Idea: "${rawIdea}"\n\nStack Registry Database:\n${stackContext}\n\nBased on the user's idea AND the available stack components, create a comprehensive project blueprint. Recommend the best workflow (single tool or sequence), a compatible backend, frontend tool, and boilerplate. Return your response *only* as a valid JSON object.`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  };
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  try {
    const raw = await callGeminiWithRetry(apiUrl, payload, { attempts: 2, timeoutMs: 15000 });
    const safe = blueprintSchema.parse(raw);
    return res.status(200).json({ success: true, data: safe });
  } catch (error: any) {
    return res.status(502).json({ success: false, error: error?.message || 'Failed to fetch from Gemini' });
  }
});

export default router;
