const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const COURRIERS_FILE = path.join(__dirname, '..', 'data', 'courriers', 'courriers.json');

/**
 * Génère une référence unique au format COURRIER-YYYY-NNNN
 */
function genererReference() {
  const courriers = readJSON(COURRIERS_FILE);
  const annee = new Date().getFullYear();
  const courriersDeLAnnee = Array.isArray(courriers)
    ? courriers.filter(c => c.reference && c.reference.includes(`-${annee}-`))
    : [];
  const numero = courriersDeLAnnee.length + 1;
  return `COURRIER-${annee}-${String(numero).padStart(4, '0')}`;
}

/**
 * GET /api/courriers
 * Liste tous les courriers avec filtres optionnels
 */
router.get('/', (req, res) => {
  try {
    const courriers = readJSON(COURRIERS_FILE);
    let resultats = Array.isArray(courriers) ? courriers : [];

    const { type, dateDebut, dateFin, search } = req.query;

    if (type) {
      resultats = resultats.filter(c => c.type === type);
    }

    if (dateDebut) {
      resultats = resultats.filter(c => c.date >= dateDebut);
    }

    if (dateFin) {
      resultats = resultats.filter(c => c.date <= dateFin);
    }

    if (search) {
      const terme = search.toLowerCase();
      resultats = resultats.filter(c =>
        (c.objet && c.objet.toLowerCase().includes(terme)) ||
        (c.expediteur && c.expediteur.toLowerCase().includes(terme)) ||
        (c.destinataire && c.destinataire.toLowerCase().includes(terme)) ||
        (c.reference && c.reference.toLowerCase().includes(terme))
      );
    }

    // Tri par date décroissante
    resultats.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    res.json({ success: true, data: resultats });
  } catch (error) {
    console.error('Erreur liste courriers:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des courriers' });
  }
});

/**
 * GET /api/courriers/:id
 * Récupère un courrier par son ID
 */
router.get('/:id', (req, res) => {
  try {
    if (req.params.id === 'undefined') {
      return res.status(400).json({ success: false, error: 'ID invalide' });
    }

    const courriers = readJSON(COURRIERS_FILE);
    const courrier = Array.isArray(courriers) ? courriers.find(c => c.id === req.params.id) : null;

    if (!courrier) {
      return res.status(404).json({ success: false, error: 'Courrier non trouvé' });
    }

    res.json({ success: true, data: courrier });
  } catch (error) {
    console.error('Erreur récupération courrier:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération du courrier' });
  }
});

/**
 * POST /api/courriers
 * Crée un nouveau courrier
 */
router.post('/', (req, res) => {
  try {
    const { type, objet, expediteur, destinataire, contenu, date } = req.body;

    if (!type || !objet) {
      return res.status(400).json({ success: false, error: 'Le type et l\'objet sont requis' });
    }

    if (!['entrant', 'sortant'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Le type doit être "entrant" ou "sortant"' });
    }

    const courriers = readJSON(COURRIERS_FILE);
    const liste = Array.isArray(courriers) ? courriers : [];

    const nouveauCourrier = {
      id: generateId(),
      reference: genererReference(),
      type,
      objet,
      expediteur: expediteur || '',
      destinataire: destinataire || '',
      contenu: contenu || '',
      date: date || new Date().toISOString().split('T')[0],
      creePar: req.session.user.id,
      creeLe: new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };

    liste.push(nouveauCourrier);
    writeJSON(COURRIERS_FILE, liste);

    logAction(req.session.user.id, 'creation_courrier', {
      reference: nouveauCourrier.reference,
      objet
    });

    res.status(201).json({ success: true, data: nouveauCourrier });
  } catch (error) {
    console.error('Erreur création courrier:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du courrier' });
  }
});

/**
 * PUT /api/courriers/:id
 * Met à jour un courrier
 */
router.put('/:id', (req, res) => {
  try {
    const courriers = readJSON(COURRIERS_FILE);
    const liste = Array.isArray(courriers) ? courriers : [];
    const index = liste.findIndex(c => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Courrier non trouvé' });
    }

    const champsModifiables = ['type', 'objet', 'expediteur', 'destinataire', 'contenu', 'date'];
    champsModifiables.forEach(champ => {
      if (req.body[champ] !== undefined) {
        liste[index][champ] = req.body[champ];
      }
    });
    liste[index].modifieLe = new Date().toISOString();

    writeJSON(COURRIERS_FILE, liste);

    logAction(req.session.user.id, 'modification_courrier', {
      id: req.params.id,
      reference: liste[index].reference
    });

    res.json({ success: true, data: liste[index] });
  } catch (error) {
    console.error('Erreur modification courrier:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification du courrier' });
  }
});

/**
 * DELETE /api/courriers/:id
 * Supprime un courrier
 */
router.delete('/:id', (req, res) => {
  try {
    const courriers = readJSON(COURRIERS_FILE);
    const liste = Array.isArray(courriers) ? courriers : [];
    const index = liste.findIndex(c => c.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Courrier non trouvé' });
    }

    const supprime = liste.splice(index, 1)[0];
    writeJSON(COURRIERS_FILE, liste);

    logAction(req.session.user.id, 'suppression_courrier', {
      id: req.params.id,
      reference: supprime.reference
    });

    res.json({ success: true, data: { message: 'Courrier supprimé' } });
  } catch (error) {
    console.error('Erreur suppression courrier:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression du courrier' });
  }
});

/**
 * GET /api/courriers/:id/pdf
 * Génère un PDF du courrier (lettre française formatée)
 */
router.get('/:id/pdf', (req, res) => {
  try {
    const courriers = readJSON(COURRIERS_FILE);
    const courrier = Array.isArray(courriers) ? courriers.find(c => c.id === req.params.id) : null;

    if (!courrier) {
      return res.status(404).json({ success: false, error: 'Courrier non trouvé' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${courrier.reference}.pdf"`);

    doc.pipe(res);

    // En-tête : expéditeur à gauche
    doc.fontSize(11);
    doc.text(courrier.expediteur || 'Mairie', 50, 50, { width: 200 });

    // Destinataire à droite
    doc.text(courrier.destinataire || '', 350, 120, { width: 200, align: 'right' });

    // Date et lieu
    const dateFormatee = new Date(courrier.date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Le ${dateFormatee}`, 350, 170, { width: 200, align: 'right' });

    // Référence
    doc.moveDown(2);
    doc.fontSize(9);
    doc.text(`Réf. : ${courrier.reference}`, 50, 210);

    // Objet
    doc.moveDown();
    doc.fontSize(11);
    doc.font('Helvetica-Bold');
    doc.text(`Objet : ${courrier.objet}`, 50, 240);

    // Corps
    doc.font('Helvetica');
    doc.moveDown(2);
    doc.text(courrier.contenu || '', 50, 290, {
      width: 500,
      align: 'justify',
      lineGap: 4
    });

    // Signature
    doc.moveDown(3);
    doc.text('Veuillez agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.', {
      width: 500,
      align: 'justify'
    });

    doc.moveDown(3);
    doc.text('Le Maire,', 350, doc.y, { width: 200, align: 'right' });

    doc.end();

    logAction(req.session.user.id, 'export_pdf_courrier', {
      id: req.params.id,
      reference: courrier.reference
    });
  } catch (error) {
    console.error('Erreur génération PDF courrier:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération du PDF' });
  }
});

module.exports = router;
