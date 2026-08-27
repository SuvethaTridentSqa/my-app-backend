const crypto = require("crypto");
const captchaStore = new Map();
const TTL = 5 * 60 * 1000;
function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const operator = ["+", "-", "*"][Math.floor(Math.random() * 3)];
  const expression = `${a} ${operator} ${b}`;
  let answer;
  switch (operator) {
    case "+":
      answer = a + b;
      break;
    case "-":
      answer = a - b;
      break;
    case "*":
      answer = a * b;
      break;
  }
  const id = crypto.randomUUID();
  captchaStore.set(id, answer);
  setTimeout(() => {
    captchaStore.delete(id);
  }, TTL);
  return {
    id,
    expression,
    expiresAt: new Date(Date.now() + TTL),
  };
}

function verifyCaptcha(id, answer) {
  if (!id || answer == null) {
    return false;
  }
  const expected = captchaStore.get(id);
  if (expected == null) {
    return false;
  }
  captchaStore.delete(id);
  return Number(answer) === expected;
}

module.exports = {
  generateCaptcha,
  verifyCaptcha,
};
