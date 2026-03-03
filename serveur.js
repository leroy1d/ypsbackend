// backend/serveur.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ==================== CONFIGURATION ====================
const PORT = process.env.PORT || 5005;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_jwt_tres_long_et_securise_123456789';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Configuration CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📨 [${timestamp}] ${req.method} ${req.url}`);
  next();
});

// ==================== GESTIONNAIRE DE BASE DE DONNÉES OPTIMISÉ ====================
class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.initPool();
  }

  initPool() {
    try {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'bu2lzbc2luiolb9b29j8-mysql.services.clever-cloud.com',
        user: process.env.DB_USER || 'uknuhxtgvt1juuse',
        password: process.env.DB_PASSWORD || 'wNbYSj927pYX2K5s6nDB',
        database: process.env.DB_NAME || 'bu2lzbc2luiolb9b29j8',
        port: parseInt(process.env.DB_PORT) || 3306,
        
        // Configuration optimisée pour serverless
        waitForConnections: true,
        connectionLimit: 2, // Réduit pour éviter l'épuisement des connexions
        queueLimit: 10,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        
        // Timeouts optimisés
        connectTimeout: 30000,
        acquireTimeout: 30000,
        idleTimeout: 60000,
        
        // Options supplémentaires
        timezone: 'Z',
        charset: 'utf8mb4',
        
        // Reconnexion automatique
        multipleStatements: false
      });

      this.promisePool = this.pool.promise();

      // Gestion des erreurs du pool
      this.pool.on('error', (err) => {
        console.error('❌ Erreur pool MySQL:', err);
        this.isConnected = false;
        
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
          this.handleDisconnection();
        }
      });

      this.pool.on('connection', (connection) => {
        console.log('✅ Nouvelle connexion MySQL établie');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.pool.on('acquire', () => {
        // console.log('🔌 Connexion acquise');
      });

      this.pool.on('release', () => {
        // console.log('🔓 Connexion libérée');
      });

    } catch (err) {
      console.error('❌ Erreur création pool:', err);
      this.isConnected = false;
    }
  }

  handleDisconnection() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Tentative de reconnexion ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      
      setTimeout(() => {
        this.initPool();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Maximum de tentatives de reconnexion atteint');
    }
  }

  async query(sql, params = []) {
    let connection;
    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        connection = await this.promisePool.getConnection();
        
        // Exécuter la requête
        const [results] = await connection.query(sql, params);
        
        // Libérer la connexion immédiatement
        connection.release();
        
        return results;
      } catch (err) {
        if (connection) {
          connection.release();
        }

        // Gérer les erreurs de connexion
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || 
            err.code === 'ECONNRESET' || 
            err.code === 'ETIMEDOUT') {
          
          retries++;
          console.log(`⚠️ Erreur de connexion, tentative ${retries}/${maxRetries}`);
          
          if (retries < maxRetries) {
            // Attendre avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            continue;
          }
        }
        
        // Log détaillé de l'erreur
        console.error('❌ Erreur SQL:', {
          sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
          params: params,
          error: err.message,
          code: err.code
        });
        
        throw err;
      }
    }
    
    throw new Error('Maximum de tentatives atteint');
  }

  async testConnection() {
    try {
      const result = await this.query('SELECT 1 + 1 AS solution');
      console.log('✅ Connexion MySQL réussie. Test:', result[0].solution);
      this.isConnected = true;
      return true;
    } catch (err) {
      console.error('❌ Échec connexion MySQL:', err.message);
      this.isConnected = false;
      return false;
    }
  }

  async initializeDatabase() {
    console.log('🗄️ Initialisation de la base de données...');

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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
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
          date_inscription TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_statut (statut),
          INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_statut (statut),
          INDEX idx_type (type),
          INDEX idx_featured (is_featured)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
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
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_publie (publie),
          INDEX idx_categorie (categorie),
          FULLTEXT INDEX idx_recherche (titre, contenu, resume)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_cle (cle),
          INDEX idx_categorie (categorie)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
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
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_statut (statut),
          INDEX idx_ordre (ordre)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'dons',
        sql: `CREATE TABLE IF NOT EXISTS dons (
          id INT PRIMARY KEY AUTO_INCREMENT,
          donateur_nom VARCHAR(100) NOT NULL,
          email VARCHAR(100),
          montant DECIMAL(10,2) NOT NULL,
          devise VARCHAR(3) DEFAULT 'EUR',
          methode_paiement VARCHAR(50),
          projet_associe VARCHAR(200),
          statut ENUM('en_attente', 'valide', 'refuse', 'rembourse') DEFAULT 'en_attente',
          notes TEXT,
          reçu_fiscal_envoye BOOLEAN DEFAULT false,
          date_don TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_statut (statut),
          INDEX idx_date (date_don)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      },
      {
        name: 'medias',
        sql: `CREATE TABLE IF NOT EXISTS medias (
          id INT PRIMARY KEY AUTO_INCREMENT,
          titre VARCHAR(255),
          description TEXT,
          type VARCHAR(50) DEFAULT 'image',
          url VARCHAR(500) NOT NULL,
          taille VARCHAR(20),
          format VARCHAR(20),
          projet_id INT,
          article_id INT,
          categorie_id INT,
          is_featured BOOLEAN DEFAULT false,
          ordre INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_type (type),
          INDEX_idx_featured (is_featured),
          FOREIGN KEY (projet_id) REFERENCES actions(id) ON DELETE SET NULL,
          FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      }
    ];

    for (const table of tables) {
      try {
        await this.query(table.sql);
        console.log(`✅ Table ${table.name} vérifiée/créée`);
      } catch (err) {
        console.error(`❌ Erreur création table ${table.name}:`, err.message);
      }
    }

    // Créer admin par défaut
    await this.createDefaultAdmin();

    // Créer settings par défaut
    await this.createDefaultSettings();
  }

  async createDefaultAdmin() {
    try {
      const adminPassword = bcrypt.hashSync('admin123', 8);
      
      const [existing] = await this.query(
        'SELECT id FROM admins WHERE email = ?',
        ['admin@association.org']
      );

      if (existing && existing.length === 0) {
        await this.query(
          `INSERT INTO admins (email, password, nom, role) 
           VALUES (?, ?, ?, ?)`,
          ['admin@association.org', adminPassword, 'Admin Principal', 'superadmin']
        );
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

  async createDefaultSettings() {
    const defaultSettings = [
      ['site_title', 'YPSNC/CNJPS', 'texte', 'general', 'Titre du site'],
      ['site_slogan', 'ensemble pour un cameroun de Paix en Paix', 'texte', 'general', 'Slogan du site'],
      ['footer_description', 'Les jeunes au cœur de la paix et de la sécurité', 'texte', 'general', 'Description du footer'],
      ['contact_address', '7250', 'texte', 'contact', 'Adresse de contact'],
      ['contact_phone', '678474295', 'texte', 'contact', 'Téléphone de contact'],
      ['contact_email', 'contact@association.org', 'texte', 'contact', 'Email de contact']
    ];

    for (const [cle, valeur, type, categorie, description] of defaultSettings) {
      try {
        await this.query(
          `INSERT IGNORE INTO settings_site (cle, valeur, type, categorie, description) 
           VALUES (?, ?, ?, ?, ?)`,
          [cle, valeur, type, categorie, description]
        );
      } catch (err) {
        console.error(`❌ Erreur création setting ${cle}:`, err.message);
      }
    }
    console.log('✅ Paramètres par défaut créés');
  }

  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return { status: 'ok', connected: true };
    } catch (err) {
      return { status: 'error', connected: false, error: err.message };
    }
  }
}

// Initialiser le gestionnaire de base de données
const db = new DatabaseManager();

// Middleware de vérification de connexion
app.use(async (req, res, next) => {
  try {
    // Vérification rapide mais pas bloquante
    if (!db.isConnected) {
      console.log('⚠️ Connexion MySQL non vérifiée, tentative de test...');
      await db.testConnection();
    }
    next();
  } catch (err) {
    console.error('❌ Erreur middleware DB:', err.message);
    next();
  }
});

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Format token invalide' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré' });
      }
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

// ==================== CONFIGURATION MULTER ====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non supporté: ${file.mimetype}`), false);
    }
  }
});

// ==================== ROUTES DE BASE ====================

// Health check
app.get('/api/health', async (req, res) => {
  const health = await db.healthCheck();
  res.json({
    ...health,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Test connexion
app.get('/api/test', async (req, res) => {
  try {
    const result = await db.query('SELECT 1 + 1 AS solution');
    res.json({
      success: true,
      message: 'Serveur fonctionnel',
      timestamp: new Date().toISOString(),
      mysql: 'Connecté',
      test: result[0].solution
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: 'Erreur de connexion à la base de données',
      details: err.message 
    });
  }
});

// ==================== ROUTES FRONTEND ====================

// Récupérer les paramètres pour le frontend
app.get('/api/frontend/settings', async (req, res) => {
  console.log('🌐 Frontend - Récupération des paramètres');

  const defaultSettings = {
    site_title: 'YPSNC/CNJPS',
    site_slogan: 'ensemble pour un cameroun de Paix en Paix',
    footer_description: 'Les jeunes au cœur de la paix et de la sécurité',
    contact_address: '7250',
    contact_phone: '678474295',
    contact_email: 'contact@association.org',
    hero_backgrounds: []
  };

  try {
    const results = await db.query(
      'SELECT cle, valeur FROM settings_site WHERE cle LIKE ? OR cle LIKE ?',
      ['site_%', 'contact_%']
    );

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
    res.json(settings);

  } catch (error) {
    console.error('❌ Erreur récupération paramètres:', error.message);
    res.json(defaultSettings);
  }
});

// Récupérer les actions pour le frontend
app.get('/api/frontend/actions', async (req, res) => {
  console.log('🌐 Frontend - Récupération des actions');

  try {
    const results = await db.query(`
      SELECT 
        id, titre, description, type, 
        date_debut, date_fin, statut,
        photos, pays, localisation,
        is_featured, ordre
      FROM actions 
      WHERE statut IN ('en_cours', 'termine')
      ORDER BY is_featured DESC, ordre ASC, date_debut DESC
      LIMIT 10
    `);

    const actions = results.map(action => {
      let photos = [];
      if (action.photos) {
        try {
          photos = JSON.parse(action.photos);
          if (!Array.isArray(photos)) photos = [action.photos];
        } catch {
          photos = action.photos ? [action.photos] : [];
        }
      }
      return { ...action, photos };
    });

    console.log(`✅ ${actions.length} action(s) envoyées au frontend`);
    res.json(actions);
  } catch (err) {
    console.error('❌ Erreur récupération actions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les causes pour le frontend
app.get('/api/frontend/causes', async (req, res) => {
  console.log('🌐 Frontend - Récupération des causes');

  const { limit = 6 } = req.query;

  try {
    const results = await db.query(`
      SELECT id, nom, description, icone, nb_projets, nb_projets_termines
      FROM causes 
      WHERE statut = 'actif'
      ORDER BY ordre ASC, created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);

    const causes = results.map(cause => ({
      ...cause,
      icone: cause.icone ? `${BASE_URL}${cause.icone}` : null
    }));

    console.log(`✅ ${causes.length} cause(s) envoyées au frontend`);
    res.json(causes);
  } catch (err) {
    console.error('❌ Erreur récupération causes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les articles pour le frontend
app.get('/api/frontend/articles', async (req, res) => {
  console.log('🌐 Frontend - Récupération des articles');

  const { limit = 3, featured } = req.query;

  try {
    let query = `
      SELECT id, titre, resume, image_url, auteur, categorie, created_at, vues, likes
      FROM articles 
      WHERE publie = true
    `;
    
    if (featured === 'true') {
      query += ' AND is_featured = true';
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';

    const results = await db.query(query, [parseInt(limit)]);

    console.log(`✅ ${results.length} article(s) envoyés au frontend`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération articles:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer le logo
app.get('/api/logo', async (req, res) => {
  console.log('🖼️ Récupération du logo');

  try {
    const results = await db.query(
      "SELECT valeur FROM settings_site WHERE cle = 'logo_url'"
    );

    if (results.length > 0 && results[0].valeur) {
      res.json({
        logo_url: results[0].valeur,
        is_default: false
      });
    } else {
      res.json({
        logo_url: '/assets/logo-default.png',
        is_default: true
      });
    }
  } catch (err) {
    console.error('❌ Erreur récupération logo:', err.message);
    res.json({
      logo_url: '/assets/logo-default.png',
      is_default: true
    });
  }
});

// ==================== ROUTES D'AUTHENTIFICATION ====================

// Login
app.post('/api/login', async (req, res) => {
  console.log('🔑 Tentative de connexion');

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const results = await db.query(
      'SELECT * FROM admins WHERE email = ?',
      [email]
    );

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
      JWT_SECRET,
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
    console.error('❌ Erreur login:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Vérifier le token
app.get('/api/verify-token', authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  });
});

// ==================== ROUTES ADMIN ====================

// Récupérer les statistiques du dashboard
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  console.log('📊 Récupération stats dashboard');

  try {
    const [benevoles, dons, actions, membres] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM benevoles WHERE statut = "actif"'),
      db.query('SELECT SUM(montant) as total FROM dons WHERE statut = "valide" AND MONTH(date_don) = MONTH(CURRENT_DATE())'),
      db.query('SELECT COUNT(*) as count FROM actions WHERE statut = "en_cours"'),
      db.query('SELECT COUNT(*) as count FROM membres')
    ]);

    res.json({
      benevolesActifs: benevoles[0]?.count || 0,
      donsMois: dons[0]?.total || 0,
      actionsEnCours: actions[0]?.count || 0,
      membresTotal: membres[0]?.count || 0
    });
  } catch (err) {
    console.error('❌ Erreur stats dashboard:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Récupérer les activités récentes
app.get('/api/dashboard/activites', authenticateToken, async (req, res) => {
  console.log('📋 Récupération activités récentes');

  try {
    const results = await db.query(`
      (SELECT 'action' as type, titre as description, created_at FROM actions LIMIT 5)
      UNION ALL
      (SELECT 'don' as type, CONCAT('Don de ', montant, ' ', devise) as description, date_don as created_at FROM dons LIMIT 5)
      UNION ALL
      (SELECT 'benevole' as type, CONCAT(nom, ' a rejoint') as description, date_inscription as created_at FROM benevoles LIMIT 5)
      ORDER BY created_at DESC
      LIMIT 10
    `);

    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération activités:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES PARAMÈTRES ====================

// Récupérer tous les paramètres
app.get('/api/settings', authenticateToken, async (req, res) => {
  console.log('⚙️ Récupération de tous les paramètres');

  try {
    const results = await db.query(
      'SELECT * FROM settings_site ORDER BY categorie, ordre, cle'
    );
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération paramètres:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Sauvegarder un paramètre
app.post('/api/settings', authenticateToken, async (req, res) => {
  const { cle, valeur, type = 'texte', categorie = 'general', description = '' } = req.body;

  if (!cle) {
    return res.status(400).json({ error: 'Clé requise' });
  }

  console.log(`⚙️ Sauvegarde paramètre: ${cle}`);

  try {
    await db.query(
      `INSERT INTO settings_site (cle, valeur, type, categorie, description) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         valeur = VALUES(valeur),
         type = VALUES(type),
         categorie = VALUES(categorie),
         description = VALUES(description)`,
      [cle, valeur, type, categorie, description]
    );

    console.log(`✅ Paramètre ${cle} sauvegardé`);
    res.json({ success: true, message: 'Paramètre sauvegardé' });
  } catch (err) {
    console.error('❌ Erreur sauvegarde paramètre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un paramètre
app.delete('/api/settings/:key', authenticateToken, async (req, res) => {
  const key = req.params.key;
  console.log(`🗑️ Suppression paramètre: ${key}`);

  try {
    await db.query('DELETE FROM settings_site WHERE cle = ?', [key]);
    console.log(`✅ Paramètre ${key} supprimé`);
    res.json({ success: true, message: 'Paramètre supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression paramètre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES CAUSES ====================

// Récupérer toutes les causes (admin)
app.get('/api/admin/causes', authenticateToken, async (req, res) => {
  console.log('📋 Récupération des causes (admin)');

  try {
    const results = await db.query(
      'SELECT * FROM causes ORDER BY ordre ASC, created_at DESC'
    );

    const causes = results.map(cause => ({
      ...cause,
      icone: cause.icone ? `${BASE_URL}${cause.icone}` : null
    }));

    console.log(`✅ ${causes.length} cause(s) récupérée(s)`);
    res.json(causes);
  } catch (err) {
    console.error('❌ Erreur récupération causes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une cause
app.post('/api/admin/causes', authenticateToken, upload.single('icone'), async (req, res) => {
  console.log('➕ Ajout d\'une cause');

  const { nom, description, nb_projets = 0, nb_projets_termines = 0, statut = 'actif', ordre = 0 } = req.body;
  const iconePath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!nom || !description) {
    return res.status(400).json({ error: 'Nom et description requis' });
  }

  try {
    const result = await db.query(
      `INSERT INTO causes (nom, description, icone, nb_projets, nb_projets_termines, statut, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nom, description, iconePath, nb_projets, nb_projets_termines, statut, ordre]
    );

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

// Modifier une cause
app.put('/api/admin/causes/:id', authenticateToken, upload.single('icone'), async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification cause ID: ${id}`);

  const { nom, description, nb_projets, nb_projets_termines, statut, ordre, icone } = req.body;
  let iconePath = icone;

  if (req.file) {
    iconePath = `/uploads/${req.file.filename}`;
  }

  try {
    await db.query(
      `UPDATE causes 
       SET nom = ?, description = ?, icone = ?, nb_projets = ?, nb_projets_termines = ?, statut = ?, ordre = ?
       WHERE id = ?`,
      [nom, description, iconePath, nb_projets, nb_projets_termines, statut, ordre, id]
    );

    console.log(`✅ Cause ${id} modifiée`);
    res.json({ success: true, message: 'Cause modifiée' });
  } catch (err) {
    console.error('❌ Erreur modification cause:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une cause
app.delete('/api/admin/causes/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression cause ID: ${id}`);

  try {
    await db.query('DELETE FROM causes WHERE id = ?', [id]);
    console.log(`✅ Cause ${id} supprimée`);
    res.json({ success: true, message: 'Cause supprimée' });
  } catch (err) {
    console.error('❌ Erreur suppression cause:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES BÉNÉVOLES ====================

// Récupérer tous les bénévoles
app.get('/api/benevoles', authenticateToken, async (req, res) => {
  console.log('📋 Récupération des bénévoles');

  try {
    const results = await db.query(
      'SELECT * FROM benevoles ORDER BY date_inscription DESC'
    );
    console.log(`✅ ${results.length} bénévole(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération bénévoles:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un bénévole
app.post('/api/benevoles', authenticateToken, async (req, res) => {
  console.log('➕ Ajout d\'un bénévole');

  const { nom, email, telephone, competences, disponibilite, statut = 'actif' } = req.body;

  if (!nom || !email) {
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  try {
    const result = await db.query(
      `INSERT INTO benevoles (nom, email, telephone, competences, disponibilite, statut)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nom, email, telephone, competences, disponibilite, statut]
    );

    console.log(`✅ Bénévole ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Bénévole ajouté avec succès'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    console.error('❌ Erreur ajout bénévole:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Modifier un bénévole
app.put('/api/benevoles/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification bénévole ID: ${id}`);

  const { nom, email, telephone, competences, disponibilite, statut } = req.body;

  try {
    await db.query(
      `UPDATE benevoles 
       SET nom = ?, email = ?, telephone = ?, competences = ?, disponibilite = ?, statut = ?
       WHERE id = ?`,
      [nom, email, telephone, competences, disponibilite, statut, id]
    );

    console.log(`✅ Bénévole ${id} modifié`);
    res.json({ success: true, message: 'Bénévole modifié' });
  } catch (err) {
    console.error('❌ Erreur modification bénévole:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un bénévole
app.delete('/api/benevoles/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression bénévole ID: ${id}`);

  try {
    await db.query('DELETE FROM benevoles WHERE id = ?', [id]);
    console.log(`✅ Bénévole ${id} supprimé`);
    res.json({ success: true, message: 'Bénévole supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression bénévole:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES DONS ====================

// Récupérer tous les dons
app.get('/api/dons', authenticateToken, async (req, res) => {
  console.log('📋 Récupération des dons');

  try {
    const results = await db.query(
      'SELECT * FROM dons ORDER BY date_don DESC'
    );
    console.log(`✅ ${results.length} don(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération dons:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un don
app.post('/api/dons', authenticateToken, async (req, res) => {
  console.log('➕ Ajout d\'un don');

  const { 
    donateur_nom, email, montant, devise = 'EUR', 
    methode_paiement = 'carte', projet_associe, 
    statut = 'en_attente', notes = '' 
  } = req.body;

  if (!donateur_nom || !montant) {
    return res.status(400).json({ error: 'Nom du donateur et montant requis' });
  }

  try {
    const result = await db.query(
      `INSERT INTO dons (donateur_nom, email, montant, devise, methode_paiement, projet_associe, statut, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [donateur_nom, email, montant, devise, methode_paiement, projet_associe, statut, notes]
    );

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

// Modifier le statut d'un don
app.put('/api/dons/:id/statut', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🔄 Changement statut don ID: ${id}`);

  const { statut, reçu_fiscal_envoye } = req.body;

  try {
    await db.query(
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

// Supprimer un don
app.delete('/api/dons/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression don ID: ${id}`);

  try {
    await db.query('DELETE FROM dons WHERE id = ?', [id]);
    console.log(`✅ Don ${id} supprimé`);
    res.json({ success: true, message: 'Don supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression don:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES MEMBRES ====================

// Récupérer tous les membres
app.get('/api/membres', authenticateToken, async (req, res) => {
  console.log('📋 Récupération des membres');

  try {
    const results = await db.query(
      'SELECT * FROM membres ORDER BY created_at DESC'
    );
    console.log(`✅ ${results.length} membre(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération membres:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un membre
app.post('/api/membres', authenticateToken, async (req, res) => {
  console.log('➕ Ajout d\'un membre');

  const { nom, email, date_adhesion, cotisation_payee = false } = req.body;

  if (!nom || !email) {
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  try {
    const result = await db.query(
      `INSERT INTO membres (nom, email, date_adhesion, cotisation_payee)
       VALUES (?, ?, ?, ?)`,
      [nom, email, date_adhesion, cotisation_payee]
    );

    console.log(`✅ Membre ajouté avec ID: ${result.insertId}`);
    res.json({
      success: true,
      id: result.insertId,
      message: 'Membre ajouté avec succès'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    console.error('❌ Erreur ajout membre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Modifier un membre
app.put('/api/membres/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification membre ID: ${id}`);

  const { nom, email, date_adhesion, cotisation_payee } = req.body;

  try {
    await db.query(
      `UPDATE membres 
       SET nom = ?, email = ?, date_adhesion = ?, cotisation_payee = ?
       WHERE id = ?`,
      [nom, email, date_adhesion, cotisation_payee, id]
    );

    console.log(`✅ Membre ${id} modifié`);
    res.json({ success: true, message: 'Membre modifié' });
  } catch (err) {
    console.error('❌ Erreur modification membre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un membre
app.delete('/api/membres/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression membre ID: ${id}`);

  try {
    await db.query('DELETE FROM membres WHERE id = ?', [id]);
    console.log(`✅ Membre ${id} supprimé`);
    res.json({ success: true, message: 'Membre supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression membre:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES ACTIONS ====================

// Récupérer toutes les actions
app.get('/api/actions', authenticateToken, async (req, res) => {
  console.log('📋 Récupération des actions');

  try {
    const results = await db.query(
      'SELECT * FROM actions ORDER BY created_at DESC'
    );
    console.log(`✅ ${results.length} action(s) récupérée(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération actions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter une action
app.post('/api/actions', authenticateToken, async (req, res) => {
  console.log('➕ Ajout d\'une action');

  const { 
    titre, description, type = 'developpement', date_debut, date_fin, 
    budget, statut = 'planifie', photos, videos, pays, localisation, 
    partenaires, is_featured = false, ordre = 0 
  } = req.body;

  if (!titre || !description) {
    return res.status(400).json({ error: 'Titre et description requis' });
  }

  try {
    const result = await db.query(
      `INSERT INTO actions (titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires, is_featured, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires, is_featured, ordre]
    );

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

// Modifier une action
app.put('/api/actions/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification action ID: ${id}`);

  const { 
    titre, description, type, date_debut, date_fin, budget, statut, 
    photos, videos, pays, localisation, partenaires, is_featured, ordre 
  } = req.body;

  try {
    await db.query(
      `UPDATE actions 
       SET titre = ?, description = ?, type = ?, date_debut = ?, date_fin = ?, budget = ?, 
           statut = ?, photos = ?, videos = ?, pays = ?, localisation = ?, partenaires = ?, 
           is_featured = ?, ordre = ?
       WHERE id = ?`,
      [titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires, is_featured, ordre, id]
    );

    console.log(`✅ Action ${id} modifiée`);
    res.json({ success: true, message: 'Action modifiée' });
  } catch (err) {
    console.error('❌ Erreur modification action:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer une action
app.delete('/api/actions/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression action ID: ${id}`);

  try {
    await db.query('DELETE FROM actions WHERE id = ?', [id]);
    console.log(`✅ Action ${id} supprimée`);
    res.json({ success: true, message: 'Action supprimée' });
  } catch (err) {
    console.error('❌ Erreur suppression action:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LES ARTICLES ====================

// Récupérer tous les articles
app.get('/api/articles', authenticateToken, async (req, res) => {
  console.log('📋 Récupération des articles');

  try {
    const results = await db.query(
      'SELECT * FROM articles ORDER BY created_at DESC'
    );
    console.log(`✅ ${results.length} article(s) récupéré(s)`);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération articles:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Ajouter un article
app.post('/api/articles', authenticateToken, async (req, res) => {
  console.log('➕ Ajout d\'un article');

  const { 
    titre, contenu, auteur, categorie, image_url, images, 
    resume, mots_cles, publie = false, is_featured = false 
  } = req.body;

  if (!titre || !contenu) {
    return res.status(400).json({ error: 'Titre et contenu requis' });
  }

  try {
    const result = await db.query(
      `INSERT INTO articles (titre, contenu, auteur, categorie, image_url, images, resume, mots_cles, publie, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titre, contenu, auteur, categorie, image_url, images, resume, mots_cles, publie, is_featured]
    );

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

// Modifier un article
app.put('/api/articles/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`✏️ Modification article ID: ${id}`);

  const { 
    titre, contenu, auteur, categorie, image_url, images, 
    resume, mots_cles, publie, is_featured 
  } = req.body;

  try {
    await db.query(
      `UPDATE articles 
       SET titre = ?, contenu = ?, auteur = ?, categorie = ?, image_url = ?, 
           images = ?, resume = ?, mots_cles = ?, publie = ?, is_featured = ?
       WHERE id = ?`,
      [titre, contenu, auteur, categorie, image_url, images, resume, mots_cles, publie, is_featured, id]
    );

    console.log(`✅ Article ${id} modifié`);
    res.json({ success: true, message: 'Article modifié' });
  } catch (err) {
    console.error('❌ Erreur modification article:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un article
app.delete('/api/articles/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression article ID: ${id}`);

  try {
    await db.query('DELETE FROM articles WHERE id = ?', [id]);
    console.log(`✅ Article ${id} supprimé`);
    res.json({ success: true, message: 'Article supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression article:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Incrémenter les vues d'un article
app.post('/api/articles/:id/vue', async (req, res) => {
  const id = req.params.id;
  console.log(`👁️ Incrémentation vues article ID: ${id}`);

  try {
    await db.query('UPDATE articles SET vues = vues + 1 WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erreur incrémentation vues:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR L'UPLOAD ====================

// Upload de fichier
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  console.log('📤 Upload de fichier');

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Sauvegarder dans la table medias
    const result = await db.query(
      `INSERT INTO medias (titre, type, url, taille, format)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.file.originalname,
        req.file.mimetype.split('/')[0],
        fileUrl,
        `${(req.file.size / 1024).toFixed(2)} KB`,
        req.file.mimetype
      ]
    );

    console.log('✅ Fichier uploadé:', req.file.originalname);
    res.json({
      success: true,
      file: {
        id: result.insertId,
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('❌ Erreur upload:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Upload multiple
app.post('/api/upload/multiple', authenticateToken, upload.array('files', 10), async (req, res) => {
  console.log('📤 Upload multiple de fichiers');

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const files = [];
    for (const file of req.files) {
      const fileUrl = `/uploads/${file.filename}`;
      
      const result = await db.query(
        `INSERT INTO medias (titre, type, url, taille, format)
         VALUES (?, ?, ?, ?, ?)`,
        [
          file.originalname,
          file.mimetype.split('/')[0],
          fileUrl,
          `${(file.size / 1024).toFixed(2)} KB`,
          file.mimetype
        ]
      );

      files.push({
        id: result.insertId,
        url: fileUrl,
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
    }

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

// ==================== ROUTES POUR LES MÉDIAS ====================

// Récupérer tous les médias
app.get('/api/medias', async (req, res) => {
  console.log('📋 Récupération des médias');

  const { limit = 50, type } = req.query;

  try {
    let query = 'SELECT * FROM medias';
    const params = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const results = await db.query(query, params);
    res.json(results);
  } catch (err) {
    console.error('❌ Erreur récupération médias:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Supprimer un média
app.delete('/api/medias/:id', authenticateToken, async (req, res) => {
  const id = req.params.id;
  console.log(`🗑️ Suppression média ID: ${id}`);

  try {
    // Récupérer l'URL pour supprimer le fichier
    const medias = await db.query('SELECT url FROM medias WHERE id = ?', [id]);

    if (medias.length > 0) {
      const fileUrl = medias[0].url;
      const fileName = path.basename(fileUrl);
      const filePath = path.join(__dirname, 'uploads', fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Fichier supprimé: ${fileName}`);
      }
    }

    await db.query('DELETE FROM medias WHERE id = ?', [id]);
    console.log(`✅ Média ${id} supprimé`);
    res.json({ success: true, message: 'Média supprimé' });
  } catch (err) {
    console.error('❌ Erreur suppression média:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== ROUTES POUR LE LOGO ====================

// Upload du logo
app.post('/api/logo/upload', authenticateToken, upload.single('file'), async (req, res) => {
  console.log('🖼️ Upload du logo');

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    await db.query(
      `INSERT INTO settings_site (cle, valeur, type, description) 
       VALUES ('logo_url', ?, 'url', 'Logo du site')
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
      [fileUrl]
    );

    console.log('✅ Logo uploadé et sauvegardé');
    res.json({
      success: true,
      logo_url: fileUrl,
      message: 'Logo uploadé avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur upload logo:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROUTES POUR LE HERO BACKGROUND ====================

// Upload d'image hero background
app.post('/api/settings/upload/hero-background', authenticateToken, upload.single('file'), async (req, res) => {
  console.log('🖼️ Upload d\'image hero background');

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Trouver le prochain index disponible
    const results = await db.query(
      "SELECT cle FROM settings_site WHERE cle LIKE 'hero_background_%'"
    );
    
    const indexes = results
      .map(r => parseInt(r.cle.replace('hero_background_', '')))
      .filter(n => !isNaN(n));
    const nextIndex = indexes.length > 0 ? Math.max(...indexes) + 1 : 0;

    await db.query(
      `INSERT INTO settings_site (cle, valeur, type, description) 
       VALUES (?, ?, 'image', 'Image hero background')`,
      [`hero_background_${nextIndex}`, fileUrl]
    );

    console.log(`✅ Image hero background uploadée avec index ${nextIndex}`);
    res.json({
      success: true,
      url: fileUrl,
      index: nextIndex,
      message: 'Image uploadée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur upload hero background:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== INITIALISATION ====================

// Tester la connexion et initialiser la base de données
(async () => {
  const isConnected = await db.testConnection();
  if (isConnected) {
    await db.initializeDatabase();
  }
})();

// ==================== GESTION DES ERREURS 404 ====================
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ==================== GESTIONNAIRE D'ERREURS GLOBAL ====================
app.use((err, req, res, next) => {
  console.error('💥 ERREUR GLOBALE:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Fichier trop volumineux (max 50MB)' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== EXPORT POUR VER
module.exports = app;
