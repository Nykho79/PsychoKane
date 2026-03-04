export interface DirectoryEntry {
  name: string;
  address: string;
  phone: string;
  contact: string;
  website?: string;
}

export interface DirectoryCategory {
  title: string;
  description: string;
  entries: DirectoryEntry[];
}

export const DIRECTORY_DATA: DirectoryCategory[] = [
  {
    title: "Pôle Public (CHU de Nîmes & Santé Mentale)",
    description: "Établissements publics et centres de santé mentale rattachés au CHU.",
    entries: [
      { name: "DRH CHU Nîmes (Recrutement)", address: "Place du Pr. Robert Debré, Nîmes", phone: "04 66 68 68 68", contact: "Recrutement CHU", website: "https://www.chu-nimes.fr" },
      { name: "CMPA Les Tilleuls", address: "61 Rue des Tilleuls, 30900 Nîmes", phone: "04 66 68 55 20", contact: "chu-nimes.fr", website: "https://www.chu-nimes.fr" },
      { name: "CMPA Rue Hoche", address: "7 Rue Hoche, 30000 Nîmes", phone: "04 66 68 34 36", contact: "rdv.hoche@chu-nimes.fr" },
      { name: "CMPEA Watteau", address: "60 Rue de Montaury, 30900 Nîmes", phone: "04 66 68 75 20", contact: "chu-nimes.fr", website: "https://www.chu-nimes.fr" },
      { name: "CMPEA Sainte-Anne", address: "1 Rue Sainte-Anne, 30000 Nîmes", phone: "04 66 27 92 60", contact: "chu-nimes.fr", website: "https://www.chu-nimes.fr" },
      { name: "CMP Vauvert", address: "320 Rue Salvador Allende, 30600 Vauvert", phone: "04 66 73 11 00", contact: "chu-nimes.fr", website: "https://www.chu-nimes.fr" },
      { name: "CMP Saint-Gilles", address: "29 Grand Rue, 30800 Saint-Gilles", phone: "04 66 73 11 00", contact: "chu-nimes.fr", website: "https://www.chu-nimes.fr" },
      { name: "CMP Sommières", address: "1 Place de la Mairie, 30250 Sommières", phone: "04 66 73 11 00", contact: "chu-nimes.fr", website: "https://www.chu-nimes.fr" },
    ]
  },
  {
    title: "Pôle Cliniques Privées (Postes TCC prioritaires)",
    description: "Cliniques privées spécialisées, souvent en recherche de profils TCC.",
    entries: [
      { name: "Clinique Les Sophoras", address: "Rue des Sophoras, 30000 Nîmes", phone: "04 66 62 79 00", contact: "contact@clinique-sophoras.com", website: "https://www.clinique-sophoras.com" },
      { name: "Clinique Le Carré Ducal", address: "100 Rue de Bouillargues, 30000 Nîmes", phone: "04 66 28 40 40", contact: "clinea.fr", website: "https://www.clinea.fr" },
      { name: "Clinique Lyon Lumière", address: "100 Rue des Sœurs, 30210 Meynes", phone: "04 66 59 86 00", contact: "inicea.fr", website: "https://www.inicea.fr" },
      { name: "Clinique Valdegour", address: "75 Chemin Carsalade, 30900 Nîmes", phone: "04 66 63 36 36", contact: "elsan.care", website: "https://www.elsan.care" },
      { name: "Institut de Cancérologie", address: "Rue du Pr. Henri Pujol, 30900 Nîmes", phone: "04 66 68 68 68", contact: "oncogard.fr", website: "https://www.oncogard.fr" },
    ]
  },
  {
    title: "Pôle Médico-Social & Associatif",
    description: "Associations et structures d'accompagnement médico-social.",
    entries: [
      { name: "SAMSAH Gard’Espoir", address: "11 Place Jean Perrin, 30900 Nîmes", phone: "04 66 63 78 00", contact: "gard-espoir.fr", website: "https://www.gard-espoir.fr" },
      { name: "CSAPA Logos (APSA 30)", address: "8 Rue Tedenat, 30000 Nîmes", phone: "04 66 21 07 89", contact: "apsa30.fr", website: "https://www.apsa30.fr" },
      { name: "Unapei 30 (SESSAD/IME)", address: "100 Rue de l'Hostellerie, 30900 Nîmes", phone: "04 66 62 38 40", contact: "unapei30.fr", website: "https://www.unapei30.fr" },
      { name: "CERESA (Autisme)", address: "120 Avenue Jean Prouvé, 30000 Nîmes", phone: "04 66 23 83 23", contact: "ceresa.fr", website: "https://www.ceresa.fr" },
      { name: "Maison des Ados (MDA30)", address: "15 Rue Sainte-Anne, 30900 Nîmes", phone: "04 66 05 23 46", contact: "mda30.com", website: "https://www.mda30.com" },
    ]
  },
  {
    title: "Pôle Gériatrie (EHPAD)",
    description: "Établissements d'hébergement pour personnes âgées dépendantes.",
    entries: [
      { name: "EHPAD Serre-Cavalier", address: "Rue Pitot Prolongée, 30000 Nîmes", phone: "04 66 68 34 71", contact: "Recrutement CHU", website: "https://www.chu-nimes.fr" },
      { name: "EHPAD Villa Rediciano", address: "Rue de la République, 30230 Bouillargues", phone: "04 66 20 73 00", contact: "korian.fr", website: "https://www.korian.fr" },
      { name: "EHPAD Indigo", address: "30 Rue de l'Amiral Courbet, 30000 Nîmes", phone: "04 66 05 06 00", contact: "emera.fr", website: "https://www.emera.fr" },
      { name: "EHPAD Lumière et Paix", address: "5 Avenue Franklin Roosevelt, 30000 Nîmes", phone: "04 66 36 34 50", contact: "secretariat@msprotestante.fr" },
    ]
  }
];
