 // ANIMABING/migrateEpisodes.cjs
const mongoose = require('mongoose');
require('dotenv').config();

const Episode = require('./models/Episode.cjs');

// ✅ MongoDB Atlas connection string (ENV)
const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env file');
  process.exit(1);
}

console.log('🚀 Starting Episodes Migration...');
console.log('📡 Connecting to database (Atlas)...');

const migrateEpisodes = async () => {
  try {
    // ✅ Connect to MongoDB Atlas
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log('✅ Connected to MongoDB Atlas');

    // ✅ Fetch all episodes
    const episodes = await Episode.find({});
    console.log(`📊 Found ${episodes.length} episodes in database`);

    let updatedCount = 0;
    let skippedCount = 0;
    let erroredCount = 0;

    for (const episode of episodes) {
      try {
        const episodeTitle =
          episode.title || `Episode ${episode.episodeNumber}`;

        console.log(`\n🔍 Processing: ${episodeTitle}`);

        const currentMainLink = episode.mainLink;
        const hasDownloadLinks =
          Array.isArray(episode.downloadLinks) &&
          episode.downloadLinks.length > 0;

        const firstDownloadUrl = hasDownloadLinks
          ? episode.downloadLinks[0]?.url
          : null;

        // ✅ Case 1: mainLink already exists
        if (currentMainLink && currentMainLink.trim() !== '') {
          console.log('   ⏭️  Skipped (mainLink already set)');
          skippedCount++;
          continue;
        }

        // ✅ Case 2: Set mainLink from downloadLinks
        if (firstDownloadUrl) {
          const result = await Episode.updateOne(
            { _id: episode._id },
            {
              $set: {
                mainLink: firstDownloadUrl,
                updatedAt: new Date(),
              },
            }
          );

          if (result.modifiedCount > 0) {
            console.log('   ✅ mainLink updated');
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
        // ✅ Case 3: No downloadLinks → empty mainLink
        else {
          const result = await Episode.updateOne(
            { _id: episode._id },
            {
              $set: {
                mainLink: '',
                updatedAt: new Date(),
              },
            }
          );

          if (result.modifiedCount > 0) {
            console.log('   ⚠️  Empty mainLink added');
            updatedCount++;
          } else {
            skippedCount++;
          }
        }
      } catch (epErr) {
        console.error('   ❌ Episode error:', epErr.message);
        erroredCount++;
      }
    }

    // ✅ Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 MIGRATION COMPLETED');
    console.log('='.repeat(50));
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${erroredCount}`);
    console.log(`📊 Total: ${episodes.length}`);

    // ✅ Disconnect
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

// ✅ Run migration
migrateEpisodes();
