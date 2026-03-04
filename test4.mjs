import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://choisirleservicepublic.gouv.fr/nos-offres/?query=psychologue&location=Nimes';
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const items = $('.c-cardJob, .offre-item, .fr-card, .card-job');
    console.log('HTML for first item:');
    console.log($(items[0]).html() || 'None');
}
test();
