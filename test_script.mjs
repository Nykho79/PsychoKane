import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://choisirleservicepublic.gouv.fr/nos-offres/?query=psychoth%C3%A9rapeute&location=Nimes';
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const items = $('.c-cardJob, .offre-item, .fr-card, .card-job');
    console.log('Items found:', items.length);
    items.each((i, el) => {
        const title = $(el).find('.c-cardJob__title, .offre-title, .fr-card__title, h3').first().text().trim();
        console.log('Title [RAW]:', title);
    });
}
test();
