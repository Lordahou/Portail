const express = require('express');
const path = require('path');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const DEMANDES_FILE = path.join(__dirname, '..', 'data', 'demandes', 'demandes.json');

const STATUTS_VALIDES = ['nouveau', 'en_cours', 'traite', 'refuse'];

/**
 * Génère une référence unique au format DEM-YYYY-NNNN
 */
function genererReference() {
  const demandes = readJSON(DEMANDES_FILE);
  const annee = new Date().getFullYear();
  const demandesDeLAnnee = Array.isArray(demandes)
    ? demandes.filter(d => d.reference && d.reference.includes(`-${annee}-`))
    : [];
  const numero = demandesDeLAnnee.length + 1;
  return `DEM-${annee}-${String(numero).padStart(4, '0')}`;
}

/**
 * GET /api/demandes
 * Liste toutes les demandes avec filtres
 */
router.get('/', (req, res) => {
  try {
    const demandes = readJSON(DEMANDES_FILE);
    let resultats = Array.isArray(demandes) ? demandes : [];

    const { statut, search } = req.query;

    if (statut) {
      resultats = resultats.filter(d => d.statut === statut);
    }

    if (search) {
      const terme = search.toLowerCase();
      resultats = resultats.filter(d =>
        (d.nom && d.nom.toLowerCase().includes(terme)) ||
        (d.prenom && d.prenom.toLowerCase().includes(terme)) ||
        (d.objet && d.objet.toLowerCase().includes(terme)) ||
        (d.reference && d.reference.toLowerCase().includes(terme)) ||
        (d.email && d.email.toLowerCase().includes(terme))
      );
    }

    // Tri par date de création décroissante
    resultats.sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''));

    res.json({ success: true, data: resultats });
  } catch (error) {
    console.error('Erreur liste demandes:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des demandes' });
  }
});

/**
 * POST /api/demandes
 * Crée une nouvelle demande
 */
router.post('/', (req, res) => {
  try {
    const { nom, prenom, email, telephone, objet, description, categorie } = req.body;

    if (!nom || !prenom || !objet) {
      return res.status(400).json({
        success: false,
        error: 'Le nom, le prénom et l\'objet sont requis'
      });
    }

    const demandes = readJSON(DEMANDES_FILE);
    const liste = Array.isArray(demandes) ? demandes : [];

    const nouvelleDemande = {
      id: generateId(),
      reference: genererReference(),
      nom,
      prenom,
      email: email || '',
      telephone: telephone || '',
      objet,
      description: description || '',
      categorie: categorie || 'autre',
      statut: 'nouveau',
      reponse: '',
      creePar: req.session.user.id,
      creeLe: new Date().toISOString(),
      modifieLe: new Date().toISOString()
    };

    liste.push(nouvelleDemande);
    writeJSON(DEMANDES_FILE, liste);

    logAction(req.session.user.id, 'creation_demande', {
      reference: nouvelleDemande.reference,
      objet
    });

    res.status(201).json({ success: true, data: nouvelleDemande });
  } catch (error) {
    console.error('Erreur création demande:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de la demande' });
  }
});

/**
 * GET /api/demandes/:id
 * Récupère une demande par son ID
 */
router.get('/:id', (req, res) => {
  try {
    const demandes = readJSON(DEMANDES_FILE);
    const demande = Array.isArray(demandes) ? demandes.find(d => d.id === req.params.id) : null;

    if (!demande) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }

    res.json({ success: true, data: demande });
  } catch (error) {
    console.error('Erreur récupération demande:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération de la demande' });
  }
});

/**
 * PUT /api/demandes/:id
 * Met à jour une demande (statut, réponse, etc.)
 */
router.put('/:id', (req, res) => {
  try {
    const demandes = readJSON(DEMANDES_FILE);
    const liste = Array.isArray(demandes) ? demandes : [];
    const index = liste.findIndex(d => d.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }

    // Vérifier la validité du statut s'il est fourni
    if (req.body.statut && !STATUTS_VALIDES.includes(req.body.statut)) {
      return res.status(400).json({
        success: false,
        error: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(', ')}`
      });
    }

    const champsModifiables = ['nom', 'prenom', 'email', 'telephone', 'objet', 'description', 'categorie', 'statut', 'reponse'];
    champsModifiables.forEach(champ => {
      if (req.body[champ] !== undefined) {
        liste[index][champ] = req.body[champ];
      }
    });
    liste[index].modifieLe = new Date().toISOString();

    writeJSON(DEMANDES_FILE, liste);

    logAction(req.session.user.id, 'modification_demande', {
      id: req.params.id,
      reference: liste[index].reference,
      statut: liste[index].statut
    });

    res.json({ success: true, data: liste[index] });
  } catch (error) {
    console.error('Erreur modification demande:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification de la demande' });
  }
});

/**
 * DELETE /api/demandes/:id
 * Supprime une demande
 */
router.delete('/:id', (req, res) => {
  try {
    const demandes = readJSON(DEMANDES_FILE);
    const liste = Array.isArray(demandes) ? demandes : [];
    const index = liste.findIndex(d => d.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }

    const supprimee = liste.splice(index, 1)[0];
    writeJSON(DEMANDES_FILE, liste);

    logAction(req.session.user.id, 'suppression_demande', {
      id: req.params.id,
      reference: supprimee.reference
    });

    res.json({ success: true, data: { message: 'Demande supprimée' } });
  } catch (error) {
    console.error('Erreur suppression demande:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de la demande' });
  }
});

module.exports = router;
