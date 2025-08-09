import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Zod schema for request body validation
const analyzeBodySchema = z.object({
  url: z.string().url().optional(),
  tool_name: z.string().min(2).optional(),
}).refine((data) => data.url || data.tool_name, {
  message: 'Either a `url` or a `tool_name` must be provided.',
});

// The URL of your worker service deployed on Fly.io or another platform.
// This should be in your .env file.
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8080/analyze';

router.post('/', async (req, res) => {
  const parseResult = analyzeBodySchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({ 
      success: false,
      error: 'Validation failed',
      details: parseResult.error.flatten() 
    });
  }

  if (!process.env.QSTASH_URL || !process.env.QSTASH_TOKEN) {
    console.warn("QStash environment variables not set. Falling back to direct worker call.");
    try {
      const reqId = (req as any).requestId || `${Date.now()}`;
      const directResp = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parseResult.data, requestId: reqId }),
      });
      const text = await directResp.text();
      if (!directResp.ok) {
        throw new Error(`Worker error ${directResp.status}: ${text}`);
      }
      return res.status(200).json({ success: true, data: JSON.parse(text) });
    } catch (err) {
      console.error('Direct worker call failed:', err);
      return res.status(502).json({ success: false, error: 'Worker unavailable', details: err instanceof Error ? err.message : String(err) });
    }
  }

  try {
                // Publish a message to the QStash topic.
            // The body of this request is the job payload.
            // The URL is where QStash will send the job.
            const qstashResponse = await fetch(`${process.env.QSTASH_URL}/v2/publish/${WORKER_URL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
        'Content-Type': 'application/json',
        // Add retry logic. QStash will attempt this 3 times.
        'Upstash-Retries': '3',
      },
      body: JSON.stringify(parseResult.data),
    });

    if (!qstashResponse.ok) {
        throw new Error(`QStash API error: ${await qstashResponse.text()}`);
    }
    
    const responseBody = await qstashResponse.json() as { messageId: string };

    // Respond immediately with "202 Accepted" and the message ID from QStash.
    res.status(202).json({ 
      success: true,
      message: "Analysis job accepted.", 
      messageId: responseBody.messageId,
      data: {
        jobId: responseBody.messageId,
        status: 'queued',
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error("Failed to publish job to QStash:", error);
    res.status(500).json({ 
      success: false,
      error: "Could not schedule the analysis job.",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Keep the job status endpoint for compatibility (though QStash doesn't provide status)
router.get('/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  res.json({
    success: true,
    data: {
      jobId,
      status: 'processing', // QStash doesn't provide detailed status
      progress: 0,
      result: null,
      failedReason: null,
      timestamp: new Date().toISOString(),
      note: 'QStash-based job - status not available'
    }
  });
});

export default router; 