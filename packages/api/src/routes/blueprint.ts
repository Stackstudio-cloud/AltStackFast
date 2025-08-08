import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const requestSchema = z.object({
  rawIdea: z.string().min(1),
  stackRegistry: z.any().optional(),
});

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
  const metaPrompt = `You are a world-class software architect. A user has provided an idea for a web application. You also have access to a database of AI development tools, backends, frontends, and boilerplates.
\nUser's Idea: "${rawIdea}"\n\nStack Registry Database:\n${stackContext}\n\nBased on the user's idea AND the available stack components, create a comprehensive project blueprint. Recommend the best workflow (single tool or sequence), a compatible backend, frontend tool, and boilerplate. Return your response *only* as a valid JSON object.`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: metaPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      // Let the model produce a JSON object without strict schema here
    },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({ success: false, error: `Gemini error ${response.status}`, body: text });
    }

    let resultJson: any;
    try {
      const result = JSON.parse(text);
      const content = result?.candidates?.[0]?.content?.parts?.[0]?.text;
      resultJson = typeof content === 'string' ? JSON.parse(content) : content;
    } catch (e: any) {
      return res.status(502).json({ success: false, error: 'Failed to parse Gemini response', body: text });
    }

    return res.status(200).json({ success: true, data: resultJson });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Unknown error' });
  }
});

export default router;
