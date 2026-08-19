/**
 * Script de remise à zéro — Supprime toutes les données commerciales
 * CONSERVE : comptes utilisateurs et paramètres de la boutique
 * SUPPRIME  : produits, ventes, achats, dépenses, clients, fournisseurs, stock, trésorerie...
 */
const db = require('./db');

console.log('🗑️  Remise à zéro de la base de données...\n');

// Garder les utilisateurs et les paramètres
const users = db.data.users;
const settings = db.data.settings;

// Remplacer toutes les données commerciales par des tableaux vides
db.data = {
    users,
    settings,
    categories: [
        { id: 1, name: 'Bagues' },
        { id: 2, name: 'Colliers' },
        { id: 3, name: 'Bracelets' },
        { id: 4, name: 'Boucles d\'oreilles' },
        { id: 5, name: 'Montres' },
        { id: 6, name: 'Parures' },
        { id: 7, name: 'Accessoires' }
    ],
    products: [],
    stock_movements: [],
    purchases: [],
    purchase_items: [],
    sales: [],
    sale_items: [],
    payments: [],
    expenses: [],
    customers: [],
    suppliers: [
        { id: 1, name: "Modou", company: "Fournisseur Modou", phone: "", email: "", address: "Sénégal", dateCreated: new Date().toISOString() },
        { id: 2, name: "Laye", company: "Fournisseur Laye", phone: "", email: "", address: "Sénégal", dateCreated: new Date().toISOString() },
        { id: 3, name: "Kara", company: "Fournisseur Kara", phone: "", email: "", address: "Sénégal", dateCreated: new Date().toISOString() },
        { id: 4, name: "Tidiane", company: "Fournisseur Tidiane", phone: "", email: "", address: "Sénégal", dateCreated: new Date().toISOString() }
    ],
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
    goals: []
};

db.save();

console.log('✅ Base de données vidée avec succès !');
console.log('');
console.log('📋 État actuel :');
console.log('   ✔ Utilisateurs conservés :', users.length);
console.log('   ✔ Catégories :', db.data.categories.length);
console.log('   ✔ Produits : 0');
console.log('   ✔ Ventes : 0');
console.log('   ✔ Achats : 0');
console.log('   ✔ Clients : 0');
console.log('   ✔ Fournisseurs : 0');
console.log('   ✔ Dépenses : 0');
console.log('   ✔ Trésorerie remise à 0 FCFA');
console.log('');
console.log('🚀 L\'application est prête. Vous pouvez maintenant entrer vos vraies données.');
