class DeliveryApp {
    constructor() {
        this.orders = [];
        this.shops = [];
        this.categories = [];
        this.recentOrders = [];
        this.notifications = [];
        this.currentFilter = 'all';
        this.currentPage = 'home';
        this.floatingButton = null;
        this.userType = 'driver';
        this.userEmail = null;
        this.userId = null;
        this.sessionToken = null;
        this.currentUser = null;
        this.settings = {
            earningsPerOrder: 1.50
        };
        this.ws = null;
        this.audioContext = null;
        this.notificationAudio = null;
        this.isAudioEnabled = localStorage.getItem('notificationSound') !== 'false';
        this.soundVolume = parseFloat(localStorage.getItem('soundVolume')) || 0.5; // Default 50% volume
        this.initNotificationSound();
        
        // Auto-refresh intervals
        this.notificationRefreshInterval = null;
        this.timeUpdateInterval = null;
        
        // Initialize the app
        this.init();
    }
    
    async init() {
        console.log('Main app initializing...');
        
        // Check if user is logged in
        if (!this.checkAuthStatus()) {
            window.location.href = '/';
            return;
        }
        
        // Enhanced back button prevention for mobile apps
        this.preventBackNavigation();
        
        // Set user data from authenticated session
        if (this.currentUser) {
            this.userEmail = this.currentUser.email;
            this.userId = this.currentUser.id;
            console.log('User data set:', { email: this.userEmail, id: this.userId });
        }
        
        // Initialize app components
        this.bindEvents();
        this.createConfirmModal();
        this.updateCurrentDate();
        
        // Initialize audio and WebSocket after authentication
        this.initializeAudio();
        this.connectWebSocket();
        
        await this.loadUserData();
        await this.loadSettingsData();
        await this.loadCategories();
        
        // Setup push notifications
        await this.setupPushNotifications();
        
        // Navigate to home page
        this.navigateToPage('home');
        this.updateUI();
        
        await this.fetchInitialNotifications();
        
        // Setup notifications menu
        this.setupNotificationsMenu();
        
        console.log('Main app initialization complete');
    }
    
    checkAuthStatus() {
        // Get user session data from localStorage
        const sessionData = localStorage.getItem('userSession');
        
        if (sessionData) {
            try {
                // Parse the session data
                const session = JSON.parse(sessionData);
                
                // Check if we have all required session data
                if (session && session.user && session.sessionToken) {
                    this.currentUser = session.user;
                    this.sessionToken = session.sessionToken;
                    
                    // Store in app-specific keys for backward compatibility
                    localStorage.setItem('deliveryAppUser', JSON.stringify(this.currentUser));
                    localStorage.setItem('deliveryAppSession', this.sessionToken);
                    
                    console.log('Found valid session for:', this.currentUser.email);
                    return true;
                }
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                localStorage.removeItem('userSession');
                localStorage.removeItem('deliveryAppUser');
                localStorage.removeItem('deliveryAppSession');
            }
        } else {
            // Check for legacy storage keys as fallback
            const storedUser = localStorage.getItem('deliveryAppUser');
            const storedSession = localStorage.getItem('deliveryAppSession');
            
            if (storedUser && storedSession) {
                try {
                    this.currentUser = JSON.parse(storedUser);
                    this.sessionToken = storedSession;
                    console.log('Found valid legacy session for:', this.currentUser.name || this.currentUser.email);
                    return true;
                } catch (error) {
                    console.error('Error parsing legacy user data:', error);
                    localStorage.removeItem('deliveryAppUser');
                    localStorage.removeItem('deliveryAppSession');
                }
            }
        }
        
        console.warn('No valid session found, user needs to log in');
        return false;
    }
    
    bindEvents() {
        console.log('Binding main app events...');
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const page = e.currentTarget.dataset.page;
                if (page) {
                    console.log('Navigation clicked:', page);
                    this.navigateToPage(page);
                }
            });
        });
        
        // Use event delegation for dynamic content
        document.addEventListener('click', async (e) => {
            // Don't process clicks if they're inside a notification modal
            if (e.target.closest('#edit-notification-modal, #delete-notification-modal, #confirm-notification-modal')) {
                return;
            }
            
            // Handle notification action buttons
            if (e.target.closest('.action-btn-mini')) {
                e.preventDefault();
                e.stopPropagation();
                
                const button = e.target.closest('.action-btn-mini');
                const notificationId = button.getAttribute('data-notification-id');
                const action = button.getAttribute('data-action');
                
                console.log('Notification button clicked:', action, 'for notification:', notificationId);
                console.log('Button element:', button);
                console.log('Button attributes:', {
                    'data-notification-id': button.getAttribute('data-notification-id'),
                    'data-action': button.getAttribute('data-action'),
                    'class': button.className
                });
                
                if (!notificationId) {
                    console.error('No notification ID found on button');
                    console.error('Button HTML:', button.outerHTML);
                    console.error('Button parent:', button.parentElement?.outerHTML);
                    this.showToast('Error: Notification ID not found', 'error');
                    return;
                }
                
                if (!action) {
                    console.error('No action found on button');
                    console.error('Button HTML:', button.outerHTML);
                    this.showToast('Error: Action not specified', 'error');
                    return;
                }
                
                if (action === 'confirm') {
                    console.log('Confirming notification:', notificationId);
                    const notificationCard = button.closest('.notification-card');
                    const messageElement = notificationCard?.querySelector('.notification-message-mini');
                    const shopElement = notificationCard?.querySelector('.shop-name-mini');
                    
                    const message = messageElement ? messageElement.textContent : '';
                    const shopName = shopElement ? shopElement.textContent : 'Unknown Shop';
                    
                    this.showConfirmationModal(notificationId, message, shopName);
                } else if (action === 'delete') {
                    console.log('Deleting notification:', notificationId);
                    this.showDeleteConfirmationModal(notificationId);
                } else {
                    console.error('Unknown action:', action);
                    this.showToast('Error: Unknown action', 'error');
                }
                return;
            }
            
            // Prevent any clicks from bubbling up
            const target = e.target.closest('button, .nav-item, .action-card');
            
            // Logout button
            if (e.target.closest('.logout-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.logout();
                return;
            }
            
            // Add order buttons (action card and floating button) - be more specific
            if (e.target.closest('#add-order-btn') || 
                (e.target.closest('.action-card') && e.target.closest('[data-action="add-order"]'))) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Add order button clicked');
                this.openOrderModal();
                return;
            }
            
            // Manage shops button - be more specific
            if (e.target.closest('.action-card') && e.target.closest('[data-action="manage-shops"]')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Manage shops button clicked');
                try {
                    await this.openShopModal();
                } catch (error) {
                    console.error('Error in manage shops button:', error);
                }
                return;
            }
            
            // Add shop button in settings
            if (e.target.closest('.add-shop-btn') || e.target.closest('.empty-action')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Add shop button clicked');
                try {
                    await this.openShopModal();
                } catch (error) {
                    console.error('Error in add shop button:', error);
                }
                return;
            }
            
            // Filter buttons
            if (e.target.closest('.filter-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const filter = e.target.closest('.filter-btn').dataset.filter;
                this.setFilter(filter);
                return;
            }
        });
        
        // Form submissions
        document.addEventListener('submit', (e) => {
            if (e.target.matches('#settings-form')) {
                e.preventDefault();
                this.saveSettings();
            }
        });
        
        // ESC key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }
    
    navigateToPage(page) {
        console.log(`Navigating to ${page}`);
        
        // Clear notification time updates when leaving notifications page
        if (this.currentPage === 'notifications' && page !== 'notifications' && this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
            console.log('Stopped notification time updates');
        }
        
        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-page') === page) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Hide all pages
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.remove('active');
        });
        
        // Show the selected page
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
        }
        
        // Update current page
        this.currentPage = page;
        
        // Always hide button first
        this.hideFloatingButton();
        
        // Handle specific page actions
        switch (page) {
            case 'home':
                this.updateRecentActivity();
                break;
            case 'orders':
                this.renderOrders();
                // Show floating button for orders page
                setTimeout(() => {
                    this.ensureFloatingButton();
                    this.showFloatingButton();
                }, 300);
                break;
            case 'notifications':
                this.loadNotifications();
                // Setup the notifications menu when navigating to notifications page
                setTimeout(() => {
                    this.setupNotificationsMenu();
                }, 100);
                break;
            case 'settings':
                this.renderSettingsPage();
                break;
            case 'profile':
                this.loadProfileData();
                break;
        }
    }
    
    updateFloatingButton(page) {
        const floatingBtn = document.getElementById('add-order-btn');
        if (floatingBtn) {
            if (page === 'orders') {
                floatingBtn.style.display = 'flex';
                floatingBtn.style.opacity = '1';
                floatingBtn.style.transform = 'scale(1)';
                floatingBtn.style.visibility = 'visible';
                console.log('Floating button shown for orders page');
            } else {
                floatingBtn.style.display = 'none';
                floatingBtn.style.opacity = '0';
                floatingBtn.style.transform = 'scale(0.8)';
                floatingBtn.style.visibility = 'hidden';
                console.log('Floating button hidden for', page, 'page');
            }
        } else {
            console.warn('Floating button not found');
            // Try to create it if it doesn't exist
            this.createFloatingButton();
        }
    }
    
    async loadUserData() {
        try {
            console.log('Loading user data for user ID:', this.userId);
            
            // Create headers with authentication
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add authorization header if we have a session token
            if (this.sessionToken) {
                headers['Authorization'] = `Bearer ${this.sessionToken}`;
            }
            
            console.log('Making authenticated request with headers:', headers);
            
            // Load shops FIRST so they're available when processing orders
            const shopsResponse = await fetch('/api/user/shops', {
                headers: headers
            });

            if (shopsResponse.ok) {
                const shopsResult = await shopsResponse.json();
                this.shops = shopsResult.shops || [];
                console.log(`✅ Loaded ${this.shops.length} shops for current user`);
            } else {
                const errorText = await shopsResponse.text();
                console.error('Failed to load shops:', errorText);
                // If authentication failed, try to logout and redirect
                if (shopsResponse.status === 401) {
                    console.warn('Authentication failed, logging out...');
                    this.logout();
                    return;
                }
            }
            
            // Load orders
            const ordersResponse = await fetch('/api/user/orders', {
                headers: headers
            });
            
            if (ordersResponse.ok) {
                const ordersResult = await ordersResponse.json();
                this.orders = ordersResult.orders || [];
                console.log(`✅ Loaded ${this.orders.length} orders for current user`);
                this.updateStats();
                this.updateRecentActivity();
            } else {
                const errorText = await ordersResponse.text();
                console.error('Failed to load orders:', errorText);
                // If authentication failed, try to logout and redirect
                if (ordersResponse.status === 401) {
                    console.warn('Authentication failed, logging out...');
                    this.logout();
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showToast('Failed to load your data. Please refresh the page.', 'error');
        }
    }
    
    updateStats() {
        const totalEarnings = this.orders.reduce((sum, order) => sum + (parseFloat(order.earnings) || 0), 0);
        const totalOrders = this.orders.length;
        
        const today = new Date().toDateString();
        const todayOrders = this.orders.filter(order => {
            const orderDate = new Date(order.created_at).toDateString();
            return orderDate === today;
        }).length;
        
        document.getElementById('total-earnings').textContent = `$${totalEarnings.toFixed(2)}`;
        document.getElementById('total-orders').textContent = totalOrders;
        document.getElementById('today-orders').textContent = todayOrders;
        document.getElementById('total-shops').textContent = this.shops.length;
    }
    
    updateRecentActivity() {
        console.log('Updating recent activity...');
        const activityContainer = document.getElementById('recent-activity');
        if (!activityContainer) return;

        // Get last 5 orders only - make sure we have orders first
        if (!this.orders || this.orders.length === 0) {
            activityContainer.innerHTML = `
                <div class="empty-activity">
                    <div class="empty-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <p>No recent activity</p>
                    <small>Your recent orders will appear here</small>
                </div>
            `;
            return;
        }

        // Ensure we only take 5 orders maximum
        const recentOrders = this.orders.slice(0, 5);
        console.log('Recent orders count:', recentOrders.length, 'Total orders:', this.orders.length);

        const activityHTML = recentOrders.map(order => `
            <div class="activity-item">
                <div class="activity-icon">
                        <i class="fas fa-shopping-bag"></i>
                    </div>
                    <div class="activity-content">
                    <div class="activity-title">Order from ${this.getShopName(order)}</div>
                    <div class="activity-details">
                        <span class="activity-price">$${parseFloat(order.price).toFixed(2)}</span>
                        <span class="activity-earnings">+$${parseFloat(order.earnings).toFixed(2)}</span>
                        </div>
                    <div class="activity-time">
                        <i class="fas fa-clock"></i>
                        ${this.formatTimeAgo(order.created_at)}
                    </div>
                </div>
            </div>
        `).join('');

        activityContainer.innerHTML = `
            <div class="activity-header">
                <h4>Recent Activity</h4>
                <span class="activity-count">${recentOrders.length}</span>
            </div>
            <div class="activity-list">
                ${activityHTML}
            </div>
            ${this.orders.length > 5 ? `
                <div class="activity-footer">
                    <button class="view-all-btn" onclick="app.navigateToPage('orders')">
                        <i class="fas fa-arrow-right"></i>
                        View All Orders (${this.orders.length})
                    </button>
                </div>
            ` : ''}
        `;
    }
    
    updateCurrentDate() {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'Europe/Athens'
        };
        const currentDateElement = document.getElementById('current-date');
        if (currentDateElement) {
            currentDateElement.textContent = now.toLocaleDateString('el-GR', options);
        }
    }
    
    formatTimeAgo(dateString) {
        // Use same logic as shop app for consistency
        const notificationDate = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - notificationDate) / 1000);
        
        // For very recent notifications (less than 30 seconds), show "Τώρα"
        if (diffInSeconds < 30) {
            return 'Τώρα';
        }
        
        // For today's notifications, show time only in Greek format
        // Convert both dates to Greece timezone for comparison
        const notificationDateGreece = new Date(notificationDate.toLocaleString("en-US", {timeZone: "Europe/Athens"}));
        const nowGreece = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Athens"}));
        const isToday = notificationDateGreece.toDateString() === nowGreece.toDateString();
        
        if (isToday) {
            // Display the time in Greek timezone
            return new Intl.DateTimeFormat('el-GR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Athens'
            }).format(notificationDate);
        }
    }
    
    // Modal methods
    openOrderModal() {
        console.log('Opening category selection modal first...');
        
        // Check if shops exist first
        if (this.shops.length === 0) {
            this.showToast('❌ Please add at least one shop before creating orders', 'error');
            setTimeout(() => {
                this.navigateToPage('settings');
            }, 1500);
            return;
        }
        
        // Check if categories exist
        if (this.categories.length === 0) {
            this.showToast('❌ No categories available. Please contact admin.', 'error');
            return;
        }
        
        this.createCategorySelectionModal();
    }

    createCategorySelectionModal() {
        console.log('Creating category selection modal...');
        
        // Remove existing modals
        this.closeModal();

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'category-selection-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 20px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                width: 100%;
                max-width: 480px;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;
            ">
                <!-- Header -->
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 24px 28px;
                    border-bottom: 1px solid #e5e7eb;
                    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
                    border-radius: 16px 16px 0 0;
                    position: relative;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: linear-gradient(135deg, #ff6b35 0%, #f12711 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 20px;
                        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                    ">
                        <i class="fas fa-th-large"></i>
                    </div>
                    <div style="flex: 1;">
                        <h3 style="
                            font-size: 20px;
                            font-weight: 700;
                            color: #1f2937;
                            margin: 0 0 4px 0;
                        ">Select Category</h3>
                        <p style="
                            font-size: 14px;
                            color: #6b7280;
                            margin: 0;
                        ">Choose the category for your order</p>
                    </div>
                    <button class="modal-close" type="button" style="
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        width: 32px;
                        height: 32px;
                        background: #f3f4f6;
                        border: none;
                        border-radius: 50%;
                        color: #6b7280;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        font-weight: bold;
                        transition: background-color 0.2s ease;
                        z-index: 1;
                    " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'"
                       title="Close Modal">
                        ×
                    </button>
                </div>

                <!-- Body -->
                <div style="padding: 24px 28px;">
                    <div class="categories-grid" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 16px;
                    ">
                        ${this.categories.filter(cat => cat.is_active).map(category => `
                            <div class="category-option" data-category-id="${category.id}" style="
                                background: white;
                                border: 2px solid #e5e7eb;
                                border-radius: 12px;
                                padding: 20px;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                text-align: center;
                            " onmouseover="this.style.borderColor='${category.color || '#ff6b35'}'; this.style.backgroundColor='${category.color || '#ff6b35'}10';"
                               onmouseout="this.style.borderColor='#e5e7eb'; this.style.backgroundColor='white';"
                               onclick="deliveryApp.selectCategoryForOrder('${category.id}')">
                                <div style="
                                    width: 48px;
                                    height: 48px;
                                    background: ${category.color || '#ff6b35'};
                                    border-radius: 50%;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    color: white;
                                    font-size: 20px;
                                    margin: 0 auto 12px auto;
                                    box-shadow: 0 4px 12px ${category.color || '#ff6b35'}30;
                                ">
                                    <i class="${category.icon || 'fas fa-utensils'}"></i>
                                </div>
                                <h4 style="
                                    font-size: 16px;
                                    font-weight: 600;
                                    color: #1f2937;
                                    margin: 0 0 4px 0;
                                ">${category.name}</h4>
                                <p style="
                                    font-size: 12px;
                                    color: #6b7280;
                                    margin: 0;
                                ">${category.description || 'Click to select'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        // Bind close events
        const closeButton = modal.querySelector('.modal-close');
        closeButton.addEventListener('click', () => {
            this.closeModal();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    selectCategoryForOrder(categoryId) {
        console.log('Category selected for order:', categoryId);
        
        // Find the selected category
        const selectedCategory = this.categories.find(cat => cat.id.toString() === categoryId.toString());
        if (!selectedCategory) {
            this.showToast('Category not found', 'error');
            return;
        }
        
        // Filter shops by the selected category
        const categoryShops = this.shops.filter(shop => shop.category_id && shop.category_id.toString() === categoryId.toString());
        
        if (categoryShops.length === 0) {
            this.showToast(`No shops available in the "${selectedCategory.name}" category. Please add shops in this category first.`, 'error');
            this.closeModal();
            return;
        }
        
        // Close category selection modal and open order modal with filtered shops
        this.closeModal();
        
        // Store selected category for the order modal
        this.selectedCategoryForOrder = selectedCategory;
        this.filteredShopsForOrder = categoryShops;
        
        // Create order modal with filtered shops
        this.createOrderModal();
    }

    async openShopModal() {
        try {
            console.log('Opening shop modal');
            
            // Ensure categories are loaded before creating the modal
            if (!this.categories || this.categories.length === 0) {
                console.log('Categories not loaded, loading now...');
                await this.loadCategories();
            }
            
            // Check if we have any active categories
            const activeCategories = this.categories.filter(cat => cat.is_active);
            if (activeCategories.length === 0) {
                this.showToast('No categories available. Please create a category first.', 'error');
                return;
            }
            
            this.createShopModal();
        } catch (error) {
            console.error('Error opening shop modal:', error);
            this.showToast('Failed to open shop modal. Please try again.', 'error');
        }
    }

    closeModal() {
        console.log('=== CLOSE STANDARD MODAL START ===');
        
        // Simply remove all modals immediately
        const modals = document.querySelectorAll('[id$="-modal"]:not(#edit-notification-modal):not(#delete-notification-modal):not(#confirm-notification-modal)');
        console.log('Found standard modals to close:', modals.length);
        
        // Log all modals in DOM for debugging
        const allModals = document.querySelectorAll('[id$="-modal"]');
        console.log('All modals in DOM:', allModals.length);
        Array.from(allModals).forEach(m => console.log('- Modal in DOM:', m.id));
        
        // Log notification modals specifically
        const notificationModals = document.querySelectorAll('#edit-notification-modal, #delete-notification-modal, #confirm-notification-modal');
        console.log('Notification modals found:', notificationModals.length);
        Array.from(notificationModals).forEach(m => console.log('- Notification modal:', m.id));
        
        modals.forEach(modal => {
            console.log('Removing standard modal:', modal.id);
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
                console.log('Standard modal removed from DOM:', modal.id);
            } else {
                console.log('Standard modal has no parent, cannot remove:', modal.id);
            }
        });
        
        // Reset body overflow
        document.body.style.overflow = 'auto';
        
        console.log('=== CLOSE STANDARD MODAL END ===');
    }
    
    createConfirmModal() {
        // Create confirm modal for deletions
        console.log('Confirm modal created');
    }
    
    async handleOrderSubmit() {
        try {
        console.log('Order form submitted');
        
            // Get form data
        const shopSelect = document.getElementById('order-shop');
        const priceInput = document.getElementById('order-price');
        const earningsInput = document.getElementById('order-earnings');
        const notesInput = document.getElementById('order-notes');
        const addressInput = document.getElementById('order-address');
                // Get the selected payment method from radio buttons
        const selectedPaymentMethod = document.querySelector('input[name="payment-method"]:checked');
        const paymentMethod = selectedPaymentMethod ? selectedPaymentMethod.value : 'cash';
        const isPaid = paymentMethod === 'paid';
        
        console.log('Selected payment method:', paymentMethod, 'isPaid:', isPaid);
        
            const formData = {
                shop_id: shopSelect?.value,
                price: isPaid ? '0' : (priceInput?.value || '0'),
                earnings: earningsInput?.value,
                notes: notesInput?.value || '',
                address: addressInput?.value || '',
                payment_method: paymentMethod
            };

            console.log('Form data collected:', formData);

            // Validate required fields
            if (!formData.shop_id) {
            this.showToast('Please select a shop', 'error');
            return;
        }

            // Only validate price if payment method is cash
            if (!isPaid && (!formData.price || formData.price <= 0)) {
            this.showToast('Please enter a valid order price', 'error');
            return;
        }

            if (!formData.earnings || formData.earnings <= 0) {
                this.showToast('Please enter valid earnings', 'error');
            return;
        }

        // Show loading state
            const submitBtn = document.querySelector('#order-form button[type="submit"]');
            const originalBtnHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Order...';
        submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';

        try {
            // Create headers with authentication
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add authorization header if we have a session token
            if (this.sessionToken) {
                headers['Authorization'] = `Bearer ${this.sessionToken}`;
            }
                
                // Submit to API
            const response = await fetch('/api/user/orders', {
                method: 'POST',
                headers: headers,
                    body: JSON.stringify(formData)
            });
                
                console.log('Response status:', response.status);

            const result = await response.json();
            console.log('Server response:', result);

                if (response.ok && result.success) {
                    // Add order to local array
                    this.orders.unshift(result.order);
                    
                    // Re-render orders if on orders page
                    if (this.currentPage === 'orders') {
                        this.renderOrders();
                    }
                    
                    // Update stats
                    this.updateUI();
                
                // Close modal
                this.closeModal();
                
                    // Show success message
                    this.showToast(result.message || 'Order added successfully!', 'success');
                
                    console.log('Order added successfully:', result.order);
            } else {
                    console.log('Server error:', result);
                    
                    // Handle authentication errors
                    if (response.status === 401) {
                        this.showToast('Authentication failed. Please log in again.', 'error');
                        this.logout();
                        return;
                    }
                    
                    throw new Error(result.message || 'Failed to add order');
            }
        } finally {
            // Reset button state
            submitBtn.innerHTML = originalBtnHTML;
            submitBtn.style.opacity = '1';
            submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error adding order:', error);
            this.showToast(error.message || 'Failed to add order', 'error');
        }
    }
    
    async handleShopSubmit() {
        try {
        console.log('Shop form submitted');
        
            // Get form data
            const nameInput = document.getElementById('shop-name');
            const categorySelect = document.getElementById('shop-category');
            const shopName = nameInput?.value?.trim();
            const categoryId = categorySelect?.value;
            
            console.log('Shop name:', shopName);
            console.log('Category ID:', categoryId);
            
            if (!shopName) {
                this.showToast('Please enter a shop name', 'error');
                return;
            }
            
            if (!categoryId) {
                this.showToast('Please select a category', 'error');
                return;
            }

        // Show loading state
            const submitBtn = document.querySelector('#shop-form button[type="submit"]');
            const originalBtnHTML = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Shop...';
        submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';

        try {
            // Create headers with authentication
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add authorization header if we have a session token
            if (this.sessionToken) {
                headers['Authorization'] = `Bearer ${this.sessionToken}`;
            }
            
            const response = await fetch('/api/user/shops', {
                method: 'POST',
                headers: headers,
                    body: JSON.stringify({
                        name: shopName,
                        category_id: parseInt(categoryId)
                    })
            });

            const result = await response.json();

                if (response.ok && result.success) {
                // Add shop to local array
                this.shops.push(result.shop);
                
                    // Re-render shops
                    this.renderShops();
                
                // Close modal
                this.closeModal();
                
                    // Show success message
                    this.showToast(result.message || 'Shop added successfully!', 'success');
                
                console.log('Shop added successfully:', result.shop);
            } else {
                    // Handle authentication errors
                    if (response.status === 401) {
                        this.showToast('Authentication failed. Please log in again.', 'error');
                        this.logout();
                        return;
                    }
                    
                    throw new Error(result.message || 'Failed to add shop');
            }
        } finally {
            // Reset button state
            submitBtn.innerHTML = originalBtnHTML;
            submitBtn.style.opacity = '1';
            submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error adding shop:', error);
            this.showToast(error.message || 'Failed to add shop', 'error');
        }
    }
    
    showFormError(input, message) {
        // Clear existing errors
        this.clearFormErrors(input);

        // Add error styling
        input.style.borderColor = '#ef4444';
        input.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.1)';

        // Create error message
        const errorElement = document.createElement('div');
        errorElement.className = 'form-error';
        errorElement.style.cssText = `
            color: #ef4444;
            font-size: 12px;
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
            animation: fadeIn 0.3s ease;
        `;
        errorElement.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;

        // Add error after input
        input.parentNode.appendChild(errorElement);

        // Auto-remove error on input
        const removeError = () => {
            this.clearFormErrors(input);
            input.removeEventListener('input', removeError);
        };
        input.addEventListener('input', removeError);
    }
    
    clearFormErrors(input) {
        // Reset input styling
        input.style.borderColor = '#e5e7eb';
        input.style.boxShadow = 'none';
        
        // Remove error messages
        const existingErrors = input.parentNode.querySelectorAll('.form-error');
        existingErrors.forEach(error => error.remove());
    }
    
    async loadSettingsData() {
        try {
            console.log('Loading settings data...');
            
            // First, fetch settings from the server
            const serverSettings = await this.getUserSettings();
            console.log('Server settings loaded:', serverSettings);
            
            // Update local settings object with server data
            if (serverSettings && serverSettings.earnings_per_order !== undefined) {
                this.settings = this.settings || {};
                this.settings.earningsPerOrder = parseFloat(serverSettings.earnings_per_order);
                console.log('Updated local settings:', this.settings);
            } else {
                // Set default if no server settings
                this.settings = this.settings || {};
                this.settings.earningsPerOrder = this.settings.earningsPerOrder || 1.50;
                console.log('Using default earnings:', this.settings.earningsPerOrder);
            }
            
            // Update UI elements if they exist
            const earningsInput = document.getElementById('earnings-per-order');
            if (earningsInput) {
                earningsInput.value = this.settings.earningsPerOrder;
                console.log('Updated earnings input to:', this.settings.earningsPerOrder);
            }
            
            // Render shops in settings
            this.renderShops();
            
            // Bind settings form if not already bound
            const settingsForm = document.getElementById('settings-form');
            if (settingsForm && !settingsForm.hasAttribute('data-bound')) {
                settingsForm.setAttribute('data-bound', 'true');
                settingsForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.saveSettings();
                });
            }
        } catch (error) {
            console.error('Error loading settings data:', error);
            // Set defaults on error
            this.settings = this.settings || {};
            this.settings.earningsPerOrder = this.settings.earningsPerOrder || 1.50;
            
            const earningsInput = document.getElementById('earnings-per-order');
            if (earningsInput) {
                earningsInput.value = this.settings.earningsPerOrder;
            }
        }
    }
    
    async saveSettings() {
        const earningsInput = document.getElementById('earnings-per-order');
        if (earningsInput) {
            const newEarnings = parseFloat(earningsInput.value) || 0;
            
            try {
                // Save to server first
                const response = await fetch('/api/user/settings', {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${this.sessionToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        earnings_per_order: newEarnings
                    })
                });
                
                if (response.ok) {
                    const savedData = await response.json();
                    console.log('Settings saved successfully:', savedData);
                    
                    // Update local settings with the server response
                    this.settings = this.settings || {};
                    this.settings.earningsPerOrder = savedData.earnings_per_order || newEarnings;
                    localStorage.setItem('deliveryAppSettings', JSON.stringify(this.settings));
                    
                    // Update the UI immediately
                    if (earningsInput) {
                        earningsInput.value = this.settings.earningsPerOrder;
                    }
                    
                    this.showToast('Settings saved successfully!', 'success');
                } else {
                    const errorText = await response.text();
                    console.error('Settings save failed:', response.status, errorText);
                    let errorMsg;
                    try {
                        const error = JSON.parse(errorText);
                        errorMsg = error.message || error.error || 'Failed to save settings';
                    } catch (e) {
                        errorMsg = `Server error: ${response.status}`;
                    }
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                this.showToast('Failed to save settings: ' + error.message, 'error');
            }
        } else {
            console.error('Earnings input not found');
            this.showToast('Error: Could not find earnings input', 'error');
        }
    }

    async loadCategories() {
        try {
            console.log('Loading categories...');
            
            // Create headers with authentication
            const headers = {
                'Content-Type': 'application/json'
            };
            
            // Add authorization header if we have a session token
            if (this.sessionToken) {
                headers['Authorization'] = `Bearer ${this.sessionToken}`;
            }
            
            const response = await fetch('/api/categories', {
                method: 'GET',
                headers: headers
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    console.warn('Categories require authentication, user needs to log in again');
                    return;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.categories = result.categories || [];
                console.log('Categories loaded successfully:', this.categories.length);
            } else {
                throw new Error(result.message || 'Failed to load categories');
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.categories = [];
            // Don't show toast for categories loading error as it's not critical for app functionality
        }
    }
    
    loadProfileData() {
        if (!this.currentUser) {
            console.error('No current user data available for profile');
            return;
        }
        
        console.log('Loading profile data for user:', this.currentUser);
        
        // Update profile display with current user data
        this.updateProfileDisplay();
        
        // Load additional profile statistics
        this.loadProfileStats();
    }

    loadProfileStats() {
        // Update profile page with user statistics
        const profileContainer = document.querySelector('#profile-page .profile-container');
        if (!profileContainer) return;
        
        // Calculate user statistics
        const totalOrders = this.orders ? this.orders.length : 0;
        const totalEarnings = this.orders ? this.orders.reduce((sum, order) => sum + (parseFloat(order.earnings) || 0), 0) : 0;
        const totalShops = this.shops ? this.shops.length : 0;
        
        // Get join date (use created_at if available, otherwise estimate)
        const joinDate = this.currentUser.created_at ? 
                        new Date(this.currentUser.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : 'Recently';
        
        // Create enhanced profile layout
        const enhancedProfile = `
            <div class="profile-card-enhanced">
                <div class="profile-header-enhanced">
                    <div class="profile-avatar-large">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="profile-info-enhanced">
                        <h2 class="profile-name-large">${this.currentUser.name || this.currentUser.email?.split('@')[0] || 'Driver'}</h2>
                        <p class="profile-email-enhanced">${this.currentUser.email || 'No email available'}</p>
                        <p class="profile-join-date">Member since ${joinDate}</p>
                    </div>
                </div>
                
                <div class="profile-stats">
                    <div class="stat-item">
                        <div class="stat-icon">
                            <i class="fas fa-shopping-bag"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalOrders}</div>
                            <div class="stat-label">Total Orders</div>
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <div class="stat-icon">
                            <i class="fas fa-dollar-sign"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">$${totalEarnings.toFixed(2)}</div>
                            <div class="stat-label">Total Earnings</div>
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <div class="stat-icon">
                            <i class="fas fa-store"></i>
                        </div>
                        <div class="stat-content">
                            <div class="stat-number">${totalShops}</div>
                            <div class="stat-label">Partner Shops</div>
                        </div>
                    </div>
                </div>
                
                <div class="profile-actions-enhanced">
                    <button class="btn-profile secondary" onclick="deliveryApp.navigateToPage('settings')">
                        <i class="fas fa-cog"></i>
                        Settings
                    </button>
                    <button class="btn-profile danger logout-btn">
                        <i class="fas fa-sign-out-alt"></i>
                        Logout
                    </button>
                </div>
            </div>
        `;
        
        profileContainer.innerHTML = enhancedProfile;
        
        // Rebind logout button
        const logoutBtn = profileContainer.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
    }
    
    updateUI() {
        if (!this.currentUser) return;
        
        // Update profile displays
        const profileElements = document.querySelectorAll('.profile-name');
        profileElements.forEach(el => {
            el.textContent = this.currentUser.name || 'User';
        });
        
        this.updateStats();
        this.updateRecentActivity();
        this.loadProfileData();
    }
    
    setFilter(filter) {
        this.currentFilter = filter;
        this.renderOrders();
        
        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
    }
    
    async logout() {
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
        
        // Clear all session data from localStorage
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
        
        this.showToast('Logged out successfully', 'success');
        
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
    }
    
    showToast(message, type = 'success') {
        // Use the new modern notification style for all toasts
        this.showModernToast(message, type);
    }
    
    // Modern toast notification (brief style for all messages)
    showModernToast(message, type = 'success') {
        // Prevent duplicate notifications
        const existingNotification = document.querySelector('.modern-toast-popup');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Determine colors and icons based on type
        let accentColor, iconClass;
        
        switch (type) {
            case 'success':
                accentColor = '#10b981';
                iconClass = 'fas fa-check-circle';
                break;
            case 'error':
                accentColor = '#ef4444';
                iconClass = 'fas fa-exclamation-circle';
                break;
            case 'warning':
                accentColor = '#f59e0b';
                iconClass = 'fas fa-exclamation-triangle';
                break;
            default: // info
                accentColor = '#3b82f6';
                iconClass = 'fas fa-info-circle';
        }
        
        const toast = document.createElement('div');
        toast.className = 'modern-toast-popup';
        toast.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            left: 16px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.8);
            z-index: 10000;
            max-width: 320px;
            margin: 0 auto;
            transform: translateY(-80px) scale(0.9);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        toast.innerHTML = `
            <div style="padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 32px; height: 32px; background: ${accentColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="${iconClass}" style="font-size: 14px; color: white;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 500; font-size: 13px; color: #1f2937; line-height: 1.3;">
                        ${message}
                    </div>
                </div>
                <button class="toast-close-btn" style="background: none; border: none; color: #9ca3af; font-size: 14px; cursor: pointer; padding: 4px; border-radius: 4px; transition: color 0.2s;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateY(0) scale(1)';
            toast.style.opacity = '1';
        }, 50);
        
        // Handle close button
        const closeBtn = toast.querySelector('.toast-close-btn');
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = '#374151';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = '#9ca3af';
        });
        closeBtn.addEventListener('click', () => {
            this.closeModernToast(toast);
        });
        
        // Auto remove after 3 seconds (brief for status messages)
        setTimeout(() => {
            if (toast.parentNode) {
                this.closeModernToast(toast);
            }
        }, 3000);
    }
    
    // Helper function to close modern toast with animation
    closeModernToast(toast) {
        toast.style.transform = 'translateY(-80px) scale(0.9)';
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
    
    // createToastContainer removed - using modern notifications only

    renderOrders() {
        console.log('Rendering orders...', this.orders.length, 'orders found');
        
        // Try both possible container IDs
        let container = document.getElementById('orders-container');
        if (!container) {
            container = document.getElementById('orders-list');
        }
        
        if (!container) {
            console.error('Orders container not found!');
            return;
        }

        // Filter orders based on current filter
        let filteredOrders = this.orders;
        if (this.currentFilter !== 'all') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (this.currentFilter === 'today') {
                filteredOrders = this.orders.filter(order => {
                    const orderDate = new Date(order.created_at);
                    orderDate.setHours(0, 0, 0, 0);
                    return orderDate.getTime() === today.getTime();
                });
            } else if (this.currentFilter === 'week') {
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                filteredOrders = this.orders.filter(order => 
                    new Date(order.created_at) >= weekAgo
                );
            } else if (this.currentFilter === 'month') {
                const monthAgo = new Date(today);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                filteredOrders = this.orders.filter(order => 
                    new Date(order.created_at) >= monthAgo
                );
            }
        }

        console.log('Filtered orders:', filteredOrders.length);

        if (filteredOrders.length === 0) {
            container.innerHTML = `
                <div class="no-orders-minimal">
                    <i class="fas fa-receipt"></i>
                    <span>No orders found</span>
                    <button class="btn-minimal" onclick="deliveryApp.openOrderModal()">
                        <i class="fas fa-plus"></i> Add Order
                    </button>
                </div>
            `;
            return;
        }

        // Sort orders by date (newest first)
        filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        container.innerHTML = filteredOrders.map(order => {
            // Use the new shop name getter function
            const shopName = this.getShopName(order);
            
            const orderDate = new Date(order.created_at);
            const timeAgo = this.getTimeAgo(orderDate);
            
            // Ensure proper number formatting
            const orderPrice = parseFloat(order.price || 0).toFixed(2);
            const orderEarnings = parseFloat(order.earnings || this.settings.earningsPerOrder).toFixed(2);
            
            return `
                <div class="order-card-minimal" data-order-id="${order.id}" onclick="deliveryApp.openOrderDetails(${order.id})">
                    <div class="order-row">
                        <div class="order-info">
                            <span class="shop-name-minimal">${shopName}</span>
                            <span class="order-amounts-minimal">$${orderPrice} → +$${orderEarnings}</span>
                        </div>
                        <div class="order-meta">
                            <span class="time-minimal">${timeAgo}</span>
                            <div class="order-actions-minimal">
                                <button class="action-btn-minimal edit" onclick="event.stopPropagation(); deliveryApp.editOrder(${order.id})" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        console.log('Orders rendered successfully');
    }

    renderShops() {
        const shopsContainer = document.getElementById('shops-display-container');
        if (shopsContainer) {
            shopsContainer.innerHTML = this.renderShopsGrid();
        }
        
        // Legacy support for other containers
        const legacyContainer = document.getElementById('shops-list');
        if (legacyContainer) {
            legacyContainer.innerHTML = this.renderShopsGrid();
        }
    }

    createOrderModal() {
        console.log('Creating order modal...');
        
        // Get default earnings from settings
        const defaultEarnings = this.settings?.earningsPerOrder || 1.50;
        
        const modalHTML = `
            <div id="order-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div style="background: white; border-radius: 12px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; position: relative;">
                    <!-- Close Button -->
                    <button class="modal-close-x" style="position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; background: #f3f4f6; border: none; border-radius: 50%; color: #6b7280; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; transition: background-color 0.2s ease; z-index: 10;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">×</button>
                    
                    <div style="padding: 24px 24px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; padding-right: 40px;">
                            <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f2937; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-plus-circle" style="color: var(--primary-color);"></i>
                                Add New Order
                            </h3>
                    </div>
                        <p style="margin: 8px 0 16px; color: #6b7280; font-size: 14px;">Record a new delivery order</p>
                </div>

                    <form id="order-form" style="padding: 0 24px 24px;">
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                                <i class="fas fa-store" style="color: var(--primary-color); margin-right: 6px;"></i>
                                Restaurant/Shop <span style="color: #ef4444;">*</span>
                            </label>
                            <select id="order-shop" required style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white;">
                                <option value="">Select a shop...</option>
                                ${(this.filteredShopsForOrder || this.shops).map(shop => `<option value="${shop.id}">${shop.name}</option>`).join('')}
                            </select>
                            ${this.selectedCategoryForOrder ? `
                                <small style="color: #6b7280; font-size: 12px; margin-top: 4px; display: block;">
                                    <i class="fas fa-info-circle" style="color: #ff6b35;"></i>
                                    Showing shops in "${this.selectedCategoryForOrder.name}" category
                                </small>
                            ` : ''}
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                                <i class="fas fa-money-bill-wave" style="color: var(--primary-color); margin-right: 6px;"></i>
                                Payment Method <span style="color: #ef4444;">*</span>
                            </label>
                            <div style="display: flex; gap: 12px;">
                                <label style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer; background: white;">
                                    <input type="radio" name="payment-method" value="paid" id="payment-paid" checked>
                                    <span style="font-size: 14px;">Paid</span>
                                </label>
                                <label style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; cursor: pointer; background: white;">
                                    <input type="radio" name="payment-method" value="cash" id="payment-cash">
                                    <span style="font-size: 14px;">Cash</span>
                                </label>
                            </div>
                        </div>
                        
                        <div id="price-container" style="margin-bottom: 16px; display: none;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                                <i class="fas fa-dollar-sign" style="color: var(--primary-color); margin-right: 6px;"></i>
                                Order Price <span style="color: #ef4444;">*</span>
                            </label>
                            <input type="number" id="order-price" step="0.01" min="0" placeholder="Enter order price" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                                <i class="fas fa-map-marker-alt" style="color: var(--primary-color); margin-right: 6px;"></i>
                                Delivery Address
                            </label>
                            <input type="text" id="order-address" placeholder="Enter delivery address" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                                <i class="fas fa-coins" style="color: var(--primary-color); margin-right: 6px;"></i>
                                Your Earnings <span style="color: #ef4444;">*</span>
                            </label>
                            <input type="number" id="order-earnings" step="0.01" min="0" required value="${defaultEarnings}" placeholder="Enter your earnings" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;">
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                                <i class="fas fa-sticky-note" style="color: var(--primary-color); margin-right: 6px;"></i>
                                Notes (Optional)
                            </label>
                            <textarea id="order-notes" placeholder="Add any notes about this order..." style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; min-height: 80px; resize: vertical;"></textarea>
                        </div>
                        
                        <div style="display: flex; gap: 12px; justify-content: flex-end;">
                            <button type="button" class="modal-close" style="padding: 10px 20px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background-color 0.2s ease;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
                                Cancel
                            </button>
                            <button type="submit" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-plus"></i> 
                                Add Order
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
        
        // Get the modal element
        const modal = document.getElementById('order-modal');

        // Bind events
        this.bindModalEvents(modal);
        
        // Handle payment method change
        const paidRadio = document.getElementById('payment-paid');
        const cashRadio = document.getElementById('payment-cash');
        const priceContainer = document.getElementById('price-container');
        const priceInput = document.getElementById('order-price');
        
        if (paidRadio && cashRadio && priceContainer && priceInput) {
            // Initial state - hide price for paid
            priceContainer.style.display = 'none';
            priceInput.required = false;
            
            // Event listeners for radio buttons
            paidRadio.addEventListener('change', () => {
                if (paidRadio.checked) {
                    priceContainer.style.display = 'none';
                    priceInput.required = false;
                }
            });
            
            cashRadio.addEventListener('change', () => {
                if (cashRadio.checked) {
                    priceContainer.style.display = 'block';
                    priceInput.required = true;
                }
            });
        }
        
        // Bind form submission specifically
        const orderForm = document.getElementById('order-form');
        if (orderForm) {
            orderForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Order form submitted via event listener');
                this.handleOrderSubmit();
            });
        }
    }

    createShopModal() {
        console.log('Creating simplified functional shop modal...');
        
        // Remove existing modals
        this.closeModal();

        // Create modal with inline styles (like the test modal)
        const modal = document.createElement('div');
        modal.id = 'shop-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 20px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                width: 100%;
                max-width: 480px;
                max-height: 90vh;
                overflow-y: auto;
                position: relative;

            ">
                <!-- Header -->
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 24px 28px;
                    border-bottom: 1px solid #e5e7eb;
                    background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
                    border-radius: 16px 16px 0 0;
                    position: relative;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: linear-gradient(135deg, #ff6b35 0%, #f12711 100%);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 20px;
                        box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                    ">
                        <i class="fas fa-store"></i>
                    </div>
                    <div style="flex: 1;">
                        <h3 style="
                            font-size: 20px;
                            font-weight: 700;
                            color: #1f2937;
                            margin: 0 0 4px 0;
                        ">Add New Shop</h3>
                        <p style="
                            font-size: 14px;
                            color: #6b7280;
                            margin: 0;
                        ">Add a restaurant or shop you deliver for</p>
                    </div>
                    <button class="modal-close" type="button" style="
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        width: 32px;
                        height: 32px;
                        background: #f3f4f6;
                        border: none;
                        border-radius: 50%;
                        color: #6b7280;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        font-weight: bold;
                        transition: background-color 0.2s ease;
                        z-index: 1;
                    " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'"
                       title="Close Modal">
                        ×
                    </button>
                </div>

                <!-- Body -->
                <div style="padding: 32px 28px;">
                    <form id="shop-form">
                        <!-- Shop Name Input -->
                        <div style="margin-bottom: 24px;">
                            <label style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                font-size: 14px;
                                font-weight: 600;
                                color: #1f2937;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-tag" style="color: #ff6b35; width: 16px;"></i>
                                <span>Shop Name</span>
                            </label>
                            <input 
                                type="text" 
                                id="shop-name" 
                                name="shop-name"
                                placeholder="e.g., McDonald's, Pizza Hut, KFC, Subway..." 
                                required 
                                autofocus
                                maxlength="50"
                                autocomplete="off"
                                style="
                                    width: 100%;
                                    padding: 16px 20px;
                                    border: 2px solid #e5e7eb;
                                    border-radius: 12px;
                                    font-size: 16px;
                                    background: white;
                                    color: #1f2937;
                                    transition: all 0.3s ease;
                                    box-sizing: border-box;
                                    font-family: inherit;
                                "
                                onfocus="this.style.borderColor='#ff6b35'; this.style.boxShadow='0 0 0 4px rgba(255, 107, 53, 0.1)';"
                                onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';"
                            >
                            <small style="
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                font-size: 12px;
                                color: #6b7280;
                                margin-top: 8px;
                                opacity: 0.8;
                            ">
                                <i class="fas fa-info-circle" style="color: #ff6b35; font-size: 10px;"></i>
                                Enter the name of the restaurant or shop you deliver for
                            </small>
                        </div>

                        <!-- Category Selection -->
                        <div style="margin-bottom: 24px;">
                            <label style="
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                font-size: 14px;
                                font-weight: 600;
                                color: #1f2937;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-th-large" style="color: #ff6b35; width: 16px;"></i>
                                <span>Category *</span>
                            </label>
                            <select 
                                id="shop-category" 
                                name="shop-category"
                                required
                                style="
                                    width: 100%;
                                    padding: 16px 20px;
                                    border: 2px solid #e5e7eb;
                                    border-radius: 12px;
                                    font-size: 16px;
                                    background: white;
                                    color: #1f2937;
                                    transition: all 0.3s ease;
                                    box-sizing: border-box;
                                    font-family: inherit;
                                    cursor: pointer;
                                "
                                onfocus="this.style.borderColor='#ff6b35'; this.style.boxShadow='0 0 0 4px rgba(255, 107, 53, 0.1)';"
                                onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';"
                            >
                                <option value="">Select a category</option>
                                ${this.categories.filter(cat => cat.is_active).map(category => `
                                    <option value="${category.id}">${category.name}</option>
                                `).join('')}
                            </select>
                            <small style="
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                font-size: 12px;
                                color: #6b7280;
                                margin-top: 8px;
                                opacity: 0.8;
                            ">
                                <i class="fas fa-info-circle" style="color: #ff6b35; font-size: 10px;"></i>
                                Select the category that best describes this shop
                            </small>
                        </div>
                        
                        <!-- Form Actions -->
                        <div style="
                            display: flex;
                            gap: 16px;
                            margin-top: 32px;
                            padding-top: 24px;
                            border-top: 1px solid #e5e7eb;
                        ">
                            <button type="button" class="btn secondary modal-close" style="
                                flex: 1;
                                min-width: 120px;
                                padding: 14px 20px;
                                font-size: 15px;
                                font-weight: 600;
                                border-radius: 12px;
                                background: #f9fafb;
                                color: #6b7280;
                                border: 2px solid #e5e7eb;
                                cursor: pointer;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 8px;
                            " onmouseover="this.style.background='#e5e7eb'; this.style.color='#1f2937';"
                               onmouseout="this.style.background='#f9fafb'; this.style.color='#6b7280';">
                                <i class="fas fa-times"></i> 
                                <span>Cancel</span>
                            </button>
                            <button type="submit" id="shop-submit-btn" style="
                                flex: 1;
                                min-width: 120px;
                                padding: 14px 20px;
                                font-size: 15px;
                                font-weight: 600;
                                border-radius: 12px;
                                background: linear-gradient(135deg, #ff6b35 0%, #f12711 100%);
                                color: white;
                                border: none;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 8px;
                                box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
                            " onmouseover="this.style.boxShadow='0 6px 20px rgba(255, 107, 53, 0.4)';"
                               onmouseout="this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.3)';">
                                <i class="fas fa-plus"></i> 
                                <span>Add Shop</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add to DOM immediately
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        console.log('Modal added and shown:', modal);

        // Bind events
        this.bindModalEvents(modal);
        
        // Focus input
        setTimeout(() => {
            const shopNameInput = modal.querySelector('#shop-name');
            if (shopNameInput) {
                shopNameInput.focus();
                shopNameInput.select();
                console.log('Focused on shop name input');
            }
        }, 100);
    }

    bindModalEvents(modal) {
        console.log('Binding modal events...');
        
        // Close button events (both × and Cancel buttons)
        const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-x');
        console.log('Found close buttons:', closeButtons.length);
        
        closeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Close button clicked');
                e.preventDefault();
                e.stopPropagation();
                this.closeModal();
            });
        });

        // Background click to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked, closing modal');
                this.closeModal();
            }
        });

        // Prevent modal content clicks from closing modal
        const modalContent = modal.querySelector('[style*="background: white"]');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Form submission for shops
        const shopForm = modal.querySelector('#shop-form');
        if (shopForm) {
            console.log('Binding shop form submission');
            shopForm.addEventListener('submit', (e) => {
                console.log('Shop form submitted');
                e.preventDefault();
                e.stopPropagation();
                this.handleShopSubmit();
            });
        }

        // Focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) {
                firstInput.focus();
                console.log('Focused on first input');
            }
        }, 100);
    }

    getTimeAgo(date) {
        // Simple, reliable Greek time display
        const notificationDate = new Date(date);
        const now = new Date();
        const diffInSeconds = Math.floor((now - notificationDate) / 1000);
        
        // For very recent notifications (less than 30 seconds), show "Τώρα"
        if (diffInSeconds < 30) {
            return 'Τώρα';
        }
        
        // Always show Greek time
        return new Intl.DateTimeFormat('el-GR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Athens'
        }).format(notificationDate);
    }

    async editShop(shopId) {
        try {
            console.log('Editing shop with ID:', shopId);
            const shop = this.shops.find(s => s.id === shopId || s.id.toString() === shopId.toString());
            if (!shop) {
                this.showToast('Shop not found', 'error');
                console.error('Shop not found with ID:', shopId);
                return;
            }
            
            // Ensure categories are loaded before creating the edit modal
            if (!this.categories || this.categories.length === 0) {
                console.log('Categories not loaded for edit, loading now...');
                await this.loadCategories();
            }

        // Remove existing modal if any
        const existingEditModal = document.getElementById('edit-shop-modal');
        if (existingEditModal) {
            existingEditModal.remove();
        }
        
        // Create modal with direct HTML insertion - simplest approach
        const modalHTML = `
        <div id="edit-shop-modal" style="
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.7) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
            padding: 20px !important;
        ">
            <div style="
                background: white !important;
                border-radius: 16px !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
                width: 100% !important;
                max-width: 500px !important;
                position: relative !important;
                overflow: hidden !important;
                margin: 0 auto !important;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    padding: 24px;
                    text-align: center;
                    color: white;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 12px auto;
                        backdrop-filter: blur(10px);
                    ">
                        <i class="fas fa-store" style="font-size: 20px;"></i>
                    </div>
                    <h3 style="
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                    ">Edit Shop</h3>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px;">
                    <form id="edit-shop-form">
                        <div style="margin-bottom: 20px;">
                            <label for="edit-shop-name" style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                Shop Name
                            </label>
                            <input 
                                type="text" 
                                id="edit-shop-name" 
                                value="${this.escapeHTML(shop.name)}" 
                                placeholder="Enter shop name" 
                                required
                                style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 1px solid #d1d5db;
                                    border-radius: 8px;
                                    font-size: 15px;
                                "
                            >
                            <div class="form-error" style="
                                color: #ef4444;
                                font-size: 14px;
                                margin-top: 4px;
                            "></div>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <label for="edit-shop-category" style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                Category *
                            </label>
                            <select 
                                id="edit-shop-category" 
                                required
                                style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 1px solid #d1d5db;
                                    border-radius: 8px;
                                    font-size: 15px;
                                    background: white;
                                    cursor: pointer;
                                "
                            >
                                <option value="">Select a category</option>
                                ${this.categories.filter(cat => cat.is_active).map(category => `
                                    <option value="${category.id}" ${shop.category_id === category.id ? 'selected' : ''}>
                                        ${category.name}
                                    </option>
                                `).join('')}
                            </select>
                            <div class="category-form-error" style="
                                color: #ef4444;
                                font-size: 14px;
                                margin-top: 4px;
                            "></div>
                        </div>
                    </form>
                </div>
                
                <!-- Actions -->
                <div style="
                    display: flex;
                    gap: 12px;
                    padding: 0 24px 24px;
                ">
                    <button id="edit-shop-cancel" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #64748b;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        Cancel
                    </button>
                    <button id="edit-shop-save" style="
                        flex: 2;
                        padding: 12px 16px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    ">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        </div>
        `;
        
        // Insert the modal HTML directly into the body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
        
        console.log('Edit shop modal added to DOM with ID: edit-shop-modal');
        
        // Get references to the modal and buttons
        const modal = document.getElementById('edit-shop-modal');
        const cancelBtn = document.getElementById('edit-shop-cancel');
        const saveBtn = document.getElementById('edit-shop-save');
        
        console.log('Cancel button found:', !!cancelBtn);
        console.log('Save button found:', !!saveBtn);
        
        // Bind events to the modal buttons
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cancel button clicked');
                modal.remove();
                document.body.style.overflow = 'auto';
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Save button clicked');
                
                // Get form data
                const shopName = document.getElementById('edit-shop-name').value.trim();
                const categoryId = document.getElementById('edit-shop-category').value;
                
                // Validate
                if (!shopName) {
                    const errorDiv = document.querySelector('.form-error');
                    errorDiv.textContent = 'Shop name is required';
                    return;
                }
                
                if (!categoryId) {
                    const errorDiv = document.querySelector('.category-form-error');
                    errorDiv.textContent = 'Category is required';
                    return;
                }
                
                // Show loading state
                this.showLoadingOverlay('Updating shop...');
                
                try {
                    // Create headers with authentication
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                    
                    // Add authorization header if we have a session token
                    if (this.sessionToken) {
                        headers['Authorization'] = `Bearer ${this.sessionToken}`;
                    }
                    
                    const response = await fetch(`/api/partner_shops/${shop.id}`, {
                        method: 'PUT',
                        headers: headers,
                        body: JSON.stringify({ 
                            name: shopName,
                            category_id: parseInt(categoryId)
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Update local data
                        const updatedShop = result.shop || { ...shop, name: shopName };
                        this.shops = this.shops.map(s => {
                            if (s.id === shop.id || s.id.toString() === shop.id.toString()) {
                                return updatedShop;
                            }
                            return s;
                        });
                        
                        // Close modal
                        modal.remove();
                        document.body.style.overflow = 'auto';
                        
                        // Show success message
                        this.showToast('Shop updated successfully!', 'success');
                        
                        // Update UI
                        if (document.getElementById('shops-display-container')) {
                            document.getElementById('shops-display-container').innerHTML = this.renderShopsGrid();
                        }
                    } else {
                        // Handle error
                        this.showToast(result.message || 'Failed to update shop', 'error');
                    }
                } catch (error) {
                    console.error('Error updating shop:', error);
                    this.showToast('Network error. Please try again.', 'error');
                } finally {
                    this.hideLoadingOverlay();
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked, closing modal');
                modal.remove();
                document.body.style.overflow = 'auto';
            }
        });
        
        // Focus on input
        setTimeout(() => {
            const input = document.getElementById('edit-shop-name');
            if (input) {
                input.focus();
                // Position cursor at end of text
                input.selectionStart = input.selectionEnd = input.value.length;
            }
            
            // Debug modal visibility
            this.debugModalVisibility('edit-shop-modal');
        }, 100);
        } catch (error) {
            console.error('Error in editShop:', error);
            this.showToast('Failed to open edit modal. Please try again.', 'error');
        }
    }

    async deleteShop(shopId) {
        console.log('Deleting shop with ID:', shopId);
        const shop = this.shops.find(s => s.id === shopId || s.id.toString() === shopId.toString());
        if (!shop) {
            this.showToast('Shop not found', 'error');
            console.error('Shop not found with ID:', shopId);
            return;
        }

        // Remove existing modal if any
        const existingDeleteModal = document.getElementById('delete-shop-modal');
        if (existingDeleteModal) {
            existingDeleteModal.remove();
        }
        
        // Create modal with direct HTML insertion - simplest approach
        const modalHTML = `
        <div id="delete-shop-modal" style="
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.7) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
            padding: 20px !important;
        ">
            <div style="
                background: white !important;
                border-radius: 16px !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
                width: 100% !important;
                max-width: 500px !important;
                position: relative !important;
                overflow: hidden !important;
                margin: 0 auto !important;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    padding: 24px;
                    text-align: center;
                    color: white;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 12px auto;
                        backdrop-filter: blur(10px);
                    ">
                        <i class="fas fa-trash-alt" style="font-size: 20px;"></i>
                    </div>
                    <h3 style="
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                    ">Delete Shop</h3>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px; text-align: center;">
                    <div style="
                        text-align: center;
                        padding: 20px 0;
                    ">
                        <div style="
                            font-size: 48px;
                            color: #f59e0b;
                            margin-bottom: 16px;
                        ">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <p style="
                            font-size: 16px;
                            margin-bottom: 8px;
                        ">Are you sure you want to delete <strong>${this.escapeHTML(shop.name)}</strong>?</p>
                        <p style="
                            color: #64748b;
                            font-size: 14px;
                            margin-top: 8px;
                        ">This action cannot be undone. Orders from this shop will still be visible in your history.</p>
                    </div>
                </div>
                
                <!-- Actions -->
                <div style="
                    display: flex;
                    gap: 12px;
                    padding: 0 24px 24px;
                    justify-content: center;
                ">
                    <button id="delete-shop-cancel" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #64748b;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button id="delete-shop-confirm" style="
                        flex: 1;
                        padding: 12px 16px;
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
                    ">
                        <i class="fas fa-trash-alt"></i> Delete Shop
                    </button>
                </div>
            </div>
        </div>
        `;
        
        // Insert the modal HTML directly into the body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
        
        console.log('Delete shop modal added to DOM with ID: delete-shop-modal');
        
        // Get references to the modal and buttons
        const modal = document.getElementById('delete-shop-modal');
        const cancelBtn = document.getElementById('delete-shop-cancel');
        const deleteBtn = document.getElementById('delete-shop-confirm');
        
        console.log('Cancel button found:', !!cancelBtn);
        console.log('Delete button found:', !!deleteBtn);
        
        // Bind events to the modal buttons
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cancel button clicked');
                modal.remove();
                document.body.style.overflow = 'auto';
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Delete button clicked');
                
                // Show loading state
                this.showLoadingOverlay('Deleting shop...');
                
                try {
                    // Create headers with authentication
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                    
                    // Add authorization header if we have a session token
                    if (this.sessionToken) {
                        headers['Authorization'] = `Bearer ${this.sessionToken}`;
                    }
                    
                    const response = await fetch(`/api/user/shops/${shop.id}`, {
                        method: 'DELETE',
                        headers: headers
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Update local data
                        this.shops = this.shops.filter(s => s.id !== shop.id && s.id.toString() !== shop.id.toString());
                        
                        // Close modal
                        modal.remove();
                        document.body.style.overflow = 'auto';
                        
                        // Show success message
                        this.showToast('Shop deleted successfully!', 'success');
                        
                        // Update UI
                        if (document.getElementById('shops-display-container')) {
                            document.getElementById('shops-display-container').innerHTML = this.renderShopsGrid();
                        }
                    } else {
                        // Handle error
                        this.showToast(result.message || 'Failed to delete shop', 'error');
                    }
                } catch (error) {
                    console.error('Error deleting shop:', error);
                    this.showToast('Network error. Please try again.', 'error');
                } finally {
                    this.hideLoadingOverlay();
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked, closing delete shop modal');
                modal.remove();
                document.body.style.overflow = 'auto';
            }
        });
        
        // Debug modal visibility
        setTimeout(() => {
            this.debugModalVisibility('delete-shop-modal');
        }, 100);
    }

    editOrder(orderId) {
        console.log('Editing order with ID:', orderId);
        const order = this.orders.find(o => o.id === orderId || (o.id && o.id.toString() === orderId.toString()));
        if (!order) {
            this.showToast('Order not found', 'error');
            console.error('Order not found with ID:', orderId);
            return;
        }

        // Close any existing modals first
        this.closeModal();
        
        // Get shop information
        const shopId = order.shop_id || '';
        console.log('Looking for shop with ID:', shopId);
        
        const shop = this.shops.find(s => {
            if (!s || !s.id) return false;
            if (!shopId) return false;
            
            const shopIdStr = typeof shopId === 'string' ? shopId : String(shopId);
            const sIdStr = typeof s.id === 'string' ? s.id : String(s.id);
            
            return s.id === shopId || sIdStr === shopIdStr;
        });
        
        const shopName = shop ? shop.name : 'Unknown Shop';
        
        // Create modal with direct HTML insertion - simplest approach
        const modalHTML = `
        <div id="edit-order-modal" style="
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.7) !important;
            display: flex !important;
            align-items: flex-start !important;
            justify-content: center !important;
            z-index: 999999 !important;
            padding: 20px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
        ">
            <div style="
                background: white !important;
                border-radius: 16px !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
                width: 100% !important;
                max-width: 500px !important;
                position: relative !important;
                margin: 20px auto !important;
                max-height: calc(100vh - 40px) !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    padding: 24px;
                    text-align: center;
                    color: white;
                    flex-shrink: 0;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 12px auto;
                        backdrop-filter: blur(10px);
                    ">
                        <i class="fas fa-edit" style="font-size: 20px;"></i>
                    </div>
                    <h3 style="
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                    ">Edit Order</h3>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px; overflow-y: auto; flex: 1;">
                    <form id="edit-order-form">
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-store" style="margin-right: 8px;"></i>
                                Restaurant/Shop
                            </label>
                            <select id="edit-order-shop" style="
                                width: 100%;
                                padding: 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 8px;
                                font-size: 15px;
                            ">
                                ${this.shops.map(s => {
                                    const shopIdStr = shopId ? (typeof shopId === 'string' ? shopId : String(shopId)) : '';
                                    const sIdStr = s.id ? (typeof s.id === 'string' ? s.id : String(s.id)) : '';
                                    const isSelected = sIdStr === shopIdStr;
                                    return `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-map-marker-alt" style="margin-right: 8px;"></i>
                                Delivery Address
                            </label>
                            <textarea 
                                id="edit-order-address" 
                                placeholder="Enter delivery address" 
                                style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 1px solid #d1d5db;
                                    border-radius: 8px;
                                    font-size: 15px;
                                    min-height: 80px;
                                    resize: vertical;
                                "
                            >${order.address || ''}</textarea>
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-credit-card" style="margin-right: 8px;"></i>
                                Payment Method
                            </label>
                            <select id="edit-order-payment" style="
                                width: 100%;
                                padding: 12px;
                                border: 1px solid #d1d5db;
                                border-radius: 8px;
                                font-size: 15px;
                            " onchange="deliveryApp.handlePaymentMethodChange()">
                                <option value="cash" ${(order.payment_method || 'cash') === 'cash' ? 'selected' : ''}>Cash</option>
                                <option value="paid" ${order.payment_method === 'paid' ? 'selected' : ''}>Paid</option>
                            </select>
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-dollar-sign" style="margin-right: 8px;"></i>
                                Order Price
                            </label>
                            <input 
                                type="number" 
                                id="edit-order-price" 
                                value="${order.price || ''}" 
                                step="0.01"
                                min="0"
                                placeholder="Enter order price" 
                                style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 1px solid #d1d5db;
                                    border-radius: 8px;
                                    font-size: 15px;
                                "
                                ${order.payment_method === 'paid' ? 'disabled' : ''}
                            >
                            ${order.payment_method === 'paid' ? `
                                <small style="color: #6b7280; font-size: 12px; margin-top: 4px; display: block;">
                                    <i class="fas fa-info-circle"></i> Price is locked when payment is marked as "Paid"
                                </small>
                            ` : ''}
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-coins" style="margin-right: 8px;"></i>
                                Your Earnings (Cannot be modified)
                            </label>
                            <input 
                                type="number" 
                                id="edit-order-earnings" 
                                value="${order.earnings || ''}" 
                                disabled
                                style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 1px solid #d1d5db;
                                    border-radius: 8px;
                                    font-size: 15px;
                                    background-color: #f3f4f6;
                                    cursor: not-allowed;
                                "
                            >
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="
                                display: block;
                                font-size: 14px;
                                font-weight: 500;
                                color: #4b5563;
                                margin-bottom: 8px;
                            ">
                                <i class="fas fa-sticky-note" style="margin-right: 8px;"></i>
                                Notes
                            </label>
                            <textarea 
                                id="edit-order-notes" 
                                placeholder="Enter notes about this order" 
                                style="
                                    width: 100%;
                                    padding: 12px;
                                    border: 1px solid #d1d5db;
                                    border-radius: 8px;
                                    font-size: 15px;
                                    min-height: 100px;
                                    resize: vertical;
                                "
                            >${order.notes || ''}</textarea>
                        </div>
                    </form>
                </div>
                
                <!-- Actions -->
                <div style="
                    display: flex;
                    gap: 12px;
                    padding: 0 24px 24px;
                    flex-shrink: 0;
                    border-top: 1px solid #e5e7eb;
                    background: white;
                ">
                    <button id="edit-order-cancel" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #64748b;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        Cancel
                    </button>
                    <button id="edit-order-save" style="
                        flex: 2;
                        padding: 12px 16px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    ">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        </div>
        `;
        
        // Create a modal element and append it to the body
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHTML;
        document.body.appendChild(modalElement.firstElementChild);
        document.body.style.overflow = 'hidden';
        
        console.log('Edit order modal added to DOM with ID: edit-order-modal');
        
        // Get references to the modal and buttons
        const modal = document.getElementById('edit-order-modal');
        const cancelBtn = document.getElementById('edit-order-cancel');
        const saveBtn = document.getElementById('edit-order-save');
        
        console.log('Modal found:', !!modal);
        console.log('Cancel button found:', !!cancelBtn);
        console.log('Save button found:', !!saveBtn);
        
        // Bind events to the modal buttons
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cancel button clicked');
                this.closeModal();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Save button clicked');
                
                // Get form data
                const shopId = document.getElementById('edit-order-shop').value;
                const price = document.getElementById('edit-order-price').value;
                const notes = document.getElementById('edit-order-notes').value;
                const address = document.getElementById('edit-order-address').value;
                const paymentMethod = document.getElementById('edit-order-payment').value;
                
                // Validate
                if (!shopId) {
                    this.showToast('Please select a shop', 'error');
                    return;
                }
                
                // For paid orders, allow 0 price, for cash orders require valid price > 0
                if (paymentMethod === 'paid') {
                if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
                        this.showToast('Please enter a valid price (0 or higher for paid orders)', 'error');
                    return;
                    }
                } else {
                    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
                        this.showToast('Please enter a valid price greater than 0', 'error');
                        return;
                    }
                }
                
                // Show loading state
                this.showLoadingOverlay('Updating order...');
                
                try {
                    // Create headers with authentication
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                    
                    // Add authorization header if we have a session token
                    if (this.sessionToken) {
                        headers['Authorization'] = `Bearer ${this.sessionToken}`;
                    }
                    
                    const response = await fetch(`/api/user/orders/${order.id}`, {
                        method: 'PUT',
                        headers: headers,
                        body: JSON.stringify({ 
                            shop_id: shopId,
                            price: parseFloat(price),
                            notes: notes,
                            address: address,
                            payment_method: paymentMethod,
                            // Keep original earnings
                            earnings: parseFloat(order.earnings || 0)
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        // Update local data
                        const updatedOrder = result.order || { 
                            ...order, 
                            shop_id: shopId,
                            price: parseFloat(price),
                            notes: notes,
                            address: address,
                            payment_method: paymentMethod
                        };
                        
                        this.orders = this.orders.map(o => {
                            if (o.id === order.id || (o.id && order.id && o.id.toString() === order.id.toString())) {
                                return updatedOrder;
                            }
                            return o;
                        });
                        
                        // Close modal
                        this.closeModal();
                        
                        // Show success message
                        this.showToast('Order updated successfully!', 'success');
                        
                        // Update UI
                        this.renderOrders();
                        this.updateStats();
                    } else {
                        // Handle error
                        this.showToast(result.message || 'Failed to update order', 'error');
                    }
                } catch (error) {
                    console.error('Error updating order:', error);
                    this.showToast('Network error. Please try again.', 'error');
                } finally {
                    this.hideLoadingOverlay();
                }
            });
        }
        
        // Close on background click
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    console.log('Background clicked, closing modal');
                    this.closeModal();
                }
            });
            
            // Debug modal visibility
            setTimeout(() => {
                this.debugModalVisibility('edit-order-modal');
            }, 100);
        }
    }

    async deleteOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            this.showToast('Order not found', 'error');
            return;
        }

        const shop = this.shops.find(s => s.id === order.shop_id);
        const shopName = shop ? shop.name : 'Unknown Shop';

        if (!confirm(`Are you sure you want to delete the order from ${shopName}?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/user/orders/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();

            if (result.success) {
                // Remove from local array
                this.orders = this.orders.filter(o => o.id !== orderId);
                
                this.showToast('Order deleted successfully!', 'success');
                this.updateStats();
                this.renderOrders();
                this.updateRecentActivity();
            } else {
                this.showToast(result.message || 'Failed to delete order', 'error');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            this.showToast('Network error. Please try again.', 'error');
        }
    }

    openOrderDetails(orderId) {
        console.log('Opening order details for ID:', orderId);
        
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            this.showToast('Order not found', 'error');
            return;
        }
        
        this.createOrderDetailsModal(order);
    }

    createOrderDetailsModal(order) {
        console.log('Creating minimal order details modal for:', order);
        
        // Remove existing modals
        this.closeModal();
        
        // Get shop name
        let shopName = 'Unknown Shop';
        if (order.shop_name) {
            shopName = order.shop_name;
        } else if (order.shop_id) {
            const shop = this.shops.find(s => s.id === parseInt(order.shop_id));
            shopName = shop ? shop.name : `Shop #${order.shop_id}`;
        }
        
        const orderDate = new Date(order.created_at);
        const formattedDate = orderDate.toLocaleDateString('el-GR', { timeZone: 'Europe/Athens' });
        const formattedTime = orderDate.toLocaleTimeString('el-GR', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'Europe/Athens'
        });
        
        const orderPrice = parseFloat(order.price || 0).toFixed(2);
        const orderEarnings = parseFloat(order.earnings || this.settings.earningsPerOrder).toFixed(2);
        
        // Create modal
        const modal = document.createElement('div');
        modal.id = 'order-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 20px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 6px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                width: 100%;
                max-width: 380px;
                position: relative;
            ">
                <!-- Header -->
                <div style="
                    padding: 16px 20px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div>
                        <h3 style="font-size: 16px; font-weight: 600; margin: 0; color: #111827;">Order Details</h3>
                        <p style="font-size: 12px; color: #6b7280; margin: 2px 0 0 0;">${shopName}</p>
                    </div>
                    <button class="modal-close" type="button" style="
                        position: absolute;
                        top: 16px;
                        right: 16px;
                        width: 28px;
                        height: 28px;
                        background: #f3f4f6;
                        border: none;
                        border-radius: 50%;
                        color: #6b7280;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 14px;
                        font-weight: bold;
                        transition: background-color 0.2s ease;
                        z-index: 1;
                    " onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                        ×
                    </button>
                </div>
                
                <!-- Content -->
                <div style="padding: 20px;">
                    <!-- Amounts -->
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 16px;
                        padding: 12px;
                        background: #f9fafb;
                        border-radius: 4px;
                    ">
                        <div style="text-align: center; flex: 1;">
                            <div style="color: #6b7280; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">Order</div>
                            <div style="color: #111827; font-size: 18px; font-weight: 700;">$${orderPrice}</div>
                        </div>
                        <div style="text-align: center; flex: 1;">
                            <div style="color: #059669; font-size: 10px; text-transform: uppercase; margin-bottom: 2px;">Earned</div>
                            <div style="color: #059669; font-size: 18px; font-weight: 700;">$${orderEarnings}</div>
                        </div>
                    </div>
                    
                    <!-- Date & Time -->
                    <div style="
                        padding: 12px;
                        background: #f9fafb;
                        border-radius: 4px;
                        margin-bottom: 16px;
                        text-align: center;
                    ">
                        <div style="font-size: 13px; color: #374151; margin-bottom: 2px;">${formattedDate} at ${formattedTime}</div>
                        <div style="font-size: 11px; color: #9ca3af;">${this.getTimeAgo(orderDate)}</div>
                    </div>
                    
                    <!-- Address -->
                    ${order.address ? `
                        <div style="
                            padding: 12px;
                            background: #ecfdf5;
                            border-radius: 4px;
                            margin-bottom: 16px;
                        ">
                            <div style="font-size: 11px; color: #065f46; text-transform: uppercase; margin-bottom: 4px;">Delivery Address</div>
                            <div style="color: #047857; font-size: 13px; line-height: 1.4;">${order.address}</div>
                        </div>
                    ` : ''}
                    
                    <!-- Payment Method -->
                    <div style="
                        padding: 12px;
                        background: #f0f9ff;
                        border-radius: 4px;
                        margin-bottom: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    ">
                        <div>
                            <div style="font-size: 11px; color: #075985; text-transform: uppercase; margin-bottom: 4px;">Payment Method</div>
                            <div style="color: #0369a1; font-size: 13px; font-weight: 500; text-transform: capitalize;">
                                ${this.getPaymentMethodDisplay(order.payment_method)}
                            </div>
                        </div>
                        <div style="color: #0369a1; font-size: 18px;">
                            <i class="fas ${this.getPaymentMethodIcon(order.payment_method)}"></i>
                        </div>
                    </div>
                    
                    ${order.notes ? `
                        <div style="
                            padding: 12px;
                            background: #fffbeb;
                            border-radius: 4px;
                            margin-bottom: 16px;
                        ">
                            <div style="font-size: 11px; color: #92400e; text-transform: uppercase; margin-bottom: 4px;">Notes</div>
                            <div style="color: #92400e; font-size: 13px; line-height: 1.4;">${order.notes}</div>
                        </div>
                    ` : ''}
                    
                    <!-- Action Buttons -->
                    <div style="
                        display: flex;
                        gap: 8px;
                    ">
                        <button onclick="deliveryApp.editOrder(${order.id});" style="
                            flex: 1;
                            background: #2563eb;
                            color: white;
                            border: none;
                            padding: 10px 12px;
                            border-radius: 4px;
                            font-weight: 500;
                            cursor: pointer;
                            font-size: 12px;
                            transition: all 0.15s ease;
                        " onmouseover="this.style.background='#1d4ed8'"
                           onmouseout="this.style.background='#2563eb'">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        

                    </div>
                </div>
            </div>
        `;

        // Add to DOM
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        console.log('Minimal order details modal created');

        // Bind close events
        this.bindModalEvents(modal);
    }

    getShopName(order) {
        // Helper function to get shop name from order
        let shopName = 'Unknown Shop';
        
        if (order.shop_name) {
            // Direct shop name from order
            shopName = order.shop_name;
        } else if (order.shop_id) {
            // Try to find shop by ID with multiple comparison methods
            const shop = this.shops.find(s => {
                const orderId = parseInt(order.shop_id) || order.shop_id;
                const shopId = parseInt(s.id) || s.id;
                return shopId === orderId || s.id.toString() === order.shop_id.toString();
            });
            
            if (shop && shop.name) {
                shopName = shop.name;
            } else {
                shopName = `Shop #${order.shop_id}`;
            }
        }
        
        return shopName;
    }

    getPaymentMethodDisplay(paymentMethod) {
        // Normalize payment method and provide proper display text
        if (!paymentMethod) return 'Cash';
        
        const method = paymentMethod.toString().toLowerCase().trim();
        
        console.log('Payment method for display:', method);
        
        switch (method) {
            case 'paid':
            case 'card':
            case 'credit':
            case 'online':
                return 'Paid';
            case 'cash':
            case 'cod':
            default:
                return 'Cash';
        }
    }

    getPaymentMethodIcon(paymentMethod) {
        // Normalize payment method and provide proper icon
        if (!paymentMethod) return 'fa-money-bill-wave';
        
        const method = paymentMethod.toString().toLowerCase().trim();
        
        console.log('Payment method for icon:', method);
        
        switch (method) {
            case 'paid':
            case 'card':
            case 'credit':
            case 'online':
                return 'fa-credit-card';
            case 'cash':
            case 'cod':
            default:
                return 'fa-money-bill-wave';
        }
    }

    async renderSettingsPage() {
        const settingsPage = document.getElementById('settings-page');
        if (!settingsPage) return;
        
        // Check browser notification permission status
        const notificationPermission = 'Notification' in window ? Notification.permission : 'denied';
        
        try {
            // Get user notification settings from database
            let userSettings = await this.getUserSettings();
            
            const notificationSettings = userSettings?.notification_settings || userSettings?.notificationSettings || {
                soundEnabled: this.isAudioEnabled,
                browserEnabled: notificationPermission === 'granted'
            };
            
            const settingsHtml = `
                <div class="settings-container">
                <!-- Notification Settings Section -->
                <div class="notification-settings">
                    <div class="setting-header">
                        <div class="setting-icon">
                            <i class="fas fa-bell"></i>
                        </div>
                        <div class="setting-info">
                            <h3>Notification Settings</h3>
                            <p>Configure how you receive notifications from shops</p>
                        </div>
                    </div>
                    <div class="notification-controls">
                        <div class="notification-control">
                            <div class="control-info">
                                <h4>Sound Notifications</h4>
                                <p>Play a sound when receiving new notifications</p>
                            </div>
                            <div class="control-actions">
                                    <button class="sound-toggle-btn ${notificationSettings.soundEnabled ? 'enabled' : 'disabled'}" id="sound-toggle">
                                        <i class="fas ${notificationSettings.soundEnabled ? 'fa-volume-up' : 'fa-volume-mute'}"></i>
                                        ${notificationSettings.soundEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                    <button class="test-sound-btn" id="test-sound-btn">
                                        <i class="fas fa-play"></i>
                                        Test Sound
                                </button>
                            </div>
                        </div>
                        <div class="notification-control">
                            <div class="control-info">
                                <h4>Browser Notifications</h4>
                                <p>Show desktop notifications even when the app is in background</p>
                            </div>
                            <div class="control-actions">
                                ${notificationPermission === 'granted' 
                                    ? '<button class="permission-button granted"><i class="fas fa-check"></i> Enabled</button>'
                                    : notificationPermission === 'denied'
                                        ? '<button class="permission-button" disabled><i class="fas fa-ban"></i> Blocked by Browser</button>'
                                        : '<button class="permission-button" id="enable-notifications-btn"><i class="fas fa-bell"></i> Enable</button>'
                                }
                            </div>
                        </div>
                    </div>
                </div>
                
                    <!-- Keep existing settings sections unchanged -->
                    ${this.renderExistingSettings()}
                </div>
            `;
            
            settingsPage.innerHTML = settingsHtml;
            
            // Setup notification settings listeners
            this.setupNotificationSettingsListeners();
            
            // Setup shop menu listeners
            this.setupShopMenuListeners();
            
            // Setup shop search functionality
            const searchInput = document.getElementById('search-shops');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterShops(e.target.value);
                });
                
                // Clear search button
                const clearSearchBtn = document.getElementById('clear-shop-search');
                if (clearSearchBtn) {
                    clearSearchBtn.style.display = 'none'; // Hide initially
                    
                    clearSearchBtn.addEventListener('click', () => {
                        searchInput.value = '';
                        this.filterShops('');
                        clearSearchBtn.style.display = 'none';
                    });
                    
                    // Show/hide clear button based on input
                    searchInput.addEventListener('input', () => {
                        clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none';
                    });
                }
            }
        } catch (error) {
            console.error('Error rendering settings page:', error);
            settingsPage.innerHTML = `
                <div class="settings-container">
                    <div class="error-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>Failed to load settings. Please try again later.</p>
                        <button class="retry-btn" id="retry-settings-btn">Retry</button>
                    </div>
                </div>
            `;
            
            const retryBtn = document.getElementById('retry-settings-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.renderSettingsPage());
            }
        }
    }

    renderExistingSettings() {
        return `
                <!-- Earnings Settings Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <i class="fas fa-coins"></i>
                        <h3>Earnings Settings</h3>
                    </div>
                    <form id="settings-form" class="earnings-form">
                        <div class="form-group">
                            <label for="earnings-per-order">
                                <i class="fas fa-dollar-sign"></i>
                                Default earnings per order
                            </label>
                            <input 
                                type="number" 
                                id="earnings-per-order" 
                                step="0.01" 
                                min="0" 
                                value="${this.settings?.earningsPerOrder || 1.50}"
                                placeholder="Enter default earnings amount"
                            >
                            <small style="color: var(--text-secondary); font-size: 12px;">
                                This will be pre-filled when adding new orders
                            </small>
                        </div>
                        <button type="submit" class="save-btn">
                            <i class="fas fa-save"></i>
                            Save Settings
                        </button>
                    </form>
                </div>
                
                <!-- Shops Management Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <i class="fas fa-store"></i>
                        <h3>Partner Shops</h3>
                    </div>
                    <div class="shops-management">
                        <div class="shops-header">
                            <div class="shops-info">
                                <h4 style="margin: 0; color: var(--text-primary);">Your Shops</h4>
                                <span class="shops-count">${this.shops.length}</span>
                            </div>
                            <div class="shops-controls">
                            <div class="search-container">
                                <input 
                                    type="text" 
                                    id="search-shops" 
                                    class="search-shops" 
                                    placeholder="🔍 Search shops..."
                                >
                                <button id="clear-shop-search" class="clear-search">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                                <button class="add-shop-btn" onclick="deliveryApp.openShopModal()">
                                    <i class="fas fa-plus"></i>
                                    Add Shop
                                </button>
                            </div>
                        </div>
                        <div id="shops-display-container">
                            ${this.renderShopsGrid()}
                    </div>
                </div>
            </div>
        `;
    }

    async setupNotificationSettingsListeners() {
        // Sound toggle button
        const soundToggle = document.getElementById('sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('click', async () => {
                try {
                    // Update UI immediately for better user experience
                    const isCurrentlyEnabled = soundToggle.classList.contains('enabled');
                    const willBeEnabled = !isCurrentlyEnabled;
                    
                    // Update button appearance for immediate visual feedback
                    if (willBeEnabled) {
                        soundToggle.classList.remove('disabled');
                        soundToggle.classList.add('enabled');
                        soundToggle.innerHTML = '<i class="fas fa-volume-up"></i> Enabled';
                    } else {
                        soundToggle.classList.remove('enabled');
                        soundToggle.classList.add('disabled');
                        soundToggle.innerHTML = '<i class="fas fa-volume-mute"></i> Disabled';
                    }
                    
                    // Update local state
                    this.isAudioEnabled = willBeEnabled;
                    localStorage.setItem('notificationSound', willBeEnabled.toString());
                    
                    // Play test sound if enabling
                    if (willBeEnabled) {
                        await this.playNotificationSound();
                    }
                    
                    // Update user settings in the background
                    this.updateUserSettings({
                        notificationSettings: {
                            soundEnabled: willBeEnabled,
                            browserEnabled: 'Notification' in window ? Notification.permission === 'granted' : false
                        }
                    }).then(() => {
                        this.showToast(
                            willBeEnabled ? 'Sound notifications enabled' : 'Sound notifications disabled',
                            willBeEnabled ? 'success' : 'info'
                        );
                    }).catch(error => {
                        console.error('Error updating sound settings:', error);
                        // Revert UI if update fails
                        if (willBeEnabled) {
                            soundToggle.classList.remove('enabled');
                            soundToggle.classList.add('disabled');
                            soundToggle.innerHTML = '<i class="fas fa-volume-mute"></i> Disabled';
                        } else {
                            soundToggle.classList.remove('disabled');
                            soundToggle.classList.add('enabled');
                            soundToggle.innerHTML = '<i class="fas fa-volume-up"></i> Enabled';
                        }
                        this.isAudioEnabled = isCurrentlyEnabled;
                        localStorage.setItem('notificationSound', isCurrentlyEnabled.toString());
                        this.showToast('Failed to update sound settings', 'error');
                    });
                } catch (error) {
                    console.error('Error toggling sound:', error);
                    this.showToast('Failed to update sound settings', 'error');
                }
            });
        }
        
        // Test sound button
        const testSoundBtn = document.getElementById('test-sound-btn');
        if (testSoundBtn) {
            testSoundBtn.addEventListener('click', async () => {
                try {
                    // Always try to play the sound, regardless of settings
                    console.log('🎵 Testing notification sound...');
                    
                    // Show immediate feedback
                    const originalText = testSoundBtn.innerHTML;
                    testSoundBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Playing...';
                    testSoundBtn.disabled = true;
                    
                    // Play all test sounds in sequence for better testing
                    await this.playNotificationSound(false);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await this.playConfirmationSound();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await this.playWarningSound();
                    
                    // Restore button
                    testSoundBtn.innerHTML = originalText;
                    testSoundBtn.disabled = false;
                    
                    this.showToast('🎵 Sound test completed!', 'success');
                } catch (error) {
                    console.error('Error playing test sound:', error);
                    testSoundBtn.innerHTML = '<i class="fas fa-play"></i> Test Sound';
                    testSoundBtn.disabled = false;
                    this.showToast('Sound test failed. Check your audio settings.', 'error');
                }
            });
        }
        
        // Enable notifications button
        const enableNotificationsBtn = document.getElementById('enable-notifications-btn');
        if (enableNotificationsBtn) {
            enableNotificationsBtn.addEventListener('click', async () => {
                try {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        // Update button state
                        const buttonHtml = '<button class="permission-button granted"><i class="fas fa-check"></i> Enabled</button>';
                        enableNotificationsBtn.parentNode.innerHTML = buttonHtml;
                        
                        // Update user settings
                        await this.updateUserSettings({
                            notificationSettings: {
                                soundEnabled: this.isAudioEnabled,
                                browserEnabled: true
                            }
                        });
                        
                        this.showToast('Browser notifications enabled', 'success');
                    } else if (permission === 'denied') {
                        // Update button state to show blocked
                        const buttonHtml = '<button class="permission-button" disabled><i class="fas fa-ban"></i> Blocked by Browser</button>';
                        enableNotificationsBtn.parentNode.innerHTML = buttonHtml;
                        
                        this.showToast('Notification permission denied by browser', 'warning');
                    }
                } catch (error) {
                    console.error('Error requesting notification permission:', error);
                    this.showToast('Failed to enable browser notifications', 'error');
                }
            });
        }
        
        // Bind form submission
        const settingsForm = document.getElementById('settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveSettings();
            });
        }
        
        // Bind search functionality
        const searchInput = document.getElementById('search-shops');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterShops(e.target.value);
            });
        }
    }

    async getUserSettings() {
        try {
            // Check if we have a valid session token
            if (!this.sessionToken) {
                console.warn('No session token available');
                return this.getDefaultSettings();
            }

            const response = await fetch('/api/user/settings', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch user settings');
            }
            
            const settings = await response.json();
            
            // Handle both notificationSettings and notification_settings for backward compatibility
            if (settings.notification_settings && !settings.notificationSettings) {
                settings.notificationSettings = settings.notification_settings;
            }
            
            // Update local settings state for earnings
            if (settings.earnings_per_order !== undefined) {
                this.settings = this.settings || {};
                this.settings.earningsPerOrder = parseFloat(settings.earnings_per_order);
            }
            
            return settings;
        } catch (error) {
            console.error('Error fetching user settings:', error);
            return this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            earnings_per_order: 1.50,
            notificationSettings: {
                soundEnabled: this.isAudioEnabled,
                browserEnabled: 'Notification' in window ? Notification.permission === 'granted' : false
            }
        };
    }

    async updateUserSettings(updates) {
        try {
            // Check if we have a valid session token
            if (!this.sessionToken) {
                console.warn('No session token available');
                throw new Error('Not authenticated');
            }
            
            // Don't convert notificationSettings - keep it as camelCase to match database schema
            const apiUpdates = { ...updates };

            const response = await fetch('/api/user/settings', {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${this.sessionToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(apiUpdates)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to update user settings');
            }
            
            const settings = await response.json();
            
            // Update local state for notification settings
            if (updates.notificationSettings) {
                this.isAudioEnabled = updates.notificationSettings.soundEnabled;
                localStorage.setItem('notificationSound', updates.notificationSettings.soundEnabled.toString());
            }
            
            // Update local earnings setting if provided
            if (updates.earnings_per_order !== undefined) {
                this.settings = this.settings || {};
                this.settings.earningsPerOrder = parseFloat(updates.earnings_per_order);
            }
            
            return settings;
        } catch (error) {
            console.error('Error updating user settings:', error);
            throw error;
        }
    }

    renderShopsGrid(filteredShops = null) {
        const shopsToRender = filteredShops || this.shops;
        
        if (shopsToRender.length === 0) {
            if (filteredShops && this.shops.length > 0) {
                // No search results
                return `
                    <div class="no-results">
                        <div class="no-results-icon">
                            <i class="fas fa-search"></i>
                        </div>
                        <h4>No shops found</h4>
                        <p>Try adjusting your search terms</p>
                    </div>
                `;
            } else {
                // No shops at all
                return `
                    <div class="empty-shops">
                        <div class="empty-icon">
                            <i class="fas fa-store-slash"></i>
                        </div>
                        <h4>No partner shops yet</h4>
                        <p>Add your first partner shop to start tracking orders and earnings</p>
                        <button class="empty-action" onclick="deliveryApp.openShopModal()">
                            <i class="fas fa-plus"></i>
                            Add Your First Shop
                        </button>
                    </div>
                `;
            }
        }
        
        const shopsHTML = shopsToRender.map((shop, index) => `
            <div class="shop-card" data-shop-id="${shop.id}" onclick="deliveryApp.showShopOptions(${shop.id}, event)">
                <div class="shop-card-header">
                    <div class="shop-info">
                        <h4 class="shop-name">${shop.name}</h4>
                        <div class="shop-meta">
                            <i class="fas fa-calendar-plus"></i>
                            Added ${shop.created_at ? this.formatTimeAgo(shop.created_at) : 'recently'}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        return `
            <div class="shops-container">
                <div class="shops-grid">
                    ${shopsHTML}
                </div>
            </div>
        `;
    }
    
    // Show shop options in a popup menu
    showShopOptions(shopId, event) {
        console.log('Showing options for shop ID:', shopId);
        event.preventDefault();
        event.stopPropagation();
        
        // Close any existing modals
        this.closeModal();
        
        // Find shop data
        const shop = this.shops.find(s => s.id === shopId || s.id.toString() === shopId.toString());
        if (!shop) {
            console.error('Shop not found with ID:', shopId);
            return;
        }
        
        // Create the options modal
        const modal = document.createElement('div');
        modal.id = 'shop-options-modal';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.right = '0';
        modal.style.bottom = '0';
        modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; width: 90%; max-width: 320px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                <div style="padding: 16px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                    <h3 style="margin: 0; font-size: 18px; color: #334155;">${this.escapeHTML(shop.name)}</h3>
                </div>
                <div style="padding: 8px;">
                    <button class="option-btn edit-shop-btn" style="display: block; width: 100%; padding: 12px 16px; text-align: left; background: none; border: none; cursor: pointer; font-size: 16px; color: #334155; border-radius: 4px;">
                        <i class="fas fa-edit" style="margin-right: 12px; color: #3b82f6;"></i> Edit Shop
                    </button>
                    <button class="option-btn delete-shop-btn" style="display: block; width: 100%; padding: 12px 16px; text-align: left; background: none; border: none; cursor: pointer; font-size: 16px; color: #ef4444; border-radius: 4px;">
                        <i class="fas fa-trash-alt" style="margin-right: 12px;"></i> Delete Shop
                    </button>
                </div>
                <div style="padding: 12px; border-top: 1px solid #e2e8f0; text-align: center;">
                    <button class="cancel-btn" style="width: 100%; padding: 12px; background: #f1f5f9; border: none; border-radius: 6px; font-weight: 500; color: #64748b; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        // Add event listeners
        const editBtn = modal.querySelector('.edit-shop-btn');
        const deleteBtn = modal.querySelector('.delete-shop-btn');
        const cancelBtn = modal.querySelector('.cancel-btn');
        
        editBtn.addEventListener('click', async () => {
            this.closeModal();
            await this.editShop(shopId);
        });
        
        deleteBtn.addEventListener('click', () => {
            this.closeModal();
            this.deleteShop(shopId);
        });
        
        cancelBtn.addEventListener('click', () => {
            this.closeModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }
    
    // Handle shop menu toggle and actions
    setupShopMenuListeners() {
        console.log('Setting up shop menu listeners');
        
        // First remove any existing event listeners by cloning and replacing elements
        document.querySelectorAll('.shop-menu-toggle').forEach(toggle => {
            const newToggle = toggle.cloneNode(true);
            toggle.parentNode.replaceChild(newToggle, toggle);
        });
        
        document.querySelectorAll('.shop-menu-item').forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Close all menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.shop-menu') && !e.target.closest('.shop-menu-toggle')) {
                document.querySelectorAll('.shop-menu.show').forEach(menu => {
                    menu.classList.remove('show');
                });
            }
        });
        
        // Setup toggle buttons
        document.querySelectorAll('.shop-menu-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const shopId = toggle.getAttribute('data-shop-id');
                console.log('Toggle clicked for shop ID:', shopId);
                
                const menu = document.getElementById(`shop-menu-${shopId}`);
                if (!menu) {
                    console.error('Menu not found for shop ID:', shopId);
                    return;
                }
                
                // Close all other menus first
                document.querySelectorAll('.shop-menu.show').forEach(openMenu => {
                    if (openMenu !== menu) {
                        openMenu.classList.remove('show');
                    }
                });
                
                // Toggle this menu
                menu.classList.toggle('show');
                console.log('Menu visibility toggled:', menu.classList.contains('show'));
            });
        });
        
        // Setup menu item actions
        document.querySelectorAll('.shop-menu-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const action = item.getAttribute('data-action');
                const shopId = item.getAttribute('data-shop-id');
                console.log('Menu item clicked:', action, 'for shop ID:', shopId);
                
                if (action === 'edit') {
                    await this.editShop(shopId);
                } else if (action === 'delete') {
                    this.deleteShop(shopId);
                }
                
                // Close the menu
                const menu = document.getElementById(`shop-menu-${shopId}`);
                if (menu) {
                    menu.classList.remove('show');
                }
            });
        });
        
        console.log('Shop menu listeners setup complete');
    }

    filterShops(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (!term) {
            // Show all shops
            document.getElementById('shops-display-container').innerHTML = this.renderShopsGrid();
            return;
        }
        
        const filteredShops = this.shops.filter(shop => 
            shop.name.toLowerCase().includes(term)
        );
        
        document.getElementById('shops-display-container').innerHTML = this.renderShopsGrid(filteredShops);
    }

    // Replace createFloatingButton with this more robust version
    ensureFloatingButton() {
        console.log('Ensuring floating button exists...');
        
        // Remove existing button if any
        const existingBtn = document.getElementById('add-order-btn');
        if (existingBtn) {
            existingBtn.remove();
            console.log('Removed existing floating button');
        }
        
        // Create new button
        const floatingBtn = document.createElement('button');
        floatingBtn.id = 'add-order-btn';
        floatingBtn.innerHTML = '<i class="fas fa-plus"></i>';
        floatingBtn.setAttribute('type', 'button');
        
        // Set comprehensive styles
        const styles = {
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            backgroundColor: '#ff6b35',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            boxShadow: '0 4px 16px rgba(255, 107, 53, 0.3)',
            transition: 'all 0.3s ease',
            zIndex: '9999',
            fontFamily: 'Font Awesome 5 Free',
            fontWeight: '900',
            outline: 'none',
            visibility: 'visible',
            opacity: '1'
        };
        
        // Apply all styles
        Object.assign(floatingBtn.style, styles);
        
        // Add click event
        floatingBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Floating button clicked!');
            this.openOrderModal();
        });
        
        // Add hover effects
        floatingBtn.addEventListener('mouseenter', () => {
            floatingBtn.style.backgroundColor = '#e55a2b';
            floatingBtn.style.transform = 'scale(1.1)';
        });
        
        floatingBtn.addEventListener('mouseleave', () => {
            floatingBtn.style.backgroundColor = '#ff6b35';
            floatingBtn.style.transform = 'scale(1)';
        });
        
        // Append to body
        document.body.appendChild(floatingBtn);
        console.log('Floating button created and added to DOM');
        
        return floatingBtn;
    }

    // Simplified show method
    showFloatingButton() {
        console.log('Showing floating button...');
        const floatingBtn = document.getElementById('add-order-btn');
        if (floatingBtn) {
            floatingBtn.style.display = 'flex';
            floatingBtn.style.visibility = 'visible';
            floatingBtn.style.opacity = '1';
            floatingBtn.style.transform = 'scale(1)';
            console.log('✅ Floating button is now visible');
        } else {
            console.warn('❌ Floating button not found');
            // Create it if missing
            this.ensureFloatingButton();
        }
    }

    // Simplified hide method
    hideFloatingButton() {
        const floatingBtn = document.getElementById('add-order-btn');
        if (floatingBtn) {
            floatingBtn.style.display = 'none';
            floatingBtn.style.visibility = 'hidden';
            floatingBtn.style.opacity = '0';
            console.log('Floating button hidden');
        }
    }

    async loadNotifications() {
        try {
            console.log('=== LOAD NOTIFICATIONS START ===');
            console.log('Loading notifications...');
            console.log('Current User:', this.currentUser);
            console.log('User ID:', this.currentUser?.id);
            
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No user ID available to load notifications');
                return;
            }
            
            const apiUrl = `/api/driver/${this.currentUser.id}/notifications`;
            console.log('Loading notifications from:', apiUrl);
            
            const response = await fetch(apiUrl);
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            if (!response.ok) {
                throw new Error('Failed to load notifications');
            }
            
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                // Store notifications in the class instance
                this.notifications = data.notifications || [];
                console.log('Loaded notifications count:', this.notifications.length);
                console.log('Sample notification:', this.notifications[0]);
                
                this.renderNotifications(this.notifications);
                this.updateNotificationBadge(data.unread_count || 0);
                console.log(`Successfully loaded ${this.notifications.length} notifications`);
                
                // Start real-time updates for notification times
                this.startNotificationTimeUpdates();
                
                // Update the menu with correct counts after loading notifications
                if (document.getElementById('notifications-page')) {
                    console.log('🔄 Refreshing menu after loading notifications...');
                    this.updateNotificationsMenuCounts();
                }
            } else {
                throw new Error(data.message || 'Failed to load notifications');
            }
            
            console.log('=== LOAD NOTIFICATIONS END ===');
        } catch (error) {
            console.error('=== LOAD NOTIFICATIONS ERROR ===');
            console.error('Error loading notifications:', error);
            console.error('Error stack:', error.stack);
            this.notifications = []; // Initialize as empty array on error
            this.showToast('Failed to load notifications: ' + error.message, 'error');
            
            // Show error state
            const container = document.getElementById('notifications-list');
            if (container) {
                container.innerHTML = `
                    <div class="notifications-error">
                        <div class="error-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h4>Failed to Load Notifications</h4>
                        <p>Unable to connect to the server. Please check your connection and try again.</p>
                        <button class="retry-btn" onclick="deliveryApp.loadNotifications()">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </div>
                `;
            }
        }
    }

    startNotificationTimeUpdates() {
        // Clear any existing interval
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        
        // Update notification times every minute
        this.timeUpdateInterval = setInterval(() => {
            if (this.currentPage === 'notifications' && this.notifications && this.notifications.length > 0) {
                console.log('Updating notification times...');
                this.updateNotificationTimes();
            }
        }, 60000); // Update every minute
        
        console.log('Started real-time notification time updates');
    }

    updateNotificationTimes() {
        // Update time displays for visible notifications
        const timeElements = document.querySelectorAll('.notification-time-text');
        timeElements.forEach(element => {
            const notificationId = element.getAttribute('data-notification-id');
            const notification = this.notifications.find(n => n.id === notificationId);
            if (notification) {
                element.textContent = this.formatNotificationTime(notification.created_at);
            }
        });
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notifications-list');
        if (!container) return;
        
        const sortedNotifications = [...notifications].sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
        
        const pendingCount = notifications.filter(n => n.status === 'pending').length;
        
        // PRESERVE the existing Quick Actions button before re-rendering
        const existingMenuContainer = document.getElementById('notifications-menu-container');
        let preservedMenuHTML = '';
        if (existingMenuContainer) {
            preservedMenuHTML = existingMenuContainer.outerHTML;
            console.log('🔧 Preserving Quick Actions button before re-render');
        }
        
        // Create header with stats
        const headerHTML = `
            <div class="notifications-dashboard">
                <div class="dashboard-header" style="position: relative;">
                    <div class="header-left">
                        <h2 class="notifications-title">
                            <i class="fas fa-bell"></i>
                            Notifications
                        </h2>
                        <div class="notifications-stats">
                            <span class="stat-item">
                                <span class="stat-number">${sortedNotifications.length}</span>
                                <span class="stat-label">Total</span>
                            </span>
                            <span class="stat-divider">•</span>
                            <span class="stat-item pending">
                                <span class="stat-number">${pendingCount}</span>
                                <span class="stat-label">Pending</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Create notifications timeline
        const timelineHTML = Object.entries(this.groupNotificationsByDate(sortedNotifications)).map(([date, dayNotifications]) => `
            <div class="notifications-group">
                <div class="group-header">
                    <span class="group-date">${date}</span>
                    <div class="group-line"></div>
                </div>
                <div class="group-notifications">
                    ${dayNotifications.map(notification => this.createNotificationCard(notification)).join('')}
                </div>
            </div>
        `).join('');
        
        container.innerHTML = headerHTML + `
            <div class="notifications-timeline">
                ${timelineHTML}
            </div>
        `;
        
        // RESTORE the Quick Actions button after re-rendering
        if (preservedMenuHTML) {
            const newHeader = document.querySelector('.notifications-dashboard .dashboard-header .header-left');
            if (newHeader) {
                newHeader.insertAdjacentHTML('beforeend', preservedMenuHTML);
                console.log('🔧 Restored Quick Actions button after re-render');
                
                // Re-store the reference to the menu container
                this.currentMenuContainer = document.getElementById('notifications-menu-container');
                
                // Re-bind events to the restored button
                this.bindMenuEvents();
            }
        } else {
            // If no existing menu, create it fresh
            setTimeout(() => {
                this.setupNotificationsMenu();
            }, 100);
        }
    }

    groupNotificationsByDate(notifications) {
        const groups = {};
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        notifications.forEach(notification => {
            const notificationDate = new Date(notification.created_at);
            let dateKey;
            
            if (notificationDate.toDateString() === today.toDateString()) {
                dateKey = 'Σήμερα';
            } else if (notificationDate.toDateString() === yesterday.toDateString()) {
                dateKey = 'Χθες';
            } else {
                dateKey = notificationDate.toLocaleDateString('el-GR', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric',
                    timeZone: 'Europe/Athens'
                });
            }
            
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(notification);
        });
        
        return groups;
    }

    createNotificationCard(notification) {
        const isUnread = !notification.is_read;
        const isPending = notification.status === 'pending';
        const isConfirmed = notification.status === 'confirmed';
        // Check if this is a very recent notification (less than 2 minutes old)
        const notificationTime = new Date(notification.created_at);
        const now = new Date();
        const diffInSeconds = Math.floor((now - notificationTime) / 1000);
        
        // If notification is very recent (likely just received), use current timestamp for display
        const timestamp = diffInSeconds < 120 ? new Date().toISOString() : notification.created_at;
        const formattedTime = this.formatNotificationTime(timestamp);
        
        console.log('Creating notification card for:', notification.id, 'Status:', notification.status);
        
        return `
            <div class="notification-card compact ${isPending ? 'pending' : 'confirmed'} ${isUnread ? 'unread' : ''}" 
                 data-id="${notification.id}" data-notification-id="${notification.id}">
                <div class="card-accent"></div>
                
                <div class="notification-row">
                    <div class="shop-section">
                        <div class="shop-avatar-mini">
                            <i class="fas fa-store"></i>
                            <div class="status-dot ${notification.status}"></div>
                        </div>
                        <div class="shop-info-mini">
                            <h4 class="shop-name-mini">${this.escapeHTML(notification.shop.name)}</h4>
                            <span class="time-mini">
                                <i class="fas fa-clock"></i> 
                                <span class="notification-time-text" data-notification-id="${notification.id}">${formattedTime}</span>
                            </span>
                        </div>
                    </div>
                    
                    <div class="status-section">
                        <span class="status-badge-mini ${notification.status}">
                            <i class="fas ${isPending ? 'fa-hourglass-half' : 'fa-check-circle'}"></i>
                            ${isPending ? 'Pending' : 'Confirmed'}
                        </span>
                    </div>
                    
                    <div class="actions-section">
                        ${isPending ? `
                            <button class="action-btn-mini confirm" 
                                    data-notification-id="${notification.id}"
                                    data-action="confirm"
                                    title="Confirm notification">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : `
                            <button class="action-btn-mini delete" 
                                    data-notification-id="${notification.id}"
                                    data-action="delete"
                                    title="Delete notification">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        `}
                    </div>
                </div>
                
                <div class="message-section">
                    <div class="message-content-mini">
                        <i class="fas fa-quote-left message-quote"></i>
                        <p class="notification-message-mini">${this.escapeHTML(notification.message)}</p>
                        ${isUnread ? '<span class="new-indicator">NEW</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }

    formatNotificationTime(dateString) {
        // Simple, reliable Greek time display
        const notificationDate = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - notificationDate) / 1000);
        
        // For very recent notifications (less than 30 seconds), show "Τώρα"
        if (diffInSeconds < 30) {
            return 'Τώρα';
        }
        
        // Always show Greek time
        return new Intl.DateTimeFormat('el-GR', {
                hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Athens'
        }).format(notificationDate);
    }

    escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    unescapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    }

    updateNotificationBadge(count) {
        const badge = document.querySelector('.nav-item[data-page="notifications"] .badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    async fetchInitialNotifications() {
        try {
            const count = await this.fetchNotificationCount();
            this.updateNotificationBadge(count);
        } catch (error) {
            console.error('Error fetching initial notifications:', error);
        }
    }

    showConfirmationModal(notificationId, message, shopName) {
        console.log('=== SHOW CONFIRMATION MODAL START ===');
        console.log('Notification ID:', notificationId);
        console.log('Message:', message);
        console.log('Shop Name:', shopName);
        
        const modal = document.createElement('div');
        modal.className = 'confirmation-modal active';
        modal.id = 'confirm-notification-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            padding: 20px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        modal.innerHTML = `
            <div class="confirmation-modal-content" style="
                background: white;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
                width: 100%;
                max-width: 380px;
                position: relative;
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    padding: 24px;
                    text-align: center;
                    color: white;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 12px auto;
                        backdrop-filter: blur(10px);
                    ">
                        <i class="fas fa-check" style="font-size: 20px;"></i>
                    </div>
                    <h3 style="
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                    ">Confirm Notification</h3>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px; text-align: center;">
                    <div style="
                        background: #f8fafc;
                        padding: 16px;
                        border-radius: 12px;
                        margin-bottom: 24px;
                        border: 1px solid #e2e8f0;
                    ">
                        <div style="
                            font-size: 14px;
                            color: #64748b;
                            margin-bottom: 8px;
                            font-weight: 500;
                        ">
                            <i class="fas fa-store" style="margin-right: 8px; color: #059669;"></i>
                            ${this.escapeHTML(shopName)}
                        </div>
                        <div style="
                            color: #1e293b;
                            font-size: 15px;
                            line-height: 1.5;
                            font-style: italic;
                        ">
                            "${this.unescapeHTML(message)}"
                        </div>
                    </div>
                    
                    <p style="
                        color: #64748b;
                        font-size: 14px;
                        margin: 0 0 24px 0;
                        line-height: 1.4;
                    ">
                        Confirm that you've received and read this message.
                    </p>
                </div>
                
                <!-- Actions -->
                <div style="
                    display: flex;
                    gap: 12px;
                    padding: 0 24px 24px;
                ">
                    <button class="cancel-btn" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #64748b;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        Cancel
                    </button>
                    <button class="confirm-btn" style="
                        flex: 2;
                        padding: 12px 16px;
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                    ">
                        <i class="fas fa-check"></i> Confirm
                    </button>
                </div>
            </div>
        `;
        
        // Remove any existing modal
        const existingModal = document.getElementById('confirm-notification-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add new modal
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        // Bind events to the modal buttons
        const cancelBtn = modal.querySelector('.cancel-btn');
        const confirmBtn = modal.querySelector('.confirm-btn');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Cancel button clicked');
                this.closeConfirmationModal();
            });
            
            // Hover effect
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#f8fafc';
                cancelBtn.style.borderColor = '#cbd5e1';
                cancelBtn.style.color = '#475569';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'white';
                cancelBtn.style.borderColor = '#e2e8f0';
                cancelBtn.style.color = '#64748b';
            });
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Confirm button clicked for notification:', notificationId);
                
                // Disable button immediately to prevent multiple clicks
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
                
                this.confirmNotification(notificationId);
            });
            
            // Hover effect
            confirmBtn.addEventListener('mouseenter', () => {
                if (!confirmBtn.disabled) {
                    confirmBtn.style.transform = 'translateY(-1px)';
                    confirmBtn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                }
            });
            confirmBtn.addEventListener('mouseleave', () => {
                if (!confirmBtn.disabled) {
                    confirmBtn.style.transform = 'translateY(0)';
                    confirmBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeConfirmationModal();
            }
        });
        
        console.log('Confirmation modal created and shown with clean design');
    }

    closeConfirmationModal() {
        console.log('=== CLOSE CONFIRMATION MODAL START ===');
        
        try {
            // Remove all confirmation modals with various selectors
            const modals = document.querySelectorAll('.confirmation-modal, #delete-notification-modal, #confirm-notification-modal, #edit-notification-modal');
            console.log('Found modals to close:', modals.length);
            
            // Log details about each modal
            modals.forEach((modal, index) => {
                console.log(`Modal ${index + 1}:`, {
                    id: modal.id,
                    className: modal.className,
                    isVisible: modal.style.display !== 'none',
                    parent: modal.parentNode?.tagName || 'No parent'
                });
            });
            
            // Remove modals immediately instead of using setTimeout
            modals.forEach(modal => {
                console.log(`Removing modal:`, modal.id || 'unnamed modal');
                try {
                    if (modal && modal.parentNode) {
                        modal.parentNode.removeChild(modal);
                        console.log(`Modal ${modal.id || 'unnamed'} removed from DOM`);
                    } else {
                        console.log(`Modal ${modal.id || 'unnamed'} has no parent, cannot remove`);
                    }
                } catch (err) {
                    console.error(`Error removing modal ${modal.id}:`, err);
                }
            });
            
            // Also try direct removal by ID as a fallback
            ['edit-notification-modal', 'delete-notification-modal', 'confirm-notification-modal'].forEach(id => {
                const modal = document.getElementById(id);
                if (modal) {
                    try {
                        modal.remove();
                        console.log(`Directly removed modal with ID: ${id}`);
                    } catch (err) {
                        console.error(`Error directly removing modal ${id}:`, err);
                    }
                }
            });
            
            // Restore body scroll
            document.body.style.overflow = 'auto';
        } catch (err) {
            console.error('Error in closeConfirmationModal:', err);
        }
        
        console.log('=== CLOSE CONFIRMATION MODAL END ===');
    }

    async confirmNotification(notificationId) {
        // Find and disable the confirm button immediately
        const confirmBtn = document.querySelector(`button[onclick*="${notificationId}"]`);
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirming...';
        }

        try {
            console.log('Confirming notification:', notificationId);
            
            const response = await fetch(`/api/driver/${this.userId}/notifications/${notificationId}/confirm`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Notification confirmed successfully');
                
                // Play confirmation sound for the driver
                this.playConfirmationSound();
                
                // Update the notification in the local array
                const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
                if (notificationIndex !== -1) {
                    this.notifications[notificationIndex].status = 'confirmed';
                    this.notifications[notificationIndex].is_read = true;
                    this.notifications[notificationIndex].confirmed_at = new Date().toISOString();
                }
                
                // Re-render notifications
                if (this.currentPage === 'notifications') {
                    this.renderNotifications(this.notifications);
                }
                
                // Update notification count
                this.fetchNotificationCount();
                
                this.showToast('✅ Notification confirmed successfully', 'success');
                
                // Close any open modals
                this.closeConfirmationModal();
            } else {
                throw new Error(result.message || 'Failed to confirm notification');
            }
        } catch (error) {
            console.error('Error confirming notification:', error);
            this.showToast('❌ Failed to confirm notification', 'error');
            
            // Re-enable button on error
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirm';
            }
        }
    }

    // Helper method to check if a modal is visible and debug it
    debugModalVisibility(modalId) {
        console.log(`Debugging modal visibility for: ${modalId}`);
        const modal = document.getElementById(modalId);
        
        if (!modal) {
            console.error(`Modal with ID ${modalId} not found in DOM!`);
            return false;
        }
        
        const styles = window.getComputedStyle(modal);
        console.log(`Modal ${modalId} visibility check:`, {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            zIndex: styles.zIndex,
            position: styles.position
        });
        
        // Check if modal is visually hidden
        if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
            console.error(`Modal ${modalId} is in DOM but not visible!`);
            return false;
        }
        
        console.log(`Modal ${modalId} appears to be visible`);
        return true;
    }

    async executeDeleteNotification(notificationId) {
        try {
            console.log('=== EXECUTE DELETE NOTIFICATION START ===');
            console.log('Notification ID:', notificationId);
            
            this.closeConfirmationModal();
            
            console.log(`Deleting notification ${notificationId} from database...`);
            
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No user ID available for deletion');
                this.showToast('Error: User information not available', 'error');
                return;
            }
            
            // Show loading state
            this.showToast('Deleting notification...', 'info');
            
            // Call API to delete notification from database
            const response = await fetch(`/api/driver/${this.currentUser.id}/notifications/${notificationId}`, { 
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to delete notification from server');
            }
            
            console.log('Server response:', result);
            console.log('Notifications before deletion:', this.notifications.length);
            
            // Remove from local array and update UI
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            
            console.log('Notifications after deletion:', this.notifications.length);
            
            this.renderNotifications(this.notifications);
            this.updateNotificationBadge(this.notifications.filter(n => !n.is_read).length);
            
            // Send WebSocket message to broadcast the deletion
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'notification_update',
                    action: 'deleted',
                    notificationId: notificationId,
                    data: {
                        deleted: true
                    }
                }));
            }
            
            // Play warning sound for deletion
            this.playWarningSound();
            
            this.showToast('Notification deleted successfully! (Removed from both driver and shop views)', 'success');
            console.log('=== EXECUTE DELETE NOTIFICATION END ===');
            
        } catch (error) {
            console.error('=== EXECUTE DELETE NOTIFICATION ERROR ===');
            console.error('Error deleting notification:', error);
            console.error('Error stack:', error.stack);
            this.showToast('Failed to delete notification: ' + error.message, 'error');
        }
    }

    async fetchNotificationCount() {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                console.log('No current user, skipping notification count fetch');
                return 0;
            }
            
            const response = await fetch(`/api/driver/${this.currentUser.id}/notifications?limit=1`);
            
            if (!response.ok) {
                throw new Error('Failed to load notifications');
            }
            
            const data = await response.json();
            
            if (data.success) {
                return data.unread_count || 0;
            } else {
                throw new Error(data.message || 'Failed to load notification count');
            }
        } catch (error) {
            console.error('Error fetching notification count:', error);
            throw error;
        }
    }

    updateProfileDisplay() {
        if (!this.currentUser) return;
        
        // Update profile name and email with real user data
        const profileNameEl = document.getElementById('profile-name');
        const profileEmailEl = document.getElementById('profile-email');
        
        if (profileNameEl) {
            // Use user's name if available, otherwise use email prefix
            const displayName = this.currentUser.name || 
                               this.currentUser.email?.split('@')[0] || 
                               'Driver';
            profileNameEl.textContent = displayName;
        }
        
        if (profileEmailEl) {
            profileEmailEl.textContent = this.currentUser.email || 'No email available';
        }
        
        // Also update any other profile displays throughout the app
        const profileElements = document.querySelectorAll('.profile-name');
        profileElements.forEach(el => {
            const displayName = this.currentUser.name || 
                               this.currentUser.email?.split('@')[0] || 
                               'Driver';
            el.textContent = displayName;
        });
        
        console.log('Profile updated with real user data:', {
            name: this.currentUser.name,
            email: this.currentUser.email
        });
    }

    // Initialize audio for notifications
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
                
                // First tone
                oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            };
        } catch (error) {
            console.warn('⚠️ Could not create notification sound:', error);
        }
    }
    
    // Enhanced notification sound system
    async playNotificationSound(strong = false) {
            if (!this.isAudioEnabled) return;
        
        try {
            const ctx = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
                const now = ctx.currentTime;
            
            if (strong) {
                // Melodic chime sequence for important notifications (C5, E5, G5)
                const notes = [523.25, 659.25, 783.99];
                notes.forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(freq, now + i * 0.15);
                    gain.gain.setValueAtTime(0.3 * this.soundVolume, now + i * 0.15);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15 + i * 0.15);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(now + i * 0.15);
                    osc.stop(now + 0.15 + i * 0.15);
                });
            } else if (this.notificationAudio) {
                // Regular notification sound
                this.notificationAudio();
            }
            
            console.log(`🔊 Played ${strong ? 'strong' : 'regular'} notification sound`);
            } catch (error) {
            console.warn('⚠️ Could not play notification sound:', error);
        }
    }

    // Play confirmation sound for successful actions
    async playConfirmationSound() {
        if (!this.isAudioEnabled) return;
        
        try {
            const ctx = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            
            // Success chime: C5, G5, C6 (major chord progression)
            const confirmationNotes = [523.25, 783.99, 1046.50];
            confirmationNotes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.1);
                gain.gain.setValueAtTime(0.25 * this.soundVolume, now + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2 + i * 0.1);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.1);
                osc.stop(now + 0.2 + i * 0.1);
            });
            
            console.log('🎵 Played confirmation sound');
        } catch (error) {
            console.warn('⚠️ Could not play confirmation sound:', error);
        }
    }

    // Play delete/warning sound
    async playWarningSound() {
        if (!this.isAudioEnabled) return;
        
        try {
            const ctx = this.audioContext || new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            
            // Warning tone: descending notes (G5, E5, C5)
            const warningNotes = [783.99, 659.25, 523.25];
            warningNotes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, now + i * 0.12);
                gain.gain.setValueAtTime(0.2 * this.soundVolume, now + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15 + i * 0.12);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + i * 0.12);
                osc.stop(now + 0.15 + i * 0.12);
            });
            
            console.log('⚠️ Played warning sound');
        } catch (error) {
            console.warn('⚠️ Could not play warning sound:', error);
        }
    }
    
    // Connect to WebSocket server
    connectWebSocket() {
        if (!this.userId) {
            console.warn('⚠️ No user ID found, cannot connect to WebSocket');
            return;
        }
        
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            console.log('🔌 Connecting to WebSocket:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                
                // Reset reconnection attempts on successful connection
                this.reconnectAttempts = 0;
                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout);
                    this.reconnectTimeout = null;
                }
                
                // Authenticate with server
                this.ws.send(JSON.stringify({
                    type: 'authenticate',
                    userId: this.userId,
                    userType: 'driver'
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
            
            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                
                // Clear heartbeat interval
                if (this.sessionHeartbeatInterval) {
                    clearInterval(this.sessionHeartbeatInterval);
                    this.sessionHeartbeatInterval = null;
                }
                
                // Implement exponential backoff for reconnection
                if (!this.reconnectAttempts) this.reconnectAttempts = 0;
                const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds
                
                console.log(`🔄 Attempting reconnection in ${backoffTime}ms (attempt ${this.reconnectAttempts + 1})`);
                
                this.reconnectTimeout = setTimeout(() => {
                    if (this.userId) {
                        this.reconnectAttempts++;
                        this.connectWebSocket();
                    }
                }, backoffTime);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
            };
            
            // Send session heartbeat every 30 seconds
            this.sessionHeartbeatInterval = setInterval(() => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'session_heartbeat',
                        userId: this.userId
                    }));
                }
            }, 30000);
            
        } catch (error) {
            console.error('❌ Failed to connect to WebSocket:', error);
        }
    }
    
    // Handle WebSocket messages
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
            default:
                console.log('📨 Unknown WebSocket message type:', data.type);
        }
    }
    
    // Handle real-time notification update
    handleNotificationUpdate(data) {
        console.log('🔄 Delivery app received notification update:', data);
        const { action, notificationId, data: updateData } = data;
        
        // Find and update the notification
        const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex !== -1) {
            if (action === 'confirmed') {
                this.notifications[notificationIndex].status = 'confirmed';
                this.notifications[notificationIndex].confirmed_at = updateData?.confirmed_at;
                // Play confirmation sound only - notification popup is handled elsewhere to prevent duplicates
                this.playConfirmationSound();
            } else if (action === 'deleted') {
                // Play warning sound only - notification popup is handled elsewhere to prevent duplicates
                this.playWarningSound();
                this.notifications.splice(notificationIndex, 1);
            } else if (action === 'edited') {
                // Play regular notification sound only - notification popup is handled elsewhere to prevent duplicates
                this.playNotificationSound(false);
                this.notifications[notificationIndex] = {
                    ...this.notifications[notificationIndex],
                    ...updateData
                };
            }

            // Re-render notifications if on notifications page
            if (this.currentPage === 'notifications') {
                this.renderNotifications(this.notifications);
            }

            // Update notification count
            this.updateNotificationBadge(this.notifications.filter(n => !n.is_read).length);
        }

        console.log(`🔄 Notification update processed: ${action} for ID ${notificationId}`);
    }
    
    // Handle notification confirmed
    handleNotificationConfirmed(notificationId, data) {
        const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex !== -1) {
            this.notifications[notificationIndex] = {
                ...this.notifications[notificationIndex],
                status: 'confirmed',
                confirmed_at: data.confirmed_at
            };
            
            if (this.currentPage === 'notifications') {
                this.renderNotifications(this.notifications);
            }
            
            this.showToast('Notification confirmed successfully', 'success');
        }
    }
    
    // Handle notification deleted
    handleNotificationDeleted(notificationId) {
        const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex !== -1) {
            this.notifications.splice(notificationIndex, 1);
            
            if (this.currentPage === 'notifications') {
                this.renderNotifications(this.notifications);
            }
            
            this.showToast('Notification deleted', 'info');
        }
    }
    
    // Handle notification edited
    handleNotificationEdited(notificationId, data) {
        const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex !== -1) {
            this.notifications[notificationIndex] = {
                ...this.notifications[notificationIndex],
                ...data
            };
            
            if (this.currentPage === 'notifications') {
                this.renderNotifications(this.notifications);
            }
            
            this.showToast('Notification updated', 'info');
        }
    }
    
    // Handle real-time notification
    handleRealtimeNotification(notification) {
        console.log('🔔 Delivery app received real-time notification:', notification);
        
        // Check if notification already exists
        const existingIndex = this.notifications.findIndex(n => n.id === notification.id);
        if (existingIndex !== -1) {
            // Update the existing notification in place
            this.notifications[existingIndex] = {
                ...this.notifications[existingIndex],
                ...notification
            };
            console.log('🔄 Updated existing notification');
            
            // Re-render notifications if on notifications page
            if (this.currentPage === 'notifications') {
                this.renderNotifications(this.notifications);
                // Always update menu counts after any notification change
                setTimeout(() => {
                    this.updateNotificationsMenuCounts();
                }, 100);
            }
        } else {
            // Add as new notification (real-time push)
        this.notifications.unshift(notification);
            console.log('➕ Added new notification');
            
        if (this.currentPage === 'notifications') {
            this.renderNotifications(this.notifications);
                // Always update menu counts after any notification change
                setTimeout(() => {
                    this.updateNotificationsMenuCounts();
                }, 100);
        }
            
            this.playNotificationSound(true); // Use strong sound
            this.showBrowserNotification(notification); // Single modern notification popup
        this.fetchNotificationCount();
        }
        
        // Update notification count
        this.updateNotificationBadge(this.notifications.filter(n => !n.is_read).length);
        
        // CRITICAL: Always update menu counts for live updates, even if not on notifications page
        setTimeout(() => {
            this.updateNotificationsMenuCounts();
        }, 150);
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
        localStorage.removeItem('userSession');
        localStorage.removeItem('deliveryAppUser');
        localStorage.removeItem('deliveryAppSession');
        localStorage.removeItem('deliveryAppSettings');
        console.log('🗑️ Session data cleared');
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
                    <button class="btn primary" onclick="window.location.href='/'" style="width: 100%; padding: 12px; font-size: 16px; font-weight: 600;">
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
    
    // Show modern custom notification (replaces browser notifications)
    showBrowserNotification(notification) {
        console.log('🔔 Showing modern custom notification:', notification);
        
        // Always use custom notifications for better control and modern design
        this.showModernNotificationPopup(notification);
    }
    
    // Show ultra-brief modern notification popup
    showModernNotificationPopup(notification) {
        // Prevent duplicate notifications
        const existingNotification = document.querySelector('.modern-notification-popup');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Determine notification details based on action
        const action = notification.action || 'new';
        let accentColor, iconClass, message;
        
        switch (action) {
            case 'confirmed':
                accentColor = '#10b981';
                iconClass = 'fas fa-check-circle';
                message = '✅ Delivery confirmed';
                break;
            case 'deleted':
                accentColor = '#ef4444';
                iconClass = 'fas fa-trash-alt';
                message = '🗑️ Notification deleted';
                break;
            case 'edited':
                accentColor = '#3b82f6';
                iconClass = 'fas fa-edit';
                message = '✏️ Notification updated';
                break;
            default:
                accentColor = '#667eea';
                iconClass = 'fas fa-store';
                message = '🚚 New delivery request';
        }
        
        const toast = document.createElement('div');
        toast.className = 'modern-notification-popup';
        toast.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            left: 16px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.8);
            z-index: 10000;
            max-width: 320px;
            margin: 0 auto;
            transform: translateY(-80px) scale(0.9);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;
        
        toast.innerHTML = `
            <div style="padding: 12px 16px; display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; background: ${accentColor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <i class="${iconClass}" style="font-size: 16px; color: white;"></i>
                </div>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; font-size: 14px; color: #1f2937; line-height: 1.3;">
                        ${message}
                    </div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 1px;">
                        ${notification.shop?.name || 'Shop'}
                    </div>
                    </div>
                <button class="notification-close-btn" style="background: none; border: none; color: #9ca3af; font-size: 16px; cursor: pointer; padding: 4px; border-radius: 4px; transition: color 0.2s;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.style.transform = 'translateY(0) scale(1)';
            toast.style.opacity = '1';
        }, 50);
        
        // Handle close button
        const closeBtn = toast.querySelector('.notification-close-btn');
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.color = '#374151';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.color = '#9ca3af';
        });
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeNotificationPopup(toast);
        });
        
        // Handle click on notification (navigate to notifications)
        toast.addEventListener('click', () => {
                this.navigateToPage('notifications');
            this.closeNotificationPopup(toast);
        });
        
        // Auto remove after 4 seconds (shorter for brief notifications)
                setTimeout(() => {
                    if (toast.parentNode) {
                this.closeNotificationPopup(toast);
            }
        }, 4000);
    }
    
    // Helper function to close notification popup with animation
    closeNotificationPopup(toast) {
        toast.style.transform = 'translateY(-80px) scale(0.9)';
        toast.style.opacity = '0';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
    
    // Keep original function as fallback
    showCustomNotificationToast(notification) {
        // Use the new modern popup instead
        this.showModernNotificationPopup(notification);
    }
    
    // Enhanced back navigation prevention for mobile apps
    preventBackNavigation() {
        // Clear any existing history entries that point to login
        window.history.replaceState(null, null, window.location.href);
        
        // Add multiple entries to prevent back navigation
        for (let i = 0; i < 10; i++) {
            window.history.pushState(null, null, window.location.href);
        }
        
        // Handle popstate events (back button presses)
        window.addEventListener('popstate', (event) => {
            // Prevent navigation and stay on current page
            window.history.pushState(null, null, window.location.href);
            
            // Show warning to user about using logout instead
            this.showToast('Please use the logout button to exit the app', 'warning');
            
            // Vibrate if supported (mobile devices)
            if ('vibrate' in navigator) {
                navigator.vibrate(100);
            }
        });
        
        // Prevent browser back/forward buttons on desktop
        window.addEventListener('beforeunload', (event) => {
            // This will show browser confirmation dialog
            const message = 'Please use the logout button to exit the app safely.';
            event.returnValue = message;
            return message;
        });
        
        // Additional mobile-specific prevention
        if (window.DeviceMotionEvent || window.DeviceOrientationEvent) {
            // Mobile device detected
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    // App became visible again, ensure we're still on the right page
                    window.history.pushState(null, null, window.location.href);
                }
            });
        }
        
        console.log('Enhanced back navigation prevention activated');
    }

    // Setup comprehensive push notification system
    async setupPushNotifications() {
        try {
            // Check if browser supports notifications
            if (!('Notification' in window)) {
                console.warn('This browser does not support notifications');
                return;
            }
            
            // Check if service worker is supported
            if (!('serviceWorker' in navigator)) {
                console.warn('Service workers not supported');
                return;
            }
            
            // Request notification permission
            let permission = Notification.permission;
            
            if (permission === 'default') {
                // Show custom permission modal first
                this.showNotificationPermissionModal();
                return;
            }
            
            if (permission === 'granted') {
                console.log('Notification permission granted');
                this.showToast('📱 Push notifications enabled! You\'ll receive updates even when the app is closed.', 'success');
                
                // Setup push subscription
                await this.setupPushSubscription();
                
            } else if (permission === 'denied') {
                console.warn('Notification permission denied');
                this.showToast('Notifications are blocked. Please enable them in your browser settings to receive updates.', 'warning');
            }
            
            // Listen for messages from service worker
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'notification_clicked') {
                    this.handleNotificationClick(event.data.notificationId);
                }
            });
            
        } catch (error) {
            console.error('Error setting up push notifications:', error);
        }
    }
    
    // Setup push subscription for mobile notifications
    async setupPushSubscription() {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Check if we already have a subscription
            let subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                // Create new subscription
                const applicationServerKey = this.getApplicationServerKey();
                
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(applicationServerKey)
                });
                
                console.log('Created new push subscription');
            } else {
                console.log('Using existing push subscription');
            }
            
            // Send subscription to server
            await this.sendSubscriptionToServer(subscription);
            
        } catch (error) {
            console.error('Error setting up push subscription:', error);
        }
    }
    
    // Send subscription to server
    async sendSubscriptionToServer(subscription) {
        try {
            const response = await fetch('/api/push/subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({
                    subscription: subscription,
                    userId: this.userId,
                    userType: 'driver'
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Push subscription saved to server');
            } else {
                console.error('Failed to save push subscription:', result.message);
            }
            
        } catch (error) {
            console.error('Error sending subscription to server:', error);
        }
    }
    
    // Handle notification click from service worker
    handleNotificationClick(notificationId) {
        if (notificationId) {
            // Navigate to notifications page and highlight the clicked notification
            this.navigateToPage('notifications');
            
            // Mark notification as read
            setTimeout(() => {
                this.confirmNotification(notificationId);
            }, 500);
        }
    }
    
    // Get application server key (VAPID public key)
    getApplicationServerKey() {
        // This should match the key in service worker and server
        return 'BG_qTrWFr2qESzBzbog1Ajx_6r79bf4WheyZD2jgdzz_o68TzMkzR4Fd-WS0Y-G2gJK7xQcD0HvQ259UgQk4kM8';
    }
    
    // Convert VAPID key to Uint8Array
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Request notification permission (enhanced)
    async requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                // Show a custom permission request modal
                this.showNotificationPermissionModal();
            } else if (Notification.permission === 'denied') {
                this.showToast('Notifications are blocked. Please enable them in your browser settings to receive updates.', 'warning');
            } else if (Notification.permission === 'granted') {
                // Setup push subscription if not already done
                await this.setupPushSubscription();
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
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                ">Get instant alerts when new delivery requests arrive, even when the app is in the background.</p>
                
                <div style="
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                ">
                    <button class="permission-btn allow" style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        allowBtn.addEventListener('click', async () => {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    this.showToast('🎉 Push notifications enabled! You\'ll receive real-time delivery updates even when the app is closed.', 'success');
                    
                    // Setup push subscription after permission is granted
                    await this.setupPushSubscription();
                } else {
                    this.showToast('Notifications disabled. You can enable them in your browser settings.', 'warning');
                }
                modal.remove();
            } catch (error) {
                console.error('Error requesting notification permission:', error);
                this.showToast('Error setting up notifications. Please try again.', 'error');
                modal.remove();
            }
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
            allowBtn.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.4)';
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
    
    // Toggle notification sound
    async toggleNotificationSound() {
        this.isAudioEnabled = !this.isAudioEnabled;
        localStorage.setItem('notificationSound', this.isAudioEnabled.toString());
        
        // Save to database
        try {
            await this.updateUserSettings({
                notificationSettings: {
                    soundEnabled: this.isAudioEnabled,
                    browserEnabled: 'Notification' in window ? Notification.permission === 'granted' : false
                }
            });
        
        if (this.isAudioEnabled) {
            this.showToast('Notification sound enabled', 'success');
            this.playNotificationSound(); // Test sound
        } else {
            this.showToast('Notification sound disabled', 'info');
            }
        } catch (error) {
            console.error('Error updating notification settings:', error);
            this.showToast('Sound setting updated locally (database error)', 'warning');
            
            if (this.isAudioEnabled) {
                this.playNotificationSound(); // Test sound
            }
        }
    }

    // Test different sound types for user feedback
    testSounds() {
        if (!this.isAudioEnabled) {
            this.showToast('Enable sounds first to test them', 'warning');
            return;
        }
        
        // Play all sound types in sequence
        setTimeout(() => this.playNotificationSound(false), 0);
        setTimeout(() => this.playConfirmationSound(), 800);
        setTimeout(() => this.playWarningSound(), 1600);
        
        this.showToast('🎵 Playing sound test sequence', 'info');
    }

    // Update sound volume
    updateSoundVolume(volume) {
        this.soundVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        localStorage.setItem('soundVolume', this.soundVolume.toString());
        
        // Test the new volume with a notification sound
        if (this.isAudioEnabled) {
            this.playNotificationSound(false);
        }
    }

    setupNotificationsMenu() {
        // Create the redesigned notifications menu button and dropdown
        console.log('🔧 Setting up notifications menu...');
        console.log('Current page:', this.currentPage);
        console.log('Notifications loaded:', this.notifications ? this.notifications.length : 'none');
        console.log('Is notifications page visible?', document.getElementById('notifications-page')?.style.display !== 'none');
        
        // Always create the menu, even if notifications aren't loaded yet (will show 0 counts)
        this.createNotificationsMenu();
        this.bindMenuEvents();
        
        // If notifications aren't loaded yet, try again after loading
        if (!this.notifications || this.notifications.length === 0) {
            console.log('⏳ Notifications not loaded yet, will refresh menu after loading...');
        }
    }

    updateNotificationsMenuCounts() {
        // Update menu counts without recreating the entire menu (faster and prevents disappearing)
        if (!this.currentMenuContainer) {
            console.log('🔄 No current menu container, creating new menu...');
            this.createNotificationsMenu();
            this.bindMenuEvents();
            return;
        }

        const notifications = this.notifications || [];
        const pendingCount = notifications.filter(n => n && (n.status === 'pending' || !n.status)).length;
        const confirmedCount = notifications.filter(n => n && n.status === 'confirmed').length;
        
        console.log('🔄 Updating menu counts - Pending:', pendingCount, 'Confirmed:', confirmedCount);
        
        // Update the dropdown content with new counts
        const quickActionsText = this.currentMenuContainer.querySelector('p');
        if (quickActionsText) {
            quickActionsText.textContent = `${pendingCount} pending • ${confirmedCount} confirmed`;
        }
        
        // Update confirm button
        const confirmBtn = this.currentMenuContainer.querySelector('#complete-all-notifications');
        if (confirmBtn) {
            const confirmText = confirmBtn.querySelector('div:last-child div:first-child');
            if (confirmText) {
                confirmText.textContent = `Confirm Pending (${pendingCount})`;
            }
            // Update disabled state
            if (pendingCount === 0) {
                confirmBtn.style.opacity = '0.5';
                confirmBtn.style.cursor = 'not-allowed';
            } else {
                confirmBtn.style.opacity = '1';
                confirmBtn.style.cursor = 'pointer';
            }
        }
        
        // Update delete button
        const deleteBtn = this.currentMenuContainer.querySelector('#delete-all-notifications');
        if (deleteBtn) {
            const deleteText = deleteBtn.querySelector('div:last-child div:first-child');
            if (deleteText) {
                deleteText.textContent = `Delete Confirmed (${confirmedCount})`;
            }
            // Update disabled state
            if (confirmedCount === 0) {
                deleteBtn.style.opacity = '0.5';
                deleteBtn.style.cursor = 'not-allowed';
            } else {
                deleteBtn.style.opacity = '1';
                deleteBtn.style.cursor = 'pointer';
            }
        }
    }

    bindMenuEvents() {
        const menuBtn = document.getElementById('notifications-menu-btn');
        const menu = document.getElementById('notifications-menu');
        
        if (!menuBtn || !menu) {
            console.log('❌ Menu elements not found, retrying...');
            return;
        }
        
        // Toggle menu with animation
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('show');
            
            if (isOpen) {
                this.closeNotificationsMenu();
            } else {
                this.openNotificationsMenu();
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
                this.closeNotificationsMenu();
            }
        });
        
        // Refresh notifications
        const refreshBtn = document.getElementById('refresh-notifications');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                refreshBtn.disabled = true;
                
                await this.loadNotifications();
                
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
                refreshBtn.disabled = false;
                this.closeNotificationsMenu();
            });
        }
        
        // Complete all pending notifications
        const completeBtn = document.getElementById('complete-all-notifications');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
            this.confirmAllNotifications();
                this.closeNotificationsMenu();
            });
        }
        
        // Delete all confirmed notifications
        const deleteBtn = document.getElementById('delete-all-notifications');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
            this.deleteAllNotifications();
                this.closeNotificationsMenu();
            });
        }
    }

    createNotificationsMenu() {
        // Create modern notifications menu button and dropdown
        console.log('🔧 Starting createNotificationsMenu...');
        
        // Find the notifications-dashboard header (created by renderNotifications)
        let notificationsHeader = document.querySelector('.notifications-dashboard .dashboard-header .header-left');
        
        if (!notificationsHeader) {
            console.log('❌ Dashboard header not found, notifications may not be loaded yet');
            return;
        }
        
        console.log('📍 Found dashboard header:', !!notificationsHeader);
        
        // Remove existing menu if any
        const existingMenu = document.getElementById('notifications-menu-container');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        // Ensure notifications are loaded before counting
        const notifications = this.notifications || [];
        console.log('📊 Creating menu with notifications:', notifications.length, notifications);
        
        // Get notification counts with better filtering
        const pendingCount = notifications.filter(n => n && (n.status === 'pending' || !n.status)).length;
        const confirmedCount = notifications.filter(n => n && n.status === 'confirmed').length;
        
        console.log('📊 Notification counts - Pending:', pendingCount, 'Confirmed:', confirmedCount);
        
        // Create the menu container
        const menuContainer = document.createElement('div');
        menuContainer.id = 'notifications-menu-container';
        menuContainer.style.cssText = `
            position: absolute;
            top: 8px;
            right: 15px;
            z-index: 1000;
        `;
        
        console.log('✅ Created menu container with fixed positioning');
        
        menuContainer.innerHTML = `
            <!-- Clean Modern Actions Button - HIDDEN as requested -->
            <button id="notifications-menu-btn" style="
                display: none !important;
                visibility: hidden !important;
                background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                align-items: center;
                gap: 8px;
                box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
                transition: all 0.2s ease;
            " onmouseover="
                this.style.background='linear-gradient(135deg, #f7931e 0%, #e55a2b 100%)';
                this.style.boxShadow='0 4px 12px rgba(255, 107, 53, 0.4)';
            " onmouseout="
                this.style.background='linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)';
                this.style.boxShadow='0 2px 8px rgba(255, 107, 53, 0.3)';
            ">
                <i class="fas fa-cog"></i>
                <span>Actions</span>
                <i class="fas fa-chevron-down" style="font-size: 12px;"></i>
            </button>
            
            <!-- Modern Dropdown Menu -->
            <div id="notifications-menu" style="
                position: absolute;
                top: 55px;
                right: 0;
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                min-width: 280px;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-10px) scale(0.95);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                border: 1px solid rgba(255, 255, 255, 0.18);
                backdrop-filter: blur(20px);
                overflow: hidden;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    padding: 16px 20px;
                    border-bottom: 1px solid #e2e8f0;
                ">
                    <h4 style="
                        margin: 0;
                        font-size: 16px;
                        color: #1e293b;
                        font-weight: 600;
                    ">Quick Actions</h4>
                    <p style="
                        margin: 4px 0 0 0;
                        font-size: 12px;
                        color: #64748b;
                    ">${pendingCount} pending • ${confirmedCount} confirmed</p>
                </div>
                
                <!-- Menu Items -->
                <div style="padding: 8px;">
                    <button id="refresh-notifications" style="
                        width: 100%;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px 16px;
                        background: none;
                        border: none;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-size: 14px;
                        color: #475569;
                        text-align: left;
                    " onmouseover="this.style.background='#f1f5f9'; this.style.color='#1e293b'"
                       onmouseout="this.style.background='none'; this.style.color='#475569'">
                        <div style="
                            width: 32px;
                            height: 32px;
                            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 12px;
                        ">
                            <i class="fas fa-sync-alt"></i>
                        </div>
                        <div>
                            <div style="font-weight: 500;">Refresh</div>
                            <div style="font-size: 12px; color: #64748b;">Reload all notifications</div>
                        </div>
                    </button>
                    
                    <button id="complete-all-notifications" style="
                        width: 100%;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px 16px;
                        background: none;
                        border: none;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-size: 14px;
                        color: #475569;
                        text-align: left;
                        ${pendingCount === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                    " onmouseover="if(${pendingCount} > 0) { this.style.background='#f0fdf4'; this.style.color='#15803d'; }"
                       onmouseout="this.style.background='none'; this.style.color='#475569';">
                        <div style="
                            width: 32px;
                            height: 32px;
                            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 12px;
                        ">
                            <i class="fas fa-check-double"></i>
                        </div>
                        <div>
                            <div style="font-weight: 500;">Confirm Pending (${pendingCount})</div>
                            <div style="font-size: 12px; color: #64748b;">Confirm all pending orders</div>
                        </div>
                    </button>
                    
                    <button id="delete-all-notifications" style="
                        width: 100%;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px 16px;
                        background: none;
                        border: none;
                        border-radius: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        font-size: 14px;
                        color: #475569;
                        text-align: left;
                        ${confirmedCount === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                    " onmouseover="if(${confirmedCount} > 0) { this.style.background='#fef2f2'; this.style.color='#dc2626'; }"
                       onmouseout="this.style.background='none'; this.style.color='#475569';">
                        <div style="
                            width: 32px;
                            height: 32px;
                            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 12px;
                        ">
                            <i class="fas fa-trash-alt"></i>
                        </div>
                        <div>
                            <div style="font-weight: 500;">Delete Confirmed (${confirmedCount})</div>
                            <div style="font-size: 12px; color: #64748b;">Remove completed orders</div>
                        </div>
                    </button>
                </div>
            </div>
        `;
        
        // Insert into the dashboard header (next to the notifications title)
        const dashboardHeader = document.querySelector('.notifications-dashboard .dashboard-header');
        if (dashboardHeader) {
            dashboardHeader.appendChild(menuContainer);
            console.log('✅ Menu container added to dashboard header');
        } else {
            // Fallback to header-left if dashboard-header not found
            notificationsHeader.appendChild(menuContainer);
            console.log('✅ Menu container added to header-left');
        }
        
        console.log('📍 Header element:', notificationsHeader);
        console.log('📍 Menu container:', menuContainer);
        
        // Store reference for live updates
        this.currentMenuContainer = menuContainer;
    }

    openNotificationsMenu() {
        const menu = document.getElementById('notifications-menu');
        const btn = document.getElementById('notifications-menu-btn');
        const chevron = btn?.querySelector('.fa-chevron-down');
        
        if (menu) {
            menu.style.opacity = '1';
            menu.style.visibility = 'visible';
            menu.style.transform = 'translateY(0) scale(1)';
            menu.classList.add('show');
        }
        
        if (chevron) {
            chevron.style.transform = 'rotate(180deg)';
        }
    }

    closeNotificationsMenu() {
        const menu = document.getElementById('notifications-menu');
        const btn = document.getElementById('notifications-menu-btn');
        const chevron = btn?.querySelector('.fa-chevron-down');
        
        if (menu) {
            menu.style.opacity = '0';
            menu.style.visibility = 'hidden';
            menu.style.transform = 'translateY(-10px) scale(0.95)';
            menu.classList.remove('show');
        }
        
        if (chevron) {
            chevron.style.transform = 'rotate(0deg)';
        }
    }

    // Add or ensure this method exists in the class
    renderSingleNotification(notification) {
        const element = document.querySelector(`[data-notification-id="${notification.id}"]`);
        if (element) {
            const statusEl = element.querySelector('.notification-status');
            if (statusEl) {
                statusEl.textContent = notification.status;
            }
            element.classList.remove('unread');
            element.classList.add('confirmed');
        }
    }

    // Add or ensure this method exists in the class
    async deleteNotification(notificationId) {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No user ID available');
                return;
            }
            
            this.showLoadingOverlay('Deleting notification...');
            
            // Call API to delete notification from database
            const response = await fetch(`/api/driver/${this.currentUser.id}/notifications/${notificationId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to delete notification from server');
            }
            
            // Remove from local array and update UI
            this.notifications = this.notifications.filter(n => n.id !== notificationId);
            this.renderNotifications(this.notifications);
            this.updateNotificationBadge(this.notifications.filter(n => !n.is_read).length);
            
            // Close any open modals
            const modal = document.getElementById('delete-notification-modal');
            if (modal) {
                modal.remove();
                document.body.style.overflow = 'auto';
            }
            
            this.showToast('Notification deleted successfully!', 'success');
            this.hideLoadingOverlay();
        } catch (error) {
            this.hideLoadingOverlay();
            
            // Close any open modals
            const modal = document.getElementById('delete-notification-modal');
            if (modal) {
                modal.remove();
                document.body.style.overflow = 'auto';
            }
            
            console.error('Error deleting notification:', error);
            this.showToast('Failed to delete notification: ' + error.message, 'error');
        }
    }

    // Confirm only pending notifications
    async confirmAllNotifications() {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No user ID available');
                return;
            }
            
            // Filter only pending notifications
            const pendingNotifications = this.notifications.filter(n => n.status === 'pending');
            
            if (pendingNotifications.length === 0) {
                this.showToast('No pending notifications to confirm', 'info');
                return;
            }
            
            if (!confirm(`Are you sure you want to confirm ${pendingNotifications.length} pending notifications?`)) {
                return;
            }
            
            this.showLoadingOverlay(`Processing ${pendingNotifications.length} notifications...`);
            
            // Fast batch processing - update all locally first
            pendingNotifications.forEach(notification => {
                const localNotification = this.notifications.find(n => n.id === notification.id);
                if (localNotification) {
                    localNotification.status = 'confirmed';
                    localNotification.confirmed_at = new Date().toISOString();
                }
            });
            
            // Send batch request to server (if endpoint exists) or individual quick requests
            let successCount = pendingNotifications.length;
            
            try {
                // Quick individual requests without waiting for each one
                const confirmPromises = pendingNotifications.map(notification =>
                    fetch(`/api/driver/${this.currentUser.id}/notifications/${notification.id}/confirm`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' }
                    }).catch(err => console.log('Quick confirm error:', err))
                );
                
                // Don't wait for all to complete - optimistic update
                Promise.all(confirmPromises);
                
            } catch (error) {
                console.log('Batch confirm error:', error);
            }
            
            this.hideLoadingOverlay();
            
            // Single success message
            this.showModernToast(`✅ Mass Confirmation Complete - ${successCount} notifications confirmed`, 'success');
            await this.playConfirmationSound();
            
            // Refresh the notifications display
            this.renderNotifications(this.notifications);
            
            // Update menu with new counts (faster than recreating)
            setTimeout(() => {
                this.updateNotificationsMenuCounts();
            }, 100);
            
        } catch (error) {
            this.hideLoadingOverlay();
            console.error('Error confirming all notifications:', error);
            this.showToast('Failed to confirm notifications', 'error');
        }
    }

    // Delete only confirmed notifications  
    async deleteAllNotifications() {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No user ID available');
                return;
            }
            
            // Filter only confirmed notifications
            const confirmedNotifications = this.notifications.filter(n => n.status === 'confirmed');
            
            if (confirmedNotifications.length === 0) {
                this.showToast('No confirmed notifications to delete', 'info');
                return;
            }
            
            if (!confirm(`Are you sure you want to delete ${confirmedNotifications.length} confirmed notifications? This action cannot be undone.`)) {
                return;
            }
            
            this.showLoadingOverlay(`Processing ${confirmedNotifications.length} notifications...`);
            
            let successCount = confirmedNotifications.length;
            
            // Fast batch processing - remove all locally first
            this.notifications = this.notifications.filter(n => n.status !== 'confirmed');
            
            try {
                // Quick individual requests without waiting for each one
                const deletePromises = confirmedNotifications.map(notification =>
                    fetch(`/api/driver/${this.currentUser.id}/notifications/${notification.id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    }).catch(err => console.log('Quick delete error:', err))
                );
                
                // Don't wait for all to complete - optimistic update
                Promise.all(deletePromises);
                
                } catch (error) {
                console.log('Batch delete error:', error);
            }
            
            this.hideLoadingOverlay();
            
            // Single success message
            this.showModernToast(`🗑️ Mass Deletion Complete - ${successCount} notifications removed`, 'success');
            
            // Refresh the notifications display
            this.renderNotifications(this.notifications);
            
            // Update menu with new counts (faster than recreating)
            setTimeout(() => {
                this.updateNotificationsMenuCounts();
            }, 100);
            
        } catch (error) {
            this.hideLoadingOverlay();
            console.error('Error deleting all notifications:', error);
            this.showToast('Failed to delete notifications', 'error');
        }
    }

    // Add or ensure this method exists in the class
    showLoadingOverlay(message = 'Processing...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-spinner"></div>
                <div id="loading-overlay-message" class="loading-message"></div>
            `;
            document.body.appendChild(overlay);
        }
        document.getElementById('loading-overlay-message').textContent = message;
        overlay.style.display = 'flex';
    }
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    async initNotificationSound() {
        try {
            // Create audio context and load notification sound
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const response = await fetch('/assets/notification-sound.mp3');
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.notificationAudio = audioBuffer;
        } catch (error) {
            console.error('Error initializing notification sound:', error);
            // Fallback to basic Audio API if Web Audio API fails
            this.notificationAudio = new Audio('/assets/notification-sound.mp3');
        }
    }

    // Add new methods for edit and delete confirmation modals
    showEditNotificationModal(notificationId) {
        console.log('=== EDIT NOTIFICATION MODAL START ===');
        console.log('Showing edit notification modal for ID:', notificationId);
        
        // Find the notification
        const notification = this.notifications.find(n => n.id == notificationId);
        if (!notification) {
            console.error('Notification not found in local data:', notificationId);
            console.log('Current notifications array:', this.notifications);
            this.showToast('Notification not found', 'error');
            return;
        }
        
        console.log('Found notification to edit:', notification);
        
        // Remove existing modal if any
        const existingEditModal = document.getElementById('edit-notification-modal');
        if (existingEditModal) {
            existingEditModal.remove();
        }
        
        // Create modal with direct HTML insertion - simplest approach
        const modalHTML = `
        <div id="edit-notification-modal" style="
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.7) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
            padding: 20px !important;
        ">
            <div style="
                background: white !important;
                border-radius: 16px !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
                width: 100% !important;
                max-width: 380px !important;
                position: relative !important;
                overflow: hidden !important;
                margin: 0 auto !important;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    padding: 24px;
                    text-align: center;
                    color: white;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 12px auto;
                        backdrop-filter: blur(10px);
                    ">
                        <i class="fas fa-edit" style="font-size: 20px;"></i>
                    </div>
                    <h3 style="
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                    ">Edit Notification</h3>
                    
                    <!-- Close Button -->
                    <button id="edit-notification-close" style="
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        width: 32px;
                        height: 32px;
                        background: rgba(255, 255, 255, 0.2);
                        border: none;
                        border-radius: 50%;
                        color: white;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 18px;
                        font-weight: bold;
                        transition: background-color 0.2s ease;
                        z-index: 1;
                    " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
                        ×
                    </button>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px;">
                    <div style="margin-bottom: 20px;">
                        <label style="
                            display: block;
                            font-size: 14px;
                            font-weight: 500;
                            color: #4b5563;
                            margin-bottom: 8px;
                        ">
                            Message:
                        </label>
                        <textarea id="edit-notification-message" style="
                            width: 100%;
                            padding: 12px;
                            border: 1px solid #d1d5db;
                            border-radius: 8px;
                            font-size: 15px;
                            min-height: 100px;
                            resize: vertical;
                        " placeholder="Enter notification message">${this.escapeHTML(notification.message)}</textarea>
                    </div>
                </div>
                
                <!-- Actions -->
                <div style="
                    display: flex;
                    gap: 12px;
                    padding: 0 24px 24px;
                ">
                    <button id="edit-notification-cancel" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #64748b;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        Cancel
                    </button>
                    <button id="edit-notification-save" style="
                        flex: 2;
                        padding: 12px 16px;
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    ">
                        <i class="fas fa-save"></i> Save Changes
                    </button>
                </div>
            </div>
        </div>
        `;
        
        // Insert the modal HTML directly into the body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
        
        console.log('Edit modal added to DOM with ID: edit-notification-modal');
        
        // Get references to the modal and buttons
        const modal = document.getElementById('edit-notification-modal');
        const cancelBtn = document.getElementById('edit-notification-cancel');
        const saveBtn = document.getElementById('edit-notification-save');
        const closeBtn = document.getElementById('edit-notification-close');
        
        console.log('Cancel button found:', !!cancelBtn);
        console.log('Save button found:', !!saveBtn);
        console.log('Close button found:', !!closeBtn);
        
        // Function to close modal
        const closeModal = () => {
            modal.remove();
            document.body.style.overflow = 'auto';
        };
        
        // Bind events to the modal buttons
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cancel button clicked');
                closeModal();
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked');
                closeModal();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Save button clicked');
                const newMessage = document.getElementById('edit-notification-message').value.trim();
                if (!newMessage) {
                    this.showToast('Message cannot be empty', 'error');
                    return;
                }
                this.updateNotificationMessage(notificationId, newMessage);
                closeModal();
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked, closing modal');
                closeModal();
            }
        });
        
        // Focus on textarea
        setTimeout(() => {
            const textarea = document.getElementById('edit-notification-message');
            if (textarea) {
                textarea.focus();
                // Position cursor at end of text
                textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
            }
            
            // Debug modal visibility
            this.debugModalVisibility('edit-notification-modal');
        }, 100);
    }
    
    async updateNotificationMessage(notificationId, newMessage) {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No user ID available');
                return;
            }
            
            this.showLoadingOverlay('Updating notification...');
            
            // Call API to update notification
            const response = await fetch(`/api/driver/${this.currentUser.id}/notifications/${notificationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: newMessage })
            });
            
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to update notification');
            }
            
            // Update local notification
            this.notifications = this.notifications.map(n => {
                if (n.id == notificationId) {
                    return { ...n, message: newMessage };
                }
                return n;
            });
            
            // Update UI
            this.renderNotifications(this.notifications);
            
            // Send WebSocket message to broadcast the update
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'notification_update',
                    action: 'edited',
                    notificationId: notificationId,
                    data: {
                        message: newMessage,
                        updated_at: new Date().toISOString()
                    }
                }));
            }
            
            this.showToast('Notification updated successfully', 'success');
            this.hideLoadingOverlay();
            
            // Modal is already closed in the click handler
        } catch (error) {
            this.hideLoadingOverlay();
            console.error('Error updating notification:', error);
            this.showToast('Failed to update notification: ' + error.message, 'error');
        }
    }
    
    showDeleteConfirmationModal(notificationId) {
        console.log('=== DELETE CONFIRMATION MODAL START ===');
        console.log('Showing delete confirmation modal for ID:', notificationId);
        
        // Find the notification
        const notification = this.notifications.find(n => n.id == notificationId);
        if (!notification) {
            console.error('Notification not found in local data for deletion:', notificationId);
            console.log('Current notifications array:', this.notifications);
            this.showToast('Notification not found', 'error');
            return;
        }
        
        console.log('Found notification to delete:', notification);
        
        // Remove existing modal if any
        const existingDeleteModal = document.getElementById('delete-notification-modal');
        if (existingDeleteModal) {
            existingDeleteModal.remove();
        }
        
        // Create modal with direct HTML insertion - simplest approach
        const modalHTML = `
        <div id="delete-notification-modal" style="
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: rgba(0, 0, 0, 0.7) !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 999999 !important;
            padding: 20px !important;
        ">
            <div style="
                background: white !important;
                border-radius: 16px !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
                width: 100% !important;
                max-width: 380px !important;
                position: relative !important;
                overflow: hidden !important;
                margin: 0 auto !important;
            ">
                <!-- Header -->
                <div style="
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    padding: 24px;
                    text-align: center;
                    color: white;
                ">
                    <div style="
                        width: 48px;
                        height: 48px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 12px auto;
                        backdrop-filter: blur(10px);
                    ">
                        <i class="fas fa-trash-alt" style="font-size: 20px;"></i>
                    </div>
                    <h3 style="
                        margin: 0;
                        font-size: 18px;
                        font-weight: 600;
                    ">Delete Notification</h3>
                </div>
                
                <!-- Content -->
                <div style="padding: 24px; text-align: center;">
                    <div style="
                        background: #f8fafc;
                        padding: 16px;
                        border-radius: 12px;
                        margin-bottom: 24px;
                        border: 1px solid #e2e8f0;
                    ">
                        <div style="
                            font-size: 14px;
                            color: #64748b;
                            margin-bottom: 8px;
                            font-weight: 500;
                        ">
                            <i class="fas fa-store" style="margin-right: 8px; color: #64748b;"></i>
                            ${this.escapeHTML(notification.shop?.name || 'Unknown Shop')}
                        </div>
                        <div style="
                            color: #1e293b;
                            font-size: 15px;
                            line-height: 1.5;
                            font-style: italic;
                        ">
                            "${this.unescapeHTML(notification.message)}"
                        </div>
                    </div>
                    
                    <p style="
                        color: #64748b;
                        font-size: 14px;
                        margin: 0 0 24px 0;
                        line-height: 1.4;
                    ">
                        Are you sure you want to delete this notification? This action cannot be undone.
                    </p>
                </div>
                
                <!-- Actions -->
                <div style="
                    display: flex;
                    gap: 12px;
                    padding: 0 24px 24px;
                ">
                    <button id="delete-notification-cancel" style="
                        flex: 1;
                        padding: 12px 16px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #64748b;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: all 0.2s ease;
                    ">
                        Cancel
                    </button>
                    <button id="delete-notification-confirm" style="
                        flex: 1;
                        padding: 12px 16px;
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 8px;
                        transition: all 0.2s ease;
                        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
                    ">
                        <i class="fas fa-trash-alt"></i> Yes, Delete
                    </button>
                </div>
            </div>
        </div>
        `;
        
        // Insert the modal HTML directly into the body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
        
        console.log('Delete modal added to DOM with ID: delete-notification-modal');
        
        // Get references to the modal and buttons
        const modal = document.getElementById('delete-notification-modal');
        const cancelBtn = document.getElementById('delete-notification-cancel');
        const deleteBtn = document.getElementById('delete-notification-confirm');
        
        console.log('Cancel button found:', !!cancelBtn);
        console.log('Delete button found:', !!deleteBtn);
        
        // Bind events to the modal buttons
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Cancel button clicked');
                modal.remove();
                document.body.style.overflow = 'auto';
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Delete button clicked');
                this.deleteNotification(notificationId);
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                console.log('Background clicked, closing delete modal');
                modal.remove();
                document.body.style.overflow = 'auto';
            }
        });
        
        // Debug modal visibility
        setTimeout(() => {
            this.debugModalVisibility('delete-notification-modal');
        }, 100);
    }

    handlePaymentMethodChange() {
        const paymentMethod = document.getElementById('edit-order-payment')?.value;
        const priceInput = document.getElementById('edit-order-price');
        const priceContainer = priceInput?.parentElement;
        
        if (priceInput && priceContainer) {
            const existingInfo = priceContainer.querySelector('small');
            
            if (paymentMethod === 'paid') {
                // Disable price editing for paid orders
                priceInput.disabled = true;
                priceInput.style.backgroundColor = '#f3f4f6';
                priceInput.style.cursor = 'not-allowed';
                
                // Clear placeholder when paid is selected
                priceInput.placeholder = '';
                
                // If price is currently empty, set it to 0 for paid orders
                if (!priceInput.value || priceInput.value.trim() === '') {
                    priceInput.value = '0.00';
                }
                
                // Add info message if not already present
                if (!existingInfo) {
                    const infoMessage = document.createElement('small');
                    infoMessage.style.cssText = 'color: #6b7280; font-size: 12px; margin-top: 4px; display: block;';
                    infoMessage.innerHTML = '<i class="fas fa-info-circle"></i> Price is locked when payment is marked as "Paid" - order is already settled';
                    priceContainer.appendChild(infoMessage);
                }
            } else {
                // Enable price editing for cash orders
                priceInput.disabled = false;
                priceInput.style.backgroundColor = 'white';
                priceInput.style.cursor = 'text';
                
                // Restore placeholder for cash orders
                priceInput.placeholder = 'Enter order price';
                
                // Clear 0.00 if it was set automatically and restore to empty for cash
                if (priceInput.value === '0.00') {
                    priceInput.value = '';
                }
                
                // Remove info message if present
                if (existingInfo) {
                    existingInfo.remove();
                }
            }
        }
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
        if (this.currentPage === 'home') {
            this.renderOrders();
        }
    }
}

// Make app available globally and initialize
let deliveryApp;

// Initialize the delivery app
document.addEventListener('DOMContentLoaded', () => {
    deliveryApp = new DeliveryApp();
    // Also make it available on window for onclick handlers
    window.deliveryApp = deliveryApp;
});