import { Router } from 'express';
import { z } from 'zod';
import { addAnalysisJob, getJobStatus } from '../queue.js';

const router = Router();

// Validation schema for analyze request
const analyzeRequestSchema = z.object({
  toolId: z.string().min(1),
  url: z.string().url().optional(),
  description: z.string().optional(),
  userId: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

// POST /v1/analyze - Add analysis job to queue
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const validatedData = analyzeRequestSchema.parse(req.body);
    
    // Add job to queue
    const result = await addAnalysisJob(validatedData);
    
    res.status(202).json({
      success: true,
      message: 'Analysis job queued successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error adding analysis job:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to queue analysis job',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /v1/analyze/:jobId - Get job status
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required',
      });
    }
    
    const status = await getJobStatus(jobId);
    
    if (status.status === 'not_found') {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        jobId,
      });
    }
    
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get job status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router; 