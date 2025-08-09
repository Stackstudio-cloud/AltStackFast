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
  recommendedBoilerplate: z.object({ name: z.string(), reasoning: z.string().optional().default('') }).optional(),
  marketGapAnalysis: z
    .object({
      segments: z.array(z.string()).default([]),
      competitors: z.array(z.string()).default([]),
      gaps: z.array(z.string()).default([]),
      validationPlan: z.array(z.string()).default([]),
    })
    .optional()
});

const callGeminiWithRetry = async (
  apiUrl: string,
  payload: Record<string, unknown>,
  { attempts = 2, timeoutMs = 30000 }: { attempts?: number; timeoutMs?: number }
) => {
  let lastErr: unknown;
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
    } catch (err: unknown) {
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
  const metaPrompt = `You are a world-class software architect. A user provided an app idea. You also have a stack registry of tools.\n\nReturn ONLY valid JSON with the following shape (no prose outside JSON):\n{\n  "title": string,\n  "techStack": string,\n  "backendLogic": string[],\n  "frontendLogic": string[],\n  "recommendedWorkflow": { "name": string, "stages": string[], "reasoning": string },\n  "recommendedBackend"?: { "name": string, "reasoning": string },\n  "recommendedFrontend"?: { "name": string, "reasoning": string },\n  "recommendedBoilerplate"?: { "name": string, "reasoning": string },\n  "marketGapAnalysis"?: { "segments": string[], "competitors": string[], "gaps": string[], "validationPlan": string[] }\n}\n\nConstraints:\n- Provide at least 5 bullets each for backendLogic and frontendLogic.\n- Provide 4-6 concrete workflow stages with short imperative names.\n- If marketGapAnalysis is relevant, include 3-5 bullets per field.\n\nUser Idea: ${rawIdea}\n\nStack Registry (summarize to what matters):\n${stackContext}`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, topP: 0.9 },
  };
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const raw = await callGeminiWithRetry(apiUrl, payload, { attempts: 2, timeoutMs: 30000 });
    let safe = blueprintSchema.parse(raw);

    // Ensure minimum useful content even if the model under-fills arrays
    const ensureMinItems = (items: unknown, min: number, fillers: string[]): string[] => {
      const base = Array.isArray(items) ? (items as string[]) : [];
      let i = 0;
      while (base.length < min && i < fillers.length) {
        base.push(fillers[i]);
        i += 1;
      }
      return base;
    };

    safe = {
      ...safe,
      backendLogic: ensureMinItems(safe.backendLogic, 5, [
        'Design database schema and migrations',
        'Implement authentication and authorization',
        'Expose REST endpoints for core features'
      ]),
      frontendLogic: ensureMinItems(safe.frontendLogic, 5, [
        'Build main dashboard and navigation layout',
        'Implement forms with validation for core flows',
        'Integrate API calls with loading and error states'
      ]),
      recommendedWorkflow: {
        name: safe.recommendedWorkflow?.name || 'Recommended Workflow',
        reasoning: safe.recommendedWorkflow?.reasoning || '',
        stages: ensureMinItems(safe.recommendedWorkflow?.stages, 4, [
          'Plan and scope MVP',
          'Implement core backend services',
          'Build primary frontend screens',
          'Integrate and test end-to-end'
        ]),
      },
      marketGapAnalysis: safe.marketGapAnalysis
        ? {
            segments: ensureMinItems(safe.marketGapAnalysis.segments, 3, ['Early adopters', 'SMBs', 'Enterprise teams']),
            competitors: ensureMinItems(safe.marketGapAnalysis.competitors, 3, ['Manual workflows', 'General-purpose tools', 'Internal tooling']),
            gaps: ensureMinItems(safe.marketGapAnalysis.gaps, 3, ['Fragmented process', 'High switching cost', 'Poor automation']),
            validationPlan: ensureMinItems(safe.marketGapAnalysis.validationPlan, 3, ['Landing page + waitlist', 'User interviews', 'Paid pilot with 5 teams']),
          }
        : undefined,
    };

    return res.status(200).json({ success: true, data: safe });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to fetch from Gemini';
    return res.status(502).json({ success: false, error: msg });
  }
});

export default router;
