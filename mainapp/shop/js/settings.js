class ShopSettings {
    constructor() {
        this.currentPage = 1;
        this.driversPerPage = 10;
        this.searchTerm = '';
        this.allDrivers = [];
        this.selectedDrivers = [];
        this.totalPages = 1;
        this.notificationSettings = {
            pushNotifications: true,
            emailNotifications: true,
            soundAlerts: true,
            orderUpdates: true
        };
        
        this.init();
    }
    
    init() {
        console.log('Shop Settings initializing...');
        this.bindEvents();
        this.loadDrivers();
        this.loadSelectedDrivers();
        this.loadNotificationSettings();
    }
    
    bindEvents() {
        // Search functionality
        const searchInput = document.getElementById('driver-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value;
                this.currentPage = 1; // Reset to first page
                this.loadDrivers();
            });
        }
        
        // Notification button
        const notificationBtn = document.getElementById('send-notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.sendNotification();
            });
        }
        
        // Notification settings toggles
        this.bindNotificationToggles();
        
        // Save notification settings
        const saveSettingsBtn = document.getElementById('save-notification-settings');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => {
                this.saveNotificationSettings();
            });
        }
        
        // Mass actions buttons
        this.bindMassActionButtons();
    }
    
    bindNotificationToggles() {
        const toggleIds = ['push-notifications', 'email-notifications', 'sound-alerts', 'order-updates'];
        
        toggleIds.forEach(id => {
            const toggle = document.getElementById(id);
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    const settingKey = this.getSettingKeyFromId(id);
                    if (settingKey) {
                        this.notificationSettings[settingKey] = e.target.checked;
                    }
                });
            }
        });
    }
    
    getSettingKeyFromId(id) {
        const mapping = {
            'push-notifications': 'pushNotifications',
            'email-notifications': 'emailNotifications',
            'sound-alerts': 'soundAlerts',
            'order-updates': 'orderUpdates'
        };
        
        return mapping[id];
    }
    
    bindMassActionButtons() {
        // Mass delete button
        const massDeleteBtn = document.getElementById('mass-delete-btn');
        if (massDeleteBtn) {
            massDeleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleMassDelete();
            });
        }
        
        // Mass accept button
        const massAcceptBtn = document.getElementById('mass-accept-btn');
        if (massAcceptBtn) {
            massAcceptBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleMassAccept();
            });
        }
        
        // Mark all as read button
        const markReadBtn = document.getElementById('mass-mark-read-btn');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleMarkAllRead();
            });
        }
        
        // Toggle dropdown on click (for mobile)
        const massActionsBtn = document.getElementById('mass-actions-btn');
        const massActionsMenu = document.getElementById('mass-actions-menu');
        if (massActionsBtn && massActionsMenu) {
            massActionsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const isVisible = massActionsMenu.style.display === 'block';
                massActionsMenu.style.display = isVisible ? 'none' : 'block';
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!massActionsBtn.contains(e.target) && !massActionsMenu.contains(e.target)) {
                    massActionsMenu.style.display = 'none';
                }
            });
        }
    }
    
    async loadDrivers() {
        try {
            console.log(`Loading drivers - Page: ${this.currentPage}, Search: "${this.searchTerm}"`);
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.driversPerPage,
                search: this.searchTerm
            });
            
            const response = await fetch(`/api/shop/delivery-drivers?${params}`);
            const result = await response.json();
            
            if (result.success) {
                this.allDrivers = result.drivers;
                this.totalPages = result.pagination.totalPages;
                this.renderDrivers(result.drivers);
                this.renderPagination(result.pagination);
                this.updateResultsCount(result.pagination.totalCount);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error loading drivers:', error);
            this.showError('Failed to load drivers');
        }
    }
    
    async loadSelectedDrivers() {
        try {
            const shopId = 1; // Replace with actual shop ID
            const response = await fetch(`/api/shop/${shopId}/selected-drivers`);
            const result = await response.json();
            
            if (result.success) {
                this.selectedDrivers = result.selectedDrivers;
                this.renderSelectedDrivers();
                this.updateNotificationCount();
            }
        } catch (error) {
            console.error('Error loading selected drivers:', error);
        }
    }
    
    loadNotificationSettings() {
        try {
            // Try to load from localStorage first
            const savedSettings = localStorage.getItem('notificationSettings');
            if (savedSettings) {
                this.notificationSettings = JSON.parse(savedSettings);
            }
            
            // Update UI toggles
            this.updateNotificationToggles();
            
            // In a real app, you'd also fetch from server
            console.log('Loaded notification settings:', this.notificationSettings);
        } catch (error) {
            console.error('Error loading notification settings:', error);
        }
    }
    
    updateNotificationToggles() {
        const toggles = {
            'push-notifications': this.notificationSettings.pushNotifications,
            'email-notifications': this.notificationSettings.emailNotifications,
            'sound-alerts': this.notificationSettings.soundAlerts,
            'order-updates': this.notificationSettings.orderUpdates
        };
        
        for (const [id, value] of Object.entries(toggles)) {
            const toggle = document.getElementById(id);
            if (toggle) {
                toggle.checked = value;
            }
        }
    }
    
    async saveNotificationSettings() {
        try {
            // Save to localStorage
            localStorage.setItem('notificationSettings', JSON.stringify(this.notificationSettings));
            
            // In a real app, you'd also save to server
            console.log('Saving notification settings:', this.notificationSettings);
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.showSuccess('Notification settings saved successfully');
        } catch (error) {
            console.error('Error saving notification settings:', error);
            this.showError('Failed to save notification settings');
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
                    <button class="add-driver-btn" onclick="shopSettings.addDriver('${driver.id}', '${driver.email}')">
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
                    onclick="shopSettings.changePage(${pagination.currentPage - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        const startPage = Math.max(1, pagination.currentPage - 2);
        const endPage = Math.min(pagination.totalPages, pagination.currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === pagination.currentPage ? 'active' : ''}" 
                        onclick="shopSettings.changePage(${i})">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${!pagination.hasNext ? 'disabled' : ''} 
                    onclick="shopSettings.changePage(${pagination.currentPage + 1})">
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
        
        const selectedHTML = this.selectedDrivers.map(driver => `
            <div class="selected-driver-card">
                <div class="selected-driver-info">${driver.email}</div>
                <button class="remove-driver-btn" onclick="shopSettings.removeDriver('${driver.id}')">
                    <i class="fas fa-times"></i>
                </button>
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
            const shopId = 1; // Replace with actual shop ID
            
            const response = await fetch(`/api/shop/${shopId}/add-driver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ driverId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Add to local selected drivers (simulation)
                this.selectedDrivers.push({ id: driverId, email: driverEmail });
                this.renderSelectedDrivers();
                this.updateNotificationCount();
                this.showSuccess(result.message);
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Error adding driver:', error);
            this.showError('Failed to add driver to team');
        }
    }
    
    removeDriver(driverId) {
        this.selectedDrivers = this.selectedDrivers.filter(driver => driver.id !== driverId);
        this.renderSelectedDrivers();
        this.updateNotificationCount();
        this.showSuccess('Driver removed from team');
    }
    
    sendNotification() {
        const messageElement = document.getElementById('notification-message');
        const message = messageElement?.value?.trim();
        
        if (!message) {
            this.showError('Please enter a notification message');
            return;
        }
        
        if (this.selectedDrivers.length === 0) {
            this.showError('No drivers selected to send notification to');
            return;
        }
        
        // In a real app, you would send this to your backend
        console.log('Sending notification to drivers:', this.selectedDrivers);
        console.log('Message:', message);
        
        this.showSuccess(`Notification sent to ${this.selectedDrivers.length} driver${this.selectedDrivers.length !== 1 ? 's' : ''}`);
        messageElement.value = '';
    }
    
    async handleMassDelete() {
        try {
            if (!confirm('Are you sure you want to delete all notifications?')) {
                return;
            }
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.showSuccess('All notifications have been deleted');
        } catch (error) {
            console.error('Error deleting notifications:', error);
            this.showError('Failed to delete notifications');
        }
    }
    
    async handleMassAccept() {
        try {
            if (!confirm('Are you sure you want to accept all pending notifications?')) {
                return;
            }
            
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.showSuccess('All pending notifications have been accepted');
        } catch (error) {
            console.error('Error accepting notifications:', error);
            this.showError('Failed to accept notifications');
        }
    }
    
    async handleMarkAllRead() {
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.showSuccess('All notifications have been marked as read');
        } catch (error) {
            console.error('Error marking notifications as read:', error);
            this.showError('Failed to mark notifications as read');
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
    
    showSuccess(message) {
        // Simple alert for now - can be replaced with a toast system
        alert('✅ ' + message);
    }
    
    showError(message) {
        // Simple alert for now - can be replaced with a toast system
        alert('❌ ' + message);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.shopSettings = new ShopSettings();
}); 