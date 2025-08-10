// --- Imports ---
import { Worker } from 'bullmq';
import { KubeConfig, CoreV1Api, loadYaml } from '@kubernetes/client-node';
import { PrismaClient } from '@prisma/client';

import { readFileSync } from 'fs';
import { join } from 'path';


// --- Configuration ---
const SUBMISSION_QUEUE_NAME = 'submission-queue'; // Must match the API's queue name
const K8S_NAMESPACE = 'isolated-execution-env';

// --- Service Connections ---
const prisma = new PrismaClient(); // Instantiate Prisma Client

const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
};

const kc = new KubeConfig();
kc.loadFromDefault(); // Loads from ~/.kube/config or in-cluster service account
const k8sApi = kc.makeApiClient(CoreV1Api);



async function ensureNamespaceExists() {
  try {
    await k8sApi.readNamespace(K8S_NAMESPACE);
    console.log(`[K8s] Namespace "${K8S_NAMESPACE}" already exists.`);
  } catch (err) {
    if (err.response && err.response.statusCode === 409) {
        console.log(`[K8s] Namespace "${K8S_NAMESPACE}" already exists.`);
    } else {
        try {
            console.log(`[K8s] Namespace "${K8S_NAMESPACE}" not found, creating...`);
            await k8sApi.createNamespace({ metadata: { name: K8S_NAMESPACE } });
            console.log(`[K8s] Namespace "${K8S_NAMESPACE}" created successfully.`);
        } catch (createError) {
            console.error(`[K8s] Critical error: Failed to create namespace.`, createError);
            process.exit(1); 
        }
    }
  }
}


async function submissionJobProcessor(job) {
    const { submissionId } = job.data;
    console.log(`[Worker] Processing job ${job.id} for submissionId: ${submissionId}`);

    const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { language: true }, 
    });

    if (!submission) {
        throw new Error(`Submission ${submissionId} not found in the database.`);
    }

    // --- 2. Prepare Pod Configuration from Template ---
    const podTemplate = readFileSync(join(__dirname, '../k8s-pod-template.yaml'), 'utf8');
    
    const {
        CONTAINER_REG_BASE_URL,
        IMAGE_NAME_PREFIX,
        IMAGE_TAG,
        API_URL
    } = process.env;

    if (!CONTAINER_REG_BASE_URL || !IMAGE_NAME_PREFIX || !IMAGE_TAG || !API_URL) {
        throw new Error("One or more required environment variables are not set for the worker.");
    }
    
    // Construct the dynamic Docker image name
    const languageImageName = `${CONTAINER_REG_BASE_URL}/${IMAGE_NAME_PREFIX}-${submission.language.extension}:${IMAGE_TAG}`;

    // Replace all placeholders in the YAML template
    const podManifestString = podTemplate
        .replace(/submission-id/g, submission.id) // Use regex with 'g' flag for global replace
        .replace(/language-image/g, languageImageName)
        .replace(/callback-url/g, `${API_URL}/api/submission/${submission.id}`)
        .replace(/problem-id/g, submission.problemId);
        
    const podManifest = loadYaml(podManifestString);

    // --- 3. Create the Pod in Kubernetes & Update DB ---
    try {
        console.log(`[K8s] Creating pod for submission ${submission.id} with image ${languageImageName}...`);
        await k8sApi.createNamespacedPod(K8S_NAMESPACE, podManifest);
        
        // Update the submission status to 'Processing' immediately after pod creation
        await prisma.submission.update({
            where: { id: submission.id },
            data: { status: "Processing" },
        });

        console.log(`[K8s] Pod ${submission.id} created successfully.`);
        return { podName: submission.id };

    } catch (error) {
        console.error(`[K8s] Failed to create pod for submission ${submission.id}.`, error.body || error);
        // If pod creation fails, update the DB to reflect the error
        await prisma.submission.update({
            where: { id: submission.id },
            data: { status: SubmissionStatus.Error, errorMessage: "Failed to create execution environment." },
        });
        throw error; // Re-throw to let BullMQ know the job failed
    }
};

// --- Main Execution Logic to Start the Worker ---

async function startWorker() {
    await ensureNamespaceExists();

    console.log(`[BullMQ] Worker starting. Listening on queue: "${SUBMISSION_QUEUE_NAME}"`);

    // The Worker object that listens for jobs and calls our processor
    const worker = new Worker(SUBMISSION_QUEUE_NAME, submissionJobProcessor, {
        connection: redisConnection,
        concurrency: 10, // Adjust as needed
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
    });

    worker.on('completed', (job, result) => {
      console.log(`[BullMQ] Job ${job.id} completed. Result:`, result);
    });
    
    worker.on('failed', (job, err) => {
      console.error(`[BullMQ] Job ${job?.id} failed with error:`, err);
    });

    // Graceful shutdown logic
    const closeGracefully = async () => {
        console.log('[BullMQ] Closing worker gracefully...');
        await worker.close();
        process.exit(0);
    };
    process.on('SIGINT', closeGracefully);
    process.on('SIGTERM', closeGracefully);
}

