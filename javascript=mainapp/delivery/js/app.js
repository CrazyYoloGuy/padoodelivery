// Update the navigateToPage method to properly show floating button
navigateToPage(page) {
    console.log(`Navigating to ${page}`);
    
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
    document.getElementById(`${page}-page`)?.classList.add('active');
    
    this.currentPage = page;
    
    // Handle page-specific logic
    switch(page) {
        case 'home':
            this.updateRecentActivity();
            this.hideFloatingButton();
            break;
        case 'orders':
            this.renderOrders();
            this.showFloatingButton();
            break;
        case 'settings':
            this.renderSettingsPage();
            this.hideFloatingButton();
            break;
        case 'profile':
            this.hideFloatingButton();
            break;
    }
}

// Add proper floating button methods
showFloatingButton() {
    const floatingBtn = document.getElementById('add-order-btn');
    if (floatingBtn) {
        floatingBtn.style.display = 'flex';
        floatingBtn.style.opacity = '1';
        floatingBtn.style.transform = 'scale(1)';
        console.log('Floating button shown for orders page');
    } else {
        console.warn('Floating button not found');
    }
}

hideFloatingButton() {
    const floatingBtn = document.getElementById('add-order-btn');
    if (floatingBtn) {
        floatingBtn.style.display = 'none';
        floatingBtn.style.opacity = '0';
        floatingBtn.style.transform = 'scale(0.8)';
        console.log('Floating button hidden');
    }
}

// Update createOrderModal to auto-fill earnings from settings
createOrderModal() {
    console.log('Creating order modal...');
    
    const modalHTML = `
        <div id="order-modal" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <div style="background: white; border-radius: 12px; width: 100%; max-width: 400px; max-height: 90vh; overflow-y: auto;">
                <div style="padding: 24px 24px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #1f2937; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-plus-circle" style="color: var(--primary-color);"></i>
                            Add New Order
                        </h3>
                        <button class="modal-close" style="background: none; border: none; font-size: 24px; color: #6b7280; cursor: pointer; padding: 4px; line-height: 1;">×</button>
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
                            ${this.shops.map(shop => `<option value="${shop.id}">${shop.name}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                            <i class="fas fa-dollar-sign" style="color: var(--primary-color); margin-right: 6px;"></i>
                            Order Price <span style="color: #ef4444;">*</span>
                        </label>
                        <input type="number" id="order-price" step="0.01" min="0" required placeholder="Enter order price" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;">
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                            <i class="fas fa-coins" style="color: var(--primary-color); margin-right: 6px;"></i>
                            Your Earnings <span style="color: #ef4444;">*</span>
                        </label>
                        <input type="number" id="order-earnings" step="0.01" min="0" required value="${this.settings.earningsPerOrder || ''}" placeholder="Default: $${this.settings.earningsPerOrder || '0.00'}" style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px;">
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 500; color: #374151; font-size: 14px;">
                            <i class="fas fa-sticky-note" style="color: var(--primary-color); margin-right: 6px;"></i>
                            Notes (Optional)
                        </label>
                        <textarea id="order-notes" placeholder="Add any notes about this order..." style="width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; min-height: 80px; resize: vertical;"></textarea>
                    </div>
                    
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" class="modal-close" style="padding: 10px 20px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">
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

// Update Recent Activity to show only 5 orders
updateRecentActivity() {
    console.log('Updating recent activity...');
    const activityContainer = document.getElementById('recent-activity');
    if (!activityContainer) return;

    // Get last 5 orders only
    const recentOrders = this.orders.slice(0, 5);

    if (recentOrders.length === 0) {
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

// Update saveSettings to refresh order modal if open
saveSettings() {
    const earningsInput = document.getElementById('earnings-input');
    if (earningsInput) {
        const newEarnings = parseFloat(earningsInput.value) || 0;
        this.settings.earningsPerOrder = newEarnings;
        localStorage.setItem('deliveryAppSettings', JSON.stringify(this.settings));
        this.showToast('Settings saved successfully!', 'success');
        
        // Update earnings input in order modal if it's open
        const orderEarningsInput = document.getElementById('order-earnings');
        if (orderEarningsInput) {
            orderEarningsInput.value = newEarnings;
            orderEarningsInput.placeholder = `Default: $${newEarnings.toFixed(2)}`;
        }
    }
} 