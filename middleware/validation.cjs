// middleware/validation.cjs - YEH NAYI FILE BANAYEIN
const validateAnime = (req, res, next) => {
  const { title, thumbnail, releaseYear } = req.body;
  
  const errors = [];
  
  if (!title || title.trim().length < 2) {
    errors.push('Title must be at least 2 characters long');
  }
  
  if (thumbnail && !isValidUrl(thumbnail)) {
    errors.push('Thumbnail must be a valid URL');
  }
  
  if (releaseYear && (releaseYear < 1900 || releaseYear > new Date().getFullYear() + 5)) {
    errors.push('Release year must be realistic');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      success: false,
      errors 
    });
  }
  
  next();
};

const validateEpisode = (req, res, next) => {
  const { animeId, episodeNumber, cutyLink } = req.body;
  
  const errors = [];
  
  if (!animeId) {
    errors.push('Anime ID is required');
  }
  
  if (!episodeNumber || episodeNumber < 1) {
    errors.push('Valid episode number is required');
  }
  
  if (cutyLink && !isValidUrl(cutyLink)) {
    errors.push('Cuty link must be a valid URL');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ 
      success: false,
      errors 
    });
  }
  
  next();
};

const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

module.exports = {
  validateAnime,
  validateEpisode
};