// emojiChaosAllInOne.js
const { Worker, Queue } = require("bullmq");
const k8s = require("@kubernetes/client-node");
require("dotenv").config();

// Kubernetes setup
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const namespace = "isolated-execution-env";

// Redis connection
const connection = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10)
};

// Emoji chaos pod generator
function createEmojiPod() {
    const emojis = ["😀", "🚀", "🔥", "🍕", "🐙", "💡", "🌈", "🎩", "🪄", "💥"];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    return {
        apiVersion: "v1",
        kind: "Pod",
        metadata: { name: `emoji-chaos-${Date.now()}` },
        spec: {
            ttlSecondsAfterFinished: 30,
            containers: [
                {
                    name: "emoji-chaos",
                    image: "alpine:3.19",
                    command: [
                        "sh", "-c",
                        `for i in $(seq 1 100); do echo "${randomEmoji}"; sleep 0.1; done`
                    ]
                }
            ],
            restartPolicy: "Never"
        }
    };
}

// Job handler
async function emojiChaosJob(job) {
    console.log(`[Emoji Worker] Starting chaos for job ${job.id}`);
    const podManifest = createEmojiPod();

    try {
        const res = await k8sApi.createNamespacedPod(namespace, podManifest);
        console.log(`[Emoji Worker] Pod created: ${res.body.metadata.name}`);
    } catch (err) {
        console.error(`[Emoji Worker] Error creating pod:`, err.body || err);
    }
}

// Start everything
async function main() {
    // Worker
    const worker = new Worker("emojiQueue", emojiChaosJob, {
        connection,
        concurrency: 5
    });

    worker.on("completed", job => {
        console.log(`[Emoji Worker] Job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
        console.error(`[Emoji Worker] Job ${job?.id} failed:`, err);
    });

    console.log("[Emoji Worker] Listening for emoji chaos jobs...");

    // Queue
    const queue = new Queue("emojiQueue", { connection });

    // Add a job immediately
    await queue.add("chaos", {});
    console.log("[Emoji Worker] Chaos job added");
}

if (require.main === module) {
    main().catch(err => {
        console.error("[Emoji Worker] Failed to start:", err);
        process.exit(1);
    });
}
