import dotenv from 'dotenv';

dotenv.config();

// In-memory job storage for Week 2 PoC
type StoredJob = {
  id: string;
  name: string;
  data: AnalysisJobData;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt?: Date;
  progress?: number;
  result?: AnalysisJobResult;
  failedReason?: string;
  priority: number;
};
const jobs = new Map<string, StoredJob>();
let jobCounter = 0;

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

// Mock queue for Week 2 PoC
export const analysisQueue = {
  add: async (name: string, data: AnalysisJobData, options?: { priority?: number }) => {
    const jobId = `job_${++jobCounter}`;
    const job: StoredJob = {
      id: jobId,
      name,
      data,
      status: 'waiting',
      createdAt: new Date(),
      priority: options?.priority || 2,
    };
    jobs.set(jobId, job);
    return { id: jobId };
  },
  getJob: async (jobId: string) => {
    return jobs.get(jobId);
  },
  getWaiting: async () => {
    return Array.from(jobs.values()).filter(job => job.status === 'waiting');
  },
  getActive: async () => {
    return Array.from(jobs.values()).filter(job => job.status === 'active');
  },
  getCompleted: async () => {
    return Array.from(jobs.values()).filter(job => job.status === 'completed');
  },
  getFailed: async () => {
    return Array.from(jobs.values()).filter(job => job.status === 'failed');
  },
};

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
      note: 'Using in-memory queue for Week 2 PoC',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Queue error',
      timestamp: new Date().toISOString(),
    };
  }
};

// Add job to queue
export const addAnalysisJob = async (data: AnalysisJobData) => {
  const job = await analysisQueue.add('analyze-tool', data, {
    priority: data.priority === 'high' ? 1 : data.priority === 'low' ? 3 : 2,
  });
  
  return {
    jobId: job.id,
    status: 'queued',
    timestamp: new Date().toISOString(),
  };
};

// Get job status
export const getJobStatus = async (jobId: string) => {
  const job = jobs.get(jobId);
  
  if (!job) {
    return { status: 'not_found' };
  }
  
  return {
    jobId,
    status: job.status,
    progress: job.progress || 0,
    result: job.result,
    failedReason: job.failedReason,
    timestamp: new Date().toISOString(),
  };
};

// Update job status (for worker)
export const updateJobStatus = (
  jobId: string,
  status: 'waiting' | 'active' | 'completed' | 'failed',
  result?: AnalysisJobResult,
  error?: string,
) => {
  const job = jobs.get(jobId);
  if (job) {
    job.status = status;
    if (result) job.result = result;
    if (error) job.failedReason = error;
    job.updatedAt = new Date();
  }
}; 