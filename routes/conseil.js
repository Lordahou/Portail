const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const SEANCES_FILE = path.join(__dirname, '..', 'data', 'conseil', 'seances.json');

/**
 * GET /api/conseil/seances
 * Liste toutes les séances du conseil
 */
router.get('/seances', (req, res) => {
  try {
    const seances = readJSON(SEANCES_FILE);
    const liste = Array.isArray(seances) ? seances : [];

    // Tri par date décroissante
    liste.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    res.json({ success: true, data: liste });
  } catch (error) {
    console.error('Erreur liste séances:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des séances' });
  }
});

/**
 * POST /api/conseil/seances
 * Crée une nouvelle séance
 */
router.post('/seances', (req, res) => {
  try {
    const { date, type } = req.body;

    if (!date) {
      return res.status(400).json({ success: false, error: 'La date est requise' });
    }

    if (type && !['ordinaire', 'extraordinaire'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Le type doit être "ordinaire" ou "extraordinaire"' });
    }

    const seances = readJSON(SEANCES_FILE);
    const liste = Array.isArray(seances) ? seances : [];

    const nouvelleSeance = {
      id: generateId(),
      date,
      type: type || 'ordinaire',
      statut: 'programmee',
      points: [],
      creePar: req.session.user.id,
      creeLe: new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };

    liste.push(nouvelleSeance);
    writeJSON(SEANCES_FILE, liste);

    logAction(req.session.user.id, 'creation_seance', { date, type: nouvelleSeance.type });

    res.status(201).json({ success: true, data: nouvelleSeance });
  } catch (error) {
    console.error('Erreur création séance:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de la séance' });
  }
});

/**
 * GET /api/conseil/seances/:id
 * Récupère une séance avec ses points d'ordre du jour
 */
router.get('/seances/:id', (req, res) => {
  try {
    const seances = readJSON(SEANCES_FILE);
    const seance = Array.isArray(seances) ? seances.find(s => s.id === req.params.id) : null;

    if (!seance) {
      return res.status(404).json({ success: false, error: 'Séance non trouvée' });
    }

    res.json({ success: true, data: seance });
  } catch (error) {
    console.error('Erreur récupération séance:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération de la séance' });
  }
});

/**
 * PUT /api/conseil/seances/:id
 * Met à jour une séance
 */
router.put('/seances/:id', (req, res) => {
  try {
    const seances = readJSON(SEANCES_FILE);
    const liste = Array.isArray(seances) ? seances : [];
    const index = liste.findIndex(s => s.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Séance non trouvée' });
    }

    const champsModifiables = ['date', 'type', 'statut'];
    champsModifiables.forEach(champ => {
      if (req.body[champ] !== undefined) {
        liste[index][champ] = req.body[champ];
      }
    });
    liste[index].modifieLe = new Date().toISOString();

    writeJSON(SEANCES_FILE, liste);

    logAction(req.session.user.id, 'modification_seance', { id: req.params.id });

    res.json({ success: true, data: liste[index] });
  } catch (error) {
    console.error('Erreur modification séance:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification de la séance' });
  }
});

/**
 * POST /api/conseil/seances/:id/points
 * Ajoute un point à l'ordre du jour
 */
router.post('/seances/:id/points', (req, res) => {
  try {
    const seances = readJSON(SEANCES_FILE);
    const liste = Array.isArray(seances) ? seances : [];
    const index = liste.findIndex(s => s.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Séance non trouvée' });
    }

    const { titre, description, rapporteur, decision } = req.body;

    if (!titre) {
      return res.status(400).json({ success: false, error: 'Le titre est requis' });
    }

    if (!Array.isArray(liste[index].points)) {
      liste[index].points = [];
    }

    const ordre = liste[index].points.length + 1;

    const nouveauPoint = {
      id: generateId(),
      ordre,
      titre,
      description: description || '',
      rapporteur: rapporteur || '',
      decision: decision || '',
      creeLe: new Date().toISOString()
    };

    liste[index].points.push(nouveauPoint);
    liste[index].modifieLe = new Date().toISOString();
    writeJSON(SEANCES_FILE, liste);

    logAction(req.session.user.id, 'ajout_point_odj', {
      seanceId: req.params.id,
      titre
    });

    res.status(201).json({ success: true, data: nouveauPoint });
  } catch (error) {
    console.error('Erreur ajout point ODJ:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'ajout du point' });
  }
});

/**
 * PUT /api/conseil/seances/:id/points/:pointId
 * Met à jour un point de l'ordre du jour
 */
router.put('/seances/:id/points/:pointId', (req, res) => {
  try {
    const seances = readJSON(SEANCES_FILE);
    const liste = Array.isArray(seances) ? seances : [];
    const seanceIndex = liste.findIndex(s => s.id === req.params.id);

    if (seanceIndex === -1) {
      return res.status(404).json({ success: false, error: 'Séance non trouvée' });
    }

    const points = liste[seanceIndex].points || [];
    const pointIndex = points.findIndex(p => p.id === req.params.pointId);

    if (pointIndex === -1) {
      return res.status(404).json({ success: false, error: 'Point non trouvé' });
    }

    const champsModifiables = ['titre', 'description', 'rapporteur', 'decision', 'ordre'];
    champsModifiables.forEach(champ => {
      if (req.body[champ] !== undefined) {
        points[pointIndex][champ] = req.body[champ];
      }
    });
    points[pointIndex].modifieLe = new Date().toISOString();

    liste[seanceIndex].modifieLe = new Date().toISOString();
    writeJSON(SEANCES_FILE, liste);

    logAction(req.session.user.id, 'modification_point_odj', {
      seanceId: req.params.id,
      pointId: req.params.pointId
    });

    res.json({ success: true, data: points[pointIndex] });
  } catch (error) {
    console.error('Erreur modification point ODJ:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification du point' });
  }
});

/**
 * DELETE /api/conseil/seances/:id/points/:pointId
 * Supprime un point de l'ordre du jour
 */
router.delete('/seances/:id/points/:pointId', (req, res) => {
  try {
    const seances = readJSON(SEANCES_FILE);
    const liste = Array.isArray(seances) ? seances : [];
    const seanceIndex = liste.findIndex(s => s.id === req.params.id);

    if (seanceIndex === -1) {
      return res.status(404).json({ success: false, error: 'Séance non trouvée' });
    }

    const points = liste[seanceIndex].points || [];
    const pointIndex = points.findIndex(p => p.id === req.params.pointId);

    if (pointIndex === -1) {
      return res.status(404).json({ success: false, error: 'Point non trouvé' });
    }

    points.splice(pointIndex, 1);

    // Renuméroter les points
    points.forEach((p, i) => {
      p.ordre = i + 1;
    });

    liste[seanceIndex].modifieLe = new Date().toISOString();
    writeJSON(SEANCES_FILE, liste);

    logAction(req.session.user.id, 'suppression_point_odj', {
      seanceId: req.params.id,
      pointId: req.params.pointId
    });

    res.json({ success: true, data: { message: 'Point supprimé' } });
  } catch (error) {
    console.error('Erreur suppression point ODJ:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression du point' });
  }
});

/**
 * GET /api/conseil/seances/:id/pdf
 * Génère le PDF de la séance (ordre du jour ou compte-rendu)
 */
router.get('/seances/:id/pdf', (req, res) => {
  try {
    const seances = readJSON(SEANCES_FILE);
    const seance = Array.isArray(seances) ? seances.find(s => s.id === req.params.id) : null;

    if (!seance) {
      return res.status(404).json({ success: false, error: 'Séance non trouvée' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="conseil-${seance.date}.pdf"`);

    doc.pipe(res);

    // Titre
    doc.fontSize(18);
    doc.font('Helvetica-Bold');
    doc.text('CONSEIL MUNICIPAL', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(14);
    const typeLabel = seance.type === 'extraordinaire' ? 'Séance extraordinaire' : 'Séance ordinaire';
    doc.text(typeLabel, { align: 'center' });

    // Date
    doc.moveDown(0.5);
    doc.fontSize(12);
    const dateFormatee = new Date(seance.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`${dateFormatee}`, { align: 'center' });

    // Séparateur
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

    // Ordre du jour
    doc.moveDown();
    doc.fontSize(14);
    doc.font('Helvetica-Bold');
    doc.text('ORDRE DU JOUR');
    doc.moveDown(0.5);

    const points = seance.points || [];
    if (points.length === 0) {
      doc.fontSize(11);
      doc.font('Helvetica');
      doc.text('Aucun point inscrit à l\'ordre du jour.', { oblique: true });
    } else {
      points.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

      points.forEach(point => {
        doc.fontSize(12);
        doc.font('Helvetica-Bold');
        doc.text(`${point.ordre}. ${point.titre}`);

        if (point.rapporteur) {
          doc.fontSize(10);
          doc.font('Helvetica');
          doc.text(`Rapporteur : ${point.rapporteur}`, { indent: 20 });
        }

        if (point.description) {
          doc.fontSize(10);
          doc.font('Helvetica');
          doc.text(point.description, { indent: 20, width: 480 });
        }

        if (point.decision) {
          doc.fontSize(10);
          doc.font('Helvetica-Bold');
          doc.text(`Décision : ${point.decision}`, { indent: 20 });
        }

        doc.moveDown(0.5);
      });
    }

    doc.end();

    logAction(req.session.user.id, 'export_pdf_seance', {
      id: req.params.id,
      date: seance.date
    });
  } catch (error) {
    console.error('Erreur génération PDF séance:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération du PDF' });
  }
});

module.exports = router;
