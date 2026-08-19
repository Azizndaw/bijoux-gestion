/**
 * CLIENT D'API - COMMUNICATION EN EXPRESS ENDPOINTS
 */
const API = {
    async handleResponse(res) {
        if (res.status === 401) {
            window.appState.user = null;
            if (window.app && typeof window.app.showLogin === 'function') {
                window.app.showLogin();
            }
            throw new Error('Session expirée ou authentification requise');
        }

        let data;
        try {
            data = await res.json();
        } catch (e) {
            data = { error: 'Réponse serveur invalide' };
        }

        if (!res.ok) {
            throw new Error(data.error || 'Une erreur est survenue');
        }
        return data;
    },

    async get(url) {
        const res = await fetch(url);
        return this.handleResponse(res);
    },

    async post(url, body) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return this.handleResponse(res);
    },

    async put(url, body) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return this.handleResponse(res);
    },

    async delete(url) {
        const res = await fetch(url, {
            method: 'DELETE'
        });
        return this.handleResponse(res);
    },

    // Auth
    login(username, password) {
        return this.post('/api/auth/login', { username, password });
    },

    logout() {
        return this.post('/api/auth/logout', {});
    },

    getMe() {
        return this.get('/api/auth/me');
    },

    // Categories
    getCategories() {
        return this.get('/api/categories');
    },

    createCategory(name) {
        return this.post('/api/categories', { name });
    },

    // Products
    getProducts() {
        return this.get('/api/products');
    },

    createProduct(data) {
        return this.post('/api/products', data);
    },

    updateProduct(id, data) {
        return this.put(`/api/products/${id}`, data);
    },

    deleteProduct(id) {
        return this.delete(`/api/products/${id}`);
    },

    // Customers & Suppliers
    getCustomers() {
        return this.get('/api/customers');
    },

    createCustomer(data) {
        return this.post('/api/customers', data);
    },

    deleteCustomer(id) {
        return this.delete(`/api/customers/${id}`);
    },

    getSuppliers() {
        return this.get('/api/suppliers');
    },

    createSupplier(data) {
        return this.post('/api/suppliers', data);
    },

    // Stock
    getStockMovements() {
        return this.get('/api/stock/movements');
    },

    adjustStock(data) {
        return this.post('/api/stock/adjust', data);
    },

    saveInventory(items) {
        return this.post('/api/stock/inventory', { items });
    },

    // Caisse / Treasury
    getCaisseSession() {
        return this.get('/api/caisse/sessions/current');
    },

    openCaisse(initialBalance) {
        return this.post('/api/caisse/sessions/open', { initialBalance });
    },

    cancelCaisseSession() {
        return this.delete('/api/caisse/sessions/current');
    },

    deleteCaisseMovement(id) {
        return this.delete(`/api/caisse/movements/${id}`);
    },

    closeCaisse(finalBalanceReal, justification) {
        return this.post('/api/caisse/sessions/close', { finalBalanceReal, justification });
    },

    getTreasury() {
        return this.get('/api/caisse/treasury');
    },

    // Purchases
    getPurchases() {
        return this.get('/api/purchases');
    },

    createPurchase(data) {
        return this.post('/api/purchases', data);
    },

    payPurchaseDebt(purchaseId, amount, paymentMethod, date) {
        return this.post(`/api/purchases/${purchaseId}/payment`, { amount, paymentMethod, date });
    },

    // Sales
    getSales() {
        return this.get('/api/sales');
    },

    getSale(id) {
        return this.get(`/api/sales/${id}`);
    },

    createSale(data) {
        return this.post('/api/sales', data);
    },

    payCustomerDebt(saleId, amount, paymentMethod, date) {
        return this.post(`/api/sales/${saleId}/payment`, { amount, paymentMethod, date });
    },

    deleteSale(id) {
        return this.delete(`/api/sales/${id}`);
    },

    // Expenses
    getExpenses() {
        return this.get('/api/expenses');
    },

    createExpense(data) {
        return this.post('/api/expenses', data);
    },

    // Settings
    getSettings() {
        return this.get('/api/settings');
    },

    updateSettings(data) {
        return this.put('/api/settings', data);
    },

    // Goals
    getGoals() {
        return this.get('/api/goals');
    },

    createGoal(data) {
        return this.post('/api/goals', data);
    },

    // Audits & Notifications
    getAuditLogs() {
        return this.get('/api/audit');
    },

    getNotifications() {
        return this.get('/api/notifications');
    },

    // Reports & Dashboard
    getDashboardReports(period = 'ce_mois') {
        return this.get(`/api/reports/dashboard?period=${period}`);
    },

    getProfitabilityReports() {
        return this.get('/api/reports/profitability');
    }
};
