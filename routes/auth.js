const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const USERS_FILE = path.join(__dirname, '..', 'data', 'users', 'users.json');

/**
 * Initialise l'utilisateur admin par défaut si le fichier n'existe pas
 */
function initDefaultAdmin() {
  if (!fs.existsSync(USERS_FILE)) {
    const hashedPassword = bcrypt.hashSync('mairie2024', 10);
    const defaultUsers = [
      {
        id: generateId(),
        login: 'admin',
        password: hashedPassword,
        nom: 'Administrateur',
        prenom: 'Admin',
        role: 'admin',
        email: 'admin@mairie.fr',
        actif: true,
        creeLe: new Date().toISOString()
      }
    ];
    writeJSON(USERS_FILE, defaultUsers);
    console.log('Utilisateur admin par défaut créé (login: admin, mot de passe: mairie2024)');
  }
}

// Initialiser au chargement du module
initDefaultAdmin();

/**
 * POST /api/auth/login
 * Authentification de l'utilisateur
 */
router.post('/login', (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({
        success: false,
        error: 'Login et mot de passe requis'
      });
    }

    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.login === login);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Identifiants invalides'
      });
    }

    if (!user.actif) {
      return res.status(403).json({
        success: false,
        error: 'Compte désactivé. Contactez l\'administrateur.'
      });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        error: 'Identifiants invalides'
      });
    }

    // Stocker l'utilisateur en session (sans le mot de passe)
    const { password: _, ...userSansMotDePasse } = user;
    req.session.user = userSansMotDePasse;

    logAction(user.id, 'connexion', { login: user.login });

    res.json({
      success: true,
      data: userSansMotDePasse
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la connexion' });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion
 */
router.post('/logout', (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    if (userId) {
      logAction(userId, 'deconnexion', {});
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Erreur lors de la déconnexion' });
      }
      res.json({ success: true, data: { message: 'Déconnexion réussie' } });
    });
  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la déconnexion' });
  }
});

/**
 * GET /api/auth/me
 * Retourne les informations de l'utilisateur connecté
 */
router.get('/me', (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Non authentifié'
      });
    }

    res.json({
      success: true,
      data: req.session.user
    });
  } catch (error) {
    console.error('Erreur /me:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
