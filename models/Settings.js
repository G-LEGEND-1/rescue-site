// models/Settings.js
const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  method: String,
  details: String,
  email: String,
  giftInstructions: String,
  acceptedCards: String
});

const settingsSchema = new mongoose.Schema({
  email: String,
  payments: [paymentMethodSchema]
});

module.exports = mongoose.model('Settings', settingsSchema);