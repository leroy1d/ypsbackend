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

// Configuration CORS
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// IMPORTANT: Middleware express.json() doit être AVANT le middleware de logging
app.use(express.json());

// Middleware pour logger les requêtes - VERSION CORRIGÉE
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📨 [${timestamp}] ${req.method} ${req.url}`);
  console.log('   IP:', req.ip);

  // Vérification sécurisée du body
  if (req.body) {
    if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      console.log('   Body:', req.body);
    } else if (req.body && Object.keys(req.body).length === 0) {
      console.log('   Body: {} (objet vide)');
    }
  } else {
    console.log('   Body: Non défini (GET request ou body vide)');
  }

  // Log des headers d'autorisation (masqué pour sécurité)
  if (req.headers.authorization) {
    const authHeader = req.headers.authorization;
    const tokenType = authHeader.split(' ')[0];
    console.log('   Auth:', `${tokenType} [token masqué]`);
  }

  // Capturer la réponse pour logger le status
  const originalSend = res.send;
  res.send = function (data) {
    console.log(`✅ [${timestamp}] ${req.method} ${req.url} - Status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.log('   Erreur:', data);
    }
    originalSend.apply(res, arguments);
  };

  next();
});

// Servir les fichiers statiques du dossier uploads
app.use('/uploads', express.static('uploads'));

// Ou si uploads est dans un sous-dossier
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Dans votre backend Express, ajoutez :
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Configuration de Multer pour l'upload des fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Créer le dossier uploads s'il n'existe pas
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Mapping des extensions aux types MIME
    const mimeTypes = {
      // Images
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.tiff': 'image/tiff',
      
      // Vidéos
      '.mp4': 'video/mp4',
      '.mpeg': 'video/mpeg',
      '.ogv': 'video/ogg',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.3gp': 'video/3gpp',
      
      // Documents
      '.pdf': 'application/pdf',
      
      // Word
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.dot': 'application/msword',
      '.dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
      
      // PowerPoint
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.pps': 'application/vnd.ms-powerpoint',
      '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
      '.pot': 'application/vnd.ms-powerpoint',
      '.potx': 'application/vnd.openxmlformats-officedocument.presentationml.template',
      
      // Autres
      '.rtf': 'application/rtf',
      '.txt': 'text/plain',
      '.odt': 'application/vnd.oasis.opendocument.text',
      '.odp': 'application/vnd.oasis.opendocument.presentation',
      '.zip': 'application/zip'
    };

    const ext = path.extname(file.originalname).toLowerCase();
    console.log('📁 Fichier reçu:', file.originalname);
    console.log('📋 Type MIME déclaré:', file.mimetype);
    console.log('🔍 Extension détectée:', ext);

    // Vérifier si l'extension est supportée
    if (mimeTypes[ext]) {
      // Si le type MIME est vide ou incorrect, le corriger
      if (!file.mimetype || file.mimetype === 'application/octet-stream') {
        file.mimetype = mimeTypes[ext];
        console.log('✅ Type MIME corrigé:', file.mimetype);
      }
      
      console.log('✅ Fichier accepté');
      cb(null, true);
    } else {
      console.log('❌ Extension non supportée:', ext);
      
      // Liste des types supportés pour le message d'erreur
      const supportedTypes = [
        'Images: JPG, PNG, GIF, WEBP, SVG, BMP, TIFF',
        'Vidéos: MP4, MPEG, OGV, WEBM, MOV, AVI, MKV, 3GP',
        'Documents: PDF, DOC, DOCX, PPT, PPTX, RTF, TXT, ODT, ODP'
      ].join('\n');
      
      cb(new Error(`Type de fichier non supporté: ${ext}. Formats acceptés:\n${supportedTypes}`), false);
    }
  }
});

// Connexion MySQL
const db = mysql.createConnection({
  host: 'bu2lzbc2luiolb9b29j8-mysql.services.clever-cloud.com',
  user: 'uknuhxtgvt1juuse',
  password: 'wNbYSj927pYX2K5s6nDB',
  database: 'bu2lzbc2luiolb9b29j8',
  port:3306,
  waitForConnections: true,
  connectionLimit: 1000000,
  queueLimit: 0
});

// const db = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: 'musk',
//   database: 'cnjps',
//   waitForConnections: true,
//   connectionLimit: 1000000,
//   queueLimit: 0
// });
//uri:mysql://uknuhxtgvt1juuse:wNbYSj927pYX2K5s6nDB@bu2lzbc2luiolb9b29j8-mysql.services.clever-cloud.com:3306/bu2lzbc2luiolb9b29j8
//cli:mysql -h bu2lzbc2luiolb9b29j8-mysql.services.clever-cloud.com -P 3306 -u uknuhxtgvt1juuse -p bu2lzbc2luiolb9b29j8


db.connect(err => {
  if (err) {
    console.error('❌ ERREUR MYSQL:', err.message);
    console.error('Code erreur:', err.code);
    console.error('Numéro erreur:', err.errno);
    console.error('État SQL:', err.sqlState);
    return;
  }
  console.log('✅ Connecté à MySQL avec succès');
  console.log('📈 Connection ID:', db.threadId);
  initialiserBaseDeDonnees();
});

function initialiserBaseDeDonnees() {
  console.log('🗄️ Initialisation de la base de données...');

  // Création des tables avec colonnes photos
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
      name: 'medias',
      sql: `CREATE TABLE IF NOT EXISTS medias (
        id INT PRIMARY KEY AUTO_INCREMENT,
        titre VARCHAR(200),
        description TEXT,
        type ENUM('image', 'video', 'document') DEFAULT 'image',
        url VARCHAR(500) NOT NULL,
        projet_id INT,
        article_id INT,
        categorie_id INT,
        is_featured BOOLEAN DEFAULT false,
        ordre INT DEFAULT 0,
        taille VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projet_id) REFERENCES actions(id) ON DELETE SET NULL,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL
      )`
    },
    {
      name: 'temoignages',
      sql: `CREATE TABLE IF NOT EXISTS temoignages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nom VARCHAR(100) NOT NULL,
        fonction VARCHAR(100),
        pays VARCHAR(100),
        contenu TEXT NOT NULL,
        note INT DEFAULT 5,
        projet_id INT,
        photo_url VARCHAR(500),
        approuve BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projet_id) REFERENCES actions(id) ON DELETE SET NULL
      )`
    },
    {
      name: 'faq',
      sql: `CREATE TABLE IF NOT EXISTS faq (
        id INT PRIMARY KEY AUTO_INCREMENT,
        question TEXT NOT NULL,
        reponse TEXT NOT NULL,
        categorie VARCHAR(50),
        ordre INT DEFAULT 0,
        actif BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    },
    {
      name: 'statistiques',
      sql: `CREATE TABLE IF NOT EXISTS statistiques (
        id INT PRIMARY KEY AUTO_INCREMENT,
        annee YEAR NOT NULL,
        type VARCHAR(50),
        valeur VARCHAR(100) NOT NULL,
        label VARCHAR(100),
        description TEXT,
        categorie VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_stat (annee, type, categorie)
      )`
    },
    {
      name: 'evenements',
      sql: `CREATE TABLE IF NOT EXISTS evenements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        titre VARCHAR(200) NOT NULL,
        description TEXT,
        type VARCHAR(50),
        date_debut DATETIME,
        date_fin DATETIME,
        lieu VARCHAR(200),
        statut VARCHAR(50),
        projet_id INT,
        images TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projet_id) REFERENCES actions(id) ON DELETE SET NULL
      )`
    },
    {
      name: 'categories',
      sql: `CREATE TABLE IF NOT EXISTS categories (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nom VARCHAR(100) NOT NULL,
        description TEXT,
        icone VARCHAR(100),
        couleur VARCHAR(20) DEFAULT '#3498DB',
        ordre INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    }
  ];

  tables.forEach((table, index) => {
    console.log(`📋 Création table ${index + 1}/${tables.length}: ${table.name}`);
    db.query(table.sql, (err) => {
      if (err) {
        console.error(`❌ Erreur création table ${table.name}:`, err.message);
      } else {
        console.log(`✅ Table ${table.name} créée/vérifiée`);
      }
    });
  });

  // Ajouter la colonne photo aux tables existantes si nécessaire
  const addPhotoColumnQueries = [
    { table: 'admins', column: 'photo' },
    { table: 'benevoles', column: 'photo' },
    { table: 'membres', column: 'photo' },
    { table: 'articles', column: 'images' },
    { table: 'actions', column: 'videos' },
    { table: 'evenements', column: 'images' }
  ];

  addPhotoColumnQueries.forEach(({ table, column }) => {
    db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`,
      (err, results) => {
        if (err) {
          console.error(`❌ Erreur vérification colonne ${column}:`, err.message);
        } else if (results.length === 0) {
          console.log(`➕ Ajout colonne ${column} à la table ${table}...`);
          db.query(`ALTER TABLE ${table} ADD COLUMN ${column} VARCHAR(500)`, (alterErr) => {
            if (alterErr) {
              console.error(`❌ Erreur ajout colonne ${column}:`, alterErr.message);
            } else {
              console.log(`✅ Colonne ${column} ajoutée à ${table}`);
            }
          });
        }
      }
    );
  });

  // Créer admin par défaut
  console.log('👤 Création admin par défaut...');
  const adminPassword = bcrypt.hashSync('admin123', 8);
  db.query(
    `INSERT IGNORE INTO admins (email, password, nom, role) 
     VALUES (?, ?, ?, ?)`,
    ['admin@association.org', adminPassword, 'Admin Principal', 'superadmin'],
    (err, result) => {
      if (err) {
        console.error('❌ Erreur création admin:', err.message);
      } else if (result.affectedRows > 0) {
        console.log('✅ Admin par défaut créé');
        console.log('   Email: admin@association.org');
        console.log('   Password: admin123');
      } else {
        console.log('ℹ️ Admin par défaut existe déjà');
      }
    }
  );
}

// Middleware d'authentification
const authentifierToken = (req, res, next) => {
  console.log('🔐 Middleware d\'authentification appelé');

  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    console.log('❌ Token manquant - Envoi 401');
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    console.log('❌ Format token invalide - Envoi 401');
    return res.status(401).json({ error: 'Format token invalide' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
    if (err) {
      console.log('❌ Token invalide:', err.message);
      return res.status(403).json({ error: 'Token invalide' });
    }
    console.log('✅ Token valide pour:', user.email);
    req.user = user;
    next();
  });
};

// ==================== ROUTES POUR UPLOAD DE MÉDIAS ====================

// Single file upload
app.post('/api/upload', authentifierToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    console.log('✅ Fichier uploadé:', req.file.originalname);
    console.log('   URL:', fileUrl);
    console.log('   Taille:', req.file.size);
    console.log('   Type:', req.file.mimetype);

    res.json({
      success: true,
      file: {
        url: fileUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        type: req.file.mimetype.startsWith('image/') ? 'image' : 'video'
      }
    });
  } catch (error) {
    console.error('❌ Erreur upload:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Multiple files upload
app.post('/api/upload/multiple', authentifierToken, upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    const files = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      type: file.mimetype.startsWith('image/') ? 'image' : 'video'
    }));

    console.log(`✅ ${files.length} fichier(s) uploadé(s)`);

    res.json({
      success: true,
      files: files,
      count: files.length
    });
  } catch (error) {
    console.error('❌ Erreur upload multiple:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload multiple' });
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// ==================== ROUTES AMÉLIORÉES POUR MÉDIAS ====================

// GET - Récupérer tous les médias
app.get('/api/medias', authentifierToken, (req, res) => {
  const { type, projet_id, article_id, categorie_id, limit = 100 } = req.query;

  let query = 'SELECT * FROM medias WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (projet_id) {
    query += ' AND projet_id = ?';
    params.push(projet_id);
  }
  if (article_id) {
    query += ' AND article_id = ?';
    params.push(article_id);
  }
  if (categorie_id) {
    query += ' AND categorie_id = ?';
    params.push(categorie_id);
  }

  query += ' ORDER BY ordre ASC, created_at DESC LIMIT ?';
  params.push(parseInt(limit));

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération médias:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ ${results.length} média(s) récupéré(s)`);
    res.json(results);
  });
});

// POST - Upload et enregistrement de média
app.post('/api/medias', authentifierToken, upload.single('file'), async (req, res) => {
  try {
    const { titre, description, type, projet_id, article_id, categorie_id, is_featured, ordre } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    const sql = `
      INSERT INTO medias 
        (titre, description, type, url, projet_id, article_id, categorie_id, is_featured, ordre, taille)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      titre || req.file.originalname,
      description || '',
      type || (req.file.mimetype.startsWith('image/') ? 'image' : 'video'),
      fileUrl,
      projet_id || null,
      article_id || null,
      categorie_id || null,
      is_featured === 'true' || false,
      ordre || 0,
      `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL enregistrement média:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Média enregistré avec succès:', result.insertId);
      res.json({
        success: true,
        id: result.insertId,
        media: {
          id: result.insertId,
          titre: params[0],
          url: fileUrl,
          type: params[2],
          size: params[9]
        }
      });
    });
  } catch (error) {
    console.error('❌ Erreur upload média:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// DELETE - Supprimer un média
app.delete('/api/medias/:id', authentifierToken, (req, res) => {
  const id = req.params.id;

  // Récupérer d'abord les informations du média
  db.query('SELECT url FROM medias WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération média:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Média non trouvé' });
    }

    const mediaUrl = results[0].url;
    const filePath = path.join(__dirname, '..', mediaUrl);

    // Supprimer le fichier du système de fichiers
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr && unlinkErr.code !== 'ENOENT') {
        console.error('❌ Erreur suppression fichier:', unlinkErr.message);
      }

      // Supprimer l'entrée de la base de données
      db.query('DELETE FROM medias WHERE id = ?', [id], (deleteErr) => {
        if (deleteErr) {
          console.error('❌ Erreur SQL suppression média:', deleteErr.message);
          return res.status(500).json({ error: deleteErr.message });
        }

        console.log('✅ Média supprimé:', mediaUrl);
        res.json({ success: true, message: 'Média supprimé avec succès' });
      });
    });
  });
});

// ==================== ROUTES POUR GALERIE ====================

// GET - Récupérer la galerie (médias sans association spécifique)
app.get('/api/gallery', (req, res) => {
  const { page = 1, limit = 20, type } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM medias WHERE projet_id IS NULL AND article_id IS NULL';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL galerie:', err.message);
      return res.status(500).json({ error: err.message });
    }

    // Récupérer le nombre total
    let countQuery = 'SELECT COUNT(*) as total FROM medias WHERE projet_id IS NULL AND article_id IS NULL';
    const countParams = [];

    if (type) {
      countQuery += ' AND type = ?';
      countParams.push(type);
    }

    db.query(countQuery, countParams, (countErr, countResults) => {
      if (countErr) {
        console.error('❌ Erreur SQL compte galerie:', countErr.message);
        return res.status(500).json({ error: countErr.message });
      }

      const total = countResults[0].total;
      const totalPages = Math.ceil(total / limit);

      res.json({
        items: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    });
  });
});

// Routes d'authentification
app.post('/api/login', (req, res) => {
  console.log('🔑 Tentative de connexion');

  const { email, password } = req.body;

  if (!email || !password) {
    console.log('❌ Champs manquants');
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  db.query('SELECT * FROM admins WHERE email = ?', [email], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL login:', err.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (results.length === 0) {
      console.log('❌ Email incorrect');
      return res.status(401).json({ error: 'Email incorrect' });
    }

    const user = results[0];

    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      console.log('❌ Mot de passe incorrect');
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
  });
});

// ==================== ROUTES DASHBOARD ====================
app.get('/api/dashboard/stats', (req, res) => {
  console.log('📊 Récupération statistiques dashboard');

  const stats = {};

  db.query('SELECT COUNT(*) as count FROM benevoles WHERE statut = "actif"', (err, result) => {
    if (err) {
      console.error('❌ Erreur SQL bénévoles:', err.message);
      return res.status(500).json({ error: err.message });
    }

    stats.benevolesActifs = result[0]?.count || 0;

    db.query(
      `SELECT SUM(montant) as total FROM dons 
       WHERE MONTH(date_don) = MONTH(CURRENT_DATE()) 
       AND YEAR(date_don) = YEAR(CURRENT_DATE())
       AND statut = "valide"`,
      (err, result) => {
        if (err) {
          console.error('❌ Erreur SQL dons du mois:', err.message);
          return res.status(500).json({ error: err.message });
        }

        stats.donsMois = result[0]?.total || 0;

        db.query('SELECT COUNT(*) as count FROM actions WHERE statut = "en_cours"', (err, result) => {
          if (err) {
            console.error('❌ Erreur SQL actions:', err.message);
            return res.status(500).json({ error: err.message });
          }

          stats.actionsEnCours = result[0]?.count || 0;

          db.query(
            `SELECT SUM(nombre) as total FROM visiteurs 
             WHERE date_visite >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`,
            (err, result) => {
              if (err) {
                console.error('❌ Erreur SQL visiteurs:', err.message);
                return res.status(500).json({ error: err.message });
              }

              stats.visiteurs30Jours = result[0]?.total || 1250;

              console.log('✅ Statistiques envoyées:', stats);
              res.json(stats);
            }
          );
        });
      }
    );
  });
});

app.get('/api/dashboard/dons-graph', authentifierToken, (req, res) => {
  console.log('📈 Récupération données graphique dons');

  db.query(
    `SELECT DATE_FORMAT(date_don, '%Y-%m') as mois, 
            SUM(montant) as total 
     FROM dons 
     WHERE date_don >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
     AND statut = 'valide'
     GROUP BY DATE_FORMAT(date_don, '%Y-%m')
     ORDER BY mois`,
    (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL graphique dons:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Données graphique envoyées:', results.length, 'mois');
      res.json(results);
    }
  );
});

// ==================== ROUTES GESTION CONTENU ====================
app.get('/api/actions', (req, res) => {
  console.log('📋 Récupération liste actions');

  db.query('SELECT * FROM actions ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL actions:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Actions envoyées:', results.length, 'action(s)');
    res.json(results);
  });
});

app.post('/api/actions', authentifierToken, (req, res) => {
  console.log('➕ Création nouvelle action');

  const { titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires } = req.body;

  if (!titre || !description) {
    console.log('❌ Champs manquants pour création action');
    return res.status(400).json({ error: 'Titre et description requis' });
  }

  db.query(
    `INSERT INTO actions (titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires],
    (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL création action:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Action créée, ID:', result.insertId);
      res.json({ id: result.insertId, message: 'Action créée' });
    }
  );
});

app.put('/api/actions/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour action ID:', id);

  const { titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires } = req.body;

  db.query(
    `UPDATE actions SET titre=?, description=?, type=?, date_debut=?, date_fin=?, budget=?, statut=?, photos=?, videos=?, pays=?, localisation=?, partenaires=? 
     WHERE id=?`,
    [titre, description, type, date_debut, date_fin, budget, statut, photos, videos, pays, localisation, partenaires, id],
    (err) => {
      if (err) {
        console.error('❌ Erreur SQL mise à jour action:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Action mise à jour');
      res.json({ message: 'Action mise à jour' });
    }
  );
});

app.delete('/api/actions/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression action ID:', id);

  db.query('DELETE FROM actions WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('❌ Erreur SQL suppression action:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Action supprimée');
    res.json({ message: 'Action supprimée' });
  });
});

// ==================== ROUTES POUR ARTICLES ====================
app.get('/api/articles', (req, res) => {
  console.log('📰 Récupération liste articles');

  db.query('SELECT * FROM articles ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL articles:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Articles envoyés:', results.length, 'article(s)');
    res.json(results);
  });
});

app.get('/api/articles/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération article ID:', id);

  db.query('SELECT * FROM articles WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération article:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Article non trouvé ID:', id);
      return res.status(404).json({ error: 'Article non trouvé' });
    }

    console.log('✅ Article trouvé:', results[0].titre);
    res.json(results[0]);
  });
});

app.post('/api/articles', authentifierToken, (req, res) => {
  console.log('➕ Création nouvel article');

  const { titre, contenu, auteur, categorie, image_url, images, publie, resume, mots_cles } = req.body;

  if (!titre || !contenu) {
    console.log('❌ Champs manquants pour création article');
    return res.status(400).json({ error: 'Titre et contenu requis' });
  }

  db.query(
    `INSERT INTO articles (titre, contenu, auteur, categorie, image_url, images, publie, resume, mots_cles) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titre, contenu, auteur, categorie, image_url, images, publie, resume, mots_cles],
    (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL création article:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Article créé, ID:', result.insertId);
      res.json({ id: result.insertId, message: 'Article créé' });
    }
  );
});

app.put('/api/articles/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log(req.body);

  console.log('✏️ Mise à jour article ID:', id);

  const { titre, contenu, auteur, categorie, image_url, images, publie, resume, mots_cles } = req.body;

  if (!titre || !contenu) {
    console.log('❌ Champs manquants pour mise à jour article');
    return res.status(400).json({ error: 'Titre et contenu requis' });
  }

  // Vérifier si l'article existe
  db.query('SELECT * FROM articles WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification article:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Article non trouvé ID:', id);
      return res.status(404).json({ error: 'Article non trouvé' });
    }

    db.query(
      `UPDATE articles SET 
        titre = ?, 
        contenu = ?, 
        auteur = ?, 
        categorie = ?, 
        image_url = ?, 
        images = ?,
        publie = ?,
        resume = ?,
        mots_cles = ?
       WHERE id = ?`,
      [titre, contenu, auteur, categorie, image_url, images, publie, resume, mots_cles, id],
      (err) => {
        if (err) {
          console.error('❌ Erreur SQL mise à jour article:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ Article mis à jour');
        res.json({ message: 'Article mis à jour avec succès' });
      }
    );
  });
});

app.put('/api/articles/:id/publier', authentifierToken, (req, res) => {
  const id = req.params.id;
  const { publie } = req.body;

  console.log('🔄 Changement état publication article ID:', id);

  db.query(
    'UPDATE articles SET publie = ? WHERE id = ?',
    [publie, id],
    (err) => {
      if (err) {
        console.error('❌ Erreur SQL toggle publication:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ État publication mis à jour');
      res.json({
        message: publie ? 'Article publié' : 'Article dépublié'
      });
    }
  );
});

app.delete('/api/articles/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression article ID:', id);

  db.query('SELECT * FROM articles WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification article:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Article non trouvé ID:', id);
      return res.status(404).json({ error: 'Article non trouvé' });
    }

    db.query('DELETE FROM articles WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression article:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Article supprimé:', results[0].titre);
      res.json({
        message: 'Article supprimé avec succès',
        article: results[0]
      });
    });
  });
});

app.get('/api/articles/recherche/:term', authentifierToken, (req, res) => {
  const term = req.params.term;
  console.log('🔍 Recherche articles avec terme:', term);

  const searchTerm = `%${term}%`;
  db.query(
    `SELECT * FROM articles 
     WHERE titre LIKE ? OR contenu LIKE ? OR auteur LIKE ? OR categorie LIKE ?
     ORDER BY created_at DESC LIMIT 50`,
    [searchTerm, searchTerm, searchTerm, searchTerm],
    (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL recherche articles:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Résultats recherche:', results.length, 'article(s) trouvé(s)');
      res.json(results);
    }
  );
});

app.get('/api/articles/stats', authentifierToken, (req, res) => {
  console.log('📊 Récupération statistiques articles');

  db.query(
    `SELECT 
      COUNT(*) as total_articles,
      SUM(publie = 1) as articles_publies,
      SUM(publie = 0) as articles_non_publies,
      COUNT(DISTINCT categorie) as categories_uniques,
      COUNT(DISTINCT auteur) as auteurs_uniques
     FROM articles`,
    (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL statistiques articles:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Statistiques articles envoyées');
      res.json(results[0]);
    }
  );
});

// ==================== ROUTES GESTION UTILISATEURS ====================
app.get('/api/benevoles',(req, res) => {
  console.log('👥 Récupération liste bénévoles');

  db.query('SELECT * FROM benevoles ORDER BY date_inscription DESC', (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL bénévoles:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Bénévoles envoyés:', results.length, 'bénévole(s)');
    res.json(results);
  });
});

app.post('/api/benevoles', (req, res) => {
  console.log('➕ Ajout nouveau bénévole');

  const { nom, email, telephone, competences, disponibilite, statut, photo } = req.body;

  if (!nom || !email) {
    console.log('❌ Champs manquants pour création bénévole');
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  db.query(
    `INSERT INTO benevoles (nom, email, telephone, competences, disponibilite, statut, photo) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [nom, email, telephone, competences, disponibilite, statut || 'actif', photo],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log('❌ Email déjà utilisé');
          return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }
        console.error('❌ Erreur SQL création bénévole:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Bénévole ajouté, ID:', result.insertId);
      res.json({
        id: result.insertId,
        message: 'Bénévole ajouté avec succès',
        benevole: { id: result.insertId, nom, email }
      });
    }
  );
});

app.put('/api/benevoles/:id',(req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour bénévole ID:', id);

  const { nom, email, telephone, competences, disponibilite, statut, photo } = req.body;

  db.query('SELECT * FROM benevoles WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification bénévole:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Bénévole non trouvé ID:', id);
      return res.status(404).json({ error: 'Bénévole non trouvé' });
    }

    db.query(
      `UPDATE benevoles SET 
        nom = ?, 
        email = ?, 
        telephone = ?, 
        competences = ?, 
        disponibilite = ?, 
        statut = ?,
        photo = ?
       WHERE id = ?`,
      [nom, email, telephone, competences, disponibilite, statut, photo, id],
      (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            console.log('❌ Email déjà utilisé');
            return res.status(409).json({ error: 'Cet email est déjà utilisé' });
          }
          console.error('❌ Erreur SQL mise à jour bénévole:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ Bénévole mis à jour');
        res.json({ message: 'Bénévole mis à jour avec succès' });
      }
    );
  });
});

app.put('/api/benevoles/:id/statut', (req, res) => {
  const id = req.params.id;
  const { statut } = req.body;

  console.log('🔄 Changement statut bénévole ID:', id);

  db.query(
    'UPDATE benevoles SET statut = ? WHERE id = ?',
    [statut, id],
    (err) => {
      if (err) {
        console.error('❌ Erreur SQL mise à jour statut:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Statut bénévole mis à jour');
      res.json({ message: 'Statut mis à jour' });
    }
  );
});

app.delete('/api/benevoles/:id', (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression bénévole ID:', id);

  db.query('SELECT * FROM benevoles WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification bénévole:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Bénévole non trouvé ID:', id);
      return res.status(404).json({ error: 'Bénévole non trouvé' });
    }

    db.query('DELETE FROM benevoles WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression bénévole:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Bénévole supprimé:', results[0].nom);
      res.json({
        message: 'Bénévole supprimé avec succès',
        benevole: results[0]
      });
    });
  });
});

// ==================== ROUTES MEMBRES ====================
app.get('/api/membres',(req, res) => {
  console.log('👥 Récupération liste membres');

  db.query('SELECT * FROM membres ORDER BY created_at DESC', (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL membres:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Membres envoyés:', results.length, 'membre(s)');
    res.json(results);
  });
});

app.post('/api/membres', (req, res) => {
  console.log('➕ Création nouveau membre');

  const { nom, email, date_adhesion, cotisation_payee, photo } = req.body;

  if (!nom || !email) {
    console.log('❌ Champs manquants pour création membre');
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  db.query(
    `INSERT INTO membres (nom, email, date_adhesion, cotisation_payee, photo) 
     VALUES (?, ?, ?, ?, ?)`,
    [nom, email, date_adhesion, cotisation_payee || false, photo],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          console.log('❌ Email déjà utilisé');
          return res.status(409).json({ error: 'Cet email est déjà utilisé' });
        }
        console.error('❌ Erreur SQL création membre:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Membre créé, ID:', result.insertId);
      res.json({
        id: result.insertId,
        message: 'Membre créé avec succès',
        membre: { id: result.insertId, nom, email }
      });
    }
  );
});

app.put('/api/membres/:id',(req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour membre ID:', id);

  const { nom, email, date_adhesion, cotisation_payee, photo } = req.body;

  db.query('SELECT * FROM membres WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification membre:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Membre non trouvé ID:', id);
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    db.query(
      `UPDATE membres SET 
        nom = ?, 
        email = ?, 
        date_adhesion = ?, 
        cotisation_payee = ?,
        photo = ?
       WHERE id = ?`,
      [nom, email, date_adhesion, cotisation_payee, photo, id],
      (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            console.log('❌ Email déjà utilisé');
            return res.status(409).json({ error: 'Cet email est déjà utilisé' });
          }
          console.error('❌ Erreur SQL mise à jour membre:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ Membre mis à jour');
        res.json({ message: 'Membre mis à jour avec succès' });
      }
    );
  });
});

app.put('/api/membres/:id/cotisation',(req, res) => {
  const id = req.params.id;
  const { cotisation_payee } = req.body;

  console.log('🔄 Changement cotisation membre ID:', id);

  db.query(
    'UPDATE membres SET cotisation_payee = ? WHERE id = ?',
    [cotisation_payee, id],
    (err) => {
      if (err) {
        console.error('❌ Erreur SQL mise à jour cotisation:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Cotisation membre mise à jour');
      res.json({ message: 'Cotisation mise à jour' });
    }
  );
});

app.delete('/api/membres/:id', (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression membre ID:', id);

  db.query('SELECT * FROM membres WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification membre:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Membre non trouvé ID:', id);
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    db.query('DELETE FROM membres WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression membre:', err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log('✅ Membre supprimé:', results[0].nom);
      res.json({
        message: 'Membre supprimé avec succès',
        membre: results[0]
      });
    });
  });
});

// ==================== ROUTES CRUD COMPLET POUR LES DONS ====================
app.get('/api/dons', authentifierToken, (req, res) => {
  console.log('💰 Récupération liste dons');

  db.query('SELECT * FROM dons ORDER BY date_don DESC', (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL dons:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Dons envoyés:', results.length, 'don(s)');
    res.json(results);
  });
});

app.get('/api/dons/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération don ID:', id);

  db.query('SELECT * FROM dons WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération don:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Don non trouvé ID:', id);
      return res.status(404).json({ error: 'Don non trouvé' });
    }

    console.log('✅ Don trouvé:', results[0].donateur_nom);
    res.json(results[0]);
  });
});

app.post('/api/dons', authentifierToken, (req, res) => {
  console.log('💰 Création nouveau don');

  const {
    donateur_nom,
    email,
    montant,
    devise,
    methode_paiement,
    projet_associe,
    statut,
    notes
  } = req.body;

  if (!donateur_nom || !montant) {
    console.log('❌ Champs manquants pour création don');
    return res.status(400).json({ error: 'Nom du donateur et montant requis' });
  }

  db.query(
    `INSERT INTO dons 
     (donateur_nom, email, montant, devise, methode_paiement, projet_associe, statut, notes) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [donateur_nom, email, montant, devise || 'EUR', methode_paiement, projet_associe, statut || 'en_attente', notes],
    (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL création don:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Don créé, ID:', result.insertId);
      res.json({
        id: result.insertId,
        message: 'Don créé avec succès',
        don: { id: result.insertId, donateur_nom, email, montant }
      });
    }
  );
});

app.put('/api/dons/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour don ID:', id);

  const {
    donateur_nom,
    email,
    montant,
    devise,
    methode_paiement,
    projet_associe,
    statut,
    reçu_fiscal_envoye,
    notes
  } = req.body;

  db.query(
    `UPDATE dons SET 
      donateur_nom = ?, 
      email = ?, 
      montant = ?, 
      devise = ?, 
      methode_paiement = ?, 
      projet_associe = ?, 
      statut = ?,
      reçu_fiscal_envoye = ?,
      notes = ?
     WHERE id = ?`,
    [donateur_nom, email, montant, devise, methode_paiement, projet_associe, statut, reçu_fiscal_envoye, notes, id],
    (err) => {
      if (err) {
        console.error('❌ Erreur SQL mise à jour don:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Don mis à jour');
      res.json({ message: 'Don mis à jour avec succès' });
    }
  );
});

app.put('/api/dons/:id/statut', authentifierToken, (req, res) => {
  const id = req.params.id;
  const { statut, reçu_fiscal_envoye } = req.body;

  console.log('🔄 Changement statut don ID:', id);

  db.query(
    'UPDATE dons SET statut = ?, reçu_fiscal_envoye = ? WHERE id = ?',
    [statut, reçu_fiscal_envoye, id],
    (err) => {
      if (err) {
        console.error('❌ Erreur SQL mise à jour statut don:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Statut don mis à jour');
      res.json({ message: 'Don mis à jour' });
    }
  );
});

app.delete('/api/dons/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression don ID:', id);

  db.query('DELETE FROM dons WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('❌ Erreur SQL suppression don:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Don supprimé');
    res.json({ message: 'Don supprimé avec succès' });
  });
});

app.get('/api/dons/recherche/:term', authentifierToken, (req, res) => {
  const term = req.params.term;
  console.log('🔍 Recherche dons avec terme:', term);

  const searchTerm = `%${term}%`;
  db.query(
    `SELECT * FROM dons 
     WHERE donateur_nom LIKE ? OR email LIKE ? OR projet_associe LIKE ?
     ORDER BY date_don DESC LIMIT 50`,
    [searchTerm, searchTerm, searchTerm],
    (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL recherche dons:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Résultats recherche:', results.length, 'don(s) trouvé(s)');
      res.json(results);
    }
  );
});

app.get('/api/dons/stats', authentifierToken, (req, res) => {
  console.log('📊 Récupération statistiques dons');

  db.query(
    `SELECT 
      COUNT(*) as total_dons,
      SUM(montant) as montant_total,
      AVG(montant) as montant_moyen,
      COUNT(DISTINCT donateur_nom) as donateurs_uniques
     FROM dons 
     WHERE statut = "valide"`,
    (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL statistiques dons:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Statistiques dons envoyées');
      res.json(results[0]);
    }
  );
});

// ==================== ROUTES CATÉGORIES ====================
app.get('/api/categories', authentifierToken, (req, res) => {
  db.query('SELECT * FROM categories ORDER BY ordre ASC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/categories', authentifierToken, (req, res) => {
  const { nom, description, icone, couleur, ordre } = req.body;
  db.query(
    'INSERT INTO categories (nom, description, icone, couleur, ordre) VALUES (?, ?, ?, ?, ?)',
    [nom, description, icone, couleur, ordre],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, message: 'Catégorie créée' });
    }
  );
});

// ==================== ROUTES TÉMOIGNAGES ====================
app.get('/api/temoignages', authentifierToken, (req, res) => {
  const query = `
    SELECT t.*, p.titre as projet_titre
    FROM temoignages t
    LEFT JOIN actions p ON t.projet_id = p.id
    ORDER BY t.created_at DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/temoignages', authentifierToken, (req, res) => {
  const { nom, fonction, pays, contenu, note, projet_id, photo_url } = req.body;

  db.query(
    `INSERT INTO temoignages (nom, fonction, pays, contenu, note, projet_id, photo_url, approuve)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, fonction, pays, contenu, note, projet_id, photo_url, false],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, message: 'Témoignage soumis' });
    }
  );
});

// ==================== ROUTES FAQ ====================
app.get('/api/faq', authentifierToken, (req, res) => {
  db.query(
    'SELECT * FROM faq WHERE actif = TRUE ORDER BY ordre ASC, categorie',
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

app.post('/api/faq', authentifierToken, (req, res) => {
  const { question, reponse, categorie, ordre } = req.body;

  db.query(
    'INSERT INTO faq (question, reponse, categorie, ordre) VALUES (?, ?, ?, ?)',
    [question, reponse, categorie, ordre],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, message: 'FAQ créée' });
    }
  );
});

// ==================== ROUTES ÉVÉNEMENTS ====================
app.get('/api/evenements', authentifierToken, (req, res) => {
  const query = `
    SELECT e.*, p.titre as projet_titre
    FROM evenements e
    LEFT JOIN actions p ON e.projet_id = p.id
    ORDER BY e.date_debut DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/evenements', authentifierToken, (req, res) => {
  const { titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images } = req.body;

  db.query(
    `INSERT INTO evenements (titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: result.insertId, message: 'Événement créé' });
    }
  );
});

// ==================== ROUTES STATISTIQUES ====================
app.get('/api/statistiques/:annee', authentifierToken, (req, res) => {
  const { annee } = req.params;
  db.query(
    'SELECT * FROM statistiques WHERE annee = ? ORDER BY type, categorie',
    [annee],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

app.post('/api/statistiques', authentifierToken, (req, res) => {
  const { annee, type, valeur, label, description, categorie } = req.body;

  db.query(
    `INSERT INTO statistiques (annee, type, valeur, label, description, categorie)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       valeur = VALUES(valeur),
       label = VALUES(label),
       description = VALUES(description)`,
    [annee, type, valeur, label, description, categorie],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Statistique enregistrée' });
    }
  );
});

// ==================== ROUTES POUR LOGO ====================
app.post('/api/logo/upload', authentifierToken, (req, res) => {
  console.log('🖼️ Upload du logo');

  const { logo_url, description } = req.body;

  if (!logo_url) {
    console.log('❌ URL du logo manquante');
    return res.status(400).json({ error: 'URL du logo requise' });
  }

  const sql = `
    CREATE TABLE IF NOT EXISTS settings_site (
      id INT PRIMARY KEY AUTO_INCREMENT,
      cle VARCHAR(50) UNIQUE NOT NULL,
      valeur TEXT,
      description TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  db.query(sql, (err) => {
    if (err) {
      console.error('❌ Erreur création table paramètres:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const upsertLogo = `
      INSERT INTO settings_site (cle, valeur, description) 
      VALUES ('logo_url', ?, ?)
      ON DUPLICATE KEY UPDATE 
        valeur = VALUES(valeur),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `;

    db.query(upsertLogo, [logo_url, description || 'Logo de l\'association'], (err, result) => {
      if (err) {
        console.error('❌ Erreur sauvegarde logo:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Logo sauvegardé');
      res.json({
        message: 'Logo sauvegardé avec succès',
        logo_url: logo_url,
        description: description
      });
    });
  });
});

app.get('/api/logo', (req, res) => {
  console.log('🖼️ Récupération du logo');

  db.query(`SHOW TABLES LIKE 'settings_site'`, (err, results) => {
    if (err) {
      console.error('❌ Erreur vérification table:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('ℹ️ Table paramètres non trouvée, retour logo par défaut');
      return res.json({
        logo_url: '/assets/logo-default.png',
        description: 'Logo par défaut',
        is_default: true
      });
    }

    db.query('SELECT * FROM settings_site WHERE cle = "logo_url"', (err, results) => {
      if (err) {
        console.error('❌ Erreur récupération logo:', err.message);
        return res.status(500).json({ error: err.message });
      }

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
    });
  });
});

app.delete('/api/logo', authentifierToken, (req, res) => {
  console.log('🗑️ Suppression du logo personnalisé');

  db.query('DELETE FROM settings WHERE cle = "logo_url"', (err) => {
    if (err) {
      console.error('❌ Erreur suppression logo:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Logo supprimé, retour au logo par défaut');
    res.json({
      message: 'Logo supprimé avec succès',
      default_logo: '/assets/logo-default.png'
    });
  });
});

// ==================== ROUTES MANQUANTES POUR FORMULAIRES COMPLETS ====================

// ===== ROUTES COMPLÈTES POUR CATÉGORIES =====
app.get('/api/categories/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération catégorie ID:', id);

  db.query('SELECT * FROM categories WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération catégorie:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Catégorie non trouvée ID:', id);
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    console.log('✅ Catégorie trouvée:', results[0].nom);
    res.json(results[0]);
  });
});

app.put('/api/categories/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour catégorie ID:', id);

  const { nom, description, icone, couleur, ordre } = req.body;

  if (!nom) {
    console.log('❌ Nom de catégorie manquant');
    return res.status(400).json({ error: 'Nom de catégorie requis' });
  }

  db.query('SELECT * FROM categories WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification catégorie:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Catégorie non trouvée ID:', id);
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    db.query(
      `UPDATE categories SET 
        nom = ?, 
        description = ?, 
        icone = ?, 
        couleur = ?,
        ordre = ?
       WHERE id = ?`,
      [nom, description, icone, couleur, ordre, id],
      (err) => {
        if (err) {
          console.error('❌ Erreur SQL mise à jour catégorie:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ Catégorie mise à jour');
        res.json({ message: 'Catégorie mise à jour avec succès' });
      }
    );
  });
});

app.delete('/api/categories/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression catégorie ID:', id);

  db.query('SELECT * FROM categories WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification catégorie:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Catégorie non trouvée ID:', id);
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }

    db.query('DELETE FROM categories WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression catégorie:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Catégorie supprimée:', results[0].nom);
      res.json({
        message: 'Catégorie supprimée avec succès',
        categorie: results[0]
      });
    });
  });
});

// ===== ROUTES COMPLÈTES POUR TÉMOIGNAGES =====
app.get('/api/temoignages/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération témoignage ID:', id);

  const query = `
    SELECT t.*, p.titre as projet_titre
    FROM temoignages t
    LEFT JOIN actions p ON t.projet_id = p.id
    WHERE t.id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération témoignage:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Témoignage non trouvé ID:', id);
      return res.status(404).json({ error: 'Témoignage non trouvé' });
    }

    console.log('✅ Témoignage trouvé:', results[0].nom);
    res.json(results[0]);
  });
});

app.put('/api/temoignages/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour témoignage ID:', id);

  const { nom, fonction, pays, contenu, note, projet_id, photo_url, approuve } = req.body;

  if (!nom || !contenu) {
    console.log('❌ Champs manquants pour mise à jour témoignage');
    return res.status(400).json({ error: 'Nom et contenu requis' });
  }

  db.query('SELECT * FROM temoignages WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification témoignage:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Témoignage non trouvé ID:', id);
      return res.status(404).json({ error: 'Témoignage non trouvé' });
    }

    db.query(
      `UPDATE temoignages SET 
        nom = ?, 
        fonction = ?, 
        pays = ?, 
        contenu = ?, 
        note = ?, 
        projet_id = ?,
        photo_url = ?,
        approuve = ?
       WHERE id = ?`,
      [nom, fonction, pays, contenu, note, projet_id, photo_url, approuve || false, id],
      (err) => {
        if (err) {
          console.error('❌ Erreur SQL mise à jour témoignage:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ Témoignage mis à jour');
        res.json({ message: 'Témoignage mis à jour avec succès' });
      }
    );
  });
});

app.delete('/api/temoignages/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression témoignage ID:', id);

  db.query('SELECT * FROM temoignages WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification témoignage:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Témoignage non trouvé ID:', id);
      return res.status(404).json({ error: 'Témoignage non trouvé' });
    }

    db.query('DELETE FROM temoignages WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression témoignage:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Témoignage supprimé:', results[0].nom);
      res.json({
        message: 'Témoignage supprimé avec succès',
        temoignage: results[0]
      });
    });
  });
});

// ===== ROUTES COMPLÈTES POUR FAQ =====
app.get('/api/faq/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération FAQ ID:', id);

  db.query('SELECT * FROM faq WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération FAQ:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ FAQ non trouvée ID:', id);
      return res.status(404).json({ error: 'FAQ non trouvée' });
    }

    console.log('✅ FAQ trouvée:', results[0].question.substring(0, 50));
    res.json(results[0]);
  });
});

app.put('/api/faq/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour FAQ ID:', id);

  const { question, reponse, categorie, ordre, actif } = req.body;

  if (!question || !reponse) {
    console.log('❌ Champs manquants pour mise à jour FAQ');
    return res.status(400).json({ error: 'Question et réponse requises' });
  }

  db.query('SELECT * FROM faq WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification FAQ:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ FAQ non trouvée ID:', id);
      return res.status(404).json({ error: 'FAQ non trouvée' });
    }

    db.query(
      `UPDATE faq SET 
        question = ?, 
        reponse = ?, 
        categorie = ?, 
        ordre = ?,
        actif = ?
       WHERE id = ?`,
      [question, reponse, categorie, ordre, actif, id],
      (err) => {
        if (err) {
          console.error('❌ Erreur SQL mise à jour FAQ:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ FAQ mise à jour');
        res.json({ message: 'FAQ mise à jour avec succès' });
      }
    );
  });
});

app.delete('/api/faq/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression FAQ ID:', id);

  db.query('SELECT * FROM faq WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification FAQ:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ FAQ non trouvée ID:', id);
      return res.status(404).json({ error: 'FAQ non trouvée' });
    }

    db.query('DELETE FROM faq WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression FAQ:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ FAQ supprimée:', results[0].question.substring(0, 50));
      res.json({
        message: 'FAQ supprimée avec succès',
        faq: results[0]
      });
    });
  });
});

// ===== ROUTES COMPLÈTES POUR ÉVÉNEMENTS =====
app.get('/api/evenements/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération événement ID:', id);

  const query = `
    SELECT e.*, p.titre as projet_titre
    FROM evenements e
    LEFT JOIN actions p ON e.projet_id = p.id
    WHERE e.id = ?
  `;

  db.query(query, [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération événement:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Événement non trouvé ID:', id);
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    console.log('✅ Événement trouvé:', results[0].titre);
    res.json(results[0]);
  });
});

app.put('/api/evenements/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour événement ID:', id);

  const { titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images } = req.body;

  if (!titre) {
    console.log('❌ Titre manquant pour mise à jour événement');
    return res.status(400).json({ error: 'Titre requis' });
  }

  db.query('SELECT * FROM evenements WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification événement:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Événement non trouvé ID:', id);
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    db.query(
      `UPDATE evenements SET 
        titre = ?, 
        description = ?, 
        type = ?, 
        date_debut = ?, 
        date_fin = ?, 
        lieu = ?, 
        statut = ?,
        projet_id = ?,
        images = ?
       WHERE id = ?`,
      [titre, description, type, date_debut, date_fin, lieu, statut, projet_id, images, id],
      (err) => {
        if (err) {
          console.error('❌ Erreur SQL mise à jour événement:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ Événement mis à jour');
        res.json({ message: 'Événement mis à jour avec succès' });
      }
    );
  });
});

app.delete('/api/evenements/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression événement ID:', id);

  db.query('SELECT * FROM evenements WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification événement:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Événement non trouvé ID:', id);
      return res.status(404).json({ error: 'Événement non trouvé' });
    }

    db.query('DELETE FROM evenements WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression événement:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Événement supprimé:', results[0].titre);
      res.json({
        message: 'Événement supprimé avec succès',
        evenement: results[0]
      });
    });
  });
});

// ===== ROUTES COMPLÈTES POUR STATISTIQUES =====
app.delete('/api/statistiques/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression statistique ID:', id);

  db.query('SELECT * FROM statistiques WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification statistique:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Statistique non trouvée ID:', id);
      return res.status(404).json({ error: 'Statistique non trouvée' });
    }

    db.query('DELETE FROM statistiques WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression statistique:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Statistique supprimée:', results[0].label || results[0].valeur);
      res.json({
        message: 'Statistique supprimée avec succès',
        statistique: results[0]
      });
    });
  });
});

// ===== ROUTES COMPLÈTES POUR MÉDIAS =====
app.get('/api/medias/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération média ID:', id);

  db.query('SELECT * FROM medias WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération média:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Média non trouvé ID:', id);
      return res.status(404).json({ error: 'Média non trouvé' });
    }

    console.log('✅ Média trouvé:', results[0].titre || results[0].url);
    res.json(results[0]);
  });
});

app.put('/api/medias/:id', authentifierToken, (req, res) => {
  const id = req.params.id;
  console.log('✏️ Mise à jour média ID:', id);

  const { titre, description, type, url, projet_id, article_id, is_featured, ordre } = req.body;

  if (!url) {
    console.log('❌ URL manquante pour mise à jour média');
    return res.status(400).json({ error: 'URL requise' });
  }

  db.query('SELECT * FROM medias WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL vérification média:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Média non trouvé ID:', id);
      return res.status(404).json({ error: 'Média non trouvé' });
    }

    db.query(
      `UPDATE medias SET 
        titre = ?, 
        description = ?, 
        type = ?, 
        url = ?, 
        projet_id = ?, 
        article_id = ?,
        is_featured = ?,
        ordre = ?
       WHERE id = ?`,
      [titre, description, type, url, projet_id, article_id, is_featured, ordre, id],
      (err) => {
        if (err) {
          console.error('❌ Erreur SQL mise à jour média:', err.message);
          return res.status(500).json({ error: err.message });
        }

        console.log('✅ Média mis à jour');
        res.json({ message: 'Média mis à jour avec succès' });
      }
    );
  });
});

// ===== ROUTES POUR PARAMÈTRES SITE =====
app.get('/api/settings', authentifierToken, (req, res) => {
  console.log('⚙️ Récupération paramètres site');

  // Vérifier si la table existe
  db.query("SHOW TABLES LIKE 'settings_site'", (err, results) => {
    if (err) {
      console.error('❌ Erreur vérification table paramètres:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('ℹ️ Table paramètres non trouvée, retour valeurs par défaut');
      return res.json([]);
    }

    db.query('SELECT * FROM settings_site ORDER BY cle', (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL récupération paramètres:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Paramètres envoyés:', results.length);
      res.json(results);
    });
  });
});

app.post('/api/settings', authentifierToken, (req, res) => {
  console.log('⚙️ Création paramètre site');

  const { cle, valeur, type, description } = req.body;

  if (!cle) {
    console.log('❌ Clé manquante pour paramètre');
    return res.status(400).json({ error: 'Clé requise' });
  }

  // Créer la table si elle n'existe pas
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS settings_site (
      id INT PRIMARY KEY AUTO_INCREMENT,
      cle VARCHAR(100) UNIQUE NOT NULL,
      valeur TEXT,
      type ENUM('texte', 'nombre', 'booleen', 'json') DEFAULT 'texte',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  db.query(createTableSQL, (err) => {
    if (err) {
      console.error('❌ Erreur création table paramètres:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const sql = `
      INSERT INTO settings_site (cle, valeur, type, description) 
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        valeur = VALUES(valeur),
        type = VALUES(type),
        description = VALUES(description)
    `;

    db.query(sql, [cle, valeur, type || 'texte', description], (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL création paramètre:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Paramètre créé/mis à jour');
      res.json({
        id: result.insertId,
        message: 'Paramètre enregistré avec succès'
      });
    });
  });
});

// ===== ROUTES POUR VISITEURS (Statistiques de visites) =====
app.get('/api/visiteurs', authentifierToken, (req, res) => {
  console.log('📊 Récupération statistiques visiteurs');

  const { start_date, end_date, group_by = 'day' } = req.query;

  let query = 'SELECT * FROM visiteurs';
  const params = [];

  if (start_date && end_date) {
    query += ' WHERE date_visite BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }

  query += ' ORDER BY date_visite DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération visiteurs:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Statistiques visiteurs envoyées:', results.length);
    res.json(results);
  });
});

// Route pour mise à jour en temps réel (simulation)
app.post('/api/visiteurs/enregistrer', (req, res) => {
  const { nombre = 1 } = req.body;
  const dateVisite = new Date().toISOString().split('T')[0];

  const sql = `
    INSERT INTO visiteurs (date_visite, nombre) 
    VALUES (?, ?) 
    ON DUPLICATE KEY UPDATE 
      nombre = nombre + VALUES(nombre)
  `;

  db.query(sql, [dateVisite, nombre], (err) => {
    if (err) {
      console.error('❌ Erreur SQL enregistrement visiteur:', err.message);
      return res.status(500).json({ error: err.message });
    }

    res.json({ success: true, message: 'Visite enregistrée' });
  });
});

// ===== ROUTES POUR BATCH OPERATIONS =====
app.post('/api/batch/delete', authentifierToken, (req, res) => {
  const { ids, type } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    console.log('❌ IDs manquants pour suppression batch');
    return res.status(400).json({ error: 'Liste d\'IDs requise' });
  }

  if (!type) {
    console.log('❌ Type manquant pour suppression batch');
    return res.status(400).json({ error: 'Type de contenu requis' });
  }

  const tableMap = {
    'actions': 'actions',
    'articles': 'articles',
    'categories': 'categories',
    'temoignages': 'temoignages',
    'faq': 'faq',
    'evenements': 'evenements',
    'medias': 'medias',
    'statistiques': 'statistiques'
  };

  const tableName = tableMap[type];

  if (!tableName) {
    console.log('❌ Type non supporté pour suppression batch:', type);
    return res.status(400).json({ error: 'Type non supporté' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const query = `DELETE FROM ${tableName} WHERE id IN (${placeholders})`;

  db.query(query, ids, (err, result) => {
    if (err) {
      console.error(`❌ Erreur SQL suppression batch ${type}:`, err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ Suppression batch ${type}: ${result.affectedRows} éléments supprimés`);
    res.json({
      success: true,
      message: `${result.affectedRows} élément(s) supprimé(s)`,
      count: result.affectedRows
    });
  });
});

// ===== ROUTE POUR RÉINITIALISATION =====
app.post('/api/content/reset', authentifierToken, (req, res) => {
  console.log('🔄 Réinitialisation du contenu');

  // Cette route est pour réinitialiser les données de test seulement
  // Dans un environnement de production, il faudrait sécuriser davantage

  const { tables } = req.body;
  const allowedTables = ['faq', 'temoignages', 'statistiques', 'evenements'];

  if (!tables || !Array.isArray(tables)) {
    console.log('❌ Tables non spécifiées pour réinitialisation');
    return res.status(400).json({ error: 'Liste de tables requise' });
  }

  tables.forEach(table => {
    if (allowedTables.includes(table)) {
      db.query(`DELETE FROM ${table}`, (err) => {
        if (err) {
          console.error(`❌ Erreur réinitialisation table ${table}:`, err.message);
        } else {
          console.log(`✅ Table ${table} réinitialisée`);
        }
      });
    }
  });

  res.json({
    success: true,
    message: 'Réinitialisation en cours',
    tables_processed: tables.filter(t => allowedTables.includes(t))
  });
});

// ===== ROUTE POUR EXPORT =====
app.get('/api/content/export/:type', authentifierToken, (req, res) => {
  const { type } = req.params;

  const tableMap = {
    'actions': 'actions',
    'articles': 'articles',
    'categories': 'categories',
    'temoignages': 'temoignages',
    'faq': 'faq',
    'evenements': 'evenements',
    'statistiques': 'statistiques'
  };

  const tableName = tableMap[type];

  if (!tableName) {
    console.log('❌ Type non supporté pour export:', type);
    return res.status(400).json({ error: 'Type non supporté pour export' });
  }

  db.query(`SELECT * FROM ${tableName}`, (err, results) => {
    if (err) {
      console.error(`❌ Erreur SQL export ${type}:`, err.message);
      return res.status(500).json({ error: err.message });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `export-${type}-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.json(results);
  });
});

// ==================== ROUTES POUR LE FRONTEND ====================

// GET - Récupérer les actions pour la page d'accueil
app.get('/api/frontend/actions', (req, res) => {
  console.log('🌐 Frontend - Récupération des actions');

  db.query(`
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
  `, (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération actions frontend:', err.message);
      return res.status(500).json({ error: err.message });
    }
  

    // Convertir les photos JSON si nécessaire - Version sécurisée
    const actions = results.map(action => {
      let photos = [];

      if (action.photos) {
        try {
          // Essayer de parser comme JSON
          const parsed = JSON.parse(action.photos);
          // Si c'est un tableau, l'utiliser
          if (Array.isArray(parsed)) {
            photos = parsed;
          }
          // Si c'est une chaîne, la mettre dans un tableau
          else if (typeof parsed === 'string') {
            photos = [parsed];
          }
        } catch (error) {
          // Si ce n'est pas du JSON valide, vérifier si c'est une URL
          if (typeof action.photos === 'string' &&
            (action.photos.includes('.jpg') ||
              action.photos.includes('.png') ||
              action.photos.includes('.webp'))) {
            photos = [action.photos];
          }
        }
      }

      return {
        id: action.id,
        titre: action.titre,
        description: action.description,
        type: action.type,
        date_debut: action.date_debut,
        date_fin: action.date_fin,
        statut: action.statut,
        photos: photos,
        pays: action.pays,
        localisation: action.localisation,
        is_featured: action.is_featured,
        ordre: action.ordre
      };
    });

    console.log(`✅ ${actions.length} action(s) envoyées au frontend`);
    res.json(actions);
  });
});

// GET - Récupérer les FAQ
app.get('/api/frontend/faq', (req, res) => {
  console.log('🌐 Frontend - Récupération des FAQ');

  db.query(`
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
  `, (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération FAQ:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ ${results.length} FAQ envoyées au frontend`);
    res.json(results);
  });
});



// ==================== ROUTES POUR CAUSES (MISSIONS) ====================
// Route pour créer la table des causes si elle n'existe pas
const createCausesTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS causes (
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
    )
  `;

  db.query(sql, (err) => {
    if (err) {
      console.error('❌ Erreur création table causes:', err.message);
    } else {
      console.log('✅ Table causes créée/vérifiée');
    }
  });
};

// Appeler la création de la table au démarrage
createCausesTable();

// GET toutes les causes (admin)
app.get('/api/admin/causes',(req, res) => {
  console.log('📋 Récupération liste causes (admin)');
  console.log(req.body);
  

  db.query('SELECT * FROM causes ORDER BY ordre ASC, created_at DESC', (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL causes:', err.message);
      return res.status(500).json({ error: err.message });
    }

    // Convertir les chemins d'images en URLs complètes
    const causesWithFullUrls = results.map(cause => ({
      ...cause,
      icone: cause.icone ? `http://192.168.179.20:5005${cause.icone}` : null
    }));

    console.log(`✅ Causes envoyées (admin): ${results.length} cause(s)`);
    res.json(causesWithFullUrls);
  });
});

// GET une cause par ID
app.get('/api/admin/causes/:id',(req, res) => {
  const id = req.params.id;
  console.log('🔍 Récupération cause ID:', id);

  db.query('SELECT * FROM causes WHERE id = ?', [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération cause:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Cause non trouvée ID:', id);
      return res.status(404).json({ error: 'Cause non trouvée' });
    }

    const cause = results[0];
    if (cause.icone) {
      cause.icone = `http://192.168.179.20:5005${cause.icone}`;
    }

    console.log('✅ Cause trouvée:', cause.nom);
    res.json(cause);
  });
});

// POST créer une nouvelle cause
app.post('/api/admin/causes',upload.single('icone'), async (req, res) => {
  console.log('➕ Création nouvelle cause');

  const { nom, description, nb_projets, nb_projets_termines, statut, ordre } = req.body;

  try {
    if (!nom || !description) {
      console.log('❌ Champs manquants pour création cause');
      return res.status(400).json({ error: 'Nom et description requis' });
    }

    let iconePath = null;
    if (req.file) {
      iconePath = `/uploads/${req.file.filename}`;
    }

    const sql = `
      INSERT INTO causes (nom, description, icone, nb_projets, nb_projets_termines, statut, ordre) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      nom,
      description,
      iconePath,
      nb_projets || 0,
      nb_projets_termines || 0,
      statut || 'actif',
      ordre || 0
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL création cause:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Cause créée, ID:', result.insertId);
      res.json({
        id: result.insertId,
        message: 'Cause créée avec succès',
        cause: { id: result.insertId, nom, description, icone: iconePath }
      });
    });
  } catch (error) {
    console.error('❌ Erreur création cause:', error);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT mettre à jour une cause
// PUT mettre à jour une cause
app.put('/api/admin/causes/:id',upload.single('icone'), async (req, res) => {
  console.log(req.body);
  
  const id = req.params.id;
  console.log('✏️ Mise à jour cause ID:', id);

  try {
    // Vérifier si la cause existe
    const existingCause = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM causes WHERE id = ?', [id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (existingCause.length === 0) {
      console.log('❌ Cause non trouvée ID:', id);
      return res.status(404).json({ error: 'Cause non trouvée' });
    }

    const { nom, description, nb_projets, nb_projets_termines, statut, ordre } = req.body;
    const currentCause = existingCause[0]; // Prendre le premier résultat

    let iconePath = currentCause.icone;

    // Si une nouvelle image est uploadée
    if (req.file) {
      // Supprimer l'ancienne image si elle existe
      if (currentCause.icone && fs.existsSync(path.join(__dirname, '..', currentCause.icone))) {
        fs.unlinkSync(path.join(__dirname, '..', currentCause.icone));
      }
      iconePath = `/uploads/${req.file.filename}`;
    }

    const sql = `
      UPDATE causes 
      SET nom = ?, description = ?, icone = ?, nb_projets = ?, 
          nb_projets_termines = ?, statut = ?, ordre = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const params = [
      nom || currentCause.nom,
      description || currentCause.description,
      iconePath,
      nb_projets !== undefined ? nb_projets : currentCause.nb_projets,
      nb_projets_termines !== undefined ? nb_projets_termines : currentCause.nb_projets_termines,
      statut || currentCause.statut,
      ordre !== undefined ? ordre : currentCause.ordre,
      id
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL mise à jour cause:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Cause mise à jour');
      res.json({
        message: 'Cause mise à jour avec succès',
        cause: {
          id: parseInt(id),
          nom: params[0],
          description: params[1],
          icone: iconePath
        }
      });
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour cause:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// PUT pour modifier l'ordre
// PUT pour modifier l'ordre
app.put('/api/admin/causes/:id/order',async (req, res) => {
  const id = req.params.id;
  const { direction } = req.body; // 'up' ou 'down'

  try {
    // Récupérer la cause actuelle
    const currentCause = await new Promise((resolve, reject) => {
      db.query('SELECT id, ordre FROM causes WHERE id = ?', [id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (currentCause.length === 0) {
      return res.status(404).json({ error: 'Cause non trouvée' });
    }

    const currentOrder = currentCause[0].ordre;

    // Trouver la cause à échanger
    const swapCause = await new Promise((resolve, reject) => {
      const sql = `
        SELECT id, ordre FROM causes 
        WHERE ordre ${direction === 'up' ? '<' : '>'} ?
        ORDER BY ordre ${direction === 'up' ? 'DESC' : 'ASC'}
        LIMIT 1
      `;
      db.query(sql, [currentOrder], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (swapCause.length > 0) {
      const swapId = swapCause[0].id;
      const swapOrder = swapCause[0].ordre;

      // Échanger les ordres
      await new Promise((resolve, reject) => {
        db.query('UPDATE causes SET ordre = ? WHERE id = ?', [swapOrder, id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.query('UPDATE causes SET ordre = ? WHERE id = ?', [currentOrder, swapId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    res.json({ message: 'Ordre mis à jour' });
  } catch (error) {
    console.error('❌ Erreur mise à jour ordre:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'ordre' });
  }
});

// DELETE supprimer une cause
// DELETE supprimer une cause
app.delete('/api/admin/causes/:id',async (req, res) => {
  const id = req.params.id;
  console.log('🗑️ Suppression cause ID:', id);

  try {
    // Vérifier si la cause existe
    const existingCause = await new Promise((resolve, reject) => {
      db.query('SELECT * FROM causes WHERE id = ?', [id], (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    if (existingCause.length === 0) {
      console.log('❌ Cause non trouvée ID:', id);
      return res.status(404).json({ error: 'Cause non trouvée' });
    }

    const cause = existingCause[0]; // Prendre le premier résultat

    // Supprimer l'image associée si elle existe
    if (cause.icone && fs.existsSync(path.join(__dirname, '..', cause.icone))) {
      fs.unlinkSync(path.join(__dirname, '..', cause.icone));
    }

    // Supprimer de la base de données
    db.query('DELETE FROM causes WHERE id = ?', [id], (err) => {
      if (err) {
        console.error('❌ Erreur SQL suppression cause:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log('✅ Cause supprimée:', cause.nom);
      res.json({
        message: 'Cause supprimée avec succès',
        id: parseInt(id)
      });
    });
  } catch (error) {
    console.error('❌ Erreur suppression cause:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});


// GET causes pour le frontend (public - non authentifié)
app.get('/api/frontend/causes', (req, res) => {
  console.log('🌐 Frontend - Récupération des causes');

  const { limit = 5 } = req.query;

  db.query(`
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
  `, [parseInt(limit)], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération causes frontend:', err.message);
      return res.status(500).json({ error: err.message });
    }

    // Convertir les chemins d'images en URLs complètes
    const causesWithUrls = results.map(cause => ({
      ...cause,
      icone: cause.icone ? `http://192.168.179.20:${PORT}${cause.icone}` : null
    }));

    console.log(`✅ ${results.length} cause(s) envoyées au frontend`);
    res.json(causesWithUrls);
  });
});

// GET une cause spécifique pour le frontend (public - non authentifié)
app.get('/api/frontend/causes/:id', (req, res) => {
  const id = req.params.id;
  console.log('🌐 Frontend - Récupération cause ID:', id);

  db.query(`
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
    WHERE id = ? AND statut = 'actif'
  `, [id], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération cause frontend:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log('❌ Cause non trouvée ou inactive ID:', id);
      return res.status(404).json({ error: 'Cause non trouvée' });
    }

    const cause = results[0];
    if (cause.icone) {
      cause.icone = `http://192.168.179.20:${PORT}${cause.icone}`;
    }

    console.log('✅ Cause trouvée pour frontend:', cause.nom);
    res.json(cause);
  });
});

app.get('/api/frontend/settings', (req, res) => {
  console.log('🌐 Frontend - Récupération des paramètres');

  db.query("SHOW TABLES LIKE 'settings_site'", (err, tableResults) => {
    if (err) {
      console.error('❌ Erreur vérification table settings_site:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (tableResults.length === 0) {
      console.log('ℹ️ Table settings_site non trouvée, retour valeurs par défaut');
      return res.json({
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
        hero_backgrounds: [
        ]
      });
    }

    // Récupérer tous les paramètres
    db.query('SELECT cle, valeur FROM settings_site', (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL récupération paramètres:', err.message);
        return res.status(500).json({ error: err.message });
      }

      // Transformer en objet
      const settings = {};
      const heroBackgrounds = [];

      results.forEach(row => {
        if (row.cle.startsWith('hero_background_')) {
          heroBackgrounds.push(row.valeur);
        } else {
          settings[row.cle] = row.valeur;
        }
      });

      // Ajouter les backgrounds triés
      settings.hero_backgrounds = heroBackgrounds.sort();

      // Définir les valeurs par défaut si manquantes
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
        youtube_url: ''
      };

      // Remplir les valeurs manquantes
      Object.keys(defaultSettings).forEach(key => {
        if (!settings[key]) {
          settings[key] = defaultSettings[key];
        }
      });

      console.log('✅ Paramètres envoyés au frontend avec', heroBackgrounds.length, 'backgrounds');
      res.json(settings);
    });
  });
});


// GET - Récupérer tous les paramètres (admin)
app.get('/api/settings', authentifierToken, (req, res) => {
  console.log('⚙️ Récupération de tous les paramètres (admin)');

  db.query('SELECT * FROM settings_site ORDER BY categorie, cle', (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération paramètres:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ ${results.length} paramètre(s) récupérés`);
    res.json(results);
  });
});

// GET - Récupérer un paramètre spécifique
app.get('/api/settings/:key', (req, res) => {
  const key = req.params.key;
  console.log(`⚙️ Récupération paramètre: ${key}`);

  db.query('SELECT * FROM settings_site WHERE cle = ?', [key], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération paramètre:', err.message);
      return res.status(500).json({ error: err.message });
    }

    if (results.length === 0) {
      console.log(`ℹ️ Paramètre ${key} non trouvé`);
      return res.status(404).json({ error: 'Paramètre non trouvé' });
    }

    console.log(`✅ Paramètre ${key} récupéré`);
    res.json(results[0]);
  });
});

// Route pour corriger la table settings
app.get('/api/fix/settings-table', (req, res) => {
  console.log('🛠️ Correction de la table settings...');
  
  // 1. Supprimer la colonne type
  db.query("ALTER TABLE settings_site DROP COLUMN type", (err1) => {
    if (err1) {
      console.log('ℹ️ Impossible de supprimer la colonne type:', err1.message);
    }
    
    // 2. Recréer la colonne avec plus de valeurs
    const sql = `
      ALTER TABLE settings_site 
      ADD COLUMN type ENUM(
        'texte', 'nombre', 'booleen', 'json', 'url', 'image', 
        'url_image', 'url_externe', 'lien', 'email', 'telephone'
      ) DEFAULT 'texte'
    `;
    
    db.query(sql, (err2) => {
      if (err2) {
        console.error('❌ Erreur recréation colonne type:', err2.message);
        
        // 3. Alternative : utiliser VARCHAR
        db.query("ALTER TABLE settings_site ADD COLUMN type VARCHAR(50) DEFAULT 'texte'", (err3) => {
          if (err3) {
            console.error('❌ Erreur création VARCHAR:', err3.message);
            return res.status(500).json({ error: 'Impossible de corriger la table' });
          }
          
          console.log('✅ Colonne type convertie en VARCHAR');
          res.json({ success: true, message: 'Table corrigée (type en VARCHAR)' });
        });
      } else {
        console.log('✅ Colonne type recréée avec plus de valeurs');
        res.json({ success: true, message: 'Table corrigée' });
      }
    });
  });
});

// POST - Créer ou mettre à jour un paramètre
// POST - Créer ou mettre à jour un paramètre (VERSION CORRIGÉE)
app.post('/api/settings', authentifierToken, (req, res) => {
  const { cle, valeur, type, categorie, description } = req.body;

  if (!cle) {
    console.log('❌ Clé manquante pour paramètre');
    return res.status(400).json({ error: 'Clé requise' });
  }

  console.log(`⚙️ Sauvegarde paramètre: ${cle}`, { valeur, type, categorie, description });

  // Valider et normaliser le type
  const validTypes = ['texte', 'nombre', 'booleen', 'json', 'url', 'image'];
  let normalizedType = (type || 'texte').toLowerCase().trim();
  
  // Si le type n'est pas dans la liste, utiliser 'texte' par défaut
  if (!validTypes.includes(normalizedType)) {
    console.log(`⚠️ Type "${type}" non valide, utilisation de "texte" par défaut`);
    normalizedType = 'texte';
  }

  const sql = `
    INSERT INTO settings_site (cle, valeur, type, categorie, description) 
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      valeur = VALUES(valeur),
      type = VALUES(type),
      categorie = VALUES(categorie),
      description = VALUES(description),
      updated_at = CURRENT_TIMESTAMP
  `;

  db.query(sql, [cle, valeur, normalizedType, categorie || null, description || null], (err, result) => {
    if (err) {
      console.error('❌ Erreur SQL sauvegarde paramètre:', err.message);
      console.error('SQL:', sql);
      console.error('Params:', [cle, valeur, normalizedType, categorie, description]);
      return res.status(500).json({ 
        error: 'Erreur lors de la sauvegarde',
        details: err.message,
        sqlError: true
      });
    }

    console.log(`✅ Paramètre ${cle} sauvegardé (type: ${normalizedType})`);
    res.json({
      success: true,
      message: 'Paramètre sauvegardé',
      cle: cle,
      valeur: valeur,
      type: normalizedType
    });
  });
});

// ==================== ROUTES POUR LE BANNER ====================

// GET - Récupérer tous les slides du banner (pour l'admin)
app.get('/api/admin/banner-slides', authentifierToken, (req, res) => {
  console.log('📋 Récupération des slides du banner (admin)');

  db.query(
    `SELECT * FROM settings_site 
     WHERE groupe = 'banner' 
     ORDER BY ordre ASC, cle ASC`,
    (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL récupération slides:', err.message);
        return res.status(500).json({ error: err.message });
      }

      // Organiser les résultats par slide
      const slides = [];
      const slideMap = {};

      results.forEach(row => {
        const match = row.cle.match(/banner_slide_(\d+)_(image|text)/);
        if (match) {
          const slideIndex = parseInt(match[1]) - 1;
          const type = match[2];

          if (!slideMap[slideIndex]) {
            slideMap[slideIndex] = {
              id: slideIndex,
              index: slideIndex,
              ordre: row.ordre || slideIndex
            };
          }

          if (type === 'image') {
            slideMap[slideIndex].image = row.valeur;
            slideMap[slideIndex].image_id = row.id;
          } else if (type === 'text') {
            slideMap[slideIndex].text = row.valeur;
            slideMap[slideIndex].text_id = row.id;
          }
        }
      });

      // Convertir en tableau et trier par ordre
      Object.keys(slideMap).forEach(key => {
        slides.push(slideMap[key]);
      });

      slides.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

      console.log(`✅ ${slides.length} slide(s) récupéré(s)`);
      res.json(slides);
    }
  );
});

// POST - Mettre à jour un slide
app.post('/api/admin/banner-slide/:index', authentifierToken, (req, res) => {
  const index = parseInt(req.params.index);
  const { text, image } = req.body;

  console.log(`✏️ Mise à jour slide ${index}:`, { text, image });

  // Mettre à jour le texte
  const updateText = new Promise((resolve, reject) => {
    if (text !== undefined) {
      db.query(
        `INSERT INTO settings_site (cle, valeur, type, groupe, ordre, description) 
         VALUES (?, ?, 'texte', 'banner', ?, 'Texte du slide')
         ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
        [`banner_slide_${index + 1}_text`, text, index],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    } else {
      resolve();
    }
  });

  // Mettre à jour l'image
  const updateImage = new Promise((resolve, reject) => {
    if (image !== undefined) {
      db.query(
        `INSERT INTO settings_site (cle, valeur, type, groupe, ordre, description) 
         VALUES (?, ?, 'image', 'banner', ?, 'Image du slide')
         ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
        [`banner_slide_${index + 1}_image`, image, index],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    } else {
      resolve();
    }
  });

  Promise.all([updateText, updateImage])
    .then(() => {
      console.log(`✅ Slide ${index} mis à jour`);
      res.json({
        success: true,
        message: 'Slide mis à jour avec succès'
      });
    })
    .catch(err => {
      console.error('❌ Erreur mise à jour slide:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// POST - Ajouter un nouveau slide
app.post('/api/admin/banner-slide', authentifierToken, (req, res) => {
  const { text, image } = req.body;

  console.log('➕ Ajout nouveau slide');

  // Trouver le prochain index disponible
  db.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(cle, '_', -2), '_', 1) AS UNSIGNED)) as max_index 
     FROM settings_site WHERE groupe = 'banner'`,
    (err, results) => {
      if (err) {
        console.error('❌ Erreur recherche index:', err.message);
        return res.status(500).json({ error: err.message });
      }

      const nextIndex = (results[0]?.max_index || 0) + 1;
      console.log('📊 Prochain index:', nextIndex);

      // Insérer le texte
      db.query(
        `INSERT INTO settings_site (cle, valeur, type, groupe, ordre, description) 
         VALUES (?, ?, 'texte', 'banner', ?, 'Texte du slide')`,
        [`banner_slide_${nextIndex}_text`, text || 'Nouveau slide', nextIndex - 1],
        (err) => {
          if (err) {
            console.error('❌ Erreur insertion texte:', err.message);
            return res.status(500).json({ error: err.message });
          }

          // Insérer l'image
          db.query(
            `INSERT INTO settings_site (cle, valeur, type, groupe, ordre, description) 
             VALUES (?, ?, 'image', 'banner', ?, 'Image du slide')`,
            [`banner_slide_${nextIndex}_image`, image || '', nextIndex - 1],
            (err) => {
              if (err) {
                console.error('❌ Erreur insertion image:', err.message);
                return res.status(500).json({ error: err.message });
              }

              console.log(`✅ Nouveau slide créé avec index ${nextIndex}`);
              res.json({
                success: true,
                message: 'Slide créé avec succès',
                index: nextIndex - 1,
                slide: {
                  index: nextIndex - 1,
                  text: text || 'Nouveau slide',
                  image: image || ''
                }
              });
            }
          );
        }
      );
    }
  );
});

// DELETE - Supprimer un slide
app.delete('/api/admin/banner-slide/:index', authentifierToken, (req, res) => {
  const index = parseInt(req.params.index);

  console.log(`🗑️ Suppression slide ${index}`);

  db.query(
    `DELETE FROM settings_site 
     WHERE cle IN (?, ?)`,
    [`banner_slide_${index + 1}_text`, `banner_slide_${index + 1}_image`],
    (err, result) => {
      if (err) {
        console.error('❌ Erreur suppression slide:', err.message);
        return res.status(500).json({ error: err.message });
      }

      console.log(`✅ Slide ${index} supprimé`);
      res.json({
        success: true,
        message: 'Slide supprimé avec succès'
      });
    }
  );
});

// PUT - Réorganiser les slides
app.put('/api/admin/banner-slides/reorder', authentifierToken, (req, res) => {
  const { slides } = req.body;

  console.log('🔄 Réorganisation des slides');

  if (!Array.isArray(slides)) {
    return res.status(400).json({ error: 'Liste de slides invalide' });
  }

  const updates = slides.map((slide, newIndex) => {
    return new Promise((resolve, reject) => {
      db.query(
        `UPDATE settings_site SET ordre = ? 
         WHERE cle IN (?, ?)`,
        [
          newIndex,
          `banner_slide_${slide.originalIndex + 1}_text`,
          `banner_slide_${slide.originalIndex + 1}_image`
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });

  Promise.all(updates)
    .then(() => {
      console.log('✅ Slides réorganisés');
      res.json({
        success: true,
        message: 'Slides réorganisés avec succès'
      });
    })
    .catch(err => {
      console.error('❌ Erreur réorganisation:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// GET - Récupérer les slides pour le frontend
app.get('/api/frontend/banner-slides', (req, res) => {
  console.log('🌐 Frontend - Récupération des slides du banner');

  db.query(
    `SELECT * FROM settings_site 
     WHERE groupe = 'banner' 
     ORDER BY ordre ASC, cle ASC`,
    (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL récupération slides:', err.message);
        return res.status(500).json({ error: err.message });
      }

      // Organiser les résultats par slide
      const slides = [];
      const slideMap = {};

      results.forEach(row => {
        const match = row.cle.match(/banner_slide_(\d+)_(image|text)/);
        if (match) {
          const slideIndex = parseInt(match[1]) - 1;
          const type = match[2];

          if (!slideMap[slideIndex]) {
            slideMap[slideIndex] = {
              id: slideIndex,
              index: slideIndex,
              ordre: row.ordre || slideIndex
            };
          }

          if (type === 'image') {
            slideMap[slideIndex].image = row.valeur;
          } else if (type === 'text') {
            slideMap[slideIndex].text = row.valeur;
          }
        }
      });

      // Convertir en tableau et trier par ordre
      Object.keys(slideMap).forEach(key => {
        if (slideMap[key].image && slideMap[key].text) {
          slides.push({
            id: slideMap[key].id,
            text: slideMap[key].text,
            image: slideMap[key].image,
            alt: `Slide ${slideMap[key].index + 1}`
          });
        }
      });

      slides.sort((a, b) => (a.id || 0) - (b.id || 0));

      console.log(`✅ ${slides.length} slide(s) envoyés au frontend`);
      res.json(slides);
    }
  );
});



// POST - Upload d'image pour hero background
app.post('/api/settings/upload/hero-background', authentifierToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier uploadé' });
    }

    // Créer le dossier uploads/settings s'il n'existe pas
    const uploadDir = 'uploads/settings/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileUrl = `/uploads/settings/${req.file.filename}`;

    console.log('✅ Image hero uploadée:', fileUrl);
    res.json({
      success: true,
      url: fileUrl,
      filename: req.file.filename,
      fullUrl: `http://localhost:${PORT}${fileUrl}`
    });
  } catch (error) {
    console.error('❌ Erreur upload hero background:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// GET - Récupérer les images du hero
app.get('/api/settings/hero-backgrounds', (req, res) => {
  console.log('🖼️ Récupération des backgrounds du hero');

  db.query("SELECT * FROM settings_site WHERE cle LIKE 'hero_background_%' ORDER BY cle", (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération hero backgrounds:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const backgrounds = results.map(row => ({
      id: row.id,
      key: row.cle,
      url: row.valeur,
      description: row.description
    }));

    console.log(`✅ ${backgrounds.length} background(s) récupéré(s)`);
    res.json(backgrounds);
  });
});

// ==================== ROUTES POUR SETTINGS DU FRONTEND ====================



// DELETE - Supprimer un paramètre
app.delete('/api/settings/:key', authentifierToken, (req, res) => {
  const key = req.params.key;
  console.log(`🗑️ Suppression paramètre: ${key}`);

  db.query('DELETE FROM settings_site WHERE cle = ?', [key], (err) => {
    if (err) {
      console.error('❌ Erreur SQL suppression paramètre:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ Paramètre ${key} supprimé`);
    res.json({ success: true, message: 'Paramètre supprimé' });
  });
});

// GET - Récupérer plusieurs paramètres en une requête
app.post('/api/settings/batch', authentifierToken, (req, res) => {
  const { keys } = req.body;

  if (!keys || !Array.isArray(keys)) {
    console.log('❌ Liste de clés manquante');
    return res.status(400).json({ error: 'Liste de clés requise' });
  }

  console.log(`⚙️ Récupération batch paramètres: ${keys.length} clé(s)`);

  if (keys.length === 0) {
    return res.json({});
  }

  const placeholders = keys.map(() => '?').join(',');
  const sql = `SELECT cle, valeur FROM settings_site WHERE cle IN (${placeholders})`;

  db.query(sql, keys, (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL batch paramètres:', err.message);
      return res.status(500).json({ error: err.message });
    }

    const settings = {};
    results.forEach(row => {
      settings[row.cle] = row.valeur;
    });

    console.log(`✅ ${results.length} paramètre(s) récupéré(s)`);
    res.json(settings);
  });
});

// POST - Sauvegarder plusieurs paramètres en une requête
app.post('/api/settings/batch-save', authentifierToken, (req, res) => {
  const settings = req.body;

  if (!settings || typeof settings !== 'object') {
    console.log('❌ Paramètres manquants');
    return res.status(400).json({ error: 'Paramètres requis' });
  }

  console.log(`⚙️ Sauvegarde batch paramètres: ${Object.keys(settings).length} paramètre(s)`);

  const updates = Object.entries(settings).map(([cle, valeur]) => {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO settings_site (cle, valeur) 
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE 
          valeur = VALUES(valeur),
          updated_at = CURRENT_TIMESTAMP
      `;
      
      db.query(sql, [cle, valeur], (err) => {
        if (err) reject(err);
        else resolve({ cle, success: true });
      });
    });
  });

  Promise.all(updates)
    .then(results => {
      console.log(`✅ ${results.length} paramètre(s) sauvegardé(s)`);
      res.json({
        success: true,
        message: `${results.length} paramètre(s) sauvegardé(s)`,
        count: results.length
      });
    })
    .catch(err => {
      console.error('❌ Erreur sauvegarde batch:', err.message);
      res.status(500).json({ error: err.message });
    });
});

// Ajouter cette route pour servir les images des paramètres
app.use('/uploads/settings', express.static('uploads/settings'));

// GET - Récupérer les témoignages approuvés
app.get('/api/frontend/temoignages', (req, res) => {
  console.log('🌐 Frontend - Récupération des témoignages');

  db.query(`
    SELECT 
      id,
      nom,
      fonction,
      pays,
      contenu,
      note,
      projet_id,
      photo_url,
      approuve,
      created_at
    FROM temoignages 
    WHERE approuve = TRUE
    ORDER BY created_at DESC
    LIMIT 10
  `, (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération témoignages:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ ${results.length} témoignages envoyés au frontend`);
    res.json(results);
  });
});

// GET - Récupérer les statistiques d'impact
app.get('/api/frontend/statistiques', (req, res) => {
  console.log('🌐 Frontend - Récupération des statistiques');

  const currentYear = new Date().getFullYear();

  db.query(`
    SELECT 
      type,
      label,
      valeur,
      categorie
    FROM statistiques 
    WHERE annee = ?
    ORDER BY type, id
    LIMIT 10
  `, [currentYear], (err, results) => {
    if (err) {
      console.error('❌ Erreur SQL récupération statistiques:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log(`✅ ${results.length} statistiques envoyées au frontend`);
    res.json(results);
  });
});

// GET - Récupérer les données de transparence
app.get('/api/frontend/transparence', (req, res) => {
  console.log('🌐 Frontend - Récupération des données de transparence');

  // Données statiques pour la transparence (ou les récupérer d'une table)
  const transparenceData = [
    { type: 'utilisation_fonds', label: 'Missions humanitaires', valeur: '92%' },
    { type: 'utilisation_fonds', label: 'Frais de fonctionnement', valeur: '5%' },
    { type: 'utilisation_fonds', label: 'Collecte de fonds', valeur: '3%' }
  ];

  console.log(`✅ Données de transparence envoyées au frontend`);
  res.json(transparenceData);
});

// GET - Test de connexion frontend
app.get('/api/frontend/test', (req, res) => {
  console.log('🌐 Frontend - Test de connexion');
  res.json({
    status: 'ok',
    message: 'API frontend fonctionnelle',
    timestamp: new Date().toISOString()
  });
});

// ==================== ROUTES AMÉLIORÉES POUR UPLOAD ====================

// Route pour upload depuis l'appareil
app.post('/api/media/upload', authentifierToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    const { titre, description, type, projet_id, article_id, is_featured, ordre } = req.body;

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' :
      req.file.mimetype.startsWith('video/') ? 'video' : 'document';

    const sql = `
      INSERT INTO medias 
        (titre, description, type, url, projet_id, article_id, is_featured, ordre, taille)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      titre || req.file.originalname,
      description || '',
      type || fileType,
      fileUrl,
      projet_id || null,
      article_id || null,
      is_featured === 'true' || false,
      ordre || 0,
      `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL enregistrement média:', err.message);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        id: result.insertId,
        media: {
          id: result.insertId,
          titre: params[0],
          url: fileUrl,
          type: params[2],
          size: params[8],
          mimetype: req.file.mimetype,
          originalName: req.file.originalname
        }
      });
    });
  } catch (error) {
    console.error('❌ Erreur upload média:', error);
    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// Route pour upload via URL
app.post('/api/media/url', authentifierToken, async (req, res) => {
  try {
    const { url, titre, description, type, projet_id, article_id, is_featured, ordre } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL requise' });
    }

    // Valider l'URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'URL invalide' });
    }

    // Déterminer le type de fichier depuis l'URL
    let detectedType = type || 'document';
    const extension = url.split('.').pop().toLowerCase();
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const videoExtensions = ['mp4', 'mpeg', 'avi', 'mov', 'wmv', 'flv', 'webm'];

    if (imageExtensions.includes(extension)) {
      detectedType = 'image';
    } else if (videoExtensions.includes(extension)) {
      detectedType = 'video';
    }

    const sql = `
      INSERT INTO medias 
        (titre, description, type, url, projet_id, article_id, is_featured, ordre, taille)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      titre || `Média de ${new Date().toLocaleDateString()}`,
      description || '',
      detectedType,
      url,
      projet_id || null,
      article_id || null,
      is_featured === 'true' || false,
      ordre || 0,
      'URL externe'
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('❌ Erreur SQL enregistrement média URL:', err.message);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        success: true,
        id: result.insertId,
        media: {
          id: result.insertId,
          titre: params[0],
          url: url,
          type: detectedType,
          size: 'URL externe'
        }
      });
    });
  } catch (error) {
    console.error('❌ Erreur enregistrement média URL:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
});

// Route pour récupérer tous les médias avec pagination
app.get('/api/media/all', (req, res) => {
  const { page = 1, limit = 20, type, search } = req.query;
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM medias WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as total FROM medias WHERE 1=1';
  const params = [];
  const countParams = [];

  if (type && type !== 'all') {
    query += ' AND type = ?';
    countQuery += ' AND type = ?';
    params.push(type);
    countParams.push(type);
  }

  if (search) {
    query += ' AND (titre LIKE ? OR description LIKE ?)';
    countQuery += ' AND (titre LIKE ? OR description LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
    countParams.push(searchTerm, searchTerm);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.query(countQuery, countParams, (countErr, countResults) => {
    if (countErr) {
      console.error('❌ Erreur SQL compte médias:', countErr.message);
      return res.status(500).json({ error: countErr.message });
    }

    const total = countResults[0].total;

    db.query(query, params, (err, results) => {
      if (err) {
        console.error('❌ Erreur SQL récupération médias:', err.message);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        items: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      });
    });
  });
});


// Route de debug pour vérifier les paramètres
app.get('/api/debug/settings', (req, res) => {
  console.log('🔍 Debug - Vérification des paramètres');

  db.query("SHOW TABLES LIKE 'settings_site'", (err, tableResults) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (tableResults.length === 0) {
      return res.json({ message: 'Table settings_site non trouvée' });
    }

    db.query('SELECT * FROM settings_site ORDER BY cle', (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Organiser par catégorie
      const grouped = {
        logo: results.filter(r => r.cle.includes('logo')),
        contact: results.filter(r => r.cle.includes('contact')),
        social: results.filter(r => r.cle.includes('_url') && !r.cle.includes('logo')),
        hero: results.filter(r => r.cle.startsWith('hero_background')),
        general: results.filter(r => !r.cle.includes('_url') && !r.cle.includes('hero') && !r.cle.includes('contact'))
      };

      res.json({
        total: results.length,
        grouped,
        all: results
      });
    });
  });
});


// ==================== ROUTES DE TEST ====================
app.get('/api/test', (req, res) => {
  console.log('🧪 Route test appelée');
  res.json({
    message: 'Serveur fonctionnel',
    timestamp: new Date().toISOString(),
    mysql: 'Connecté',
    tables: 'Initialisées'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Association Humanitaire API'
  });
});

// Gestion des erreurs 404
app.use((req, res, next) => {
  console.log('❓ Route non trouvée:', req.method, req.url);
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('💥 ERREUR GLOBALE:', err.message);
  console.error('   Stack:', err.stack);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});


// Ajouter ces routes dans serveur.js avant les routes de test








const PORT = process.env.PORT || 5004;
app.listen(PORT,'0.0.0.0', () => {
  console.log('\n' + '='.repeat(50));
  console.log('✅ SERVEUR DÉMARRÉ AVEC SUCCÈS');
  console.log('='.repeat(50));
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`👤 Admin: admin@association.org / admin123`);
  console.log(`🕐 Heure: ${new Date().toLocaleString()}`);
  console.log('='.repeat(50) + '\n');


  // Tester la connexion à la base de données
  db.query('SELECT 1 + 1 AS test', (err, results) => {
    if (err) {
      console.error('❌ Test connexion MySQL échoué:', err.message);
    } else {
      console.log('✅ Test connexion MySQL réussi:', results[0].test);
    }
  });
});


// Gestion de la fermeture propre
process.on('SIGINT', () => {
  console.log('\n🔴 Arrêt du serveur...');
  db.end();
  console.log('✅ Connexion MySQL fermée');
  process.exit(0);
});
