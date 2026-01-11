require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const animalRoutes = require('./routes/animals');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use('/animals', animalRoutes);

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
