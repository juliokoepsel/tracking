// MongoDB initialization script
// Creates the database and seeds the admin user

db = db.getSiblingDB('delivery_tracking');

// Create collections (indexes are managed by Beanie ODM in Python models)
db.createCollection('users');
db.createCollection('orders');

// Seed admin user
// Password: admin (bcrypt hash)
// Generated with bcrypt==4.0.1: passlib.hash.bcrypt.hash("admin")
db.users.insertOne({
    username: "admin",
    email: "admin@deliverytracking.com",
    hashed_password: "$2b$12$2lxOisTdyls2GQeOa1mYu.Lq9sCHIFg2Cb2KlHgqROz36cPFBjovO",
    role: "ADMIN",
    full_name: "System Administrator",
    organization_id: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
});

print("MongoDB initialized successfully!");
print("Admin user created: username='admin', password='admin'");
