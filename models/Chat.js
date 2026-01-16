const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  name: String,
  email: String,
  messages: [
    {
      sender: String, // 'user' | 'admin'
      text: String,
      time: { type: Date, default: Date.now }
    }
  ]
}, { timestamps:true });

module.exports = mongoose.model('Chat', chatSchema);