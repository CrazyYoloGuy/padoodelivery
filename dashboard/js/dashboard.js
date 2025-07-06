class Dashboard {
    constructor() {
        this.currentSection = 'overview';
        this.users = [];
        this.shops = [];
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
    openShopModal(shopOrId = null) {
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
            const status = document.getElementById(`shop-status-${uniqueId}`).value;
            // Validate required fields
            if (!shopName || !email || !password || !afm) {
                this.showToast('Shop name, email, password, and AFM are required', 'error');
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