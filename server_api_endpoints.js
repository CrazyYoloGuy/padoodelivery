// API endpoints that need to be created

// 1. GET /api/admin/users - Get all users
app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, email, user_type, created_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load users'
        });
    }
});

// 2. GET /api/admin/shop-accounts - Get all shop accounts
app.get('/api/admin/shop-accounts', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT * FROM shop_accounts 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            shopAccounts: result.rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to load shop accounts'
        });
    }
});

// 3. POST /api/admin/shop-accounts - Create shop account
app.post('/api/admin/shop-accounts', async (req, res) => {
    try {
        const { shop_name, email, password, contact_person, phone, address } = req.body;
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await db.query(`
            INSERT INTO shop_accounts (shop_name, email, password, contact_person, phone, address, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'active')
            RETURNING *
        `, [shop_name, email, hashedPassword, contact_person, phone, address]);
        
        res.json({
            success: true,
            shopAccount: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create shop account'
        });
    }
});

// 4. PUT /api/admin/shop-accounts/:id - Update shop account
app.put('/api/admin/shop-accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { shop_name, email, contact_person, phone, address, status } = req.body;
        
        const result = await db.query(`
            UPDATE shop_accounts 
            SET shop_name = $1, email = $2, contact_person = $3, phone = $4, address = $5, status = $6
            WHERE id = $7
            RETURNING *
        `, [shop_name, email, contact_person, phone, address, status, id]);
        
        res.json({
            success: true,
            shopAccount: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update shop account'
        });
    }
});

// 5. DELETE /api/admin/shop-accounts/:id - Delete shop account
app.delete('/api/admin/shop-accounts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM shop_accounts WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Shop account deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete shop account'
        });
    }
});

// 6. GET /api/admin/orders - Get all orders
app.get('/api/admin/orders', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT o.*, u.email as user_email, ps.name as shop_name
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
        res.status(500).json({
            success: false,
            message: 'Failed to load orders'
        });
    }
}); 