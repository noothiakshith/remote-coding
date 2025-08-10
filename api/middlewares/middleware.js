// middlewares/middleware.js
import jwt from "jsonwebtoken";

const JWT_SECRET = "supersecretkey123"; 

export const verifyauth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId; // attach to request
        next();
    } catch (err) {
        console.error("Invalid token:", err.message);
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};
