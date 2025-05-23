// server.ts (in scraper project)
import express from 'express'
import scrapeIndieHackers from './scrape' // your existing function
const app = express()

app.get('/scrape', async (req, res) => {
  try {
    const products = await scrapeIndieHackers()
    res.status(200).json({ message: 'Scraping complete', products })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Scraping failed' })
  }
})

const PORT = 4000
app.listen(PORT, () => console.log(`🧹 Scraper API running on http://localhost:${PORT}`))
