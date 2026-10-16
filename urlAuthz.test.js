jest.mock("./models/Url", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("./models/RedirectEvent", () => ({
  find: jest.fn(),
}));

jest.mock("./models/ActivityLog", () => ({
  create: jest.fn(),
}));

jest.mock("./utils/redisClient", () => ({
  getCache: jest.fn(),
  setCache: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const Url = require("./models/Url");
const RedirectEvent = require("./models/RedirectEvent");
const { createAccessToken } = require("./config/jwt");
const urlRoutes = require("./routes/urlRoutes");

const app = express();
app.use("/api/urls", urlRoutes);

describe("URL analytics resource authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Url.find.mockResolvedValue([]);
    Url.findOne.mockResolvedValue({
      _id: "url-1",
      slug: "short",
      originalUrl: "https://example.com",
      owner: { toString: () => "owner-1" },
    });
    RedirectEvent.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([]),
    });
  });

  test("denies users access to another owner's URL analytics", async () => {
    const accessToken = createAccessToken({
      id: "user-1",
      role: "user",
    });

    const response = await request(app)
      .get("/api/urls/short/analytics")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to view analytics for this URL.",
    );
    expect(RedirectEvent.find).not.toHaveBeenCalled();
  });

  test("allows the URL owner and administrators to view analytics", async () => {
    Url.findOne.mockResolvedValue({
      _id: "url-1",
      slug: "short",
      originalUrl: "https://example.com",
      owner: { toString: () => "owner-1" },
    });

    const ownerResponse = await request(app)
      .get("/api/urls/short/analytics")
      .set(
        "Authorization",
        `Bearer ${createAccessToken({ id: "owner-1", role: "user" })}`,
      );
    const adminResponse = await request(app)
      .get("/api/urls/short/analytics")
      .set(
        "Authorization",
        `Bearer ${createAccessToken({ id: "admin-1", role: "admin" })}`,
      );

    expect(ownerResponse.status).toBe(200);
    expect(adminResponse.status).toBe(200);
  });
});
