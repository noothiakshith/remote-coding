import { Worker } from "bullmq";
import k8s from "@kubernetes/client-node";
import dotenv from "dotenv";
dotenv.config();

const submissionQueueName = "submissionQueue";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const namespace = "default";

new Worker(submissionQueueName, async (job) => {
    console.log(`Processing job: ${job.id}`, job.data);

    const { submissionId } = job.data;

    const podManifest = {
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
            name: `submission-${submissionId.toLowerCase()}`,
            labels: { app: "submission-runner" }
        },
        spec: {
            ttlSecondsAfterFinished: 30, 
            containers: [
                {
                    name: "runner",
                    image: "alpine:3.19",
                    command: ["sh", "-c", "echo Hello from submission worker && sleep 30"]
                }
            ],
            restartPolicy: "Never"
        }
    };

    try {
        const res = await k8sApi.createNamespacedPod(namespace, podManifest);
        console.log(`Pod created: ${res.body.metadata?.name}`);
    } catch (err) {
        console.error("Error creating pod:", err);
    }
}, {
    connection: {
        host:'localhost',
        port:6379
    }
});
