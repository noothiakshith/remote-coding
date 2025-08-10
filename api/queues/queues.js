import { Queue } from "bullmq";
import { createClient } from "redis";

// Redis connection config
const redisConfig = {
    username: process.env.USER_NAME || "",
    password: process.env.PASSWORD || "",
    host: process.env.HOST || "localhost",
    port: Number(process.env.PORT) || 6379
};


export const redisurl = createClient({
    url: `redis://${redisConfig.username}:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`
});

await redisurl.connect();

export const submissionQueue = new Queue("submissionQueue", {
    connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        username: redisConfig.username,
        password: redisConfig.password
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        }
    }
});

export const cleanerQueue = new Queue("cleanerQueue", {
    connection: {
        host: redisConfig.host,
        port: redisConfig.port,
        username: redisConfig.username,
        password: redisConfig.password
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000
        }
    }
});
