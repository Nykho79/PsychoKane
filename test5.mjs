import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://choisirleservicepublic.gouv.fr/nos-offres/?query=psychologue&location=Nimes';
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const items = $('.c-cardJob, .offre-item, .fr-card, .card-job');
    console.log('Items:', items.length);
    for (let i = 0; i < Math.min(items.length, 3); i++) {
        const el = items[i];
        console.log(`-- Item ${i} --`);
        console.log('H2:', $(el).find('h2').text().trim().replace(/\s+/g, ' '));
        console.log('H3:', $(el).find('h3').text().trim().replace(/\s+/g, ' '));
        console.log('fr-card__title:', $(el).find('.fr-card__title').text().trim().replace(/\s+/g, ' '));
    }
}
test();
