import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://choisirleservicepublic.gouv.fr/nos-offres/?query=psychoth%C3%A9rapeute&location=Nimes';
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const items = $('.c-cardJob, .offre-item, .fr-card, .card-job');
    const jobs = [];
    items.each((i, el) => {
        const title = $(el).find('.c-cardJob__title, .offre-title, .fr-card__title, h3').first().text().trim();
        if (title.toLowerCase().includes('psychothérapeute') || title.toLowerCase().includes('psychotherapeute')) {
            jobs.push(title);
        }
    });
    console.log('Filtered Jobs:', jobs);
}
test();
