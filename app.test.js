const request = require("supertest");
const express = require("express");
const app = require("./server");
const errorHandler = require("./middleware/errorHandler");
const responseEnvelope = require("./middleware/responseEnvelope");

const responseContractApp = express();
responseContractApp.use("/api", responseEnvelope);
responseContractApp.get("/api/paginated", (req, res) => {
  res.json({
    success: true,
    data: [{ id: "item-1" }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
});
responseContractApp.get("/api/failure", (req, res, next) => {
  next(new Error("sensitive database details"));
});
responseContractApp.get("/api/redirect", (req, res) => {
  res.redirect("https://example.com");
});
responseContractApp.use(errorHandler);

describe("GET /health", () => {
  test("returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
  });

  test("returns JSON content type", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["content-type"]).toMatch(/json/);
  });

  test("returns status ok in the body", async () => {
    const res = await request(app).get("/health");
    expect(res.body).toMatchObject({
      success: true,
      message: "Request completed successfully",
      data: { status: "healthy" },
      meta: null,
    });
  });
});

describe("Unknown routes", () => {
  test("returns 404 for a route that doesn't exist", async () => {
    const res = await request(app).get("/this-route-does-not-exist");
    expect(res.statusCode).toBe(404);
  });

  test("returns 404 for the wrong HTTP method", async () => {
    const res = await request(app).post("/health");
    expect(res.statusCode).toBe(404);
  });

  test("returns a standard error envelope for missing versioned routes", async () => {
    const res = await request(app).get("/api/v1/not-a-route");
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: "Route GET /api/v1/not-a-route not found.",
      data: null,
      meta: { errors: [] },
    });
  });
});

describe("Request body handling", () => {
  test("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send('{"bad json"');
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: "Invalid JSON request body.",
      data: null,
      meta: { errors: [] },
    });
  });
});

describe("API response contracts", () => {
  test.each(["/api/v1/urls/check-alias/api", "/api/urls/check-alias/api"])(
    "standardizes JSON success responses at %s",
    async (path) => {
      const res = await request(app).get(path);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: "Request completed successfully",
        data: { available: false },
        meta: null,
      });
    },
  );

  test("returns validation details in meta.errors", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeNull();
    expect(res.body.meta.errors).toHaveLength(3);
  });

  test("standardizes authentication failures under both API prefixes", async () => {
    for (const path of ["/api/v1/admin/activity", "/api/admin/activity"]) {
      const res = await request(app).get(path);
      expect(res.statusCode).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        message: "Authorization header is missing.",
        data: null,
        meta: { errors: [] },
      });
    }
  });

  test("moves pagination fields into meta without nesting the data payload", async () => {
    const res = await request(responseContractApp).get("/api/paginated");
    expect(res.body).toEqual({
      success: true,
      message: "Request completed successfully",
      data: [{ id: "item-1" }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  test("uses the centralized error envelope without exposing internal messages", async () => {
    const res = await request(responseContractApp).get("/api/failure");
    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      message: "An unexpected server error occurred.",
      data: null,
      meta: { errors: [] },
    });
    expect(JSON.stringify(res.body)).not.toContain(
      "sensitive database details",
    );
  });

  test("does not wrap redirects as JSON", async () => {
    const res = await request(responseContractApp).get("/api/redirect");
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("https://example.com");
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
  });
});
