import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { chromium } from 'playwright';
import { Firestore } from '@google-cloud/firestore';
import { callGeminiToAnalyze } from '../lib/gemini.js';
import { toolProfileSchema } from '../schemas/toolProfile.js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const app = express();
app.use(express.json());

// Initialize Firestore for the worker with service account credentials
let firestore: Firestore;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString());
    firestore = new Firestore({
      projectId: 'stackstudio-platform',
      credentials: serviceAccount
    });
    console.log('✅ Firestore initialized with service account');
  } else {
    firestore = new Firestore({
      projectId: 'stackstudio-platform'
    });
    console.log('⚠️ Firestore initialized without service account (may fail)');
  }
} catch (error) {
  console.error('❌ Failed to initialize Firestore:', error);
  // Create a mock Firestore for testing
  firestore = {
    collection: () => ({
      doc: () => ({
        set: async () => {
          console.log('📝 Mock Firestore: Profile would be saved here');
          return Promise.resolve();
        }
      })
    })
  } as any;
  console.log('📝 Using mock Firestore for testing');
}

console.log('🚀 QStash Worker started. Waiting for webhook calls...');

async function discoverOfficialSite(toolName: string): Promise<string> {
  const formattedName = toolName.toLowerCase().replace(/\s+/g, '');
  return `https://${formattedName}.com`;
}

// This is the webhook endpoint that QStash will call.
app.post('/analyze', async (req, res) => {
  // QStash may send a signature to verify the request is legitimate.
  // For now, we'll skip verification for simplicity.
  
  const jobData = req.body;
  const { url, tool_name } = jobData;

  console.log(`[JOB RECEIVED] Processing job for: ${url ?? tool_name}`);
  console.log('Job Payload:', jobData);

  try {
    const toolIdentifier = url ?? tool_name;
    console.log(`[JOB START] Processing job for: ${toolIdentifier}`);

    // 1. Scrape the content
    console.log(`[SCRAPE] Launching browser for ${toolIdentifier}...`);
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const targetUrl = url ?? await discoverOfficialSite(tool_name!);

    console.log(`[SCRAPE] Navigating to: ${targetUrl}`);
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    const textContent = await page.evaluate(() => document.body.innerText);
    await browser.close();
    console.log(`[SCRAPE] Successfully extracted ${textContent.length} characters.`);

    // 2. Call AI for analysis and structuring
    console.log('[ANALYZE] Sending content to Gemini for analysis...');
    const profileJson = await callGeminiToAnalyze(textContent);
    console.log('[ANALYZE] Received structured data from Gemini.');

    // 3. Validate the data with our Zod schema
    const toolId = (tool_name ?? new URL(targetUrl).hostname).replace(/\./g, '_');
    const dataToValidate = {
      ...profileJson,
      tool_id: toolId,
      last_updated: new Date().toISOString(),
      schema_version: "2025-08-04", // This should match our schema version
      requires_review: true, // Always flag AI-generated profiles for human review
    };
    const validatedProfile = toolProfileSchema.parse(dataToValidate);
    console.log(`[VALIDATE] AI response successfully validated against schema.`);

    // 4. Save the validated profile to Firestore
    const docRef = firestore.collection('tools').doc(toolId);
    await docRef.set(validatedProfile, { merge: true });
    console.log(`[SAVE] Profile for ${toolId} saved to Firestore.`);

    console.log(`[JOB COMPLETE] Finished processing job for ${toolIdentifier}.`);
    
    // Respond with 200 OK to let QStash know we've successfully processed the job
    res.status(200).json({ 
      status: 'complete', 
      toolId: toolId,
      tool: url ?? tool_name,
      profile: validatedProfile
    });
  } catch (error) {
    console.error(`[JOB FAILED] Job failed for ${url ?? tool_name}:`, error);
    
    // Still respond with 200 to QStash to prevent retries
    // In production, you might want to implement dead letter queues
    res.status(200).json({ 
      status: 'failed', 
      tool: url ?? tool_name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/healthz', (_, res) => res.status(200).send('ok'));

const PORT = process.env.WORKER_PORT ?? 8081;
app.listen(PORT, () => {
  console.log(`🚀 QStash Worker server listening for jobs at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/healthz`);
  console.log(`🔍 Analysis endpoint: http://localhost:${PORT}/analyze`);
}); 