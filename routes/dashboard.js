const express = require('express');
const path = require('path');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const TASKS_FILE = path.join(__dirname, '..', 'data', 'dashboard', 'tasks.json');
const COURRIERS_FILE = path.join(__dirname, '..', 'data', 'courriers', 'courriers.json');
const DEMANDES_FILE = path.join(__dirname, '..', 'data', 'demandes', 'demandes.json');
const RESERVATIONS_FILE = path.join(__dirname, '..', 'data', 'reservations', 'reservations.json');
const CONSEIL_FILE = path.join(__dirname, '..', 'data', 'conseil', 'seances.json');

/**
 * GET /api/dashboard/stats
 * Retourne les statistiques du tableau de bord
 */
router.get('/stats', (req, res) => {
  try {
    const courriers = readJSON(COURRIERS_FILE);
    const demandes = readJSON(DEMANDES_FILE);
    const reservations = readJSON(RESERVATIONS_FILE);
    const seances = readJSON(CONSEIL_FILE);

    const today = new Date().toISOString().split('T')[0];

    // Comptage des demandes par statut
    const demandesParStatut = {
      nouveau: 0,
      en_cours: 0,
      traite: 0,
      refuse: 0
    };
    if (Array.isArray(demandes)) {
      demandes.forEach(d => {
        if (demandesParStatut.hasOwnProperty(d.statut)) {
          demandesParStatut[d.statut]++;
        }
      });
    }

    // Réservations du jour
    const reservationsAujourdhui = Array.isArray(reservations)
      ? reservations.filter(r => r.date_debut <= today && r.date_fin >= today).length
      : 0;

    // Prochaine séance de conseil
    const prochaineSeance = Array.isArray(seances)
      ? seances
          .filter(s => s.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date))[0] || null
      : null;

    res.json({
      success: true,
      data: {
        courriers: {
          total: Array.isArray(courriers) ? courriers.length : 0
        },
        demandes: {
          total: Array.isArray(demandes) ? demandes.length : 0,
          parStatut: demandesParStatut
        },
        reservationsAujourdhui,
        prochaineSeance: prochaineSeance ? {
          id: prochaineSeance.id,
          date: prochaineSeance.date,
          type: prochaineSeance.type
        } : null
      }
    });
  } catch (error) {
    console.error('Erreur stats dashboard:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des statistiques' });
  }
});

/**
 * GET /api/dashboard/tasks
 * Liste des tâches/rappels
 */
router.get('/tasks', (req, res) => {
  try {
    const tasks = readJSON(TASKS_FILE);
    res.json({ success: true, data: Array.isArray(tasks) ? tasks : [] });
  } catch (error) {
    console.error('Erreur liste tâches:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des tâches' });
  }
});

/**
 * POST /api/dashboard/tasks
 * Ajouter une tâche
 */
router.post('/tasks', (req, res) => {
  try {
    const { titre, description, echeance, priorite } = req.body;

    if (!titre) {
      return res.status(400).json({ success: false, error: 'Le titre est requis' });
    }

    const tasks = readJSON(TASKS_FILE);
    const taskArray = Array.isArray(tasks) ? tasks : [];

    const nouvelleTache = {
      id: generateId(),
      titre,
      description: description || '',
      echeance: echeance || null,
      priorite: priorite || 'normale',
      fait: false,
      creePar: req.session.user.id,
      creeLe: new Date().toISOString()
    };

    taskArray.push(nouvelleTache);
    writeJSON(TASKS_FILE, taskArray);

    logAction(req.session.user.id, 'creation_tache', { titre });

    res.status(201).json({ success: true, data: nouvelleTache });
  } catch (error) {
    console.error('Erreur création tâche:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de la tâche' });
  }
});

/**
 * PATCH /api/dashboard/tasks/:id
 * Mettre à jour une tâche
 */
router.patch('/tasks/:id', (req, res) => {
  try {
    const tasks = readJSON(TASKS_FILE);
    const taskArray = Array.isArray(tasks) ? tasks : [];
    const index = taskArray.findIndex(t => t.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Tâche non trouvée' });
    }

    const champsModifiables = ['titre', 'description', 'echeance', 'priorite', 'fait'];
    champsModifiables.forEach(champ => {
      if (req.body[champ] !== undefined) {
        taskArray[index][champ] = req.body[champ];
      }
    });
    taskArray[index].modifieLe = new Date().toISOString();

    writeJSON(TASKS_FILE, taskArray);

    logAction(req.session.user.id, 'modification_tache', { id: req.params.id });

    res.json({ success: true, data: taskArray[index] });
  } catch (error) {
    console.error('Erreur modification tâche:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification de la tâche' });
  }
});

/**
 * DELETE /api/dashboard/tasks/:id
 * Supprimer une tâche
 */
router.delete('/tasks/:id', (req, res) => {
  try {
    const tasks = readJSON(TASKS_FILE);
    const taskArray = Array.isArray(tasks) ? tasks : [];
    const index = taskArray.findIndex(t => t.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Tâche non trouvée' });
    }

    taskArray.splice(index, 1);
    writeJSON(TASKS_FILE, taskArray);

    logAction(req.session.user.id, 'suppression_tache', { id: req.params.id });

    res.json({ success: true, data: { message: 'Tâche supprimée' } });
  } catch (error) {
    console.error('Erreur suppression tâche:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de la tâche' });
  }
});

module.exports = router;
