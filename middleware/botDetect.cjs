 // middleware/botDetect.cjs

const botUserAgents = [
  'googlebot',
  'bingbot',
  'yandexbot',
  'baiduspider',
  'duckduckbot',

  'facebookexternalhit',
  'facebot',

  'twitterbot',

  'linkedinbot',

  'telegrambot',

  'whatsapp',

  'discordbot',

  'slackbot',

  'applebot',

  'embedly',
  'pinterest',
  'vkshare',
  'quora link preview'
];

function isBot(userAgent = '') {
  const ua = userAgent.toLowerCase();
  return botUserAgents.some(bot => ua.includes(bot));
}

module.exports = isBot;