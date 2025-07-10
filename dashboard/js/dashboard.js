class Dashboard {
    constructor() {
        this.currentSection = 'overview';
        this.users = [];
        this.shops = [];
        this.categories = [];
        this.stats = {};
        this.filteredShops = [];
        this.shopsToShow = 4;
        this.shopFilter = 'all';
        this.shopObserver = null;
        this.filteredDrivers = [];
        this.driversToShow = 4;
        this.driverObserver = null;
        
        this.init();
    }
    
    init() {
        console.log('Dashboard initializing...');
        this.bindEvents();
        this.loadAllData();
        this.setupShopFilter();
        this.setupDriverSection();
    }
    
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.dataset.section;
                this.navigateToSection(section);
            });
        });
        // Also listen for dynamically added nav items (like All Users)
        const nav = document.querySelector('.nav-list');
        if (nav) {
            nav.addEventListener('click', (e) => {
                const item = e.target.closest('.nav-item');
                if (item && item.dataset.section) {
                    e.preventDefault();
                    this.navigateToSection(item.dataset.section);
                }
            });
        }
        
        // Search and filters
        const userSearch = document.getElementById('user-search');
        if (userSearch) {
            userSearch.addEventListener('input', (e) => {
                this.filterUsers(e.target.value);
            });
        }
        
        const userFilter = document.getElementById('user-filter');
        if (userFilter) {
            userFilter.addEventListener('change', (e) => {
                this.filterUsers(document.getElementById('user-search').value, e.target.value);
            });
        }
        
        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
        
        // Click outside modal to close
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal();
            }
        });
    }
    
    navigateToSection(section) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        // Update content
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.remove('active');
        });
        // Fix: ensure all-users-section is activated properly
        if (section === 'all-users') {
            const allUsersSection = document.getElementById('all-users-section');
            if (allUsersSection) allUsersSection.classList.add('active');
        } else {
        document.getElementById(`${section}-section`).classList.add('active');
        }
        // Update title
        const titles = {
            overview: 'Dashboard Overview',
            users: 'Driver Management',
            shops: 'Shop Management',
            categories: 'Category Management',
            'all-users': 'All Users'
        };
        document.getElementById('page-title').textContent = titles[section];
        this.currentSection = section;
        // Load section specific data
        if (section === 'users') {
            this.filteredDrivers = this.users.filter(u => u.user_type === 'driver');
            this.driversToShow = 4;
            this.renderDrivers();
        } else if (section === 'shops') {
            const shopFilter = document.getElementById('shop-filter');
            if (shopFilter) shopFilter.value = 'all';
            this.shopFilter = 'all';
            this.applyShopFilter();
            const grid = document.getElementById('shops-grid');
            if (grid) grid.scrollTop = 0;
        } else if (section === 'categories') {
            this.loadCategories();
        } else if (section === 'all-users') {
            this.renderUsers();
        }
    }
    
    async loadAllData() {
        try {
            await Promise.all([
                this.loadUsers(),
                this.loadShops()
            ]);
            this.updateStats();
            this.renderRecentItems();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }
    
    async loadUsers() {
        try {
            console.log('Loading users...');
            const response = await fetch('/api/admin/users');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const result = await response.json();
            if (result.success) {
                this.users = result.users;
                console.log('Users loaded successfully:', this.users.length);
                // Always render users after loading
                if (this.currentSection === 'all-users') this.renderUsers();
            } else {
                throw new Error(result.message || 'Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            this.showToast('Failed to load users: ' + error.message, 'error');
            this.users = [];
        }
    }
    
    async loadShops() {
        try {
            console.log('Loading shop accounts...');
            const response = await fetch('/api/admin/shop-accounts');
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.shops = result.shopAccounts;
                console.log('Shop accounts loaded successfully:', this.shops.length);
                // Log shop IDs and types for debugging
                console.log('Shop IDs and types:', this.shops.map(s => ({
                    id: s.id,
                    type: typeof s.id,
                    shop_name: s.shop_name
                })));
            } else {
                throw new Error(result.message || 'Failed to load shop accounts');
            }
        } catch (error) {
            console.error('Error loading shop accounts:', error);
            this.showToast('Failed to load shop accounts: ' + error.message, 'error');
            this.shops = [];
        }
    }
    
    updateStats() {
        // Update overview stats
        document.getElementById('total-users').textContent = this.users.length;
        document.getElementById('total-shops').textContent = this.shops.filter(s => s.status === 'active').length;
        
        // Calculate today's registrations
        const today = new Date().toDateString();
        const todayUsers = this.users.filter(user => 
            new Date(user.created_at).toDateString() === today
        ).length;
        const todayShops = this.shops.filter(shop => 
            new Date(shop.created_at).toDateString() === today
        ).length;
        
        document.getElementById('today-registrations').textContent = todayUsers + todayShops;
    }
    
    renderRecentItems() {
        // Render recent users
        const recentUsers = this.users.slice(0, 5);
        const recentUsersContainer = document.getElementById('recent-users-list');
        
        if (recentUsersContainer) {
            if (recentUsers.length === 0) {
                recentUsersContainer.innerHTML = '<p class="empty-state">No recent drivers</p>';
            } else {
                const recentUsersHtml = recentUsers.map(user => `
                    <div class="list-item">
                        <div class="item-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="item-content">
                            <h4>${user.email}</h4>
                            <p>${user.user_type} • ${this.timeAgo(new Date(user.created_at))}</p>
                        </div>
                    </div>
                `).join('');
                recentUsersContainer.innerHTML = recentUsersHtml;
            }
        }
        
        // Render recent shops
        const recentShops = this.shops.slice(0, 5);
        const recentShopsContainer = document.getElementById('recent-shops-list');
        
        if (recentShopsContainer) {
            if (recentShops.length === 0) {
                recentShopsContainer.innerHTML = '<p class="empty-state">No recent shops</p>';
            } else {
                const recentShopsHtml = recentShops.map(shop => `
                    <div class="list-item">
                        <div class="item-avatar">
                            <i class="fas fa-store"></i>
                        </div>
                        <div class="item-content">
                            <h4>${shop.shop_name}</h4>
                            <p>${shop.status} • ${this.timeAgo(new Date(shop.created_at))}</p>
                        </div>
                    </div>
                `).join('');
                recentShopsContainer.innerHTML = recentShopsHtml;
            }
        }
    }
    
    renderUsers() {
        // Render all users in the All Users table, no matter status, and add Actions button
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        tbody.innerHTML = this.users.map(user => `
            <tr class="user-row" data-user-id="${user.id}" data-user-type="${user.user_type}" style="cursor:pointer; transition:background 0.2s;">
                <td>${user.id}</td>
                <td>${user.email}</td>
                <td>${user.user_type}</td>
                <td>${this.formatDate(user.created_at)}</td>
                <td>
                    <button class="btn secondary" style="padding:6px 14px; font-size:14px;" onclick="dashboard.openUserActionsModal('${user.id}', '${user.user_type}', event)"><i class="fas fa-ellipsis-h"></i> Actions</button>
                </td>
            </tr>
        `).join('');
        // Add click event to each row for redirect (except actions button)
        Array.from(tbody.querySelectorAll('.user-row')).forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // Don't trigger on actions button
                const userId = row.getAttribute('data-user-id');
                const userType = row.getAttribute('data-user-type');
                if (userType === 'shop') {
                    window.location.href = `/dashboard/#/shop/${userId}`;
                } else if (userType === 'driver') {
                    window.location.href = `/dashboard/#/driver/${userId}`;
                } else {
                    window.location.href = `/dashboard/#/user/${userId}`;
                }
            });
            row.addEventListener('mouseover', () => {
                row.style.background = 'rgba(255,107,53,0.07)';
            });
            row.addEventListener('mouseout', () => {
                row.style.background = '';
            });
        });
    }
    
    renderShops() {
        const container = document.getElementById('shops-grid');
        if (!container) return;
        const shops = this.filteredShops || this.shops;
        if (shops.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <i class="fas fa-store" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="margin-bottom: 8px; color: var(--text-primary);">No shops found</h3>
                    <p>Add your first shop to get started</p>
                </div>
            `;
            return;
        }
        // Only show up to shopsToShow
        const visibleShops = shops.slice(0, this.shopsToShow);
        container.innerHTML = visibleShops.map(shop => `
            <div class="shop-card">
                <div class="shop-header">
                    <div class="shop-info">
                        <h3>${shop.shop_name}</h3>
                        <p>${shop.email}</p>
                    </div>
                    <span class="shop-status ${shop.status}">${shop.status}</span>
                </div>
                <div class="shop-details">
                    <div class="shop-detail">
                        <span class="shop-detail-label">Contact Person</span>
                        <span class="shop-detail-value">${shop.contact_person || 'N/A'}</span>
                    </div>
                    <div class="shop-detail">
                        <span class="shop-detail-label">Phone</span>
                        <span class="shop-detail-value">${shop.phone || 'N/A'}</span>
                    </div>
                    <div class="shop-detail">
                        <span class="shop-detail-label">Created</span>
                        <span class="shop-detail-value">${this.formatDate(shop.created_at)}</span>
                    </div>
                </div>
                <div class="shop-actions">
                    <button class="action-btn edit" onclick="dashboard.editShop('${shop.id}')" title="Edit Shop">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn password" onclick="dashboard.changeShopPassword('${shop.id}')" title="Change Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="action-btn delete" onclick="dashboard.deleteShop('${shop.id}')" title="Delete Shop">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        // Add Load More button if there are more shops to show
        if (this.shopsToShow < shops.length) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'btn primary';
            loadMoreBtn.style = 'margin: 32px auto 0; display: block;';
            loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More';
            loadMoreBtn.onclick = () => {
                this.shopsToShow += 4;
                this.renderShops();
            };
            container.appendChild(loadMoreBtn);
        }
    }
    
    renderDrivers() {
        let container = document.getElementById('drivers-grid');
        if (!container) {
            container = document.createElement('div');
            container.id = 'drivers-grid';
            container.className = 'shop-cards-grid';
            const usersSection = document.getElementById('users-section');
            usersSection.innerHTML = `<div class="section-header"><h2>Driver Management</h2><button class='btn primary' id='add-driver-btn' style='margin-left:auto;'><i class='fas fa-plus'></i> Add Driver</button></div>`;
            usersSection.appendChild(container);
            // Add event listener for Add Driver button
            setTimeout(() => {
                const addBtn = document.getElementById('add-driver-btn');
                if (addBtn) {
                    addBtn.onclick = () => this.openDriverModal();
                }
            }, 0);
        }
        const drivers = this.filteredDrivers || [];
        if (drivers.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    <i class="fas fa-user" style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;"></i>
                    <h3 style="margin-bottom: 8px; color: var(--text-primary);">No drivers found</h3>
                    <p>Add your first driver to get started</p>
                </div>
            `;
            return;
        }
        const visibleDrivers = drivers.slice(0, this.driversToShow);
        container.innerHTML = visibleDrivers.map(driver => `
            <div class="shop-card">
                <div class="shop-header">
                    <div class="shop-info">
                        <h3>${driver.email}</h3>
                        <p>${driver.id}</p>
                    </div>
                    <span class="shop-status active">${driver.user_type}</span>
                </div>
                <div class="shop-details">
                    <div class="shop-detail">
                        <span class="shop-detail-label">Created</span>
                        <span class="shop-detail-value">${this.formatDate(driver.created_at)}</span>
                    </div>
                </div>
                <div class="shop-actions">
                    <button class="action-btn info" onclick="dashboard.openDriverInfoModal('${driver.id}')" title="Driver Information">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="action-btn edit" onclick="dashboard.editUser('${driver.id}')" title="Edit Driver">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn password" onclick="dashboard.changeUserPassword('${driver.id}')" title="Change Password">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="action-btn delete" onclick="dashboard.deleteUser('${driver.id}')" title="Delete Driver">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        // Always add Load More button if there are more drivers to show
        if (this.driversToShow < drivers.length) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.className = 'btn primary';
            loadMoreBtn.style = 'margin: 32px auto 0; display: block;';
            loadMoreBtn.innerHTML = '<i class="fas fa-plus"></i> Load More';
            loadMoreBtn.onclick = () => {
                this.driversToShow += 4;
                this.renderDrivers();
            };
            container.appendChild(loadMoreBtn);
        }
    }
    
    // User Management
    openUserModal(userId = null) {
        const isEdit = userId !== null;
        const user = isEdit ? this.users.find(u => u.id === userId) : null;
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-user"></i>
                        ${isEdit ? 'Edit Driver' : 'Add New Driver'}
                    </h3>
                </div>
                <div class="modal-body">
                    <form id="user-form">
                        <div class="form-group">
                            <label for="user-email">Email</label>
                            <input type="email" id="user-email" value="${user?.email || ''}" required ${isEdit ? 'readonly' : ''}>
                        </div>
                        
                        ${!isEdit ? `
                        <div class="form-group">
                            <label for="user-password">Password</label>
                            <input type="password" id="user-password" placeholder="Enter password" required minlength="6">
                        </div>
                        ` : ''}
                        
                        <div class="form-group">
                            <label for="user-type">User Type</label>
                            <select id="user-type" ${isEdit ? 'disabled' : ''}>
                                <option value="driver" ${user?.user_type === 'driver' ? 'selected' : ''}>Driver</option>
                            </select>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn secondary" onclick="dashboard.closeModal()">Cancel</button>
                            <button type="submit" class="btn primary">
                                ${isEdit ? 'Update Driver' : 'Create Driver'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        // Show modal with animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        
        // Handle form submission
        const form = overlay.querySelector('#user-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                email: document.getElementById('user-email').value,
                user_type: document.getElementById('user-type').value
            };
            
            if (!isEdit) {
                formData.password = document.getElementById('user-password').value;
            }
            
            if (isEdit) {
                await this.updateUser(userId, formData);
            } else {
                await this.createUser(formData);
            }
        });
    }
    
    changeUserPassword(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3><i class="fas fa-key"></i> Change Password - ${user.email}</h3>
                </div>
                <div class="modal-body">
                    <form id="password-form">
                        <div class="form-group">
                            <label for="new-password">New Password</label>
                            <input type="password" id="new-password" placeholder="Enter new password" required minlength="6">
                            <small>Password must be at least 6 characters long</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirm-password">Confirm Password</label>
                            <input type="password" id="confirm-password" placeholder="Confirm new password" required>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn secondary" onclick="dashboard.closeModal()">Cancel</button>
                            <button type="submit" class="btn primary">Update Password</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        // Show modal with animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        
        // Handle form submission
        const form = overlay.querySelector('#password-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                this.showToast('Passwords do not match', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                this.showToast('Password must be at least 6 characters long', 'error');
                return;
            }
            
            await this.updateUserPassword(userId, newPassword);
        });
    }
    
    async createUser(formData) {
        try {
            const response = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Driver created successfully!', 'success');
                this.closeModal();
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
            } else {
                throw new Error(result.message || 'Failed to create driver');
            }
        } catch (error) {
            console.error('Error creating user:', error);
            this.showToast(error.message || 'Failed to create driver', 'error');
        }
    }
    
    async updateUser(userId, formData) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Driver updated successfully!', 'success');
                this.closeModal();
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
            } else {
                throw new Error(result.message || 'Failed to update driver');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            this.showToast(error.message || 'Failed to update driver', 'error');
        }
    }
    
    async updateUserPassword(userId, newPassword) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Driver password updated successfully!', 'success');
                this.closeModal();
            } else {
                throw new Error(result.message || 'Failed to update password');
            }
        } catch (error) {
            console.error('Error updating user password:', error);
            this.showToast(error.message || 'Failed to update password', 'error');
        }
    }
    
    // Shop Management
    async openShopModal(shopOrId = null) {
        try {
            let isEdit = false;
            let shop = null;
            let shopId = null;
            if (shopOrId && typeof shopOrId === 'object') {
                isEdit = true;
                shop = shopOrId;
                shopId = shop.id;
            } else if (shopOrId) {
                isEdit = true;
                shopId = shopOrId;
                const shopIdStr = String(shopId);
                shop = this.shops.find(s => String(s.id) === shopIdStr);
            }

            // Load categories if not already loaded
            if (!this.categories || this.categories.length === 0) {
                await this.loadCategories();
            }
        // Generate a unique ID suffix for all form fields
        const uniqueId = Date.now();
        
            // Create modal overlay (following the same pattern as working modals)
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            
            overlay.innerHTML = `
                <div class="modal">
                    <div class="modal-header" style="background:rgba(255,107,53,0.06); display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-radius:12px 12px 0 0;">
                        <h3 style="display:flex; align-items:center; gap:12px; font-size:22px; font-weight:800; color:var(--primary-color); margin:0;">
                        <i class="fas fa-store"></i>
                        ${isEdit ? 'Edit Shop' : 'Add New Shop'}
                    </h3>
                        <button class="modal-close" onclick="dashboard.closeModal()" style="background:none; border:none; font-size:22px; color:var(--text-muted); cursor:pointer; margin-left:auto;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                    <div style="height:1px; background:var(--border); margin-bottom:18px;"></div>
                <div class="modal-body">
                    <form id="shop-form-${uniqueId}">
                            <div style="margin-bottom:18px;">
                                <div style="font-size:15px; font-weight:700; color:var(--primary-color); margin-bottom:10px; letter-spacing:0.5px;">Account Information</div>
                        <div class="form-group">
                                    <label for="shop-name-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-store" style="color:var(--primary-color);"></i> Shop Name
                            </label>
                            <input type="text" id="shop-name-${uniqueId}" required 
                                   value="${shop ? shop.shop_name : ''}"
                                           placeholder="Enter shop name"
                                           style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                        </div>
                        <div class="form-group">
                                    <label for="shop-email-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-envelope" style="color:var(--primary-color);"></i> Email Address
                            </label>
                            <input type="email" id="shop-email-${uniqueId}" required 
                                   value="${shop ? shop.email : ''}"
                                   ${isEdit ? 'readonly' : ''}
                                           placeholder="Enter email address"
                                           style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                        </div>
                        ${!isEdit ? `
                        <div class="form-group">
                                    <label for="shop-password-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-lock" style="color:var(--primary-color);"></i> Password
                            </label>
                            <input type="password" id="shop-password-${uniqueId}" required 
                                           placeholder="Enter password"
                                           style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                                    <small style="color:#94a3b8;">Password must be at least 6 characters long</small>
                        </div>
                        ` : ''}
                            </div>
                            <div style="margin-bottom:18px;">
                                <div style="font-size:15px; font-weight:700; color:var(--primary-color); margin-bottom:10px; letter-spacing:0.5px;">Contact Details</div>
                        <div class="form-group">
                                    <label for="contact-person-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-user" style="color:var(--primary-color);"></i> Contact Person
                            </label>
                            <input type="text" id="contact-person-${uniqueId}" 
                                   value="${shop ? shop.contact_person || '' : ''}"
                                           placeholder="Enter contact person name"
                                           style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                        </div>
                        <div class="form-group">
                                    <label for="shop-phone-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-phone" style="color:var(--primary-color);"></i> Phone Number
                            </label>
                            <input type="tel" id="shop-phone-${uniqueId}" 
                                   value="${shop ? shop.phone || '' : ''}"
                                           placeholder="Enter phone number"
                                           style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                        </div>
                            </div>
                            <div style="margin-bottom:18px;">
                                <div style="font-size:15px; font-weight:700; color:var(--primary-color); margin-bottom:10px; letter-spacing:0.5px;">Shop Details</div>
                        <div class="form-group">
                                    <label for="shop-address-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-map-marker-alt" style="color:var(--primary-color);"></i> Address
                            </label>
                                    <textarea id="shop-address-${uniqueId}" placeholder="Enter shop address"
                                        style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">${shop ? shop.address || '' : ''}</textarea>
                        </div>
                                                        <div class="form-group">
                                    <label for="shop-afm-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-id-card" style="color:var(--primary-color);"></i> AFM (Tax ID)
                            </label>
                                    <input type="text" id="shop-afm-${uniqueId}" required 
                                           value="${shop ? shop.afm || '' : ''}"
                                           placeholder="Enter AFM (Tax ID)"
                                           style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                                </div>
                                <div class="form-group">
                                    <label for="shop-category-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-th-large" style="color:var(--primary-color);"></i> Category *
                                    </label>
                                    <select id="shop-category-${uniqueId}" required
                                        style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                                        <option value="">Select a category</option>
                                        ${this.categories.filter(cat => cat.is_active).map(category => `
                                            <option value="${category.id}" ${shop && shop.category_id === category.id ? 'selected' : ''}>
                                                ${category.name}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <small style="color:#94a3b8;">Select the category that best describes this shop</small>
                                </div>
                                <div class="form-group">
                                    <label for="shop-status-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;">
                                        <i class="fas fa-toggle-on" style="color:var(--primary-color);"></i> Status
                                    </label>
                                    <select id="shop-status-${uniqueId}" required
                                        style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                                <option value="active" ${shop && shop.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${shop && shop.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                <option value="pending" ${shop && shop.status === 'pending' ? 'selected' : ''}>Pending</option>
                            </select>
                        </div>
                            </div>
                        <div class="form-actions">
                            <button type="button" class="btn secondary" onclick="dashboard.closeModal()">
                                Cancel
                            </button>
                            <button type="submit" class="btn primary">
                                <i class="fas fa-save"></i>
                                ${isEdit ? 'Update Shop' : 'Create Shop'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
            document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
            overlay.dataset.uniqueId = uniqueId;
            console.log('Modal overlay created and appended to body');
        
            // Show modal with animation (same as working modals)
            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });
            
            const form = overlay.querySelector(`#shop-form-${uniqueId}`);
            if (form) {
                form.addEventListener('submit', (e) => {
            e.preventDefault();
                    console.log('Form submitted');
            if (isEdit) {
                this.updateShop(shopId, uniqueId);
            } else {
                this.createShop(uniqueId);
            }
        });
                console.log('Form event listener added');
            } else {
                console.error('Form not found after modal creation');
            }
        } catch (error) {
            console.error('Error in openShopModal:', error);
            this.showToast('Error opening shop modal: ' + error.message, 'error');
        }
    }
    
    changeShopPassword(shopId) {
        console.log('Opening password change modal for shop ID:', shopId);
        
        // Convert to same type for comparison (both to strings)
        const shopIdStr = String(shopId);
        const shop = this.shops.find(s => String(s.id) === shopIdStr);
        
        if (!shop) {
            console.error('Shop not found with ID:', shopId);
            console.log('Available shop IDs:', this.shops.map(s => s.id));
            this.showToast('Shop not found', 'error');
            return;
        }
        
        // Generate a unique ID for the password modal
        const uniqueId = Date.now();
        console.log('Generated unique ID for shop password modal:', uniqueId);
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3><i class="fas fa-key"></i> Change Password - ${shop.shop_name}</h3>
                </div>
                <div class="modal-body">
                    <form id="password-form-${uniqueId}">
                        <div class="form-group">
                            <label for="new-password-${uniqueId}">New Password</label>
                            <input type="password" id="new-password-${uniqueId}" placeholder="Enter new password" required minlength="6">
                            <small>Password must be at least 6 characters long</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="confirm-password-${uniqueId}">Confirm Password</label>
                            <input type="password" id="confirm-password-${uniqueId}" placeholder="Confirm new password" required>
                        </div>
                        
                        <div class="form-actions">
                            <button type="button" class="btn secondary" onclick="dashboard.closeModal()">Cancel</button>
                            <button type="submit" class="btn primary">Update Password</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        
        // Show modal with animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        
        // Handle form submission
        const form = overlay.querySelector(`#password-form-${uniqueId}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Shop password form submitted for shop ID:', shopId);
            
            const newPassword = document.getElementById(`new-password-${uniqueId}`).value;
            const confirmPassword = document.getElementById(`confirm-password-${uniqueId}`).value;
            
            if (newPassword !== confirmPassword) {
                this.showToast('Passwords do not match', 'error');
                return;
            }
            
            if (newPassword.length < 6) {
                this.showToast('Password must be at least 6 characters long', 'error');
                return;
            }
            
            // Show loading state on button
            const submitButton = form.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
            submitButton.disabled = true;
            
            try {
                await this.updateShopPassword(shopId, newPassword);
            } catch (error) {
                // Restore button state on error
                submitButton.innerHTML = originalButtonText;
                submitButton.disabled = false;
            }
        });
    }
    
    async createShop(uniqueId) {
        try {
            // Get form data
            const shopName = document.getElementById(`shop-name-${uniqueId}`).value.trim();
            const email = document.getElementById(`shop-email-${uniqueId}`).value.trim();
            const password = document.getElementById(`shop-password-${uniqueId}`).value;
            const contactPerson = document.getElementById(`contact-person-${uniqueId}`).value.trim();
            const phone = document.getElementById(`shop-phone-${uniqueId}`).value.trim();
            const address = document.getElementById(`shop-address-${uniqueId}`).value.trim();
            const afm = document.getElementById(`shop-afm-${uniqueId}`).value.trim();
            const categoryId = document.getElementById(`shop-category-${uniqueId}`).value;
            const status = document.getElementById(`shop-status-${uniqueId}`).value;
            // Validate required fields
            if (!shopName || !email || !password || !afm || !categoryId) {
                this.showToast('Shop name, email, password, AFM, and category are required', 'error');
                return;
            }
            if (password.length < 6) {
                this.showToast('Password must be at least 6 characters long', 'error');
                return;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                this.showToast('Please enter a valid email address', 'error');
                return;
            }
            const formData = {
                shop_name: shopName,
                email: email,
                password: password,
                contact_person: contactPerson,
                phone: phone,
                address: address,
                afm: afm,
                category_id: parseInt(categoryId),
                status: status
            };
            console.log('Creating shop with data:', { ...formData, password: '******' });
            const response = await fetch('/api/admin/shop-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response error:', response.status, errorText);
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            const result = await response.json();
            if (result.success) {
                this.showToast('Shop created successfully!', 'success');
                this.closeModal();
                await this.loadShops();
                this.renderShops();
                this.updateStats();
            } else {
                throw new Error(result.message || 'Failed to create shop');
            }
        } catch (error) {
            console.error('Error creating shop:', error);
            this.showToast(error.message || 'Failed to create shop', 'error');
        }
    }
    
    async updateShop(shopId, uniqueId) {
        try {
            const formData = {
                shop_name: document.getElementById(`shop-name-${uniqueId}`).value,
                contact_person: document.getElementById(`contact-person-${uniqueId}`).value,
                phone: document.getElementById(`shop-phone-${uniqueId}`).value,
                address: document.getElementById(`shop-address-${uniqueId}`).value,
                afm: document.getElementById(`shop-afm-${uniqueId}`).value,
                category_id: parseInt(document.getElementById(`shop-category-${uniqueId}`).value),
                status: document.getElementById(`shop-status-${uniqueId}`).value
            };
            const response = await fetch(`/api/admin/shop-accounts/${shopId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const result = await response.json();
            if (result.success) {
                this.showToast('Shop updated successfully!', 'success');
                this.closeModal();
                await this.loadShops();
                this.renderShops();
            } else {
                throw new Error(result.message || 'Failed to update shop');
            }
        } catch (error) {
            console.error('Error updating shop:', error);
            this.showToast(error.message || 'Failed to update shop', 'error');
        }
    }
    
    async updateShopPassword(shopId, newPassword) {
        try {
            console.log('Updating password for shop ID:', shopId);
            
            if (!shopId) {
                throw new Error('Shop ID is required');
            }
            
            if (!newPassword || newPassword.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }
            
            // Make sure shopId is a string
            const id = String(shopId);
            console.log('Sending API request to update password for shop ID:', id);
            
            const response = await fetch(`/api/admin/shop-accounts/${id}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPassword })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response error:', response.status, errorText);
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('Shop password updated successfully for ID:', id);
                this.showToast('Shop password updated successfully!', 'success');
                this.closeModal();
            } else {
                throw new Error(result.message || 'Failed to update password');
            }
        } catch (error) {
            console.error('Error updating shop password:', error);
            this.showToast(error.message || 'Failed to update password', 'error');
            throw error; // Re-throw to allow the caller to handle it
        }
    }
    
    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                if (response.status === 404) {
                    this.showToast('User not found or delete endpoint missing', 'error');
                    return;
                }
                throw new Error(`Server error (${response.status})`);
            }
            let result = null;
            try {
                result = await response.json();
            } catch (jsonErr) {
                this.showToast('User deleted, but server did not return valid JSON', 'warning');
                this.closeModal();
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
                return;
            }
            if (result.success) {
                this.showToast('User deleted successfully!', 'success');
                this.closeModal();
                await this.loadUsers();
                this.renderUsers();
                this.updateStats();
            } else {
                throw new Error(result.message || 'Failed to delete user');
            }
        } catch (error) {
            this.showToast(error.message || 'Failed to delete user', 'error');
        }
    }
    
    async deleteShop(shopId) {
        if (!confirm('Are you sure you want to delete this shop? This action cannot be undone.')) {
            return;
        }
        
        try {
            console.log('Deleting shop with ID:', shopId);
            // Convert to string for logging and clarity
            const shopIdStr = String(shopId);
            
            const response = await fetch(`/api/admin/shop-accounts/${shopIdStr}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Shop deleted successfully!', 'success');
                await this.loadShops();
                this.renderShops();
                this.updateStats();
            } else {
                throw new Error(result.message || 'Failed to delete shop');
            }
        } catch (error) {
            console.error('Error deleting shop:', error);
            this.showToast(error.message || 'Failed to delete shop', 'error');
        }
    }
    
    // Utility methods
    editUser(userId) {
        if (document.querySelector('.modal-overlay.active')) return; // Prevent double modal
        this.openUserModal(userId);
    }
    
    editShop(shopId) {
        console.log('Editing shop with ID:', shopId);
        // Make sure shopId is a valid value before opening modal
        if (!shopId) {
            console.error('Invalid shop ID for editing');
            this.showToast('Cannot edit shop: Invalid shop ID', 'error');
            return;
        }
        // Convert to same type for comparison (both to strings)
        const shopIdStr = String(shopId);
        const shop = this.shops.find(s => String(s.id) === shopIdStr);
        if (!shop) {
            console.error('Shop not found with ID:', shopId);
            console.log('Available shop IDs:', this.shops.map(s => s.id));
            this.showToast('Shop not found', 'error');
            return;
        }
        console.log('Opening edit modal for shop:', shop.shop_name);
        // Pass the shop object to openShopModal for pre-filling
        this.openShopModal(shop);
    }
    
    filterUsers(searchTerm = '', userType = 'all') {
        console.log('Filtering users:', searchTerm, userType);
        // TODO: Implement user filtering
    }
    
    async refreshData() {
        console.log('Refreshing data from database...');
        await this.loadAllData();
        this.showToast('Data refreshed successfully!', 'success');
    }
    
    closeModal() {
        // Remove all modal overlays
        const overlays = document.querySelectorAll('.modal-overlay');
        overlays.forEach(overlay => {
            overlay.classList.remove('active');
            // Remove after animation
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        });
        
        // Also remove any standalone modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.parentNode && !modal.closest('.modal-overlay')) {
                modal.parentNode.removeChild(modal);
            }
        });
        
        // Reset body overflow
        document.body.style.overflow = 'auto';
        
        // Remove modal-open class if it exists
        document.body.classList.remove('modal-open');
    }
    
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type]}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
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
    
    timeAgo(date) {
        const now = new Date();
        const diffInMs = now - date;
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMins / 60);
        const diffInDays = Math.floor(diffInHours / 24);
        
        if (diffInMins < 1) return 'Just now';
        if (diffInMins < 60) return `${diffInMins}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        if (diffInDays < 7) return `${diffInDays}d ago`;
        
        return date.toLocaleDateString();
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    setupShopFilter() {
        const shopFilter = document.getElementById('shop-filter');
        if (shopFilter) {
            shopFilter.addEventListener('change', (e) => {
                this.shopFilter = e.target.value;
                this.applyShopFilter();
            });
        }
        this.applyShopFilter();
    }
    
    applyShopFilter() {
        if (this.shopFilter === 'all') {
            this.filteredShops = this.shops;
        } else {
            this.filteredShops = this.shops.filter(shop => shop.status === this.shopFilter);
        }
        this.shopsToShow = 4;
        this.renderShops();
    }
    
    setupDriverSection() {
        // Add All Users nav if not present
        let nav = document.querySelector('.nav-list');
        if (nav && !document.querySelector('.nav-item[data-section="all-users"]')) {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.dataset.section = 'all-users';
            li.innerHTML = '<i class="fas fa-list"></i> <span>All Users</span>';
            nav.appendChild(li);
        }
        // Add All Users section if not present
        if (!document.getElementById('all-users-section')) {
            const section = document.createElement('section');
            section.id = 'all-users-section';
            section.className = 'content-section';
            section.innerHTML = `
                <div class="section-header">
                    <h2>All Users</h2>
                </div>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Email</th>
                                <th>Type</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="users-table-body">
                            <!-- Users will be populated here -->
                        </tbody>
                    </table>
                </div>
            `;
            document.querySelector('.main-content').appendChild(section);
        }
    }

    openDriverModal() {
        // Modal for adding a new driver (Email, Name, Phone, Password, AFM)
        const uniqueId = Date.now();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header" style="background:rgba(255,107,53,0.06); display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-radius:12px 12px 0 0;">
                    <h3 style="display:flex; align-items:center; gap:12px; font-size:22px; font-weight:800; color:var(--primary-color); margin:0;">
                        <i class="fas fa-user"></i> Add New Driver
                    </h3>
                    <button class="modal-close" onclick="dashboard.closeModal()" style="background:none; border:none; font-size:22px; color:var(--text-muted); cursor:pointer; margin-left:auto;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="height:1px; background:var(--border); margin-bottom:18px;"></div>
                <div class="modal-body">
                    <form id="driver-form-${uniqueId}">
                        <div style="margin-bottom:18px;">
                            <div style="font-size:15px; font-weight:700; color:var(--primary-color); margin-bottom:10px; letter-spacing:0.5px;">Driver Information</div>
                            <div class="form-group">
                                <label for="driver-email-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;"><i class="fas fa-envelope" style="color:var(--primary-color);"></i> Email Address</label>
                                <input type="email" id="driver-email-${uniqueId}" required placeholder="Enter email address" style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                            </div>
                            <div class="form-group">
                                <label for="driver-name-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;"><i class="fas fa-user" style="color:var(--primary-color);"></i> Name</label>
                                <input type="text" id="driver-name-${uniqueId}" required placeholder="Enter driver name" style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                            </div>
                            <div class="form-group">
                                <label for="driver-phone-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;"><i class="fas fa-phone" style="color:var(--primary-color);"></i> Phone</label>
                                <input type="tel" id="driver-phone-${uniqueId}" required placeholder="Enter phone number" style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                            </div>
                            <div class="form-group">
                                <label for="driver-afm-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;"><i class="fas fa-id-card" style="color:var(--primary-color);"></i> AFM (Tax ID)</label>
                                <input type="text" id="driver-afm-${uniqueId}" required placeholder="Enter AFM (Tax ID)" style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                            </div>
                            <div class="form-group">
                                <label for="driver-password-${uniqueId}" style="font-weight:700; color:#222; display:flex; align-items:center; gap:8px;"><i class="fas fa-lock" style="color:var(--primary-color);"></i> Password</label>
                                <input type="password" id="driver-password-${uniqueId}" required placeholder="Enter password" style="background:#f8fafc; border-radius:10px; border:1.5px solid var(--border); font-size:15px; padding:12px 14px; margin-top:2px; transition:box-shadow 0.2s;">
                                <small style="color:#94a3b8;">Password must be at least 6 characters long</small>
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn secondary" onclick="dashboard.closeModal()">Cancel</button>
                            <button type="submit" class="btn primary"><i class="fas fa-save"></i> Create Driver</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        overlay.dataset.uniqueId = uniqueId;
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
        const form = overlay.querySelector(`#driver-form-${uniqueId}`);
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                // Validate and collect data
                const email = document.getElementById(`driver-email-${uniqueId}`).value.trim();
                const name = document.getElementById(`driver-name-${uniqueId}`).value.trim();
                const phone = document.getElementById(`driver-phone-${uniqueId}`).value.trim();
                const afm = document.getElementById(`driver-afm-${uniqueId}`).value.trim();
                const password = document.getElementById(`driver-password-${uniqueId}`).value;
                if (!email || !name || !phone || !afm || !password) {
                    this.showToast('All fields are required', 'error');
                    return;
                }
                if (password.length < 6) {
                    this.showToast('Password must be at least 6 characters long', 'error');
                    return;
                }
                // Create driver via API
                try {
                    const response = await fetch('/api/admin/users', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email,
                            password,
                            user_type: 'driver',
                            name,
                            phone,
                            afm
                        })
                    });
                    const result = await response.json();
                    if (result.success) {
                        this.showToast('Driver created successfully!', 'success');
                        this.closeModal();
                        await this.loadUsers();
                        this.filteredDrivers = this.users.filter(u => u.user_type === 'driver');
                        this.renderDrivers();
                        this.updateStats();
                    } else {
                        throw new Error(result.message || 'Failed to create driver');
                    }
                } catch (error) {
                    this.showToast(error.message || 'Failed to create driver', 'error');
                }
            });
        }
    }

    async openDriverInfoModal(driverId) {
        try {
            const driver = this.users.find(u => u.id === driverId);
            if (!driver) {
                this.showToast('Driver not found', 'error');
                return;
            }

            // Fetch comprehensive driver data
            const [statsResponse, detailsResponse] = await Promise.all([
                fetch(`/api/admin/driver-stats/${driverId}`),
                fetch(`/api/admin/driver-details/${driverId}`)
            ]);

            let driverStats = { totalShops: 0, totalOrders: 0, totalEarnings: 0 };
            let driverDetails = { recentOrders: [], recentShops: [], settings: {} };

            if (statsResponse.ok) {
                const result = await statsResponse.json();
                if (result.success) driverStats = result.stats;
            }

            if (detailsResponse.ok) {
                const result = await detailsResponse.json();
                if (result.success) driverDetails = result.details;
            }

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            
            const joinDate = new Date(driver.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            const modalId = 'driver-info-modal-' + Date.now();

            overlay.innerHTML = `
                <div class="modal" style="max-width: 700px; max-height: 80vh;">
                    <div class="modal-header" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 50px; height: 50px; background: var(--primary-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;">
                                <i class="fas fa-user"></i>
                            </div>
                            <div>
                                <h3 style="margin: 0; font-size: 18px; color: #1f2937;">${driver.email}</h3>
                                <p style="margin: 2px 0 0; color: #6b7280; font-size: 13px;">Driver ID: ${driver.id} • Member since ${joinDate}</p>
                            </div>
                        </div>
                        <button class="modal-close" onclick="dashboard.closeModal()" style="position: absolute; top: 16px; right: 16px; background:none; border:none; font-size:20px; color:var(--text-muted); cursor:pointer;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <!-- Navigation Tabs -->
                    <div class="driver-modal-nav" style="display: flex; border-bottom: 1px solid #e5e7eb; background: #f8fafc;">
                        <button class="nav-tab active" data-tab="overview" onclick="dashboard.switchDriverTab(event, 'overview', '${modalId}')" style="flex: 1; padding: 12px 16px; border: none; background: none; cursor: pointer; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent;">
                            <i class="fas fa-chart-bar"></i> Overview
                        </button>
                        <button class="nav-tab" data-tab="details" onclick="dashboard.switchDriverTab(event, 'details', '${modalId}')" style="flex: 1; padding: 12px 16px; border: none; background: none; cursor: pointer; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent;">
                            <i class="fas fa-user-circle"></i> Details
                        </button>
                        <button class="nav-tab" data-tab="activity" onclick="dashboard.switchDriverTab(event, 'activity', '${modalId}')" style="flex: 1; padding: 12px 16px; border: none; background: none; cursor: pointer; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent;">
                            <i class="fas fa-history"></i> Activity
                        </button>
                        <button class="nav-tab" data-tab="financial" onclick="dashboard.switchDriverTab(event, 'financial', '${modalId}')" style="flex: 1; padding: 12px 16px; border: none; background: none; cursor: pointer; font-weight: 500; color: #6b7280; border-bottom: 2px solid transparent;">
                            <i class="fas fa-dollar-sign"></i> Financial
                        </button>
                    </div>

                    <div class="modal-body" style="padding: 20px; overflow-y: auto; max-height: 60vh;" id="${modalId}">
                        ${this.renderDriverOverviewTab(driver, driverStats, driverDetails)}
                        ${this.renderDriverDetailsTab(driver, driverDetails)}
                        ${this.renderDriverActivityTab(driver, driverDetails)}
                        ${this.renderDriverFinancialTab(driver, driverStats, driverDetails)}
                    </div>

                    <div class="modal-footer" style="border-top: 1px solid #e5e7eb; padding: 16px; display: flex; justify-content: flex-end; gap: 12px;">
                        <button type="button" class="btn secondary" onclick="dashboard.closeModal()">Close</button>
                        <button type="button" class="btn primary" onclick="dashboard.editUser('${driver.id}'); dashboard.closeModal();">
                            <i class="fas fa-edit"></i> Edit Driver
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
            
            // Add styles for tabs
            const style = document.createElement('style');
            style.textContent = `
                .nav-tab.active {
                    color: var(--primary-color) !important;
                    border-bottom-color: var(--primary-color) !important;
                }
                .nav-tab:hover {
                    background: #f1f5f9 !important;
                }
                .tab-content {
                    display: none;
                }
                .tab-content.active {
                    display: block;
                }
            `;
            document.head.appendChild(style);
            
            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });

        } catch (error) {
            console.error('Error opening driver info modal:', error);
            this.showToast('Failed to load driver information', 'error');
        }
    }

    switchDriverTab(event, tabName, modalId) {
        // Remove active class from all tabs
        const modal = document.getElementById(modalId);
        modal.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        modal.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab
        event.target.classList.add('active');
        
        // Show corresponding content
        const content = modal.querySelector(`[data-tab-content="${tabName}"]`);
        if (content) content.classList.add('active');
    }

    renderDriverOverviewTab(driver, stats, details) {
        return `
            <div class="tab-content active" data-tab-content="overview">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fef3c7, #fde68a); border-radius: 12px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -10px; right: -10px; width: 40px; height: 40px; background: rgba(217, 119, 6, 0.1); border-radius: 50%;"></div>
                        <div style="font-size: 28px; font-weight: bold; color: #d97706; margin-bottom: 4px;">
                            ${stats.totalShops}
                        </div>
                        <div style="font-size: 12px; color: #92400e; text-transform: uppercase; letter-spacing: 0.5px;">Total Shops</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #dbeafe, #bfdbfe); border-radius: 12px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -10px; right: -10px; width: 40px; height: 40px; background: rgba(37, 99, 235, 0.1); border-radius: 50%;"></div>
                        <div style="font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 4px;">
                            ${stats.totalOrders}
                        </div>
                        <div style="font-size: 12px; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px;">Total Orders</div>
                    </div>
                    <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #dcfce7, #bbf7d0); border-radius: 12px; position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -10px; right: -10px; width: 40px; height: 40px; background: rgba(22, 163, 74, 0.1); border-radius: 50%;"></div>
                        <div style="font-size: 28px; font-weight: bold; color: #16a34a; margin-bottom: 4px;">
                            $${stats.totalEarnings.toFixed(2)}
                        </div>
                        <div style="font-size: 12px; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">Total Earnings</div>
                    </div>
                </div>
                
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                    <h4 style="margin: 0 0 16px; color: #374151; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-user-circle" style="color: var(--primary-color);"></i>
                        Quick Info
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        <div>
                            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Account Status</div>
                            <div style="font-weight: 600; color: #16a34a;">Active</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">User Type</div>
                            <div style="font-weight: 600; color: #374151; text-transform: capitalize;">${driver.user_type}</div>
                        </div>
                        <div>
                            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Registration</div>
                            <div style="font-weight: 600; color: #374151;">${new Date(driver.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderDriverDetailsTab(driver, details) {
        return `
            <div class="tab-content" data-tab-content="details">
                <div style="display: grid; gap: 24px;">
                    <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 16px; color: #374151; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-id-card" style="color: var(--primary-color);"></i>
                            Personal Information
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Email Address</div>
                                <div style="font-weight: 500; color: #374151;">${driver.email}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">User ID</div>
                                <div style="font-weight: 500; color: #374151; font-family: monospace;">${driver.id}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">AFM (Tax ID)</div>
                                <div style="font-weight: 500; color: #374151;">${driver.afm || 'Not provided'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Phone Number</div>
                                <div style="font-weight: 500; color: #374151;">${driver.phone || 'Not provided'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Full Name</div>
                                <div style="font-weight: 500; color: #374151;">${driver.name || 'Not provided'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Address</div>
                                <div style="font-weight: 500; color: #374151;">${driver.address || 'Not provided'}</div>
                            </div>
                        </div>
                    </div>

                    <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 16px; color: #374151; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-cog" style="color: var(--primary-color);"></i>
                            Account Settings
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Account Type</div>
                                <div style="font-weight: 500; color: #374151; text-transform: capitalize;">${driver.user_type}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Status</div>
                                <div style="font-weight: 500; color: #16a34a;">Active</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Last Login</div>
                                <div style="font-weight: 500; color: #374151;">${driver.last_login ? new Date(driver.last_login).toLocaleString() : 'Never'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Created At</div>
                                <div style="font-weight: 500; color: #374151;">${new Date(driver.created_at).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderDriverActivityTab(driver, details) {
        return `
            <div class="tab-content" data-tab-content="activity">
                <div style="display: grid; gap: 24px;">
                    <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 16px; color: #374151; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-store" style="color: var(--primary-color);"></i>
                            Recent Shops
                        </h4>
                        ${details.recentShops && details.recentShops.length > 0 ? 
                            details.recentShops.map(shop => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border-radius: 8px; margin-bottom: 8px;">
                                    <div>
                                        <div style="font-weight: 500; color: #374151;">${shop.name}</div>
                                        <div style="font-size: 12px; color: #6b7280;">Added ${new Date(shop.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Active</div>
                                </div>
                            `).join('') :
                            '<div style="text-align: center; padding: 40px; color: #6b7280;">No shops created yet</div>'
                        }
                    </div>

                    <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 16px; color: #374151; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-shopping-bag" style="color: var(--primary-color);"></i>
                            Recent Orders
                        </h4>
                        ${details.recentOrders && details.recentOrders.length > 0 ? 
                            details.recentOrders.map(order => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border-radius: 8px; margin-bottom: 8px;">
                                    <div>
                                        <div style="font-weight: 500; color: #374151;">Order #${order.id}</div>
                                        <div style="font-size: 12px; color: #6b7280;">${new Date(order.created_at).toLocaleDateString()}</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-weight: 500; color: #16a34a;">$${parseFloat(order.earnings || 0).toFixed(2)}</div>
                                        <div style="font-size: 12px; color: #6b7280; text-transform: capitalize;">${order.payment_method || 'cash'}</div>
                                    </div>
                                </div>
                            `).join('') :
                            '<div style="text-align: center; padding: 40px; color: #6b7280;">No orders yet</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }

    renderDriverFinancialTab(driver, stats, details) {
        const avgOrderValue = stats.totalOrders > 0 ? (stats.totalEarnings / stats.totalOrders) : 0;
        
        return `
            <div class="tab-content" data-tab-content="financial">
                <div style="display: grid; gap: 24px;">
                    <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 16px; color: #374151; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-chart-line" style="color: var(--primary-color);"></i>
                            Financial Summary
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                            <div style="text-align: center; padding: 16px; background: white; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #16a34a; margin-bottom: 4px;">
                                    $${stats.totalEarnings.toFixed(2)}
                                </div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Earnings</div>
                            </div>
                            <div style="text-align: center; padding: 16px; background: white; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #2563eb; margin-bottom: 4px;">
                                    $${avgOrderValue.toFixed(2)}
                                </div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Avg per Order</div>
                            </div>
                            <div style="text-align: center; padding: 16px; background: white; border-radius: 8px;">
                                <div style="font-size: 24px; font-weight: bold; color: #d97706; margin-bottom: 4px;">
                                    ${stats.totalOrders}
                                </div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase;">Total Orders</div>
                            </div>
                        </div>
                    </div>

                    <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                        <h4 style="margin: 0 0 16px; color: #374151; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-wallet" style="color: var(--primary-color);"></i>
                            Payment Information
                        </h4>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px;">
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Payment Method</div>
                                <div style="font-weight: 500; color: #374151;">${driver.payment_method || 'Not configured'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Bank Account</div>
                                <div style="font-weight: 500; color: #374151;">${driver.bank_account || 'Not provided'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Tax ID (AFM)</div>
                                <div style="font-weight: 500; color: #374151;">${driver.afm || 'Not provided'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 4px;">Earnings Settings</div>
                                <div style="font-weight: 500; color: #374151;">${details.settings?.earnings_per_order ? '$' + details.settings.earnings_per_order.toFixed(2) + ' per order' : 'Default settings'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    openUserActionsModal(userId, userType, event) {
        event.stopPropagation();
        const user = this.users.find(u => u.id === userId);
        if (!user) return;
        const uniqueId = Date.now();
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-width:340px;">
                <div class="modal-header" style="background:rgba(255,107,53,0.06); display:flex; align-items:center; justify-content:space-between; padding-bottom:12px; border-radius:12px 12px 0 0;">
                    <h3 style="display:flex; align-items:center; gap:12px; font-size:20px; font-weight:800; color:var(--primary-color); margin:0;">
                        <i class="fas fa-user"></i> User Actions
                    </h3>
                    <button class="modal-close" onclick="dashboard.closeModal()" style="background:none; border:none; font-size:22px; color:var(--text-muted); cursor:pointer; margin-left:auto;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div style="height:1px; background:var(--border); margin-bottom:18px;"></div>
                <div class="modal-body" style="padding:24px; display:flex; flex-direction:column; gap:18px;">
                    <button class="btn primary" style="font-size:16px;" onclick="dashboard.editUser('${userId}'); dashboard.closeModal();"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn error" style="font-size:16px;" onclick="dashboard.deleteUser('${userId}'); dashboard.closeModal();"><i class="fas fa-trash"></i> Delete</button>
                    <button class="btn secondary" style="font-size:16px;" onclick="dashboard.closeModal();"><i class="fas fa-times"></i> Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        overlay.dataset.uniqueId = uniqueId;
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });
    }

    // Categories Management
    async loadCategories() {
        console.log('Loading categories...');
        try {
            const response = await fetch('/api/admin/categories');
            if (response.ok) {
                const result = await response.json();
                this.categories = result.categories || [];
                this.renderCategories();
            } else {
                console.error('Failed to load categories');
                this.showToast('Failed to load categories', 'error');
                this.renderCategoriesEmpty();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            this.showToast('Error loading categories', 'error');
            this.renderCategoriesEmpty();
        }
    }

    renderCategories() {
        const container = document.getElementById('categories-grid');
        if (!container) return;

        if (!this.categories || this.categories.length === 0) {
            this.renderCategoriesEmpty();
            return;
        }

        container.innerHTML = this.categories.map(category => `
            <div class="category-card" style="--category-color: ${category.color}">
                <div class="category-status ${category.is_active ? 'active' : 'inactive'}">
                    ${category.is_active ? 'Active' : 'Inactive'}
                </div>
                
                <div class="category-header">
                    <div class="category-icon" style="background: ${category.color}">
                        <i class="${category.icon}"></i>
                    </div>
                    <div class="category-info">
                        <h3>${category.name}</h3>
                        <p>${category.description || 'No description'}</p>
                    </div>
                </div>
                
                <div class="category-stats">
                    <div class="category-stat">
                        <span class="stat-number">${category.shop_count || 0}</span>
                        <span class="stat-label">Shops</span>
                    </div>
                    <div class="category-stat">
                        <span class="stat-number">-</span>
                        <span class="stat-label">Orders</span>
                    </div>
                </div>
                
                <div class="category-actions">
                    <button class="category-action-btn edit" onclick="dashboard.editCategory(${category.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="category-action-btn delete" onclick="dashboard.deleteCategory(${category.id})">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderCategoriesEmpty() {
        const container = document.getElementById('categories-grid');
        if (!container) return;

        container.innerHTML = `
            <div class="categories-empty">
                <i class="fas fa-th-large"></i>
                <h3>No Categories Yet</h3>
                <p>Create your first category to start organizing your menu items.</p>
                <button class="btn primary" onclick="dashboard.openCategoryModal()">
                    <i class="fas fa-plus"></i>
                    Add First Category
                </button>
            </div>
        `;
    }

    openCategoryModal(editCategory = null) {
        const isEdit = editCategory !== null;
        const modal = document.createElement('div');
        modal.className = 'category-modal';
        modal.id = 'category-modal';

        const defaultColors = [
            '#ff6b35', '#e74c3c', '#f39c12', '#e67e22', 
            '#27ae60', '#2ecc71', '#3498db', '#2980b9',
            '#9b59b6', '#8e44ad', '#e91e63', '#8b4513'
        ];

        const defaultIcons = [
            'fas fa-pizza-slice', 'fas fa-hamburger', 'fas fa-coffee', 'fas fa-ice-cream',
            'fas fa-utensils', 'fas fa-wine-glass', 'fas fa-bread-slice', 'fas fa-fish',
            'fas fa-carrot', 'fas fa-apple-alt', 'fas fa-cookie-bite', 'fas fa-seedling',
            'fas fa-lemon', 'fas fa-pepper-hot', 'fas fa-cheese', 'fas fa-drumstick-bite'
        ];

        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header" style="padding: 24px 24px 0; display: flex; align-items: center; justify-content: space-between;">
                    <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f2937;">
                        <i class="fas fa-th-large" style="color: var(--primary-color); margin-right: 8px;"></i>
                        ${isEdit ? 'Edit Category' : 'Add New Category'}
                    </h3>
                    
                    <button class="modal-close-x" style="
                        position: absolute;
                        top: 16px;
                        right: 16px;
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
                        font-size: 18px;
                        font-weight: bold;
                        z-index: 1;
                    " title="Close">×</button>
                </div>
                
                <form class="category-form" id="category-form">
                    <div class="form-group">
                        <label for="category-name">Category Name *</label>
                        <input type="text" id="category-name" name="name" required 
                               value="${isEdit ? editCategory.name : ''}"
                               placeholder="e.g. Pizza, Burgers, Chinese">
                    </div>
                    
                    <div class="form-group">
                        <label for="category-description">Description</label>
                        <textarea id="category-description" name="description" rows="3"
                                  placeholder="Brief description of this category">${isEdit ? (editCategory.description || '') : ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label>Color</label>
                        <div class="color-picker-grid">
                            ${defaultColors.map(color => `
                                <div class="color-option ${isEdit && editCategory.color === color ? 'selected' : (!isEdit && color === '#ff6b35' ? 'selected' : '')}" 
                                     style="background: ${color}" 
                                     data-color="${color}"></div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label>Icon</label>
                        <div class="icon-picker-grid">
                            ${defaultIcons.map(icon => `
                                <div class="icon-option ${isEdit && editCategory.icon === icon ? 'selected' : (!isEdit && icon === 'fas fa-utensils' ? 'selected' : '')}" 
                                     data-icon="${icon}">
                                    <i class="${icon}"></i>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="category-status">Status</label>
                        <select id="category-status" name="is_active" style="width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px;">
                            <option value="true" ${isEdit && editCategory.is_active ? 'selected' : (!isEdit ? 'selected' : '')}>Active</option>
                            <option value="false" ${isEdit && !editCategory.is_active ? 'selected' : ''}>Inactive</option>
                        </select>
                        <small style="color: var(--text-muted); font-size: 12px; margin-top: 4px; display: block;">
                            Inactive categories won't be available for selection when creating shops
                        </small>
                    </div>
                    
                    <div class="form-group" style="display: flex; gap: 12px; margin-top: 24px;">
                        <button type="button" class="btn secondary modal-close" style="flex: 1;">
                            Cancel
                        </button>
                        <button type="submit" class="btn primary" style="flex: 1;">
                            <i class="fas fa-save"></i>
                            ${isEdit ? 'Update Category' : 'Create Category'}
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Show modal with animation
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });

        // Bind color picker
        modal.querySelectorAll('.color-option').forEach(option => {
            option.addEventListener('click', () => {
                modal.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });

        // Bind icon picker
        modal.querySelectorAll('.icon-option').forEach(option => {
            option.addEventListener('click', () => {
                modal.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });

        // Bind form submission
        const form = modal.querySelector('#category-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (isEdit) {
                this.updateCategory(editCategory.id, modal);
            } else {
                this.createCategory(modal);
            }
        });

        // Bind close events
        const closeButtons = modal.querySelectorAll('.modal-close, .modal-close-x');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.remove();
                document.body.style.overflow = 'auto';
            });
        });

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                document.body.style.overflow = 'auto';
            }
        });

        // Focus on name input
        setTimeout(() => {
            modal.querySelector('#category-name').focus();
        }, 100);
    }

    async createCategory(modal) {
        try {
            const formData = new FormData(modal.querySelector('#category-form'));
            const selectedColor = modal.querySelector('.color-option.selected')?.dataset.color || '#ff6b35';
            const selectedIcon = modal.querySelector('.icon-option.selected')?.dataset.icon || 'fas fa-utensils';

            const categoryData = {
                name: formData.get('name'),
                description: formData.get('description'),
                color: selectedColor,
                icon: selectedIcon,
                is_active: formData.get('is_active') === 'true'
            };

            const response = await fetch('/api/admin/categories', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            if (response.ok) {
                this.showToast('Category created successfully!', 'success');
                modal.remove();
                document.body.style.overflow = 'auto';
                this.loadCategories(); // Reload categories
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to create category', 'error');
            }
        } catch (error) {
            console.error('Error creating category:', error);
            this.showToast('Error creating category', 'error');
        }
    }

    async updateCategory(categoryId, modal) {
        try {
            const formData = new FormData(modal.querySelector('#category-form'));
            const selectedColor = modal.querySelector('.color-option.selected')?.dataset.color;
            const selectedIcon = modal.querySelector('.icon-option.selected')?.dataset.icon;

            const categoryData = {
                name: formData.get('name'),
                description: formData.get('description'),
                color: selectedColor,
                icon: selectedIcon,
                is_active: formData.get('is_active') === 'true'
            };

            const response = await fetch(`/api/admin/categories/${categoryId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(categoryData)
            });

            if (response.ok) {
                this.showToast('Category updated successfully!', 'success');
                modal.remove();
                document.body.style.overflow = 'auto';
                this.loadCategories(); // Reload categories
            } else {
                const error = await response.json();
                this.showToast(error.error || 'Failed to update category', 'error');
            }
        } catch (error) {
            console.error('Error updating category:', error);
            this.showToast('Error updating category', 'error');
        }
    }

    editCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (category) {
            this.openCategoryModal(category);
        }
    }

    async deleteCategory(categoryId) {
        const category = this.categories.find(c => c.id === categoryId);
        if (!category) return;

        // Show confirmation modal
        const confirmed = await this.showConfirmDialog(
            'Delete Category',
            `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
            'Delete',
            'Cancel'
        );

        if (confirmed) {
            try {
                const response = await fetch(`/api/admin/categories/${categoryId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    this.showToast('Category deleted successfully!', 'success');
                    this.loadCategories(); // Reload categories
                } else {
                    const error = await response.json();
                    this.showToast(error.error || 'Failed to delete category', 'error');
                }
            } catch (error) {
                console.error('Error deleting category:', error);
                this.showToast('Error deleting category', 'error');
            }
        }
    }

    showConfirmDialog(title, message, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'category-modal';
            modal.innerHTML = `
                <div class="modal" style="max-width: 400px;">
                    <div style="padding: 24px; text-align: center;">
                        <div style="margin-bottom: 16px; color: #ef4444;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 32px;"></i>
                        </div>
                        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #1f2937;">${title}</h3>
                        <p style="margin: 0 0 24px 0; color: #6b7280; line-height: 1.5;">${message}</p>
                        <div style="display: flex; gap: 12px;">
                            <button class="btn secondary confirm-cancel" style="flex: 1;">
                                ${cancelText}
                            </button>
                            <button class="btn error confirm-delete" style="flex: 1; background: #ef4444;">
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';

            // Show modal with animation
            requestAnimationFrame(() => {
                modal.classList.add('active');
            });

            // Handle clicks
            const cancelBtn = modal.querySelector('.confirm-cancel');
            const confirmBtn = modal.querySelector('.confirm-delete');

            cancelBtn.addEventListener('click', () => {
                modal.remove();
                document.body.style.overflow = 'auto';
                resolve(false);
            });
            
            confirmBtn.addEventListener('click', () => {
                modal.remove();
                document.body.style.overflow = 'auto';
                resolve(true);
            });

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    document.body.style.overflow = 'auto';
                    resolve(false);
                }
            });
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing dashboard...');
    window.dashboard = new Dashboard();
        console.log('Dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        // Create a minimal dashboard instance as fallback
        window.dashboard = {
            openShopModal: () => {
                console.error('Dashboard not properly initialized');
                alert('Dashboard is not properly loaded. Please refresh the page.');
            },
            showToast: (message, type) => {
                console.log(`Toast (${type}): ${message}`);
            }
        };
    }
});

// Fallback: Ensure dashboard is available even if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded, initialize immediately
    if (!window.dashboard) {
        try {
            console.log('DOM already loaded, initializing dashboard immediately...');
            window.dashboard = new Dashboard();
            console.log('Dashboard initialized successfully (late init)');
        } catch (error) {
            console.error('Error in late dashboard initialization:', error);
            window.dashboard = {
                openShopModal: () => {
                    console.error('Dashboard not properly initialized');
                    alert('Dashboard is not properly loaded. Please refresh the page.');
                },
                showToast: (message, type) => {
                    console.log(`Toast (${type}): ${message}`);
                }
            };
        }
    }
} 