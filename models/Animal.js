// models/Animal.js
const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  image: String, // Base64 string
  imageType: String, // e.g., 'image/jpeg', 'image/png'
  payments: [
    {
      method: String,
      details: String
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Animal', animalSchema);