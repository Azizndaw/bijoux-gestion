/**
 * COORDINATEUR PRINCIPAL — LOGIQUE D'APPLICATION (FRONTEND)
 */
window.appState = {
    user: null,
    settings: {},
    products: [],
    categories: [],
    customers: [],
    suppliers: [],
    caisseSession: null,
    treasury: { accounts: [], movements: [] },
    cart: [],
    activePosCategory: null
};

window.app = {
    // 1. Démarrage
    async init() {
        this.bindGlobalEvents();
        await this.checkAuth();
    },

    // 2. Vérification Auth
    async checkAuth() {
        try {
            const { user } = await API.getMe();
            if (user) {
                window.appState.user = user;
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('main-app').style.display = 'flex';

                // Mettre à jour l'en-tête utilisateur dans la sidebar
                document.getElementById('current-user-name').textContent = user.name;
                document.getElementById('current-user-role').textContent = user.role;

                await this.loadAllData();
                this.setupRouting();
                window.Router.init();
                window.Router.executeRouting();
            } else {
                this.showLogin();
            }
        } catch (err) {
            console.error(err);
            this.showLogin();
        }
    },

    showLogin() {
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('auth-container').style.display = 'flex';
    },

    // 3. Charger le cache local de données
    async loadAllData() {
        try {
            const [settings, products, categories, customers, suppliers, caisse, treasury] = await Promise.all([
                API.getSettings(),
                API.getProducts(),
                API.getCategories(),
                API.getCustomers(),
                API.getSuppliers(),
                API.getCaisseSession(),
                API.getTreasury()
            ]);

            window.appState.settings = settings;
            window.appState.products = products;
            window.appState.categories = categories;
            window.appState.customers = customers;
            window.appState.suppliers = suppliers;
            window.appState.caisseSession = caisse.session;
            window.appState.treasury = treasury;

            this.updateNavbarBadges();
        } catch (err) {
            console.error("Erreur de pré-chargement des données:", err);
        }
    },

    // 4. Configuration du Routeur SPA
    setupRouting() {
        // Rôles simplifiés
        const allRoles = ['Administrateur', 'Vendeur', 'Comptable'];
        const adminComptable = ['Administrateur', 'Comptable'];
        const adminOnly = ['Administrateur'];

        window.Router.onBeforeRoute = async (hash) => {
            // S'assurer que les données soient un minimum fraîches
            if (window.appState.user) {
                await this.loadAllData();
            }
            return true;
        };

        window.Router.route('dashboard', null, async (container) => {
            const period = document.getElementById('dashboard-filter')?.value || 'ce_mois';
            const data = await API.getDashboardReports(period);
            Components.Dashboard(container, data);

            // Injecter le selecteur de période dynamiquement dans le header si absent
            let header = container.querySelector('.page-header');
            let filterDiv = document.createElement('div');
            filterDiv.className = 'filter-group';
            filterDiv.innerHTML = `
        <label class="filter-label">Période :</label>
        <select class="filter-select" id="dashboard-filter" onchange="window.app.reloadDashboard(this.value)">
          <option value="ce_jour" ${period === 'ce_jour' ? 'selected' : ''}>Aujourd'hui</option>
          <option value="cette_semaine" ${period === 'cette_semaine' ? 'selected' : ''}>Cette semaine</option>
          <option value="ce_mois" ${period === 'ce_mois' ? 'selected' : ''}>Ce mois-ci</option>
          <option value="ce_trimestre" ${period === 'ce_trimestre' ? 'selected' : ''}>Ce trimestre</option>
          <option value="cette_annee" ${period === 'cette_annee' ? 'selected' : ''}>Cette année</option>
        </select>
      `;
            header.appendChild(filterDiv);
        });

        window.Router.route('pos', allRoles, (container) => {
            Components.POS(container, window.appState.products, window.appState.categories, window.appState.cart, window.appState.activePosCategory);
            this.togglePosCreditField();
        });

        window.Router.route('sales', allRoles, async (container) => {
            const sales = await API.getSales();
            Components.SalesList(container, sales, window.appState.customers);
        });

        window.Router.route('purchases', adminComptable, async (container) => {
            const purchases = await API.getPurchases();
            Components.PurchasesList(container, purchases, window.appState.suppliers);
        });

        window.Router.route('stock', allRoles, (container) => {
            Components.ProductList(container, window.appState.products, window.appState.categories, window.appState.suppliers);

            // Rajouter l'historique des mouvements de stock en bas de page
            let movementsContainer = document.createElement('div');
            movementsContainer.id = 'stock-movements-section';
            container.appendChild(movementsContainer);
            this.loadStockMovementsView(movementsContainer);
        });

        window.Router.route('customers', allRoles, (container) => {
            Components.CustomersList(container, window.appState.customers);
        });

        window.Router.route('suppliers', adminComptable, (container) => {
            Components.SuppliersList(container, window.appState.suppliers);
        });

        window.Router.route('expenses', adminComptable, async (container) => {
            const exp = await API.getExpenses();
            Components.ExpensesList(container, exp);
        });

        window.Router.route('treasury', adminComptable, (container) => {
            Components.Treasury(container, window.appState.treasury);

            // Injecter le volet du contrôle de caisse
            this.loadCaisseControlView(container);
        });

        window.Router.route('reports', adminComptable, async (container) => {
            // Rendu des rapports financiers et produits les plus rentables
            const prof = await API.getProfitabilityReports();
            const dbReport = await API.getDashboardReports('ce_mois');
            this.renderReportsView(container, prof, dbReport);
        });

        window.Router.route('audit', adminComptable, async (container) => {
            const logs = await API.getAuditLogs();
            Components.AuditLogs(container, logs);
        });

        window.Router.route('settings', adminOnly, (container) => {
            Components.Settings(container, window.appState.settings);

            // Bind submit paramètres
            const form = document.getElementById('settings-form-element');
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const body = {
                    shop_name: document.getElementById('set-shop').value,
                    phone: document.getElementById('set-phone').value,
                    email: document.getElementById('set-email').value,
                    address: document.getElementById('set-address').value,
                    wave_number: document.getElementById('set-wave').value,
                    om_number: document.getElementById('set-om').value,
                    bank_account: document.getElementById('set-bank').value,
                    receipt_message: document.getElementById('set-msg').value,
                    sale_terms: document.getElementById('set-terms').value
                };
                try {
                    const updated = await API.updateSettings(body);
                    window.appState.settings = updated;
                    alert("Paramètres de la boutique enregistrés avec succès !");
                    window.Router.executeRouting();
                } catch (err) {
                    alert("Erreur: " + err.message);
                }
            });
        });
    },

    // Recharger le dashboard après filtrage
    async reloadDashboard(period) {
        const container = document.getElementById('content-area');
        const data = await API.getDashboardReports(period);
        Components.Dashboard(container, data);

        // Remettre le header
        let header = container.querySelector('.page-header');
        let filterDiv = document.createElement('div');
        filterDiv.className = 'filter-group';
        filterDiv.innerHTML = `
      <label class="filter-label">Période :</label>
      <select class="filter-select" id="dashboard-filter" onchange="window.app.reloadDashboard(this.value)">
        <option value="ce_jour" ${period === 'ce_jour' ? 'selected' : ''}>Aujourd'hui</option>
        <option value="cette_semaine" ${period === 'cette_semaine' ? 'selected' : ''}>Cette semaine</option>
        <option value="ce_mois" ${period === 'ce_mois' ? 'selected' : ''}>Ce mois-ci</option>
        <option value="ce_trimestre" ${period === 'ce_trimestre' ? 'selected' : ''}>Ce trimestre</option>
        <option value="cette_annee" ${period === 'cette_annee' ? 'selected' : ''}>Cette année</option>
      </select>
    `;
        header.appendChild(filterDiv);
    },

    // 5. Gestion et liaison d'événements DOM généraux
    bindGlobalEvents() {
        // Connexion
        document.getElementById('btn-login-submit').addEventListener('click', async () => {
            const u = document.getElementById('login-username').value;
            const p = document.getElementById('login-password').value;
            const errMsg = document.getElementById('login-error-msg');
            errMsg.style.display = 'none';

            try {
                await API.login(u, p);
                await this.checkAuth();
            } catch (err) {
                errMsg.textContent = err.message;
                errMsg.style.display = 'block';
            }
        });

        // Déconnexion
        document.getElementById('btn-logout-sidebar').addEventListener('click', async () => {
            if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
                await API.logout();
                window.appState.user = null;
                this.showLogin();
            }
        });

        // Fermeture des modaux
        document.querySelectorAll('.btn-close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.remove('active');
            });
        });

        // Gestion du menu mobile
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar');
        const sidebarBackdrop = document.getElementById('sidebar-backdrop');
        if (mobileMenuToggle && sidebar && sidebarBackdrop) {
            const toggleSidebar = () => {
                sidebar.classList.toggle('active');
                sidebarBackdrop.classList.toggle('active');
            };
            mobileMenuToggle.addEventListener('click', toggleSidebar);
            sidebarBackdrop.addEventListener('click', toggleSidebar);

            // Fermer le menu lors du clic sur une option de navigation
            sidebar.querySelectorAll('.menu-item').forEach(link => {
                link.addEventListener('click', () => {
                    sidebar.classList.remove('active');
                    sidebarBackdrop.classList.remove('active');
                });
            });
        }

        // Boutons d'accès rapide en haut de l'écran
        document.getElementById('quick-sale-btn').addEventListener('click', () => {
            window.Router.navigate('pos');
        });

        document.getElementById('quick-expense-btn').addEventListener('click', () => {
            this.openExpenseModal();
        });

        // Soumission du produit (création)
        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                name: document.getElementById('prod-name').value,
                categoryId: parseInt(document.getElementById('prod-category').value),
                material: document.getElementById('prod-material').value,
                color: document.getElementById('prod-color').value,
                size: document.getElementById('prod-size').value,
                brand: document.getElementById('prod-brand').value,
                purchasePrice: parseFloat(document.getElementById('prod-p_price').value),
                sellPriceActual: parseFloat(document.getElementById('prod-s_price').value),
                quantity: parseInt(document.getElementById('prod-qty').value) || 0,
                minStock: parseInt(document.getElementById('prod-min_stock').value) || 3,
                supplierId: parseInt(document.getElementById('prod-supplier').value) || null,
                status: document.getElementById('prod-status').value
            };

            const pId = document.getElementById('product-id').value;
            try {
                if (pId) {
                    await API.updateProduct(pId, body);
                } else {
                    await API.createProduct(body);
                }
                document.getElementById('modal-product').classList.remove('active');
                await this.loadAllData();
                window.Router.navigate('stock');
            } catch (err) {
                alert("Erreur lors de l'enregistrement : " + err.message);
            }
        });

        // Formulaire de dépense (création)
        document.getElementById('expense-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                category: document.getElementById('exp-cat').value,
                amount: parseFloat(document.getElementById('exp-amount').value),
                paymentMethod: document.getElementById('exp-method').value,
                date: document.getElementById('exp-date').value || new Date().toISOString(),
                description: document.getElementById('exp-desc').value
            };

            try {
                await API.createExpense(body);
                document.getElementById('modal-expense').classList.remove('active');
                await this.loadAllData();
                window.Router.executeRouting();
            } catch (err) {
                alert("Erreur lors de l'enregistrement de la dépense: " + err.message);
            }
        });

        // Formulaire client / fournisseur (création)
        document.getElementById('people-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('people-type').value;
            const body = {
                name: document.getElementById('people-name').value,
                company: document.getElementById('people-company').value,
                phone: document.getElementById('people-phone').value,
                email: document.getElementById('people-email').value,
                address: document.getElementById('people-address').value
            };

            try {
                if (type === 'customer') {
                    await API.createCustomer(body);
                    document.getElementById('modal-people').classList.remove('active');
                    await this.loadAllData();
                    window.Router.navigate('customers');
                } else {
                    await API.createSupplier(body);
                    document.getElementById('modal-people').classList.remove('active');
                    await this.loadAllData();
                    window.Router.navigate('suppliers');
                }
            } catch (err) {
                alert("Erreur lors de la création : " + err.message);
            }
        });

        // Panier achat fournisseurs : Action d'ajout d'article temporaire
        document.getElementById('btn-purch-add-item').addEventListener('click', () => {
            const select = document.getElementById('purch-add-prod');
            const prodId = parseInt(select.value);
            const qty = parseInt(document.getElementById('purch-add-qty').value);
            const price = parseFloat(document.getElementById('purch-add-price').value);

            if (!prodId || qty <= 0 || isNaN(price)) {
                alert("Sélectionnez un bijou, indiquez une quantité et un prix d'achat valide.");
                return;
            }

            const p = window.appState.products.find(prod => prod.id === prodId);

            // Ajouter au panier temporaire d'achat
            if (!this.purchaseCart) this.purchaseCart = [];
            const existing = this.purchaseCart.find(it => it.productId === prodId);
            if (existing) {
                existing.quantity += qty;
                existing.unitPrice = price;
            } else {
                this.purchaseCart.push({
                    productId: prodId,
                    name: p.name,
                    quantity: qty,
                    unitPrice: price
                });
            }

            this.renderPurchaseCart();
        });

        // Formulaire achat fournisseurs : Soumission bon d'achat entier
        document.getElementById('purchase-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.purchaseCart || this.purchaseCart.length === 0) {
                alert("Le panier d'achat est vide.");
                return;
            }

            const body = {
                supplierId: parseInt(document.getElementById('purch-supplier').value),
                date: document.getElementById('purch-date').value || new Date().toISOString(),
                paidAmount: parseFloat(document.getElementById('purch-paid').value) || 0,
                paymentMethod: document.getElementById('purch-method').value,
                items: this.purchaseCart
            };

            try {
                await API.createPurchase(body);
                document.getElementById('modal-purchase-add').classList.remove('active');
                this.purchaseCart = [];
                await this.loadAllData();
                window.Router.navigate('purchases');
            } catch (err) {
                alert("Erreur lors de l'enregistrement de l'achat : " + err.message);
            }
        });

        // Caisse session : Soumission ouverture/clôture
        document.getElementById('caisse-action-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('caisse-action-type').value;

            try {
                if (type === 'open') {
                    const initBal = parseFloat(document.getElementById('caisse-initial-bal').value);
                    await API.openCaisse(initBal);
                } else {
                    const realBal = parseFloat(document.getElementById('caisse-real-bal').value);
                    const justification = document.getElementById('caisse-justification').value;
                    await API.closeCaisse(realBal, justification);
                }

                document.getElementById('modal-caisse-action').classList.remove('active');
                await this.loadAllData();
                window.Router.executeRouting();
            } catch (err) {
                alert("Erreur de session de caisse: " + err.message);
            }
        });

        // Saisir un règlement (versement dette/créance client)
        document.getElementById('payment-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const type = document.getElementById('pmt-type').value;
            const refId = parseInt(document.getElementById('pmt-ref-id').value);
            const amount = parseFloat(document.getElementById('pmt-amount').value);
            const method = document.getElementById('pmt-method').value;
            const date = document.getElementById('pmt-date').value || new Date().toISOString();

            try {
                if (type === 'sale') {
                    await API.payCustomerDebt(refId, amount, method, date);
                    alert("Encaissement enregistré avec succès.");
                    document.getElementById('modal-payment-add').classList.remove('active');
                    await this.loadAllData();
                    window.Router.navigate('sales');
                } else {
                    await API.payPurchaseDebt(refId, amount, method, date);
                    alert("Décaissment pour dette fournisseur validé.");
                    document.getElementById('modal-payment-add').classList.remove('active');
                    await this.loadAllData();
                    window.Router.navigate('purchases');
                }
            } catch (err) {
                alert("Règlement échoué: " + err.message);
            }
        });

        // Ajustement de stock manuel
        document.getElementById('stock-adjust-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                productId: parseInt(document.getElementById('adjust-prod-id').value),
                type: document.getElementById('adjust-type').value,
                quantity: parseInt(document.getElementById('adjust-qty').value),
                reason: document.getElementById('adjust-reason').value,
                notes: document.getElementById('adjust-notes').value
            };

            try {
                await API.adjustStock(body);
                alert("Ajustement de stock enregistré.");
                document.getElementById('modal-stock-adjust').classList.remove('active');
                await this.loadAllData();
                window.Router.navigate('stock');
            } catch (err) {
                alert("Erreur: " + err.message);
            }
        });

        // Recherche Globale dynamique
        const searchInput = document.getElementById('global-search');
        const searchDropdown = document.getElementById('search-results');

        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase().trim();
            if (q.length < 2) {
                searchDropdown.style.display = 'none';
                return;
            }

            let resultsHtml = '';

            // 1. Produits
            const matchesProd = window.appState.products.filter(p => p.name.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q) || p.material.toLowerCase().includes(q));
            if (matchesProd.length > 0) {
                resultsHtml += '<div class="search-result-group">Bijoux</div>';
                matchesProd.slice(0, 5).forEach(p => {
                    resultsHtml += `<div class="search-result-item" onclick="window.app.routeToMatch('stock')"><span>${p.reference} — ${p.name}</span> <small style="color:var(--primary-dark); font-weight:600;">${p.quantity} en stock</small></div>`;
                });
            }

            // 2. Clients
            const matchesCust = window.appState.customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
            if (matchesCust.length > 0) {
                resultsHtml += '<div class="search-result-group">Clients</div>';
                matchesCust.slice(0, 5).forEach(c => {
                    resultsHtml += `<div class="search-result-item" onclick="window.app.routeToMatch('customers')"><span>${c.name}</span> <small>${c.phone}</small></div>`;
                });
            }

            // 3. Ventes
            const matchesSales = (window.appState.sales || []).filter(s => s.receiptNumber.toLowerCase().includes(q));
            if (matchesSales.length > 0) {
                resultsHtml += '<div class="search-result-group">Ventes</div>';
                matchesSales.slice(0, 5).forEach(s => {
                    resultsHtml += `<div class="search-result-item" onclick="window.app.viewReceipt(${s.id})"><span>Reçu ${s.receiptNumber}</span> <small>${Components.formatFCFA(s.totalAmount)}</small></div>`;
                });
            }

            if (resultsHtml) {
                searchDropdown.innerHTML = resultsHtml;
                searchDropdown.style.display = 'block';
            } else {
                searchDropdown.innerHTML = '<div style="padding:12px; font-size:12px; color:var(--text-muted); text-align:center;">Aucun résultat</div>';
                searchDropdown.style.display = 'block';
            }
        });

        // Clic en dehors pour fermer la recherche globale
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
                searchDropdown.style.display = 'none';
            }
        });

        // Alertes cloche
        const bellIcon = document.getElementById('bell-icon');
        const bellPanel = document.getElementById('bell-panel');

        bellIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const d = bellPanel.style.display;
            bellPanel.style.display = (d === 'block' ? 'none' : 'block');
        });

        document.getElementById('btn-close-bell').addEventListener('click', () => {
            bellPanel.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
            if (!bellIcon.contains(e.target) && !bellPanel.contains(e.target)) {
                bellPanel.style.display = 'none';
            }
        });
    },

    routeToMatch(page) {
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('global-search').value = '';
        window.Router.navigate(page);
    },

    // 6. Chargement des notifications alertes
    async updateNavbarBadges() {
        try {
            const alerts = await API.getNotifications();
            const badge = document.getElementById('bell-badge');
            const list = document.getElementById('bell-list');

            if (alerts.length > 0) {
                badge.textContent = alerts.length;
                badge.style.display = 'block';

                let listHtml = '';
                alerts.forEach(a => {
                    let classType = a.type || 'warning';
                    if (classType.includes('trend')) classType = 'info';
                    if (classType.includes('debt')) classType = 'warning';

                    listHtml += `
            <div class="notification-item ${classType}">
              <div>${a.message}</div>
            </div>
          `;
                });
                list.innerHTML = listHtml;
            } else {
                badge.style.display = 'none';
                list.innerHTML = '<div class="notification-empty">Aucune alerte active</div>';
            }
        } catch (err) {
            console.error(err);
        }
    },

    // Modals Product
    openProductModal() {
        document.getElementById('product-id').value = '';
        document.getElementById('product-form').reset();
        document.getElementById('prod-qty').disabled = false;
        document.getElementById('product-modal-title').textContent = 'Ajouter un nouveau bijou';

        // Charger sélections fournisseurs et catégories
        this.populateProductSelects();
        document.getElementById('modal-product').classList.add('active');
    },

    openEditProductModal(productId) {
        const p = window.appState.products.find(prod => prod.id === productId);
        if (!p) return;

        this.populateProductSelects();

        document.getElementById('product-id').value = p.id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-category').value = p.categoryId || '';
        document.getElementById('prod-material').value = p.material;
        document.getElementById('prod-color').value = p.color;
        document.getElementById('prod-size').value = p.size;
        document.getElementById('prod-brand').value = p.brand;
        document.getElementById('prod-p_price').value = p.purchasePrice;
        document.getElementById('prod-s_price').value = p.sellPriceActual;
        document.getElementById('prod-qty').value = p.quantity;
        document.getElementById('prod-qty').disabled = true; // Empêcher modification directe (doit passer par ajustement)
        document.getElementById('prod-min_stock').value = p.minStock;
        document.getElementById('prod-supplier').value = p.supplierId || '';
        document.getElementById('prod-status').value = p.status;
        document.getElementById('prod-desc').value = p.description;

        document.getElementById('product-modal-title').textContent = 'Modifier ' + p.name;
        document.getElementById('modal-product').classList.add('active');
    },

    async deleteProduct(productId) {
        if (confirm("Voulez-vous vraiment supprimer ce bijou ? Cette action supprimera également tous ses mouvements de stock initiaux et est irréversible.")) {
            try {
                await API.deleteProduct(productId);
                await this.loadAllData();
                window.Router.executeRouting();
            } catch (err) {
                alert("Erreur lors de la suppression : " + err.message);
            }
        }
    },

    populateProductSelects() {
        const catSelect = document.getElementById('prod-category');
        catSelect.innerHTML = '';
        window.appState.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
        });

        const supSelect = document.getElementById('prod-supplier');
        supSelect.innerHTML = '<option value="">Sélectionner fournisseur—</option>';
        window.appState.suppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (${s.company})`;
            supSelect.appendChild(opt);
        });
    },

    // Modals Expense
    openExpenseModal() {
        document.getElementById('expense-form').reset();
        document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-expense').classList.add('active');
    },

    // Modals People
    openPeopleModal(type) {
        document.getElementById('people-form').reset();
        document.getElementById('people-type').value = type;

        const companyGroup = document.getElementById('people-company-group');
        if (type === 'customer') {
            document.getElementById('people-modal-title').textContent = 'Enregistrer un nouveau client';
            companyGroup.style.display = 'none';
            document.getElementById('people-company').required = false;
        } else {
            document.getElementById('people-modal-title').textContent = 'Enregistrer un nouveau fournisseur';
            companyGroup.style.display = 'block';
        }

        document.getElementById('modal-people').classList.add('active');
    },

    // Modals Purchases
    openPurchaseAddModal() {
        this.purchaseCart = [];
        document.getElementById('purchase-form').reset();
        document.getElementById('purch-date').value = new Date().toISOString().split('T')[0];

        const supSelect = document.getElementById('purch-supplier');
        supSelect.innerHTML = '<option value="" disabled selected>Sélectionner fournisseur—</option>';
        window.appState.suppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (${s.company})`;
            supSelect.appendChild(opt);
        });

        const prodSelect = document.getElementById('purch-add-prod');
        prodSelect.innerHTML = '<option value="" disabled selected>Choisir bijou—</option>';
        window.appState.products.filter(p => p.status === 'actif').forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.reference} — ${p.name}`;
            prodSelect.appendChild(opt);
        });

        // Met à jour la suggestion de coût unitaire lors du choix du bijou
        prodSelect.addEventListener('change', () => {
            const p = window.appState.products.find(prod => prod.id === parseInt(prodSelect.value));
            document.getElementById('purch-add-price').value = p ? p.purchasePrice : 0;
        });

        this.renderPurchaseCart();
        document.getElementById('modal-purchase-add').classList.add('active');
    },

    renderPurchaseCart() {
        const tbody = document.getElementById('purchase-items-body');
        const totalSpan = document.getElementById('purchase-cart-total');
        tbody.innerHTML = '';

        let sum = 0;
        if (!this.purchaseCart || this.purchaseCart.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); font-size:12px; padding:16px;">Aucun produit dans le panier d'achat.</td></tr>`;
            totalSpan.textContent = '0';
            return;
        }

        this.purchaseCart.forEach((item, idx) => {
            const totalPos = item.quantity * item.unitPrice;
            sum += totalPos;

            tbody.innerHTML += `
        <tr>
          <td style="padding:10px 16px;"><strong>${item.name}</strong></td>
          <td style="padding:10px 16px; text-align:center;">${item.quantity}</td>
          <td style="padding:10px 16px; text-align:right;">${Components.formatFCFA(item.unitPrice)}</td>
          <td style="padding:10px 16px; text-align:right;">${Components.formatFCFA(totalPos)}</td>
          <td style="padding:10px 16px; text-align:center;">
            <button type="button" class="btn-icon delete" onclick="window.app.removeFromPurchaseCart(${idx})"><i class="fa-solid fa-trash-can"></i></button>
          </td>
        </tr>
      `;
        });

        totalSpan.textContent = sum.toLocaleString('fr-FR');
        document.getElementById('purch-paid').value = sum; // Remplir par défaut à paiement comptant
    },

    removeFromPurchaseCart(idx) {
        this.purchaseCart.splice(idx, 1);
        this.renderPurchaseCart();
    },

    // Modals Stock Adjust
    openStockAdjustModal() {
        document.getElementById('stock-adjust-form').reset();
        const select = document.getElementById('adjust-prod-id');
        select.innerHTML = '<option value="" disabled selected>Choisir bijou...</option>';
        window.appState.products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.reference} — ${p.name}`;
            select.appendChild(opt);
        });

        document.getElementById('modal-stock-adjust').classList.add('active');
    },

    // POS CART ACTIONS
    addToCart(productId) {
        if (!window.appState.caisseSession) {
            alert("⚠️ Impossible d'ajouter au panier : La caisse est fermée. Veuillez vous rendre dans la rubrique Trésorerie pour l'ouvrir.");
            return;
        }

        const p = window.appState.products.find(prod => prod.id === productId);
        if (!p) return;

        if (p.quantity <= 0) {
            if (!confirm("⚠️ Ce bijou est actuellement en rupture de stock informatique. Souhaitez-vous quand même forcer la vente ? (Le stock deviendra négatif).")) {
                return;
            }
        }

        const existing = window.appState.cart.find(it => it.productId === productId);
        if (existing) {
            existing.quantity++;
        } else {
            window.appState.cart.push({
                productId: p.id,
                name: p.name,
                price: p.sellPriceActual,
                quantity: 1
            });
        }

        // Actualiser le rendu du panier
        this.renderPosCart();
    },

    removeFromCart(productId) {
        window.appState.cart = window.appState.cart.filter(item => item.productId !== productId);
        this.renderPosCart();
    },

    updateCartQty(productId, change) {
        const item = window.appState.cart.find(it => it.productId === productId);
        if (!item) return;

        item.quantity += change;
        if (item.quantity <= 0) {
            this.removeFromCart(productId);
        } else {
            this.renderPosCart();
        }
    },

    renderPosCart() {
        const container = document.getElementById('content-area');
        Components.POS(container, window.appState.products, window.appState.categories, window.appState.cart, window.appState.activePosCategory);
        this.togglePosCreditField();
    },

    updateCartTotals() {
        const subtotal = window.appState.cart.reduce((sum, it) => sum + (it.quantity * it.price), 0);
        const disc = parseFloat(document.getElementById('pos-discount').value) || 0;
        const total = Math.max(0, subtotal - disc);

        document.getElementById('pos-total-payable').textContent = Components.formatFCFA(total);
        document.getElementById('pos-received').value = total;
    },

    togglePosCreditField() {
        this.updateCartTotals();
    },

    searchPosCatalog(q) {
        const grid = document.getElementById('pos-catalog-grid');
        const query = q.toLowerCase().trim();

        const activeProducts = window.appState.products.filter(p => p.status === 'actif');
        const matches = activeProducts.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.reference.toLowerCase().includes(query) ||
            p.material.toLowerCase().includes(query)
        );

        let html = '';
        matches.forEach(p => {
            const isLow = p.quantity <= p.minStock;
            html += `
        <div class="pos-product-card" onclick="window.app.addToCart(${p.id})">
          <span class="pos-prod-badge">${p.material || 'Bijou'}</span>
          <div class="pos-prod-image">
            <i class="fa-solid fa-gem"></i>
          </div>
          <div class="pos-prod-name" title="${p.name}">${p.name}</div>
          <div class="pos-prod-ref">${p.reference}</div>
          <div class="pos-prod-footer">
            <span class="pos-prod-price">${Components.formatFCFA(p.sellPriceActual)}</span>
            <span class="pos-prod-stock ${isLow ? 'danger' : ''}">Stock: ${p.quantity}</span>
          </div>
        </div>
      `;
        });

        grid.innerHTML = html || `<div style="grid-column:span 4; text-align:center; padding:40px; color:var(--text-muted);">Aucun bijou ne correspond à cette recherche.</div>`;
    },

    filterPosCategory(catId) {
        window.appState.activePosCategory = catId;
        this.renderPosCart();
    },

    // Finaliser la vente cassa
    async checkoutSale() {
        if (window.appState.cart.length === 0) {
            alert("Ajoutez des bijoux au panier avant de valider la vente.");
            return;
        }

        const customerVal = document.getElementById('pos-customer').value;
        const method = document.getElementById('pos-pay-method').value;
        const discount = parseFloat(document.getElementById('pos-discount').value) || 0;

        // Détermination CA à encaisser
        const subtotal = window.appState.cart.reduce((sum, it) => sum + (it.quantity * it.price), 0);
        const totalPayable = Math.max(0, subtotal - discount);

        // Vente ferme uniquement (pas de crédit)
        const paidAmount = totalPayable;
        const dueDate = null;

        const payload = {
            customerId: customerVal ? parseInt(customerVal) : null,
            paymentMethod: method === 'Crédit' ? 'Espèces' : method, // Le crédit s'encaisse plus tard via son versement
            discount,
            paidAmount,
            dueDate,
            items: window.appState.cart.map(it => ({
                productId: it.productId,
                quantity: it.quantity,
                unitPrice: it.price
            }))
        };

        try {
            const sale = await API.createSale(payload);
            alert("Vente enregistrée avec succès !");
            window.appState.cart = []; // vider le panier

            // Afficher le reçu
            this.viewReceipt(sale.id);

            // Recharger
            await this.loadAllData();
            window.Router.executeRouting();
        } catch (err) {
            alert("Erreur de facturation : " + err.message);
        }
    },

    // 7. Visualiser le reçu de vente
    async viewReceipt(saleId) {
        try {
            const data = await API.getSale(saleId);
            const markup = Components.ReceiptMarkup(window.appState.settings, data, data.items, data.customer);

            document.getElementById('receipt-modal-content').innerHTML = markup;
            document.getElementById('modal-receipt-view').classList.add('active');

            // Configurer bouton d'impression
            document.getElementById('btn-print-receipt-modal').onclick = () => {
                document.getElementById('receipt-print-area').innerHTML = markup;
                window.print();
            };

            // Configurer bouton de téléchargement PDF
            document.getElementById('btn-download-pdf-receipt-modal').onclick = () => {
                const element = document.getElementById('receipt-modal-content');
                const opt = {
                    margin: 10,
                    filename: `Recu_${data.receiptNumber}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };
                html2pdf().from(element).set(opt).save();
            };
        } catch (err) {
            alert("Erreur de chargement du reçu: " + err.message);
        }
    },

    async deleteSale(saleId) {
        if (confirm("Voulez-vous vraiment supprimer cette vente ? Cette action remettra les bijoux vendus en stock, déduira le montant de la caisse et est irréversible.")) {
            try {
                await API.deleteSale(saleId);
                await this.loadAllData();
                window.Router.executeRouting();
            } catch (err) {
                alert("Erreur lors de la suppression de la vente : " + err.message);
            }
        }
    },

    async deleteCustomer(id) {
        if (!confirm("Voulez-vous vraiment supprimer ce client ? Cette action est irréversible et échouera s'il a déjà des transactions enregistrées.")) return;
        try {
            await API.deleteCustomer(id);
            alert("Client supprimé avec succès.");
            await this.loadAllData();
            window.Router.executeRouting();
        } catch (err) {
            alert("Erreur lors de la suppression : " + err.message);
        }
    },

    async cancelCurrentCaisseSession() {
        if (!confirm("Voulez-vous vraiment annuler l'ouverture de la caisse ? Cela supprimera la session en cours et rétablira le solde initial précédent.")) return;
        try {
            await API.cancelCaisseSession();
            alert("Ouverture de caisse annulée.");
            await this.loadAllData();
            window.Router.executeRouting();
        } catch (err) {
            alert("Erreur lors de l'annulation : " + err.message);
        }
    },

    async deleteCaisseMovement(id) {
        if (!confirm("Voulez-vous vraiment supprimer ce mouvement financier de caisse ? Cette action mettra à jour le solde du compte de caisse associé et est irréversible.")) return;
        try {
            await API.deleteCaisseMovement(id);
            alert("Mouvement de caisse supprimé avec succès.");
            await this.loadAllData();
            window.Router.executeRouting();
        } catch (err) {
            alert("Erreur lors de la suppression : " + err.message);
        }
    },

    // 8. Gestion de créance / dette (Modaux d'acomptes)
    openRecouvrementModal(saleId, balanceDue) {
        document.getElementById('payment-form').reset();
        document.getElementById('pmt-type').value = 'sale';
        document.getElementById('pmt-ref-id').value = saleId;
        document.getElementById('pmt-balance-due').textContent = Components.formatFCFA(balanceDue);
        document.getElementById('pmt-amount').value = balanceDue;
        document.getElementById('pmt-amount').max = balanceDue;
        document.getElementById('pmt-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('payment-modal-title').textContent = "Recouvrement de créance client";

        document.getElementById('modal-payment-add').classList.add('active');
    },

    openSupplierPmtModal(purchaseId, balanceDue) {
        document.getElementById('payment-form').reset();
        document.getElementById('pmt-type').value = 'purchase';
        document.getElementById('pmt-ref-id').value = purchaseId;
        document.getElementById('pmt-balance-due').textContent = Components.formatFCFA(balanceDue);
        document.getElementById('pmt-amount').value = balanceDue;
        document.getElementById('pmt-amount').max = balanceDue;
        document.getElementById('pmt-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('payment-modal-title').textContent = "Règlement dette fournisseur";

        document.getElementById('modal-payment-add').classList.add('active');
    },

    // 9. Chargement de l'onglet historique mouvements de stock
    async loadStockMovementsView(container) {
        try {
            const movements = await API.getStockMovements();
            let rowsHtml = '';
            movements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).forEach(m => {
                const isEntry = m.type === 'entrée';
                rowsHtml += `
          <tr>
            <td>${new Date(m.date).toLocaleString('fr-FR')}</td>
            <td><strong style="color:var(--primary-dark);">${m.productReference}</strong></td>
            <td>${m.productName}</td>
            <td><span class="badge" style="background:#F1F5F9; color:var(--text-main); font-weight:600;">${m.reason}</span></td>
            <td>
              <strong style="color:${isEntry ? 'var(--emerald)' : 'var(--crimson)'};">
                ${isEntry ? '+' : '-'}${m.quantity}
              </strong>
            </td>
            <td><span style="font-size:12px; color:var(--text-muted);">${m.notes || '—'}</span></td>
          </tr>
        `;
            });

            container.innerHTML = `
        <div class="table-card" style="margin-top: 30px;">
          <div class="table-header">
            <h3>Historique récent des mouvements de stock</h3>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Réf</th>
                  <th>Bijou</th>
                  <th>Motif du mouvement</th>
                  <th>Quantité</th>
                  <th>Notes d'observation</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:20px;">Aucun mouvement de stock référencé.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
        } catch (err) {
            console.error(err);
        }
    },

    // 10. Gestion et logs de caisse de vente en espèces
    loadCaisseControlView(container) {
        const s = window.appState.caisseSession;
        let cardHtml = '';

        if (s && s.status === 'open') {
            cardHtml = `
        <div style="background:#FFFFFF; border:1px solid var(--border); border-radius: var(--radius-lg); padding:24px; box-shadow: var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <h4 style="font-size: 16px; font-weight:700;">Session de caisse active</h4>
            <div style="font-size:13px; color:var(--text-muted); margin-top:6px;">
              Ouverte par <strong>${s.openedBy}</strong> le ${new Date(s.openedAt).toLocaleString('fr-FR')}<br>
              Solde d'ouverture: <strong>${Components.formatFCFA(s.initialBalance)}</strong>
            </div>
          </div>
          <button class="btn-success" style="background-color: var(--crimson);" onclick="window.app.openCloseCaisseModal('close', ${s.initialBalance})"><i class="fa-solid fa-lock"></i> Clôturer la caisse d'aujourd'hui</button>
          <button class="btn-primary" style="background-color: #64748B; border-color: #64748B; margin-left: 8px;" onclick="window.app.cancelCurrentCaisseSession()"><i class="fa-solid fa-trash-can"></i> Annuler l'ouverture</button>
        </div>
      `;
        } else {
            cardHtml = `
        <div style="background:#FFFFFF; border:1px solid var(--border); border-radius: var(--radius-lg); padding:24px; box-shadow: var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <h4 style="font-size: 16px; font-weight:750; color:var(--crimson);">Session de caisse fermée</h4>
            <p style="font-size:13px; color:var(--text-muted); margin-top:6px;">L'ouverture de session de caisse espèces est requise afin de procéder à la validation des règlements au comptant.</p>
          </div>
          <button class="btn-success" onclick="window.app.openCloseCaisseModal('open')"><i class="fa-solid fa-lock-open"></i> Ouvrir la session de caisse</button>
        </div>
      `;
        }

        let caisseSection = document.createElement('div');
        caisseSection.style.marginTop = '30px';
        caisseSection.innerHTML = `
      <div style="font-size:16px; font-weight:600; color:var(--dark-slate); margin-bottom:15px;"><i class="fa-solid fa-cash-register"></i> Session de caisse</div>
      ${cardHtml}
    `;
        container.appendChild(caisseSection);
    },

    openCloseCaisseModal(action, currentBase = 0) {
        document.getElementById('caisse-action-form').reset();
        document.getElementById('caisse-action-type').value = action;

        const openFields = document.getElementById('caisse-open-fields');
        const closeFields = document.getElementById('caisse-close-fields');
        const varianceGroup = document.getElementById('caisse-variance-group');

        if (action === 'open') {
            document.getElementById('caisse-action-title').textContent = "Ouverture de caisse enregistreuse";
            openFields.style.display = 'block';
            closeFields.style.display = 'none';
            document.getElementById('caisse-initial-bal').required = true;
        } else {
            document.getElementById('caisse-action-title').textContent = "Clôture de caisse espèces";
            openFields.style.display = 'none';
            closeFields.style.display = 'block';
            document.getElementById('caisse-initial-bal').required = false;

            // Calculer et afficher solde théorique de caisse
            const cashAcctBalance = window.appState.treasury.accounts.find(a => a.id === 1)?.balance || 0;
            document.getElementById('caisse-theoretical-bal').textContent = Components.formatFCFA(cashAcctBalance);

            const realInput = document.getElementById('caisse-real-bal');
            realInput.value = cashAcctBalance;

            // Auto-trigger comparaison variance
            const applyComparison = () => {
                const diff = parseFloat(realInput.value) - cashAcctBalance;
                if (Math.abs(diff) > 0) {
                    varianceGroup.style.display = 'block';
                    document.getElementById('caisse-justification').required = true;
                } else {
                    varianceGroup.style.display = 'none';
                    document.getElementById('caisse-justification').required = false;
                }
            };

            realInput.oninput = applyComparison;
            applyComparison();
        }

        document.getElementById('modal-caisse-action').classList.add('active');
    },

    // 11. Page Rapports / Ratios
    renderReportsView(container, profitability, dashboardReport) {
        const prof = profitability;
        const dk = dashboardReport.kpis;

        let qtyRows = '';
        prof.topQuantity.forEach((p, i) => {
            qtyRows += `
        <tr>
          <td><strong style="color:var(--text-code);">#${i + 1}</strong></td>
          <td>${p.reference}</td>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge" style="background:#F1F5F9; color:var(--text-main); font-weight:600;">${p.quantitySold} unités</span></td>
          <td>${Components.formatFCFA(p.turnover)}</td>
        </tr>
      `;
        });

        let profitRows = '';
        prof.topProfit.forEach((p, i) => {
            profitRows += `
        <tr>
          <td><strong style="color:var(--text-code);">#${i + 1}</strong></td>
          <td>${p.reference}</td>
          <td><strong>${p.name}</strong></td>
          <td><span style="font-weight:600; color:var(--emerald);">${Components.formatFCFA(p.marginTotal)}</span></td>
          <td>${p.profitPct}% marge</td>
        </tr>
      `;
        });

        let stagnantRows = '';
        prof.dormant.slice(0, 10).forEach(p => {
            stagnantRows += `
        <tr>
          <td>${p.reference}</td>
          <td><strong>${p.name}</strong></td>
          <td>${p.currentStock} pcs</td>
          <td>${Components.formatFCFA(p.currentStock * p.purchasePrice)}</td>
        </tr>
      `;
        });

        container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Rapports & Ratios de Rentabilité</h2>
          <p>Analysez les performances comptables de votre bijouterie et dégagez vos meilleurs profits</p>
        </div>
        <div style="display:flex; gap:12px;">
          <button class="btn-primary" onclick="window.app.exportData('csv')"><i class="fa-solid fa-file-csv"></i> Exporter CSV</button>
          <button class="btn-primary" onclick="window.app.exportData('json')"><i class="fa-solid fa-file-code"></i> Sauvegarder JSON</button>
        </div>
      </div>

      <!-- Financial Recap -->
      <div style="margin-bottom:30px; display:grid; grid-template-columns: repeat(3, 1fr); gap:20px;">
        <div class="metric-card" style="box-shadow:var(--shadow-sm);">
          <span class="metric-label">Marge Brute ce mois</span>
          <span class="metric-value" style="color:var(--emerald);">${Components.formatFCFA(dk.grossMargin)}</span>
          <span class="metric-subtext">CA (${Components.formatFCFA(dk.turnover)}) - CMV (${Components.formatFCFA(dk.cogs)})</span>
        </div>
        <div class="metric-card" style="box-shadow:var(--shadow-sm);">
          <span class="metric-label">Dépenses ce mois</span>
          <span class="metric-value" style="color:var(--crimson);">${Components.formatFCFA(dk.totalExpenses)}</span>
          <span class="metric-subtext">Électricité, packaging, loyer...</span>
        </div>
        <div class="metric-card" style="box-shadow:var(--shadow-sm); border-left:4px solid var(--emerald);">
          <span class="metric-label">Bénéfice Net Simplifié</span>
          <span class="metric-value" style="color:var(--emerald); font-size:24px;">${Components.formatFCFA(dk.netProfit)}</span>
          <span class="metric-subtext">Marge brute - Dépenses</span>
        </div>
      </div>

      <div class="charts-grid">
        <div class="table-card" style="margin-bottom:0;">
          <div class="table-header"><h3>Top 5 Bijoux les plus vendus (volume)</h3></div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Réf</th>
                  <th>Bijou</th>
                  <th>Vendus</th>
                  <th>CA cumulé</th>
                </tr>
              </thead>
              <tbody>
                ${qtyRows || '<tr><td colspan="5" style="text-align:center; padding:16px;">Aucune vente.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="table-card" style="margin-bottom:0;">
          <div class="table-header"><h3>Top 5 Bijoux les plus rentables (marge cash)</h3></div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Rang</th>
                  <th>Réf</th>
                  <th>Bijou</th>
                  <th>Profits générés</th>
                  <th>Marge %</th>
                </tr>
              </thead>
              <tbody>
                ${profitRows || '<tr><td colspan="5" style="text-align:center; padding:16px;">Aucune vente.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="table-card" style="margin-top: 30px;">
        <div class="table-header">
          <h3>Stock Dormant (Plus de 30 jours sans ventes)</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Bijou</th>
                <th>Quantité dormante</th>
                <th>Valeur d'achat stock bloqué</th>
              </tr>
            </thead>
            <tbody>
              ${stagnantRows || '<tr><td colspan="4" style="text-align:center; padding:20px;">Aucun stock stagnant. Félicitations !</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    },

    // 12. Exporter les données
    async exportData(format) {
        if (format === 'json') {
            try {
                const response = await fetch('/api/settings');
                // Téléchargement du JSON global
                // Pour des besoins de simulation locale, renvoyons son JSON
                const rawResponse = await fetch('/api/products');
                const prods = await rawResponse.json();

                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(prods, null, 2));
                const dlAnchorElem = document.createElement('a');
                dlAnchorElem.setAttribute("href", dataStr);
                dlAnchorElem.setAttribute("download", "bijoux_manager_export.json");
                dlAnchorElem.click();
            } catch (err) {
                alert(err.message);
            }
        } else {
            // CSV Export
            try {
                const prods = window.appState.products;
                let csvContent = "data:text/csv;charset=utf-8,Reference,Nom,Prix_Achat,Prix_Vente,Quantite,Statut\n";

                prods.forEach(p => {
                    csvContent += `"${p.reference}","${p.name}",${p.purchasePrice},${p.sellPriceActual},${p.quantity},"${p.status}"\n`;
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "bijoux_stock_report.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                alert(err.message);
            }
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
