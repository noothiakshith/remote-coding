import express from "express";
import { verifyauth } from "../middlewares/middleware.js";
import { PrismaClient, SubmissionStatus } from "@prisma/client";
import { submissionQueue, cleanerQueue } from "../queues/queues.js";

const router = express.Router();
const prisma = new PrismaClient();

router.get('/submissions/problem/:problemId', verifyauth, async (req, res) => {
    const { problemId } = req.params;
    const userId = req.userId;

    try {
        const submissions = await prisma.submission.findMany({
            where: {
                problemId: problemId,
                userId: userId,
            },
            include: {
                language: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return res.status(200).json(submissions);
    } catch (err) {
        console.error("Error fetching submissions:", err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post('/submission/problem/:problemId', verifyauth, async (req, res) => {
    const { problemId } = req.params;
    const userId = req.userId;
    const { code, language_id } = req.body;

    if (!code || language_id === undefined) {
        return res.status(400).json({ error: "Request body must contain 'code' and 'language_id'." });
    }

    try {
        const newSubmission = await prisma.submission.create({
            data: {
                source_code: code,
                problem: { connect: { id: problemId } },
                user: { connect: { id: userId } },
                language: { connect: { id: parseInt(language_id) } },
            }
        });

        await submissionQueue.add("submissionQueue", {
            submissionId: newSubmission.id,
        });

        return res.status(201).json(newSubmission);
    } catch (err) {
        console.error("Error creating submission:", err);
        return res.status(500).json({ error: "Failed to create submission. Ensure all IDs are valid." });
    }
});

router.patch('/submission/:submissionId', async (req, res) => {
    const { submissionId } = req.params;
    const { testCasesPassed, stdout, status, runtime, memoryUsage, errorMessage } = req.body;

    if (!Object.values(SubmissionStatus).includes(status)) {
        return res.status(400).json({ error: "Invalid status value provided." });
    }
    
    try {
        const updatedSubmission = await prisma.submission.update({
            where: { id: submissionId },
            data: {
                testCasesPassed,
                stdout,
                status,
                runtime,
                memoryUsage,
                errorMessage
            }
        });
        
        if (status === SubmissionStatus.Successful || status === SubmissionStatus.Error) {
            await cleanerQueue.add(
                "delete-submission-pod",
                { podName: submissionId },
                {
                    delay: 5000,         
                    attempts: 3,       
                    backoff: { type: "exponential", delay: 2000 },
                    removeOnComplete: false, 
                    removeOnFail: false
                }
            );
        }
        
        return res.status(200).json(updatedSubmission);
    } catch (err) {
        console.error(`Error updating submission ${submissionId}:`, err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
