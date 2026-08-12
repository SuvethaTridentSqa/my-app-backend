const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const User = require("../models/User");

const users = [
    { name: "User One", email: "user@example.com", password: "UserPass123", role: "user" },
    { name: "Admin User", email: "admin@example.com", password: "AdminPass123", role: "admin" },
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    for (const item of users) {
        const existing = await User.findOne({ email: item.email });
        if (!existing) {
            const user = new User(item);
            await user.save();
            console.log(`Seeded user: ${item.email}`);
        } else {
            console.log(`Skipping existing user: ${item.email}`);
        }
    }
    await mongoose.disconnect();
}

seed().catch((error) => {
    console.error(error);
    process.exit(1);
});