const DownloadSession = require('../models/DownloadSession.cjs');

module.exports = async function downloadAuth(req, res, next) {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const { id } = req.params; // download page ID (not anime ID – but we need animeId from that page)

    // We need to know which anime this download page belongs to.
    // You have a DownloadPage model. Let's assume it has an `animeId` field.
    const DownloadPage = require('../models/DownloadPage.cjs'); // adjust path
    const downloadPage = await DownloadPage.findById(id);
    if (!downloadPage) {
      return res.status(404).json({ error: 'Download page not found' });
    }
    const animeId = downloadPage.animeId;

    const session = await DownloadSession.findOne({
      ip,
      userAgent,
      animeId,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return res.status(403).json({ error: 'Access expired or invalid' });
    }

    // Attach session to request for optional later use
    req.downloadSession = session;
    next();
  } catch (error) {
    console.error('Download auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};