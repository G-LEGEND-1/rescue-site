// server.js - UPDATED WITH BASE64 IMAGE STORAGE IN MONGODB
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const Animal = require('./models/Animal');
const News = require('./models/News');
const Chat = require('./models/Chat');
const Settings = require('./models/Settings');
const PaymentSubmission = require('./models/PaymentSubmission');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// Health check for Render
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Rescue Site API',
    version: '1.0.0'
  });
});

// Telegram Bot Setup
let bot;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
    polling: true,
    request: {
      agentOptions: {
        keepAlive: true,
        family: 4 // Force IPv4 for Render compatibility
      }
    }
  });
  console.log('Telegram bot started');
} else {
  console.warn('TELEGRAM_BOT_TOKEN not found in .env file');
}

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️ Application will continue but database operations will fail');
  });

// MongoDB connection events
mongoose.connection.on('error', err => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected successfully');
});

// Multer configuration for Render (use /tmp directory)
const upload = multer({ 
  dest: '/tmp/uploads/', // Render uses ephemeral /tmp storage
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for Render free tier
});

// Ensure uploads directory exists in /tmp
if (!fs.existsSync('/tmp/uploads')) {
  fs.mkdirSync('/tmp/uploads', { recursive: true });
  console.log('Created /tmp/uploads directory for Render');
}

// Image serving endpoint
app.get('/api/image/:id', async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id);
    if (!animal || !animal.image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Convert Base64 to buffer
    const imgBuffer = Buffer.from(animal.image, 'base64');
    res.set('Content-Type', animal.imageType || 'image/jpeg');
    res.send(imgBuffer);
  } catch (err) {
    console.error('Error serving image:', err);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// News image serving endpoint
app.get('/api/news-image/:id', async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news || !news.image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const imgBuffer = Buffer.from(news.image, 'base64');
    res.set('Content-Type', news.imageType || 'image/jpeg');
    res.send(imgBuffer);
  } catch (err) {
    console.error('Error serving news image:', err);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// Gift card image serving endpoint
app.get('/api/giftcard-image/:id', async (req, res) => {
  try {
    const submission = await PaymentSubmission.findById(req.params.id);
    if (!submission || !submission.giftCardImage) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const imgBuffer = Buffer.from(submission.giftCardImage, 'base64');
    res.set('Content-Type', submission.giftCardImageType || 'image/jpeg');
    res.send(imgBuffer);
  } catch (err) {
    console.error('Error serving gift card image:', err);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

/* ===== TELEGRAM BOT FUNCTIONS ===== */

// Function to send message to Telegram (updated for Base64)
async function sendToTelegram(message, imageBase64 = null, imageType = null) {
  try {
    if (!bot || !TELEGRAM_CHAT_ID) {
      console.log('Telegram not configured. Message:', message);
      return;
    }

    if (imageBase64) {
      // Convert Base64 to buffer for Telegram
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      
      // We need to send Base64 to Telegram differently
      // Telegram bot API doesn't directly accept Base64
      // For now, we'll just send the message without image
      // Or you can save temp file and send
      const tempPath = `/tmp/telegram_${Date.now()}.jpg`;
      fs.writeFileSync(tempPath, imageBuffer);
      
      await bot.sendPhoto(TELEGRAM_CHAT_ID, tempPath, {
        caption: message,
        parse_mode: 'HTML'
      });
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
    } else {
      await bot.sendMessage(TELEGRAM_CHAT_ID, message, {
        parse_mode: 'HTML'
      });
    }
    console.log('Message sent to Telegram');
  } catch (error) {
    console.error('Error sending to Telegram:', error);
  }
}

// Function to format chat message for Telegram
function formatChatForTelegram(chat) {
  const lastMessage = chat.messages.length > 0 
    ? chat.messages[chat.messages.length - 1] 
    : null;
  
  return `
📩 <b>New Chat Message</b>
👤 <b>From:</b> ${chat.name}
📧 <b>Email:</b> ${chat.email}
💬 <b>Message:</b> ${lastMessage ? lastMessage.text.substring(0, 200) : 'No message'}
⏰ <b>Time:</b> ${new Date().toLocaleString()}
🆔 <b>Chat ID:</b> <code>${chat._id}</code>

<i>Use /reply ${chat._id} [message] to reply</i>
  `;
}

// Function to format gift card submission for Telegram
function formatGiftCardForTelegram(submission) {
  return `
🎁 <b>New Gift Card Submission</b>
👤 <b>From:</b> ${submission.name}
📧 <b>Email:</b> ${submission.email}
💰 <b>Amount:</b> $${submission.amount}
📝 <b>Note:</b> ${submission.note ? submission.note.substring(0, 100) : 'No additional note'}
⏰ <b>Time:</b> ${new Date(submission.createdAt).toLocaleString()}
🆔 <b>Submission ID:</b> <code>${submission._id}</code>

<i>Payment received! Review the gift card image.</i>
  `;
}

// Setup Telegram bot commands if bot is available
if (bot) {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Welcome to Rescue Paws Admin Bot! Here are available commands:\n\n' +
      '/chats - View recent chats\n' +
      '/reply [chat_id] [message] - Reply to a chat\n' +
      '/payments - View recent gift card submissions\n' +
      '/help - Show this help message');
  });

  bot.onText(/\/chats/, async (msg) => {
    try {
      const chats = await Chat.find().sort({ updatedAt: -1 }).limit(10);
      
      if (chats.length === 0) {
        bot.sendMessage(msg.chat.id, 'No active chats found.');
        return;
      }
      
      let response = '📋 <b>Recent Chats</b>\n\n';
      chats.forEach((chat, index) => {
        const lastMessage = chat.messages.length > 0 
          ? chat.messages[chat.messages.length - 1].text.substring(0, 50)
          : 'No messages';
        
        response += `${index + 1}. <b>${chat.name}</b> (${chat.email})\n`;
        response += `   💬 ${lastMessage}${lastMessage.length > 50 ? '...' : ''}\n`;
        response += `   🆔 <code>${chat._id}</code>\n\n`;
      });
      
      bot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error fetching chats:', error);
      bot.sendMessage(msg.chat.id, 'Error fetching chats.');
    }
  });

  bot.onText(/\/payments/, async (msg) => {
    try {
      const payments = await PaymentSubmission.find().sort({ createdAt: -1 }).limit(10);
      
      if (payments.length === 0) {
        bot.sendMessage(msg.chat.id, 'No gift card submissions found.');
        return;
      }
      
      let response = '💰 <b>Recent Gift Card Submissions</b>\n\n';
      payments.forEach((payment, index) => {
        response += `${index + 1}. <b>${payment.name}</b> (${payment.email})\n`;
        response += `   💰 Amount: $${payment.amount}\n`;
        response += `   📝 ${payment.note ? payment.note.substring(0, 30) : 'No note'}\n`;
        response += `   🆔 <code>${payment._id}</code>\n`;
        response += `   ⏰ ${new Date(payment.createdAt).toLocaleDateString()}\n\n`;
      });
      
      bot.sendMessage(msg.chat.id, response, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Error fetching payments:', error);
      bot.sendMessage(msg.chat.id, 'Error fetching payments.');
    }
  });

  bot.onText(/\/reply (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const args = match[1].split(' ');
    const replyChatId = args[0];
    const message = args.slice(1).join(' ');
    
    if (!replyChatId || !message) {
      bot.sendMessage(chatId, 'Usage: /reply [chat_id] [message]');
      return;
    }
    
    try {
      const chat = await Chat.findById(replyChatId);
      if (!chat) {
        bot.sendMessage(chatId, 'Chat not found.');
        return;
      }
      
      // Add admin reply to chat
      chat.messages.push({
        sender: 'admin',
        text: message,
        time: new Date()
      });
      
      await chat.save();
      
      // Send confirmation
      bot.sendMessage(chatId, `✅ Reply sent to ${chat.name}!`);
      
      // Send notification to Telegram admin group
      await sendToTelegram(`📤 <b>Admin Reply Sent</b>\n\n👤 To: ${chat.name}\n💬 Message: ${message.substring(0, 100)}`);
      
    } catch (error) {
      console.error('Error replying to chat:', error);
      bot.sendMessage(chatId, 'Error sending reply.');
    }
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Available commands:\n\n' +
      '/chats - View recent chats\n' +
      '/reply [chat_id] [message] - Reply to a chat\n' +
      '/payments - View recent gift card submissions\n' +
      '/start - Show welcome message\n' +
      '/help - Show this help');
  });
}

/* ===== ANIMALS ===== */
app.get('/animals', async (req, res) => {
  try {
    const animals = await Animal.find().sort({ createdAt: -1 });
    
    // Transform to include image URLs
    const animalsWithUrls = animals.map(animal => ({
      _id: animal._id,
      title: animal.title,
      description: animal.description,
      price: animal.price,
      image: `/api/image/${animal._id}`, // Image URL endpoint
      payments: animal.payments,
      createdAt: animal.createdAt,
      updatedAt: animal.updatedAt
    }));
    
    res.json(animalsWithUrls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/animals', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // Convert image to Base64
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const imageType = req.file.mimetype;
    
    const animal = await Animal.create({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      image: base64Image,
      imageType: imageType
    });
    
    // Clean up temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Return animal with image URL
    const animalResponse = {
      ...animal.toObject(),
      image: `/api/image/${animal._id}` // Image URL endpoint
    };
    
    res.json(animalResponse);
  } catch (err) {
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE ANIMAL
app.delete('/animals/:id', async (req, res) => {
  try {
    await Animal.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== NEWS ===== */
app.get('/news', async (req, res) => {
  try {
    const news = await News.find().sort({ createdAt: -1 });
    
    // Transform to include image URLs
    const newsWithUrls = news.map(item => ({
      _id: item._id,
      title: item.title,
      content: item.content,
      image: `/api/news-image/${item._id}`, // Image URL endpoint
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));
    
    res.json(newsWithUrls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/news', upload.single('image'), async (req, res) => {
  try {
    let base64Image = null;
    let imageType = null;
    
    if (req.file) {
      // Convert image to Base64
      const imageBuffer = fs.readFileSync(req.file.path);
      base64Image = imageBuffer.toString('base64');
      imageType = req.file.mimetype;
      
      // Clean up temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } else {
      // Use default image URL as Base64 (optional)
      // For now, we'll allow null image
    }
    
    const news = await News.create({
      title: req.body.title,
      content: req.body.content,
      image: base64Image,
      imageType: imageType
    });
    
    // Return news with image URL
    const newsResponse = {
      ...news.toObject(),
      image: base64Image ? `/api/news-image/${news._id}` : null
    };
    
    res.json(newsResponse);
  } catch (err) {
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE NEWS
app.delete('/news/:id', async (req, res) => {
  try {
    await News.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== PAYMENT SETTINGS ===== */
app.get('/payments', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json(settings ? settings.payments : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/payments', async (req, res) => {
  try {
    // Update or create settings
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ payments: [] });
    }
    
    settings.payments.push({
      method: req.body.method,
      details: req.body.details,
      email: req.body.email,
      giftInstructions: req.body.giftInstructions,
      acceptedCards: req.body.acceptedCards
    });
    
    await settings.save();
    res.json(settings.payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE PAYMENT METHOD
app.delete('/payments/:id', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (settings) {
      settings.payments = settings.payments.filter(p => p._id.toString() !== req.params.id);
      await settings.save();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Settings not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== GIFT CARD PAYMENT SUBMISSION ===== */
app.post('/submit-giftcard', upload.single('giftCardImage'), async (req, res) => {
  try {
    const { name, email, amount, note, paymentMethod } = req.body;
    
    if (!name || !email || !amount || !req.file) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Convert gift card image to Base64
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const imageType = req.file.mimetype;
    
    // Clean up temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Save to database
    const submission = await PaymentSubmission.create({
      name,
      email,
      amount: parseFloat(amount),
      note,
      paymentMethod,
      giftCardImage: base64Image,
      giftCardImageType: imageType,
      status: 'pending'
    });
    
    // Send notification to Telegram with image
    await sendToTelegram(
      formatGiftCardForTelegram(submission),
      base64Image,
      imageType
    );
    
    res.json({ 
      success: true, 
      message: 'Gift card submitted successfully! We will verify it shortly.',
      submission: {
        ...submission.toObject(),
        giftCardImage: `/api/giftcard-image/${submission._id}` // Image URL endpoint
      }
    });
    
  } catch (err) {
    console.error('Error submitting gift card:', err);
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
});

// Get all gift card submissions (for admin)
app.get('/giftcard-submissions', async (req, res) => {
  try {
    const submissions = await PaymentSubmission.find().sort({ createdAt: -1 });
    
    // Transform to include image URLs
    const submissionsWithUrls = submissions.map(sub => ({
      ...sub.toObject(),
      giftCardImage: `/api/giftcard-image/${sub._id}` // Image URL endpoint
    }));
    
    res.json(submissionsWithUrls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update gift card submission status (for admin)
app.put('/giftcard-submissions/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const submission = await PaymentSubmission.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    
    // Send status update to Telegram
    await sendToTelegram(
      `🔄 <b>Gift Card Status Updated</b>\n\n` +
      `👤 From: ${submission.name}\n` +
      `💰 Amount: $${submission.amount}\n` +
      `📊 Status: ${status.toUpperCase()}\n` +
      `🆔 ID: <code>${submission._id}</code>`
    );
    
    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== CHAT WITH TELEGRAM NOTIFICATION ===== */
app.get('/chat', async (req, res) => {
  try {
    const chats = await Chat.find().sort({ createdAt: -1 }).limit(20);
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    
    let chat = await Chat.findOne({ email });
    if (!chat) {
      chat = await Chat.create({
        name,
        email,
        messages: []
      });
    }
    
    chat.messages.push({
      sender: 'user',
      text: message,
      time: new Date()
    });
    
    await chat.save();
    
    // Send notification to Telegram
    if (bot && TELEGRAM_CHAT_ID) {
      await sendToTelegram(formatChatForTelegram(chat));
    }
    
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CHAT REPLY ENDPOINT
app.post('/chat/:id/reply', async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    chat.messages.push({
      sender: 'admin',
      text: req.body.message,
      time: new Date()
    });
    
    await chat.save();
    
    // Send notification to Telegram about admin reply
    if (bot && TELEGRAM_CHAT_ID) {
      await sendToTelegram(
        `📤 <b>Admin Reply Sent</b>\n\n` +
        `👤 To: ${chat.name}\n` +
        `📧 Email: ${chat.email}\n` +
        `💬 Message: ${req.body.message.substring(0, 100)}`
      );
    }
    
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== SETTINGS (for checkout page) ===== */
app.get('/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json(settings || { email: '', payments: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/settings', async (req, res) => {
  try {
    await Settings.deleteMany();
    const settings = await Settings.create(req.body);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Graceful shutdown for Render
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (bot) {
    bot.stopPolling();
    console.log('Telegram bot polling stopped');
  }
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Health check: http://localhost:${PORT}/health`);
  console.log(`🏠 Frontend: http://localhost:${PORT}/`);
  console.log(`⚙️ Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🖼️ Images are now stored in MongoDB as Base64`);
});