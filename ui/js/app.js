/**
 * MARKETPLACE - Main Application JavaScript
 * A simple UI for the blockchain-based delivery tracking system
 * Updated for NestJS API with JWT authentication
 */

// ============================================
// API Client & Authentication
// ============================================

const API_BASE = '/api/v1';
let currentUser = null;
let jwtToken = null;

// Store JWT token in sessionStorage
function setAuth(token, user) {
    jwtToken = token;
    sessionStorage.setItem('jwt', token);
    sessionStorage.setItem('user', JSON.stringify(user));
}

function getAuth() {
    return sessionStorage.getItem('jwt');
}

function getStoredUser() {
    const user = sessionStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function clearAuth() {
    sessionStorage.removeItem('jwt');
    sessionStorage.removeItem('user');
    jwtToken = null;
    currentUser = null;
}

// API request helper
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = {};
    
    const token = getAuth();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = { method, headers };
    if (body) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    if (response.status === 401) {
        clearAuth();
        showLogin();
        throw new Error('Unauthorized');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        // Handle different error formats from NestJS
        let errorMessage = 'API Error';
        if (typeof data.message === 'string') {
            errorMessage = data.message;
        } else if (Array.isArray(data.message)) {
            // Validation errors come as array
            errorMessage = data.message.join(', ');
        } else if (data.error) {
            errorMessage = data.error;
        }
        throw new Error(errorMessage);
    }
    
    return data;
}

// Helper to extract array data from wrapped responses
function extractList(response) {
    // If response has a 'data' field (wrapped response), return that
    if (response && response.data && Array.isArray(response.data)) {
        return response.data;
    }
    // If response is already an array, return it
    if (Array.isArray(response)) {
        return response;
    }
    // Otherwise return empty array
    return [];
}

// ============================================
// UI Helpers
// ============================================

function showToast(title, message, type = 'info') {
    const toast = document.getElementById('notification-toast');
    const toastTitle = document.getElementById('toast-title');
    const toastBody = document.getElementById('toast-body');
    
    toastTitle.textContent = title;
    // Ensure message is a string
    if (typeof message !== 'string') {
        message = JSON.stringify(message);
    }
    toastBody.textContent = message;
    
    toast.className = 'toast';
    if (type === 'success') toast.classList.add('bg-success', 'text-white');
    else if (type === 'error') toast.classList.add('bg-danger', 'text-white');
    else if (type === 'warning') toast.classList.add('bg-warning');
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

function showLoading() {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.remove();
}

function getStatusBadge(status) {
    const statusClass = status.toLowerCase().replace(/_/g, '-');
    return `<span class="status-badge status-${statusClass}">${status.replace(/_/g, ' ')}</span>`;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

function formatPrice(priceInCents) {
    return `$${(parseFloat(priceInCents) / 100).toFixed(2)}`;
}

// ============================================
// Navigation & Views
// ============================================

function showLogin() {
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('dashboard-section').style.display = 'none';
    document.getElementById('main-navbar').style.display = 'none';
}

// Register functionality removed - users are managed by admin

function showDashboard() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('main-navbar').style.display = 'block';
    
    updateNavbar();
    loadDashboard();
}

function updateNavbar() {
    const navLinks = document.getElementById('nav-links');
    const userInfo = document.getElementById('user-info');
    
    userInfo.innerHTML = `${currentUser.fullName || currentUser.email} <span class="role-badge">${currentUser.role}</span>`;
    
    let links = '';
    
    switch (currentUser.role) {
        case 'CUSTOMER':
            links = `
                <li class="nav-item"><a class="nav-link active" href="#" onclick="loadShop()"><i class="ti ti-shopping-cart me-1"></i>Shop</a></li>
                <li class="nav-item"><a class="nav-link" href="#" onclick="loadMyOrders()"><i class="ti ti-clipboard-list me-1"></i>My Orders</a></li>
                <li class="nav-item"><a class="nav-link" href="#" onclick="loadMyDeliveries()"><i class="ti ti-truck me-1"></i>Track Deliveries</a></li>
            `;
            break;
        case 'SELLER':
            links = `
                <li class="nav-item"><a class="nav-link active" href="#" onclick="loadMyItems()"><i class="ti ti-package me-1"></i>My Items</a></li>
                <li class="nav-item"><a class="nav-link" href="#" onclick="loadSellerOrders()"><i class="ti ti-clipboard-list me-1"></i>Orders</a></li>
                <li class="nav-item"><a class="nav-link" href="#" onclick="loadSellerDeliveries()"><i class="ti ti-truck me-1"></i>Deliveries</a></li>
            `;
            break;
        case 'DELIVERY_PERSON':
            links = `
                <li class="nav-item"><a class="nav-link active" href="#" onclick="loadAssignedDeliveries()"><i class="ti ti-truck me-1"></i>My Deliveries</a></li>
            `;
            break;
        case 'ADMIN':
            links = `
                <li class="nav-item"><a class="nav-link active" href="#" onclick="loadAdminUsers()"><i class="ti ti-users me-1"></i>Users</a></li>
                <li class="nav-item"><a class="nav-link" href="#" onclick="loadAdminItems()"><i class="ti ti-package me-1"></i>Items</a></li>
                <li class="nav-item"><a class="nav-link" href="#" onclick="loadAdminOrders()"><i class="ti ti-clipboard-list me-1"></i>Orders</a></li>
                <li class="nav-item"><a class="nav-link" href="#" onclick="loadAdminDeliveries()"><i class="ti ti-truck me-1"></i>Deliveries</a></li>
            `;
            break;
    }
    
    navLinks.innerHTML = links;
}

function loadDashboard() {
    switch (currentUser.role) {
        case 'CUSTOMER':
            loadShop();
            break;
        case 'SELLER':
            loadMyItems();
            break;
        case 'DELIVERY_PERSON':
            loadAssignedDeliveries();
            break;
        case 'ADMIN':
            loadAdminUsers();
            break;
    }
}

// ============================================
// Authentication
// ============================================

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    showLoading();
    
    try {
        // Login with NestJS JWT auth
        const loginResponse = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const loginData = await loginResponse.json();
        
        if (!loginResponse.ok) {
            throw new Error(loginData.message || 'Login failed');
        }
        
        // Store JWT and normalize user info (API uses full_name but we use fullName internally)
        const user = loginData.user;
        user.fullName = user.full_name || user.fullName;  // normalize
        setAuth(loginData.access_token, user);
        currentUser = user;
        
        showToast('Welcome!', `Logged in as ${currentUser.fullName || currentUser.username}`, 'success');
        showDashboard();
    } catch (error) {
        clearAuth();
        showToast('Login Failed', error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Register functions
function showRegisterModal() {
    document.getElementById('register-form').reset();
    document.getElementById('reg-address-fields').style.display = 'block';
    document.getElementById('reg-vehicle-fields').style.display = 'none';
    new bootstrap.Modal(document.getElementById('registerModal')).show();
}

function toggleRegisterFields() {
    const role = document.getElementById('reg-role').value;
    const addressFields = document.getElementById('reg-address-fields');
    const vehicleFields = document.getElementById('reg-vehicle-fields');
    
    if (role === 'DELIVERY_PERSON') {
        addressFields.style.display = 'none';
        vehicleFields.style.display = 'block';
    } else {
        addressFields.style.display = 'block';
        vehicleFields.style.display = 'none';
    }
}

async function registerUser() {
    const username = document.getElementById('reg-username').value.trim();
    const fullName = document.getElementById('reg-fullname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    
    if (!username || !fullName || !email || !password) {
        showToast('Error', 'Please fill in all required fields', 'error');
        return;
    }
    
    const userData = { username, fullName, email, password, role };
    
    // Add role-specific fields
    if (role === 'DELIVERY_PERSON') {
        const vehicleType = document.getElementById('reg-vehicle-type').value.trim();
        const licensePlate = document.getElementById('reg-license-plate').value.trim();
        if (vehicleType && licensePlate) {
            userData.vehicleInfo = { type: vehicleType, licensePlate };
        }
    } else {
        // Structured address for customers and sellers
        const street = document.getElementById('reg-street').value.trim();
        const city = document.getElementById('reg-city').value.trim();
        const state = document.getElementById('reg-state').value.trim();
        const postalCode = document.getElementById('reg-postal-code').value.trim();
        const country = document.getElementById('reg-country').value.trim();
        
        if (street && city && state && postalCode && country) {
            userData.address = { street, city, state, postalCode, country };
        }
    }
    
    showLoading();
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message);
        }
        
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
        showToast('Success!', 'Account created! You can now login.', 'success');
    } catch (error) {
        showToast('Registration Failed', error.message, 'error');
    } finally {
        hideLoading();
    }
}

function logout() {
    clearAuth();
    showLogin();
    document.getElementById('login-form').reset();
    showToast('Logged Out', 'You have been logged out.', 'info');
}

// ============================================
// Customer Views
// ============================================

async function loadShop() {
    setActiveNav('Shop');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/shop-items');
        const items = response.data || response;
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-shopping-cart me-2"></i>Shop</h2>
            </div>
            <div class="row">
        `;
        
        if (!items || items.length === 0) {
            html += `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="ti ti-package-off"></i>
                        <h4>No items available</h4>
                        <p>Check back later for new products!</p>
                    </div>
                </div>
            `;
        } else {
            items.forEach(item => {
                html += `
                    <div class="col-md-4 col-lg-3 mb-4 fade-in">
                        <div class="card shop-item-card">
                            <img src="/img/package.jpeg" class="card-img-top" alt="${item.name}">
                            <div class="card-body">
                                <h5 class="card-title">${item.name}</h5>
                                <p class="card-text text-muted small">${item.description || 'No description'}</p>
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <span class="price-tag">${formatPrice(item.priceInCents)}</span>
                                    <span class="quantity-badge">${item.isActive ? 'Available' : 'Unavailable'}</span>
                                </div>
                                <button class="btn btn-primary w-100" onclick="buyItem('${item.id}', '${item.sellerId}')" ${!item.isActive ? 'disabled' : ''}>
                                    <i class="ti ti-shopping-cart-plus me-1"></i>${!item.isActive ? 'Unavailable' : 'Buy Now'}
                                </button>
                            </div>
                            <div class="card-footer text-muted small">
                                <i class="ti ti-user me-1"></i>Seller: ${item.sellerId ? item.sellerId.substring(0, 8) : 'N/A'}...
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function buyItem(itemId, sellerId) {
    showLoading();
    try {
        // Create order with correct structure for NestJS API
        const order = await apiRequest('/orders', 'POST', {
            sellerId: sellerId,
            items: [
                {
                    itemId: itemId,
                    quantity: 1
                }
            ]
        });
        const orderId = order.data?.id || order.id;
        showToast('Order Placed!', `Order #${orderId.substring(0, 8)} created successfully.`, 'success');
        loadMyOrders();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadMyOrders() {
    setActiveNav('My Orders');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/orders/my');
        const orders = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-clipboard-list me-2"></i>My Orders</h2>
            </div>
        `;
        
        if (!orders || orders.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="ti ti-clipboard-off"></i>
                    <h4>No orders yet</h4>
                    <p>Start shopping to see your orders here!</p>
                </div>
            `;
        } else {
            orders.forEach(order => {
                html += renderOrderCard(order, 'customer');
            });
        }
        
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function loadMyDeliveries() {
    setActiveNav('Track Deliveries');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/deliveries/my');
        const deliveries = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-truck me-2"></i>Track Deliveries</h2>
            </div>
        `;
        
        if (!deliveries || deliveries.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="ti ti-truck-off"></i>
                    <h4>No deliveries</h4>
                    <p>Your deliveries will appear here once orders are shipped.</p>
                </div>
            `;
        } else {
            deliveries.forEach(delivery => {
                html += renderDeliveryCard(delivery, 'customer');
            });
        }
        
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function cancelOrder(orderId) {
    if (!confirm('Are you sure you want to cancel this order?')) {
        return;
    }
    
    showLoading();
    try {
        await apiRequest(`/orders/${orderId}/cancel`, 'PUT');
        showToast('Success!', 'Order cancelled.', 'success');
        loadMyOrders();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// Seller Views
// ============================================

async function loadMyItems() {
    setActiveNav('My Items');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/shop-items');
        const items = response.data || response;
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-package me-2"></i>My Items</h2>
                <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#createItemModal">
                    <i class="ti ti-plus me-1"></i>Add Item
                </button>
            </div>
            <div class="row">
        `;
        
        if (!items || items.length === 0) {
            html += `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="ti ti-package-off"></i>
                        <h4>No items yet</h4>
                        <p>Add your first product to start selling!</p>
                    </div>
                </div>
            `;
        } else {
            items.forEach(item => {
                html += `
                    <div class="col-md-4 col-lg-3 mb-4 fade-in">
                        <div class="card shop-item-card">
                            <img src="/img/package.jpeg" class="card-img-top" alt="${item.name}">
                            <div class="card-body">
                                <h5 class="card-title">${item.name}</h5>
                                <p class="card-text text-muted small">${item.description || 'No description'}</p>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="price-tag">${formatPrice(item.priceInCents)}</span>
                                    <span class="quantity-badge">${item.isActive ? 'Active' : 'Inactive'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        
        html += '</div>';
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function createShopItem() {
    const name = document.getElementById('item-name').value;
    const description = document.getElementById('item-description').value;
    const price = parseFloat(document.getElementById('item-price').value);
    
    showLoading();
    try {
        // NestJS API uses priceInCents
        await apiRequest('/shop-items', 'POST', { 
            name, 
            description, 
            priceInCents: Math.round(price * 100) 
        });
        bootstrap.Modal.getInstance(document.getElementById('createItemModal')).hide();
        document.getElementById('create-item-form').reset();
        showToast('Success!', 'Item created successfully.', 'success');
        loadMyItems();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadSellerOrders() {
    setActiveNav('Orders');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/orders/my');
        const orders = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-clipboard-list me-2"></i>Customer Orders</h2>
            </div>
        `;
        
        if (!orders || orders.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="ti ti-clipboard-off"></i>
                    <h4>No orders</h4>
                    <p>Orders for your items will appear here.</p>
                </div>
            `;
        } else {
            orders.forEach(order => {
                html += renderOrderCard(order, 'seller');
            });
        }
        
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function loadSellerDeliveries() {
    setActiveNav('Deliveries');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/deliveries/my');
        const deliveries = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-truck me-2"></i>My Deliveries</h2>
            </div>
        `;
        
        if (!deliveries || deliveries.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="ti ti-truck-off"></i>
                    <h4>No deliveries</h4>
                    <p>Deliveries you create will appear here.</p>
                </div>
            `;
        } else {
            deliveries.forEach(delivery => {
                html += renderDeliveryCard(delivery, 'seller');
            });
        }
        
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

function confirmOrder(orderId) {
    document.getElementById('confirm-order-id').value = orderId;
    // Reset form with default values
    document.getElementById('package-weight').value = '1.0';
    document.getElementById('package-length').value = '20';
    document.getElementById('package-width').value = '15';
    document.getElementById('package-height').value = '10';
    new bootstrap.Modal(document.getElementById('confirmOrderModal')).show();
}

async function submitConfirmOrder() {
    const orderId = document.getElementById('confirm-order-id').value;
    const weight = parseFloat(document.getElementById('package-weight').value);
    const length = parseFloat(document.getElementById('package-length').value);
    const width = parseFloat(document.getElementById('package-width').value);
    const height = parseFloat(document.getElementById('package-height').value);
    
    // Use seller's address from currentUser
    const sellerAddress = currentUser.address || {};
    const city = sellerAddress.city || 'Unknown City';
    const state = sellerAddress.state || 'N/A';
    const country = sellerAddress.country || 'Unknown';
    
    showLoading();
    try {
        // NestJS API uses camelCase
        await apiRequest(`/orders/${orderId}/confirm`, 'POST', {
            packageWeight: weight,
            packageLength: length,
            packageWidth: width,
            packageHeight: height,
            city: city,
            state: state,
            country: country
        });
        bootstrap.Modal.getInstance(document.getElementById('confirmOrderModal')).hide();
        showToast('Success!', 'Order confirmed and delivery created.', 'success');
        loadSellerOrders();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function showAssignDeliveryModal(deliveryId) {
    document.getElementById('delivery-order-id').value = deliveryId;
    
    // Load delivery persons
    try {
        const response = await apiRequest('/users');
        const users = response.data || extractList(response);
        const deliveryPersons = users.filter(u => u.role === 'DELIVERY_PERSON');
        
        const select = document.getElementById('delivery-person-select');
        select.innerHTML = deliveryPersons.map(u => 
            `<option value="${u.id}">${u.fullName || u.email}</option>`
        ).join('');
        
        if (deliveryPersons.length === 0) {
            select.innerHTML = '<option value="">No delivery persons available</option>';
        }
        
        new bootstrap.Modal(document.getElementById('createDeliveryModal')).show();
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function assignDelivery() {
    const deliveryId = document.getElementById('delivery-order-id').value;
    const deliveryPersonId = document.getElementById('delivery-person-select').value;
    
    if (!deliveryPersonId) {
        showToast('Error', 'Please select a delivery person.', 'error');
        return;
    }
    
    showLoading();
    try {
        await apiRequest(`/deliveries/${deliveryId}/handoff/initiate`, 'POST', {
            toUserId: deliveryPersonId,
            toRole: 'DELIVERY_PERSON'
        });
        bootstrap.Modal.getInstance(document.getElementById('createDeliveryModal')).hide();
        showToast('Success!', 'Delivery assigned to delivery person.', 'success');
        loadSellerOrders();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// Delivery Person Views
// ============================================

async function loadAssignedDeliveries() {
    setActiveNav('My Deliveries');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/deliveries/my');
        const deliveries = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-truck me-2"></i>Assigned Deliveries</h2>
            </div>
        `;
        
        if (!deliveries || deliveries.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="ti ti-truck-off"></i>
                    <h4>No assigned deliveries</h4>
                    <p>Deliveries assigned to you will appear here.</p>
                </div>
            `;
        } else {
            deliveries.forEach(delivery => {
                html += renderDeliveryCard(delivery, 'delivery_person');
            });
        }
        
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function pickupDelivery(deliveryId) {
    showLoading();
    try {
        await apiRequest(`/deliveries/${deliveryId}/pickup`, 'POST');
        showToast('Success!', 'Package picked up.', 'success');
        loadAssignedDeliveries();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// Handoff Functions
// ============================================

let currentDeliveryForHandoff = null;

async function showInitiateHandoffModal(deliveryId) {
    document.getElementById('handoff-delivery-id').value = deliveryId;
    document.getElementById('initiate-handoff-form').reset();
    currentDeliveryForHandoff = deliveryId;
    
    // Load delivery to get customer info
    try {
        const delivery = await apiRequest(`/deliveries/${deliveryId}`);
        currentDeliveryForHandoff = delivery.data || delivery;
        
        // For sellers, only allow handoff to delivery persons
        // For delivery persons, allow both delivery persons and customers
        const roleSelect = document.getElementById('handoff-to-role');
        const roleContainer = roleSelect.closest('.mb-3');
        
        if (currentUser.role === 'SELLER') {
            roleSelect.value = 'DELIVERY_PERSON';
            roleContainer.style.display = 'none'; // Hide role selector for sellers
        } else {
            roleContainer.style.display = 'block';
            roleSelect.value = 'CUSTOMER'; // Default to customer for delivery persons
        }
        
        await updateHandoffRecipientOptions();
        new bootstrap.Modal(document.getElementById('initiateHandoffModal')).show();
    } catch (error) {
        showToast('Error', 'Failed to load delivery details', 'error');
    }
}

async function updateHandoffRecipientOptions() {
    const toRole = document.getElementById('handoff-to-role').value;
    const select = document.getElementById('handoff-to-user');
    
    if (toRole === 'DELIVERY_PERSON') {
        // Load delivery persons using dedicated endpoint (accessible to sellers)
        try {
            const response = await apiRequest('/users/delivery-persons');
            const persons = response.data || extractList(response);
            
            if (persons.length === 0) {
                select.innerHTML = '<option value="">No delivery persons available</option>';
            } else {
                select.innerHTML = persons.map(p => 
                    `<option value="${p.id}">${p.fullName || p.username}</option>`
                ).join('');
            }
        } catch (error) {
            select.innerHTML = '<option value="">Failed to load delivery persons</option>';
        }
    } else if (toRole === 'CUSTOMER') {
        // For customer handoff, use the customer from the delivery
        if (currentDeliveryForHandoff && currentDeliveryForHandoff.customerId) {
            select.innerHTML = `<option value="${currentDeliveryForHandoff.customerId}">Customer (from order)</option>`;
        } else {
            select.innerHTML = '<option value="">Customer not available</option>';
        }
    }
}

async function initiateHandoff() {
    const deliveryId = document.getElementById('handoff-delivery-id').value;
    const toRole = document.getElementById('handoff-to-role').value;
    const toUserId = document.getElementById('handoff-to-user').value;
    
    if (!toUserId) {
        showToast('Error', 'Please select a recipient', 'error');
        return;
    }
    
    showLoading();
    try {
        await apiRequest(`/deliveries/${deliveryId}/handoff/initiate`, 'POST', {
            toUserId: toUserId,
            toRole: toRole
        });
        
        bootstrap.Modal.getInstance(document.getElementById('initiateHandoffModal')).hide();
        showToast('Success!', 'Handoff initiated successfully', 'success');
        
        // Refresh the view
        if (currentUser.role === 'SELLER') {
            loadSellerDeliveries();
        } else if (currentUser.role === 'DELIVERY_PERSON') {
            loadAssignedDeliveries();
        }
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

function showConfirmHandoffModal(deliveryId) {
    // For customers, show simple confirm modal
    if (currentUser.role === 'CUSTOMER') {
        document.getElementById('confirm-handoff-delivery-id').value = deliveryId;
        document.getElementById('confirm-handoff-form').reset();
        new bootstrap.Modal(document.getElementById('confirmHandoffModal')).show();
    } else {
        // For delivery persons, show the full pickup modal
        showDeliveryConfirmModal(deliveryId);
    }
}

async function showDeliveryConfirmModal(deliveryId) {
    document.getElementById('delivery-confirm-delivery-id').value = deliveryId;
    document.getElementById('delivery-confirm-form').reset();
    document.getElementById('delivery-address-info').style.display = 'none';
    
    // Fetch and display delivery address
    try {
        const response = await apiRequest(`/deliveries/${deliveryId}/address`);
        const data = response.data || response;
        const addr = data.address || {};
        const addressHtml = `
            <p class="mb-1"><strong>${data.fullName || 'Customer'}</strong></p>
            <p class="mb-0">${addr.street || ''}</p>
            <p class="mb-0">${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}</p>
            <p class="mb-0">${addr.country || ''}</p>
        `;
        document.getElementById('delivery-address-content').innerHTML = addressHtml;
        document.getElementById('delivery-address-info').style.display = 'block';
    } catch (error) {
        console.log('Could not load delivery address:', error.message);
    }
    
    new bootstrap.Modal(document.getElementById('deliveryConfirmModal')).show();
}

async function confirmHandoff() {
    const deliveryId = document.getElementById('confirm-handoff-delivery-id').value;
    
    showLoading();
    try {
        // Use customer's address for delivery confirmation
        const customerAddress = currentUser.address || {};
        const city = customerAddress.city || 'Unknown City';
        const state = customerAddress.state || 'N/A';
        const country = customerAddress.country || 'Unknown';
        
        await apiRequest(`/deliveries/${deliveryId}/handoff/confirm`, 'POST', {
            city: city,
            state: state,
            country: country
        });
        
        bootstrap.Modal.getInstance(document.getElementById('confirmHandoffModal')).hide();
        showToast('Success!', 'Delivery confirmed.', 'success');
        
        // Refresh the appropriate view
        loadMyDeliveries();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function confirmDeliveryHandoff() {
    const deliveryId = document.getElementById('delivery-confirm-delivery-id').value;
    
    const city = document.getElementById('confirm-city').value.trim() || 'Pickup Location';
    const state = document.getElementById('confirm-state').value.trim() || 'ST';
    const country = document.getElementById('confirm-country').value.trim() || 'US';
    
    showLoading();
    try {
        await apiRequest(`/deliveries/${deliveryId}/handoff/confirm`, 'POST', {
            city: city,
            state: state,
            country: country
        });
        
        bootstrap.Modal.getInstance(document.getElementById('deliveryConfirmModal')).hide();
        showToast('Success!', 'Pickup confirmed.', 'success');
        loadAssignedDeliveries();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function viewDeliveryAddress(deliveryId) {
    showLoading();
    try {
        const response = await apiRequest(`/deliveries/${deliveryId}/address`);
        const data = response.data || response;
        const addr = data.address || {};
        
        const addressHtml = `
            <div class="text-center mb-3">
                <div class="bg-primary text-white rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                    <i class="ti ti-map-pin" style="font-size: 1.5rem;"></i>
                </div>
            </div>
            <h5 class="text-center mb-3">${data.fullName || 'Customer'}</h5>
            <div class="alert alert-light">
                <p class="mb-1">${addr.street || ''}</p>
                <p class="mb-1">${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}</p>
                <p class="mb-0">${addr.country || ''}</p>
            </div>
        `;
        
        document.getElementById('delivery-address-modal-content').innerHTML = addressHtml;
        new bootstrap.Modal(document.getElementById('deliveryAddressModal')).show();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ============================================
// Admin Views
// ============================================

async function loadAdminUsers() {
    setActiveNav('Users');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/users');
        const users = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-users me-2"></i>All Users</h2>
                <button class="btn btn-primary" onclick="showAddUserModal()">
                    <i class="ti ti-user-plus me-1"></i>Add User
                </button>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="table table-hover admin-table mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        users.forEach(user => {
            html += `
                <tr>
                    <td><code>${user.id.substring(0, 8)}...</code></td>
                    <td><i class="ti ti-user me-1"></i>${user.fullName || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${getStatusBadge(user.role)}</td>
                    <td>${formatDate(user.createdAt)}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div></div>';
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

function showAddUserModal() {
    document.getElementById('add-user-form').reset();
    document.getElementById('address-fields').style.display = 'none';
    document.getElementById('organization-field').style.display = 'none';
    
    // Show/hide fields based on role
    document.getElementById('new-user-role').addEventListener('change', function() {
        const role = this.value;
        const addressFields = document.getElementById('address-fields');
        const organizationField = document.getElementById('organization-field');
        
        // Show address for sellers and customers
        if (role === 'SELLER' || role === 'CUSTOMER') {
            addressFields.style.display = 'block';
        } else {
            addressFields.style.display = 'none';
        }
        
        // Show organization for delivery persons
        if (role === 'DELIVERY_PERSON') {
            organizationField.style.display = 'block';
        } else {
            organizationField.style.display = 'none';
        }
    });
    
    new bootstrap.Modal(document.getElementById('addUserModal')).show();
}

async function createUser() {
    const fullName = document.getElementById('new-user-fullname').value.trim();
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value;
    
    if (!fullName || !email || !password) {
        showToast('Error', 'Please fill in all required fields', 'error');
        return;
    }
    
    // Generate username from email (before @)
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const userData = {
        username,
        fullName,
        email,
        password,
        role
    };
    
    // Add address for sellers and customers (simple string format)
    if (role === 'SELLER' || role === 'CUSTOMER') {
        const street = document.getElementById('new-user-street').value.trim();
        const city = document.getElementById('new-user-city').value.trim();
        const state = document.getElementById('new-user-state').value.trim();
        const zip = document.getElementById('new-user-zip').value.trim();
        const country = document.getElementById('new-user-country').value.trim();
        
        if (city && country) {
            // Combine into a simple address string
            userData.address = [street, city, state, zip, country].filter(Boolean).join(', ');
        }
    }
    
    // Add vehicleInfo for delivery persons
    if (role === 'DELIVERY_PERSON') {
        const vehicleType = document.getElementById('new-user-organization').value.trim();
        if (vehicleType) {
            userData.vehicleInfo = {
                type: vehicleType,
                licensePlate: 'N/A'
            };
        }
    }
    
    showLoading();
    try {
        await apiRequest('/auth/register', 'POST', userData);
        bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
        showToast('Success!', `User "${fullName}" created successfully`, 'success');
        loadAdminUsers();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function loadAdminItems() {
    setActiveNav('Items');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/shop-items');
        const items = response.data || response;
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-package me-2"></i>All Items</h2>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="table table-hover admin-table mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Price</th>
                                <th>Active</th>
                                <th>Seller</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        if (items && items.length > 0) {
            items.forEach(item => {
                html += `
                    <tr>
                        <td><code>${item.id.substring(0, 8)}...</code></td>
                        <td><i class="ti ti-package me-1"></i>${item.name}</td>
                        <td>${formatPrice(item.priceInCents)}</td>
                        <td>${item.isActive ? '✓' : '✗'}</td>
                        <td>${item.sellerId ? item.sellerId.substring(0, 8) : 'N/A'}...</td>
                        <td>${formatDate(item.createdAt)}</td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table></div></div>';
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function loadAdminOrders() {
    setActiveNav('Orders');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/orders');
        const orders = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-clipboard-list me-2"></i>All Orders</h2>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="table table-hover admin-table mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Customer</th>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        if (orders && orders.length > 0) {
            orders.forEach(order => {
                const itemCount = order.items ? order.items.length : 0;
                const totalQty = order.items ? order.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
                html += `
                    <tr>
                        <td><code>${order.id.substring(0, 8)}...</code></td>
                        <td>${order.customerId ? order.customerId.substring(0, 8) : 'N/A'}...</td>
                        <td>${itemCount} item(s)</td>
                        <td>${totalQty}</td>
                        <td>${formatPrice(order.totalInCents)}</td>
                        <td>${getStatusBadge(order.status)}</td>
                        <td>${formatDate(order.createdAt)}</td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table></div></div>';
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

async function loadAdminDeliveries() {
    setActiveNav('Deliveries');
    const dashboard = document.getElementById('dashboard-section');
    
    try {
        const response = await apiRequest('/deliveries/my');
        const deliveries = response.data || extractList(response);
        
        let html = `
            <div class="section-header">
                <h2><i class="ti ti-truck me-2"></i>All Deliveries</h2>
            </div>
            <div class="card">
                <div class="table-responsive">
                    <table class="table table-hover admin-table mb-0">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Order</th>
                                <th>Custodian</th>
                                <th>Status</th>
                                <th>Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        if (deliveries && deliveries.length > 0) {
            deliveries.forEach(delivery => {
                html += `
                    <tr>
                        <td><code>${delivery.deliveryId.substring(0, 8)}...</code></td>
                        <td>${delivery.orderId.substring(0, 8)}...</td>
                        <td>${delivery.currentCustodianId.substring(0, 8)}...</td>
                        <td>${getStatusBadge(delivery.deliveryStatus)}</td>
                        <td>${formatDate(delivery.updatedAt)}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewDeliveryHistory('${delivery.deliveryId}')">
                                <i class="ti ti-history"></i> History
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table></div></div>';
        dashboard.innerHTML = html;
    } catch (error) {
        showToast('Error', error.message, 'error');
    }
}

// ============================================
// Delivery History & Timeline
// ============================================

async function viewDeliveryHistory(deliveryId) {
    showLoading();
    try {
        const historyResponse = await apiRequest(`/deliveries/${deliveryId}/history`);
        const deliveryResponse = await apiRequest(`/deliveries/${deliveryId}`);
        
        const history = extractList(historyResponse);
        const delivery = deliveryResponse.data || deliveryResponse;
        
        const modal = document.getElementById('deliveryDetailsModal');
        const body = document.getElementById('delivery-details-body');
        const footer = document.getElementById('delivery-details-footer');
        
        // Format location object to string
        const formatLocation = (loc) => {
            if (!loc) return 'N/A';
            if (typeof loc === 'string') return loc;
            return [loc.city, loc.state, loc.country].filter(Boolean).join(', ') || 'N/A';
        };
        
        let html = `
            <div class="mb-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h5 class="mb-0">Delivery #${delivery.deliveryId.substring(0, 8)}</h5>
                    ${getStatusBadge(delivery.deliveryStatus)}
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <p class="mb-1"><strong>Order:</strong> ${delivery.orderId.substring(0, 8)}...</p>
                        <p class="mb-1"><strong>Custodian:</strong> ${delivery.currentCustodianId.substring(0, 8)}...</p>
                    </div>
                    <div class="col-md-6">
                        <p class="mb-1"><strong>Updated:</strong> ${formatDate(delivery.updatedAt)}</p>
                        <p class="mb-1"><strong>Location:</strong> ${formatLocation(delivery.lastLocation)}</p>
                    </div>
                </div>
            </div>
            <hr>
            <h6 class="mb-3"><i class="ti ti-history me-2"></i>Blockchain History</h6>
        `;
        
        if (history && history.length > 0) {
            html += '<div class="timeline">';
            history.forEach((entry, index) => {
                const isCompleted = index < history.length - 1;
                const status = entry.delivery?.deliveryStatus || 'UNKNOWN';
                const location = formatLocation(entry.delivery?.lastLocation);
                // Handle timestamp as object {seconds, nanos} or string
                let timestamp;
                if (entry.timestamp && typeof entry.timestamp === 'object' && entry.timestamp.seconds) {
                    timestamp = new Date(entry.timestamp.seconds * 1000);
                } else {
                    timestamp = entry.timestamp || entry.delivery?.updatedAt;
                }
                
                // Get package info
                const packageWeight = entry.delivery?.packageWeight;
                const packageDimensions = entry.delivery?.packageDimensions;
                let packageInfo = '';
                if (packageWeight && packageWeight > 0) {
                    packageInfo += `<div class="details"><i class="ti ti-scale me-1"></i>Weight: ${packageWeight} kg</div>`;
                }
                if (packageDimensions && (packageDimensions.length > 0 || packageDimensions.width > 0 || packageDimensions.height > 0)) {
                    packageInfo += `<div class="details"><i class="ti ti-box me-1"></i>Dimensions: ${packageDimensions.length} × ${packageDimensions.width} × ${packageDimensions.height} cm</div>`;
                }
                
                html += `
                    <div class="timeline-item">
                        <div class="timeline-marker ${isCompleted ? 'completed' : ''}">
                            <i class="ti ti-${getTimelineIcon(status)}"></i>
                        </div>
                        <div class="timeline-content">
                            <h6>${status.replace(/_/g, ' ')}</h6>
                            <div class="time">${formatDate(timestamp)}</div>
                            ${location !== 'N/A' ? `<div class="details"><i class="ti ti-map-pin me-1"></i>${location}</div>` : ''}
                            ${packageInfo}
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            html += '<p class="text-muted">No history records found.</p>';
        }
        
        body.innerHTML = html;
        footer.innerHTML = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>';
        
        new bootstrap.Modal(modal).show();
    } catch (error) {
        showToast('Error', error.message, 'error');
    } finally {
        hideLoading();
    }
}

function getTimelineIcon(status) {
    const icons = {
        'PENDING_PICKUP': 'clock',
        'PENDING_PICKUP_HANDOFF': 'transfer',
        'DISPUTED_PICKUP_HANDOFF': 'alert-triangle',
        'IN_TRANSIT': 'truck',
        'PENDING_TRANSIT_HANDOFF': 'transfer',
        'DISPUTED_TRANSIT_HANDOFF': 'alert-triangle',
        'PENDING_DELIVERY_CONFIRMATION': 'home',
        'CONFIRMED_DELIVERY': 'check',
        'DISPUTED_DELIVERY': 'alert-triangle',
        'CANCELLED': 'x'
    };
    return icons[status] || 'point';
}

// ============================================
// Card Renderers
// ============================================

function renderOrderCard(order, role) {
    let actions = '';
    
    if (role === 'seller') {
        if (order.status === 'PENDING') {
            actions = `<button class="btn btn-success btn-action" onclick="confirmOrder('${order.id}')"><i class="ti ti-check me-1"></i>Confirm</button>`;
        }
    } else if (role === 'customer') {
        if (order.status === 'PENDING') {
            actions = `<button class="btn btn-danger btn-action" onclick="cancelOrder('${order.id}')"><i class="ti ti-x me-1"></i>Cancel</button>`;
        }
    }
    
    const totalQty = order.items ? order.items.reduce((sum, i) => sum + i.quantity, 0) : 0;
    
    return `
        <div class="card order-card fade-in">
            <div class="card-body">
                <div class="order-info">
                    <div class="d-flex align-items-center gap-3">
                        <img src="/img/package.jpeg" alt="Package" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                        <div>
                            <h6 class="mb-1">Order #${order.id.substring(0, 8)}</h6>
                            <p class="mb-1 text-muted small">Qty: ${totalQty} • Total: ${formatPrice(order.totalInCents)}</p>
                            <p class="mb-0 text-muted small"><i class="ti ti-clipboard-list me-1"></i>${order.items ? order.items.length : 0} item(s)</p>
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    ${getStatusBadge(order.status)}
                    <div class="quick-actions">${actions}</div>
                </div>
            </div>
        </div>
    `;
}

function renderDeliveryCard(delivery, role) {
    let actions = '';
    const hasPendingHandoff = delivery.pendingHandoff != null;
    
    if (role === 'delivery_person') {
        if (delivery.deliveryStatus === 'PENDING_PICKUP_HANDOFF' && hasPendingHandoff && 
            delivery.pendingHandoff.toUserId === currentUser.id) {
            // Delivery person is the recipient of a pending pickup handoff
            actions = `<button class="btn btn-success btn-action" onclick="showConfirmHandoffModal('${delivery.deliveryId}')"><i class="ti ti-check me-1"></i>Accept Pickup</button>`;
        } else if (delivery.deliveryStatus === 'IN_TRANSIT' && !hasPendingHandoff) {
            actions = `<button class="btn btn-warning btn-action" onclick="showInitiateHandoffModal('${delivery.deliveryId}')"><i class="ti ti-transfer me-1"></i>Initiate Handoff</button>`;
        } else if (delivery.deliveryStatus === 'PENDING_TRANSIT_HANDOFF' && hasPendingHandoff &&
            delivery.pendingHandoff.toUserId === currentUser.id) {
            actions = `<button class="btn btn-success btn-action" onclick="showConfirmHandoffModal('${delivery.deliveryId}')"><i class="ti ti-check me-1"></i>Confirm Handoff</button>`;
        }
    } else if (role === 'seller') {
        if (delivery.deliveryStatus === 'PENDING_PICKUP' && !hasPendingHandoff) {
            actions = `<button class="btn btn-warning btn-action" onclick="showInitiateHandoffModal('${delivery.deliveryId}')"><i class="ti ti-transfer me-1"></i>Initiate Handoff</button>`;
        }
    } else if (role === 'customer') {
        if (delivery.deliveryStatus === 'PENDING_DELIVERY_CONFIRMATION' && hasPendingHandoff &&
            delivery.pendingHandoff.toUserId === currentUser.id) {
            actions = `<button class="btn btn-success btn-action" onclick="showConfirmHandoffModal('${delivery.deliveryId}')"><i class="ti ti-check me-1"></i>Confirm Receipt</button>`;
        }
    }
    
    // Add view history button for sellers and customers only (delivery persons don't have access)
    if (role !== 'delivery_person') {
        actions += `<button class="btn btn-outline-primary btn-action" onclick="viewDeliveryHistory('${delivery.deliveryId}')"><i class="ti ti-history me-1"></i>History</button>`;
    }
    
    // For delivery persons, make the card clickable to view address
    const clickHandler = role === 'delivery_person' ? `onclick="viewDeliveryAddress('${delivery.deliveryId}')" style="cursor: pointer;"` : '';
    const clickHint = role === 'delivery_person' ? `<p class="mb-0 text-muted small"><i class="ti ti-map-pin me-1"></i>Click to view address</p>` : '';
    
    return `
        <div class="card delivery-card fade-in" ${clickHandler}>
            <div class="card-body">
                <div class="delivery-info">
                    <div class="d-flex align-items-center gap-3">
                        <div class="bg-primary text-white rounded p-2">
                            <i class="ti ti-truck" style="font-size: 1.5rem;"></i>
                        </div>
                        <div>
                            <h6 class="mb-1">Delivery #${delivery.deliveryId.substring(0, 8)}</h6>
                            <p class="mb-0 text-muted small">Order: ${delivery.orderId.substring(0, 8)}...</p>
                            ${clickHint}
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    ${getStatusBadge(delivery.deliveryStatus)}
                    <div class="quick-actions" onclick="event.stopPropagation();">${actions}</div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// Utility Functions
// ============================================

function setActiveNav(linkText) {
    const links = document.querySelectorAll('#nav-links .nav-link');
    links.forEach(link => {
        if (link.textContent.trim().includes(linkText)) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// ============================================
// Initialize
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    const auth = getAuth();
    if (auth) {
        try {
            const response = await apiRequest('/users/me');
            currentUser = response.data || response;
            showDashboard();
        } catch (error) {
            clearAuth();
            showLogin();
        }
    } else {
        showLogin();
    }
});
