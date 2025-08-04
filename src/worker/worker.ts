import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';
import { AnalysisJobData, AnalysisJobResult } from '../api/queue.js';

dotenv.config();

// Redis connection
const redis = new Redis(process.env.UPSTASH_REDIS_REST_URL || 'redis://localhost:6379');

// Worker for processing analysis jobs
const worker = new Worker('analysis', async (job: Job<AnalysisJobData>) => {
  console.log(`🔄 Processing job ${job.id} for tool: ${job.data.toolId}`);
  
  const startTime = Date.now();
  
  try {
    // Simulate analysis work (Week 2 PoC)
    await simulateAnalysis(job.data);
    
    // Generate mock analysis result
    const result: AnalysisJobResult = {
      toolId: job.data.toolId,
      analysis: {
        strengths: [
          'AI-powered development',
          'Real-time collaboration',
          'Instant deployment'
        ],
        limitations: [
          'Limited offline access',
          'Resource constraints',
          'Vendor lock-in'
        ],
        useCases: [
          'Rapid prototyping',
          'Educational projects',
          'Team collaboration'
        ],
        maturityScore: 0.85,
        lastUpdated: new Date().toISOString(),
      },
      metadata: {
        processedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        source: job.data.url || 'manual-input',
      },
    };
    
    console.log(`✅ Job ${job.id} completed successfully`);
    return result;
    
  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error);
    throw error;
  }
}, {
  connection: redis,
  concurrency: 5, // Process up to 5 jobs simultaneously
});

// Simulate analysis work
async function simulateAnalysis(data: AnalysisJobData): Promise<void> {
  // Simulate different processing times based on priority
  const processingTime = data.priority === 'high' ? 1000 : 
                        data.priority === 'low' ? 5000 : 3000;
  
  console.log(`⏳ Simulating analysis for ${data.toolId} (${processingTime}ms)`);
  
  // Simulate work with progress updates
  for (let i = 0; i <= 100; i += 20) {
    await new Promise(resolve => setTimeout(resolve, processingTime / 5));
    await worker.updateProgress(i);
  }
  
  // Simulate potential failures (10% chance for low priority jobs)
  if (data.priority === 'low' && Math.random() < 0.1) {
    throw new Error('Simulated analysis failure');
  }
}

// Worker event handlers
worker.on('completed', (job: Job) => {
  console.log(`🎉 Job ${job.id} completed successfully`);
});

worker.on('failed', (job: Job, err: Error) => {
  console.error(`💥 Job ${job.id} failed:`, err.message);
});

worker.on('error', (err: Error) => {
  console.error('Worker error:', err);
});

worker.on('stalled', (jobId: string) => {
  console.warn(`⚠️ Job ${jobId} stalled`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down worker gracefully...');
  await worker.close();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down worker gracefully...');
  await worker.close();
  await redis.quit();
  process.exit(0);
});

// Health check function
export const getWorkerHealth = () => {
  return {
    status: 'running',
    workerId: worker.id,
    isRunning: worker.isRunning(),
    timestamp: new Date().toISOString(),
  };
};

console.log('🚀 Analysis worker started');
console.log(`📊 Worker ID: ${worker.id}`);
console.log(`⚡ Concurrency: 5 jobs`);
console.log(`🔗 Redis: ${process.env.UPSTASH_REDIS_REST_URL ? 'Upstash' : 'Local'}`); 