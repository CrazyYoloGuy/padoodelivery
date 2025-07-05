let autoRefreshInterval;

function initLogsPage() {
    loadLogStats();
    loadLogs();
    setupLogsEventListeners();
    startAutoRefresh();
}

function setupLogsEventListeners() {
    // Filter event listeners
    document.getElementById('log-type-filter')?.addEventListener('change', loadLogs);
    document.getElementById('log-time-filter')?.addEventListener('change', loadLogs);
    document.getElementById('refresh-logs')?.addEventListener('click', loadLogs);
    
    // Auto-refresh toggle
    document.getElementById('auto-refresh')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

async function loadLogStats() {
    try {
        const response = await fetch('/api/logs/stats');
        const result = await response.json();
        
        if (result.success) {
            const stats = result.stats;
            document.getElementById('today-logs').textContent = stats.todayLogs;
            document.getElementById('user-actions').textContent = stats.userActions;
            document.getElementById('error-logs').textContent = stats.errorLogs;
            document.getElementById('system-logs').textContent = stats.systemLogs;
        }
    } catch (error) {
        console.error('Error loading log stats:', error);
    }
}

async function loadLogs() {
    try {
        const type = document.getElementById('log-type-filter')?.value || 'all';
        const period = document.getElementById('log-time-filter')?.value || 'today';
        
        const response = await fetch(`/api/logs?type=${type}&period=${period}`);
        const result = await response.json();
        
        if (result.success) {
            renderLogs(result.logs);
        }
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

function renderLogs(logs) {
    const container = document.getElementById('logs-list');
    if (!container) return;
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="no-logs">
                <i class="fas fa-clipboard-list"></i>
                <h3>No logs found</h3>
                <p>No activities match your current filters</p>
            </div>
        `;
        return;
    }
    
    const logsHtml = logs.map(log => {
        const icon = getLogIcon(log.action_type);
        const color = getLogColor(log.action_type);
        const time = new Date(log.created_at).toLocaleString();
        const user = log.users ? log.users.email : 'System';
        
        return `
            <div class="log-item">
                <div class="log-icon ${color}">
                    <i class="${icon}"></i>
                </div>
                <div class="log-content">
                    <div class="log-header">
                        <span class="log-description">${log.description}</span>
                        <span class="log-time">${time}</span>
                    </div>
                    <div class="log-meta">
                        <span class="log-user">${user}</span>
                        <span class="log-type">${log.action_type}</span>
                        ${log.ip_address ? `<span class="log-ip">${log.ip_address}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = logsHtml;
}

function getLogIcon(type) {
    const icons = {
        'user_login': 'fas fa-sign-in-alt',
        'user_register': 'fas fa-user-plus',
        'order_created': 'fas fa-shopping-bag',
        'shop_created': 'fas fa-store',
        'shop_updated': 'fas fa-edit',
        'shop_deleted': 'fas fa-trash',
        'settings_updated': 'fas fa-cog',
        'error': 'fas fa-exclamation-triangle',
        'system': 'fas fa-server'
    };
    return icons[type] || 'fas fa-info-circle';
}

function getLogColor(type) {
    const colors = {
        'user_login': 'success',
        'user_register': 'info',
        'order_created': 'primary',
        'shop_created': 'success',
        'shop_updated': 'warning',
        'shop_deleted': 'danger',
        'settings_updated': 'info',
        'error': 'danger',
        'system': 'secondary'
    };
    return colors[type] || 'secondary';
}

function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing interval
    autoRefreshInterval = setInterval(() => {
        loadLogs();
        loadLogStats();
    }, 30000); // Refresh every 30 seconds
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

// Update navigation handler to include logs
function navigateToPage(page) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Show target page
    document.getElementById(`${page}-page`).classList.add('active');
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    
    // Initialize page-specific functionality
    if (page === 'logs') {
        initLogsPage();
    } else if (page === 'users') {
        loadUsers();
    } else if (page === 'dashboard') {
        loadDashboardStats();
    }
} 