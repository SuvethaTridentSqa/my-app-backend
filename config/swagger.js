const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "Your API",
      version: "1.0.0",
      description: "API documentation",
    },

    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },

      schemas: {
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            code: {
              type: "string",
              example: "VALIDATION_ERROR",
            },
            message: {
              type: "string",
              example: "Request validation failed.",
            },
          },
        },
      },
    },
  },

  apis: ["./routes/*.js"],
};

module.exports = swaggerJsdoc(options);
