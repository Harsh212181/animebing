 // services/metaService.cjs
const Anime = require('../models/Anime.cjs');
const Episode = require('../models/Episode.cjs');

async function getAnimeMeta(slug) {
  const anime = await Anime.findOne({ slug }).lean();
  if (!anime) return null;
  
  // ✅ Build title with episode count / movie indicator
  let titleWithSuffix = anime.title;
  if (anime.contentType === 'Movie') {
    titleWithSuffix += ' (Movie)';
  } else if (anime.contentType === 'Manga') {
    titleWithSuffix += ' Manga';
  } else {
    // TV Series / Anime
    const epCount = anime.currentEpisode || anime.totalEpisodes;
    if (epCount) {
      titleWithSuffix += ` EP ${epCount}`;
    }
  }
  
  const imageUrl = anime.thumbnail || anime.coverImage || anime.posterImage || null;
  
  return {
    title: titleWithSuffix,  // ✅ अब EP count के साथ
    description: anime.description || anime.synopsis || `Watch ${anime.title} online`,
    image: imageUrl,
    url: `https://animebing.in/detail/${slug}`,
    type: 'video.tv_show'
  };
}

async function getEpisodeMeta(animeSlug, episodeNumber) {
  const anime = await Anime.findOne({ slug: animeSlug }).lean();
  if (!anime) return null;
  const episode = await Episode.findOne({ animeId: anime._id, number: episodeNumber }).lean();
  if (!episode) return null;
  
  const imageUrl = episode.thumbnail || anime.thumbnail || anime.coverImage || anime.posterImage || null;
  
  // ✅ Episode page ke liye title mein episode number already hai
  return {
    title: `${anime.title} – Episode ${episode.number}`,
    description: episode.description || `Watch ${anime.title} episode ${episode.number} online`,
    image: imageUrl,
    url: `https://animebing.in/episode/${animeSlug}/${episodeNumber}`,
    type: 'video.episode'
  };
}

module.exports = { getAnimeMeta, getEpisodeMeta };