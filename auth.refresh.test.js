const mockRefreshSessions = [];
let mockNextId = 0;

jest.mock("./models/RefreshSession", () => {
  function matches(row, query) {
    return Object.entries(query).every(([key, expected]) => {
      const actual = row[key];
      if (
        expected &&
        typeof expected === "object" &&
        !(expected instanceof Date)
      ) {
        if (expected.$gt) {
          return actual > expected.$gt;
        }
        if (expected.$in) {
          return expected.$in.includes(actual);
        }
      }
      return String(actual) === String(expected);
    });
  }

  return class MockRefreshSession {
    static async create(data) {
      const row = { ...data, _id: String(++mockNextId) };
      mockRefreshSessions.push(row);
      return row;
    }

    static async findOne(query) {
      return mockRefreshSessions.find((row) => matches(row, query)) || null;
    }

    static async findOneAndUpdate(query, update) {
      const row = mockRefreshSessions.find((item) => matches(item, query));
      if (!row) {
        return null;
      }
      Object.assign(row, update.$set);
      return row;
    }

    static async updateOne(query, update) {
      const row = mockRefreshSessions.find((item) => matches(item, query));
      if (!row) {
        return { matchedCount: 0 };
      }
      Object.assign(row, update.$set);
      return { matchedCount: 1 };
    }

    static async updateMany(query, update) {
      const rows = mockRefreshSessions.filter((item) => matches(item, query));
      rows.forEach((row) => Object.assign(row, update.$set));
      return { modifiedCount: rows.length };
    }

    static async deleteOne(query) {
      const index = mockRefreshSessions.findIndex((row) => matches(row, query));
      if (index >= 0) {
        mockRefreshSessions.splice(index, 1);
      }
      return { deletedCount: index >= 0 ? 1 : 0 };
    }

    static reset() {
      mockRefreshSessions.splice(0, mockRefreshSessions.length);
      mockNextId = 0;
    }

    static rows() {
      return mockRefreshSessions;
    }
  };
});

jest.mock("./models/ActivityLog", () => ({
  create: jest.fn().mockResolvedValue({}),
}));

jest.mock("./models/User", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("bcrypt", () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock("./utils/captcha", () => ({
  generateCaptcha: jest.fn(),
  verifyCaptcha: jest.fn().mockReturnValue(true),
}));

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const User = require("./models/User");
const RefreshSession = require("./models/RefreshSession");
const router = require("./routes/authRoutes");
const {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  createAccessToken,
  createRefreshToken,
  verifyAccessToken,
} = require("./config/jwt");
const { authenticate, authorize } = require("./middleware/auth");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", router);
app.get("/api/protected", authenticate, (req, res) => {
  res.json({ userId: req.user.id, role: req.user.role });
});
app.get("/api/admin/protected", authenticate, authorize("admin"), (req, res) => {
  res.json({ userId: req.user.id, role: req.user.role });
});

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createStoredRefreshToken({
  sessionId = "session-1",
  userId = "user-1",
  expiresIn,
} = {}) {
  const payload = {
    id: userId,
    email: "user@example.com",
    role: "user",
    sid: sessionId,
    jti: crypto.randomUUID(),
  };
  let token;
  if (expiresIn) {
    token = jwt.sign(
      { ...payload, tokenType: "refresh" },
      REFRESH_TOKEN_SECRET,
      { expiresIn },
    );
  } else {
    token = createRefreshToken(payload);
  }
  const decoded = jwt.decode(token);
  await RefreshSession.create({
    user: userId,
    sessionId,
    tokenHash: tokenHash(token),
    status: "active",
    expiresAt: new Date(decoded.exp * 1000),
    purgeAt: new Date(decoded.exp * 1000 + 30 * 24 * 60 * 60 * 1000),
  });
  return token;
}

function cookieFor(token) {
  return `refreshToken=${encodeURIComponent(token)}`;
}

function getCookie(response, name) {
  const header = response.headers["set-cookie"].find((value) =>
    value.startsWith(`${name}=`),
  );
  return decodeURIComponent(header.split(";")[0].slice(name.length + 1));
}

beforeEach(() => {
  RefreshSession.reset();
  jest.clearAllMocks();
  bcrypt.compare.mockResolvedValue(true);
});

describe("Login refresh-session issuance", () => {
  test("sets a secure refresh cookie and stores only its hash", async () => {
    const user = {
      _id: "user-1",
      email: "user@example.com",
      name: "Example User",
      role: "user",
      password: "hashed-password",
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "password",
      captchaId: "captcha-id",
      captchaAnswer: 1,
    });

    expect(response.status).toBe(200);
    expect(verifyAccessToken(response.body.token)).toMatchObject({
      id: user._id,
      email: user.email,
      role: user.role,
      tokenType: "access",
    });
    expect(RefreshSession.rows()).toHaveLength(1);
    expect(RefreshSession.rows()[0]).toMatchObject({
      user: user._id,
      status: "active",
    });
    expect(RefreshSession.rows()[0].purgeAt.getTime()).toBeGreaterThan(
      RefreshSession.rows()[0].expiresAt.getTime(),
    );
    expect(RefreshSession.rows()[0].tokenHash).not.toBe(
      getCookie(response, "refreshToken"),
    );

    const refreshCookieHeader = response.headers["set-cookie"].find((value) =>
      value.startsWith("refreshToken="),
    );
    expect(refreshCookieHeader).toMatch(/HttpOnly/i);
    expect(refreshCookieHeader).toMatch(/SameSite=Strict/i);
    expect(refreshCookieHeader).toMatch(/Path=\/api\/auth/i);
    expect(refreshCookieHeader).toMatch(/Max-Age=60479[0-9]/i);
    expect(response.body.token).not.toBe(getCookie(response, "refreshToken"));
  });

  test("rejects invalid credentials without issuing tokens or a session", async () => {
    const user = {
      _id: "user-1",
      email: "user@example.com",
      password: "hashed-password",
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });
    bcrypt.compare.mockResolvedValue(false);

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "wrong-password",
      captchaId: "captcha-id",
      captchaAnswer: 1,
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid credentials.");
    expect(RefreshSession.rows()).toHaveLength(0);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("uses the stored role instead of a client-selected role", async () => {
    const user = {
      _id: "user-1",
      email: "user@example.com",
      name: "Example User",
      role: "user",
      password: "hashed-password",
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const response = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "password",
      role: "admin",
      captchaId: "captcha-id",
      captchaAnswer: 1,
    });

    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe("user");
    expect(verifyAccessToken(response.body.token).role).toBe("user");
  });

  test("restricts admin login to admin accounts", async () => {
    const admin = {
      _id: "admin-1",
      email: "admin@example.com",
      name: "Example Admin",
      role: "admin",
      password: "hashed-password",
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(admin),
    });

    const response = await request(app).post("/api/auth/admin/login").send({
      email: admin.email,
      password: "password",
      captchaId: "captcha-id",
      captchaAnswer: 1,
    });

    expect(User.findOne).toHaveBeenCalledWith({
      email: admin.email,
      role: "admin",
    });
    expect(response.status).toBe(200);
    expect(response.body.admin).toMatchObject({
      id: admin._id,
      role: "admin",
      email: admin.email,
    });
    expect(verifyAccessToken(response.body.token).role).toBe("admin");
    expect(RefreshSession.rows()).toHaveLength(1);
  });

  test("rejects user credentials on the admin login endpoint", async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    const response = await request(app).post("/api/auth/admin/login").send({
      email: "user@example.com",
      password: "password",
      captchaId: "captcha-id",
      captchaAnswer: 1,
    });

    expect(User.findOne).toHaveBeenCalledWith({
      email: "user@example.com",
      role: "admin",
    });
    expect(response.status).toBe(401);
    expect(RefreshSession.rows()).toHaveLength(0);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("marks cookies secure in production", async () => {
    const user = {
      _id: "user-1",
      email: "user@example.com",
      name: "Example User",
      role: "user",
      password: "hashed-password",
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(user),
    });

    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    let response;
    try {
      response = await request(app).post("/api/auth/login").send({
        email: user.email,
        password: "password",
        captchaId: "captcha-id",
        captchaAnswer: 1,
      });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^session=.*;.*HttpOnly;.*Secure/i),
        expect.stringMatching(/^refreshToken=.*;.*HttpOnly;.*Secure/i),
      ]),
    );
  });
});

describe("Protected API authentication and authorization", () => {
  test("rejects unauthenticated requests to admin APIs", async () => {
    const response = await request(app).get("/api/admin/protected");

    expect(response.status).toBe(401);
  });

  test("authenticates access tokens and returns the authenticated identity", async () => {
    const accessToken = createAccessToken({
      id: "user-1",
      role: "user",
    });

    const response = await request(app)
      .get("/api/protected")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: "user-1", role: "user" });
  });

  test("rejects expired access tokens with 401", async () => {
    const expiredAccessToken = jwt.sign(
      { id: "user-1", role: "user", tokenType: "access" },
      ACCESS_TOKEN_SECRET,
      { expiresIn: -1 },
    );

    const response = await request(app)
      .get("/api/protected")
      .set("Authorization", `Bearer ${expiredAccessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication token has expired.");
  });

  test("returns 403 when an authenticated user lacks the required role", async () => {
    const accessToken = createAccessToken({
      id: "user-1",
      role: "user",
    });

    const response = await request(app)
      .get("/api/admin/protected")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe("FORBIDDEN");
  });
});

describe("POST /api/auth/refresh", () => {
  test("requires a refresh cookie, not an access token", async () => {
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Authorization", "Bearer some-access-token");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("MISSING_AUTH");
  });

  test("rotates a valid refresh token and stores only hashes", async () => {
    const oldToken = await createStoredRefreshToken();
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(oldToken))
      .set("Authorization", "Bearer invalid-access-token");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(verifyAccessToken(response.body.token)).toMatchObject({
      id: "user-1",
      role: "user",
      tokenType: "access",
    });

    const rows = RefreshSession.rows();
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("rotated");
    expect(rows[0].tokenHash).toBe(tokenHash(oldToken));
    expect(rows[0].tokenHash).not.toBe(oldToken);
    expect(rows[1].status).toBe("active");
    expect(rows[1].tokenHash).toBe(tokenHash(getCookie(response, "refreshToken")));
    expect(rows[1].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(rows[1].purgeAt.getTime()).toBeGreaterThan(
      rows[1].expiresAt.getTime(),
    );

    const refreshCookieHeader = response.headers["set-cookie"].find((value) =>
      value.startsWith("refreshToken="),
    );
    expect(refreshCookieHeader).toMatch(/HttpOnly/i);
    expect(refreshCookieHeader).toMatch(/SameSite=Strict/i);
    expect(refreshCookieHeader).toMatch(/Path=\/api\/auth/i);
  });

  test("rejects reuse and revokes the active token in that session", async () => {
    const oldToken = await createStoredRefreshToken();
    const firstRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(oldToken));
    const currentToken = getCookie(firstRefresh, "refreshToken");

    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(oldToken));
    const successorAttempt = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(currentToken));

    expect(replay.status).toBe(401);
    expect(successorAttempt.status).toBe(401);
    expect(
      RefreshSession.rows().filter((row) => row.status === "active"),
    ).toHaveLength(0);
  });

  test("rejects expired refresh tokens and marks their session revoked", async () => {
    const expiredToken = await createStoredRefreshToken({ expiresIn: -1 });
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(expiredToken));

    expect(response.status).toBe(401);
    expect(RefreshSession.rows()[0].status).toBe("revoked");
  });

  test("rejects a session record that has expired even if its JWT is valid", async () => {
    const token = await createStoredRefreshToken();
    RefreshSession.rows()[0].expiresAt = new Date(Date.now() - 1000);

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(token));

    expect(response.status).toBe(401);
    expect(RefreshSession.rows()[0].status).toBe("revoked");
  });

  test("rejects invalid and unrecognized refresh tokens", async () => {
    const invalidToken = jwt.sign(
      { id: "user-1", sid: "session-1", tokenType: "refresh" },
      ACCESS_TOKEN_SECRET,
    );
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(invalidToken));

    expect(response.status).toBe(401);
    expect(RefreshSession.rows()).toHaveLength(0);
  });

  test("rejects refresh claims that do not match the stored session", async () => {
    const token = await createStoredRefreshToken({ sessionId: "session-a" });
    const row = RefreshSession.rows()[0];
    row.sessionId = "session-b";

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(token));

    expect(response.status).toBe(401);
    expect(row.status).toBe("revoked");
  });

  test("rejects a validly signed refresh token without a server-side session", async () => {
    const token = createRefreshToken({
      id: "user-1",
      sid: "unknown-session",
      jti: crypto.randomUUID(),
    });
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(token));

    expect(response.status).toBe(401);
    expect(RefreshSession.rows()).toHaveLength(0);
  });

  test("replay detection only revokes the affected session family", async () => {
    const firstSessionToken = await createStoredRefreshToken({
      sessionId: "session-one",
      userId: "user-1",
    });
    const secondSessionToken = await createStoredRefreshToken({
      sessionId: "session-two",
      userId: "user-2",
    });
    await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(firstSessionToken));

    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(firstSessionToken));
    const secondSessionRefresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(secondSessionToken));

    expect(replay.status).toBe(401);
    expect(secondSessionRefresh.status).toBe(200);
    expect(
      RefreshSession.rows().filter(
        (row) => row.sessionId === "session-two" && row.status === "active",
      ),
    ).toHaveLength(1);
  });
});

describe("POST /api/auth/logout", () => {
  test("revokes the refresh session and clears authentication cookies without access auth", async () => {
    const refreshToken = await createStoredRefreshToken();
    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookieFor(refreshToken));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Logged out successfully.");
    expect(RefreshSession.rows()[0].status).toBe("revoked");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^session=;/),
        expect.stringMatching(/^refreshToken=;/),
      ]),
    );

    const refreshAttempt = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(refreshToken));
    expect(refreshAttempt.status).toBe(401);
  });

  test("is idempotent when no refresh token is supplied", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Logged out successfully.");
  });

  test("logout with a rotated token revokes the complete refresh session", async () => {
    const firstToken = await createStoredRefreshToken();
    const firstResponse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(firstToken));
    const rotatedToken = getCookie(firstResponse, "refreshToken");

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookieFor(firstToken));
    const refreshAttempt = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookieFor(rotatedToken));

    expect(logout.status).toBe(200);
    expect(RefreshSession.rows().every((row) => row.status !== "active")).toBe(
      true,
    );
    expect(refreshAttempt.status).toBe(401);
  });
});
