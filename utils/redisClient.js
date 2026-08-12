require("dotenv").config();
const { createClient } = require("redis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const useRedis = `${process.env.DISABLE_REDIS || ""}`.toLowerCase() !== "true";
let client = null;
const isConnected = { value: false };
const inMemoryCache = new Map();

function getMemoryEntry(key) {
    const entry = inMemoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        inMemoryCache.delete(key);
        return null;
    }
    return entry.value;
}

function setMemoryEntry(key, value, ttlSeconds) {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    inMemoryCache.set(key, { value, expiresAt });
}

if (useRedis) {
    client = createClient({ url: redisUrl, socket: { reconnectStrategy: false } });
    client.on("error", (err) => {
        console.error("Redis error:", err.message);
    });

    client.on("connect", () => {
        isConnected.value = true;
        console.log("Redis connected");
    });

    client.connect().catch((error) => {
        console.error("Redis connection failed:", error.message);
    });
} else {
    console.log("Redis disabled via DISABLE_REDIS=true. Using in-memory cache fallback.");
}

async function getCache(key) {
    if (useRedis && isConnected.value) {
        try {
            return await client.get(key);
        } catch (error) {
            console.error("Redis get failed:", error.message);
        }
    }
    return getMemoryEntry(key);
}

async function setCache(key, value, ttlSeconds = 300) {
    if (useRedis && isConnected.value) {
        try {
            await client.set(key, value, { EX: ttlSeconds });
            return;
        } catch (error) {
            console.error("Redis set failed:", error.message);
        }
    }
    setMemoryEntry(key, value, ttlSeconds);
}

module.exports = { getCache, setCache, redisClient: client };

