const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Utilitaire password hashing
function hashPassword(password) {
    const salt = 'bijoux_salt_12345';
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, hash) {
    return hashPassword(password) === hash;
}

// Config Express
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
    name: 'bijoux_session',
    keys: [process.env.SESSION_SECRET || 'bijoux_session_key'],
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
}));

// Middlewares d'autorisation
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    next();
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        if (!roles.includes(req.session.user.role)) {
            return res.status(403).json({ error: 'Accès interdit - Permission insuffisante' });
        }
        next();
    };
}

// Créer un utilisateur par défaut si aucun n'existe
function setupDefaultUsers() {
    const users = db.find('users');
    if (users.length === 0) {
        db.insert('users', {
            username: 'admin',
            password: hashPassword('admin123'),
            role: 'Administrateur',
            name: 'Propriétaire'
        });
        db.insert('users', {
            username: 'vendeur',
            password: hashPassword('vendeur123'),
            role: 'Vendeur',
            name: 'Awa Diop'
        });
        db.insert('users', {
            username: 'comptable',
            password: hashPassword('comptable123'),
            role: 'Comptable',
            name: 'Moussa Gueye'
        });
        console.log("Utilisateurs par défaut créés.");
    }
}
function initializeData() {
    setupDefaultUsers();

    db.transaction(() => {
        const cashAccounts = db.find('cash_accounts');
        const cashMovements = db.find('cash_movements');
        for (const acc of cashAccounts) {
            const accMovements = cashMovements.filter(m => m.accountId === acc.id);
            if (accMovements.length === 0 && acc.balance !== 0) {
                db.update('cash_accounts', acc.id, { balance: 0 });
            }
        }
    });
}

// Endpoint d'authentification
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }

    const user = db.findOne('users', u => u.username.toLowerCase() === username.toLowerCase());
    if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
    };

    res.json({ user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
    req.session = null;
    res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.json({ user: null });
    }
});

// Produits & Catégories
app.get('/api/categories', requireAuth, (req, res) => {
    res.json(db.find('categories'));
});

app.post('/api/categories', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });

    const existing = db.findOne('categories', c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) return res.status(400).json({ error: 'Cette catégorie existe déjà' });

    const cat = db.insert('categories', { name });
    db.audit(req.session.user.id, 'CREATE', 'categories', cat.id, null, cat);
    res.json(cat);
});

app.get('/api/products', requireAuth, (req, res) => {
    const products = db.find('products');
    res.json(products);
});

app.post('/api/products', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const { name, categoryId, description, photo, supplierId, purchasePrice, sellPriceRecommended, sellPriceActual, quantity, minStock, material, color, size, brand } = req.body;

    if (!name || purchasePrice === undefined || sellPriceActual === undefined) {
        return res.status(400).json({ error: 'Nom, prix d\'achat et prix de vente requis' });
    }

    db.transaction(() => {
        // Calcul de la référence automatique
        const products = db.find('products');
        const refNum = products.length + 1;
        const reference = 'BJ-' + String(refNum).padStart(5, '0');

        const product = db.insert('products', {
            reference,
            name,
            categoryId: parseInt(categoryId) || null,
            description: description || '',
            photo: photo || '',
            supplierId: parseInt(supplierId) || null,
            purchasePrice: parseFloat(purchasePrice),
            sellPriceRecommended: parseFloat(sellPriceRecommended || sellPriceActual),
            sellPriceActual: parseFloat(sellPriceActual),
            quantity: parseInt(quantity) || 0,
            minStock: parseInt(minStock) || 0,
            material: material || '',
            color: color || '',
            size: size || '',
            brand: brand || '',
            dateAdded: new Date().toISOString(),
            status: 'actif'
        });

        if (quantity > 0) {
            db.insert('stock_movements', {
                productId: product.id,
                type: 'entrée',
                reason: 'inventaire',
                quantity: parseInt(quantity),
                date: new Date().toISOString(),
                notes: 'Stock initial lors de la création du produit',
                userId: req.session.user.id
            });
        }

        db.audit(req.session.user.id, 'CREATE', 'products', product.id, null, product);
        res.json(product);
    });
});

app.put('/api/products/:id', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const id = parseInt(req.params.id);
    const oldProduct = db.findOne('products', p => p.id === id);
    if (!oldProduct) return res.status(404).json({ error: 'Produit non trouvé' });

    const { name, categoryId, description, photo, supplierId, purchasePrice, sellPriceRecommended, sellPriceActual, minStock, material, color, size, brand, status } = req.body;

    db.transaction(() => {
        const updated = db.update('products', id, {
            name: name ?? oldProduct.name,
            categoryId: categoryId !== undefined ? (parseInt(categoryId) || null) : oldProduct.categoryId,
            description: description ?? oldProduct.description,
            photo: photo ?? oldProduct.photo,
            supplierId: supplierId !== undefined ? (parseInt(supplierId) || null) : oldProduct.supplierId,
            purchasePrice: purchasePrice !== undefined ? parseFloat(purchasePrice) : oldProduct.purchasePrice,
            sellPriceRecommended: sellPriceRecommended !== undefined ? parseFloat(sellPriceRecommended) : oldProduct.sellPriceRecommended,
            sellPriceActual: sellPriceActual !== undefined ? parseFloat(sellPriceActual) : oldProduct.sellPriceActual,
            minStock: minStock !== undefined ? parseInt(minStock) : oldProduct.minStock,
            material: material ?? oldProduct.material,
            color: color ?? oldProduct.color,
            size: size ?? oldProduct.size,
            brand: brand ?? oldProduct.brand,
            status: status ?? oldProduct.status
        });

        db.audit(req.session.user.id, 'UPDATE', 'products', id, oldProduct, updated);
        res.json(updated);
    });
});

// Clients & Fournisseurs
app.get('/api/customers', requireAuth, (req, res) => {
    const customers = db.find('customers');
    const sales = db.find('sales');

    // Associer chiffres d'achats et soldes dus
    const result = customers.map(c => {
        const clientSales = sales.filter(s => s.customerId === c.id);
        const totalPurchased = clientSales.reduce((sum, s) => sum + s.totalAmount, 0);
        const totalPaid = clientSales.reduce((sum, s) => sum + s.paidAmount, 0);
        const balanceDue = clientSales.reduce((sum, s) => sum + s.balanceDue, 0);

        return {
            ...c,
            totalPurchased,
            totalPaid,
            balanceDue,
            salesCount: clientSales.length
        };
    });
    res.json(result);
});

app.post('/api/customers', requireAuth, (req, res) => {
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom client requis' });

    const customer = db.insert('customers', {
        name,
        phone: phone || '',
        email: email || '',
        address: address || '',
        dateCreated: new Date().toISOString()
    });

    db.audit(req.session.user.id, 'CREATE', 'customers', customer.id, null, customer);
    res.json(customer);
});

app.delete('/api/customers/:id', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const id = parseInt(req.params.id);
    const customer = db.findOne('customers', c => c.id === id);
    if (!customer) return res.status(404).json({ error: 'Client non trouvé' });

    // Vérifier si le client a des ventes associées
    const sales = db.find('sales', s => s.customerId === id);
    if (sales.length > 0) {
        return res.status(400).json({ error: 'Impossible de supprimer ce client car il est référencé dans des ventes.' });
    }

    db.transaction(() => {
        db.delete('customers', id);
        db.audit(req.session.user.id, 'DELETE', 'customers', id, customer, null);
        res.json({ success: true });
    });
});

app.get('/api/suppliers', requireAuth, (req, res) => {
    const suppliers = db.find('suppliers');
    const purchases = db.find('purchases');

    const result = suppliers.map(s => {
        const supplierPurchases = purchases.filter(p => p.supplierId === s.id);
        const totalPurchased = supplierPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
        const totalPaid = supplierPurchases.reduce((sum, p) => sum + p.paidAmount, 0);
        const balanceDue = supplierPurchases.reduce((sum, p) => sum + p.balanceDue, 0);

        return {
            ...s,
            totalPurchased,
            totalPaid,
            balanceDue,
            purchasesCount: supplierPurchases.length
        };
    });
    res.json(result);
});

app.post('/api/suppliers', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const { name, company, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom fournisseur requis' });

    const supplier = db.insert('suppliers', {
        name,
        company: company || '',
        phone: phone || '',
        email: email || '',
        address: address || '',
        dateCreated: new Date().toISOString()
    });

    db.audit(req.session.user.id, 'CREATE', 'suppliers', supplier.id, null, supplier);
    res.json(supplier);
});

// Mouvements de stock
app.get('/api/stock/movements', requireAuth, (req, res) => {
    const movements = db.find('stock_movements');
    const products = db.find('products');

    const result = movements.map(m => {
        const p = products.find(prod => prod.id === m.productId);
        return {
            ...m,
            productName: p ? p.name : 'Produit inconnu',
            productReference: p ? p.reference : ''
        };
    });
    res.json(result);
});

app.post('/api/stock/adjust', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const { productId, type, quantity, reason, notes } = req.body;

    if (!productId || !type || !quantity || !reason) {
        return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const product = db.findOne('products', p => p.id === parseInt(productId));
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

    const qty = parseInt(quantity);
    if (qty <= 0) return res.status(400).json({ error: 'La quantité doit être supérieure à 0' });

    db.transaction(() => {
        let newQty = product.quantity;
        if (type === 'entrée') {
            newQty += qty;
        } else if (type === 'sortie') {
            newQty -= qty;
        } else {
            throw new Error("Type de mouvement invalide");
        }

        db.update('products', product.id, { quantity: newQty });

        const movement = db.insert('stock_movements', {
            productId: product.id,
            type,
            reason,
            quantity: qty,
            date: new Date().toISOString(),
            notes: notes || '',
            userId: req.session.user.id
        });

        db.audit(req.session.user.id, 'ADJUST_STOCK', 'products', product.id, { before: product.quantity }, { after: newQty });
        res.json(movement);
    });
});

// Inventaire Physique
app.post('/api/stock/inventory', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const { items } = req.body; // Array de { productId, physicalQty, justification }
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Articles d\'inventaire requis' });
    }

    db.transaction(() => {
        const results = [];
        const products = db.find('products');

        for (const item of items) {
            const p = products.find(prod => prod.id === parseInt(item.productId));
            if (!p) continue;

            const delta = parseInt(item.physicalQty) - p.quantity;
            if (delta === 0) continue; // Pas de décalage

            const type = delta > 0 ? 'entrée' : 'sortie';
            const absDelta = Math.abs(delta);
            const reason = 'correction_inventaire';

            db.update('products', p.id, { quantity: parseInt(item.physicalQty) });

            const movement = db.insert('stock_movements', {
                productId: p.id,
                type,
                reason,
                quantity: absDelta,
                date: new Date().toISOString(),
                notes: item.justification || 'Correction d\'inventaire physique',
                userId: req.session.user.id
            });

            db.audit(req.session.user.id, 'INVENTORY_CORRECTION', 'products', p.id, { before: p.quantity }, { after: item.physicalQty });
            results.push({ productId: p.id, delta, movement });
        }

        res.json({ success: true, adjustedCount: results.length, details: results });
    });
});

// Caisse
app.get('/api/caisse/sessions/current', requireAuth, (req, res) => {
    const session = db.findOne('cash_sessions', s => s.status === 'open');
    res.json({ session });
});

app.post('/api/caisse/sessions/open', requireAuth, (req, res) => {
    const openSession = db.findOne('cash_sessions', s => s.status === 'open');
    if (openSession) {
        return res.status(400).json({ error: 'Une session de caisse est déjà ouverte' });
    }

    const { initialBalance } = req.body;
    if (initialBalance === undefined || parseFloat(initialBalance) < 0) {
        return res.status(400).json({ error: 'Solde initial valide requis' });
    }

    db.transaction(() => {
        const session = db.insert('cash_sessions', {
            openedBy: req.session.user.name,
            openedById: req.session.user.id,
            openedAt: new Date().toISOString(),
            closedAt: null,
            initialBalance: parseFloat(initialBalance),
            finalBalanceTheoretical: parseFloat(initialBalance),
            finalBalanceReal: 0,
            variance: 0,
            justification: '',
            status: 'open'
        });

        // Mettre à jour la caisse 'Espèces' (id: 1)
        const cashAccount = db.findOne('cash_accounts', a => a.id === 1);
        db.update('cash_accounts', 1, { balance: parseFloat(initialBalance) });

        // Enregistrer le mouvement financier d'ouverture
        db.insert('cash_movements', {
            date: new Date().toISOString(),
            accountId: 1,
            type: 'in',
            amount: parseFloat(initialBalance),
            reason: 'ouverture_caisse',
            referenceId: session.id
        });

        db.audit(req.session.user.id, 'OPEN_SESSION', 'cash_sessions', session.id, null, session);
        res.json(session);
    });
});

app.delete('/api/caisse/sessions/current', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const openSession = db.findOne('cash_sessions', s => s.status === 'open');
    if (!openSession) {
        return res.status(400).json({ error: "Aucune session de caisse n'est ouverte" });
    }

    db.transaction(() => {
        // Supprimer le mouvement financier d'ouverture associé
        const movement = db.findOne('cash_movements', m => m.reason === 'ouverture_caisse' && m.referenceId === openSession.id);
        if (movement) {
            db.delete('cash_movements', movement.id);
        }

        // Restaurer le solde de la caisse 'Espèces' (id: 1) à sa valeur précédente
        const closedSessions = db.find('cash_sessions', s => s.status === 'closed');
        let previousBalance = 0;
        if (closedSessions.length > 0) {
            closedSessions.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
            previousBalance = closedSessions[0].finalBalanceReal;
        }
        db.update('cash_accounts', 1, { balance: previousBalance });

        // Supprimer la session elle-même
        db.delete('cash_sessions', openSession.id);

        db.audit(req.session.user.id, 'DELETE_SESSION', 'cash_sessions', openSession.id, openSession, null);
        res.json({ success: true });
    });
});

app.delete('/api/caisse/movements/:id', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const id = parseInt(req.params.id);
    const movement = db.findOne('cash_movements', m => m.id === id);
    if (!movement) return res.status(404).json({ error: 'Mouvement financier non trouvé' });

    // Restreindre aux motifs de caisse (ouverture, écart)
    const restrictedReasons = ['ouverture_caisse', 'cloture_caisse_ecart'];

    if (!restrictedReasons.includes(movement.reason)) {
        return res.status(400).json({ error: 'Ce mouvement est lié à une vente, un achat ou une dépense d’exploitation. Veuillez supprimer l’élément d’origine pour l’annuler.' });
    }

    db.transaction(() => {
        // En cas d'ouverture de caisse, supprimer la session et restaurer le solde
        if (movement.reason === 'ouverture_caisse') {
            const session = db.findOne('cash_sessions', s => s.id === movement.referenceId);
            if (session) {
                db.delete('cash_sessions', session.id);
            }

            // Si c'est le compte Espèces (id: 1), restaurer le solde de la dernière session fermée restante
            if (movement.accountId === 1) {
                const closedSessions = db.find('cash_sessions', s => s.status === 'closed');
                let previousBalance = 0;
                if (closedSessions.length > 0) {
                    closedSessions.sort((a, b) => new Date(b.closedAt) - new Date(a.closedAt));
                    previousBalance = closedSessions[0].finalBalanceReal;
                }
                db.update('cash_accounts', 1, { balance: previousBalance });
            } else {
                const account = db.findOne('cash_accounts', a => a.id === movement.accountId);
                if (account) {
                    db.update('cash_accounts', movement.accountId, { balance: Math.max(0, account.balance - movement.amount) });
                }
            }
        } else {
            // Mouvements standards (ventes, achats, dépenses)
            const account = db.findOne('cash_accounts', a => a.id === movement.accountId);
            if (account) {
                let newBalance = account.balance;
                if (movement.type === 'in') {
                    newBalance -= movement.amount;
                } else {
                    newBalance += movement.amount;
                }
                db.update('cash_accounts', movement.accountId, { balance: Math.max(0, newBalance) });
            }
        }

        // Supprimer le mouvement
        db.delete('cash_movements', id);

        db.audit(req.session.user.id, 'DELETE_CASH_MOVEMENT', 'cash_movements', id, movement, null);
        res.json({ success: true });
    });
});

app.post('/api/caisse/sessions/close', requireAuth, (req, res) => {
    const openSession = db.findOne('cash_sessions', s => s.status === 'open');
    if (!openSession) {
        return res.status(400).json({ error: 'Aucune session de caisse n\'est ouverte' });
    }

    const { finalBalanceReal, justification } = req.body;
    if (finalBalanceReal === undefined || parseFloat(finalBalanceReal) < 0) {
        return res.status(400).json({ error: 'Solde réel valide requis' });
    }

    db.transaction(() => {
        // Calculer le solde théorique de la caisse espèces. Il est stocké dans le compte
        const cashAccount = db.findOne('cash_accounts', a => a.id === 1);
        const theoretical = cashAccount.balance;
        const realVal = parseFloat(finalBalanceReal);
        const variance = realVal - theoretical;

        if (Math.abs(variance) > 0 && !justification) {
            throw new Error("Une justification est requise pour l'écart de caisse");
        }

        const updatedSession = db.update('cash_sessions', openSession.id, {
            closedAt: new Date().toISOString(),
            finalBalanceTheoretical: theoretical,
            finalBalanceReal: realVal,
            variance,
            justification: justification || '',
            status: 'closed'
        });

        db.audit(req.session.user.id, 'CLOSE_SESSION', 'cash_sessions', openSession.id, openSession, updatedSession);
        res.json(updatedSession);
    });
});

app.get('/api/caisse/treasury', requireAuth, (req, res) => {
    const accounts = db.find('cash_accounts');
    const movements = db.find('cash_movements');

    const enrichedMovements = movements.map(m => {
        const acc = accounts.find(a => a.id === m.accountId);
        return {
            ...m,
            accountName: acc ? acc.name : 'Inconnu'
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ accounts, movements: enrichedMovements });
});

// Achats fournisseurs
app.get('/api/purchases', requireAuth, (req, res) => {
    const purchases = db.find('purchases');
    const suppliers = db.find('suppliers');

    const result = purchases.map(p => {
        const s = suppliers.find(sup => sup.id === p.supplierId);
        return {
            ...p,
            supplierName: s ? s.name : 'Fournisseur inconnu',
            supplierCompany: s ? s.company : ''
        };
    });
    res.json(result);
});

app.post('/api/purchases', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const { supplierId, date, taxAdditionalCost, discount, items, paidAmount, paymentMethod } = req.body;

    if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Fournisseur et articles requis' });
    }

    db.transaction(() => {
        const products = db.find('products');
        const supplier = db.findOne('suppliers', s => s.id === parseInt(supplierId));
        if (!supplier) throw new Error("Fournisseur introuvable");

        // Calcul du total des articles
        let subtotal = 0;
        const purchaseItemsToInsert = [];

        for (const item of items) {
            const p = products.find(prod => prod.id === parseInt(item.productId));
            if (!p) throw new Error(`Produit ID ${item.productId} non trouvé`);
            const qty = parseInt(item.quantity);
            const uPrice = parseFloat(item.unitPrice);
            const positionTotal = qty * uPrice;
            subtotal += positionTotal;

            purchaseItemsToInsert.push({
                productId: p.id,
                quantity: qty,
                unitPrice: uPrice,
                totalPosition: positionTotal
            });
        }

        const taxVal = parseFloat(taxAdditionalCost || 0);
        const discVal = parseFloat(discount || 0);
        const totalAmount = subtotal + taxVal - discVal;
        const paidVal = parseFloat(paidAmount || 0);
        const balanceDue = totalAmount - paidVal;

        let pStatus = 'payé';
        if (balanceDue > 0) {
            pStatus = paidVal > 0 ? 'partiellement payé' : 'impayé';
        }

        // Créer la facture d'achat
        const purchaseNum = db.find('purchases').length + 1;
        const orderNumber = 'ACH-' + String(purchaseNum).padStart(5, '0');

        const purchase = db.insert('purchases', {
            orderNumber,
            date: date || new Date().toISOString(),
            supplierId: supplier.id,
            taxAdditionalCost: taxVal,
            discount: discVal,
            totalAmount,
            paidAmount: paidVal,
            balanceDue,
            paymentMethod: paidVal > 0 ? paymentMethod : '',
            status: pStatus
        });

        // Insérer les items de facturation et mettre à jour le stock
        for (const pItem of purchaseItemsToInsert) {
            db.insert('purchase_items', {
                purchaseId: purchase.id,
                ...pItem
            });

            const p = products.find(prod => prod.id === pItem.productId);
            const newQty = p.quantity + pItem.quantity;
            db.update('products', p.id, {
                quantity: newQty,
                purchasePrice: pItem.unitPrice // Actuatiler le coût unitaire d'achat
            });

            db.insert('stock_movements', {
                productId: p.id,
                type: 'entrée',
                reason: 'achat fournisseurs',
                quantity: pItem.quantity,
                date: purchase.date,
                notes: `Facture d'achat ${orderNumber}`,
                userId: req.session.user.id
            });
        }

        // Enregistrer le règlement
        if (paidVal > 0) {
            db.insert('payments', {
                type: 'purchase',
                referenceId: purchase.id,
                supplierId: supplier.id,
                amount: paidVal,
                paymentMethod,
                date: purchase.date,
                notes: `Acompte achat ${orderNumber}`
            });

            // Mettre à jour le solde du compte de trésorerie (decaissement)
            const accountMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3, 'Autre': 1 };
            const accountId = accountMap[paymentMethod] || 1;
            const acc = db.findOne('cash_accounts', a => a.id === accountId);
            db.update('cash_accounts', accountId, { balance: acc.balance - paidVal });

            db.insert('cash_movements', {
                date: purchase.date,
                accountId,
                type: 'out',
                amount: paidVal,
                reason: 'achat_fournisseur',
                referenceId: purchase.id
            });
        }

        db.audit(req.session.user.id, 'CREATE_PURCHASE', 'purchases', purchase.id, null, purchase);
        res.json(purchase);
    });
});

app.post('/api/purchases/:id/payment', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const purchaseId = parseInt(req.params.id);
    const purchase = db.findOne('purchases', p => p.id === purchaseId);
    if (!purchase) return res.status(404).json({ error: 'Achat non trouvé' });

    const { amount, paymentMethod, date } = req.body;
    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) return res.status(400).json({ error: 'Montant valide requis' });
    if (payAmt > purchase.balanceDue) return res.status(400).json({ error: 'Le montant dépasse le reste à payer' });

    db.transaction(() => {
        const newPaid = purchase.paidAmount + payAmt;
        const newBalance = purchase.balanceDue - payAmt;
        const newStatus = newBalance === 0 ? 'payé' : 'partiellement payé';

        db.update('purchases', purchase.id, {
            paidAmount: newPaid,
            balanceDue: newBalance,
            status: newStatus
        });

        db.insert('payments', {
            type: 'purchase',
            referenceId: purchase.id,
            supplierId: purchase.supplierId,
            amount: payAmt,
            paymentMethod,
            date: date || new Date().toISOString(),
            notes: `Versement dette achat ${purchase.orderNumber}`
        });

        // Comptabilité caisse
        const accountMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3, 'Autre': 1 };
        const accountId = accountMap[paymentMethod] || 1;
        const acc = db.findOne('cash_accounts', a => a.id === accountId);
        db.update('cash_accounts', accountId, { balance: acc.balance - payAmt });

        db.insert('cash_movements', {
            date: date || new Date().toISOString(),
            accountId,
            type: 'out',
            amount: payAmt,
            reason: 'reglement_dette_fournisseur',
            referenceId: purchase.id
        });

        db.audit(req.session.user.id, 'ADD_PURCHASE_PAYMENT', 'purchases', purchase.id, { amount: payAmt }, { newBalance });
        res.json({ success: true, updated: db.findOne('purchases', p => p.id === purchaseId) });
    });
});

// Ventes (POS)
app.get('/api/sales', requireAuth, (req, res) => {
    const sales = db.find('sales');
    const customers = db.find('customers');

    const result = sales.map(s => {
        const c = customers.find(cust => cust.id === s.customerId);
        return {
            ...s,
            customerName: c ? c.name : 'Client anonyme',
            customerPhone: c ? c.phone : ''
        };
    });
    res.json(result);
});

app.get('/api/sales/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const sale = db.findOne('sales', s => s.id === id);
    if (!sale) return res.status(404).json({ error: 'Vente non trouvée' });

    const customer = db.findOne('customers', c => c.id === sale.customerId);
    const items = db.find('sale_items', si => si.saleId === id);
    const products = db.find('products');

    const enrichedItems = items.map(it => {
        const p = products.find(prod => prod.id === it.productId);
        return {
            ...it,
            name: p ? p.name : 'Produit inconnu',
            reference: p ? p.reference : '',
            purchasePrice: p ? p.purchasePrice : 0
        };
    });

    res.json({
        ...sale,
        customer,
        items: enrichedItems
    });
});

app.post('/api/sales', requireAuth, (req, res) => {
    // Optionnel : s'assurer que la caisse est ouverte s'il s'agit d'un paiement en espèces
    const openSession = db.findOne('cash_sessions', s => s.status === 'open');
    const { customerId, date, discount, items, paidAmount, paymentMethod, dueDate } = req.body;

    if (paymentMethod === 'Espèces' && !openSession) {
        return res.status(400).json({ error: 'La caisse enregistreuse n\'est pas ouverte. Veuillez l\'ouvrir dans la rubrique Caisse.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Articles de vente requis' });
    }

    db.transaction(() => {
        const products = db.find('products');
        let client = null;
        if (customerId) {
            client = db.findOne('customers', c => c.id === parseInt(customerId));
            if (!client) throw new Error("Client introuvable");
        }

        let subtotal = 0;
        const saleItemsToInsert = [];

        for (const item of items) {
            const p = products.find(prod => prod.id === parseInt(item.productId));
            if (!p) throw new Error(`Bijou ID ${item.productId} non trouvé`);
            const qty = parseInt(item.quantity);
            const uPrice = parseFloat(item.unitPrice || p.sellPriceActual);
            const positionTotal = qty * uPrice;
            subtotal += positionTotal;

            saleItemsToInsert.push({
                productId: p.id,
                quantity: qty,
                unitPrice: uPrice,
                totalPosition: positionTotal,
                purchasePriceCost: p.purchasePrice // mémoriser à l'instant T
            });
        }

        const discVal = parseFloat(discount || 0);
        const totalAmount = subtotal - discVal;
        const paidVal = parseFloat(paidAmount || 0);
        const balanceDue = totalAmount - paidVal;

        let sStatus = 'payé';
        if (balanceDue > 0) {
            sStatus = paidVal > 0 ? 'partiellement payé' : 'impayé';
        }

        const saleNum = db.find('sales').length + 1;
        const receiptNumber = 'VTE-' + String(saleNum).padStart(6, '0');

        const sale = db.insert('sales', {
            receiptNumber,
            date: date || new Date().toISOString(),
            customerId: client ? client.id : null,
            discount: discVal,
            subtotal,
            totalAmount,
            paidAmount: paidVal,
            balanceDue,
            paymentMethod,
            dueDate: balanceDue > 0 ? dueDate : null,
            status: sStatus,
            userId: req.session.user.id
        });

        // Insérer items et décrémenter stock
        for (const sItem of saleItemsToInsert) {
            db.insert('sale_items', {
                saleId: sale.id,
                ...sItem
            });

            const p = products.find(prod => prod.id === sItem.productId);
            const newQty = p.quantity - sItem.quantity;
            db.update('products', p.id, { quantity: newQty });

            db.insert('stock_movements', {
                productId: p.id,
                type: 'sortie',
                reason: 'vente',
                quantity: sItem.quantity,
                date: sale.date,
                notes: `Facture de vente ${receiptNumber}`,
                userId: req.session.user.id
            });
        }

        // Gestion de l'encaissement de trésorerie
        if (paidVal > 0) {
            db.insert('payments', {
                type: 'sale',
                referenceId: sale.id,
                customerId: client ? client.id : null,
                amount: paidVal,
                paymentMethod,
                date: sale.date,
                notes: `Paiement vente ${receiptNumber}`
            });

            const accountMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3, 'Autre': 1 };
            const accountId = accountMap[paymentMethod] || 1;
            const acc = db.findOne('cash_accounts', a => a.id === accountId);
            db.update('cash_accounts', accountId, { balance: acc.balance + paidVal });

            db.insert('cash_movements', {
                date: sale.date,
                accountId,
                type: 'in',
                amount: paidVal,
                reason: 'vente_bijou',
                referenceId: sale.id
            });
        }

        db.audit(req.session.user.id, 'CREATE_SALE', 'sales', sale.id, null, sale);
        res.json(sale);
    });
});

app.post('/api/sales/:id/payment', requireAuth, (req, res) => {
    const saleId = parseInt(req.params.id);
    const sale = db.findOne('sales', s => s.id === saleId);
    if (!sale) return res.status(404).json({ error: 'Vente non trouvée' });

    const { amount, paymentMethod, date } = req.body;
    const payAmt = parseFloat(amount);
    if (!payAmt || payAmt <= 0) return res.status(400).json({ error: 'Montant valide requis' });
    if (payAmt > sale.balanceDue) return res.status(400).json({ error: 'Le montant dépasse le reste à payer' });

    db.transaction(() => {
        const newPaid = sale.paidAmount + payAmt;
        const newBalance = sale.balanceDue - payAmt;
        const newStatus = newBalance === 0 ? 'payé' : 'partiellement payé';

        db.update('sales', sale.id, {
            paidAmount: newPaid,
            balanceDue: newBalance,
            status: newStatus
        });

        db.insert('payments', {
            type: 'sale',
            referenceId: sale.id,
            customerId: sale.customerId,
            amount: payAmt,
            paymentMethod,
            date: date || new Date().toISOString(),
            notes: `Encaissement crédit vente ${sale.receiptNumber}`
        });

        // Trésorerie
        const accountMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3, 'Autre': 1 };
        const accountId = accountMap[paymentMethod] || 1;
        const acc = db.findOne('cash_accounts', a => a.id === accountId);
        db.update('cash_accounts', accountId, { balance: acc.balance + payAmt });

        db.insert('cash_movements', {
            date: date || new Date().toISOString(),
            accountId,
            type: 'in',
            amount: payAmt,
            reason: 'recouvrement_creance_client',
            referenceId: sale.id
        });

        db.audit(req.session.user.id, 'ADD_SALE_PAYMENT', 'sales', sale.id, { amount: payAmt }, { newBalance });
        res.json({ success: true, updated: db.findOne('sales', s => s.id === saleId) });
    });
});

app.delete('/api/products/:id', requireAuth, requireRole(['Administrateur']), (req, res) => {
    const id = parseInt(req.params.id);
    const product = db.findOne('products', p => p.id === id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

    // Vérifier si le produit est lié à des factures d'achat ou de vente
    const saleItems = db.find('sale_items', si => si.productId === id);
    const purchaseItems = db.find('purchase_items', pi => pi.productId === id);

    if (saleItems.length > 0 || purchaseItems.length > 0) {
        return res.status(400).json({ error: 'Impossible de supprimer ce bijou car il est référencé dans des ventes ou des achats. Vous pouvez l\'archiver à la place.' });
    }

    db.transaction(() => {
        // Supprimer les mouvements de stock associés (comme le mouvement initial)
        const movements = db.find('stock_movements', m => m.productId === id);
        for (const m of movements) {
            db.delete('stock_movements', m.id);
        }

        // Supprimer le produit
        db.delete('products', id);

        db.audit(req.session.user.id, 'DELETE_PRODUCT', 'products', id, product, null);
        res.json({ success: true });
    });
});

app.delete('/api/sales/:id', requireAuth, requireRole(['Administrateur']), (req, res) => {
    const saleId = parseInt(req.params.id);
    const sale = db.findOne('sales', s => s.id === saleId);
    if (!sale) return res.status(404).json({ error: 'Vente non trouvée' });

    db.transaction(() => {
        // 1. Récupérer les articles vendus
        const saleItems = db.find('sale_items', si => si.saleId === saleId);

        // 2. Restaurer le stock pour chaque article et supprimer les mouvements de stock correspondants
        for (const sItem of saleItems) {
            const p = db.findOne('products', prod => prod.id === sItem.productId);
            if (p) {
                const newQty = p.quantity + sItem.quantity;
                db.update('products', p.id, { quantity: newQty });

                // Supprimer les mouvements de stock de type 'sortie' liés à cette vente
                const movements = db.find('stock_movements', m => m.productId === p.id && m.notes && m.notes.includes(sale.receiptNumber));
                for (const m of movements) {
                    db.delete('stock_movements', m.id);
                }
            }
            // Supprimer la ligne de vente
            db.delete('sale_items', sItem.id);
        }

        // 3. Annuler les paiements et ajuster la trésorerie
        const payments = db.find('payments', p => p.type === 'sale' && p.referenceId === saleId);
        const accountMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3, 'Autre': 1 };

        for (const payment of payments) {
            const paymentMethod = payment.paymentMethod;
            const accountId = accountMap[paymentMethod] || 1;
            const acc = db.findOne('cash_accounts', a => a.id === accountId);
            if (acc) {
                db.update('cash_accounts', accountId, { balance: Math.max(0, acc.balance - payment.amount) });
            }
            db.delete('payments', payment.id);
        }

        // 4. Supprimer les mouvements de caisse liés
        const cashMovements = db.find('cash_movements', m => m.referenceId === saleId && (m.reason === 'vente_bijou' || m.reason === 'recouvrement_creance_client'));
        for (const cm of cashMovements) {
            db.delete('cash_movements', cm.id);
        }

        // 5. Supprimer la vente
        db.delete('sales', saleId);

        db.audit(req.session.user.id, 'DELETE_SALE', 'sales', saleId, sale, null);
        res.json({ success: true });
    });
});


// Dépenses
app.get('/api/expenses', requireAuth, (req, res) => {
    res.json(db.find('expenses'));
});

app.post('/api/expenses', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const { date, category, description, amount, paymentMethod } = req.body;

    if (!category || !amount || !paymentMethod) {
        return res.status(400).json({ error: 'Catégorie, montant et mode de paiement requis' });
    }

    db.transaction(() => {
        const expense = db.insert('expenses', {
            date: date || new Date().toISOString(),
            category,
            description: description || '',
            amount: parseFloat(amount),
            paymentMethod
        });

        // Débit du compte
        const accountMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3, 'Autre': 1 };
        const accountId = accountMap[paymentMethod] || 1;
        const acc = db.findOne('cash_accounts', a => a.id === accountId);
        db.update('cash_accounts', accountId, { balance: acc.balance - parseFloat(amount) });

        db.insert('cash_movements', {
            date: expense.date,
            accountId,
            type: 'out',
            amount: parseFloat(amount),
            reason: 'depense_frais_' + category.toLowerCase().replace(/\s+/g, '_'),
            referenceId: expense.id
        });

        db.audit(req.session.user.id, 'CREATE_EXPENSE', 'expenses', expense.id, null, expense);
        res.json(expense);
    });
});

// Configuration de l'entreprise
app.get('/api/settings', requireAuth, (req, res) => {
    res.json(db.data.settings);
});

app.put('/api/settings', requireAuth, requireRole(['Administrateur']), (req, res) => {
    db.transaction(() => {
        db.data.settings = { ...db.data.settings, ...req.body };
        db.save();
        db.audit(req.session.user.id, 'UPDATE_SETTINGS', 'settings', null, null, db.data.settings);
        res.json(db.data.settings);
    });
});

// Objectifs mensuels
app.get('/api/goals', requireAuth, (req, res) => {
    res.json(db.find('goals'));
});

app.post('/api/goals', requireAuth, requireRole(['Administrateur']), (req, res) => {
    const { year, month, targetRevenue, targetProfit } = req.body;
    if (!year || !month || !targetRevenue) {
        return res.status(400).json({ error: 'Année, mois et objectif de CA requis' });
    }

    const existing = db.findOne('goals', g => g.year === parseInt(year) && g.month === parseInt(month));

    db.transaction(() => {
        let result;
        if (existing) {
            result = db.update('goals', existing.id, {
                targetRevenue: parseFloat(targetRevenue),
                targetProfit: parseFloat(targetProfit || 0)
            });
        } else {
            result = db.insert('goals', {
                year: parseInt(year),
                month: parseInt(month),
                targetRevenue: parseFloat(targetRevenue),
                targetProfit: parseFloat(targetProfit || 0)
            });
        }

        db.audit(req.session.user.id, 'SET_GOAL', 'goals', result.id, existing, result);
        res.json(result);
    });
});

// Journaux d'audit
app.get('/api/audit', requireAuth, requireRole(['Administrateur', 'Comptable']), (req, res) => {
    const logs = db.find('audit_logs');
    const users = db.find('users');

    const result = logs.map(l => {
        const u = users.find(user => user.id === l.userId);
        return {
            ...l,
            userName: u ? u.name : 'Système'
        };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(result);
});

// Alertes de notifications
app.get('/api/notifications', requireAuth, (req, res) => {
    const alerts = [];
    const products = db.find('products');
    const customers = db.find('customers');
    const sales = db.find('sales');
    const purchases = db.find('purchases');

    // Produits presque en rupture
    const warningCount = products.filter(p => p.status === 'actif' && p.quantity <= p.minStock && p.quantity > 0).length;
    const outCount = products.filter(p => p.status === 'actif' && p.quantity <= 0).length;
    if (warningCount > 0) {
        alerts.push({ type: 'warning', message: `⚠️ ${warningCount} produits sont presque en rupture.` });
    }
    if (outCount > 0) {
        alerts.push({ type: 'danger', message: `🚨 ${outCount} produits sont en rupture totale de stock.` });
    }

    // Créances clients impayées
    const totalCustomerDebt = sales.reduce((sum, s) => sum + s.balanceDue, 0);
    if (totalCustomerDebt > 0) {
        alerts.push({ type: 'debt_customer', message: `⚠️ Vos clients vous doivent un total de ${totalCustomerDebt.toLocaleString('fr-FR')} FCFA.` });
    }

    // Dettes fournisseurs
    const totalSupplierDebt = purchases.reduce((sum, p) => sum + p.balanceDue, 0);
    if (totalSupplierDebt > 0) {
        alerts.push({ type: 'debt_supplier', message: `⚠️ Vous avez ${totalSupplierDebt.toLocaleString('fr-FR')} FCFA de dettes fournisseurs.` });
    }

    // Tendances et variations ventes (comparer ce mois par rapport au mois dernier)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthSales = sales.filter(s => {
        const d = new Date(s.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const lastMonthSales = sales.filter(s => {
        const d = new Date(s.date);
        let lm = currentMonth - 1;
        let ly = currentYear;
        if (lm < 0) {
            lm = 11;
            ly -= 1;
        }
        return d.getMonth() === lm && d.getFullYear() === ly;
    });

    const thisMonthTotal = thisMonthSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const lastMonthTotal = lastMonthSales.reduce((sum, s) => sum + s.totalAmount, 0);

    if (lastMonthTotal > 0) {
        const diffPct = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
        if (diffPct > 0) {
            alerts.push({ type: 'trend_up', message: `📈 Les ventes ont augmenté de ${diffPct.toFixed(1)}% ce mois-ci.` });
        } else if (diffPct < 0) {
            alerts.push({ type: 'trend_down', message: `📉 Les ventes de ce mois-ci sont de ${Math.abs(diffPct).toFixed(1)}% inférieures au mois dernier.` });
        }
    }

    res.json(alerts);
});

// API Rapports et Analyses Financières
app.get('/api/reports/dashboard', requireAuth, (req, res) => {
    const period = req.query.period || 'ce_mois'; // ce_jour, cette_semaine, ce_mois, ce_trimestre, cette_annee, perso
    const startDateStr = req.query.startDate;
    const endDateStr = req.query.endDate;

    const now = new Date();
    let startDate = new Date(0); // Epoch
    let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (period === 'ce_jour') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (period === 'cette_semaine') {
        const day = now.getDay() || 7; // Lundi = 1
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1, 0, 0, 0);
    } else if (period === 'ce_mois') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (period === 'ce_trimestre') {
        const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0);
    } else if (period === 'cette_annee') {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    } else if (period === 'perso' && startDateStr && endDateStr) {
        startDate = new Date(startDateStr);
        endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59);
    }

    // Charger les données brutes
    const sales = db.find('sales');
    const saleItems = db.find('sale_items');
    const purchases = db.find('purchases');
    const expenses = db.find('expenses');
    const products = db.find('products');

    // Filtrer par période
    const periodSales = sales.filter(s => {
        const sd = new Date(s.date);
        return sd >= startDate && sd <= endDate;
    });

    const periodPurchases = purchases.filter(p => {
        const pd = new Date(p.date);
        return pd >= startDate && pd <= endDate;
    });

    const periodExpenses = expenses.filter(e => {
        const ed = new Date(e.date);
        return ed >= startDate && ed <= endDate;
    });

    // Calcul du Chiffre d'Affaires de la période
    const turnover = periodSales.reduce((sum, s) => sum + s.totalAmount, 0);

    // Calcul du Coût des Marchandises Vendues (CMV) sur la base du coût d'achat mémorisé
    let cogs = 0;
    for (const sale of periodSales) {
        const items = saleItems.filter(si => si.saleId === sale.id);
        for (const item of items) {
            cogs += item.quantity * (item.purchasePriceCost || 0);
        }
    }

    // Marge brute et bénéfice net simplifié
    const grossMargin = turnover - cogs;
    const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = grossMargin - totalExpenses;

    // Calcul de la valeur du stock actuel
    const activeProducts = products.filter(p => p.status === 'actif');
    const stockValue = activeProducts.reduce((sum, p) => sum + (p.quantity * p.purchasePrice), 0);
    const stockCount = activeProducts.reduce((sum, p) => sum + p.quantity, 0);

    // Créances clients et dettes fournisseurs globales (pas seulement sur la période)
    const clientOutstanding = sales.reduce((sum, s) => sum + s.balanceDue, 0);
    const supplierOutstanding = purchases.reduce((sum, p) => sum + p.balanceDue, 0);

    // Graphique 1: Évolution du CA par intervalle (jour, semaine ou mois selon période)
    const timeline = {};
    periodSales.forEach(s => {
        const dateKey = s.date.split('T')[0];
        timeline[dateKey] = (timeline[dateKey] || 0) + s.totalAmount;
    });

    const profitTimeline = {};
    periodSales.forEach(s => {
        const dateKey = s.date.split('T')[0];
        const items = saleItems.filter(si => si.saleId === s.id);
        let sCogs = items.reduce((sum, item) => sum + (item.quantity * (item.purchasePriceCost || 0)), 0);
        profitTimeline[dateKey] = (profitTimeline[dateKey] || 0) + (s.totalAmount - sCogs);
    });

    // Catégories de produits les plus vendus de la période
    const categories = db.find('categories');
    const catSales = {};
    periodSales.forEach(s => {
        const items = saleItems.filter(si => si.saleId === s.id);
        items.forEach(it => {
            const p = products.find(prod => prod.id === it.productId);
            const catId = p ? p.categoryId : 0;
            const catName = categories.find(c => c.id === catId)?.name || 'Autres';
            catSales[catName] = (catSales[catName] || 0) + it.totalPosition;
        });
    });

    // Répartition des modes de paiements
    const payments = {};
    periodSales.forEach(s => {
        if (s.paidAmount > 0) {
            payments[s.paymentMethod] = (payments[s.paymentMethod] || 0) + s.paidAmount;
        }
    });

    res.json({
        kpis: {
            turnover,
            turnoverDay: sales.filter(s => s.date.split('T')[0] === now.toISOString().split('T')[0]).reduce((sum, s) => sum + s.totalAmount, 0),
            totalPurchases: periodPurchases.reduce((sum, p) => sum + p.totalAmount, 0),
            totalExpenses,
            cogs,
            grossMargin,
            netProfit,
            stockValue,
            stockCount,
            salesCount: periodSales.length,
            clientOutstanding,
            supplierOutstanding
        },
        charts: {
            timeline,
            profitTimeline,
            categories: catSales,
            paymentMethods: payments
        }
    });
});

app.get('/api/reports/profitability', requireAuth, (req, res) => {
    const products = db.find('products');
    const saleItems = db.find('sale_items');
    const sales = db.find('sales');
    const categories = db.find('categories');

    // Agrégation ventes produits
    const productStats = {};
    products.forEach(p => {
        productStats[p.id] = {
            id: p.id,
            reference: p.reference,
            name: p.name,
            quantitySold: 0,
            turnover: 0,
            marginTotal: 0,
            currentStock: p.quantity,
            purchasePrice: p.purchasePrice,
            sellPrice: p.sellPriceActual,
            profitPct: p.sellPriceActual > 0 ? (((p.sellPriceActual - p.purchasePrice) / p.sellPriceActual) * 100) : 0
        };
    });

    saleItems.forEach(it => {
        if (productStats[it.productId]) {
            productStats[it.productId].quantitySold += it.quantity;
            productStats[it.productId].turnover += it.totalPosition;
            productStats[it.productId].marginTotal += it.totalPosition - (it.quantity * (it.purchasePriceCost || 0));
        }
    });

    const list = Object.values(productStats);

    // Top produits les plus vendus
    const topQuantity = [...list].sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 10);
    // Top produits les plus rentables
    const topProfit = [...list].sort((a, b) => b.marginTotal - a.marginTotal).slice(0, 10);
    // Produits qui dorment en stock (stock > 0 et 0 ventes sur les 30 derniers jours)
    const dormant = list.filter(p => p.currentStock > 0 && p.quantitySold === 0);

    // Catégorie la plus rentable
    const catStats = {};
    categories.forEach(c => {
        catStats[c.id] = { name: c.name, turnover: 0, margin: 0 };
    });
    catStats[0] = { name: 'Autres', turnover: 0, margin: 0 };

    saleItems.forEach(it => {
        const p = products.find(prod => prod.id === it.productId);
        const catId = p ? (p.categoryId || 0) : 0;
        if (catStats[catId]) {
            catStats[catId].turnover += it.totalPosition;
            catStats[catId].margin += it.totalPosition - (it.quantity * (it.purchasePriceCost || 0));
        }
    });
    const topCategories = Object.values(catStats).sort((a, b) => b.margin - a.margin);

    res.json({
        topQuantity,
        topProfit,
        dormant,
        topCategories
    });
});

// Servir les fichiers statiques du dossier 'public'
app.use(express.static(path.join(__dirname, '..', 'public')));

// Gérer toutes les autres requêtes HTML5
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

if (require.main === module) {
    initializeData();
    app.listen(PORT, () => {
        console.log(`Le serveur tourne sur http://localhost:${PORT}`);
    });
}

module.exports = { app, initializeData };
