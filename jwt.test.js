const jwt = require("jsonwebtoken");
const {
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_SECRET,
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} = require("./config/jwt");

describe("JWT configuration", () => {
  test("uses separate secrets and configured token lifetimes", () => {
    expect(ACCESS_TOKEN_SECRET).toBe("test-access-secret");
    expect(REFRESH_TOKEN_SECRET).toBe("test-refresh-secret");
    expect(ACCESS_TOKEN_EXPIRES_IN).toBe("15m");
    expect(REFRESH_TOKEN_EXPIRES_IN).toBe("7d");
  });
});

describe("Access tokens", () => {
  test("creates and verifies an access token with the supplied claims", () => {
    const token = createAccessToken({
      id: "user-123",
      email: "user@example.com",
      role: "user",
    });

    expect(verifyAccessToken(token)).toMatchObject({
      id: "user-123",
      email: "user@example.com",
      role: "user",
      tokenType: "access",
    });
    expect(jwt.decode(token).exp - jwt.decode(token).iat).toBe(15 * 60);
  });

  test("rejects a refresh token", () => {
    const token = createRefreshToken({ id: "user-123" });

    expect(() => verifyAccessToken(token)).toThrow();
  });
});

describe("Refresh tokens", () => {
  test("creates and verifies a refresh token with the supplied claims", () => {
    const token = createRefreshToken({ id: "user-123" });

    expect(verifyRefreshToken(token)).toMatchObject({
      id: "user-123",
      tokenType: "refresh",
    });
    expect(jwt.decode(token).exp - jwt.decode(token).iat).toBe(7 * 24 * 60 * 60);
  });

  test("rejects access tokens and tokens signed with another secret", () => {
    const accessToken = createAccessToken({ id: "user-123" });
    const invalidToken = jwt.sign(
      { id: "user-123", tokenType: "refresh" },
      ACCESS_TOKEN_SECRET,
    );

    expect(() => verifyRefreshToken(accessToken)).toThrow();
    expect(() => verifyRefreshToken(invalidToken)).toThrow();
  });
});
