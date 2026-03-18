const express = require('express');
const { logAction } = require('../utils/storage');

const router = express.Router();

/**
 * Modèles de textes administratifs français (mode mock)
 */
const TEMPLATES = {
  courrier: (params) => {
    const destinataire = params.destinataire || 'Madame, Monsieur';
    const objet = params.objet || 'votre demande';
    return `${destinataire},

Par la présente, nous accusons réception de votre courrier relatif à ${objet} et nous vous en remercions.

Après examen attentif de votre dossier, nous avons le plaisir de vous informer que votre demande a été prise en compte par nos services. Les dispositions nécessaires seront mises en œuvre dans les meilleurs délais.

Nous restons à votre entière disposition pour tout complément d'information que vous pourriez souhaiter. N'hésitez pas à contacter notre secrétariat aux heures d'ouverture habituelles.

Dans l'attente, nous vous prions d'agréer, ${destinataire}, l'expression de nos salutations distinguées.

Le Maire`;
  },

  deliberation: (params) => {
    const objet = params.objet || 'objet de la délibération';
    const date = params.date || new Date().toLocaleDateString('fr-FR');
    return `DELIBERATION N° ____

Séance du ${date}

Objet : ${objet}

Le Conseil Municipal de la commune, régulièrement convoqué, s'est réuni en session ordinaire sous la présidence de Monsieur/Madame le/la Maire.

Nombre de conseillers en exercice : ____
Nombre de conseillers présents : ____
Nombre de pouvoirs : ____

Le/La Maire expose au Conseil Municipal que ${objet.toLowerCase()}.

Vu le Code Général des Collectivités Territoriales,
Vu la délibération du Conseil Municipal en date du ____,

Considérant qu'il est nécessaire de statuer sur cette question,

Après en avoir délibéré, le Conseil Municipal, à l'unanimité / à la majorité de ____ voix pour et ____ voix contre :

DECIDE :

Article 1 : D'approuver les dispositions relatives à ${objet.toLowerCase()}.

Article 2 : D'autoriser Monsieur/Madame le/la Maire à signer tout document afférent à cette décision.

Article 3 : De dire que les crédits nécessaires seront inscrits au budget communal.

Fait et délibéré les jour, mois et an susdits.

Le Maire,                    Le Secrétaire de séance,`;
  },

  mail: (params) => {
    const destinataire = params.destinataire || 'Madame, Monsieur';
    const objet = params.objet || 'Information municipale';
    return `Objet : ${objet}

${destinataire},

Nous avons le plaisir de vous adresser ce message concernant ${objet.toLowerCase()}.

Nous souhaitons vous informer que la mairie met tout en œuvre pour répondre à vos attentes dans les meilleurs délais. Notre équipe reste mobilisée et à votre écoute pour toute question complémentaire.

Vous pouvez nous contacter :
- Par téléphone aux heures d'ouverture
- Par courrier à l'adresse de la mairie
- En vous rendant directement à l'accueil

Nous vous remercions de votre confiance et restons à votre disposition.

Cordialement,

Le secrétariat de mairie`;
  },

  resume: (params) => {
    const texte = params.texte || '';
    if (!texte) {
      return `Veuillez fournir un texte à résumer dans le paramètre "texte".`;
    }
    // En mode mock, on fait un résumé très simplifié
    const phrases = texte.split(/[.!?]+/).filter(p => p.trim().length > 10);
    const nbPhrases = Math.min(3, phrases.length);
    const resume = phrases.slice(0, nbPhrases).map(p => p.trim()).join('. ');
    return `Résumé :\n\n${resume}.

Note : Ce résumé a été généré automatiquement en mode démonstration. Pour des résumés plus précis, configurez un fournisseur d'IA dans les paramètres.`;
  }
};

/**
 * Appel à l'API OpenAI
 */
async function callOpenAI(type, params) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('Clé API OpenAI non configurée');
  }

  const prompts = {
    courrier: `Rédigez un courrier administratif officiel en français pour une mairie. Objet : ${params.objet || 'demande'}. Destinataire : ${params.destinataire || 'Madame, Monsieur'}. Le ton doit être formel et respectueux.`,
    deliberation: `Rédigez une délibération de conseil municipal en français. Objet : ${params.objet || 'délibération'}. Date de la séance : ${params.date || 'à compléter'}. Incluez tous les éléments formels requis (visas, considérants, articles).`,
    mail: `Rédigez un email professionnel en français pour une mairie. Objet : ${params.objet || 'information'}. Destinataire : ${params.destinataire || 'Madame, Monsieur'}. Le ton doit être professionnel mais accessible.`,
    resume: `Résumez le texte suivant en français de manière concise et structurée :\n\n${params.texte || ''}`
  };

  const prompt = prompts[type];
  if (!prompt) {
    throw new Error(`Type de génération inconnu : ${type}`);
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Vous êtes un assistant spécialisé dans la rédaction administrative pour les mairies françaises. Répondez toujours en français.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Erreur API OpenAI: ${response.status} - ${errorData.error?.message || 'Erreur inconnue'}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * POST /api/ai/generate
 * Génère du texte selon le type demandé
 */
router.post('/generate', async (req, res) => {
  try {
    const { type, params } = req.body;

    if (!type) {
      return res.status(400).json({ success: false, error: 'Le type de génération est requis' });
    }

    const typesValides = ['courrier', 'deliberation', 'mail', 'resume'];
    if (!typesValides.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Type invalide. Valeurs acceptées : ${typesValides.join(', ')}`
      });
    }

    const provider = process.env.AI_PROVIDER || 'mock';
    let texteGenere;

    if (provider === 'openai') {
      texteGenere = await callOpenAI(type, params || {});
    } else {
      // Mode mock : utiliser les modèles intégrés
      const templateFn = TEMPLATES[type];
      if (!templateFn) {
        return res.status(400).json({ success: false, error: 'Type de template inconnu' });
      }
      texteGenere = templateFn(params || {});
    }

    logAction(req.session.user.id, 'generation_ia', { type, provider });

    res.json({
      success: true,
      data: {
        type,
        provider,
        texte: texteGenere
      }
    });
  } catch (error) {
    console.error('Erreur génération IA:', error);
    res.status(500).json({ success: false, error: `Erreur lors de la génération : ${error.message}` });
  }
});

module.exports = router;
