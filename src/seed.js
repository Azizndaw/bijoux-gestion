const db = require('./db');
const crypto = require('crypto');

function hashPassword(password) {
    const salt = 'bijoux_salt_12345';
    return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function seed() {
    console.log("Démarrage du peuplement des données de démonstration...");

    // Réinitialiser les données mais conserver les utilisateurs s'ils existent
    const users = db.find('users');
    const settings = db.data.settings;

    db.data = {
        users: users.length > 0 ? users : [
            { id: 1, username: 'admin', password: hashPassword('admin123'), role: 'Administrateur', name: 'Propriétaire' },
            { id: 2, username: 'vendeur', password: hashPassword('vendeur123'), role: 'Vendeur', name: 'Awa Diop' },
            { id: 3, username: 'comptable', password: hashPassword('comptable123'), role: 'Comptable', name: 'Moussa Gueye' }
        ],
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
            { id: 1, name: 'Espèces', balance: 450000 },
            { id: 2, name: 'Wave', balance: 350000 },
            { id: 3, name: 'Orange Money', balance: 200000 }
        ],
        cash_movements: [],
        cash_sessions: [],
        audit_logs: [],
        goals: [
            { id: 1, year: 2026, month: 8, targetRevenue: 2000000, targetProfit: 800000 }
        ],
        settings: settings
    };

    // 1. Catégories
    const categoriesList = [
        { name: 'Bagues' },
        { name: 'Colliers' },
        { name: 'Bracelets' },
        { name: 'Boucles d\'oreilles' },
        { name: 'Montres' },
        { name: 'Parures' },
        { name: 'Accessoires' }
    ];
    const categories = categoriesList.map(c => db.insert('categories', c));

    // 2. Fournisseurs
    const suppliersList = [
        { name: 'Moussa Ndiaye', company: 'Grossiste Or Dakar', phone: '+221 77 111 22 33', email: 'moussa@grossisteor.sn', address: 'Sandaga, Dakar' },
        { name: 'Sophie Lemoine', company: 'Bijoux Chic Paris', phone: '+33 6 12 34 56 78', email: 'contact@chicparis.fr', address: 'Paris, France' },
        { name: 'Jean Zhang', company: 'Importation Dubaï Prestige', phone: '+221 76 543 21 09', email: 'jean@dubaiimport.sn', address: 'Plateau, Dakar' },
        { name: 'Alassane Kane', company: 'Artisanat du Fleuve', phone: '+221 70 999 88 77', email: 'alassane@artisanat.sn', address: 'Saint-Louis, Sénégal' },
        { name: 'Fatoumata Bâ', company: 'Atelier d\'Argent Mbour', phone: '+221 77 888 77 66', email: 'fatouba@atelierargent.sn', address: 'Mbour, Sénégal' }
    ];
    const suppliers = suppliersList.map(s => db.insert('suppliers', s));

    // 3. Clients
    const customersList = [
        { name: 'Fatou Diop', phone: '+221 77 222 33 44', email: 'fatoudiop@gmail.com', address: 'Almadies, Dakar' },
        { name: 'Seynabou Ndiaye', phone: '+221 77 333 44 55', email: 'seynabou@yahoo.fr', address: 'Mermoz, Dakar' },
        { name: 'Mariama Fall', phone: '+221 76 444 55 66', email: 'mariama.fall@outlook.com', address: 'Guédiawaye, Dakar' },
        { name: 'Aminata Diallo', phone: '+221 70 555 66 77', email: 'ami.diallo@gmail.com', address: 'Fann, Dakar' },
        { name: 'Khady Sow', phone: '+221 77 666 77 88', email: 'khadysow@gmail.com', address: 'Parcelles Assainies, Dakar' },
        { name: 'Ousmane Cissé', phone: '+221 77 777 88 99', email: 'ousmane.cisse@gmail.com', address: 'Ouakam, Dakar' },
        { name: 'Ibrahima Gueye', phone: '+221 78 888 99 00', email: 'ibra@gmail.com', address: 'Medina, Dakar' },
        { name: 'Rama Sarr', phone: '+221 76 999 00 11', email: 'rama.sarr@gmail.com', address: 'Liberté 6, Dakar' },
        { name: 'Penda Wade', phone: '+221 77 101 11 22', email: 'penda.wade@gmail.com', address: 'Ngor, Dakar' },
        { name: 'Aïcha Touré', phone: '+221 75 202 22 33', email: 'aicha@gmail.com', address: 'Pikine, Dakar' }
    ];
    const customers = customersList.map(c => db.insert('customers', c));

    // 4. Produits (30 bijoux)
    const colors = ['Doré', 'Argenté', 'Or Rose', 'Blanc', 'Noir', 'Bleu Turquoise'];
    const materials = ['Or 18k', 'Argent 925', 'Plaqué Or', 'Acier Inoxydable', 'Perles de culture'];
    const categoriesMap = {
        'Bagues': categories[0].id,
        'Colliers': categories[1].id,
        'Bracelets': categories[2].id,
        'Boucles d\'oreilles': categories[3].id,
        'Montres': categories[4].id,
        'Parures': categories[5].id,
        'Accessoires': categories[6].id
    };

    const pTemplates = [
        // Bagues
        { name: 'Bague Solitaire Éclat', category: 'Bagues', basePrice: 15000, sellPrice: 30000, mat: 'Or 18k', size: '54', color: 'Doré' },
        { name: 'Alliance Fine Ciselée', category: 'Bagues', basePrice: 12000, sellPrice: 25000, mat: 'Or 18k', size: '52', color: 'Doré' },
        { name: 'Bague Large Plumes', category: 'Bagues', basePrice: 4000, sellPrice: 10000, mat: 'Argent 925', size: '56', color: 'Argenté' },
        { name: 'Bague Ajustable Cristal', category: 'Bagues', basePrice: 2500, sellPrice: 8000, mat: 'Acier Inoxydable', size: 'Ajustable', color: 'Or Rose' },
        // Colliers
        { name: 'Collier Doré Élégance', category: 'Colliers', basePrice: 8000, sellPrice: 15000, mat: 'Plaqué Or', size: '45cm', color: 'Doré' },
        { name: 'Collier Pendentif Lune', category: 'Colliers', basePrice: 3500, sellPrice: 9000, mat: 'Argent 925', size: '40cm', color: 'Argenté' },
        { name: 'Sautoir Perles Nacre', category: 'Colliers', basePrice: 15000, sellPrice: 35000, mat: 'Perles de culture', size: '80cm', color: 'Blanc' },
        { name: 'Collier Ras de Cou Mailles', category: 'Colliers', basePrice: 6000, sellPrice: 12000, mat: 'Plaqué Or', size: '38cm', color: 'Doré' },
        // Bracelets
        { name: 'Jonc Rigide Diamanté', category: 'Bracelets', basePrice: 18000, sellPrice: 38000, mat: 'Or 18k', size: 'Standard', color: 'Doré' },
        { name: 'Bracelet Maille Royale', category: 'Bracelets', basePrice: 9000, sellPrice: 20000, mat: 'Argent 925', size: '19cm', color: 'Argenté' },
        { name: 'Semainier Doré (7 pièces)', category: 'Bracelets', basePrice: 10000, sellPrice: 22000, mat: 'Plaqué Or', size: '65mm', color: 'Doré' },
        { name: 'Bracelet Perles Turquoise', category: 'Bracelets', basePrice: 3000, sellPrice: 8000, mat: 'Acier Inoxydable', size: 'Ajustable', color: 'Bleu Turquoise' },
        // Boucles d'oreilles
        { name: 'Créoles Torsadées Moyennes', category: 'Boucles d\'oreilles', basePrice: 5000, sellPrice: 12000, mat: 'Plaqué Or', size: '30mm', color: 'Doré' },
        { name: 'Puces d\'Oreilles Trèfle', category: 'Boucles d\'oreilles', basePrice: 3000, sellPrice: 8000, mat: 'Argent 925', size: '8mm', color: 'Or Rose' },
        { name: 'Pendantes Filigranées', category: 'Boucles d\'oreilles', basePrice: 7000, sellPrice: 18000, mat: 'Plaqué Or', size: '50mm', color: 'Doré' },
        { name: 'Boucles d\'oreilles Coeur Miroir', category: 'Boucles d\'oreilles', basePrice: 2000, sellPrice: 6000, mat: 'Acier Inoxydable', size: '12mm', color: 'Doré' },
        // Montres
        { name: 'Montre Quartz Boîtier Doré', category: 'Montres', basePrice: 25000, sellPrice: 55000, mat: 'Acier Inoxydable', size: '36mm', color: 'Doré' },
        { name: 'Montre Chrono Cadran Noir', category: 'Montres', basePrice: 30000, sellPrice: 75000, mat: 'Acier Inoxydable', size: '40mm', color: 'Noir' },
        { name: 'Montre Fine Mailles Or Rose', category: 'Montres', basePrice: 22000, sellPrice: 48000, mat: 'Acier Inoxydable', size: '28mm', color: 'Or Rose' },
        // Parures
        { name: 'Parure Mariage Impériale', category: 'Parures', basePrice: 75000, sellPrice: 150000, mat: 'Or 18k', size: 'Standard', color: 'Doré' },
        { name: 'Parure Perles & Zirconium', category: 'Parures', basePrice: 40000, sellPrice: 90000, mat: 'Argent 925', size: 'Standard', color: 'Argenté' },
        { name: 'Demi-Parure Chaîne & Créoles', category: 'Parures', basePrice: 12000, sellPrice: 28000, mat: 'Plaqué Or', size: 'Standard', color: 'Doré' },
        // Accessoires + Autres
        { name: 'Écrin Velours Luxe Rouge', category: 'Accessoires', basePrice: 800, sellPrice: 2500, mat: 'Velours', size: 'Moyenne', color: 'Rouge' },
        { name: 'Porte-Bijoux Arbre Doré', category: 'Accessoires', basePrice: 2500, sellPrice: 6500, mat: 'Métal', size: 'Grand', color: 'Doré' },
        { name: 'Liquide Nettoyant Bijoux', category: 'Accessoires', basePrice: 1000, sellPrice: 3500, mat: 'Chimique', size: '150ml', color: 'Blanc' },
        { name: 'Bague Gourmette Homme', category: 'Bagues', basePrice: 4000, sellPrice: 12000, mat: 'Acier Inoxydable', size: '62', color: 'Argenté' },
        { name: 'Chaîne de Cheville Coquillage', category: 'Bracelets', basePrice: 2000, sellPrice: 5000, mat: 'Acier Inoxydable', size: '25cm', color: 'Doré' },
        { name: 'Bague Duo Royale', category: 'Bagues', basePrice: 18000, sellPrice: 40000, mat: 'Or 18k', size: '54', color: 'Doré' },
        { name: 'Collier Serpent Flach', category: 'Colliers', basePrice: 5000, sellPrice: 12000, mat: 'Acier Inoxydable', size: '42cm', color: 'Argenté' },
        { name: 'Boucles Créoles Plates', category: 'Boucles d\'oreilles', basePrice: 3000, sellPrice: 8000, mat: 'Acier Inoxydable', size: '40mm', color: 'Doré' }
    ];

    const products = [];
    pTemplates.forEach((t, i) => {
        // Aléatoire quantitée en stock (de 2 à 15, stock min = 3)
        const quantity = Math.floor(Math.random() * 12) + 3;
        const prod = db.insert('products', {
            reference: 'BJ-' + String(i + 1).padStart(5, '0'),
            name: t.name,
            categoryId: categoriesMap[t.category],
            description: `Magnifique bijou en ${t.mat} de couleur ${t.color}. Idéal pour sublimer votre style.`,
            photo: '',
            supplierId: suppliers[i % suppliers.length].id,
            purchasePrice: t.basePrice,
            sellPriceRecommended: t.sellPrice,
            sellPriceActual: t.sellPrice,
            quantity: quantity,
            minStock: 3,
            material: t.mat,
            color: t.color,
            size: t.size,
            brand: i % 3 === 0 ? 'Boutique Collection' : 'Importation Prestige',
            dateAdded: new Date(Date.now() - (60 - i) * 24 * 60 * 60 * 1000).toISOString(),
            status: 'actif'
        });

        // Mouvement de stock de départ
        db.insert('stock_movements', {
            productId: prod.id,
            type: 'entrée',
            reason: 'inventaire',
            quantity: quantity,
            date: prod.dateAdded,
            notes: 'Peuplement du stock initial',
            userId: 1
        });

        products.push(prod);
    });

    // 5. Enregistrer des Achats fournisseurs (20 achats sur les 2 derniers mois)
    const paymentMethods = ['Espèces', 'Wave', 'Orange Money'];
    for (let i = 0; i < 20; i++) {
        const supplier = suppliers[i % suppliers.length];
        const daysAgo = 55 - i * 2;
        const aDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

        // Sélectionner 1 à 3 produits achetés
        const numItems = Math.floor(Math.random() * 3) + 1;
        const purchaseItems = [];
        let subtotal = 0;

        for (let k = 0; k < numItems; k++) {
            const pIdx = (i * 2 + k) % products.length;
            const p = products[pIdx];
            const qty = Math.floor(Math.random() * 5) + 2;
            const uPrice = p.purchasePrice;
            const totalPos = qty * uPrice;
            subtotal += totalPos;

            purchaseItems.push({
                productId: p.id,
                quantity: qty,
                unitPrice: uPrice,
                totalPosition: totalPos
            });
        }

        const orderNum = 'ACH-' + String(i + 1).padStart(5, '0');
        // Paiement total ou partiel
        // Les premiers achats sont payés, les plus récents peuvent être à crédit
        const isUnpaid = i >= 17;
        const isPartial = i === 15 || i === 16;
        let paidAmount = subtotal;
        if (isUnpaid) paidAmount = 0;
        else if (isPartial) paidAmount = Math.floor(subtotal / 3);

        const balanceDue = subtotal - paidAmount;
        let status = 'payé';
        if (balanceDue > 0) {
            status = paidAmount > 0 ? 'partiellement payé' : 'impayé';
        }

        const pMethod = isUnpaid ? '' : paymentMethods[i % paymentMethods.length];

        const purchase = db.insert('purchases', {
            orderNumber: orderNum,
            date: aDate,
            supplierId: supplier.id,
            taxAdditionalCost: 0,
            discount: 0,
            totalAmount: subtotal,
            paidAmount,
            balanceDue,
            paymentMethod: pMethod,
            status
        });

        // Enregistrer purchase_items et stock entries
        purchaseItems.forEach(item => {
            db.insert('purchase_items', {
                purchaseId: purchase.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPosition: item.totalPosition
            });

            // Mettre à jour le stock actuel
            const p = products.find(prod => prod.id === item.productId);
            db.update('products', p.id, { quantity: p.quantity + item.quantity });

            db.insert('stock_movements', {
                productId: item.productId,
                type: 'entrée',
                reason: 'achat fournisseurs',
                quantity: item.quantity,
                date: aDate,
                notes: `Achat stock réf ${orderNum}`,
                userId: 1
            });
        });

        // Enregistrer cash out si payé
        if (paidAmount > 0) {
            const pmMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3 };
            const accId = pmMap[pMethod] || 1;

            db.insert('payments', {
                type: 'purchase',
                referenceId: purchase.id,
                supplierId: supplier.id,
                amount: paidAmount,
                paymentMethod: pMethod,
                date: aDate,
                notes: `Acompte achat ${orderNum}`
            });

            db.insert('cash_movements', {
                date: aDate,
                accountId: accId,
                type: 'out',
                amount: paidAmount,
                reason: 'achat_fournisseur',
                referenceId: purchase.id
            });
        }
    }

    // 6. Enregistrer des Ventes clients (50 ventes sur les 30 derniers jours)
    // Utiliser une distribution temporelle réaliste
    const salesPaymentMethods = ['Espèces', 'Wave', 'Orange Money'];
    for (let i = 0; i < 50; i++) {
        const customer = customers[i % customers.length];
        // Du jour 30 jusqu'à aujourd'hui
        const daysAgo = 30 - Math.floor(i * 30 / 50);
        const sDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 12) * 60 * 60 * 1000).toISOString();

        // Sélectionner 1 ou 2 produits
        const numItems = Math.floor(Math.random() * 2) + 1;
        const saleItems = [];
        let subtotal = 0;
        let totalCogs = 0;

        for (let k = 0; k < numItems; k++) {
            const pIdx = (i * 3 + k) % products.length;
            const p = products[pIdx];
            const qty = Math.floor(Math.random() * 2) + 1;
            const uPrice = p.sellPriceActual;
            const totalPos = qty * uPrice;
            subtotal += totalPos;
            totalCogs += qty * p.purchasePrice;

            saleItems.push({
                productId: p.id,
                quantity: qty,
                unitPrice: uPrice,
                totalPosition: totalPos,
                purchasePriceCost: p.purchasePrice
            });
        }

        // Gérer les paiements et crédits
        // Plus la date d'achat est récente, plus il y a de chances de crédits actifs
        const isCredit = i >= 42; // Les dernières ventes ont des crédits
        const isPartial = i === 40 || i === 41;

        let paidAmount = subtotal;
        if (isCredit) paidAmount = Math.floor(subtotal * 0.3); // acompte de 30%
        else if (isPartial) paidAmount = Math.floor(subtotal * 0.5);

        const balanceDue = subtotal - paidAmount;
        let status = 'payé';
        if (balanceDue > 0) {
            status = paidAmount > 0 ? 'partiellement payé' : 'impayé';
        }

        const pMethod = salesPaymentMethods[i % salesPaymentMethods.length];
        const receiptNum = 'VTE-' + String(i + 1).padStart(6, '0');

        const sale = db.insert('sales', {
            receiptNumber: receiptNum,
            date: sDate,
            customerId: customer.id,
            discount: 0,
            subtotal,
            totalAmount: subtotal,
            paidAmount,
            balanceDue,
            paymentMethod: pMethod,
            dueDate: balanceDue > 0 ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
            status,
            userId: 2 // Enregistré par la vendeuse Awa Diop
        });

        // Enregistrer sItems et stock deductions
        saleItems.forEach(item => {
            db.insert('sale_items', {
                saleId: sale.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPosition: item.totalPosition,
                purchasePriceCost: item.purchasePriceCost
            });

            // Retrait stock
            const p = products.find(prod => prod.id === item.productId);
            db.update('products', p.id, { quantity: Math.max(0, p.quantity - item.quantity) });

            db.insert('stock_movements', {
                productId: item.productId,
                type: 'sortie',
                reason: 'vente',
                quantity: item.quantity,
                date: sDate,
                notes: `Facturation client ${receiptNum}`,
                userId: 2
            });
        });

        // Enregistrer encaissement s'il y a lieu
        if (paidAmount > 0) {
            const pmMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3 };
            const accId = pmMap[pMethod] || 1;

            db.insert('payments', {
                type: 'sale',
                referenceId: sale.id,
                customerId: customer.id,
                amount: paidAmount,
                paymentMethod: pMethod,
                date: sDate,
                notes: `Acompte vente ${receiptNum}`
            });

            db.insert('cash_movements', {
                date: sDate,
                accountId: accId,
                type: 'in',
                amount: paidAmount,
                reason: 'vente_bijou',
                referenceId: sale.id
            });
        }
    }

    // 7. Enregistrer des Dépenses (15 dépenses sur 30 jours)
    const expenseCats = ['Transport', 'Livraison', 'Emballage', 'Publicité', 'Loyer', 'Électricité', 'Internet', 'Téléphone', 'Frais Wave', 'Autres'];
    const expensesList = [
        { cat: 'Loyer', desc: 'Loyer local boutique août 2026', amt: 120000, pm: 'Wave', day: 25 },
        { cat: 'Électricité', desc: 'Facture Woyofal boutique', amt: 25000, pm: 'Orange Money', day: 22 },
        { cat: 'Transport', desc: 'Livraison taxi bijoux chez fournisseur', amt: 5000, pm: 'Espèces', day: 20 },
        { cat: 'Livraison', desc: 'Frais de livraison de bijoux clients dakar', amt: 12000, pm: 'Espèces', day: 18 },
        { cat: 'Emballage', desc: 'Achat de 100 coffrets bijoux et rubans', amt: 35000, pm: 'Wave', day: 15 },
        { cat: 'Publicité', desc: 'Campagne sponsorisée Instagram/TikTok', amt: 30000, pm: 'Orange Money', day: 12 },
        { cat: 'Internet', desc: 'Abonnement box internet boutique', amt: 15000, pm: 'Wave', day: 8 },
        { cat: 'Téléphone', desc: 'Crédit communication Awa Diop', amt: 5000, pm: 'Orange Money', day: 7 },
        { cat: 'Autres', desc: 'Achat thé et boissons pour clients', amt: 7000, pm: 'Espèces', day: 5 },
        { cat: 'Transport', desc: 'Transport Sandaga', amt: 3000, pm: 'Espèces', day: 4 },
        { cat: 'Livraison', desc: 'Service de coursier DHL', amt: 18000, pm: 'Wave', day: 3 },
        { cat: 'Frais Wave', desc: 'Frais sur retraits cash Wave', amt: 2200, pm: 'Wave', day: 2 },
        { cat: 'Emballage', desc: 'Sachets plastiques personnalisés', amt: 15000, pm: 'Wave', day: 2 },
        { cat: 'Publicité', desc: 'Flyers promotionnels', amt: 20000, pm: 'Espèces', day: 1 },
        { cat: 'Autres', desc: 'Réparation ampoule boutique', amt: 2000, pm: 'Espèces', day: 1 }
    ];

    expensesList.forEach((e, idx) => {
        const eDate = new Date(Date.now() - e.day * 24 * 60 * 60 * 1000).toISOString();
        const exp = db.insert('expenses', {
            date: eDate,
            category: e.cat,
            description: e.desc,
            amount: e.amt,
            paymentMethod: e.pm
        });

        const pmMap = { 'Espèces': 1, 'Wave': 2, 'Orange Money': 3 };
        const accId = pmMap[e.pm] || 1;

        db.insert('cash_movements', {
            date: eDate,
            accountId: accId,
            type: 'out',
            amount: e.amt,
            reason: 'depense_frais_' + e.cat.toLowerCase().replace(/\s+/g, '_'),
            referenceId: exp.id
        });
    });

    // 8. Sessions de caisse
    // Créer une session clôturée d'hier et une session ouverte d'aujourd'hui
    db.insert('cash_sessions', {
        id: 1,
        openedBy: 'Awa Diop',
        openedById: 2,
        openedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        closedAt: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
        initialBalance: 50000,
        finalBalanceTheoretical: 85000,
        finalBalanceReal: 85000,
        variance: 0,
        justification: '',
        status: 'closed'
    });

    db.insert('cash_sessions', {
        id: 2,
        openedBy: 'Awa Diop',
        openedById: 2,
        openedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        closedAt: null,
        initialBalance: 85000,
        finalBalanceTheoretical: 120000,
        finalBalanceReal: 0,
        variance: 0,
        justification: '',
        status: 'open'
    });

    // Mettre à jour les réels soldes après toutes ces opérations simulées
    // Calculer la balance finale pour chaque mode de paiement
    const pmMapInverse = { 1: 'Espèces', 2: 'Wave', 3: 'Orange Money' };
    for (let accId = 1; accId <= 3; accId++) {
        const movements = db.find('cash_movements', m => m.accountId === accId);
        let bal = 0;
        movements.forEach(m => {
            if (m.type === 'in') bal += m.amount;
            else if (m.type === 'out') bal -= m.amount;
        });
        // On ajoute un fond de roulement de départ si le solde calculé est bas
        const baseFund = accId === 1 ? 100000 : 150000;
        db.update('cash_accounts', accId, { balance: Math.max(50000, bal + baseFund) });
    }

    // Sauvegarder
    db.save();
    console.log("Données de démonstration peuplées avec succès !");
}

seed();
