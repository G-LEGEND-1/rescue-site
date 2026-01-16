const mongoose = require('mongoose');

const paymentSubmissionSchema = new mongoose.Schema({
  name: String,
  email: String,
  amount: Number,
  note: String,
  paymentMethod: String,
  giftCardImage: String, // Base64 string
  giftCardImageType: String, // e.g., 'image/jpeg', 'image/png'
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('PaymentSubmission', paymentSubmissionSchema);