import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
    const url = 'https://www.chu-nimes.fr/espace-recrutement.html';
    try {
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log('CHU OK', res.status);
        const $ = cheerio.load(res.data);
        const items = $('table tr, .recrutement-item, .offre');
        console.log('CHU Items:', items.length);
    } catch (e) {
        console.log('CHU Erreur:', e.message);
    }
}
test();
