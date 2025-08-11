// --- Imports ---
import { Worker } from 'bullmq';
import { KubeConfig, CoreV1Api, loadYaml } from '@kubernetes/client-node';
import { PrismaClient, SubmissionStatus } from '@prisma/client';


import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const SUBMISSION_QUEUE_NAME = 'submissionQueue'; 
const K8S_NAMESPACE = 'isolated-execution-env';

// --- Service Connections ---
const prisma = new PrismaClient();

const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
};

const kc = new KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(CoreV1Api);

// --- Namespace check/creation ---
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

// --- Job Processor ---
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

    const podTemplate = readFileSync(path.join(__dirname, 'k8s-pod-template.yaml'), 'utf8');

    const {
        CONTAINER_REG_BASE_URL,
        IMAGE_BASE_NAME, 
        IMAGE_TAG,
        API_URL,
        TESTCASES_GIT
    } = process.env;

    if (!CONTAINER_REG_BASE_URL || !IMAGE_BASE_NAME || !IMAGE_TAG || !API_URL || !TESTCASES_GIT) {
        throw new Error("One or more required environment variables are not set for the worker.");
    }


    const languageImageName = `${CONTAINER_REG_BASE_URL}/${IMAGE_BASE_NAME}-${submission.language.extension}:${IMAGE_TAG}`;


    const podManifestString = podTemplate
        .replace(/submission-id/g, submission.id)
        .replace(/language-image/g, languageImageName)
        .replace(/callback-url/g, `${API_URL}/api/submission/${submission.id}`)
        .replace(/problem-id/g, submission.problemId)
        .replace(/testcases-git/g, TESTCASES_GIT);

    const podManifest = loadYaml(podManifestString);

    try {
        console.log(`[K8s] Creating pod for submission ${submission.id} with image ${languageImageName}...`);
        await k8sApi.createNamespacedPod(K8S_NAMESPACE, podManifest);

        await prisma.submission.update({
            where: { id: submission.id },
            data: { status: "Queued" },
        });

        console.log(`[K8s] Pod ${submission.id} created successfully.`);
        return { podName: submission.id };
    } catch (error) {
        console.error(`[K8s] Failed to create pod for submission ${submission.id}.`, error.body || error);
        await prisma.submission.update({
            where: { id: submission.id },
            data: { status: SubmissionStatus.Error, errorMessage: "Failed to create execution environment." },
        });
        throw error;
    }
}

async function startWorker() {
    await ensureNamespaceExists();

    console.log(`[BullMQ] Worker starting. Listening on queue: "${SUBMISSION_QUEUE_NAME}"`);

    const worker = new Worker(SUBMISSION_QUEUE_NAME, submissionJobProcessor, {
        connection: redisConnection,
        concurrency: 10,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
    });

    worker.on('completed', (job, result) => {
        console.log(`[BullMQ] Job ${job.id} completed. Result:`, result);
    });

    worker.on('failed', (job, err) => {
        console.error(`[BullMQ] Job ${job?.id} failed with error:`, err);
    });

    const closeGracefully = async () => {
        console.log('[BullMQ] Closing worker gracefully...');
        await worker.close();
        await prisma.$disconnect();
        process.exit(0);
    };

    process.on('SIGINT', closeGracefully);
    process.on('SIGTERM', closeGracefully);
}

startWorker().catch((err) => {
    console.error("Fatal worker error:", err);
    process.exit(1);
});
