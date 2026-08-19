/**
 * RENDU DES COMPOSANTS GRAPHIQUES DE L'INTERFACE
 */
const Components = {
  // Formatage des montants pour le Sénégal (FCFA)
  formatFCFA(amt) {
    return Number(amt).toLocaleString('fr-FR') + ' FCFA';
  },

  // Tableau de bord
  Dashboard(container, data) {
    const k = data.kpis;
    const progressCA = Math.min(100, Math.round((k.turnoverDay / 2000000) * 100)) || 0; // Ex: objectif 2M

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Tableau de bord</h2>
          <p>Aperçu en temps réel de votre activité de bijoux</p>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card ca">
          <span class="metric-label">CA du jour</span>
          <span class="metric-value">${this.formatFCFA(k.turnoverDay)}</span>
          <span class="metric-subtext">Aujourd'hui</span>
        </div>
        <div class="metric-card ca">
          <span class="metric-label">CA de la période</span>
          <span class="metric-value">${this.formatFCFA(k.turnover)}</span>
          <span class="metric-subtext">Période sélectionnée</span>
        </div>
        <div class="metric-card profit">
          <span class="metric-label">Bénéfice Net</span>
          <span class="metric-value">${this.formatFCFA(k.netProfit)}</span>
          <span class="metric-subtext">Marge brute - Dépenses</span>
        </div>
        <div class="metric-card stock">
          <span class="metric-label">Valeur du Stock</span>
          <span class="metric-value">${this.formatFCFA(k.stockValue)}</span>
          <span class="metric-subtext">${k.stockCount} bijoux en stock</span>
        </div>
        <div class="metric-card expenses">
          <span class="metric-label">Dépenses Période</span>
          <span class="metric-value">${this.formatFCFA(k.totalExpenses)}</span>
          <span class="metric-subtext">Frais d'exploitation</span>
        </div>
        <div class="metric-card purchases">
          <span class="metric-label">Achats Fournisseurs</span>
          <span class="metric-value">${this.formatFCFA(k.totalPurchases)}</span>
          <span class="metric-subtext">Stock acheté</span>
        </div>
        <div class="metric-card debts">
          <span class="metric-label">Dettes Fournisseurs</span>
          <span class="metric-value">${this.formatFCFA(k.supplierOutstanding)}</span>
          <span class="metric-subtext">Reste à payer</span>
        </div>
      </div>

      <!-- Objectifs -->
      <div class="goals-section">
        <div class="goal-card">
          <div class="goal-label">
            <span>Objectif de CA Mensuel</span>
            <strong>${this.formatFCFA(k.turnoverDay)} / 2 000 000 FCFA</strong>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress" style="width: ${progressCA}%"></div>
          </div>
          <div class="goal-subtext">
            <span>Progression</span>
            <span>${progressCA}%</span>
          </div>
        </div>
        <div class="goal-card">
          <div class="goal-label">
            <span>Compte de Caisse Actuel (Espèces)</span>
            <strong style="color:var(--emerald);">${this.formatFCFA(window.appState?.treasury?.accounts?.find(a => a.id === 1)?.balance || 0)}</strong>
          </div>
          <div class="goal-progress-bar" style="background:#E2E8F0;">
            <div class="goal-progress profit" style="width: 100%"></div>
          </div>
          <div class="goal-subtext">
            <span>Fonds disponibles en liquide</span>
            <span>Prêt pour opérations</span>
          </div>
        </div>
      </div>

      <!-- Graphiques -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-header">
            <h3>Évolution du Chiffre d'Affaires</h3>
          </div>
          <div class="chart-body">
            <canvas id="chart-sales-evolution"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-header">
            <h3>Ventes par Catégorie de Bijoux</h3>
          </div>
          <div class="chart-body">
            <canvas id="chart-sales-categories"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-header">
            <h3>Évolution du Bénéfice</h3>
          </div>
          <div class="chart-body">
            <canvas id="chart-profit-evolution"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-header">
            <h3>Répartition des Modes de Paiement</h3>
          </div>
          <div class="chart-body">
            <canvas id="chart-payment-methods"></canvas>
          </div>
        </div>
      </div>
    `;

    // Générer les graphiques via Chart.js
    this.renderCharts(data.charts);
  },

  renderCharts(chartsData) {
    const dates = Object.keys(chartsData.timeline || {}).sort();
    const salesValues = dates.map(d => chartsData.timeline[d]);
    const profitValues = dates.map(d => chartsData.profitTimeline[d] || 0);

    const categoriesLabels = Object.keys(chartsData.categories || {});
    const categoriesValues = Object.values(chartsData.categories || {});

    const paymentLabels = Object.keys(chartsData.paymentMethods || {});
    const paymentValues = Object.values(chartsData.paymentMethods || {});

    // Chart 1: Evolution du CA
    new Chart(document.getElementById('chart-sales-evolution'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Chiffre d\'Affaires (FCFA)',
          data: salesValues,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 2: Ventes par Catégories
    new Chart(document.getElementById('chart-sales-categories'), {
      type: 'bar',
      data: {
        labels: categoriesLabels,
        datasets: [{
          label: 'Total Ventes (FCFA)',
          data: categoriesValues,
          backgroundColor: '#0F172A',
          borderColor: '#D4AF37',
          borderWidth: 1
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 3: Evolution du Bénéfice
    new Chart(document.getElementById('chart-profit-evolution'), {
      type: 'line',
      data: {
        labels: dates,
        datasets: [{
          label: 'Bénéfice Réel (FCFA)',
          data: profitValues,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 4: Modes de Paiement
    new Chart(document.getElementById('chart-payment-methods'), {
      type: 'doughnut',
      data: {
        labels: paymentLabels,
        datasets: [{
          data: paymentValues,
          backgroundColor: ['#D4AF37', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#64748B']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  },

  // Catalogue POS Caisse
  POS(container, products, categories, cartList, activeCategoryId = null) {
    const activeProducts = products.filter(p => p.status === 'actif');
    const filteredProducts = activeCategoryId
      ? activeProducts.filter(p => p.categoryId === activeCategoryId)
      : activeProducts;

    let categoriesTabsHtml = `
      <button class="btn-quick ${activeCategoryId === null ? 'active' : ''}" style="${activeCategoryId === null ? 'background:var(--primary); color:var(--dark-slate);' : ''}" onclick="window.app.filterPosCategory(null)">Tous</button>
    `;
    categories.forEach(c => {
      categoriesTabsHtml += `
        <button class="btn-quick ${activeCategoryId === c.id ? 'active' : ''}" style="${activeCategoryId === c.id ? 'background:var(--primary); color:var(--dark-slate);' : ''}" onclick="window.app.filterPosCategory(${c.id})">${c.name}</button>
      `;
    });

    let productsHtml = '';
    filteredProducts.forEach(p => {
      const isLow = p.quantity <= p.minStock;
      productsHtml += `
        <div class="pos-product-card" onclick="window.app.addToCart(${p.id})">
          <span class="pos-prod-badge">${p.material || 'Bijou'}</span>
          <div class="pos-prod-image">
            <i class="fa-solid fa-gem"></i>
          </div>
          <div class="pos-prod-name" title="${p.name}">${p.name}</div>
          <div class="pos-prod-ref">${p.reference}</div>
          <div class="pos-prod-footer">
            <span class="pos-prod-price">${this.formatFCFA(p.sellPriceActual)}</span>
            <span class="pos-prod-stock ${isLow ? 'danger' : ''}">Stock: ${p.quantity}</span>
          </div>
        </div>
      `;
    });

    let cartItemsHtml = '';
    let cartTotal = 0;

    if (cartList.length === 0) {
      cartItemsHtml = `
        <div class="pos-cart-empty">
          <i class="fa-solid fa-cart-shopping"></i>
          <span>Panier vide</span>
        </div>
      `;
    } else {
      cartList.forEach(item => {
        const itemTotal = item.quantity * item.price;
        cartTotal += itemTotal;
        cartItemsHtml += `
          <div class="pos-cart-item">
            <div class="pos-item-details">
              <div class="pos-item-name">${item.name}</div>
              <div class="pos-item-price">${this.formatFCFA(item.price)}</div>
            </div>
            <div class="pos-item-qty-control">
              <button class="pos-btn-qty" onclick="window.app.updateCartQty(${item.productId}, -1)">-</button>
              <span class="pos-item-quantity">${item.quantity}</span>
              <button class="pos-btn-qty" onclick="window.app.updateCartQty(${item.productId}, 1)">+</button>
            </div>
            <div class="pos-item-total">${this.formatFCFA(itemTotal)}</div>
            <button class="pos-btn-remove" onclick="window.app.removeFromCart(${item.productId})"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        `;
      });
    }

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Interface de caisse</h2>
          <p>Sélectionnez les bijoux pour enregistrer la vente</p>
        </div>
        <div>
          <span class="badge ${window.appState?.caisseSession ? 'success' : 'danger'}">
            Caisse: ${window.appState?.caisseSession ? 'OUVERTE' : 'FERMÉE'}
          </span>
        </div>
      </div>

      <div class="pos-container">
        <!-- Catalog area -->
        <div class="pos-products">
          <div class="pos-search-row">
            <input type="text" class="form-input" id="pos-search-input" placeholder="Filtrer par nom ou référence..." oninput="window.app.searchPosCatalog(this.value)" style="flex:1;">
            <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;">
              ${categoriesTabsHtml}
            </div>
          </div>
          
          <div class="pos-catalog" id="pos-catalog-grid">
            ${productsHtml || '<div style="grid-column:span 4; text-align:center; padding:40px; color:var(--text-muted);">Aucun bijou ne correspond à ce filtre.</div>'}
          </div>
        </div>

        <!-- Basket area -->
        <div class="pos-cart">
          <div class="pos-cart-header">
            <h3><i class="fa-solid fa-basket-shopping"></i> Panier actif</h3>
            <span class="badge" style="background:rgba(212,175,55,0.2); color:var(--primary-light);">${cartList.length} articles</span>
          </div>

          <div class="pos-cart-items">
            ${cartItemsHtml}
          </div>

          <div class="pos-cart-summary">
            <div class="pos-summary-row">
              <span>Sous-total</span>
              <span>${this.formatFCFA(cartTotal)}</span>
            </div>
            <div class="pos-summary-row">
              <span>Remise</span>
              <input type="number" id="pos-discount" class="form-input" min="0" value="0" oninput="window.app.updateCartTotals()" style="width:90px; padding:2px 6px; text-align:right; font-size:13px;">
            </div>
            
            <div class="pos-summary-row total">
              <span>Total à payer</span>
              <span class="price" id="pos-total-payable">${this.formatFCFA(cartTotal)}</span>
            </div>

            <div class="pos-summary-inputs">
              <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Mode de paiement & Encaissement</div>
              <select id="pos-pay-method" class="form-select" onchange="window.app.togglePosCreditField()">
                <option value="Espèces">Espèces</option>
                <option value="Wave">Wave</option>
                <option value="Orange Money">Orange Money</option>
              </select>
              
              <select id="pos-customer" class="form-select">
                <option value="">Client Anonyme (Comptant)</option>
              </select>

              <input type="hidden" id="pos-received" value="0">
              <input type="hidden" id="pos-credit-deposit" value="0">
              <input type="hidden" id="pos-credit-due" value="">
            </div>

            <button class="pos-btn-checkout" onclick="window.app.checkoutSale()">Valider et Imprimer le reçu</button>
          </div>
        </div>
      </div>
    `;

    // Peupler la liste des clients
    const customerSelect = document.getElementById('pos-customer');
    const customers = window.appState.customers || [];
    customers.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.name} (${c.phone})`;
      customerSelect.appendChild(opt);
    });
  },

  // Liste des Produits
  ProductList(container, products, categories, suppliers) {
    let rowsHtml = '';
    products.forEach(p => {
      const cat = categories.find(c => c.id === p.categoryId)?.name || 'Autres';
      const sup = suppliers.find(s => s.id === p.supplierId)?.name || 'Inconnu';

      const margin = p.sellPriceActual - p.purchasePrice;
      const marginPct = p.sellPriceActual > 0 ? Math.round((margin / p.sellPriceActual) * 100) : 0;
      const isLow = p.quantity <= p.minStock;

      rowsHtml += `
        <tr>
          <td><strong style="color:var(--primary-dark);">${p.reference}</strong></td>
          <td>
            <div style="font-weight:600; color:var(--dark-slate);">${p.name}</div>
            <div style="font-size:11px; color:var(--text-muted);">${p.material} | ${p.color} | ${p.size}</div>
          </td>
          <td><span class="badge" style="background:#F1F5F9; color:var(--slate-medium);">${cat}</span></td>
          <td>${sup}</td>
          <td>${this.formatFCFA(p.purchasePrice)}</td>
          <td>${this.formatFCFA(p.sellPriceActual)}</td>
          <td>
            <span style="font-weight:600; color:var(--emerald);">+${this.formatFCFA(margin)}</span>
            <div style="font-size:11px; color:var(--text-muted);">${marginPct}% marge</div>
          </td>
          <td>
            <span class="badge ${p.quantity === 0 ? 'danger' : (isLow ? 'warning' : 'success')}">
              ${p.quantity === 0 ? 'Rupture' : (isLow ? `Faible (${p.quantity})` : p.quantity)}
            </span>
          </td>
          <td><span class="badge ${p.status === 'actif' ? 'success' : 'danger'}">${p.status}</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon edit" onclick="window.app.openEditProductModal(${p.id})"><i class="fa-solid fa-pen"></i></button>
              ${window.appState.user?.role === 'Administrateur' ? `
                <button class="btn-icon delete" style="color:var(--crimson);" onclick="window.app.deleteProduct(${p.id})" title="Supprimer le bijou"><i class="fa-solid fa-trash-can"></i></button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Gestion des bijoux</h2>
          <p>Fiches détaillées, marges et suivi des stocks disponibles</p>
        </div>
        <div style="display:flex; gap:12px;">
          <button class="btn-primary" style="background:#FFF; color:var(--text-main); border-color:var(--border);" onclick="window.app.openStockAdjustModal()"><i class="fa-solid fa-sliders"></i> Ajustement Manuel</button>
          <button class="btn-primary" onclick="window.app.openProductModal()"><i class="fa-solid fa-plus"></i> Nouveau bijou</button>
        </div>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3>Catalogue (${products.length} bijoux enregistrés)</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Nom du bijou</th>
                <th>Catégorie</th>
                <th>Fournisseur</th>
                <th>Prix d'achat</th>
                <th>Prix de vente</th>
                <th>Marge brute (bénéfice unit)</th>
                <th>Quantité en stock</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="10" style="text-align:center; padding:30px;">Aucun bijou enregistré.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Recette / Ventes & Crédits
  SalesList(container, sales, customers) {
    let rowsHtml = '';
    sales.forEach(s => {
      const client = customers.find(c => c.id === s.customerId)?.name || 'Client Anonyme';

      rowsHtml += `
        <tr>
          <td><strong style="color:var(--primary-dark);">${s.receiptNumber}</strong></td>
          <td>${new Date(s.date).toLocaleDateString('fr-FR')} à ${new Date(s.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${client}</td>
          <td>${this.formatFCFA(s.totalAmount)}</td>
          <td>${this.formatFCFA(s.paidAmount)}</td>
          <td>${s.paymentMethod}</td>
          <td><span class="badge success">Payé</span></td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon view" onclick="window.app.viewReceipt(${s.id})" title="Voir le reçu"><i class="fa-solid fa-eye"></i></button>
              ${window.appState.user?.role === 'Administrateur' ? `
                <button class="btn-icon delete" style="color:var(--crimson);" onclick="window.app.deleteSale(${s.id})" title="Supprimer la vente"><i class="fa-solid fa-trash-can"></i></button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Journal des ventes & recettes</h2>
          <p>Historique complet des encaissements de la boutique</p>
        </div>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3>Ventes Validées</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>N° Reçu</th>
                <th>Date / Heure</th>
                <th>Client</th>
                <th>Montant Total</th>
                <th>Montant Payé</th>
                <th>Mode Paiement</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:30px;">Aucune vente enregistrée.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Achats Fournisseurs
  PurchasesList(container, purchases, suppliers) {
    let rowsHtml = '';
    purchases.forEach(p => {
      const sup = suppliers.find(s => s.id === p.supplierId)?.name || 'Fournisseur inconnu';

      rowsHtml += `
        <tr>
          <td><strong style="color:var(--primary-dark);">${p.orderNumber}</strong></td>
          <td>${new Date(p.date).toLocaleDateString('fr-FR')}</td>
          <td>${sup}</td>
          <td>${this.formatFCFA(p.totalAmount)}</td>
          <td>${this.formatFCFA(p.paidAmount)}</td>
          <td>
            <span style="font-weight:600; color:${p.balanceDue > 0 ? 'var(--crimson)' : 'var(--emerald)'};">
              ${this.formatFCFA(p.balanceDue)}
            </span>
          </td>
          <td>${p.paymentMethod || '—'}</td>
          <td><span class="badge ${p.status === 'payé' ? 'success' : (p.status === 'partiellement payé' ? 'warning' : 'danger')}">${p.status}</span></td>
          <td>
            <div class="actions-cell">
              ${p.balanceDue > 0 ? `
                <button class="btn-primary" style="padding:4px 8px; font-size:11px;" onclick="window.app.openSupplierPmtModal(${p.id}, ${p.balanceDue})"><i class="fa-solid fa-money-bill-wave"></i> Régler dette</button>
              ` : '<i class="fa-solid fa-circle-check" style="color:var(--emerald); padding-left:8px;"></i> Payé'}
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Achats et approvisionnements</h2>
          <p>Validez les factures fournisseurs et suivez les dettes impayées</p>
        </div>
        <button class="btn-primary" onclick="window.app.openPurchaseAddModal()"><i class="fa-solid fa-file-invoice"></i> Nouveau bon d'achat</button>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3>Factures fournisseurs d'achats</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>N° Achat</th>
                <th>Date</th>
                <th>Fournisseur</th>
                <th>Montant Total</th>
                <th>Montant Payé</th>
                <th>Reste à payer (Dette)</th>
                <th>Mode Paiement</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="9" style="text-align:center; padding:30px;">Aucun achat enregistré.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Clients
  CustomersList(container, customers) {
    let rowsHtml = '';
    customers.sort((a, b) => b.totalPurchased - a.totalPurchased).forEach((c, idx) => {
      rowsHtml += `
        <tr>
          <td><strong style="color:var(--text-muted); font-size:13px;">#${idx + 1}</strong></td>
          <td>
            <div style="font-weight:600; color:var(--dark-slate);">${c.name}</div>
            <div style="font-size:11px; color:var(--text-muted);">${c.email || 'Pas de courriel'}</div>
          </td>
          <td>${c.phone}</td>
          <td>${c.address || 'Non spécifiée'}</td>
          <td><span style="font-weight:600; color:var(--slate-medium);">${c.salesCount} achats</span></td>
          <td><strong>${this.formatFCFA(c.totalPurchased)}</strong></td>
          <td>
            <span style="font-weight:700; color:${c.balanceDue > 0 ? 'var(--crimson)' : 'var(--emerald)'};">
              ${this.formatFCFA(c.balanceDue)}
            </span>
          </td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon delete" title="Supprimer ce client" onclick="window.app.deleteCustomer(${c.id})">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Carnet clients</h2>
          <p>Suivi des volumes d'achat, du panier moyen et des crédits en cours</p>
        </div>
        <button class="btn-primary" onclick="window.app.openPeopleModal('customer')"><i class="fa-solid fa-user-plus"></i> Nouveau client</button>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3>Fichier Clients (par volume d'achat)</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rang</th>
                <th>Identité</th>
                <th>Téléphone</th>
                <th>Adresse</th>
                <th>Nombre achats</th>
                <th>Total Dépensé (CA)</th>
                <th>Solde dû (Créance)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding:30px;">Aucun client enregistré.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Fournisseurs
  SuppliersList(container, suppliers) {
    let rowsHtml = '';
    suppliers.forEach(s => {
      rowsHtml += `
        <tr>
          <td>
            <div style="font-weight:600; color:var(--dark-slate);">${s.name}</div>
            <div style="font-size:12px; color:var(--primary-dark); font-weight:600;">${s.company}</div>
          </td>
          <td>${s.phone}</td>
          <td>${s.email || '—'}</td>
          <td>${s.address || '—'}</td>
          <td><strong>${this.formatFCFA(s.totalPurchased)}</strong></td>
          <td>
            <span style="font-weight:600; color:${s.balanceDue > 0 ? 'var(--crimson)' : 'var(--emerald)'};">
              ${this.formatFCFA(s.balanceDue)}
            </span>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Carnet fournisseurs</h2>
          <p>Historique des approvisionnements de bijoux et des dettes fournisseurs</p>
        </div>
        <button class="btn-primary" onclick="window.app.openPeopleModal('supplier')"><i class="fa-solid fa-plus"></i> Nouveau fournisseur</button>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3>Fichier Fournisseurs</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nom / Raison Sociale</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Adresse</th>
                <th>Volume d'achat</th>
                <th>Dette Restante</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:30px;">Aucun fournisseur enregistré.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Dépenses
  ExpensesList(container, expenses) {
    let rowsHtml = '';
    let totalExpenseSum = 0;

    expenses.forEach(e => {
      totalExpenseSum += e.amount;
      rowsHtml += `
        <tr>
          <td>${new Date(e.date).toLocaleDateString('fr-FR')}</td>
          <td><span class="badge" style="background:rgba(239, 68, 68, 0.1); color:var(--crimson);">${e.category}</span></td>
          <td>${e.description}</td>
          <td><strong>${this.formatFCFA(e.amount)}</strong></td>
          <td>${e.paymentMethod}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Mouvements de dépenses</h2>
          <p>Saisissez tous vos frais généraux de la boutique (loyer, transport, Wave...)</p>
        </div>
        <button class="btn-primary" onclick="window.app.openExpenseModal()"><i class="fa-solid fa-plus"></i> Enregistrer frais</button>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3>Dépenses d'exploitation (Total: <span style="color:var(--crimson); font-weight:700;">${this.formatFCFA(totalExpenseSum)}</span>)</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Catégorie</th>
                <th>Désignation / Explication</th>
                <th>Montant</th>
                <th>Mode Règlement</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding:30px;">Aucune dépense enregistrée.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Trésorerie
  Treasury(container, treasuryData) {
    const accs = treasuryData.accounts || [];
    const mvts = treasuryData.movements || [];

    let accountsHtml = '';
    let totalFunds = 0;

    accs.forEach(a => {
      totalFunds += a.balance;
      const cardMap = { 'Espèces': 'fa-solid fa-wallet', 'Wave': 'fa-solid fa-mobile-screen', 'Orange Money': 'fa-solid fa-mobile', 'Carte bancaire': 'fa-solid fa-credit-card', 'Virement': 'fa-solid fa-money-check' };
      const icon = cardMap[a.name] || 'fa-solid fa-cash-register';

      accountsHtml += `
        <div class="metric-card" style="box-shadow: var(--shadow-sm); border-left: 4px solid var(--primary);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="metric-label">${a.name}</span>
            <i class="${icon}" style="color:var(--primary-dark); font-size:18px;"></i>
          </div>
          <span class="metric-value">${this.formatFCFA(a.balance)}</span>
          <span class="metric-subtext">Solde disponible</span>
        </div>
      `;
    });

    let movementsHtml = '';
    mvts.forEach(m => {
      const isIncome = m.type === 'in';
      const labelMap = { 'vente_bijou': 'Vente Bijoux', 'achat_fournisseur': 'Achat stock', 'reglement_dette_fournisseur': 'Dette Reglé', 'vente_credit_acompte': 'Acompte reçu', 'recouvrement_creance_client': 'Crédit Recouvré', 'ouverture_caisse': 'Ouverture Caisse', 'cloture_caisse_ecart': 'Écart Caisse' };
      const reasonLabel = labelMap[m.reason] || m.reason.replace(/depense_frais_/g, 'Frais: ');

      // Autoriser la suppression uniquement pour l'ouverture de caisse et écart
      const isDeletable = ['ouverture_caisse', 'cloture_caisse_ecart'].includes(m.reason);
      const actionHtml = isDeletable ? `
        <button class="btn-icon delete" title="Supprimer ce mouvement" onclick="window.app.deleteCaisseMovement(${m.id})">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      ` : '';

      movementsHtml += `
        <tr>
          <td>${new Date(m.date).toLocaleString('fr-FR')}</td>
          <td><span class="badge" style="background:#F1F5F9; color:var(--text-main);">${m.accountName}</span></td>
          <td><strong style="color:${isIncome ? 'var(--emerald)' : 'var(--crimson)'};">${isIncome ? '+' : '-'}${this.formatFCFA(m.amount)}</strong></td>
          <td><span style="font-size:13px; text-transform:capitalize;">${reasonLabel}</span></td>
          <td>
            <div class="actions-cell">
              ${actionHtml}
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Trésorerie & Comptes financiers</h2>
          <p>Soldes actuels par moyen de paiement et journal des transactions monétaires</p>
        </div>
        <div style="font-size:18px; font-weight:700; color:var(--dark-slate);">
          Solde Global: <span style="color:var(--emerald); background:rgba(16,185,129,0.1); padding:8px 16px; border-radius:var(--radius-pill);">${this.formatFCFA(totalFunds)}</span>
        </div>
      </div>

      <div class="metrics-grid" style="margin-bottom: 30px;">
        ${accountsHtml}
      </div>

      <!-- Logs -->
      <div class="table-card">
        <div class="table-header">
          <h3>Mouvements financiers récents</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date / Heure</th>
                <th>Compte financier</th>
                <th>Flux de trésorerie</th>
                <th>Désignation / Motif</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${movementsHtml || '<tr><td colspan="5" style="text-align:center; padding:30px;">Aucun mouvement financier enregistré.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Historique d'audit
  AuditLogs(container, logs) {
    let rowsHtml = '';
    logs.slice(0, 100).forEach(l => {
      rowsHtml += `
        <tr>
          <td>${new Date(l.date).toLocaleString('fr-FR')}</td>
          <td><strong>${l.userName}</strong></td>
          <td><span class="badge" style="background:#E2E8F0; color:var(--dark-slate);">${l.action}</span></td>
          <td>${l.targetTable} [ID: ${l.targetId || 'N/A'}]</td>
          <td>
            <div style="max-width:350px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; color:var(--text-muted);" title="${l.newValue}">
              ${l.newValue || '—'}
            </div>
          </td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Journal d'audit et de sécurité</h2>
          <p>Mémorisation de toutes les actions et modifications sensibles effectuées</p>
        </div>
      </div>

      <div class="table-card">
        <div class="table-header">
          <h3>Historique des opérations</h3>
        </div>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date/Heure</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Module concerné</th>
                <th>Nouveaux détails</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding:30px;">Aucun historique répertorié.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // Paramètres
  Settings(container, s) {
    container.innerHTML = `
      <div class="page-header">
        <div class="page-title">
          <h2>Paramètres généraux</h2>
          <p>Configuration de l'identité de votre boutique, devises et coordonnées de facturation</p>
        </div>
      </div>

      <div class="chart-card" style="max-width: 700px; margin: 0 auto;">
        <div class="chart-header" style="border-bottom:1px solid var(--border); padding-bottom:12px; margin-bottom:20px;">
          <h3>Éditer la structure de la boutique</h3>
        </div>
        
        <form id="settings-form-element">
          <div class="form-grid">
            <div class="form-group">
              <label for="set-shop">Nom de la boutique de bijoux *</label>
              <input type="text" id="set-shop" class="form-input" value="${s.shop_name}" required>
            </div>
            <div class="form-group">
              <label for="set-phone">Téléphone de contact *</label>
              <input type="text" id="set-phone" class="form-input" value="${s.phone}" required>
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label for="set-email">Email de la boutique</label>
              <input type="email" id="set-email" class="form-input" value="${s.email}">
            </div>
            <div class="form-group">
              <label for="set-address">Adresse physique (Dakar)</label>
              <input type="text" id="set-address" class="form-input" value="${s.address}">
            </div>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label for="set-wave">N° Téléphone Wave (Sénégal) *</label>
              <input type="text" id="set-wave" class="form-input" value="${s.wave_number}">
            </div>
            <div class="form-group">
              <label for="set-om">N° Téléphone Orange Money *</label>
              <input type="text" id="set-om" class="form-input" value="${s.om_number}">
            </div>
          </div>

          <div class="form-group">
            <label for="set-bank">Coordonnées du compte Bancaire</label>
            <input type="text" id="set-bank" class="form-input" value="${s.bank_account}">
          </div>

          <div class="form-group">
            <label for="set-msg">Message imprimé en pied de reçu *</label>
            <input type="text" id="set-msg" class="form-input" value="${s.receipt_message}" required>
          </div>

          <div class="form-group">
            <label for="set-terms">Conditions de vente</label>
            <textarea id="set-terms" class="form-input">${s.sale_terms}</textarea>
          </div>

          <div style="text-align: right; margin-top:20px;">
            <button type="submit" class="btn-success"><i class="fa-solid fa-floppy-disk"></i> Enregistrer les paramètres</button>
          </div>
        </form>
      </div>
    `;
  },

  // Rendu de Reçu HTML pour PDF / Impression
  ReceiptMarkup(shopSettings, sale, items, customer) {
    let itemsRows = '';
    items.forEach(it => {
      itemsRows += `
        <tr>
          <td>
            <div style="font-weight: 600; color: #0F172A; text-align: left;">${it.name}</div>
            <div style="font-size: 10px; color: #64748B; margin-top: 2px; text-align: left;">${it.quantity} x ${this.formatFCFA(it.unitPrice)}</div>
          </td>
          <td style="text-align: right; vertical-align: middle; font-weight: 600; color: #0F172A;">${this.formatFCFA(it.totalPosition)}</td>
        </tr>
      `;
    });

    return `
      <div class="receipt-layout">
        <div class="receipt-header">
          <img src="/img/logo.png" alt="Logo" style="height: 64px; width: auto; object-fit: contain; margin: 0 auto 12px auto; display: block;">
          <div class="shop-name">MA ZONE DKR</div>
          <div style="font-size:10px; color:#64748B; margin-top:6px; line-height:1.4;">
            ${shopSettings.address}<br>
            Tél: ${shopSettings.phone}<br>
            Wave: ${shopSettings.wave_number}
          </div>
        </div>

        <div class="receipt-divider"></div>

        <div style="font-weight: 400; font-size: 11px; margin-bottom: 8px; line-height: 1.5; color: #334155;">
          <div style="display:flex; justify-content:space-between;"><span><strong>Facture N°:</strong></span><span>#${sale.receiptNumber}</span></div>
          <div style="display:flex; justify-content:space-between;"><span><strong>Date:</strong></span><span>${new Date(sale.date).toLocaleString('fr-FR')}</span></div>
          <div style="display:flex; justify-content:space-between;"><span><strong>Client:</strong></span><span>${customer ? customer.name : 'Vente au comptant'}</span></div>
          ${customer && customer.phone ? `<div style="display:flex; justify-content:space-between;"><span><strong>Tél Client:</strong></span><span>${customer.phone}</span></div>` : ''}
        </div>

        <div class="receipt-divider"></div>

        <table class="receipt-items-table">
          <thead>
            <tr>
              <th style="text-align: left; font-family:inherit;">Désignation / Qté</th>
              <th style="text-align: right; font-family:inherit;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="receipt-divider"></div>

        <div class="receipt-summary">
          <div class="receipt-details-row">
            <span>Sous-Total:</span>
            <span style="font-weight:600;">${this.formatFCFA(sale.subtotal)}</span>
          </div>
          ${sale.discount > 0 ? `
            <div class="receipt-details-row" style="color:var(--crimson);">
              <span>Remise:</span>
              <span style="font-weight:600;">-${this.formatFCFA(sale.discount)}</span>
            </div>
          ` : ''}
          <div class="receipt-details-row" style="font-weight: 800; font-size:13px; color:#0F172A; border-top:1px solid #CBD5E1; padding-top:6px; margin-top:6px;">
            <span>TOTAL:</span>
            <span>${this.formatFCFA(sale.totalAmount)}</span>
          </div>
          <div class="receipt-details-row" style="color:#0F172A;">
            <span>Montant Réglé:</span>
            <span style="font-weight:600;">${this.formatFCFA(sale.paidAmount)}</span>
          </div>
          ${sale.balanceDue > 0 ? `
            <div class="receipt-details-row" style="color:var(--crimson); font-weight:bold;">
              <span>Reste à payer:</span>
              <span>${this.formatFCFA(sale.balanceDue)}</span>
            </div>
          ` : ''}
          <div class="receipt-details-row" style="font-size:10px; color:#64748B;">
            <span>Mode règlement:</span>
            <span>${sale.paymentMethod}</span>
          </div>
        </div>

        <div class="receipt-divider"></div>

        <div class="receipt-footer">
          <strong style="color: #0F172A;">${shopSettings.receipt_message}</strong><br>
          <span style="font-size: 8px; color:#94A3B8; margin-top:8px; display:block; text-transform:uppercase; letter-spacing:0.5px;">BijouxManager v1.0 - Dakar Sénégal</span>
        </div>
      </div>
    `;
  }
};
