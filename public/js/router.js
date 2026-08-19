/**
 * ROUTEUR CLIENT POUR SINGLE PAGE APPLICATION (SPA)
 */
class AppRouter {
    constructor() {
        this.routes = {};
        this.currentHash = null;
        this.onBeforeRoute = null;
        this.onRouteChanged = null;
    }

    // Enregistrer une route
    route(hash, roles, renderFn) {
        this.routes[hash] = {
            roles: roles || null, // Rôles autorisés (null = tous)
            render: renderFn
        };
    }

    // Initialiser les écouteurs de changements
    init() {
        // Écouter le hachage d'URL
        window.addEventListener('hashchange', () => this.executeRouting());

        // Capturer les clics sur les items de menu sidebar
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.navigate(page);
            });
        });
    }

    // Naviguer vers une route
    navigate(hash) {
        if (window.location.hash === '#' + hash || (window.location.hash === '' && hash === 'dashboard')) {
            this.executeRouting();
        } else {
            window.location.hash = hash;
        }
    }

    // Exécuter le routage
    async executeRouting() {
        const hash = window.location.hash.substring(1) || 'dashboard';

        if (this.onBeforeRoute) {
            const allowed = await this.onBeforeRoute(hash);
            if (!allowed) return;
        }

        const route = this.routes[hash];
        if (!route) {
            console.error(`Route #${hash} non définie. Redirection...`);
            this.navigate('dashboard');
            return;
        }

        // Vérifier les permissions de rôles
        if (route.roles && window.appState && window.appState.user) {
            const userRole = window.appState.user.role;
            if (!route.roles.includes(userRole)) {
                alert(`Accès interdit : Votre rôle de "${userRole}" ne permet pas d'accéder à cette rubrique.`);
                this.navigate('dashboard');
                return;
            }
        }

        this.currentHash = hash;

        // Mettre à jour l'apparence active de la sidebar
        document.querySelectorAll('.menu-item').forEach(item => {
            if (item.getAttribute('data-page') === hash) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Rendre le composant principal
        try {
            if (typeof route.render === 'function') {
                const contentArea = document.getElementById('content-area');
                // Rendre l'état de chargement
                contentArea.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:300px; color:var(--primary); font-size:24px;"><i class="fa-solid fa-spinner fa-spin"></i> &nbsp; Chargement...</div>';

                await route.render(contentArea);
            }
        } catch (err) {
            console.error(`Erreur lors du rendu de la vue #${hash}:`, err);
            document.getElementById('content-area').innerHTML = `
        <div style="background-color:#FEE2E2; border:1px solid #EF4444; color:#B91C1C; padding:24px; border-radius:var(--radius-md); margin-top:20px;">
          <h3>Une erreur est survenue lors du chargement de la page</h3>
          <p>${err.message}</p>
        </div>
      `;
        }

        if (this.onRouteChanged) {
            this.onRouteChanged(hash);
        }
    }
}

window.Router = new AppRouter();
