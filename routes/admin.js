const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '..', 'data', 'users', 'users.json');
const LOGS_DIR = path.join(__dirname, '..', 'data', 'logs');

/**
 * GET /api/admin/users
 * Liste tous les utilisateurs (sans les mots de passe)
 */
router.get('/users', (req, res) => {
  try {
    const users = readJSON(USERS_FILE);
    const liste = Array.isArray(users) ? users : [];

    // Retirer les mots de passe
    const usersSansMotDePasse = liste.map(({ password, ...rest }) => rest);

    res.json({ success: true, data: usersSansMotDePasse });
  } catch (error) {
    console.error('Erreur liste utilisateurs:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des utilisateurs' });
  }
});

/**
 * POST /api/admin/users
 * Crée un nouvel utilisateur
 */
router.post('/users', (req, res) => {
  try {
    const { login, password, nom, prenom, email, role } = req.body;

    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'Le login et le mot de passe sont requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    const users = readJSON(USERS_FILE);
    const liste = Array.isArray(users) ? users : [];

    // Vérifier que le login n'existe pas
    if (liste.find(u => u.login === login)) {
      return res.status(400).json({ success: false, error: 'Ce login est déjà utilisé' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const nouvelUtilisateur = {
      id: generateId(),
      login,
      password: hashedPassword,
      nom: nom || '',
      prenom: prenom || '',
      email: email || '',
      role: role || 'utilisateur',
      actif: true,
      creeLe: new Date().toISOString()
    };

    liste.push(nouvelUtilisateur);
    writeJSON(USERS_FILE, liste);

    logAction(req.session.user.id, 'creation_utilisateur', { login });

    // Retourner sans le mot de passe
    const { password: _, ...userSansMotDePasse } = nouvelUtilisateur;
    res.status(201).json({ success: true, data: userSansMotDePasse });
  } catch (error) {
    console.error('Erreur création utilisateur:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de l\'utilisateur' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Met à jour un utilisateur
 */
router.put('/users/:id', (req, res) => {
  try {
    const users = readJSON(USERS_FILE);
    const liste = Array.isArray(users) ? users : [];
    const index = liste.findIndex(u => u.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Vérifier l'unicité du login si modifié
    if (req.body.login && req.body.login !== liste[index].login) {
      if (liste.find(u => u.login === req.body.login)) {
        return res.status(400).json({ success: false, error: 'Ce login est déjà utilisé' });
      }
    }

    const champsModifiables = ['login', 'nom', 'prenom', 'email', 'role', 'actif'];
    champsModifiables.forEach(champ => {
      if (req.body[champ] !== undefined) {
        liste[index][champ] = req.body[champ];
      }
    });

    // Mettre à jour le mot de passe si fourni
    if (req.body.password) {
      if (req.body.password.length < 6) {
        return res.status(400).json({ success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' });
      }
      liste[index].password = bcrypt.hashSync(req.body.password, 10);
    }

    liste[index].modifieLe = new Date().toISOString();
    writeJSON(USERS_FILE, liste);

    logAction(req.session.user.id, 'modification_utilisateur', {
      id: req.params.id,
      login: liste[index].login
    });

    const { password: _, ...userSansMotDePasse } = liste[index];
    res.json({ success: true, data: userSansMotDePasse });
  } catch (error) {
    console.error('Erreur modification utilisateur:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la modification de l\'utilisateur' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Supprime un utilisateur
 */
router.delete('/users/:id', (req, res) => {
  try {
    const users = readJSON(USERS_FILE);
    const liste = Array.isArray(users) ? users : [];
    const index = liste.findIndex(u => u.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Empêcher la suppression de son propre compte
    if (liste[index].id === req.session.user.id) {
      return res.status(400).json({ success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const supprime = liste.splice(index, 1)[0];
    writeJSON(USERS_FILE, liste);

    logAction(req.session.user.id, 'suppression_utilisateur', {
      id: req.params.id,
      login: supprime.login
    });

    res.json({ success: true, data: { message: 'Utilisateur supprimé' } });
  } catch (error) {
    console.error('Erreur suppression utilisateur:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});

/**
 * GET /api/admin/logs
 * Récupère les logs d'actions avec filtre par date
 */
router.get('/logs', (req, res) => {
  try {
    const { date, dateDebut, dateFin } = req.query;

    if (!fs.existsSync(LOGS_DIR)) {
      return res.json({ success: true, data: [] });
    }

    let logFiles = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.json')).sort().reverse();

    // Filtrer par date exacte
    if (date) {
      logFiles = logFiles.filter(f => f === `${date}.json`);
    }

    // Filtrer par plage de dates
    if (dateDebut) {
      logFiles = logFiles.filter(f => f >= `${dateDebut}.json`);
    }
    if (dateFin) {
      logFiles = logFiles.filter(f => f <= `${dateFin}.json`);
    }

    // Par défaut, les 7 derniers jours
    if (!date && !dateDebut && !dateFin) {
      logFiles = logFiles.slice(0, 7);
    }

    let tousLesLogs = [];
    logFiles.forEach(file => {
      const filePath = path.join(LOGS_DIR, file);
      const logs = readJSON(filePath);
      if (Array.isArray(logs)) {
        tousLesLogs = tousLesLogs.concat(logs);
      }
    });

    // Tri par date décroissante
    tousLesLogs.sort((a, b) => (b.timestamp || b.date || '').localeCompare(a.timestamp || a.date || ''));

    res.json({ success: true, data: tousLesLogs });
  } catch (error) {
    console.error('Erreur lecture logs:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des logs' });
  }
});

module.exports = router;
