const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Créer les répertoires de données au démarrage
const dataDirs = [
  'data/courriers',
  'data/conseil',
  'data/demandes',
  'data/reservations',
  'data/documents',
  'data/documents/files',
  'data/users',
  'data/logs',
  'data/dashboard'
];

dataDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'mairie-secret-dev',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Protection des routes API (sauf login)
app.use('/api', authMiddleware);

// Montage des routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/courriers', require('./routes/courriers'));
app.use('/api/conseil', require('./routes/conseil'));
app.use('/api/demandes', require('./routes/demandes'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin', require('./routes/admin'));

// Route par défaut - servir l'application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({ success: false, error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Portail Mairie démarré sur le port ${PORT}`);
});
