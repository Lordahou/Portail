const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Lit un fichier JSON et retourne son contenu
 * Retourne un tableau vide ou objet vide si le fichier n'existe pas
 */
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return filePath.endsWith('.json') ? [] : {};
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    if (!data.trim()) {
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    console.error(`Erreur lecture JSON ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Écrit des données dans un fichier JSON avec indentation
 */
function writeJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Erreur écriture JSON ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Génère un identifiant unique (UUID v4)
 */
function generateId() {
  return uuidv4();
}

/**
 * Enregistre une action dans le journal quotidien
 */
function logAction(userId, action, details) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logDir = path.join(__dirname, '..', 'data', 'logs');
    const logFile = path.join(logDir, `${today}.json`);

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logs = readJSON(logFile);
    if (!Array.isArray(logs)) {
      // Si le fichier existe mais n'est pas un tableau
    }

    const logEntry = {
      id: generateId(),
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    };

    const logArray = Array.isArray(logs) ? logs : [];
    logArray.push(logEntry);
    writeJSON(logFile, logArray);
  } catch (error) {
    console.error('Erreur enregistrement log:', error.message);
  }
}

module.exports = {
  readJSON,
  writeJSON,
  generateId,
  logAction
};
