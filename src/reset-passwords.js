/**
 * Script de réinitialisation forcée des mots de passe utilisateurs
 */
const db = require('./db');
const crypto = require('crypto');

function hashPassword(password) {
    const salt = 'bijoux_salt_12345';
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

console.log('🔐 Réinitialisation forcée des mots de passe...');

// Forcer la mise à jour des mots de passe pour chaque utilisateur
const users = db.find('users');

if (users.length === 0) {
    // Créer les utilisateurs s'ils n'existent pas
    db.insert('users', { username: 'admin', password: hashPassword('admin123'), role: 'Administrateur', name: 'Propriétaire' });
    db.insert('users', { username: 'vendeur', password: hashPassword('vendeur123'), role: 'Vendeur', name: 'Awa Diop' });
    db.insert('users', { username: 'comptable', password: hashPassword('comptable123'), role: 'Comptable', name: 'Moussa Gueye' });
    console.log('✅ Utilisateurs créés avec les nouveaux mots de passe.');
} else {
    users.forEach(u => {
        let newPassword;
        if (u.username === 'admin') newPassword = 'admin123';
        else if (u.username === 'vendeur') newPassword = 'vendeur123';
        else if (u.username === 'comptable') newPassword = 'comptable123';
        else return; // Ignorer les autres utilisateurs

        db.update('users', u.id, { password: hashPassword(newPassword) });
        console.log(`✅ Mot de passe de "${u.username}" réinitialisé → "${newPassword}"`);
    });
}

db.save();
console.log('\n🎉 Réinitialisation terminée !');
console.log('\nIdentifiants disponibles :');
console.log('  👤 admin       / admin123');
console.log('  👤 vendeur     / vendeur123');
console.log('  👤 comptable   / comptable123');
