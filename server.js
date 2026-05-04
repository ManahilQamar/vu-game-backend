const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// IMPORTANT: Railway PORT must be used like this
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// TEST ROUTE
app.get('/', (req, res) => {
  res.send('API is working 🚀');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});