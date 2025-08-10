import express from "express";
import cors from "cors";

import authroutes from "./routes/authroutes.js";
import Userroutes from "./routes/userroutes.js";

const app = express();

// Middleware
app.use(cors()); // call the function here
app.use(express.json());

// Routes
app.get("/", (req, res) => {
    res.send("Hello World");
});

app.use(authroutes);
app.use(Userroutes);

// Server
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
