import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import Levenshtein from "fast-levenshtein";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

const memoryCache = new Map<string, any>();

interface JobOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  date: string;
  salary?: string;
  contractType?: string;
  description?: string;
  lat?: number;
  lng?: number;
  isTccMatch?: boolean;
  driveTime?: string;
  transitTime?: string;
  convention?: string;
  estimatedSalary?: string;
}

function calculateCommute(lat?: number, lng?: number) {
  if (!lat || !lng) return { driveTime: null, transitTime: null };
  const home = { lat: 43.8504, lng: 4.3485 };
  const R = 6371;
  const dLat = (lat - home.lat) * Math.PI / 180;
  const dLon = (lng - home.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(home.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const driveMinutes = Math.round(3 + (distance * 2) + Math.random() * 4);
  const transitMinutes = Math.round(10 + (distance * 4));

  return {
    driveTime: `${driveMinutes} min`,
    transitTime: `${transitMinutes} min`
  };
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "dummy" });

async function analyzeJobAsync(job: JobOffer, commute: any) {
  let convention = "Non détectée";
  let estimatedSalary: number | null = null;
  let confidence = "low";

  if (job.description && process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Analyse cette offre de psychologue. Identifie la convention collective (66, 51, FPH, ou autre). Si identifiée, estime le salaire net mensuel pour un Master 2 débutant en 2026. Réponds STRICTEMENT au format JSON : { "convention": "string", "estimatedSalary": 2000, "confidence": "high" }. \n\nDescription: ${job.description}\nTitre: ${job.title}\nEntreprise: ${job.company}`;

      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt
      });

      const text = response.text || "{}";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        convention = parsed.convention || convention;
        estimatedSalary = parsed.estimatedSalary || null;
        confidence = parsed.confidence || confidence;
      }
    } catch (e) {
      console.error("Gemini Error:", e);
    }
  }

  try {
    memoryCache.set(job.id, {
      id: job.id,
      convention,
      estimatedSalary,
      confidence,
      driveTime: commute.driveTime,
      transitTime: commute.transitTime,
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 // 24h
    });
  } catch (e) {
    console.error("Cache Error:", e);
  }
}

// --- Normalization & Deduplication ---

function isPsyJob(title?: string): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return t.includes('psychologue') || t.includes('psychothérapeute') || t.includes('psychotherapeute') || t.includes('psychanalyste');
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/h\/f/g, "")
    .replace(/f\/h/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

function areJobsSimilar(job1: JobOffer, job2: JobOffer): boolean {
  if (job1.company.toLowerCase() !== job2.company.toLowerCase()) return false;
  if (job1.location.toLowerCase() !== job2.location.toLowerCase()) return false;

  const t1 = normalizeTitle(job1.title);
  const t2 = normalizeTitle(job2.title);

  const distance = Levenshtein.get(t1, t2);
  const maxLength = Math.max(t1.length, t2.length);
  const similarity = 1 - distance / maxLength;

  return similarity >= 0.85;
}

function deduplicateJobs(jobs: JobOffer[]): JobOffer[] {
  const uniqueJobs: JobOffer[] = [];

  for (const job of jobs) {
    const existingIndex = uniqueJobs.findIndex((u) => areJobsSimilar(u, job));
    if (existingIndex !== -1) {
      // Merge: Keep the one with more info or preferred source
      // For now, just keep the first one but maybe update URL if needed
    } else {
      uniqueJobs.push(job);
    }
  }

  return uniqueJobs;
}

// --- Scrapers & API Clients ---

async function fetchFranceTravail(radius: number, clientId?: string, clientSecret?: string): Promise<JobOffer[]> {
  const finalClientId = (clientId && clientId.trim() !== "") ? clientId : process.env.FRANCE_TRAVAIL_CLIENT_ID;
  const finalClientSecret = (clientSecret && clientSecret.trim() !== "") ? clientSecret : process.env.FRANCE_TRAVAIL_CLIENT_SECRET;

  if (!finalClientId || !finalClientSecret) {
    console.log("France Travail: Missing credentials");
    return [];
  }

  try {
    console.log(`France Travail: Fetching jobs (radius: ${radius}km)`);
    // Auth
    const authRes = await axios.post(
      "https://entreprise.pole-emploi.fr/connexion/oauth2/access_token?realm=%2Fpartenaire",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: finalClientId,
        client_secret: finalClientSecret,
        scope: "api_offresdemploiv2 o2dso rechercheoffres",
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const token = authRes.data.access_token;

    // Search
    const validRadii = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 100];
    const ftRadius = validRadii.reduce((prev, curr) =>
      Math.abs(curr - radius) < Math.abs(prev - radius) ? curr : prev
    );

    const searchRes = await axios.get(
      "https://api.pole-emploi.io/partenaire/offresdemploiv2/v2/offres/search",
      {
        params: {
          motsCles: "psychologue",
          commune: "30189", // Nîmes
          rayon: ftRadius,
          publieeDepuis: 31,
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return (searchRes.data.resultats || [])
      .filter((item: any) => isPsyJob(item.intitule))
      .map((item: any) => ({
        id: item.id,
        title: item.intitule,
        company: item.entreprise?.nom || "Non spécifié",
        location: item.lieuTravail?.libelle || "Nîmes",
        source: "France Travail",
        url: `https://candidat.pole-emploi.fr/offres/recherche/detail/${item.id}`,
        date: item.dateCreation,
        salary: item.salaire?.libelle,
        contractType: item.typeContrat,
        description: item.description,
        lat: item.lieuTravail?.latitude,
        lng: item.lieuTravail?.longitude,
      }));
  } catch (error) {
    console.error("France Travail API Error:", error);
    return [];
  }
}

async function fetchSerpApi(radius: number, apiKeyOverride?: string): Promise<JobOffer[]> {
  const apiKey = (apiKeyOverride && apiKeyOverride.trim() !== "") ? apiKeyOverride : process.env.SERP_API_KEY;
  if (!apiKey) {
    console.log("SerpApi: No API key available");
    return [];
  }

  try {
    // Try with a slightly broader query if needed, but start specific
    const queries = [
      { q: "psychologue", location: "Nîmes, France" },
      { q: "psychologue Nîmes", location: "" }
    ];

    let allJobs: any[] = [];

    for (const config of queries) {
      console.log(`SerpApi: Trying query "${config.q}" in "${config.location}"`);
      const res = await axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "google_jobs",
          q: config.q,
          location: config.location,
          hl: "fr",
          gl: "fr",
          api_key: apiKey,
        },
      });

      if (res.data.jobs_results && res.data.jobs_results.length > 0) {
        allJobs = res.data.jobs_results;
        console.log(`SerpApi: Found ${allJobs.length} results with query "${config.q}"`);
        break; // Found results, stop trying fallback queries
      }
    }

    return allJobs
      .filter((item: any) => isPsyJob(item.title))
      .map((item: any, index: number) => {
        // Try to find a better link than just google.com
        let jobUrl = item.related_links?.[0]?.link;
        if (!jobUrl || jobUrl.includes("google.com/search")) {
          jobUrl = item.apply_options?.[0]?.link || item.link || "https://google.com";
        }

        return {
          id: `google-${index}-${item.job_id}`,
          title: item.title,
          company: item.company_name,
          location: item.location,
          source: "Google Jobs",
          url: jobUrl,
          date: item.detected_extensions?.posted_at || new Date().toISOString(),
          description: item.description,
          salary: item.detected_extensions?.salary || item.salary,
          contractType: item.detected_extensions?.schedule_type || item.employment_type,
          lat: 43.8367 + (Math.random() - 0.5) * 0.03,
          lng: 4.3601 + (Math.random() - 0.5) * 0.03,
        };
      });
  } catch (error: any) {
    console.error("SerpApi Request Error:", error.message);
    return [];
  }
}

async function fetchServicePublic(): Promise<JobOffer[]> {
  try {
    console.log("Service Public: Scraping jobs...");
    // Updated URL to use the base search page which is confirmed to exist
    const url = "https://choisirleservicepublic.gouv.fr/nos-offres/filtres/localisation/Toute%20la%20France/mot%20cl%C3%A9/psychologue/";
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      },
      timeout: 10000
    });
    const $ = cheerio.load(res.data);
    const jobs: JobOffer[] = [];

    // Updated selectors based on common structure for this site
    // We try both the newer .c-cardJob and older .offre-item if available
    const items = $(".c-cardJob, .offre-item, .fr-card, .card-job");

    console.log(`Service Public: Found ${items.length} potential items`);

    items.each((i, el) => {
      const title = $(el).find(".c-cardJob__title, .offre-title, .fr-card__title, h3").first().text().trim();
      const company = $(el).find(".c-cardJob__employer, .offre-company, .fr-card__detail, .employer").first().text().trim();
      const location = $(el).find(".c-cardJob__location, .offre-location, .fr-card__desc, .location").first().text().trim();
      const link = $(el).find("a.c-cardJob__link, a.fr-card__link, a").first().attr("href");

      if (isPsyJob(title)) {
        const strictLoc = location ? location.toLowerCase() : "";
        if (strictLoc !== "" && !strictLoc.includes("gard") && !strictLoc.includes("nîmes") && !strictLoc.includes("30") && !strictLoc.includes("nimes") && !strictLoc.includes("occitanie")) {
          return; // Ignore distant locations returned by service public
        }

        jobs.push({
          id: `csp-${i}-${Date.now()}`,
          title,
          company: company || "Service Public",
          location: location || "Nîmes",
          source: "Service Public",
          url: link ? (link.startsWith("http") ? link : `https://choisirleservicepublic.gouv.fr${link}`) : "https://choisirleservicepublic.gouv.fr/nos-offres",
          date: new Date().toISOString(),
          description: "",
        });
      }
    });

    return jobs;
  } catch (error: any) {
    const status = error.response?.status;
    const message = error.message;
    console.error(`Service Public Scraping Error: ${message}${status ? ` (Status: ${status})` : ""}`);
    return [];
  }
}

// --- Additional Scrapers ---
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
};

const checkTccMatch = (text: string): boolean => {
  if (!text) return false;
  const regex = /(tcc|cognitive|comportementale|cbt)/i;
  return regex.test(text);
};

// 1. Source: FHF (Fédération Hospitalière de France)
async function fetchFHF(): Promise<JobOffer[]> {
  try {
    const url = 'https://emploi.fhf.fr/offres-emploi?keywords=Psychologue&department=30';
    const response = await axios.get(url, { headers: HEADERS });
    const html = response.data;
    const $ = cheerio.load(html);
    const jobs: JobOffer[] = [];

    $('article, .job-item, .offer-list-item').each((_, el) => {
      const textContent = $(el).text();

      if (isPsyJob(textContent)) {
        const title = $(el).find('h2, .title, .job-title').first().text().trim() || '';
        if (!isPsyJob(title)) return;

        const company = $(el).find('.company, .establishment').first().text().trim() || 'Établissement rattaché FHF';
        const location = $(el).find('.location, .city').first().text().trim() || 'Gard (30)';
        let link = $(el).find('a').first().attr('href') || url;
        if (link && !link.startsWith('http')) link = `https://emploi.fhf.fr${link}`;

        jobs.push({
          id: `fhf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          title,
          company,
          location,
          source: 'FHF',
          url: link,
          isTccMatch: checkTccMatch(textContent),
          date: new Date().toISOString()
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('Erreur Résiliente (Scraping FHF):', error);
    return [];
  }
}

// 2. Source: ASH (Actualités Sociales Hebdomadaires)
async function fetchASH(): Promise<JobOffer[]> {
  try {
    const url = 'https://www.ash.tm.fr/emplois/recherche?keywords=Psychologue&location=Gard';
    const response = await axios.get(url, { headers: HEADERS });
    const html = response.data;
    const $ = cheerio.load(html);
    const jobs: JobOffer[] = [];

    $('.job-offer, .offer-card, .list-item-job').each((_, el) => {
      const textContent = $(el).text();

      if (isPsyJob(textContent)) {
        const title = $(el).find('h2, h3, .title').first().text().trim() || '';
        if (!isPsyJob(title)) return;

        const company = $(el).find('.company, .employer').first().text().trim() || 'Association / Structure';
        const location = $(el).find('.location, .city').first().text().trim() || 'Gard';
        let link = $(el).find('a').first().attr('href') || url;
        if (link && !link.startsWith('http')) link = `https://www.ash.tm.fr${link}`;

        jobs.push({
          id: `ash-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          title,
          company,
          location,
          source: 'ASH',
          url: link,
          isTccMatch: checkTccMatch(textContent),
          date: new Date().toISOString()
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('Erreur Résiliente (Scraping ASH):', error);
    return [];
  }
}

// 3. Source: Tableau du personnel CHU de Nîmes
async function fetchCHUNimes(): Promise<JobOffer[]> {
  try {
    const url = 'https://www.chu-nimes.fr/espace-recrutement.html';
    const response = await axios.get(url, { headers: HEADERS });
    const html = response.data;
    const $ = cheerio.load(html);
    const jobs: JobOffer[] = [];

    $('table tr, .recrutement-item, .offre').each((_, el) => {
      const textContent = $(el).text();

      if (isPsyJob(textContent)) {
        const title = $(el).find('td:nth-child(1), .title, h3').first().text().trim() || '';
        if (!isPsyJob(title)) return;

        const company = 'CHU de Nîmes';
        const location = 'Nîmes';
        let link = $(el).find('a').first().attr('href') || url;
        if (link && !link.startsWith('http')) link = `https://www.chu-nimes.fr/${link.replace(/^\//, '')}`;

        jobs.push({
          id: `chunimes-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          title,
          company,
          location,
          source: 'CHU_NIMES',
          url: link,
          isTccMatch: checkTccMatch(textContent),
          date: new Date().toISOString()
        });
      }
    });

    return jobs;
  } catch (error) {
    console.error('Erreur Résiliente (Scraping CHU Nîmes):', error);
    return [];
  }
}

// --- API Routes ---

app.get("/api/jobs", async (req, res) => {
  try {
    const radius = parseInt(req.query.radius as string) || 20;
    const serpApiKey = req.headers["x-serp-api-key"] as string;
    const ftClientId = req.headers["x-ft-client-id"] as string;
    const ftClientSecret = req.headers["x-ft-client-secret"] as string;

    console.log(`[${new Date().toISOString()}] --- New Job Fetch Request ---`);
    console.log(`Radius: ${radius}km`);
    console.log(`SerpApi Key provided: ${serpApiKey ? "Yes (starts with " + serpApiKey.substring(0, 4) + "...)" : "No"}`);
    console.log(`FT Client ID provided: ${ftClientId ? "Yes" : "No"}`);
    console.log(`FT Client Secret provided: ${ftClientSecret ? "Yes" : "No"}`);

    const [ftJobs, serpJobs, spJobs, fhfJobs, ashJobs, chuJobs] = await Promise.all([
      fetchFranceTravail(radius, ftClientId, ftClientSecret),
      fetchSerpApi(radius, serpApiKey),
      fetchServicePublic(),
      fetchFHF(),
      fetchASH(),
      fetchCHUNimes()
    ]);

    console.log(`Results: FT=${ftJobs.length}, Serp=${serpJobs.length}, SP=${spJobs.length}, FHF=${fhfJobs.length}, ASH=${ashJobs.length}, CHU=${chuJobs.length}`);

    const allJobs = [...ftJobs, ...serpJobs, ...spJobs, ...fhfJobs, ...ashJobs, ...chuJobs];
    console.log(`Total jobs before deduplication: ${allJobs.length}`);
    const uniqueJobs = deduplicateJobs(allJobs);

    console.log(`Total unique jobs: ${uniqueJobs.length}`);

    const enrichedJobs = uniqueJobs.map(job => {
      try {
        const cached = memoryCache.get(job.id);
        if (cached && cached.expiresAt > Date.now()) {
          return {
            ...job,
            convention: cached.convention,
            estimatedSalary: cached.estimatedSalary ? cached.estimatedSalary + "€ net/mois" : undefined,
            driveTime: cached.driveTime,
            transitTime: cached.transitTime,
          };
        }
      } catch (e) { }

      const commute = calculateCommute(job.lat, job.lng);
      analyzeJobAsync(job, commute);

      return {
        ...job,
        ...commute
      };
    });

    res.json(enrichedJobs);
  } catch (error) {
    console.error("API Route Error:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const viteModule = await import("vite");
    const createViteServer = viteModule.createServer;
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Mode Production
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== "production" || process.env.RUN_SERVER === "1") {
  startServer();
}

export default app;
