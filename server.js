require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const NewsAPI = require('newsapi');
const path = require('path');

const app = express();
const port = 3000;

const newsapi = new NewsAPI(process.env.NEWSAPI_KEY);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.static('public'));

// Create table with unique constraint
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS news (
      id SERIAL PRIMARY KEY,
      title TEXT,
      description TEXT,
      url TEXT UNIQUE,
      published_at TIMESTAMP,
      publisher TEXT
    );
  `);
})();

// Fetch and store news with duplicate prevention
app.get('/fetch-news', async (req, res) => {
  try {
    const response = await newsapi.v2.everything({
      q: 'computer science OR AI OR artificial intelligence OR machine learning OR deep learning OR algorithms OR data structures',
      language: 'en',
      sortBy: 'publishedAt'
    });

    for (const article of response.articles) {
      await pool.query(
        `INSERT INTO news (title, description, url, published_at, publisher)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (url) DO NOTHING`,
        [article.title, article.description, article.url, article.publishedAt, article.source.name]
      );
    }
    res.send('Computer science news fetched and stored.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching news');
  }
});


// Serve news to frontend
app.get('/get-news', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM news 
      ORDER BY published_at DESC 
      LIMIT 20
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error retrieving news');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
