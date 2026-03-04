import axios from 'axios';
import * as cheerio from 'cheerio';

async function test() {
    const url = 'https://emploi.fhf.fr/offres-emploi?keywords=Psychoth%C3%A9rapeute&department=30';
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(res.data);
    const items = $('article, .job-item, .offer-list-item');
    console.log('FHF Items:', items.length);
    const url2 = 'https://www.ash.tm.fr/emplois/recherche?keywords=Psychoth%C3%A9rapeute&location=Gard';
    const res2 = await axios.get(url2, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $2 = cheerio.load(res2.data);
    const items2 = $2('.job-offer, .offer-card, .list-item-job');
    console.log('ASH Items:', items2.length);

    const url3 = 'https://www.chu-nimes.fr/espace-recrutement.html';
    const res3 = await axios.get(url3, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $3 = cheerio.load(res3.data);
    const items3 = $3('table tr, .recrutement-item, .offre');
    let chuMatches = 0;
    items3.each((_, el) => {
        const title = $3(el).find('td:nth-child(1), .title, h3').first().text().trim();
        if (title.toLowerCase().includes('psycho')) chuMatches++;
    });
    console.log('CHU Matches:', chuMatches);
}
test();
