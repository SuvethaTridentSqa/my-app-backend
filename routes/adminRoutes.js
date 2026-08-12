const express = require("express");
const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");
const Url = require("../models/Url");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/activity", async (req, res) => {
  try {
    const activity = await ActivityLog.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(250);

    res.json(activity);
  } catch (error) {
    res.status(500).json({
      message: "Unable to load activity log.",
      error: error.message,
    });
  }
});

router.get("/users", async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role createdAt lastLogin")
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to load user list.", error: error.message });
  }
});

router.get("/usage", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalUrls = await Url.countDocuments();
    const topUrls = await Url.find()
      .sort({ clicks: -1 })
      .limit(10)
      .select("slug originalUrl clicks owner createdAt");
    const recentActivity = await ActivityLog.find()
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ totalUsers, totalUrls, topUrls, recentActivity });
  } catch (error) {
    res.status(500).json({
      message: "Unable to load admin usage metrics.",
      error: error.message,
    });
  }
});

router.get("/history", async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(500);
    res.json(logs);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to load usage history.", error: error.message });
  }
});

router.get("/features", async (req, res) => {
  try {
    const features = await ActivityLog.aggregate([
      { $group: { _id: "$action", total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    res.json({ features });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to load feature usage.", error: error.message });
  }
});

// router.post("/api/visualize-links", async (req, res) => {
//   const { targetUrl } = req.body;

//   try {
//     const response = await axios.get(targetUrl);
//     const $ = cheerio.load(response.data);

//     const links = [];
//     $("a").each((index, element) => {
//       const link = $(element).attr("href");
//       if (link && link.startsWith("http")) {
//         links.push({ source: targetUrl, target: link });
//       }
//     });

//     // Send data structured for graph visualization libraries
//     res.json({ connections: links });
//   } catch (error) {
//     res.status(500).json({ error: "Failed to crawl URL" });
//   }
// });

module.exports = router;
