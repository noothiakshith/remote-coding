import express from "express";
import { PrismaClient } from "@prisma/client";
import * as z from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, 'Kindly enter minimum 6 characters')
});

router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten()
        });
    }

    const { email, password } = parsed.data;

    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT,
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            message: "Login successful",
            token
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

export default router;
