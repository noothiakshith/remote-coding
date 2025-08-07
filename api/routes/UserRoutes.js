import express from "express";
import { PrismaClient } from "@prisma/client";
import * as z from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();
const prisma = new PrismaClient();

// Zod schemas
const loginSchema = z.object({
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(6, 'Password must be at least 6 characters').trim()
});

const registrationSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').trim(),
    email: z.string().email().trim().toLowerCase(),
    password: z.string().min(6, 'Password must be at least 6 characters').trim()
});

// Login Route
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
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: "Incorrect password" });
        }

        if (!process.env.JWT) {
            throw new Error("JWT secret is not defined in environment variables");
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT,
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

// Register Route
router.post('/register', async (req, res) => {
    const parsed = registrationSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            message: "Validation failed",
            errors: parsed.error.flatten()
        });
    }

    const { username, email, password } = parsed.data;

    try {
        const checkEmail = await prisma.user.findUnique({ where: { email } });
        const checkUsername = await prisma.user.findUnique({ where: { username } });

        if (checkEmail) {
            return res.status(409).json({ message: "Email already in use" });
        }

        if (checkUsername) {
            return res.status(409).json({ message: "Username already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword
            }
        });

        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: newUser.id,
                email: newUser.email,
                username: newUser.username
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
});

export default router;
