
const express = require("express");
const User = require("../models/User");
const { authenticate, authorize } = require("../middleware/auth");
const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required." });
        }

        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: "user",
        });
        user.password = undefined;

        res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
    } catch (error) {
        res.status(500).json({ message: "Failed to create user.", error: error.message });
    }
});

router.get("/", authenticate, authorize("admin"), async (req, res) => {
    try {
        const users = await User.find().select("name email role createdAt lastLogin");
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch users.", error: error.message });
    }
});

module.exports = router;