const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const RESERVATIONS_FILE = path.join(__dirname, '..', 'data', 'reservations', 'reservations.json');

const LIEUX_VALIDES = ['salle_des_fetes', 'camping', 'autre'];

const LIEUX_LABELS = {
  salle_des_fetes: 'Salle des Fêtes',
  camping: 'Camping Municipal',
  autre: 'Autre'
};

/**
 * GET /api/reservations
 * Liste toutes les réservations avec filtres
 */
router.get('/', (req, res) => {
  try {
    const reservations = readJSON(RESERVATIONS_FILE);
    let resultats = Array.isArray(reservations) ? reservations : [];

    const { lieu, dateDebut, dateFin, statut } = req.query;

    if (lieu) {
      resultats = resultats.filter(r => r.lieu === lieu);
    }

    if (dateDebut) {
      resultats = resultats.filter(r => r.date_fin >= dateDebut);
    }

    if (dateFin) {
      resultats = resultats.filter(r => r.date_debut <= dateFin);
    }

    if (statut) {
      resultats = resultats.filter(r => r.statut === statut);
    }

    // Tri par date de début décroissante
    resultats.sort((a, b) => (b.date_debut || '').localeCompare(a.date_debut || ''));

    res.json({ success: true, data: resultats });
  } catch (error) {
    console.error('Erreur liste réservations:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des réservations' });
  }
});

/**
 * POST /api/reservations
 * Crée une nouvelle réservation
 */
router.post('/', (req, res) => {
  try {
    const { lieu, demandeur_nom, demandeur_prenom, demandeur_email, demandeur_telephone, date_debut, date_fin, objet, montant } = req.body;

    if (!lieu || !demandeur_nom || !date_debut || !date_fin) {
      return res.status(400).json({
        success: false,
        error: 'Le lieu, le nom du demandeur, la date de début et la date de fin sont requis'
      });
    }

    if (!LIEUX_VALIDES.includes(lieu)) {
      return res.status(400).json({
        success: false,
        error: `Lieu invalide. Valeurs acceptées : ${LIEUX_VALIDES.join(', ')}`
      });
    }

    if (date_debut > date_fin) {
      return res.status(400).json({
        success: false,
        error: 'La date de début doit être antérieure à la date de fin'
      });
    }

    const reservations = readJSON(RESERVATIONS_FILE);
    const liste = Array.isArray(reservations) ? reservations : [];

    const nouvelleReservation = {
      id: generateId(),
      lieu,
      demandeur_nom,
      demandeur_prenom: demandeur_prenom || '',
      demandeur_email: demandeur_email || '',
      demandeur_telephone: demandeur_telephone || '',
      date_debut,
      date_fin,
      objet: objet || '',
      montant: montant || 0,
      statut: 'confirmee',
      creePar: req.session.user.id,
      creeLe: new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };

    liste.push(nouvelleReservation);
    writeJSON(RESERVATIONS_FILE, liste);

    logAction(req.session.user.id, 'creation_reservation', {
      lieu,
      date_debut,
      date_fin,
      demandeur: demandeur_nom
    });

    res.status(201).json({ success: true, data: nouvelleReservation });
  } catch (error) {
    console.error('Erreur création réservation:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de la réservation' });
  }
});

/**
 * GET /api/reservations/:id
 * Récupère une réservation par son ID
 */
router.get('/:id', (req, res) => {
  try {
    const reservations = readJSON(RESERVATIONS_FILE);
    const reservation = Array.isArray(reservations) ? reservations.find(r => r.id === req.params.id) : null;

    if (!reservation) {
      return res.status(404).json({ success: false, error: 'Réservation non trouvée' });
    }

    res.json({ success: true, data: reservation });
  } catch (error) {
    console.error('Erreur récupération réservation:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération de la réservation' });
  }
});

/**
 * PUT /api/reservations/:id
 * Met à jour une réservation
 */
router.put('/:id', (req, res) => {
  try {
    const reservations = readJSON(RESERVATIONS_FILE);
    const liste = Array.isArray(reservations) ? reservations : [];
    const index = liste.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Réservation non trouvée' });
    }

    if (req.body.lieu && !LIEUX_VALIDES.includes(req.body.lieu)) {
      return res.status(400).json({
        success: false,
        error: `Lieu invalide. Valeurs acceptées : ${LIEUX_VALIDES.join(', ')}`
      });
    }

    const champsModifiables = ['lieu', 'demandeur_nom', 'demandeur_prenom', 'demandeur_email', 'demandeur_telephone', 'date_debut', 'date_fin', 'objet', 'montant', 'statut'];
    champsModifiables.forEach(champ => {
      if (req.body[champ] !== undefined) {
        liste[index][champ] = req.body[champ];
      }
    });
    liste[index].modifieLe = new Date().toISOString();

    writeJSON(RESERVATIONS_FILE, liste);

    logAction(req.session.user.id, 'modification_reservation', { id: req.params.id });

    res.json({ success: true, data: liste[index] });
  } catch (error) {
    console.error('Erreur modification réservation:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification de la réservation' });
  }
});

/**
 * DELETE /api/reservations/:id
 * Supprime une réservation
 */
router.delete('/:id', (req, res) => {
  try {
    const reservations = readJSON(RESERVATIONS_FILE);
    const liste = Array.isArray(reservations) ? reservations : [];
    const index = liste.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Réservation non trouvée' });
    }

    liste.splice(index, 1);
    writeJSON(RESERVATIONS_FILE, liste);

    logAction(req.session.user.id, 'suppression_reservation', { id: req.params.id });

    res.json({ success: true, data: { message: 'Réservation supprimée' } });
  } catch (error) {
    console.error('Erreur suppression réservation:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de la réservation' });
  }
});

/**
 * GET /api/reservations/:id/facture
 * Génère une facture PDF simple pour la réservation
 */
router.get('/:id/facture', (req, res) => {
  try {
    const reservations = readJSON(RESERVATIONS_FILE);
    const reservation = Array.isArray(reservations) ? reservations.find(r => r.id === req.params.id) : null;

    if (!reservation) {
      return res.status(404).json({ success: false, error: 'Réservation non trouvée' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${reservation.id.slice(0, 8)}.pdf"`);

    doc.pipe(res);

    // En-tête mairie
    doc.fontSize(16);
    doc.font('Helvetica-Bold');
    doc.text('MAIRIE', 50, 50);
    doc.fontSize(10);
    doc.font('Helvetica');
    doc.text('Service des réservations', 50, 70);

    // Titre
    doc.moveDown(3);
    doc.fontSize(18);
    doc.font('Helvetica-Bold');
    doc.text('FACTURE', { align: 'center' });

    // Date
    doc.moveDown();
    doc.fontSize(10);
    doc.font('Helvetica');
    const dateEmission = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(`Date d'émission : ${dateEmission}`, { align: 'right' });

    // Destinataire
    doc.moveDown(2);
    doc.fontSize(11);
    doc.font('Helvetica-Bold');
    doc.text('Destinataire :');
    doc.font('Helvetica');
    doc.text(`${reservation.demandeur_prenom} ${reservation.demandeur_nom}`);
    if (reservation.demandeur_email) {
      doc.text(reservation.demandeur_email);
    }
    if (reservation.demandeur_telephone) {
      doc.text(reservation.demandeur_telephone);
    }

    // Détails de la réservation
    doc.moveDown(2);
    doc.font('Helvetica-Bold');
    doc.text('Détails de la réservation :');
    doc.moveDown(0.5);

    doc.font('Helvetica');
    const lieuLabel = LIEUX_LABELS[reservation.lieu] || reservation.lieu;
    doc.text(`Lieu : ${lieuLabel}`);
    doc.text(`Objet : ${reservation.objet || '-'}`);

    const dateDebut = new Date(reservation.date_debut).toLocaleDateString('fr-FR');
    const dateFin = new Date(reservation.date_fin).toLocaleDateString('fr-FR');
    doc.text(`Période : du ${dateDebut} au ${dateFin}`);

    // Montant
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(14);
    doc.font('Helvetica-Bold');
    const montant = parseFloat(reservation.montant) || 0;
    doc.text(`Montant total : ${montant.toFixed(2)} EUR`, { align: 'right' });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

    // Pied de page
    doc.moveDown(4);
    doc.fontSize(9);
    doc.font('Helvetica');
    doc.text('Ce document tient lieu de facture. Merci de votre confiance.', { align: 'center' });

    doc.end();

    logAction(req.session.user.id, 'export_facture', { id: req.params.id });
  } catch (error) {
    console.error('Erreur génération facture:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la génération de la facture' });
  }
});

module.exports = router;
