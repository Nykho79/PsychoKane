import axios from 'axios';
import * as cheerio from 'cheerio';
async function test() {
    const url = 'https://www.ash.tm.fr/emplois/recherche?keywords=Psychologue&location=Gard';
    try {
        const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        console.log('ASH OK', res.status);
    } catch (e) {
        console.log('ASH Erreur:', e.message);
    }
}
test();
