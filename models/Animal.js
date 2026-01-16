// models/Animal.js
const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  image: String,
  payments: [
    {
      method: String,
      details: String
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('Animal', animalSchema);