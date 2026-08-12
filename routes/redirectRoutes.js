const express = require("express");
const bcrypt = require("bcrypt");
const geoip = require("geoip-lite");
const Url = require("../models/Url");
const RedirectEvent = require("../models/RedirectEvent");
const ActivityLog = require("../models/ActivityLog");
const { getCache, setCache } = require("../utils/redisClient");

const router = express.Router();

function normalizeIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.connection.remoteAddress || "unknown";
}

function detectDevice(userAgent) {
    const ua = (userAgent || "").toLowerCase();
    if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
        return "mobile";
    }
    if (ua.includes("ipad") || ua.includes("tablet")) {
        return "tablet";
    }
    if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
        return "bot";
    }
    return "desktop";
}

router.get("/:slug", async (req, res) => {
    try {
        const slug = req.params.slug.toLowerCase();
        const cacheKey = `shorturl:${slug}`;
        let url = null;
        const cached = await getCache(cacheKey);

        if (cached) {
            url = JSON.parse(cached);
        } else {
            const doc = await Url.findOne({ slug });
            if (doc) {
                url = {
                    id: doc._id.toString(),
                    originalUrl: doc.originalUrl,
                    slug: doc.slug,
                    expiresAt: doc.expiresAt,
                    passwordProtected: Boolean(doc.passwordHash),
                };
                await setCache(cacheKey, JSON.stringify(url), 300);
            }
        }

        if (!url) {
            return res.status(404).json({ message: "Short URL not found." });
        }

        const now = new Date();
        if (url.expiresAt && new Date(url.expiresAt) <= now) {
            return res.status(410).json({ message: "This short URL has expired." });
        }

        if (url.passwordProtected) {
            const candidate = req.query.password || req.headers["x-url-password"];
            if (!candidate) {
                return res.status(401).json({ message: "Password is required to access this URL." });
            }

            const doc = await Url.findOne({ slug }).select("passwordHash");
            const valid = await bcrypt.compare(candidate.toString(), doc.passwordHash || "");
            if (!valid) {
                return res.status(403).json({ message: "Password does not match." });
            }
        }

        await Url.findByIdAndUpdate(url.id, { $inc: { clicks: 1 } });
        const ip = normalizeIp(req);
        const userAgent = req.get("User-Agent") || "";
        const geo = geoip.lookup(ip) || {};
        const location = {
            country: geo.country || "unknown",
            city: geo.city || "unknown",
        };

        await RedirectEvent.create({
            url: url.id,
            ip,
            userAgent,
            device: detectDevice(userAgent),
            browser: "unknown",
            os: "unknown",
            referer: req.get("Referer") || "",
            country: location.country,
            city: location.city,
            success: true,
        });

        await ActivityLog.create({
            type: "redirect",
            action: "resolve_url",
            metadata: { slug, ip, country: location.country, city: location.city },
        });

        res.redirect(url.originalUrl);
    } catch (error) {
        res.status(500).json({ message: "Unable to redirect short URL.", error: error.message });
    }
});

module.exports = router;
