export const FRENCH_WORDS = [
  "pomme", "chat", "chien", "maison", "voiture", "arbre", "fleur", "soleil", "lune", "etoile",
  "livre", "table", "chaise", "porte", "fenetre", "mur", "toit", "jardin", "chemin", "route",
  "ville", "village", "pays", "monde", "ciel", "mer", "riviere", "montagne", "foret", "bois",
  "oiseau", "poisson", "cheval", "vache", "mouton", "poule", "oeuf", "lait", "pain", "eau",
  "vin", "biere", "jus", "cafe", "the", "sucre", "sel", "poivre", "viande", "legume",
  "fruit", "gateau", "chocolat", "glace", "miel", "confiture", "beurre", "fromage", "soupe", "salade",
  "rouge", "bleu", "vert", "jaune", "noir", "blanc", "gris", "marron", "rose", "orange",
  "grand", "petit", "gros", "mince", "long", "court", "haut", "bas", "fort", "faible",
  "rapide", "lent", "chaud", "froid", "doux", "dur", "lourd", "leger", "plein", "vide",
  "nouveau", "vieux", "jeune", "beau", "laid", "bon", "mauvais", "vrai", "faux", "juste",
  "heureux", "triste", "rire", "pleurer", "sourire", "chanter", "danser", "jouer", "travailler", "dormir"
];

export function generatePassphrase(): string[] {
  const shuffled = [...FRENCH_WORDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 6);
}
