const { Worker } = require('bullmq');
const k8s = require('@kubernetes/client-node');
require('dotenv').config();

// Kubernetes client
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

// Namespace for isolated executions
const isolatedExecutionNamespace = {
    metadata: { name: "isolated-execution-env" }
};

// Redis connection config for BullMQ
const connection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10)
};

async function ensureNamespaceExists() {
    try {
        await k8sApi.createNamespace(isolatedExecutionNamespace);
        console.log(`[Worker] Namespace ${isolatedExecutionNamespace.metadata?.name} created.`);
    } catch (err) {
        if (err.response && err.response.statusCode === 409) {
            console.log(`[Worker] Namespace already exists.`);
        } else {
            console.error(`[Worker] Error ensuring namespace:`, err.body || err);
        }
    }
}

const namespace = "isolated-execution-env";


async function submissionJob(job) {
    const { submissionId } = job.data;
    console.log(`[Worker] Picking up job ${job.id} for submissionId: ${submissionId}`);

    // Create a fresh pod manifest for each job
    const podManifest = {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            name: `submission-${submissionId.toLowerCase()}`,
            labels: { app: "demo" }
        },
        spec: {
            ttlSecondsAfterFinished: 30,
            containers: [
                {
                    name: "nginx-container",
                    image: "nginx",
                    ports: [{ containerPort: 80 }]
                }
            ],
            restartPolicy: "Never"
        }
    };

    try {
        const res = await k8sApi.createNamespacedPod(namespace, podManifest);
        console.log(`[Worker] Pod created: ${res.body.metadata.name}`);

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log(`[Worker] Processing submission ${submissionId}...`);
    } catch (err) {
        console.error(`[Worker] Error creating pod:`, err.body || err);
        throw err;
    }
}


async function startWorker() {
    await ensureNamespaceExists();

    const worker = new Worker(
        'submissionQueue',
        submissionJob,
        { connection, concurrency: 10 }
    );

    worker.on("completed", job => {
        console.log(`[Worker] Job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
        console.error(`[Worker] Job ${job?.id} failed:`, err);
    });

    console.log("[Worker] Listening for jobs...");
}

if (require.main === module) {
    startWorker().catch(err => {
        console.error("[Worker] Failed to start:", err);
        process.exit(1);
    });
}
