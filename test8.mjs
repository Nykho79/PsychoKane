import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://emploi.fhf.fr/offres-emploi?keywords=Psychologue&department=30';
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const items = $('article, .job-item, .offer-list-item');
    console.log('FHF items:', items.length);
    const jobs = [];
    items.each((i, el) => {
        const title = $(el).find('h2, .title, .job-title').first().text().trim();
        if (title.toLowerCase().includes('psycho')) {
            jobs.push(title);
        }
    });
    console.log('Valid FHF jobs:', jobs);
}
test();
