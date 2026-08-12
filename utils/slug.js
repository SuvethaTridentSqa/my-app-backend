function generateSlug(length = 7) {
    const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function isSlugValid(slug) {
    return /^[a-zA-Z0-9_-]{3,64}$/.test(slug);
}

module.exports = { generateSlug, isSlugValid };
