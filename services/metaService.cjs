// services/metaService.cjs - UPDATED with better fallbacks and seoDescription support
const Anime = require('../models/Anime.cjs');
const Episode = require('../models/Episode.cjs');

async function getAnimeMeta(slug) {
  try {
    const anime = await Anime.findOne({ slug }).lean();
    if (!anime) return null;
    
    // Build title with episode count / movie indicator
    let titleWithSuffix = anime.title;
    if (anime.contentType === 'Movie') {
      titleWithSuffix += ' (Movie)';
    } else if (anime.contentType === 'Manga') {
      titleWithSuffix += ' Manga';
    } else {
      const epCount = anime.currentEpisode || anime.totalEpisodes;
      if (epCount && epCount > 0) {
        titleWithSuffix += ` EP ${epCount}`;
      }
    }
    
    // ✅ Priority: seoDescription > description > synopsis > fallback
    let description = anime.seoDescription || anime.description || anime.synopsis;
    if (!description || description.trim() === '') {
      description = `Watch ${anime.title} online in HD quality. Free streaming and downloads.`;
    }
    
    // Image URL with fallback
    const imageUrl = anime.thumbnail || anime.coverImage || anime.posterImage || 'https://animebing.in/AnimeBinglogo.jpg';
    
    return {
      title: `${titleWithSuffix} | AnimeBing`,  // Added site suffix for consistency
      description: description,
      image: imageUrl,
      url: `https://animebing.in/detail/${slug}`,
      type: 'video.tv_show'
    };
  } catch (err) {
    console.error('❌ getAnimeMeta error:', err);
    return null;
  }
}

async function getEpisodeMeta(animeSlug, episodeNumber) {
  try {
    const anime = await Anime.findOne({ slug: animeSlug }).lean();
    if (!anime) return null;
    
    const episode = await Episode.findOne({ 
      animeId: anime._id, 
      number: episodeNumber 
    }).lean();
    
    if (!episode) return null;
    
    const imageUrl = episode.thumbnail || anime.thumbnail || anime.coverImage || anime.posterImage || 'https://animebing.in/AnimeBinglogo.jpg';
    
    const description = episode.description || `Watch ${anime.title} episode ${episode.number} online in HD.`;
    
    return {
      title: `${anime.title} – Episode ${episode.number} | AnimeBing`,
      description: description,
      image: imageUrl,
      url: `https://animebing.in/episode/${animeSlug}/${episodeNumber}`,
      type: 'video.episode'
    };
  } catch (err) {
    console.error('❌ getEpisodeMeta error:', err);
    return null;
  }
}

module.exports = { getAnimeMeta, getEpisodeMeta };