import { Queue } from "bullmq";
import { createClient } from "redis";

// Redis connection details
const connection = {
    username: process.env.USER_NAME || "",
    password: process.env.PASSWORD || "",
    host: process.env.HOST || "",
    port: Number(process.env.PORT) || 6379
};

// Node-redis client (you can use this for caching, pub/sub, etc.)
export const redisurl = createClient({
    url: `redis://${connection.username}:${connection.password}@${connection.host}:${connection.port}`
});

await redisurl.connect();

// BullMQ queues (BullMQ creates its own internal ioredis connections)
export const submissionqueue = new Queue("submissionqueue", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        }
    }
});

export const deletionqueue = new Queue("deletionqueue", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        }
    }
});
