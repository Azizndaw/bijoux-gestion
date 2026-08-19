const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'store.json');

// Structure par défaut de la base de données
const DEFAULT_SCHEMA = {
  users: [],
  categories: [],
  products: [],
  stock_movements: [],
  purchases: [],
  purchase_items: [],
  sales: [],
  sale_items: [],
  payments: [],
  expenses: [],
  customers: [],
  suppliers: [],
  cash_accounts: [
    { id: 1, name: 'Espèces', balance: 0 },
    { id: 2, name: 'Wave', balance: 0 },
    { id: 3, name: 'Orange Money', balance: 0 },
    { id: 4, name: 'Carte bancaire', balance: 0 },
    { id: 5, name: 'Virement', balance: 0 }
  ],
  cash_movements: [],
  cash_sessions: [],
  audit_logs: [],
  goals: [],
  settings: {
    shop_name: "MaZoneDKR",
    logo_url: "",
    phone: "+221 77 000 00 00",
    email: "contact@bijoux.sn",
    address: "Dakar, Sénégal",
    currency: "FCFA",
    wave_number: "+221 76 000 00 00",
    om_number: "+221 77 000 00 00",
    bank_account: "SN012 01234 123456789012 34",
    receipt_message: "Merci pour votre confiance !",
    sale_terms: "Les articles ne sont pas remboursables. Échange sous 7 jours."
  }
};

class JSONRelationalDB {
  constructor() {
    this.data = null;
    this.backupState = null;
    this.transactionDepth = 0;
    this.remoteMode = process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.dirty = false;
  }

  init() {
    if (!fs.existsSync(DB_DIR)) {
      if (!this.remoteMode) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
    }

    if (!fs.existsSync(DB_FILE)) {
      this.data = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
      if (!this.remoteMode) {
        this.save();
      }
    } else {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf8');
        this.data = JSON.parse(fileContent);
        // S'assurer que tous les schémas par défaut sont présents en cas de mise à jour
        for (const key in DEFAULT_SCHEMA) {
          if (this.data[key] === undefined) {
            this.data[key] = DEFAULT_SCHEMA[key];
          }
        }
      } catch (err) {
        console.error("Erreur lors de la lecture de la base de données, réinitialisation...", err);
        this.data = JSON.parse(JSON.stringify(DEFAULT_SCHEMA));
        this.save();
      }
    }
  }

  save() {
    if (this.remoteMode) {
      this.dirty = true;
      return;
    }

    if (this.transactionDepth === 0) {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    }
  }

  setRemoteData(data) {
    this.remoteMode = true;
    this.data = JSON.parse(JSON.stringify(data || DEFAULT_SCHEMA));
    for (const key in DEFAULT_SCHEMA) {
      if (this.data[key] === undefined) {
        this.data[key] = JSON.parse(JSON.stringify(DEFAULT_SCHEMA[key]));
      }
    }
    this.dirty = false;
  }

  getSnapshot() {
    return JSON.parse(JSON.stringify(this.data));
  }

  // Transactions
  transaction(fn) {
    if (this.transactionDepth === 0) {
      this.backupState = JSON.stringify(this.data);
    }
    this.transactionDepth++;

    try {
      const result = fn();
      this.transactionDepth--;
      if (this.transactionDepth === 0) {
        this.backupState = null;
        this.save();
      }
      return result;
    } catch (error) {
      this.transactionDepth = 0;
      if (this.backupState !== null) {
        this.data = JSON.parse(this.backupState);
        this.backupState = null;
      }
      throw error;
    }
  }

  // CRUD générique
  find(table, filterFn) {
    const list = this.data[table] || [];
    if (typeof filterFn === 'function') {
      return list.filter(filterFn);
    }
    return list;
  }

  findOne(table, filterFn) {
    const list = this.data[table] || [];
    if (typeof filterFn === 'function') {
      return list.find(filterFn) || null;
    }
    return null;
  }

  insert(table, doc) {
    if (!this.data[table]) {
      this.data[table] = [];
    }

    const list = this.data[table];
    const newDoc = { ...doc };

    // Auto-incrément d'ID s'il s'agit d'un tableau d'objets
    if (Array.isArray(list)) {
      const maxId = list.reduce((max, item) => (item.id && item.id > max ? item.id : max), 0);
      newDoc.id = maxId + 1;
      list.push(newDoc);
      this.save();
      return newDoc;
    } else {
      // Pour les objets simples comme settings
      this.data[table] = { ...this.data[table], ...doc };
      this.save();
      return this.data[table];
    }
  }

  update(table, id, updates) {
    if (!this.data[table]) return null;

    const list = this.data[table];
    if (Array.isArray(list)) {
      const idx = list.findIndex(item => item.id === id);
      if (idx === -1) return null;

      const oldDoc = list[idx];
      list[idx] = { ...oldDoc, ...updates, id }; // Conserver l'UID
      this.save();
      return list[idx];
    } else {
      this.data[table] = { ...this.data[table], ...updates };
      this.save();
      return this.data[table];
    }
  }

  delete(table, id) {
    if (!this.data[table]) return false;

    const list = this.data[table];
    if (Array.isArray(list)) {
      const idx = list.findIndex(item => item.id === id);
      if (idx === -1) return false;

      list.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  // Permet de logguer les audits
  audit(userId, action, targetTable, targetId, oldValue, newValue) {
    this.insert('audit_logs', {
      date: new Date().toISOString(),
      userId: userId || null,
      action,
      targetTable,
      targetId,
      oldValue: oldValue ? JSON.stringify(oldValue) : null,
      newValue: newValue ? JSON.stringify(newValue) : null
    });
  }
}

const db = new JSONRelationalDB();
db.init();

module.exports = db;
