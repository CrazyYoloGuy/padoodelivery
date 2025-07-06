class ShopApp {
    constructor() {
        this.currentPage = 'profile';
        this.sessionToken = null;
        this.currentShop = null;
        this.notifications = [];
        this.selectedDrivers = [];
        this.searchResults = [];
        this.currentSearchTerm = '';
        this.currentSearchPage = 1;
        this.ws = null;
        this.audioContext = null;
        this.notificationAudio = null;
        this.isAudioEnabled = localStorage.getItem('notificationSound') !== 'false';
        this.userId = localStorage.getItem('userId');
        this.shopId = localStorage.getItem('shopId');
        
        // Add caching and loading state management
        this.teamMembersCache = null;
        this.teamMembersCacheTime = null;
        this.isLoadingTeamMembers = false;
        this.loadingPromises = new Map(); // Prevent duplicate API calls
        
        this.driverSearchCache = {};
        this.driverSearchDebounce = null;
        
        this.init();
    }
    
    async init() {
        console.log('Shop app initializing...');
        
        // Check if shop is logged in
        if (!this.checkAuthStatus()) {
            console.log('No valid session found, redirecting to login...');
            window.location.href = '/';
            return;
        }
        
        // Prevent back button navigation to login page
        window.history.replaceState(null, null, window.location.href);
        window.addEventListener('popstate', () => {
            window.history.pushState(null, null, window.location.href);
        });
        
        // Initialize app components
        this.bindEvents();
        this.updateCurrentDate();
        await this.loadShopData();
        
        // Initialize real-time features
        this.initializeAudio();
        this.connectWebSocket();
        
        // Request notification permission
        this.requestNotificationPermission();
        
        // Preload team members for better performance
        this.preloadTeamMembers();
        
        // Navigate to alerts page
        this.navigateToPage('alerts');
        
        console.log('Shop app initialized successfully');
    }
    
    // Add preload method for better performance
    async preloadTeamMembers() {
        try {
            console.log('🚀 Preloading team members for better performance...');
            await this.loadSelectedDriversOptimized();
        } catch (error) {
            console.warn('⚠️ Preload failed, team members will load on demand:', error.message);
        }
    }
    
    // Optimized version of loadSelectedDrivers with caching and error handling
    async loadSelectedDriversOptimized(forceRefresh = false) {
        const cacheKey = `selectedDrivers-${this.currentShop?.id}`;
        
        // Check if already loading to prevent duplicate calls
        if (this.loadingPromises.has(cacheKey)) {
            console.log('⏳ Team members already loading, waiting for existing request...');
            return await this.loadingPromises.get(cacheKey);
        }
        
        // Check cache first (5 minutes cache)
        const now = Date.now();
        const cacheAge = this.teamMembersCacheTime ? now - this.teamMembersCacheTime : Infinity;
        const cacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes
        
        if (!forceRefresh && cacheValid && this.teamMembersCache) {
            console.log('✅ Using cached team members');
            this.selectedDrivers = [...this.teamMembersCache];
            return this.selectedDrivers;
        }
        
        // Create loading promise
        const loadingPromise = this.fetchTeamMembers();
        this.loadingPromises.set(cacheKey, loadingPromise);
        
        try {
            const result = await loadingPromise;
            return result;
        } finally {
            // Clean up loading promise
            this.loadingPromises.delete(cacheKey);
        }
    }
    
    // Separate fetch method for cleaner code
    async fetchTeamMembers() {
        try {
            const shopId = this.currentShop?.id;
            
            if (!shopId) {
                throw new Error('No shop ID available');
            }
            
            console.log(`🔄 Fetching team members for shop: ${shopId}`);
            this.isLoadingTeamMembers = true;
            
            // Add timeout for reliability
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`/api/shop/${shopId}/selected-drivers`, {
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to load team members');
            }
            
            // Update cache
            this.teamMembersCache = [...result.selectedDrivers];
            this.teamMembersCacheTime = Date.now();
            this.selectedDrivers = [...result.selectedDrivers];
            
            console.log(`✅ Successfully loaded ${this.selectedDrivers.length} team members`);
            
            return this.selectedDrivers;
            
        } catch (error) {
            console.error('❌ Error fetching team members:', error);
            
            // If we have cached data, use it as fallback
            if (this.teamMembersCache) {
                console.log('📦 Using cached team members as fallback');
                this.selectedDrivers = [...this.teamMembersCache];
                return this.selectedDrivers;
            }
            
            // Otherwise set empty array
            this.selectedDrivers = [];
            throw error;
        } finally {
            this.isLoadingTeamMembers = false;
        }
    }
    
    // Enhanced version of loadDeliveryTeam with better loading states
    async loadDeliveryTeam() {
        try {
            console.log('🏗️ Loading delivery team for alerts page...');
            
            // Show loading state immediately
            this.renderDeliveryTeamLoading();
            
            // Load team members with optimization
            await this.loadSelectedDriversOptimized();
            
            // Render the actual team
            this.renderDeliveryTeamForAlerts();
            
        } catch (error) {
            console.error('❌ Error loading delivery team:', error);
            this.renderDeliveryTeamError(error.message);
        }
    }
    
    // Add loading state renderer
    renderDeliveryTeamLoading() {
        const container = document.getElementById('delivery-team-container');
        const countElement = document.getElementById('team-count');
        
        if (countElement) {
            countElement.textContent = '...';
        }
        
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner">
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>
                    <p>Loading team members...</p>
                </div>
            `;
        }
    }
    
    // Add error state renderer
    renderDeliveryTeamError(errorMessage) {
        const container = document.getElementById('delivery-team-container');
        const countElement = document.getElementById('team-count');
        
        if (countElement) {
            countElement.textContent = '!';
        }
        
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h4>Failed to load team members</h4>
                    <p>${errorMessage}</p>
                    <button class="retry-btn" onclick="shopApp.refreshTeamMembers()">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    }
    
    // Add refresh method that users can trigger
    async refreshTeamMembers() {
        try {
            console.log('🔄 Manually refreshing team members...');
            this.showToast('Refreshing team members...', 'info');
            
            // Clear cache and force refresh
            this.teamMembersCache = null;
            this.teamMembersCacheTime = null;
            
            await this.loadDeliveryTeam();
            this.showToast('Team members refreshed successfully!', 'success');
            
        } catch (error) {
            console.error('Error refreshing team members:', error);
            this.showToast('Failed to refresh team members', 'error');
        }
    }
    
    // Update the original loadSelectedDrivers to use the optimized version
    async loadSelectedDrivers() {
        return await this.loadSelectedDriversOptimized();
    }
    
    // Enhanced renderDeliveryTeamForAlerts with better performance
    renderDeliveryTeamForAlerts() {
        const container = document.getElementById('delivery-team-container');
        const countElement = document.getElementById('team-count');
        
        if (!container) {
            console.warn('Delivery team container not found');
            return;
        }
        
        // Update count with current data
        const teamCount = this.selectedDrivers?.length || 0;
        if (countElement) {
            countElement.textContent = teamCount;
        }
        
        // Handle empty state
        if (teamCount === 0) {
            container.innerHTML = `
                <div class="empty-team">
                    <div class="empty-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <h4>No team members yet</h4>
                    <p>Add drivers to your delivery team to get started</p>
                    <button class="add-team-btn" onclick="shopApp.navigateToPage('settings')">
                        <i class="fas fa-plus"></i> Add Team Members
                    </button>
                </div>
            `;
            return;
        }
        
        // Create optimized team list with virtual scrolling for large teams
        const teamHTML = this.selectedDrivers.map((driver, index) => `
            <div class="team-member-card" data-driver-id="${driver.id}" style="animation-delay: ${index * 50}ms">
                <div class="team-member-avatar">
                    <i class="fas fa-user"></i>
                    <div class="status-indicator online"></div>
                </div>
                <div class="team-member-info">
                    <div class="team-member-name">${driver.email}</div>
                    <div class="team-member-meta">
                        <span class="join-date">
                            <i class="fas fa-calendar"></i>
                            ${this.formatDate(driver.created_at)}
                        </span>
                    </div>
                </div>
                <div class="team-member-actions">
                    <button class="micro-btn notify" onclick="shopApp.notifyDriver('${driver.id}')" title="Send notification">
                        <i class="fas fa-bell"></i>
                    </button>
                    <button class="micro-btn remove" onclick="shopApp.removeDriver('${driver.id}')" title="Remove from team">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = `
            <div class="team-members-grid">
                ${teamHTML}
            </div>
            <div class="my-team-actions">
                <button class="btn btn-primary" onclick="shopApp.refreshTeamMembers()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
                <button class="btn btn-secondary" onclick="shopApp.navigateToPage('settings')">
                    <i class="fas fa-cog"></i> Manage Team
                </button>
            </div>
        `;
        
        console.log(`✅ Rendered ${teamCount} team members`);
    }
    
    checkAuthStatus() {
        // Check for shop session (new format from login)
        const storedShopSession = localStorage.getItem('shopSession');
        
        if (storedShopSession) {
            try {
                const sessionData = JSON.parse(storedShopSession);
                if (sessionData.shop && sessionData.sessionToken) {
                    this.currentShop = sessionData.shop;
                    this.sessionToken = sessionData.sessionToken;
                    console.log('✅ Shop authenticated:', this.currentShop.shop_name || this.currentShop.email);
                    console.log('Shop ID:', this.currentShop.id);
                    return true;
                }
            } catch (error) {
                console.error('Error parsing shop session:', error);
                localStorage.removeItem('shopSession');
            }
        }
        
        // Fallback: check old format
        const storedShop = localStorage.getItem('deliveryAppShop');
        const storedSession = localStorage.getItem('deliveryAppShopSession');
        
        if (storedShop && storedSession) {
            try {
                this.currentShop = JSON.parse(storedShop);
                this.sessionToken = storedSession;
                console.log('✅ Shop authenticated (legacy):', this.currentShop.shop_name);
                console.log('Shop ID (legacy):', this.currentShop.id);
                return true;
            } catch (error) {
                console.error('Error parsing legacy shop data:', error);
            }
        }
        
        console.log('❌ Shop not authenticated');
        return false;
    }
    
    bindEvents() {
        console.log('Binding events');
        
        // Bottom Navigation - use proper event delegation
        document.querySelectorAll('.nav-item').forEach(navItem => {
            navItem.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                if (page) {
                    console.log('Navigation clicked:', page);
                    this.navigateToPage(page);
                }
            });
        });
        
        // Navigation (if any top nav exists)
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                if (page) {
                    this.navigateToPage(page);
                }
            });
        });
        
        // Logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
        // Logout button in profile page
        const profileLogoutBtn = document.querySelector('.logout-btn');
        if (profileLogoutBtn) {
            profileLogoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
        // Change password button
        const changePasswordBtn = document.getElementById('change-password-btn');
        if (changePasswordBtn) {
            console.log('Found change password button, binding click event');
            changePasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Change password button clicked');
                this.showPasswordModal();
            });
        } else {
            console.warn('Change password button not found in the DOM');
        }
        
        // Global click handler for dynamic elements
        document.addEventListener('click', (e) => {
            // Prevent handling if in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            // Handle clicks on driver cards to show details
            if (e.target.closest('.driver-card')) {
                const driverId = e.target.closest('.driver-card').dataset.id;
                if (driverId) {
                    this.showDriverDetails(driverId);
                }
                return;
            }
            
            // Handle modal close buttons
            if (e.target.classList.contains('close-btn') || e.target.closest('.close-btn')) {
                this.closeModal();
                return;
            }
        });
    }
    
    navigateToPage(page) {
        console.log('Navigating to page:', page);
        
        // Update active navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNavItem = document.querySelector(`[data-page="${page}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        
        // Show selected page
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        this.currentPage = page;
        
        // Handle page-specific logic with optimized loading
        switch(page) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'orders':
                this.loadOrdersData();
                break;
            case 'alerts':
                this.loadNotifications(); // This will call loadDeliveryTeamFast
                break;
            case 'notifications':
                this.loadNotificationsPage();
                break;
            case 'settings':
                this.loadSettingsPage();
                // Preload team members for settings page too
                this.loadSelectedDriversOptimized();
                break;
            case 'profile':
                this.loadProfileData();
                break;
        }
    }
    
    loadPageData(page) {
        switch (page) {
            case 'alerts':
                this.loadNotifications();
                break;
            case 'settings':
                this.loadShopSettings();
                break;
            case 'profile':
                this.loadShopProfile();
                break;
        }
    }
    
    async loadShopData() {
        console.log('Loading shop data...');
        this.updateProfileDisplay();
    }
    
    updateProfileDisplay() {
        if (!this.currentShop) return;
        
        const shopNameEl = document.getElementById('profile-shop-name');
        const emailEl = document.getElementById('profile-email');
        
        if (shopNameEl) {
            shopNameEl.textContent = this.currentShop.shop_name || this.currentShop.name || 'Shop Name';
        }
        if (emailEl) {
            emailEl.textContent = this.currentShop.email;
        }
    }
    
    loadNotifications() {
        console.log('Loading notifications and delivery team...');
        
        const alertsContainer = document.getElementById('alerts-page');
        if (!alertsContainer) return;
        
        // Add delivery team section to alerts page with immediate loading state
        alertsContainer.innerHTML = `
            <div class="alerts-container">
                <div class="alerts-header">
                    <h2><i class="fas fa-bell"></i> Alerts & Team Management</h2>
                    <p>Manage your delivery team and send broadcast messages</p>
                </div>
                
                <!-- Delivery Team Section -->
                <div class="team-section">
                    <div class="section-header slim">
                        <div class="section-title">
                            <i class="fas fa-users"></i>
                            <h3>My Team <span id="team-count" class="count-badge">...</span></h3>
                        </div>
                        <div class="section-actions">
                            <button class="slim-button" id="broadcast-notification-btn">
                                <i class="fas fa-bullhorn"></i> Broadcast Message
                            </button>
                            <button class="slim-button" onclick="shopApp.navigateToPage('settings')">
                                <i class="fas fa-cog"></i> Manage Team
                            </button>
                        </div>
                    </div>
                    
                    <div id="delivery-team-container" class="team-container">
                        <div class="loading-state">
                            <div class="loading-spinner">
                                <i class="fas fa-spinner fa-spin"></i>
                            </div>
                            <p>Loading team members...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Bind notification events first
        this.bindNotificationEvents();
        
        // Load delivery team immediately with aggressive loading
        this.loadDeliveryTeamFast();
    }
    
    // Fast loading method that tries multiple strategies
    async loadDeliveryTeamFast() {
        try {
            console.log('🚀 Fast-loading delivery team...');
            
            // Strategy 1: Use cache if available and recent (even if older than 5 minutes)
            if (this.teamMembersCache && this.selectedDrivers.length === 0) {
                console.log('📦 Using cached team members for immediate display');
                this.selectedDrivers = [...this.teamMembersCache];
                this.renderDeliveryTeamForAlerts();
            }
            
            // Strategy 2: Load from server in parallel
            const loadPromise = this.loadSelectedDriversOptimized();
            
            // Strategy 3: Race with timeout to ensure something shows quickly
            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => {
                    if (this.selectedDrivers.length === 0) {
                        console.log('⏰ Timeout reached, showing empty state');
                        this.renderDeliveryTeamForAlerts();
                    }
                    resolve();
                }, 2000); // Show something after 2 seconds max
            });
            
            // Wait for either data load or timeout
            await Promise.race([loadPromise, timeoutPromise]);
            
            // Final render with whatever data we have
            this.renderDeliveryTeamForAlerts();
            
        } catch (error) {
            console.error('❌ Error in fast delivery team loading:', error);
            this.renderDeliveryTeamError(error.message);
        }
    }
    
    loadShopSettings() {
        console.log('Loading shop settings...');
        // Placeholder for future settings loading
    }
    
    loadShopProfile() {
        console.log('Loading shop profile...');
        this.updateProfileDisplay();
    }
    
    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        const currentDateElement = document.getElementById('current-date');
        if (currentDateElement) {
            currentDateElement.textContent = now.toLocaleDateString('en-US', options);
        }
    }
    
    async logout() {
        console.log('Shop logging out...');
        
        try {
            // Call server logout endpoint if we have a session token
            if (this.sessionToken) {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.sessionToken}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Error calling logout endpoint:', error);
        }
        
        // Clear stored data
        this.clearSessionData();
        
        // Clear session heartbeat interval
        if (this.sessionHeartbeatInterval) {
            clearInterval(this.sessionHeartbeatInterval);
            this.sessionHeartbeatInterval = null;
        }
        
        // Close WebSocket connection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Show logout message
        this.showToast('Logged out successfully', 'success');
        
        // Redirect to login after delay
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
    }
    
    closeModal() {
        console.log('Closing modal');
        const modal = document.querySelector('.modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }
    
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'fas fa-check-circle' : 
                     type === 'error' ? 'fas fa-exclamation-circle' : 
                     type === 'warning' ? 'fas fa-exclamation-triangle' : 
                     'fas fa-info-circle';
        
        toast.innerHTML = `
            <div class="toast-content">
                <i class="${icon}"></i>
                <span>${message}</span>
            </div>
        `;

        container.appendChild(toast);

        // Remove toast after 4 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 4000);
    }

    // Update loadSettingsPage to remove Your Delivery Team section but keep driver management
    loadSettingsPage() {
        console.log('Loading settings page...');
        
        const settingsPage = document.getElementById('settings-page');
        if (!settingsPage) return;
        
        settingsPage.innerHTML = `
            <div class="settings-container">
                <div class="settings-header">
                    <h2><i class="fas fa-cog"></i> Shop Settings</h2>
                    <p>Manage your shop preferences and delivery team</p>
                </div>

                <!-- Delivery Team Management -->
                <div class="settings-section">
                    <div class="section-header">
                        <h3><i class="fas fa-truck"></i> Delivery Team Management</h3>
                        <p>Find and add delivery drivers to your team</p>
                    </div>

                    <!-- Search and Filters -->
                    <div class="search-controls">
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="driver-search" placeholder="Search drivers by email...">
                        </div>
                        <div class="filter-controls">
                            <span class="results-count" id="results-count">Loading...</span>
                        </div>
                    </div>

                    <!-- Available Drivers -->
                    <div class="drivers-section">
                        <h4>Available Drivers</h4>
                        <div id="drivers-list" class="drivers-grid">
                            <div class="loading">
                                <i class="fas fa-spinner fa-spin"></i>
                                Loading drivers...
                            </div>
                        </div>
                        
                        <!-- Pagination -->
                        <div id="pagination" class="pagination-controls">
                            <!-- Pagination will be rendered here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Initialize delivery management
        setTimeout(() => {
            this.initDeliveryManagement();
        }, 100);
    }

    // Add delivery management functionality
    initDeliveryManagement() {
        console.log('Initializing delivery management...');
        
        this.currentPage = 1;
        this.driversPerPage = 10;
        this.searchTerm = '';
        this.selectedDrivers = [];
        this.totalPages = 1;
        
        this.bindSettingsEvents();
        this.loadDrivers();
        this.loadSelectedDrivers();
    }

    bindSettingsEvents() {
        // Search functionality with debounce
        const searchInput = document.getElementById('driver-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.driverSearchDebounce);
                this.searchTerm = e.target.value;
                this.currentPage = 1;
                this.driverSearchDebounce = setTimeout(() => {
                this.loadDrivers();
                }, 250); // 250ms debounce
            });
        }
        
        // Notification button
        const notificationBtn = document.getElementById('send-notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.sendNotification();
            });
        }
    }

    async loadDrivers() {
        try {
            // If no search term, only load 5 random drivers (no pagination)
            const isSearch = !!this.searchTerm;
            const params = new URLSearchParams({
                page: isSearch ? this.currentPage : 1,
                limit: isSearch ? this.driversPerPage : 5,
                search: this.searchTerm || ''
            });
            const response = await fetch(`/api/shop/delivery-drivers?${params}`);
            const result = await response.json();
            if (result.success) {
                const filteredDrivers = result.drivers.filter(driver => 
                    !this.selectedDrivers.some(selected => selected.id === driver.id)
                );
                // If not searching, do not paginate, just show the 5 random drivers
                if (!isSearch) {
                    this.renderDrivers(filteredDrivers);
                    this.renderPagination({ totalPages: 1, currentPage: 1, hasNext: false, hasPrevious: false });
                    this.updateResultsCount(filteredDrivers.length);
                    this.totalPages = 1;
                } else {
                const filteredTotalCount = result.pagination.totalCount - this.selectedDrivers.length;
                const filteredTotalPages = Math.max(1, Math.ceil(filteredTotalCount / this.driversPerPage));
                    const pagination = {
                    ...result.pagination,
                    totalCount: filteredTotalCount,
                    totalPages: filteredTotalPages
                    };
                    this.renderDrivers(filteredDrivers);
                    this.renderPagination(pagination);
                this.updateResultsCount(filteredTotalCount);
                this.totalPages = filteredTotalPages;
                }
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error loading drivers:', error);
            this.showToast('Failed to load drivers', 'error');
        }
    }

    renderDrivers(drivers) {
        const container = document.getElementById('drivers-list');
        if (!container) return;
        
        if (drivers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h4>No drivers found</h4>
                    <p>Try adjusting your search terms</p>
                </div>
            `;
            return;
        }
        
        const driversHTML = drivers.map(driver => `
            <div class="driver-card" data-driver-id="${driver.id}">
                <div class="driver-info">
                    <div class="driver-email">${driver.email}</div>
                    <div class="driver-meta">
                        <i class="fas fa-calendar"></i>
                        Joined ${this.formatDate(driver.created_at)}
                    </div>
                </div>
                <div class="driver-actions">
                    <button class="add-driver-btn" onclick="shopApp.addDriver('${driver.id}', '${driver.email}')">
                        <i class="fas fa-plus"></i>
                        Add to Team
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = driversHTML;
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container) return;
        
        if (pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${!pagination.hasPrevious ? 'disabled' : ''} 
                    onclick="shopApp.changePage(${pagination.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, pagination.currentPage - 2);
        const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === pagination.currentPage ? 'active' : ''}" 
                        onclick="shopApp.changePage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${!pagination.hasNext ? 'disabled' : ''} 
                    onclick="shopApp.changePage(${pagination.currentPage + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        // Page info
        paginationHTML += `
            <span class="page-info">
                Page ${pagination.currentPage} of ${pagination.totalPages}
            </span>
        `;
        
        container.innerHTML = paginationHTML;
    }

    renderSelectedDrivers() {
        const container = document.getElementById('selected-drivers');
        const countElement = document.getElementById('selected-count');
        
        if (countElement) {
            countElement.textContent = this.selectedDrivers.length;
        }
        
        if (!container) return;
        
        if (this.selectedDrivers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h4>No drivers selected</h4>
                    <p>Add drivers to your delivery team to get started</p>
                </div>
            `;
            return;
        }
        
        // Use alert-item style to match the alerts page
        const selectedHTML = this.selectedDrivers.map(driver => `
            <div class="alert-item driver-alert-item">
                <div class="driver-alert-content">
                    <div class="driver-alert-header">
                        <div class="driver-alert-info">
                            <span class="driver-name"><i class="fas fa-user"></i> ${driver.email}</span>
                        </div>
                        <button class="remove-driver-btn" onclick="shopApp.removeDriver('${driver.id}')">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="driver-alert-actions">
                        <button class="notify-driver-btn" onclick="shopApp.notifyDriver('${driver.id}')">
                            <i class="fas fa-bell"></i> Send Notification
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = selectedHTML;
    }

    updateResultsCount(count) {
        const element = document.getElementById('results-count');
        if (element) {
            element.textContent = `${count} driver${count !== 1 ? 's' : ''} found`;
        }
    }

    updateNotificationCount() {
        const element = document.getElementById('notification-count');
        if (element) {
            element.textContent = this.selectedDrivers.length;
        }
    }

    changePage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.loadDrivers();
        }
    }

    async addDriver(driverId, driverEmail) {
        try {
            // Get shop ID from the current shop object
            const shopId = this.currentShop.id;
            
            if (!shopId) {
                console.error('No shop ID available');
                return;
            }
            
            console.log(`Adding driver ${driverId} to shop ${shopId}`);
            
            // Show loading feedback
            this.showToast('Adding driver to team...', 'info');
            
            const response = await fetch(`/api/shop/${shopId}/add-driver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ driverId })
            });
            
            const result = await response.json();
            
            // Handle duplicate driver error gracefully
            const isDuplicate = result.code === '23505' || (result.message && result.message.toLowerCase().includes('duplicate key'));
            if (result.success || isDuplicate) {
                if (isDuplicate) {
                    this.showToast('Driver is already in your team.', 'info');
                } else {
                this.showToast('Driver added to your team successfully!', 'success');
                }
                // Clear cache to ensure fresh data
                this.teamMembersCache = null;
                this.teamMembersCacheTime = null;
                // Optimistically add to current list for immediate UI update
                const newDriver = {
                    id: driverId,
                    email: driverEmail,
                    created_at: new Date().toISOString()
                };
                if (!this.selectedDrivers.find(d => d.id === driverId)) {
                    this.selectedDrivers.push(newDriver);
                }
                // Remove the driver from the available drivers list instantly
                // Find all cached driver lists and remove the driver
                Object.keys(this.driverSearchCache).forEach(cacheKey => {
                    const cache = this.driverSearchCache[cacheKey];
                    if (cache && cache.data && cache.data.filteredDrivers) {
                        cache.data.filteredDrivers = cache.data.filteredDrivers.filter(d => d.id !== driverId);
                        // Optionally update the count
                        if (cache.data.pagination) {
                            cache.data.pagination.totalCount = Math.max(0, cache.data.pagination.totalCount - 1);
                        }
                    }
                });
                // Re-render the drivers list for the current page
                this.loadDrivers();
                // Update UI everywhere else
                    this.renderSelectedDrivers();
                    this.updateNotificationCount();
                    this.renderDeliveryTeamForAlerts();
                // Refresh data in background to ensure accuracy
                setTimeout(() => {
                    this.loadSelectedDriversOptimized(true);
                }, 500);
            } else {
                throw new Error(result.message || 'Failed to add driver to team');
            }
        } catch (error) {
            // If error is duplicate, handle gracefully
            if (error && error.message && error.message.toLowerCase().includes('duplicate key')) {
                this.showToast('Driver is already in your team.', 'info');
                if (!this.selectedDrivers.find(d => d.id === driverId)) {
                    this.selectedDrivers.push({ id: driverId, email: driverEmail, created_at: new Date().toISOString() });
                }
                // Remove from available drivers instantly
                Object.keys(this.driverSearchCache).forEach(cacheKey => {
                    const cache = this.driverSearchCache[cacheKey];
                    if (cache && cache.data && cache.data.filteredDrivers) {
                        cache.data.filteredDrivers = cache.data.filteredDrivers.filter(d => d.id !== driverId);
                        if (cache.data.pagination) {
                            cache.data.pagination.totalCount = Math.max(0, cache.data.pagination.totalCount - 1);
                        }
                    }
                });
                this.loadDrivers();
                this.renderSelectedDrivers();
                this.updateNotificationCount();
                this.renderDeliveryTeamForAlerts();
                setTimeout(() => {
                    this.loadSelectedDriversOptimized(true);
                }, 500);
            } else {
            console.error('Error adding driver:', error);
            this.showToast(`Failed to add driver: ${error.message}`, 'error');
            }
        }
    }

    async removeDriver(driverId) {
        // Show custom modal instead of confirm()
        const modalId = `remove-driver-modal-${driverId}`;
        if (document.getElementById(modalId)) return; // Prevent duplicate modals
        const driver = this.selectedDrivers.find(d => d.id === driverId);
        const driverEmail = driver ? driver.email : '';
        const modalHTML = `
            <div id="${modalId}" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-times"></i> Remove Driver</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to remove <strong>${this.escapeHTML(driverEmail)}</strong> from your team?</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn secondary close-modal">Cancel</button>
                        <button class="btn danger" id="confirm-remove-driver-btn-${driverId}">
                            <i class="fas fa-user-times"></i> Remove
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById(modalId);
        // Close modal on click
        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        // Confirm remove
        document.getElementById(`confirm-remove-driver-btn-${driverId}`).addEventListener('click', async () => {
            modal.remove();
            try {
            // Get shop ID from the current shop object
            const shopId = this.currentShop.id;
            if (!shopId) {
                console.error('No shop ID available');
                return;
            }
            this.showToast('Removing driver from team...', 'info');
            const response = await fetch(`/api/shop/${shopId}/remove-driver/${driverId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();
            if (result.success) {
                this.showToast('Driver removed from your team successfully!', 'success');
                this.teamMembersCache = null;
                this.teamMembersCacheTime = null;
                this.selectedDrivers = this.selectedDrivers.filter(d => d.id !== driverId);
                this.renderSelectedDrivers();
                this.updateNotificationCount();
                    this.renderDeliveryTeamForAlerts();
                    this.loadDrivers();
                setTimeout(() => {
                    this.loadSelectedDriversOptimized(true);
                }, 500);
            } else {
                throw new Error(result.message || 'Failed to remove driver from team');
            }
        } catch (error) {
            console.error('Error removing driver:', error);
            this.showToast(`Failed to remove driver: ${error.message}`, 'error');
        }
        });
    }

    async notifyDriver(driverId) {
        try {
            const driver = this.selectedDrivers.find(d => d.id === driverId);
            if (!driver) {
                this.showToast('Driver not found', 'error');
                return;
            }
            
            // Open notification modal
            const modalHTML = `
                <div id="notify-driver-modal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3><i class="fas fa-paper-plane"></i> Send Notification</h3>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p>Send a notification to <strong>${driver.email}</strong></p>
                            <textarea id="driver-notification-message" placeholder="Type your message here..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button class="btn secondary close-modal">Cancel</button>
                            <button class="btn primary" id="send-driver-notification-btn">
                                <i class="fas fa-paper-plane"></i> Send
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Bind events
            const modal = document.getElementById('notify-driver-modal');
            const closeButtons = modal.querySelectorAll('.close-modal');
            const sendButton = document.getElementById('send-driver-notification-btn');
            
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.remove();
                });
            });
            
            sendButton.addEventListener('click', async () => {
                // Get message from textarea
                const message = document.getElementById('driver-notification-message').value.trim();
                if (!message) {
                    this.showToast('Please enter a message', 'error');
                    return;
                }
                
                // Get shop ID from the current shop object
                const shopId = this.currentShop.id;
                
                if (!shopId) {
                    this.showToast('Shop ID not available', 'error');
                    return;
                }
                
                // Send notification
                try {
                    const response = await fetch(`/api/shop/${shopId}/notify-driver/${driverId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ message })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.showToast(result.message, 'success');
                        modal.remove();
                    } else {
                        throw new Error(result.message || 'Failed to send notification');
                    }
                } catch (error) {
                    console.error('Error sending notification:', error);
                    this.showToast('Failed to send notification', 'error');
                }
            });
            
            // Focus textarea
            setTimeout(() => {
                document.getElementById('driver-notification-message').focus();
            }, 100);
        } catch (error) {
            console.error('Error preparing notification:', error);
            this.showToast('Failed to prepare notification', 'error');
        }
    }

    async sendBroadcastNotification() {
        try {
            if (!this.selectedDrivers || this.selectedDrivers.length === 0) {
                this.showToast('No drivers in your team to notify', 'error');
                return;
            }
            
            // Create a broadcast modal
            const modalHTML = `
                <div id="broadcast-modal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3><i class="fas fa-paper-plane"></i> Send Team Notification</h3>
                            <button class="close-modal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <p>Send a notification to all ${this.selectedDrivers.length} team members</p>
                            <textarea id="broadcast-message" placeholder="Type your message here..."></textarea>
                        </div>
                        <div class="modal-footer">
                            <button class="btn secondary close-modal">Cancel</button>
                            <button class="btn primary" id="send-broadcast-btn">
                                <i class="fas fa-paper-plane"></i> Send to All
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHTML);
            
            // Bind events
            const modal = document.getElementById('broadcast-modal');
            const closeButtons = modal.querySelectorAll('.close-modal');
            const sendButton = document.getElementById('send-broadcast-btn');
            
            closeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.remove();
                });
            });
            
            sendButton.addEventListener('click', async () => {
                // Get message from textarea
                const message = document.getElementById('broadcast-message').value.trim();
                if (!message) {
                    this.showToast('Please enter a message', 'error');
                    return;
                }
                
                // Get shop ID from the current shop object
                const shopId = this.currentShop.id;
                
                if (!shopId) {
                    this.showToast('Shop ID not available', 'error');
                    return;
                }
                
                // Send broadcast notification
                try {
                    const response = await fetch(`/api/shop/${shopId}/notify-team`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ message })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.showToast(result.message, 'success');
                        modal.remove();
                    } else {
                        throw new Error(result.message || 'Failed to send team notification');
                    }
                } catch (error) {
                    console.error('Error sending team notification:', error);
                    this.showToast('Failed to send team notification', 'error');
                }
            });
            
            // Focus textarea
            setTimeout(() => {
                document.getElementById('broadcast-message').focus();
            }, 100);
        } catch (error) {
            console.error('Error preparing broadcast notification:', error);
            this.showToast('Failed to prepare broadcast notification', 'error');
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    timeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);
        
        // Less than 1 minute
        if (diffInSeconds < 60) {
            return 'Just now';
        }
        
        // Less than 1 hour
        if (diffInMinutes < 60) {
            return `${diffInMinutes}m ago`;
        }
        
        // Less than 24 hours
        if (diffInHours < 24) {
            return `${diffInHours}h ago`;
        }
        
        // Less than 7 days
        if (diffInDays < 7) {
            return `${diffInDays}d ago`;
        }
        
        // More than 7 days - show actual date and time
        const today = new Date();
        
        // Check if it's from this year
        if (date.getFullYear() === today.getFullYear()) {
            // Same year - show month, day, and time
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            // Different year - show full date
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    // Add method to load delivery team on alerts page
    async loadDeliveryTeam() {
        try {
            // If we don't have selected drivers yet, initialize them
            if (!this.selectedDrivers) {
                this.selectedDrivers = [];
                await this.loadSelectedDrivers();
            }
            
            // Render delivery team on alerts page
            this.renderDeliveryTeamForAlerts();
        } catch (error) {
            console.error('Error loading delivery team:', error);
        }
    }

    // Add changePassword functionality
    showPasswordModal() {
        console.log('Opening password change modal');
        
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'modal password-modal active';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-key"></i> Change Password</h3>
                    <button class="close-btn" onclick="shopApp.closePasswordModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="password-form">
                        <div class="form-group">
                            <label for="new-password">New Password</label>
                            <input type="password" id="new-password" class="form-control" 
                                   placeholder="Enter new password" required minlength="6">
                            <small>Password must be at least 6 characters long</small>
                        </div>
                        <div class="form-group">
                            <label for="confirm-password">Confirm Password</label>
                            <input type="password" id="confirm-password" class="form-control" 
                                   placeholder="Confirm new password" required>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="shopApp.closePasswordModal()">
                                Cancel
                            </button>
                            <button type="submit" id="update-password-btn" class="btn btn-primary">
                                Update Password
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Set up form submission
        const form = document.getElementById('password-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Show loading state on button
            const button = document.getElementById('update-password-btn');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            button.disabled = true;
            
            try {
                await this.updatePassword();
            } catch (error) {
                console.error('Error in password update:', error);
                // Reset button state
                button.innerHTML = originalText;
                button.disabled = false;
            }
        });
    }
    
    async updatePassword() {
        try {
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Validate passwords
            if (!newPassword || !confirmPassword) {
                this.showToast('Please fill all password fields', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                this.showToast('Password must be at least 6 characters long', 'error');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                this.showToast('Passwords do not match', 'error');
                return;
            }
            
            console.log('Attempting to update password for shop...');
            console.log('Shop ID from currentShop:', this.currentShop.id);
            
            // Make sure we have a shop ID
            if (!this.currentShop || !this.currentShop.id) {
                this.showToast('Unable to update password: Shop ID not found', 'error');
                console.error('Shop ID not found in currentShop:', this.currentShop);
                return;
            }
            
            // Convert the shop ID to a string to ensure proper format
            const shopId = String(this.currentShop.id);
            console.log('Using shop ID for API call:', shopId);
            
            const response = await fetch(`/api/admin/shop-accounts/${shopId}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    password: newPassword
                })
            });
            
            // Log the response status for debugging
            console.log('Password update API response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showToast('Password updated successfully', 'success');
                this.closePasswordModal();
                console.log('Password updated successfully for shop ID:', shopId);
            } else {
                throw new Error(data.message || 'Failed to update password');
            }
        } catch (error) {
            console.error('Error updating password:', error);
            this.showToast(`Failed to update password: ${error.message}`, 'error');
        }
    }

    loadProfileData() {
        console.log('Loading profile data...');
        
        if (!this.currentShop) {
            console.error('Shop data not available');
            this.showToast('Unable to load shop profile', 'error');
            return;
        }
        
        console.log('Current shop data:', this.currentShop);
        
        // Load notifications data for the widget first
        this.loadNotificationsForProfile().then(() => {
        // Create enhanced profile layout
        this.createEnhancedProfile();
        });
        
        // Log the shop ID for debugging
        console.log('Shop ID in profile:', this.currentShop.id);
    }
    
    // Add method to load notifications specifically for profile widget
    async loadNotificationsForProfile() {
        try {
            if (!this.currentShop || !this.currentShop.id) {
                console.warn('No shop ID available for loading notifications');
                return;
            }
            
            // Only load if we don't have recent data (cache for 30 seconds on profile)
            const now = Date.now();
            const lastLoadTime = this.notificationsLastLoadTime || 0;
            
            if (this.allNotifications && (now - lastLoadTime) < 30000) {
                console.log('Using cached notifications for profile widget');
                return;
            }
            
            console.log('Loading notifications for profile widget...');
            
            const response = await fetch(`/api/shop/${this.currentShop.id}/all-notifications`);
            const result = await response.json();
            
            if (result.success) {
                this.allNotifications = result.notifications || [];
                this.notificationsLastLoadTime = now;
                console.log(`Loaded ${this.allNotifications.length} notifications for profile widget`);
            } else {
                console.warn('Failed to load notifications for profile:', result.message);
                this.allNotifications = this.allNotifications || [];
            }
        } catch (error) {
            console.warn('Error loading notifications for profile widget:', error);
            this.allNotifications = this.allNotifications || [];
        }
    }

    createEnhancedProfile() {
        const profileContainer = document.querySelector('#profile-page .profile-container');
        if (!profileContainer) return;
        
        // Calculate statistics
        const totalNotifications = this.allNotifications ? this.allNotifications.length : 0;
        const totalDrivers = this.selectedDrivers ? this.selectedDrivers.length : 0;
        const pendingNotifications = this.allNotifications ? 
                                  this.allNotifications.filter(n => n.status === 'pending').length : 0;
        
        // Get join date (use created_at if available, otherwise estimate)
        const joinDate = this.currentShop.created_at ? 
                        new Date(this.currentShop.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : 'Recently';
        
        // Get recent notifications for the widget (max 3)
        const recentNotifications = this.allNotifications ? 
                                   this.allNotifications
                                       .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                                       .slice(0, 3) : [];
        
        // Create enhanced profile layout with notifications widget
        const enhancedProfile = `
            <div class="profile-card-enhanced">
                <div class="profile-header-enhanced">
                    <div class="profile-avatar-large">
                        <i class="fas fa-store"></i>
                    </div>
                    <div class="profile-info-enhanced">
                        <h2 class="profile-name-large">${this.currentShop.shop_name || this.currentShop.name || 'Shop Name'}</h2>
                        <p class="profile-email-enhanced">${this.currentShop.email || 'No email available'}</p>
                        <p class="profile-join-date">Member since ${joinDate}</p>
                    </div>
                </div>
                
                <div class="profile-stats">
                    <div class="stat-item">
                        <div class="stat-icon">
                            <i class="fas fa-bell"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalNotifications}</div>
                            <div class="stat-label">Notifications</div>
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <div class="stat-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalDrivers}</div>
                            <div class="stat-label">Drivers</div>
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <div class="stat-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${pendingNotifications}</div>
                            <div class="stat-label">Pending</div>
                        </div>
                    </div>
                </div>
                
                <!-- Notifications Widget -->
                <div class="notifications-widget">
                    <div class="widget-header">
                        <div class="widget-title">
                            <i class="fas fa-bell"></i>
                            <h3>Recent Activity</h3>
                            ${pendingNotifications > 0 ? `<span class="pending-badge">${pendingNotifications} pending</span>` : ''}
                        </div>
                        <button class="view-all-btn" onclick="shopApp.navigateToPage('notifications')">
                            <i class="fas fa-arrow-right"></i>
                            View All
                        </button>
                    </div>
                    
                    <div class="widget-content" id="recent-notifications-widget">
                        ${this.renderRecentNotificationsWidget(recentNotifications)}
                    </div>
                </div>
                
                <div class="profile-actions-enhanced">
                    <button class="btn-profile secondary" onclick="shopApp.showPasswordModal()">
                        <i class="fas fa-key"></i>
                        Change Password
                    </button>
                    <button class="btn-profile danger" onclick="shopApp.logout()">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </button>
                </div>
            </div>
        `;
        
        profileContainer.innerHTML = enhancedProfile;
        
        console.log('Enhanced profile created with notifications widget:', {
            totalNotifications,
            totalDrivers,
            pendingNotifications,
            recentNotifications: recentNotifications.length
        });
    }

    // Add method to render recent notifications widget
    renderRecentNotificationsWidget(notifications) {
        if (!notifications || notifications.length === 0) {
            return `
                <div class="widget-empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-bell-slash"></i>
                    </div>
                    <p>No recent notifications</p>
                    <button class="quick-action-btn" onclick="shopApp.navigateToPage('alerts')">
                        <i class="fas fa-paper-plane"></i>
                        Send Message to Team
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="widget-notifications-list">
                ${notifications.map(notification => `
                    <div class="widget-notification-item ${notification.status}" 
                         onclick="shopApp.openNotificationDetails('${notification.id}')">
                        <div class="notification-indicator">
                            <i class="fas ${notification.status === 'pending' ? 'fa-clock' : 'fa-check-circle'}"></i>
                        </div>
                        <div class="notification-details">
                            <div class="notification-driver">
                                <i class="fas fa-user"></i>
                                ${this.escapeHTML(notification.driver_email || 'Unknown Driver')}
                            </div>
                            <div class="notification-preview">
                                ${this.truncateText(notification.message || 'No message', 50)}
                            </div>
                            <div class="notification-time-widget">
                                <i class="fas fa-clock"></i>
                                ${this.timeAgo(new Date(notification.created_at))}
                            </div>
                        </div>
                        <div class="notification-status-indicator ${notification.status}">
                            ${notification.status === 'pending' ? 'Waiting' : 'Confirmed'}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Add utility method to truncate text
    truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    // Add method to open notification details
    openNotificationDetails(notificationId) {
        // Navigate to notifications page and highlight the specific notification
        this.navigateToPage('notifications');
        
        // After a short delay, scroll to and highlight the notification
        setTimeout(() => {
            const notificationElement = document.querySelector(`[data-id="${notificationId}"]`);
            if (notificationElement) {
                notificationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                notificationElement.classList.add('highlighted');
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    notificationElement.classList.remove('highlighted');
                }, 3000);
            }
        }, 300);
    }

    closePasswordModal() {
        console.log('Closing password modal');
        // First try to find and close a modal with ID
        const modal = document.querySelector('.password-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        } else {
            // Fall back to the generic closeModal method
            this.closeModal();
        }
    }

    bindNotificationEvents() {
        // Broadcast notification button
        const broadcastBtn = document.getElementById('broadcast-notification-btn');
        if (broadcastBtn) {
            broadcastBtn.addEventListener('click', () => {
                this.sendBroadcastNotification();
            });
        }
    }

    // Add new method for loading notifications page
    loadNotificationsPage() {
        console.log('Loading notifications page...');
        
        const notificationsContainer = document.getElementById('notifications-page');
        if (!notificationsContainer) return;
        
        notificationsContainer.innerHTML = `
            <div class="notifications-container">
                <div class="notifications-header">
                    <h2><i class="fas fa-bell"></i> Notifications</h2>
                    <p>View all notifications and their confirmation status</p>
                </div>
                
                <div class="notifications-stats-bar">
                    <div class="stat-card">
                        <div class="stat-icon pending">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-number" id="pending-count">0</span>
                            <span class="stat-label">Pending</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon confirmed">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-number" id="confirmed-count">0</span>
                            <span class="stat-label">Confirmed</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon total">
                            <i class="fas fa-bell"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-number" id="total-notifications-count">0</span>
                            <span class="stat-label">Total</span>
                        </div>
                    </div>
                </div>
                
                <div class="notifications-filters">
                    <button class="filter-btn active" data-filter="all">
                        <i class="fas fa-list"></i> All
                    </button>
                    <button class="filter-btn" data-filter="pending">
                        <i class="fas fa-clock"></i> Pending
                    </button>
                    <button class="filter-btn" data-filter="confirmed">
                        <i class="fas fa-check-circle"></i> Confirmed
                    </button>
                </div>
                
                <div class="section-header slim">
                    <div class="section-title">
                        <i class="fas fa-history"></i>
                        <h3>Notification History</h3>
                    </div>
                    <div class="section-actions">
                        <button class="slim-button" id="refresh-all-notifications-btn">
                            <i class="fas fa-sync-alt"></i> Refresh
                        </button>
                    </div>
                </div>
                
                <div id="all-notifications-container">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading notifications...
                    </div>
                </div>
            </div>
        `;
        
        // Bind filter events
        this.bindNotificationsPageEvents();
        
        // Load all notifications
        this.loadAllNotifications();
    }

    bindNotificationsPageEvents() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active filter
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.filter-btn').classList.add('active');
                
                // Filter notifications
                const filter = e.target.closest('.filter-btn').dataset.filter;
                this.filterNotifications(filter);
            });
        });
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-all-notifications-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadAllNotifications();
            });
        }
    }

    async loadAllNotifications() {
        try {
            if (!this.currentShop || !this.currentShop.id) {
                console.error('No shop ID available to load notifications');
                return;
            }
            
            console.log('Loading all shop notifications...');
            
            const response = await fetch(`/api/shop/${this.currentShop.id}/all-notifications`);
            const result = await response.json();
            
            console.log('Raw API response:', result);
            
            if (result.success) {
                this.allNotifications = result.notifications || [];
                console.log('Loaded notifications:', this.allNotifications);
                console.log('First notification structure:', this.allNotifications[0]);
                
                // Log all notification properties for debugging
                if (this.allNotifications.length > 0) {
                    const firstNotification = this.allNotifications[0];
                    console.log('Notification properties:', Object.keys(firstNotification));
                    console.log('Message content type:', typeof firstNotification.message);
                    console.log('Message content value:', firstNotification.message);
                    console.log('Message length:', firstNotification.message ? firstNotification.message.length : 'undefined');
                }
                
                this.updateNotificationsStats();
                this.renderAllNotifications(this.allNotifications);
            } else {
                throw new Error(result.message || 'Failed to load notifications');
            }
        } catch (error) {
            console.error('Error loading all notifications:', error);
            this.showAllNotificationsError('Failed to load notifications');
        }
    }

    updateNotificationsStats() {
        if (!this.allNotifications) return;
        
        const pendingCount = this.allNotifications.filter(n => n.status === 'pending').length;
        const confirmedCount = this.allNotifications.filter(n => n.status === 'confirmed').length;
        const totalCount = this.allNotifications.length;
        
        const pendingEl = document.getElementById('pending-count');
        const confirmedEl = document.getElementById('confirmed-count');
        const totalEl = document.getElementById('total-notifications-count');
        
        if (pendingEl) pendingEl.textContent = pendingCount;
        if (confirmedEl) confirmedEl.textContent = confirmedCount;
        if (totalEl) totalEl.textContent = totalCount;
    }

    renderAllNotifications(notifications) {
        const container = document.getElementById('all-notifications-container');
        if (!container) return;
        if (!notifications || notifications.length === 0) {
            container.innerHTML = `
                <div class="no-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <h4>No notifications sent yet</h4>
                    <p>Notifications you send to drivers will appear here</p>
                </div>
            `;
            return;
        }
        // Sort by date (newest first)
        const sortedNotifications = [...notifications].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
        const notificationsHtml = sortedNotifications.map((notification, index) => {
            try {
                const notificationId = notification.id || `temp-${index}`;
                const status = notification.status || 'pending';
                const driverEmail = notification.driver_email || notification.email || 'Unknown Driver';
                const message = notification.message || 'No message available';
                const createdAt = notification.created_at || new Date().toISOString();
                return `
                    <div class="notification-card simple" data-id="${notificationId}">
                        <div class="notification-header-simple">
                            <div class="notification-status-badge ${status}">
                                <i class="fas ${status === 'pending' ? 'fa-clock' : 'fa-check'}"></i>
                                ${status.charAt(0).toUpperCase() + status.slice(1)}
                            </div>
                            <div class="notification-time-simple">
                                ${this.timeAgo(new Date(createdAt))}
                            </div>
                        </div>
                        <div class="notification-body-simple">
                            <div class="driver-info-simple">
                                <i class="fas fa-user"></i>
                                <strong>${this.escapeHTML(driverEmail)}</strong>
                            </div>
                            <div class="message-content-simple">
                                ${this.escapeHTML(message)}
                            </div>
                        </div>
                        ${status === 'pending' ? `
                            <div class="notification-actions-simple">
                                <button class="delete-btn-simple" onclick="shopApp.deleteNotification('${notificationId}')">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                                <button class="edit-btn-simple" onclick="shopApp.showEditNotificationModal('${notificationId}')">
                                    <i class='fas fa-edit'></i> Edit
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            } catch (error) {
                console.error('Error rendering notification:', error, notification);
                return `
                    <div class="notification-card error">
                        <div class="notification-error">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Error displaying notification</span>
                        </div>
                    </div>
                `;
            }
        }).join('');
        container.innerHTML = `
            <div class="notifications-list-simple">
                ${notificationsHtml}
            </div>
        `;
    }

    // Add HTML escaping method if it doesn't exist
    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    filterNotifications(filter) {
        if (!this.allNotifications) return;
        
        let filteredNotifications = this.allNotifications;
        
        if (filter === 'pending') {
            filteredNotifications = this.allNotifications.filter(n => n.status === 'pending');
        } else if (filter === 'confirmed') {
            filteredNotifications = this.allNotifications.filter(n => n.status === 'confirmed');
        }
        
        this.renderAllNotifications(filteredNotifications);
    }

    async deleteNotification(notificationId) {
        // Show custom modal instead of confirm()
        const modalId = `delete-notification-modal-${notificationId}`;
        if (document.getElementById(modalId)) return; // Prevent duplicate modals
        const modalHTML = `
            <div id="${modalId}" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-trash"></i> Delete Notification</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to delete this notification? This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn secondary close-modal">Cancel</button>
                        <button class="btn danger" id="confirm-delete-notification-btn-${notificationId}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById(modalId);
        // Close modal on click
        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        // Confirm delete
        document.getElementById(`confirm-delete-notification-btn-${notificationId}`).addEventListener('click', async () => {
            modal.remove();
        try {
            if (!this.currentShop || !this.currentShop.id) {
                console.error('No shop ID available');
                return;
            }
            const response = await fetch(`/api/shop/${this.currentShop.id}/notifications/${notificationId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (result.success) {
                if (this.allNotifications) {
                    this.allNotifications = this.allNotifications.filter(n => n.id !== notificationId);
                    this.updateNotificationsStats();
                    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                    this.filterNotifications(activeFilter);
                }
                this.showToast('Notification deleted successfully', 'success');
            } else {
                throw new Error(result.message || 'Failed to delete notification');
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
            this.showToast('Failed to delete notification', 'error');
        }
        });
    }

    showAllNotificationsError(message) {
        const container = document.getElementById('all-notifications-container');
        if (container) {
            container.innerHTML = `
                <div class="notifications-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h4>Error Loading Notifications</h4>
                    <p>${message}</p>
                    <button class="retry-btn" onclick="shopApp.loadAllNotifications()">
                        <i class="fas fa-redo"></i> Try Again
                    </button>
                </div>
            `;
        }
    }

    async markNotificationAsRead(notificationId) {
        try {
            if (!this.currentShop || !this.currentShop.id) {
                console.error('No shop ID available');
                return;
            }
            
            console.log('Marking notification as read:', notificationId);
            
            const response = await fetch(`/api/shop/${this.currentShop.id}/notifications/${notificationId}/read`, {
                method: 'PUT'
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update local data
                if (this.allNotifications) {
                    const notification = this.allNotifications.find(n => n.id === notificationId);
                    if (notification) {
                        notification.is_read = true;
                    }
                }
                
                // Update UI
                const notificationElement = document.querySelector(`.notification-card[data-id="${notificationId}"]`);
                if (notificationElement) {
                    const button = notificationElement.querySelector('.action-btn.mark-read');
                    if (button) {
                        button.innerHTML = '<i class="fas fa-check"></i> Read';
                        button.classList.remove('unread');
                        button.classList.add('read');
                        button.disabled = true;
                    }
                }
                
                this.showToast('Notification marked as read', 'success');
            } else {
                throw new Error(result.message || 'Failed to mark notification as read');
            }
        } catch (error) {
            console.error('Error marking notification as read:', error);
            this.showToast('Failed to mark notification as read', 'error');
        }
    }

    // Initialize WebSocket and audio
    connectWebSocket() {
        if (!this.shopId) {
            console.warn('⚠️ No shop ID found, cannot connect to WebSocket');
            return;
        }
        
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log('🔌 Connecting to WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                
                // Authenticate with server
                this.ws.send(JSON.stringify({
                    type: 'authenticate',
                    userId: this.shopId,
                    userType: 'shop',
                    shopId: this.shopId
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('❌ Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (this.shopId) {
                        this.connectWebSocket();
                    }
                }, 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };
            
            // Send session heartbeat every 30 seconds
            this.sessionHeartbeatInterval = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'session_heartbeat',
                        userId: this.shopId
                    }));
                }
            }, 30000);
            
        } catch (error) {
            console.error('❌ Failed to connect to WebSocket:', error);
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'authenticated':
                console.log('👤 WebSocket authentication successful');
                break;
                
            case 'notification':
                console.log('🔔 Real-time notification received:', data.data);
                this.handleRealtimeNotification(data.data);
                break;
                
            case 'notification_count':
                console.log('🔢 Notification count update:', data.count);
                this.updateNotificationBadge(data.count);
                break;
                
            case 'session_conflict':
                console.log('⚠️ Session conflict detected:', data);
                this.handleSessionConflict(data);
                break;
                
            case 'force_logout':
                console.log('🚫 Force logout received:', data);
                this.handleForceLogout(data);
                break;
                
            case 'notification_update':
                console.log('🔄 Real-time notification update:', data);
                this.handleNotificationUpdate(data);
                break;
                
            case 'authentication_failed':
                console.log('❌ WebSocket authentication failed:', data);
                this.handleAuthenticationFailed(data);
                break;
                
            case 'order_update':
                this.handleOrderUpdate(data);
                break;
                
            default:
                console.log('📨 Unknown WebSocket message type:', data.type);
        }
    }

    // Initialize audio
    initializeAudio() {
        try {
            // Create audio context for notification sounds
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create notification sound using Web Audio API
            this.createNotificationSound();
            
            console.log('🔊 Audio initialized for notifications');
        } catch (error) {
            console.warn('⚠️ Audio not available:', error);
        }
    }
    
    // Create notification sound using Web Audio API
    createNotificationSound() {
        if (!this.audioContext) return;
        
        try {
            // Create a simple notification sound (two-tone)
            this.notificationAudio = () => {
                if (!this.isAudioEnabled) return;
                
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // Different tone for shop notifications
                oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            };
        } catch (error) {
            console.warn('⚠️ Could not create notification sound:', error);
        }
    }

    // Play notification sound
    playNotificationSound() {
        if (this.notificationAudio && this.isAudioEnabled) {
            try {
                this.notificationAudio();
            } catch (error) {
                console.warn('⚠️ Could not play notification sound:', error);
            }
        }
    }
    
    // Handle real-time notification update
    handleNotificationUpdate(data) {
        const { action, notificationId, data: updateData } = data;
        const idx = this.notifications.findIndex(n => n.id === notificationId);
        if (action === 'confirmed') {
            if (idx !== -1) {
                this.notifications[idx] = {
                    ...this.notifications[idx],
                    status: 'confirmed',
                    confirmed_at: updateData?.confirmed_at
                };
                this.showToast('Notification confirmed', 'success');
            }
        } else if (action === 'deleted') {
            if (idx !== -1) {
                this.notifications.splice(idx, 1);
                this.showToast('Notification deleted', 'info');
            }
        } else if (action === 'edited') {
            if (idx !== -1) {
                this.notifications[idx] = {
                    ...this.notifications[idx],
                    ...updateData
                };
                this.showToast('Notification updated', 'info');
            }
        }
        if (this.currentPage === 'alerts' || this.currentPage === 'notifications') {
            this.renderNotifications(this.notifications);
        }
    }
    
    // Handle notification deleted
    handleNotificationDeleted(notificationId) {
        // Remove from notifications array
        if (this.notifications) {
            const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
            if (notificationIndex !== -1) {
                this.notifications.splice(notificationIndex, 1);
            }
        }
        
        // Remove from allNotifications array
        if (this.allNotifications) {
            const allNotificationIndex = this.allNotifications.findIndex(n => n.id === notificationId);
            if (allNotificationIndex !== -1) {
                this.allNotifications.splice(allNotificationIndex, 1);
            }
        }
        
        // Update UI based on current page
        if (this.currentPage === 'alerts') {
            this.loadNotificationsPage();
        } else if (this.currentPage === 'notifications') {
            this.loadAllNotifications();
        } else if (this.currentPage === 'profile') {
            this.updateProfileNotificationsWidget();
        }
        
        this.showToast('Notification deleted', 'info');
    }
    
    // Handle notification edited
    handleNotificationEdited(notificationId, data) {
        // Update in notifications array
        if (this.notifications) {
            const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
            if (notificationIndex !== -1) {
                this.notifications[notificationIndex] = {
                    ...this.notifications[notificationIndex],
                    ...data
                };
            }
        }
        
        // Update in allNotifications array
        if (this.allNotifications) {
            const allNotificationIndex = this.allNotifications.findIndex(n => n.id === notificationId);
            if (allNotificationIndex !== -1) {
                this.allNotifications[allNotificationIndex] = {
                    ...this.allNotifications[allNotificationIndex],
                    ...data
                };
            }
        }
        
        // Update UI based on current page
        if (this.currentPage === 'alerts') {
            this.loadNotificationsPage();
        } else if (this.currentPage === 'notifications') {
            this.loadAllNotifications();
        } else if (this.currentPage === 'profile') {
            this.updateProfileNotificationsWidget();
        }
        
        this.showToast('Notification updated', 'info');
    }

    // Handle real-time notification
    handleRealtimeNotification(notification) {
        // Add to notifications array
        this.notifications.unshift(notification);
        
        // Update allNotifications array if it exists
        if (this.allNotifications) {
            this.allNotifications.unshift(notification);
        }
        
        // Play notification sound
        this.playNotificationSound();
        
        // Show browser notification if permitted
        this.showBrowserNotification(notification);
        
        // Update UI based on current page
        if (this.currentPage === 'alerts') {
            this.loadNotificationsPage();
        } else if (this.currentPage === 'notifications') {
            this.loadAllNotifications();
        } else if (this.currentPage === 'profile') {
            // Update the profile notifications widget in real-time
            this.updateProfileNotificationsWidget();
        }
        
        // Show toast notification
        this.showToast(`Driver confirmed: ${notification.message}`, 'success');
    }
    
    // Add method to update profile notifications widget in real-time
    updateProfileNotificationsWidget() {
        const widgetContainer = document.getElementById('recent-notifications-widget');
        const pendingBadge = document.querySelector('.pending-badge');
        
        if (widgetContainer && this.allNotifications) {
            // Update the widget content
            const recentNotifications = this.allNotifications
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 3);
            
            widgetContainer.innerHTML = this.renderRecentNotificationsWidget(recentNotifications);
            
            // Update the pending badge
            const pendingCount = this.allNotifications.filter(n => n.status === 'pending').length;
            const widgetTitle = document.querySelector('.widget-title');
            
            if (widgetTitle && pendingBadge) {
                if (pendingCount > 0) {
                    pendingBadge.textContent = `${pendingCount} pending`;
                    pendingBadge.style.display = 'inline-block';
                } else {
                    pendingBadge.style.display = 'none';
                }
            } else if (widgetTitle && pendingCount > 0) {
                // Add pending badge if it doesn't exist
                const newPendingBadge = document.createElement('span');
                newPendingBadge.className = 'pending-badge';
                newPendingBadge.textContent = `${pendingCount} pending`;
                widgetTitle.appendChild(newPendingBadge);
            }
            
            // Update stats in profile if they exist
            this.updateProfileStats();
            
            console.log('Profile notifications widget updated in real-time');
        }
    }
    
    // Add method to update profile stats
    updateProfileStats() {
        if (!this.allNotifications) return;
        
        const totalNotifications = this.allNotifications.length;
        const pendingNotifications = this.allNotifications.filter(n => n.status === 'pending').length;
        
        // Update stat numbers
        const statNumbers = document.querySelectorAll('.stat-number');
        if (statNumbers.length >= 3) {
            statNumbers[0].textContent = totalNotifications; // Notifications count
            statNumbers[2].textContent = pendingNotifications; // Pending count
        }
    }
    
    // Request notification permission
    requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                // Show a custom permission request modal
                this.showNotificationPermissionModal();
            } else if (Notification.permission === 'denied') {
                this.showToast('Notifications are blocked. Please enable them in your browser settings to receive updates.', 'warning');
            }
        }
    }
    
    // Show custom notification permission modal
    showNotificationPermissionModal() {
        const modal = document.createElement('div');
        modal.className = 'notification-permission-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            backdrop-filter: blur(5px);
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 20px;
                padding: 32px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            ">
                <div style="
                    width: 80px;
                    height: 80px;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 24px;
                    font-size: 32px;
                    color: white;
                ">
                    <i class="fas fa-bell"></i>
                </div>
                
                <h3 style="
                    font-size: 24px;
                    font-weight: 700;
                    color: #1f2937;
                    margin-bottom: 12px;
                ">Enable Notifications</h3>
                
                <p style="
                    font-size: 16px;
                    color: #6b7280;
                    line-height: 1.6;
                    margin-bottom: 24px;
                ">Get instant alerts when drivers confirm your delivery requests, even when the app is in the background.</p>
                
                <div style="
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                ">
                    <button class="permission-btn allow" style="
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Allow Notifications</button>
                    
                    <button class="permission-btn deny" style="
                        background: #f3f4f6;
                        color: #6b7280;
                        border: 1px solid #d1d5db;
                        padding: 12px 24px;
                        border-radius: 12px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">Not Now</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Animate in
        setTimeout(() => {
            modal.querySelector('div').style.transform = 'scale(1)';
        }, 100);
        
        // Handle allow button
        const allowBtn = modal.querySelector('.permission-btn.allow');
        allowBtn.addEventListener('click', () => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showToast('🎉 Notifications enabled! You\'ll receive real-time driver confirmations.', 'success');
                } else {
                    this.showToast('Notifications disabled. You can enable them in your browser settings.', 'warning');
                }
                modal.remove();
            });
        });
        
        // Handle deny button
        const denyBtn = modal.querySelector('.permission-btn.deny');
        denyBtn.addEventListener('click', () => {
            modal.remove();
            this.showToast('You can enable notifications later in your browser settings.', 'info');
        });
        
        // Handle modal close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Add hover effects
        allowBtn.addEventListener('mouseenter', () => {
            allowBtn.style.transform = 'translateY(-2px)';
            allowBtn.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.4)';
        });
        
        allowBtn.addEventListener('mouseleave', () => {
            allowBtn.style.transform = 'translateY(0)';
            allowBtn.style.boxShadow = 'none';
        });
        
        denyBtn.addEventListener('mouseenter', () => {
            denyBtn.style.transform = 'translateY(-2px)';
            denyBtn.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
        });
        
        denyBtn.addEventListener('mouseleave', () => {
            denyBtn.style.transform = 'translateY(0)';
            denyBtn.style.boxShadow = 'none';
        });
    }

    // Show browser notification
    showBrowserNotification(notification) {
        if ('Notification' in window && Notification.permission === 'granted') {
            // Create enhanced notification with better styling
            const browserNotification = new Notification('✅ Driver Confirmed', {
                body: `${notification.driver_email || 'Driver'}\n${notification.message}`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                tag: 'shop-notification',
                requireInteraction: false,
                silent: false, // Allow system sound
                vibrate: [200, 100, 200], // Vibration pattern
                data: {
                    notificationId: notification.id,
                    driverEmail: notification.driver_email,
                    type: 'driver_confirmation'
                }
            });
            
            // Handle notification click
            browserNotification.onclick = () => {
                window.focus();
                this.navigateToPage('alerts');
                browserNotification.close();
                
                // Highlight the specific notification
                setTimeout(() => {
                    const notificationElement = document.querySelector(`[data-notification-id="${notification.id}"]`);
                    if (notificationElement) {
                        notificationElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        notificationElement.style.animation = 'highlight-notification 2s ease-in-out';
                    }
                }, 500);
            };
            
            // Handle notification close
            browserNotification.onclose = () => {
                console.log('Browser notification closed');
            };
            
            // Auto close after 8 seconds (longer for better UX)
            setTimeout(() => {
                if (browserNotification) {
                    browserNotification.close();
                }
            }, 8000);
            
            // Also show a custom in-app notification toast
            this.showCustomNotificationToast(notification);
        } else {
            // Fallback: show custom notification if browser notifications are not available
            this.showCustomNotificationToast(notification);
        }
    }
    
    // Show custom notification toast (Instagram-style)
    showCustomNotificationToast(notification) {
        const toast = document.createElement('div');
        toast.className = 'custom-notification-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            max-width: 350px;
            min-width: 300px;
            transform: translateX(400px);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;
        
        toast.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="flex-shrink: 0; width: 40px; height: 40px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-user-check" style="font-size: 18px; color: white;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${notification.driver_email || 'Driver'} confirmed
                    </div>
                    <div style="font-size: 13px; line-height: 1.4; opacity: 0.9; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${notification.message}
                    </div>
                    <div style="font-size: 11px; opacity: 0.7; margin-top: 6px;">
                        <i class="fas fa-clock"></i> Just now
                    </div>
                </div>
                <button class="notification-close-btn" style="background: none; border: none; color: white; font-size: 16px; cursor: pointer; padding: 4px; opacity: 0.7; transition: opacity 0.2s;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);
        
        // Handle close button
        const closeBtn = toast.querySelector('.notification-close-btn');
        closeBtn.addEventListener('click', () => {
            toast.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
        
        // Handle click on notification
        toast.addEventListener('click', (e) => {
            if (e.target !== closeBtn && !closeBtn.contains(e.target)) {
                this.navigateToPage('alerts');
                toast.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        });
        
        // Auto remove after 6 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 6000);
    }
    
    // Update notification badge
    updateNotificationBadge(count) {
        const badge = document.querySelector('.notification-count');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }
    
    // Handle session conflict
    handleSessionConflict(data) {
        console.log('🔄 Handling session conflict:', data);
        
        // Immediately clear session data and close connections
        this.clearSessionData();
        
        // Close WebSocket connection immediately
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Clear session heartbeat interval
        if (this.sessionHeartbeatInterval) {
            clearInterval(this.sessionHeartbeatInterval);
            this.sessionHeartbeatInterval = null;
        }
        
        // Show session conflict modal immediately
        this.showSessionConflictModal(data);
        
        // Redirect to login page faster (1 second instead of 3)
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
    }
    
    // Handle force logout
    handleForceLogout(data) {
        console.log('🚫 Handling force logout:', data);
        
        // Immediately clear session data
        this.clearSessionData();
        
        // Close WebSocket connection immediately
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Clear session heartbeat interval
        if (this.sessionHeartbeatInterval) {
            clearInterval(this.sessionHeartbeatInterval);
            this.sessionHeartbeatInterval = null;
        }
        
        // Show immediate logout notification
        this.showToast('Your session has been terminated due to new login', 'warning');
        
        // Show session conflict modal
        this.showSessionConflictModal({
            message: 'Your session has been terminated due to new login',
            newLoginTime: data.timestamp
        });
        
        // Redirect to login page immediately
        setTimeout(() => {
            window.location.href = '/login';
        }, 500);
    }
    
    // Handle authentication failed
    handleAuthenticationFailed(data) {
        console.log('❌ Handling authentication failed:', data);
        
        this.showToast('Session expired. Please log in again.', 'error');
        
        // Clear session data
        this.clearSessionData();
        
        // Close WebSocket connection
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        // Redirect to login page
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    }
    
    // Clear session data
    clearSessionData() {
        localStorage.removeItem('shopSession');
        localStorage.removeItem('deliveryAppShop');
        localStorage.removeItem('deliveryAppShopSession');
        console.log('🗑️ Shop session data cleared');
    }
    
    // Show session conflict modal
    showSessionConflictModal(data) {
        const modal = document.createElement('div');
        modal.className = 'modal show session-conflict-modal';
        modal.style.zIndex = '10000';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 450px; border: 2px solid #f59e0b;">
                <div class="modal-header" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
                    <div class="modal-header-icon" style="background: rgba(255,255,255,0.2);">
                        <i class="fas fa-exclamation-triangle" style="color: white;"></i>
                    </div>
                    <div class="modal-header-text">
                        <h3 style="color: white; margin: 0;">Session Conflict</h3>
                        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0;">Your account is being used elsewhere</p>
                    </div>
                    <button class="modal-close-btn" onclick="this.closest('.modal').remove();" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 5px;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="padding: 24px;">
                    <div class="session-conflict-info">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <i class="fas fa-user-clock" style="font-size: 48px; color: #f59e0b; margin-bottom: 15px;"></i>
                        </div>
                        <p style="font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 15px;">
                            <strong>Someone else has logged into your account.</strong>
                        </p>
                        <p style="color: #6b7280; margin-bottom: 20px; line-height: 1.5;">
                            For security reasons, you have been automatically logged out. 
                            This ensures only one person can use your account at a time.
                        </p>
                        <div class="conflict-details" style="background: #f3f4f6; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                            <small style="color: #6b7280;">
                                <i class="fas fa-clock"></i> New login time: ${new Date(data.newLoginTime).toLocaleString()}
                            </small>
                        </div>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e5e7eb;">
                    <button class="btn primary" onclick="window.location.href='/login'" style="width: 100%; padding: 12px; font-size: 16px; font-weight: 600;">
                        <i class="fas fa-sign-in-alt"></i>
                        Go to Login Page
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Prevent closing by clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                // Don't close when clicking outside
                return;
            }
        });
        
        // Auto-remove modal after 8 seconds (longer to give user time to read)
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 8000);
    }
    
    // Toggle notification sound
    toggleNotificationSound() {
        this.isAudioEnabled = !this.isAudioEnabled;
        localStorage.setItem('notificationSound', this.isAudioEnabled.toString());
        
        if (this.isAudioEnabled) {
            this.showToast('Notification sound enabled', 'success');
            this.playNotificationSound(); // Test sound
        } else {
            this.showToast('Notification sound disabled', 'info');
        }
    }

    showEditNotificationModal(notificationId) {
        const notification = (this.allNotifications || []).find(n => n.id == notificationId);
        if (!notification) {
            this.showToast('Notification not found', 'error');
            return;
        }
        const modalId = `edit-notification-modal-${notificationId}`;
        if (document.getElementById(modalId)) return;
        const modalHTML = `
            <div id="${modalId}" class="modal">
                <div class="modal-content" style="max-width: 500px; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);">
                    <div class="modal-header" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px 24px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i class="fas fa-edit" style="font-size: 18px; color: white;"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 20px; font-weight: 600;">Edit Notification</h3>
                                <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Update your notification message</p>
                            </div>
                        </div>
                        <button class="close-modal" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 8px; border-radius: 50%; transition: background-color 0.2s ease;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 24px;">
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Notification Message</label>
                            <textarea id="edit-notification-message-${notificationId}" 
                                style="width: 100%; min-height: 120px; padding: 16px; border-radius: 12px; border: 2px solid #e5e7eb; font-size: 15px; font-family: inherit; resize: vertical; transition: border-color 0.3s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);"
                                placeholder="Enter your notification message here..."
                            >${this.escapeHTML(notification.message)}</textarea>
                        </div>
                        <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                            <small style="color: #64748b;">
                                <i class="fas fa-info-circle"></i> 
                                This will update the message sent to your delivery team.
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer" style="padding: 20px 24px; border-top: 1px solid #e5e7eb; display: flex; gap: 12px; justify-content: flex-end;">
                        <button class="btn secondary close-modal" style="padding: 12px 20px; border-radius: 8px; font-weight: 500;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                        <button class="btn primary" id="save-edit-notification-btn-${notificationId}" 
                            style="padding: 12px 24px; border-radius: 8px; font-weight: 600; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                            <i class="fas fa-save"></i> Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById(modalId);
        modal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
        document.getElementById(`save-edit-notification-btn-${notificationId}`).addEventListener('click', async () => {
            const newMessage = document.getElementById(`edit-notification-message-${notificationId}`).value.trim();
            if (!newMessage) {
                this.showToast('Message cannot be empty', 'error');
                return;
            }
            try {
                if (!this.currentShop || !this.currentShop.id) {
                    this.showToast('Shop ID not available', 'error');
                    return;
                }
                const response = await fetch(`/api/shop/${this.currentShop.id}/notifications/${notificationId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: newMessage })
                });
                const result = await response.json();
                if (result.success) {
                    // Update local data
                    if (this.allNotifications) {
                        this.allNotifications = this.allNotifications.map(n => n.id == notificationId ? { ...n, message: newMessage } : n);
                        this.updateNotificationsStats();
                        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
                        this.filterNotifications(activeFilter);
                    }
                    this.showToast('Notification updated successfully', 'success');
                    modal.remove();
                } else {
                    throw new Error(result.message || 'Failed to update notification');
                }
            } catch (error) {
                this.showToast('Failed to update notification', 'error');
            }
        });
    }

    handleOrderUpdate(data) {
        const { action, order } = data;
        if (!order || !order.id) return;
        const idx = this.orders.findIndex(o => o.id === order.id);
        if (action === 'edit') {
            if (idx !== -1) {
                this.orders[idx] = { ...this.orders[idx], ...order };
            } else {
                this.orders.unshift(order);
            }
            this.showToast('Order updated in real time', 'info');
        } else if (action === 'delete') {
            if (idx !== -1) {
                this.orders.splice(idx, 1);
                this.showToast('Order deleted in real time', 'warning');
            }
        } else if (action === 'confirm') {
            if (idx !== -1) {
                this.orders[idx].status = 'confirmed';
                this.showToast('Order confirmed in real time', 'success');
            }
        }
        if (this.currentPage === 'alerts' || this.currentPage === 'orders') {
            this.renderOrders();
        }
    }

    async playNotificationSound(strong = false) {
        if (!this.isAudioEnabled) return;
        try {
            const ctx = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
            if (strong) {
                // Multi-tone, urgent alert sound
                const gain = ctx.createGain();
                gain.gain.value = 0.7;
                gain.connect(ctx.destination);
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                osc1.type = 'square';
                osc2.type = 'triangle';
                osc1.frequency.setValueAtTime(1040, ctx.currentTime);
                osc2.frequency.setValueAtTime(660, ctx.currentTime);
                osc1.connect(gain);
                osc2.connect(gain);
                osc1.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.25);
                osc2.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.25);
                osc1.stop(ctx.currentTime + 0.5);
                osc2.stop(ctx.currentTime + 0.5);
                osc1.onended = () => gain.disconnect();
            } else if (this.notificationAudio) {
                this.notificationAudio();
            }
        } catch (error) {
            console.warn('⚠️ Could not play notification sound:', error);
        }
    }
}

// Make app available globally
let shopApp;

// Initialize the shop app
document.addEventListener('DOMContentLoaded', () => {
    shopApp = new ShopApp();
}); 