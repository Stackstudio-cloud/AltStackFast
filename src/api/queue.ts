import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection
const redis = new Redis(process.env.UPSTASH_REDIS_REST_URL || 'redis://localhost:6379');

// Queue for analysis jobs
export const analysisQueue = new Queue('analysis', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Job types
export interface AnalysisJobData {
  toolId: string;
  url?: string;
  description?: string;
  userId?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface AnalysisJobResult {
  toolId: string;
  analysis: {
    strengths: string[];
    limitations: string[];
    useCases: string[];
    maturityScore: number;
    lastUpdated: string;
  };
  metadata: {
    processedAt: string;
    processingTime: number;
    source: string;
  };
}

// Queue health check
export const getQueueHealth = async () => {
  try {
    const waiting = await analysisQueue.getWaiting();
    const active = await analysisQueue.getActive();
    const completed = await analysisQueue.getCompleted();
    const failed = await analysisQueue.getFailed();
    
    return {
      status: 'healthy',
      stats: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
  }
};

// Add job to queue
export const addAnalysisJob = async (data: AnalysisJobData) => {
  const job = await analysisQueue.add('analyze-tool', data, {
    priority: data.priority === 'high' ? 1 : data.priority === 'low' ? 3 : 2,
    delay: 0,
  });
  
  return {
    jobId: job.id,
    status: 'queued',
    timestamp: new Date().toISOString(),
  };
};

// Get job status
export const getJobStatus = async (jobId: string) => {
  const job = await analysisQueue.getJob(jobId);
  
  if (!job) {
    return { status: 'not_found' };
  }
  
  const state = await job.getState();
  const progress = await job.progress;
  const result = job.returnvalue;
  const failedReason = job.failedReason;
  
  return {
    jobId,
    status: state,
    progress,
    result,
    failedReason,
    timestamp: new Date().toISOString(),
  };
}; 