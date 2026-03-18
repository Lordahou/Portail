const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { readJSON, writeJSON, generateId, logAction } = require('../utils/storage');

const router = express.Router();
const DOCUMENTS_FILE = path.join(__dirname, '..', 'data', 'documents', 'documents.json');
const FOLDERS_FILE = path.join(__dirname, '..', 'data', 'documents', 'folders.json');
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'documents', 'files');

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${generateId()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 Mo max
});

/**
 * GET /api/documents/folders
 * Liste les dossiers
 */
router.get('/folders', (req, res) => {
  try {
    const folders = readJSON(FOLDERS_FILE);
    res.json({ success: true, data: Array.isArray(folders) ? folders : [] });
  } catch (error) {
    console.error('Erreur liste dossiers:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des dossiers' });
  }
});

/**
 * POST /api/documents/folders
 * Crée un nouveau dossier
 */
router.post('/folders', (req, res) => {
  try {
    const { nom, description } = req.body;

    if (!nom) {
      return res.status(400).json({ success: false, error: 'Le nom du dossier est requis' });
    }

    const folders = readJSON(FOLDERS_FILE);
    const liste = Array.isArray(folders) ? folders : [];

    // Vérifier que le nom n'existe pas déjà
    if (liste.find(f => f.nom.toLowerCase() === nom.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Un dossier avec ce nom existe déjà' });
    }

    const nouveauDossier = {
      id: generateId(),
      nom,
      description: description || '',
      creePar: req.session.user.id,
      creeLe: new Date().toISOString()
    };

    liste.push(nouveauDossier);
    writeJSON(FOLDERS_FILE, liste);

    logAction(req.session.user.id, 'creation_dossier', { nom });

    res.status(201).json({ success: true, data: nouveauDossier });
  } catch (error) {
    console.error('Erreur création dossier:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la création du dossier' });
  }
});

/**
 * GET /api/documents
 * Liste tous les documents avec filtres
 */
router.get('/', (req, res) => {
  try {
    const documents = readJSON(DOCUMENTS_FILE);
    let resultats = Array.isArray(documents) ? documents : [];

    const { folder, search } = req.query;

    if (folder) {
      resultats = resultats.filter(d => d.dossier === folder);
    }

    if (search) {
      const terme = search.toLowerCase();
      resultats = resultats.filter(d =>
        (d.nom && d.nom.toLowerCase().includes(terme)) ||
        (d.description && d.description.toLowerCase().includes(terme)) ||
        (d.nomOriginal && d.nomOriginal.toLowerCase().includes(terme))
      );
    }

    // Tri par date décroissante
    resultats.sort((a, b) => (b.creeLe || '').localeCompare(a.creeLe || ''));

    res.json({ success: true, data: resultats });
  } catch (error) {
    console.error('Erreur liste documents:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du chargement des documents' });
  }
});

/**
 * POST /api/documents/upload
 * Upload un fichier
 */
router.post('/upload', upload.single('fichier'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier envoyé' });
    }

    const documents = readJSON(DOCUMENTS_FILE);
    const liste = Array.isArray(documents) ? documents : [];

    const nouveauDocument = {
      id: generateId(),
      nom: req.body.nom || req.file.originalname,
      nomOriginal: req.file.originalname,
      nomFichier: req.file.filename,
      taille: req.file.size,
      mimeType: req.file.mimetype,
      description: req.body.description || '',
      dossier: req.body.dossier || '',
      creePar: req.session.user.id,
      creeLe: new Date().toISOString()
    };

    liste.push(nouveauDocument);
    writeJSON(DOCUMENTS_FILE, liste);

    logAction(req.session.user.id, 'upload_document', {
      nom: nouveauDocument.nom,
      taille: req.file.size
    });

    res.status(201).json({ success: true, data: nouveauDocument });
  } catch (error) {
    console.error('Erreur upload document:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de l\'upload du document' });
  }
});

/**
 * GET /api/documents/:id/download
 * Télécharge un fichier
 */
router.get('/:id/download', (req, res) => {
  try {
    const documents = readJSON(DOCUMENTS_FILE);
    const document = Array.isArray(documents) ? documents.find(d => d.id === req.params.id) : null;

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document non trouvé' });
    }

    const filePath = path.join(UPLOAD_DIR, document.nomFichier);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Fichier introuvable sur le serveur' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.nomOriginal)}"`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Erreur téléchargement document:', error);
    res.status(500).json({ success: false, error: 'Erreur lors du téléchargement' });
  }
});

/**
 * DELETE /api/documents/:id
 * Supprime un document et son fichier
 */
router.delete('/:id', (req, res) => {
  try {
    const documents = readJSON(DOCUMENTS_FILE);
    const liste = Array.isArray(documents) ? documents : [];
    const index = liste.findIndex(d => d.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Document non trouvé' });
    }

    const supprime = liste[index];

    // Supprimer le fichier physique
    const filePath = path.join(UPLOAD_DIR, supprime.nomFichier);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    liste.splice(index, 1);
    writeJSON(DOCUMENTS_FILE, liste);

    logAction(req.session.user.id, 'suppression_document', {
      id: req.params.id,
      nom: supprime.nom
    });

    res.json({ success: true, data: { message: 'Document supprimé' } });
  } catch (error) {
    console.error('Erreur suppression document:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la suppression du document' });
  }
});

module.exports = router;
