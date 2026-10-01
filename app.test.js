const request = require("supertest");
const app = require("./server");

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
    expect(res.body).toMatchObject({ status: "healthy" });
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
});

describe("Request body handling", () => {
  test("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/anything")
      .set("Content-Type", "application/json")
      .send('{"bad json"');
    expect(res.statusCode).toBe(400);
  });
});
