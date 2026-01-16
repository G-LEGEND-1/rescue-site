const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: String,
  content: String,
  image: String, // Base64 string
  imageType: String // e.g., 'image/jpeg', 'image/png'
}, { timestamps: true });

module.exports = mongoose.model('News', newsSchema);