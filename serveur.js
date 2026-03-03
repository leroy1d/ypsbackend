// backend/serveur.js
const express = require('express');
const mysql = require('mysql2'); // On garde mysql2 mais on utilise createPool
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Configuration CORS
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json());

// IMPORTANT: Exporter l'app pour Vercel
module.exports = app;

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📨 [${timestamp}] ${req.method} ${req.url}`);
  next();
});

// Servir les fichiers statiques
app.use('/uploads', express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuration de Multer pour l'upload des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const mimeTypes = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4', '.pdf': 'application/pdf',
      '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    const ext = path.extname(file.originalname).toLowerCase();
    if (mimeTypes[ext]) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non supporté: ${ext}`), false);
    }
  }
});

// ==================== CRÉATION DU POOL DE CONNEXIONS MYSQL ====================
const pool = mysql.createPool({
  host: 'bu2lzbc2luiolb9b29j8-mysql.services.clever-cloud.com',
  user: 'uknuhxtgvt1juuse',
  password: 'wNbYSj927pYX2K5s6nDB',
  database: 'bu2lzbc2luiolb9b29j8',
  port: 3306,
   waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000
});

// Promisify pour utiliser async/await
const promisePool = pool.promise();

// Tester la connexion au démarrage
async function testConnection() {
  try {
    const [rows] = await promisePool.query('SELECT 1 + 1 AS solution');
    console.log('✅ Connecté à MySQL avec succès. Test:', rows[0].solution);
    return true;
  } catch (err) {
    console.error('❌ ERREUR MYSQL:', err.message);
    return false;
  }
}

// Initialiser la base de données
async function initialiserBaseDeDonnees() {
  console.log('🗄️ Initialisation de la base de données...');

  try {
    // Liste des tables à créer
    const tables = [
      {
        name: 'admins',
        sql: `CREATE TABLE IF NOT EXISTS admins (
          id INT PRIMARY KEY AUTO_INCREMENT,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          nom VARCHAR(100) NOT NULL,
          role ENUM('superadmin', 'admin') DEFAULT 'admin',
          photo VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'benevoles',
        sql: `CREATE TABLE IF NOT EXISTS benevoles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nom VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          telephone VARCHAR(20),
          competences TEXT,
          disponibilite ENUM('ponctuel', 'regulier') DEFAULT 'ponctuel',
          statut ENUM('actif', 'inactif') DEFAULT 'actif',
          photo VARCHAR(255),
          date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'membres',
        sql: `CREATE TABLE IF NOT EXISTS membres (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nom VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          date_adhesion DATE,
          cotisation_payee BOOLEAN DEFAULT false,
          photo VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'actions',
        sql: `CREATE TABLE IF NOT EXISTS actions (
          id INT PRIMARY KEY AUTO_INCREMENT,
          titre VARCHAR(200) NOT NULL,
          description TEXT,
          type ENUM('urgence', 'developpement', 'education', 'sante', 'eau', 'alimentaire') DEFAULT 'developpement',
          date_debut DATE,
          date_fin DATE,
          budget DECIMAL(10,2),
          statut ENUM('planifie', 'en_cours', 'termine', 'suspendu', 'annule') DEFAULT 'planifie',
          photos TEXT,
          videos TEXT,
          pays VARCHAR(100),
          localisation VARCHAR(200),
          partenaires TEXT,
          is_featured BOOLEAN DEFAULT false,
          ordre INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'articles',
        sql: `CREATE TABLE IF NOT EXISTS articles (
          id INT PRIMARY KEY AUTO_INCREMENT,
          titre VARCHAR(200) NOT NULL,
          contenu TEXT,
          auteur VARCHAR(100),
          categorie VARCHAR(50),
          image_url VARCHAR(255),
          images TEXT,
          publie BOOLEAN DEFAULT false,
          resume TEXT,
          mots_cles TEXT,
          vues INT DEFAULT 0,
          likes INT DEFAULT 0,
          is_featured BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'settings_site',
        sql: `CREATE TABLE IF NOT EXISTS settings_site (
          id INT PRIMARY KEY AUTO_INCREMENT,
          cle VARCHAR(100) UNIQUE NOT NULL,
          valeur TEXT,
          type VARCHAR(50) DEFAULT 'texte',
          categorie VARCHAR(100),
          description TEXT,
          ordre INT DEFAULT 0,
          groupe VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
      },
      {
        name: 'causes',
        sql: `CREATE TABLE IF NOT EXISTS causes (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nom VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          icone VARCHAR(500),
          nb_projets INT DEFAULT 0,
          nb_projets_termines INT DEFAULT 0,
          statut ENUM('actif', 'inactif') DEFAULT 'actif',
          ordre INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`
      }
    ];

    // Créer chaque table
    for (const table of tables) {
      try {
        await promisePool.query(table.sql);
        console.log(`✅ Table ${table.name} créée/vérifiée`);
      } catch (err) {
        console.error(`❌ Erreur création table ${table.name}:`, err.message);
      }
    }

    // Créer admin par défaut
    await creerAdminParDefaut();

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
  }
}

async function creerAdminParDefaut() {
  try {
    console.log('👤 Création admin par défaut...');
    const adminPassword = bcrypt.hashSync('admin123', 8);

    const [result] = await promisePool.query(
      `INSERT IGNORE INTO admins (email, password, nom, role) 
       VALUES (?, ?, ?, ?)`,
      ['admin@association.org', adminPassword, 'Admin Principal', 'superadmin']
    );

    if (result.affectedRows > 0) {
      console.log('✅ Admin par défaut créé');
      console.log('   Email: admin@association.org');
      console.log('   Password: admin123');
    } else {
      console.log('ℹ️ Admin par défaut existe déjà');
    }
  } catch (err) {
    console.error('❌ Erreur création admin:', err.message);
  }
}

// Tester la connexion et initialiser
testConnection().then(isConnected => {
  if (isConnected) {
    initialiserBaseDeDonnees();
  }
});

// ==================== MIDDLEWARE DE VÉRIFICATION DE CONNEXION ====================
// Ce middleware vérifie que la connexion est active avant chaque requête
app.use(async (req, res, next) => {
  try {
    // Test simple de la connexion
    await promisePool.query('SELECT 1');
    next();
  } catch (err) {
    console.error('❌ Erreur de connexion MySQL:', err.message);
    // Ne pas bloquer, mais logger l'erreur
    next();
  }
});

// ==================== MIDDLEWARE D'AUTHENTIFICATION ====================
const authentifierToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Format token invalide' });
  }
  jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// ==================== FONCTION UTILITAIRE POUR LES REQUÊTES SQL ====================
// Cette fonction remplace db.query partout
async function query(sql, params) {
  try {
    const [results] = await promisePool.query(sql, params);
    return results;
  } catch (err) {
    console.error('❌ Erreur SQL:', err.message);
    console.error('   SQL:', sql);
    console.error('   Params:', params);
    throw err;
  }
}

// ==================== ROUTES ====================

// Route de test
app.get('/api/test', async (req, res) => {
  try {
    const results = await query('SELECT 1 + 1 AS solution');
    res.json({
      message: 'Serveur fonctionnel',
      timestamp: new Date().toISOString(),
      mysql: 'Connecté',
      test: results[0].solution
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route pour les paramètres frontend (CORRIGÉE)
app.get('/api/frontend/settings', async (req, res) => {
  console.log('🌐 Frontend - Récupération des paramètres');

  try {
    // Vérifier si la table existe
    const tables = await query("SHOW TABLES LIKE 'settings_site'");

    const defaultSettings = {
      site_title: 'YPSNC/CNJPS',
      site_slogan: 'ensemble pour un cameroun de Paix en Paix',
      footer_description: 'Les jeunes au cœur de la paix et de la sécurité',
      contact_address: '7250',
      contact_phone: '678474295',
      contact_email: 'muskleroy@gmail.com',
      contact_hours: '',
      facebook_url: '',
      twitter_url: '',
      instagram_url: '',
      linkedin_url: '',
      youtube_url: '',
      hero_backgrounds: []
    };

    if (tables.length === 0) {
      console.log('ℹ️ Table settings_site non trouvée, retour valeurs par défaut');
      return res.json(defaultSettings);
    }

    // Récupérer tous les paramètres
    const results = await query('SELECT cle, valeur FROM settings_site');

    const settings = { ...defaultSettings };
    const heroBackgrounds = [];

    results.forEach(row => {
      if (row.cle.startsWith('hero_background_')) {
        heroBackgrounds.push(row.valeur);
      } else {
        settings[row.cle] = row.valeur;
      }
    });

    settings.hero_backgrounds = heroBackgrounds.sort();

    console.log('✅ Paramètres envoyés au frontend avec', heroBackgrounds.length, 'backgrounds');
    res.json(settings);

  } catch (error) {
    console.error('❌ Erreur récupération paramètres:', error.message);
    // En cas d'erreur, retourner les valeurs par défaut
    res.json({
      site_title: 'YPSNC/CNJPS',
      site_slogan: 'ensemble pour un cameroun de Paix en Paix',
      footer_description: 'Les jeunes au cœur de la paix et de la sécurité',
      contact_address: '7250',
      contact_phone: '678474295',
      contact_email: 'muskleroy@gmail.com',
      hero_backgrounds: []
    });
  }
});

// Route pour les causes (exemple de conversion)
app.get('/api/admin/causes', async (req, res) => {
  console.log('📋 Récupération liste causes (admin)');

  try {
    const results = await query('SELECT * FROM causes ORDER BY ordre ASC, created_at DESC');

    const causesWithFullUrls = results.map(cause => ({
      ...cause,
      icone: cause.icone ? `https://ypsbackend.vercel.app${cause.icone}` : null
    }));

    console.log(`✅ Causes envoyées (admin): ${results.length} cause(s)`);
    res.json(causesWithFullUrls);

  } catch (err) {
    console.error('❌ Erreur SQL causes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route pour récupérer un paramètre spécifique
app.get('/api/settings/:key', async (req, res) => {
  const key = req.params.key;
  console.log(`⚙️ Récupération paramètre: ${key}`);

  try {
    const results = await query('SELECT * FROM settings_site WHERE cle = ?', [key]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }

    console.log(`✅ Paramètre ${key} récupéré`);
    res.json(results[0]);

  } catch (err) {
    console.error('❌ Erreur SQL récupération paramètre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route pour sauvegarder un paramètre
app.post('/api/settings', authentifierToken, async (req, res) => {
  const { cle, valeur, type, categorie, description } = req.body;

  if (!cle) {
    return res.status(400).json({ error: 'Clé requise' });
  }

  console.log(`⚙️ Sauvegarde paramètre: ${cle}`);

  try {
    // Créer la table si elle n'existe pas
    await query(`
      CREATE TABLE IF NOT EXISTS settings_site (
        id INT PRIMARY KEY AUTO_INCREMENT,
        cle VARCHAR(100) UNIQUE NOT NULL,
        valeur TEXT,
        type VARCHAR(50) DEFAULT 'texte',
        categorie VARCHAR(100),
        description TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    const sql = `
      INSERT INTO settings_site (cle, valeur, type, categorie, description) 
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        valeur = VALUES(valeur),
        type = VALUES(type),
        categorie = VALUES(categorie),
        description = VALUES(description)
    `;

    await query(sql, [cle, valeur, type || 'texte', categorie || null, description || null]);

    console.log(`✅ Paramètre ${cle} sauvegardé`);
    res.json({ success: true, message: 'Paramètre sauvegardé' });

  } catch (err) {
    console.error('❌ Erreur SQL sauvegarde paramètre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Route pour le login
app.post('/api/login', async (req, res) => {
  console.log('🔑 Tentative de connexion');

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const results = await query('SELECT * FROM admins WHERE email = ?', [email]);

    if (results.length === 0) {
      return res.status(401).json({ error: 'Email incorrect' });
    }

    const user = results[0];
    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '24h' }
    );

    console.log('✅ Connexion réussie pour:', user.email);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        role: user.role
      }
    });

  } catch (err) {
    console.error('❌ Erreur SQL login:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES POUR LE FRONTEND ====================

// GET - Récupérer les actions pour la page d'accueil
app.get('/api/frontend/actions', async (req, res) => {
  console.log('🌐 Frontend - Récupération des actions');

  try {
    const results = await query(`
      SELECT 
        id, 
        titre, 
        description, 
        type, 
        date_debut, 
        date_fin, 
        statut,
        photos,
        pays,
        localisation,
        is_featured,
        ordre
      FROM actions 
      WHERE statut IN ('en_cours', 'termine')
      ORDER BY ordre ASC, date_debut DESC
      LIMIT 10
    `);

    // Convertir les photos JSON si nécessaire
    const actions = results.map(action => {
      let photos = [];
      if (action.photos) {
        try {
          const parsed = JSON.parse(action.photos);
          if (Array.isArray(parsed)) {
            photos = parsed;
          } else if (typeof parsed === 'string') {
            photos = [parsed];
          }
        } catch (error) {
          if (typeof action.photos === 'string' &&
            (action.photos.includes('.jpg') ||
              action.photos.includes('.png') ||
              action.photos.includes('.webp'))) {
            photos = [action.photos];
          }
        }
      }
      return {
        ...action,
        photos: photos
      };
    });

    console.log(`✅ ${actions.length} action(s) envoyées au frontend`);
    res.json(actions);
  } catch (err) {
    console.error('❌ Erreur SQL récupération actions frontend:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer les causes pour le frontend
app.get('/api/frontend/causes', async (req, res) => {
  console.log('🌐 Frontend - Récupération des causes');

  const { limit = 5 } = req.query;

  try {
    const results = await query(`
      SELECT 
        id,
        nom,
        description,
        icone,
        nb_projets,
        nb_projets_termines,
        statut,
        ordre,
        created_at
      FROM causes 
      WHERE statut = 'actif'
      ORDER BY ordre ASC
      LIMIT ?
    `, [parseInt(limit)]);

    // Convertir les chemins d'images en URLs complètes
    const causesWithUrls = results.map(cause => ({
      ...cause,
      icone: cause.icone ? `https://ypsbackend.vercel.app${cause.icone}` : null
    }));

    console.log(`✅ ${results.length} cause(s) envoyées au frontend`);
    res.json(causesWithUrls);
  } catch (err) {
    console.error('❌ Erreur SQL récupération causes frontend:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer les FAQ pour le frontend
app.get('/api/frontend/faq', async (req, res) => {
  console.log('🌐 Frontend - Récupération des FAQ');

  try {
    const results = await query(`
      SELECT 
        id, 
        question, 
        reponse, 
        categorie,
        ordre
      FROM faq 
      WHERE actif = TRUE
      ORDER BY ordre ASC, categorie
      LIMIT 20
    `);

    console.log(`✅ ${results.length} FAQ envoyées au frontend`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur SQL récupération FAQ:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 1. Ajouter une route pour vérifier l'état de santé de l'API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mysql: pool._closed ? 'disconnected' : 'connected'
  });
});

// 3. Ajouter un mécanisme de reconnexion automatique
pool.on('error', (err) => {
  console.error('❌ Erreur pool MySQL:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('🔄 Tentative de reconnexion...');
    // La reconnexion est automatique avec pool
  }
});

// GET - Récupérer le logo
app.get('/api/logo', async (req, res) => {
  console.log('🖼️ Récupération du logo');

  try {
    // Vérifier si la table settings_site existe
    const tables = await query("SHOW TABLES LIKE 'settings_site'");

    if (tables.length === 0) {
      console.log('ℹ️ Table paramètres non trouvée, retour logo par défaut');
      return res.json({
        logo_url: '/assets/logo-default.png',
        description: 'Logo par défaut',
        is_default: true
      });
    }

    const results = await query("SELECT * FROM settings_site WHERE cle = 'logo_url'");

    if (results.length === 0) {
      console.log('ℹ️ Logo non configuré, retour logo par défaut');
      return res.json({
        logo_url: '/assets/logo-default.png',
        description: 'Logo par défaut',
        is_default: true
      });
    }

    console.log('✅ Logo récupéré');
    res.json({
      logo_url: results[0].valeur,
      description: results[0].description,
      updated_at: results[0].updated_at,
      is_default: false
    });
  } catch (err) {
    console.error('❌ Erreur récupération logo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer les données de transparence
app.get('/api/frontend/transparence', async (req, res) => {
  console.log('🌐 Frontend - Récupération des données de transparence');

  // Données statiques pour la transparence
  const transparenceData = [
    { type: 'utilisation_fonds', label: 'Missions humanitaires', valeur: '92%' },
    { type: 'utilisation_fonds', label: 'Frais de fonctionnement', valeur: '5%' },
    { type: 'utilisation_fonds', label: 'Collecte de fonds', valeur: '3%' }
  ];

  console.log(`✅ Données de transparence envoyées au frontend`);
  res.json(transparenceData);
});

// ==================== ROUTES POUR LES BÉNÉVOLES ====================

// GET - Récupérer tous les bénévoles
app.get('/api/benevoles', async (req, res) => {
  console.log('📋 Récupération des bénévoles');

  try {
    const results = await query('SELECT * FROM benevoles ORDER BY date_inscription DESC');
    console.log(`✅ ${results.length} bénévole(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération bénévoles:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un bénévole
app.post('/api/benevoles', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un bénévole');

  const { nom, email, telephone, competences, disponibilite, statut } = req.body;

  if (!nom || !email) {
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  try {
    const sql = `
      INSERT INTO benevoles (nom, email, telephone, competences, disponibilite, statut)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [nom, email, telephone, competences, disponibilite, statut || 'actif']);

    console.log(`✅ Bénévole ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Bénévole ajouté avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout bénévole:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier un bénévole
app.put('/api/benevoles/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification bénévole ID: ${id}`);

  const { nom, email, telephone, competences, disponibilite, statut } = req.body;

  try {
    const sql = `
      UPDATE benevoles 
      SET nom = ?, email = ?, telephone = ?, competences = ?, disponibilite = ?, statut = ?
      WHERE id = ?
    `;

    await query(sql, [nom, email, telephone, competences, disponibilite, statut, id]);

    console.log(`✅ Bénévole ${id} modifié`);
    res.json({ success: true, message: 'Bénévole modifié' });
  } catch (err) {
    console.error('❌ Erreur modification bénévole:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Changer le statut d'un bénévole
app.put('/api/benevoles/:id/statut', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🔄 Changement statut bénévole ID: ${id}`);

  const { statut } = req.body;

  try {
    await query('UPDATE benevoles SET statut = ? WHERE id = ?', [statut, id]);
    console.log(`✅ Statut bénévole ${id} mis à jour: ${statut}`);
    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (err) {
    console.error('❌ Erreur changement statut:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un bénévole
app.delete('/api/benevoles/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression bénévole ID: ${id}`);

  try {
    await query('DELETE FROM benevoles WHERE id = ?', [id]);
    console.log(`✅ Bénévole ${id} supprimé`);
    res.json({ success: true, message: 'Bénévole supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression bénévole:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES MEMBRES ====================

// GET - Récupérer tous les membres
app.get('/api/membres', async (req, res) => {
  console.log('📋 Récupération des membres');

  try {
    const results = await query('SELECT * FROM membres ORDER BY created_at DESC');
    console.log(`✅ ${results.length} membre(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération membres:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un membre
app.post('/api/membres', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un membre');

  const { nom, email, date_adhesion, cotisation_payee } = req.body;

  if (!nom || !email) {
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  try {
    const sql = `
      INSERT INTO membres (nom, email, date_adhesion, cotisation_payee)
      VALUES (?, ?, ?, ?)
    `;

    const result = await query(sql, [nom, email, date_adhesion, cotisation_payee || false]);

    console.log(`✅ Membre ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Membre ajouté avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout membre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier un membre
app.put('/api/membres/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification membre ID: ${id}`);

  const { nom, email, date_adhesion, cotisation_payee } = req.body;

  try {
    const sql = `
      UPDATE membres 
      SET nom = ?, email = ?, date_adhesion = ?, cotisation_payee = ?
      WHERE id = ?
    `;

    await query(sql, [nom, email, date_adhesion, cotisation_payee, id]);

    console.log(`✅ Membre ${id} modifié`);
    res.json({ success: true, message: 'Membre modifié' });
  } catch (err) {
    console.error('❌ Erreur modification membre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Changer le statut de cotisation d'un membre
app.put('/api/membres/:id/cotisation', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🔄 Changement cotisation membre ID: ${id}`);

  const { cotisation_payee } = req.body;

  try {
    await query('UPDATE membres SET cotisation_payee = ? WHERE id = ?', [cotisation_payee, id]);
    console.log(`✅ Cotisation membre ${id} mise à jour: ${cotisation_payee}`);
    res.json({ success: true, message: 'Statut de cotisation mis à jour' });
  } catch (err) {
    console.error('❌ Erreur changement cotisation:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un membre
app.delete('/api/membres/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression membre ID: ${id}`);

  try {
    await query('DELETE FROM membres WHERE id = ?', [id]);
    console.log(`✅ Membre ${id} supprimé`);
    res.json({ success: true, message: 'Membre supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression membre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES DONS ====================

// GET - Récupérer tous les dons
app.get('/api/dons', async (req, res) => {
  console.log('📋 Récupération des dons');

  try {
    const results = await query('SELECT * FROM dons ORDER BY date_don DESC');
    console.log(`✅ ${results.length} don(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération dons:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Statistiques des dons
app.get('/api/dons/stats', async (req, res) => {
  console.log('📊 Récupération stats dons');

  try {
    const total = await query('SELECT COUNT(*) as count, SUM(montant) as total FROM dons WHERE statut = "valide"');
    const parMois = await query(`
      SELECT DATE_FORMAT(date_don, '%Y-%m') as mois, 
             COUNT(*) as count, 
             SUM(montant) as total 
      FROM dons 
      WHERE statut = "valide" 
      GROUP BY mois 
      ORDER BY mois DESC 
      LIMIT 6
    `);

    res.json({
      total_dons: total[0].count || 0,
      total_montant: total[0].total || 0,
      par_mois: parMois
    });
  } catch (err) {
    console.error('❌ Erreur stats dons:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer un don spécifique
app.get('/api/dons/:id', async (req, res) => {
  const id = req.params.id;
  console.log(`🔍 Récupération don ID: ${id}`);

  try {
    const results = await query('SELECT * FROM dons WHERE id = ?', [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Don non trouvé' });
    }

    res.json(results[0]);
  } catch (err) {
    console.error('❌ Erreur récupération don:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un don
app.post('/api/dons', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un don');

  const { donateur_nom, email, montant, devise, methode_paiement, projet_associe, statut, notes } = req.body;

  if (!donateur_nom || !montant) {
    return res.status(400).json({ error: 'Nom du donateur et montant requis' });
  }

  try {
    const sql = `
      INSERT INTO dons (donateur_nom, email, montant, devise, methode_paiement, projet_associe, statut, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Dans la route POST /api/dons
    const result = await query(sql, [
      donateur_nom,
      email,
      montant,
      devise || 'EUR',
      methode_paiement || 'carte',
      projet_associe,
      statut || 'en_attente',
      notes || ''  // notes peut être vide mais pas null
    ]);

    console.log(`✅ Don ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Don ajouté avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout don:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier un don
app.put('/api/dons/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification don ID: ${id}`);

  const { donateur_nom, email, montant, devise, methode_paiement, projet_associe, statut, notes, reçu_fiscal_envoye } = req.body;

  try {
    const sql = `
      UPDATE dons 
      SET donateur_nom = ?, email = ?, montant = ?, devise = ?, 
          methode_paiement = ?, projet_associe = ?, statut = ?, 
          notes = ?, reçu_fiscal_envoye = ?
      WHERE id = ?
    `;

    await query(sql, [
      donateur_nom, email, montant, devise,
      methode_paiement, projet_associe, statut,
      notes, reçu_fiscal_envoye || false, id
    ]);

    console.log(`✅ Don ${id} modifié`);
    res.json({ success: true, message: 'Don modifié' });
  } catch (err) {
    console.error('❌ Erreur modification don:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Changer le statut d'un don
app.put('/api/dons/:id/statut', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🔄 Changement statut don ID: ${id}`);

  const { statut, reçu_fiscal_envoye } = req.body;

  try {
    await query(
      'UPDATE dons SET statut = ?, reçu_fiscal_envoye = ? WHERE id = ?',
      [statut, reçu_fiscal_envoye || false, id]
    );
    console.log(`✅ Statut don ${id} mis à jour: ${statut}`);
    res.json({ success: true, message: 'Statut mis à jour' });
  } catch (err) {
    console.error('❌ Erreur changement statut don:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un don
app.delete('/api/dons/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression don ID: ${id}`);

  try {
    await query('DELETE FROM dons WHERE id = ?', [id]);
    console.log(`✅ Don ${id} supprimé`);
    res.json({ success: true, message: 'Don supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression don:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES ARTICLES ====================

// GET - Récupérer tous les articles
app.get('/api/articles', async (req, res) => {
  console.log('📋 Récupération des articles');

  try {
    const results = await query('SELECT * FROM articles ORDER BY created_at DESC');
    console.log(`✅ ${results.length} article(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération articles:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Récupérer un article spécifique
app.get('/api/articles/:id', async (req, res) => {
  const id = req.params.id;
  console.log(`🔍 Récupération article ID: ${id}`);

  try {
    const results = await query('SELECT * FROM articles WHERE id = ?', [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }

    res.json(results[0]);
  } catch (err) {
    console.error('❌ Erreur récupération article:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un article
app.post('/api/articles', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un article');

  const { titre, contenu, auteur, categorie, image_url, images, resume, mots_cles, publie, vues, likes, is_featured } = req.body;

  if (!titre || !contenu) {
    return res.status(400).json({ error: 'Titre et contenu requis' });
  }

  try {
    const sql = `
      INSERT INTO articles (titre, contenu, auteur, categorie, image_url, images, resume, mots_cles, publie, vues, likes, is_featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      titre, contenu, auteur, categorie, image_url, images, resume, mots_cles,
      publie || false, vues || 0, likes || 0, is_featured || false
    ]);

    console.log(`✅ Article ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Article ajouté avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout article:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier un article
app.put('/api/articles/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification article ID: ${id}`);

  const { titre, contenu, auteur, categorie, image_url, images, resume, mots_cles, publie, vues, likes, is_featured } = req.body;

  try {
    const sql = `
      UPDATE articles 
      SET titre = ?, contenu = ?, auteur = ?, categorie = ?, image_url = ?, 
          images = ?, resume = ?, mots_cles = ?, publie = ?, vues = ?, likes = ?, is_featured = ?
      WHERE id = ?
    `;

    await query(sql, [
      titre, contenu, auteur, categorie, image_url, images, resume, mots_cles,
      publie, vues, likes, is_featured, id
    ]);

    console.log(`✅ Article ${id} modifié`);
    res.json({ success: true, message: 'Article modifié' });
  } catch (err) {
    console.error('❌ Erreur modification article:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un article
app.delete('/api/articles/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression article ID: ${id}`);

  try {
    await query('DELETE FROM articles WHERE id = ?', [id]);
    console.log(`✅ Article ${id} supprimé`);
    res.json({ success: true, message: 'Article supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression article:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES ACTIONS ====================

// GET - Récupérer toutes les actions
app.get('/api/actions', async (req, res) => {
  console.log('📋 Récupération des actions');

  try {
    const results = await query('SELECT * FROM actions ORDER BY created_at DESC');
    console.log(`✅ ${results.length} action(s) récupérée(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération actions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter une action
app.post('/api/actions', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'une action');

  const { titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires, is_featured, ordre } = req.body;

  if (!titre || !description) {
    return res.status(400).json({ error: 'Titre et description requis' });
  }

  try {
    const sql = `
      INSERT INTO actions (titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires, is_featured, ordre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      titre, description, type, date_debut, date_fin, budget, statut, photos, videos,
      pays, localisation, partenaires, is_featured || false, ordre || 0
    ]);

    console.log(`✅ Action ajoutée avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Action ajoutée avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout action:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier une action
app.put('/api/actions/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification action ID: ${id}`);

  const { titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires, is_featured, ordre } = req.body;

  try {
    const sql = `
      UPDATE actions 
      SET titre = ?, description = ?, type = ?, date_debut = ?, date_fin = ?, budget = ?, 
          statut = ?, photos = ?, videos = ?, pays = ?, localisation = ?, partenaires = ?, 
          is_featured = ?, ordre = ?
      WHERE id = ?
    `;

    await query(sql, [
      titre, description, type, date_debut, date_fin, budget, statut, photos, videos,
      pays, localisation, partenaires, is_featured, ordre, id
    ]);

    console.log(`✅ Action ${id} modifiée`);
    res.json({ success: true, message: 'Action modifiée' });
  } catch (err) {
    console.error('❌ Erreur modification action:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer une action
app.delete('/api/actions/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression action ID: ${id}`);

  try {
    await query('DELETE FROM actions WHERE id = ?', [id]);
    console.log(`✅ Action ${id} supprimée`);
    res.json({ success: true, message: 'Action supprimée' });
  } catch (err) {
    console.error('❌ Erreur suppression action:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES CATÉGORIES ====================

// GET - Récupérer toutes les catégories
app.get('/api/categories', async (req, res) => {
  console.log('📋 Récupération des catégories');

  try {
    const results = await query('SELECT * FROM categories ORDER BY ordre ASC');
    console.log(`✅ ${results.length} catégorie(s) récupérée(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération catégories:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter une catégorie
app.post('/api/categories', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'une catégorie');

  const { nom, description, icone, couleur, ordre } = req.body;

  if (!nom) {
    return res.status(400).json({ error: 'Nom de catégorie requis' });
  }

  try {
    const sql = `
      INSERT INTO categories (nom, description, icone, couleur, ordre)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [nom, description, icone, couleur || '#3498DB', ordre || 0]);

    console.log(`✅ Catégorie ajoutée avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Catégorie ajoutée avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout catégorie:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier une catégorie
app.put('/api/categories/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification catégorie ID: ${id}`);

  const { nom, description, icone, couleur, ordre } = req.body;

  try {
    const sql = `
      UPDATE categories 
      SET nom = ?, description = ?, icone = ?, couleur = ?, ordre = ?
      WHERE id = ?
    `;

    await query(sql, [nom, description, icone, couleur, ordre, id]);

    console.log(`✅ Catégorie ${id} modifiée`);
    res.json({ success: true, message: 'Catégorie modifiée' });
  } catch (err) {
    console.error('❌ Erreur modification catégorie:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer une catégorie
app.delete('/api/categories/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression catégorie ID: ${id}`);

  try {
    await query('DELETE FROM categories WHERE id = ?', [id]);
    console.log(`✅ Catégorie ${id} supprimée`);
    res.json({ success: true, message: 'Catégorie supprimée' });
  } catch (err) {
    console.error('❌ Erreur suppression catégorie:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES TÉMOIGNAGES ====================

// GET - Récupérer tous les témoignages
app.get('/api/temoignages', async (req, res) => {
  console.log('📋 Récupération des témoignages');

  try {
    const results = await query('SELECT * FROM temoignages ORDER BY created_at DESC');
    console.log(`✅ ${results.length} témoignage(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération témoignages:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un témoignage
app.post('/api/temoignages', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un témoignage');

  const { nom, fonction, pays, contenu, note, projet_id, photo_url, approuve } = req.body;

  if (!nom || !contenu) {
    return res.status(400).json({ error: 'Nom et contenu requis' });
  }

  try {
    const sql = `
      INSERT INTO temoignages (nom, fonction, pays, contenu, note, projet_id, photo_url, approuve)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [nom, fonction, pays, contenu, note || 5, projet_id, photo_url, approuve || false]);

    console.log(`✅ Témoignage ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Témoignage ajouté avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout témoignage:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier un témoignage
app.put('/api/temoignages/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification témoignage ID: ${id}`);

  const { nom, fonction, pays, contenu, note, projet_id, photo_url, approuve } = req.body;

  try {
    const sql = `
      UPDATE temoignages 
      SET nom = ?, fonction = ?, pays = ?, contenu = ?, note = ?, projet_id = ?, photo_url = ?, approuve = ?
      WHERE id = ?
    `;

    await query(sql, [nom, fonction, pays, contenu, note, projet_id, photo_url, approuve, id]);

    console.log(`✅ Témoignage ${id} modifié`);
    res.json({ success: true, message: 'Témoignage modifié' });
  } catch (err) {
    console.error('❌ Erreur modification témoignage:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un témoignage
app.delete('/api/temoignages/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression témoignage ID: ${id}`);

  try {
    await query('DELETE FROM temoignages WHERE id = ?', [id]);
    console.log(`✅ Témoignage ${id} supprimé`);
    res.json({ success: true, message: 'Témoignage supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression témoignage:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LA FAQ ====================

// GET - Récupérer toutes les FAQ
app.get('/api/faq', async (req, res) => {
  console.log('📋 Récupération des FAQ');

  try {
    const results = await query('SELECT * FROM faq ORDER BY ordre ASC, created_at DESC');
    console.log(`✅ ${results.length} FAQ(s) récupérée(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération FAQ:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter une FAQ
app.post('/api/faq', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'une FAQ');

  const { question, reponse, categorie, ordre, actif } = req.body;

  if (!question || !reponse) {
    return res.status(400).json({ error: 'Question et réponse requis' });
  }

  try {
    const sql = `
      INSERT INTO faq (question, reponse, categorie, ordre, actif)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [question, reponse, categorie || 'general', ordre || 0, actif !== false]);

    console.log(`✅ FAQ ajoutée avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'FAQ ajoutée avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout FAQ:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier une FAQ
app.put('/api/faq/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification FAQ ID: ${id}`);

  const { question, reponse, categorie, ordre, actif } = req.body;

  try {
    const sql = `
      UPDATE faq 
      SET question = ?, reponse = ?, categorie = ?, ordre = ?, actif = ?
      WHERE id = ?
    `;

    await query(sql, [question, reponse, categorie, ordre, actif, id]);

    console.log(`✅ FAQ ${id} modifiée`);
    res.json({ success: true, message: 'FAQ modifiée' });
  } catch (err) {
    console.error('❌ Erreur modification FAQ:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer une FAQ
app.delete('/api/faq/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression FAQ ID: ${id}`);

  try {
    await query('DELETE FROM faq WHERE id = ?', [id]);
    console.log(`✅ FAQ ${id} supprimée`);
    res.json({ success: true, message: 'FAQ supprimée' });
  } catch (err) {
    console.error('❌ Erreur suppression FAQ:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES STATISTIQUES ====================

// GET - Récupérer les statistiques par année
app.get('/api/statistiques/:year', async (req, res) => {
  const year = req.params.year;
  console.log(`📊 Récupération statistiques pour ${year}`);

  try {
    const results = await query('SELECT * FROM statistiques WHERE annee = ? ORDER BY created_at DESC', [year]);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération statistiques:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter une statistique
app.post('/api/statistiques', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'une statistique');

  const { annee, type, valeur, label, description, categorie } = req.body;

  if (!annee || !type || !valeur) {
    return res.status(400).json({ error: 'Année, type et valeur requis' });
  }

  try {
    const sql = `
      INSERT INTO statistiques (annee, type, valeur, label, description, categorie)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [annee, type, valeur, label, description, categorie]);

    console.log(`✅ Statistique ajoutée avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Statistique ajoutée avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout statistique:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// DELETE - Supprimer une statistique
app.delete('/api/statistiques/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression statistique ID: ${id}`);

  try {
    await query('DELETE FROM statistiques WHERE id = ?', [id]);
    console.log(`✅ Statistique ${id} supprimée`);
    res.json({ success: true, message: 'Statistique supprimée' });
  } catch (err) {
    console.error('❌ Erreur suppression statistique:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES ÉVÉNEMENTS ====================

// GET - Récupérer tous les événements
app.get('/api/evenements', async (req, res) => {
  console.log('📋 Récupération des événements');

  try {
    const results = await query('SELECT * FROM evenements ORDER BY date_debut DESC');
    console.log(`✅ ${results.length} événement(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération événements:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un événement
app.post('/api/evenements', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un événement');

  const { titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images } = req.body;

  if (!titre || !date_debut) {
    return res.status(400).json({ error: 'Titre et date de début requis' });
  }

  try {
    const sql = `
      INSERT INTO evenements (titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images]);

    console.log(`✅ Événement ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Événement ajouté avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout événement:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier un événement
app.put('/api/evenements/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification événement ID: ${id}`);

  const { titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images } = req.body;

  try {
    const sql = `
      UPDATE evenements 
      SET titre = ?, description = ?, type = ?, date_debut = ?, date_fin = ?, lieu = ?, statut = ?, projet_id = ?, images = ?
      WHERE id = ?
    `;

    await query(sql, [titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images, id]);

    console.log(`✅ Événement ${id} modifié`);
    res.json({ success: true, message: 'Événement modifié' });
  } catch (err) {
    console.error('❌ Erreur modification événement:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un événement
app.delete('/api/evenements/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression événement ID: ${id}`);

  try {
    await query('DELETE FROM evenements WHERE id = ?', [id]);
    console.log(`✅ Événement ${id} supprimé`);
    res.json({ success: true, message: 'Événement supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression événement:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES PARAMÈTRES ====================

// GET - Récupérer tous les paramètres
app.get('/api/parametres', async (req, res) => {
  console.log('📋 Récupération des paramètres');

  try {
    const results = await query('SELECT * FROM settings_site ORDER BY cle ASC');
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération paramètres:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LA GALERIE ====================

// GET - Récupérer la galerie
app.get('/api/gallery', async (req, res) => {
  console.log('📋 Récupération de la galerie');

  try {
    const results = await query('SELECT * FROM medias ORDER BY created_at DESC LIMIT 50');
    res.json({ items: results });
  } catch (err) {
    console.error('❌ Erreur récupération galerie:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES MÉDIAS ====================

// GET - Récupérer tous les médias
app.get('/api/medias', async (req, res) => {
  console.log('📋 Récupération des médias');

  const { limit = 50 } = req.query;

  try {
    const results = await query('SELECT * FROM medias ORDER BY created_at DESC LIMIT ?', [parseInt(limit)]);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération médias:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un média
app.post('/api/medias', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un média');

  const { titre, description, type, url, projet_id, article_id, categorie_id, taille, format, is_featured, ordre } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL du média requise' });
  }

  try {
    const sql = `
      INSERT INTO medias (titre, description, type, url, projet_id, article_id, categorie_id, taille, format, is_featured, ordre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      titre, description, type || 'image', url, projet_id, article_id, categorie_id,
      taille, format, is_featured || false, ordre || 0
    ]);

    console.log(`✅ Média ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Média ajouté avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout média:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier un média
app.put('/api/medias/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification média ID: ${id}`);

  const { titre, description, type, url, projet_id, article_id, is_featured, ordre } = req.body;

  try {
    const sql = `
      UPDATE medias 
      SET titre = ?, description = ?, type = ?, url = ?, projet_id = ?, article_id = ?, is_featured = ?, ordre = ?
      WHERE id = ?
    `;

    await query(sql, [titre, description, type, url, projet_id, article_id, is_featured, ordre, id]);

    console.log(`✅ Média ${id} modifié`);
    res.json({ success: true, message: 'Média modifié' });
  } catch (err) {
    console.error('❌ Erreur modification média:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un média
app.delete('/api/medias/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression média ID: ${id}`);

  try {
    await query('DELETE FROM medias WHERE id = ?', [id]);
    console.log(`✅ Média ${id} supprimé`);
    res.json({ success: true, message: 'Média supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression média:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR L'UPLOAD MULTIPLE ====================

// POST - Upload multiple de fichiers
app.post('/api/upload/multiple', authentifierToken, upload.array('files', 10), async (req, res) => {
  console.log('📤 Upload multiple de fichiers');

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const files = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      type: file.mimetype
    }));

    console.log(`✅ ${files.length} fichier(s) uploadé(s)`);
    res.json({
      success: true,
      files: files
    });
  } catch (error) {
    console.error('❌ Erreur upload multiple:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES POUR LE DASHBOARD ====================

// GET - Statistiques du dashboard
app.get('/api/dashboard/stats', authentifierToken, async (req, res) => {
  console.log('📊 Récupération stats dashboard');

  try {
    const benevolesActifs = await query('SELECT COUNT(*) as count FROM benevoles WHERE statut = "actif"');
    const donsMois = await query(`
      SELECT SUM(montant) as total 
      FROM dons 
      WHERE statut = "valide" 
        AND MONTH(date_don) = MONTH(CURRENT_DATE())
        AND YEAR(date_don) = YEAR(CURRENT_DATE())
    `);
    const actionsEnCours = await query('SELECT COUNT(*) as count FROM actions WHERE statut = "en_cours"');

    res.json({
      benevolesActifs: benevolesActifs[0].count || 0,
      donsMois: donsMois[0].total || 0,
      actionsEnCours: actionsEnCours[0].count || 0,
      visiteurs30Jours: 1250 // Valeur fictive ou à implémenter avec un vrai compteur
    });
  } catch (err) {
    console.error('❌ Erreur stats dashboard:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET - Graphique des dons pour le dashboard
app.get('/api/dashboard/dons-graph', authentifierToken, async (req, res) => {
  console.log('📈 Récupération graphique dons');

  try {
    const results = await query(`
      SELECT 
        DATE_FORMAT(date_don, '%Y-%m') as mois,
        SUM(montant) as total
      FROM dons
      WHERE statut = "valide"
        AND date_don >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
      GROUP BY mois
      ORDER BY mois ASC
    `);

    res.json(results);
  } catch (err) {
    console.error('❌ Erreur graphique dons:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LE BANNER ADMIN ====================

// GET - Récupérer les slides du banner pour l'admin
app.get('/api/admin/banner-slides', authentifierToken, async (req, res) => {
  console.log('📋 Récupération slides banner (admin)');

  try {
    const results = await query(`
      SELECT * FROM settings_site 
      WHERE cle LIKE 'banner_slide_%' 
      ORDER BY cle ASC
    `);

    const slides = results.map(row => {
      try {
        return JSON.parse(row.valeur);
      } catch (e) {
        return { text: '', image: '', alt: '' };
      }
    });

    res.json(slides);
  } catch (err) {
    console.error('❌ Erreur récupération slides banner:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter un nouveau slide
app.post('/api/admin/banner-slide', authentifierToken, async (req, res) => {
  console.log('➕ Ajout d\'un slide banner');

  const { text, image } = req.body;

  try {
    // Trouver le prochain index disponible
    const results = await query("SELECT cle FROM settings_site WHERE cle LIKE 'banner_slide_%'");
    const indexes = results.map(r => parseInt(r.cle.replace('banner_slide_', ''))).filter(n => !isNaN(n));
    const nextIndex = indexes.length > 0 ? Math.max(...indexes) + 1 : 0;

    const slideData = {
      text: text || 'Nouveau slide',
      image: image || '',
      alt: `Slide ${nextIndex + 1}`
    };

    await query(
      'INSERT INTO settings_site (cle, valeur, type) VALUES (?, ?, ?)',
      [`banner_slide_${nextIndex}`, JSON.stringify(slideData), 'json']
    );

    console.log(`✅ Slide banner ajouté avec index ${nextIndex}`);
    res.json({
      success: true,
      slide: { index: nextIndex, ...slideData }
    });
  } catch (err) {
    console.error('❌ Erreur ajout slide banner:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Mettre à jour un slide
app.post('/api/admin/banner-slide/:index', authentifierToken, async (req, res) => {
  const index = req.params.index;
  console.log(`✏️ Mise à jour slide banner index: ${index}`);

  const { text, image } = req.body;

  try {
    const results = await query('SELECT * FROM settings_site WHERE cle = ?', [`banner_slide_${index}`]);

    let slideData = {};
    if (results.length > 0) {
      slideData = JSON.parse(results[0].valeur);
    }

    if (text !== undefined) slideData.text = text;
    if (image !== undefined) slideData.image = image;

    await query(
      `INSERT INTO settings_site (cle, valeur, type) 
       VALUES (?, ?, 'json')
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
      [`banner_slide_${index}`, JSON.stringify(slideData)]
    );

    console.log(`✅ Slide banner ${index} mis à jour`);
    res.json({ success: true, slide: { index, ...slideData } });
  } catch (err) {
    console.error('❌ Erreur mise à jour slide banner:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer un slide
app.delete('/api/admin/banner-slide/:index', authentifierToken, async (req, res) => {
  const index = req.params.index;
  console.log(`🗑️ Suppression slide banner index: ${index}`);

  try {
    await query('DELETE FROM settings_site WHERE cle = ?', [`banner_slide_${index}`]);
    console.log(`✅ Slide banner ${index} supprimé`);
    res.json({ success: true, message: 'Slide supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression slide banner:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Réorganiser les slides
app.put('/api/admin/banner-slides/reorder', authentifierToken, async (req, res) => {
  console.log('🔄 Réorganisation des slides banner');

  const { slides } = req.body;

  try {
    for (const item of slides) {
      const result = await query('SELECT * FROM settings_site WHERE cle = ?', [`banner_slide_${item.originalIndex}`]);

      if (result.length > 0) {
        const slideData = JSON.parse(result[0].valeur);

        await query(
          `INSERT INTO settings_site (cle, valeur, type) 
           VALUES (?, ?, 'json')
           ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
          [`banner_slide_${item.newIndex}`, JSON.stringify(slideData)]
        );

        if (item.originalIndex !== item.newIndex) {
          await query('DELETE FROM settings_site WHERE cle = ?', [`banner_slide_${item.originalIndex}`]);
        }
      }
    }

    console.log('✅ Slides banner réorganisés');
    res.json({ success: true, message: 'Slides réorganisés' });
  } catch (err) {
    console.error('❌ Erreur réorganisation slides banner:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES CAUSES (COMPLÉMENT) ====================

// GET - Récupérer une cause spécifique
app.get('/api/admin/causes/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🔍 Récupération cause ID: ${id}`);

  try {
    const results = await query('SELECT * FROM causes WHERE id = ?', [id]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'Cause non trouvée' });
    }

    const cause = {
      ...results[0],
      icone: results[0].icone ? `https://ypsbackend.vercel.app${results[0].icone}` : null
    };

    res.json(cause);
  } catch (err) {
    console.error('❌ Erreur récupération cause:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Ajouter une cause
app.post('/api/admin/causes', authentifierToken, upload.single('icone'), async (req, res) => {
  console.log('➕ Ajout d\'une cause');

  const { nom, description, nb_projets, nb_projets_termines, statut, ordre } = req.body;
  let iconePath = null;

  if (req.file) {
    iconePath = `/uploads/${req.file.filename}`;
  }

  if (!nom || !description) {
    return res.status(400).json({ error: 'Nom et description requis' });
  }

  try {
    const sql = `
      INSERT INTO causes (nom, description, icone, nb_projets, nb_projets_termines, statut, ordre)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      nom, description, iconePath, nb_projets || 0, nb_projets_termines || 0,
      statut || 'actif', ordre || 0
    ]);

    console.log(`✅ Cause ajoutée avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Cause ajoutée avec succès'
    });
  } catch (err) {
    console.error('❌ Erreur ajout cause:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Modifier une cause
app.put('/api/admin/causes/:id', authentifierToken, upload.single('icone'), async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification cause ID: ${id}`);

  const { nom, description, nb_projets, nb_projets_termines, statut, ordre, icone } = req.body;
  let iconePath = icone;

  if (req.file) {
    iconePath = `/uploads/${req.file.filename}`;
  }

  try {
    const sql = `
      UPDATE causes 
      SET nom = ?, description = ?, icone = ?, nb_projets = ?, nb_projets_termines = ?, statut = ?, ordre = ?
      WHERE id = ?
    `;

    await query(sql, [
      nom, description, iconePath, nb_projets, nb_projets_termines, statut, ordre, id
    ]);

    console.log(`✅ Cause ${id} modifiée`);
    res.json({ success: true, message: 'Cause modifiée' });
  } catch (err) {
    console.error('❌ Erreur modification cause:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT - Changer l'ordre d'une cause
app.put('/api/admin/causes/:id/order', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🔄 Changement ordre cause ID: ${id}`);

  const { direction } = req.body;

  try {
    const current = await query('SELECT ordre FROM causes WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ error: 'Cause non trouvée' });
    }

    const currentOrdre = current[0].ordre;
    const newOrdre = direction === 'up' ? currentOrdre - 1 : currentOrdre + 1;

    // Vérifier si une autre cause a cet ordre
    const other = await query('SELECT id FROM causes WHERE ordre = ? AND id != ?', [newOrdre, id]);

    if (other.length > 0) {
      // Échanger les ordres
      await query('UPDATE causes SET ordre = ? WHERE id = ?', [currentOrdre, other[0].id]);
    }

    await query('UPDATE causes SET ordre = ? WHERE id = ?', [newOrdre, id]);

    console.log(`✅ Ordre cause ${id} modifié: ${newOrdre}`);
    res.json({ success: true, message: 'Ordre mis à jour' });
  } catch (err) {
    console.error('❌ Erreur changement ordre cause:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Supprimer une cause
app.delete('/api/admin/causes/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression cause ID: ${id}`);

  try {
    await query('DELETE FROM causes WHERE id = ?', [id]);
    console.log(`✅ Cause ${id} supprimée`);
    res.json({ success: true, message: 'Cause supprimée' });
  } catch (err) {
    console.error('❌ Erreur suppression cause:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES MÉDIAS (MediaManager) ====================

// GET - Récupérer tous les médias pour MediaManager
app.get('/api/media/all', async (req, res) => {
  console.log('📋 Récupération de tous les médias (MediaManager)');

  try {
    const results = await query('SELECT * FROM medias ORDER BY created_at DESC');
    res.json({ items: results });
  } catch (err) {
    console.error('❌ Erreur récupération médias:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST - Upload de média depuis l'appareil
app.post('/api/media/upload', authentifierToken, upload.single('file'), async (req, res) => {
  console.log('📤 Upload de média depuis appareil');

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const { titre, description, type, is_featured, ordre } = req.body;
    const fileUrl = `/uploads/${req.file.filename}`;

    // Sauvegarder dans la base de données
    const sql = `
      INSERT INTO medias (titre, description, type, url, is_featured, ordre, taille)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const taille = (req.file.size / 1024).toFixed(2) + ' KB';

    const result = await query(sql, [
      titre || req.file.originalname,
      description || '',
      type || 'image',
      fileUrl,
      is_featured === 'true' || false,
      ordre || 0,
      taille
    ]);

    console.log(`✅ Média uploadé avec ID: ${result.insertId}`);
    res.json({
      success: true,
      file: {
        id: result.insertId,
        url: fileUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: taille,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('❌ Erreur upload média:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Upload de média depuis URL
app.post('/api/media/url', authentifierToken, async (req, res) => {
  console.log('🔗 Upload de média depuis URL');

  const { url, titre, description, type, is_featured, ordre } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL requise' });
  }

  try {
    // Sauvegarder dans la base de données
    const sql = `
      INSERT INTO medias (titre, description, type, url, is_featured, ordre)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const result = await query(sql, [
      titre || `Média ${new Date().toLocaleDateString()}`,
      description || '',
      type || 'image',
      url,
      is_featured === 'true' || false,
      ordre || 0
    ]);

    console.log(`✅ Média ajouté depuis URL avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      url: url,
      titre: titre || 'Media URL',
      type: type || 'image'
    });
  } catch (error) {
    console.error('❌ Erreur upload URL:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - Supprimer un média (MediaManager)
app.delete('/api/media/:id', authentifierToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression média ID: ${id} (MediaManager)`);

  try {
    await query('DELETE FROM medias WHERE id = ?', [id]);
    console.log(`✅ Média ${id} supprimé`);
    res.json({ success: true, message: 'Média supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression média:', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ... (continuez avec toutes vos autres routes en les convertissant de la même façon)

// ==================== GESTION DES ERREURS ====================
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.use((err, req, res, next) => {
  console.error('💥 ERREUR GLOBALE:', err.message);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

// ==================== DÉMARRAGE DU SERVEUR ====================
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('✅ SERVEUR DÉMARRÉ AVEC SUCCÈS');
    console.log('='.repeat(50));
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 URL: https://ypsbackend.vercel.app`);
    console.log('='.repeat(50) + '\n');
  });
}
