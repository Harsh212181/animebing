// middleware/botDetect.cjs
// ✅ Enhanced bot detection for SEO (Googlebot, Bingbot, social media crawlers, etc.)

const BOT_USER_AGENTS = [
  // Search engines
  'googlebot',
  'bingbot',
  'slurp',           // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'pinterest',
  'telegrambot',
  'discordbot',
  'whatsapp',
  'slackbot',
  'applebot',
  'rogerbot',        // Moz
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'pinterest/0.',
  'developers.google.com',
  'bot',
  'crawl',
  'spider',
  'scraper',
  'curl',
  'wget',
  'python-requests',
  'go-http-client',
  'php',
  'java',
  'perl',
  'ruby',
  'node-fetch',
  'okhttp',
  'axios',
  'http',
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

module.exports = isBot;