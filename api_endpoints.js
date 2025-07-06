const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// GET /api/admin/users - Get all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await client.query(`
            SELECT id, email, user_type, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Error loading users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load users'
        });
    }
});

// POST /api/admin/users - Create user account
app.post('/api/admin/users', async (req, res) => {
    try {
        const { email, password, user_type } = req.body;
        
        // Validate input
        if (!email || !password || !user_type) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, and user type are required'
            });
        }
        
        if (!['driver', 'shop'].includes(user_type)) {
            return res.status(400).json({
                success: false,
                message: 'User type must be either "driver" or "shop"'
            });
        }
        
        // Check if user already exists
        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1', [email]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const result = await client.query(`
            INSERT INTO users (id, email, password, user_type, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, email, user_type, created_at
        `, [uuidv4(), email, hashedPassword, user_type]);
        
        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create user account'
        });
    }
});

// GET /api/admin/shop-accounts - Get all shop accounts
app.get('/api/admin/shop-accounts', async (req, res) => {
    try {
        const result = await client.query(`
            SELECT * FROM shop_accounts 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            shopAccounts: result.rows
        });
    } catch (error) {
        console.error('Error loading shop accounts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load shop accounts'
        });
    }
});

// POST /api/admin/shop-accounts - Create shop account
app.post('/api/admin/shop-accounts', async (req, res) => {
    try {
        const { shop_name, email, password, contact_person, phone, address } = req.body;
        
        // Validate required fields
        if (!shop_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Shop name, email, and password are required'
            });
        }
        
        // Check if shop account already exists
        const existingShop = await client.query(
            'SELECT id FROM shop_accounts WHERE email = $1', [email]
        );
        
        if (existingShop.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Shop account with this email already exists'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create shop account
        const result = await client.query(`
            INSERT INTO shop_accounts (shop_name, email, password, contact_person, phone, address, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
            RETURNING *
        `, [shop_name, email, hashedPassword, contact_person, phone, address]);
        
        res.json({
            success: true,
            shopAccount: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating shop account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create shop account'
        });
    }
});

// PUT /api/admin/shop-accounts/:id - Update shop account
app.put('/api/admin/shop-accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { shop_name, email, contact_person, phone, address, status } = req.body;
        
        // Validate input
        if (!shop_name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Shop name and email are required'
            });
        }
        
        if (status && !['active', 'inactive', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Status must be active, inactive, or pending'
            });
        }
        
        // Update shop account
        const result = await client.query(`
            UPDATE shop_accounts 
            SET shop_name = $1, email = $2, contact_person = $3, phone = $4, address = $5, status = $6, updated_at = NOW()
            WHERE id = $7
            RETURNING *
        `, [shop_name, email, contact_person, phone, address, status || 'active', id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Shop account not found'
            });
        }
        
        res.json({
            success: true,
            shopAccount: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating shop account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update shop account'
        });
    }
});

// DELETE /api/admin/shop-accounts/:id - Delete shop account
app.delete('/api/admin/shop-accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if shop account exists
        const existingShop = await client.query(
            'SELECT id FROM shop_accounts WHERE id = $1', [id]
        );
        
        if (existingShop.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Shop account not found'
            });
        }
        
        // Delete shop account
        await client.query('DELETE FROM shop_accounts WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Shop account deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting shop account:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete shop account'
        });
    }
});

// GET /api/admin/orders - Get all orders
app.get('/api/admin/orders', async (req, res) => {
    try {
        const result = await client.query(`
            SELECT 
                o.*,
                u.email as user_email,
                ps.name as shop_name
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN partner_shops ps ON o.shop_id = ps.id
            ORDER BY o.created_at DESC
        `);
        
        res.json({
            success: true,
            orders: result.rows
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load orders'
        });
    }
}); 