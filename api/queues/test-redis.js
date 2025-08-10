// bullmq-debug.js
import { Queue, Worker } from "bullmq";

// Local Redis in Docker
const connection = {
    host: "127.0.0.1",
    port: 6379
};

// Queue setup
const debugQueue = new Queue("debugQueue", {
    connection,
    defaultJobOptions: {
        removeOnComplete: false, // keep completed jobs in Redis
        removeOnFail: false
    }
});

// Worker setup
const worker = new Worker(
    "debugQueue",
    async job => {
        console.log(`Processing job ${job.id} with data:`, job.data);
        return { result: "Job completed!" };
    },
    { connection }
);

worker.on("completed", job => {
    console.log(`✅ Job ${job.id} completed and kept in Redis.`);
    console.log(`Check Redis key: bull:debugQueue:${job.id}`);
    console.log("You can also check bull:debugQueue:completed sorted set.");
});

worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err);
});

// Add a test job
(async () => {
    const job = await debugQueue.add("myDebugJob", {
        hello: "world",
        timestamp: new Date().toISOString()
    });

    console.log(`📌 Job ${job.id} added to queue.`);
    console.log("Check Redis key: bull:debugQueue:wait (before it's processed).");
})();
