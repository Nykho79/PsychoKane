# Psychologue Scout Nîmes

Agrégateur d'offres d'emploi pour psychologues à Nîmes.

## Configuration des API

Pour faire fonctionner l'agrégation, vous devez configurer les clés API suivantes dans les secrets de l'application :

1. **France Travail (ex-Pôle Emploi)** :
   - Créez un compte sur [France Travail IO](https://francetravail.io/).
   - Créez une application et récupérez le `Client ID` et le `Client Secret`.
   - Ajoutez `FRANCE_TRAVAIL_CLIENT_ID` et `FRANCE_TRAVAIL_CLIENT_SECRET`.

2. **SerpApi (Google Jobs)** :
   - Créez un compte sur [SerpApi](https://serpapi.com/).
   - Récupérez votre clé API.
   - Ajoutez `SERP_API_KEY`.

## Fonctionnement du Dédoublonnage

L'application utilise la distance de Levenshtein pour comparer les titres des offres. Si deux offres ont :
- Un titre similaire à plus de 85% (après normalisation).
- La même entreprise.
- La même ville.
Elles sont fusionnées pour éviter les doublons entre les différentes sources.
