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
  connectionLimit: 10, // Maximum de connexions simultanées
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
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