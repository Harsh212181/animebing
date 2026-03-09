// middleware/botDetect.cjs
const botUserAgents = [
  'googlebot',
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'telegrambot',
  'discordbot',
  'whatsapp',
  'applebot',
  'bingbot',
  'yandexbot',
  'baiduspider',
  'duckduckbot'
];

function isBot(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return botUserAgents.some(bot => ua.includes(bot));
}

module.exports = isBot;