const { body } = require("express-validator");

const registrationValidation = [
  body("name")
    .exists()
    .withMessage("Name is required.")
    .bail()
    .isString()
    .withMessage("Name must be a string.")
    .bail()
    .notEmpty()
    .withMessage("Name is required."),
  body("email")
    .exists()
    .withMessage("Email is required.")
    .bail()
    .isString()
    .withMessage("Email must be a string.")
    .bail()
    .notEmpty()
    .withMessage("Email is required."),
  body("password")
    .exists()
    .withMessage("Password is required.")
    .bail()
    .isString()
    .withMessage("Password must be a string.")
    .bail()
    .notEmpty()
    .withMessage("Password is required."),
];

const loginValidation = [
  body("email")
    .exists()
    .withMessage("Email is required.")
    .bail()
    .isString()
    .withMessage("Email must be a string.")
    .bail()
    .notEmpty()
    .withMessage("Email is required."),
  body("password")
    .exists()
    .withMessage("Password is required.")
    .bail()
    .isString()
    .withMessage("Password must be a string.")
    .bail()
    .notEmpty()
    .withMessage("Password is required."),
  body("captchaId")
    .exists()
    .withMessage("Captcha ID is required.")
    .bail()
    .isString()
    .withMessage("Captcha ID must be a string.")
    .bail()
    .notEmpty()
    .withMessage("Captcha ID is required."),
  body("captchaAnswer")
    .custom(
      (value) =>
        value !== null &&
        ["string", "number", "boolean"].includes(typeof value),
    )
    .withMessage("Captcha answer is required."),
];

module.exports = {
  registrationValidation,
  loginValidation,
};
