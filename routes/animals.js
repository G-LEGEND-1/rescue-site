const express = require('express');
const multer = require('multer');
const Animal = require('../models/Animal');
const cloudinary = require('../config/cloudinary');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);

    const animal = await Animal.create({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      image: result.secure_url,
      payments: JSON.parse(req.body.payments)
    });

    res.json(animal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  const animals = await Animal.find().sort({ createdAt: -1 });
  res.json(animals);
});

module.exports = router;
