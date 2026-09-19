// ==========================================
// RUSTIC ROAST CAFE — ADMIN DASHBOARD JS
// ==========================================

const state = {
  adminData: null,
  activeTab: 'dashboard',
  editingMenuItemId: null,
  editingGalleryItemId: null,
  confirmDeleteCallback: null
};

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const adminApp = document.getElementById('adminApp');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const pageTitle = document.getElementById('pageTitle');
const userBadge = document.getElementById('userBadge');
const toastContainer = document.getElementById('toastContainer');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
});

// Authentication Check
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      userBadge.textContent = data.username || 'Admin';
      loginScreen.style.display = 'none';
      adminApp.style.display = 'flex';
      await loadAdminData();
    } else {
      loginScreen.style.display = 'flex';
      adminApp.style.display = 'none';
    }
  } catch (err) {
    console.error('Auth check error:', err);
    loginScreen.style.display = 'flex';
    adminApp.style.display = 'none';
  }
}

// Fetch Complete Data
async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/all');
    if (res.status === 401) {
      checkAuth();
      return;
    }
    state.adminData = await res.json();
    populateAllForms();
    renderStats();
    renderMenuList();
    renderGalleryList();
  } catch (err) {
    console.error('Error loading admin data:', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

// Event Listeners Setup
function setupEventListeners() {
  // Login Form
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Login successful!');
        checkAuth();
      } else {
        loginError.textContent = data.error || 'Login failed';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = 'Server connection error';
      loginError.style.display = 'block';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    showToast('Logged out successfully');
    checkAuth();
  });

  // Navigation Tabs
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchToTab(tab);
    });
  });

  // Mobile Sidebar Toggle
  document.getElementById('toggleSidebar').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Form Submissions
  setupFormSubmit('formHero', '/api/admin/hero-settings', 'Hero settings saved');
  setupFormSubmit('formVisibility', '/api/admin/section-visibility', 'Section visibility saved');
  setupFormSubmit('formAbout', '/api/admin/about-settings', 'About settings saved');
  setupFormSubmit('formLocation', '/api/admin/location-settings', 'Location settings saved');
  setupFormSubmit('formContact', '/api/admin/contact-settings', 'Contact settings saved');
  setupFormSubmit('formSocial', '/api/admin/social-settings', 'Social settings saved');
  setupFormSubmit('formSeo', '/api/admin/seo-settings', 'SEO settings saved');
  setupFormSubmit('formSite', '/api/admin/site-settings', 'Site settings saved');
  setupFormSubmit('formAnimations', '/api/admin/animation-settings', 'Animation settings saved');

  // Change Password Form
  document.getElementById('formPassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('pwdCurrent').value;
    const newPassword = document.getElementById('pwdNew').value;

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Password updated successfully');
        document.getElementById('pwdCurrent').value = '';
        document.getElementById('pwdNew').value = '';
      } else {
        showToast(data.error || 'Failed to update password', 'error');
      }
    } catch (err) {
      showToast('Error updating password', 'error');
    }
  });

  // Menu Item Modal Form
  document.getElementById('formMenuItem').addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = {
      id: document.getElementById('menuItemId').value || undefined,
      category_key: document.getElementById('modalMenuCategory').value,
      name_ar: document.getElementById('modalMenuNameAr').value,
      name_en: document.getElementById('modalMenuNameEn').value,
      price: parseFloat(document.getElementById('modalMenuPrice').value) || 0,
      sort_order: parseInt(document.getElementById('modalMenuSort').value) || 1,
      visible: document.getElementById('modalMenuVisible').checked
    };

    try {
      const res = await fetch('/api/admin/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        showToast('Menu item saved successfully');
        closeMenuItemModal();
        await loadAdminData();
      } else {
        showToast('Failed to save menu item', 'error');
      }
    } catch (err) {
      showToast('Server error saving menu item', 'error');
    }
  });

  // Gallery Modal Form
  document.getElementById('formGalleryItem').addEventListener('submit', async (e) => {
    e.preventDefault();
    const item = {
      id: document.getElementById('galleryItemId').value || undefined,
      image_url: document.getElementById('modalGalleryUrl').value,
      title_en: document.getElementById('modalGalleryTitleEn').value,
      title_ar: document.getElementById('modalGalleryTitleAr').value,
      sort_order: parseInt(document.getElementById('modalGallerySort').value) || 1,
      visible: document.getElementById('modalGalleryVisible').checked,
      grid_class: 'g-' + ((state.adminData.gallery_items.length % 8) + 1)
    };

    try {
      const res = await fetch('/api/admin/gallery/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        showToast('Gallery image saved successfully');
        closeGalleryModal();
        await loadAdminData();
      } else {
        showToast('Failed to save gallery item', 'error');
      }
    } catch (err) {
      showToast('Server error saving gallery item', 'error');
    }
  });

  // File Upload Handlers
  setupFileUploader('heroBgFile', 'hero_bg_image');
  setupFileUploader('aboutImgFile', 'about_image_url');
  setupFileUploader('ogImgFile', 'seo_og_image');
  setupFileUploader('logoImgFile', 'site_logo_url');
  setupFileUploader('galleryModalFile', 'modalGalleryUrl');
}

// Generic Form Handler
function setupFormSubmit(formId, endpoint, successMsg) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = collectFormData(formId);
    try {
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast(successMsg);
        await loadAdminData();
      } else {
        showToast('Failed to update settings', 'error');
      }
    } catch (err) {
      showToast('Server connection error', 'error');
    }
  });
}

// Collect Form Fields dynamically
function collectFormData(formId) {
  const form = document.getElementById(formId);
  const data = {};
  form.querySelectorAll('input, textarea, select').forEach(input => {
    if (!input.id) return;
    const key = input.id.replace(/^(hero_|vis_|about_|loc_|contact_|social_|seo_|site_|anim_)/, '');
    if (input.type === 'checkbox') {
      data[key] = input.checked;
    } else if (input.type === 'number' || input.type === 'range') {
      data[key] = parseFloat(input.value);
    } else {
      data[key] = input.value;
    }
  });
  return data;
}

// Switch Active Tab
function switchToTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + tabName);
  });

  const titleMap = {
    dashboard: 'Dashboard Overview',
    home: 'Home Section Settings',
    menu: 'Menu Management (CRUD)',
    gallery: 'Gallery Mosaic Management',
    about: 'About Section Settings',
    location: 'Location & Google Maps',
    contact: 'Contact & Phone Numbers',
    social: 'Social Media (TikTok Only)',
    seo: 'SEO & Structured Metadata',
    settings: 'Site & Brand Settings',
    animations: 'Animation & Effect Controls'
  };
  pageTitle.textContent = titleMap[tabName] || 'Dashboard';
  document.getElementById('sidebar').classList.remove('open');
}

// Populate Forms from Data
function populateAllForms() {
  const d = state.adminData;
  if (!d) return;

  // Hero
  setVal('hero_title_main', d.hero_settings?.title_main);
  setVal('hero_cafe_tag', d.hero_settings?.cafe_tag);
  setVal('hero_kicker_en', d.hero_settings?.kicker_en);
  setVal('hero_kicker_ar', d.hero_settings?.kicker_ar);
  setVal('hero_tagline_en', d.hero_settings?.tagline_en);
  setVal('hero_tagline_ar', d.hero_settings?.tagline_ar);
  setVal('hero_cta_text', d.hero_settings?.cta_text);
  setVal('hero_cta_link', d.hero_settings?.cta_link);
  setVal('hero_bg_image', d.hero_settings?.bg_image);

  // Visibility
  setCheck('vis_hero', d.section_visibility?.hero);
  setCheck('vis_marquee', d.section_visibility?.marquee);
  setCheck('vis_about', d.section_visibility?.about);
  setCheck('vis_menu', d.section_visibility?.menu);
  setCheck('vis_gallery', d.section_visibility?.gallery);
  setCheck('vis_location', d.section_visibility?.location);
  setCheck('vis_contact', d.section_visibility?.contact);

  // About
  setVal('about_eyebrow_en', d.about_settings?.eyebrow_en);
  setVal('about_eyebrow_ar', d.about_settings?.eyebrow_ar);
  setVal('about_title_en', d.about_settings?.title_en);
  setVal('about_title_ar', d.about_settings?.title_ar);
  setVal('about_copy_en_1', d.about_settings?.copy_en_1);
  setVal('about_copy_ar_1', d.about_settings?.copy_ar_1);
  setVal('about_copy_en_2', d.about_settings?.copy_en_2);
  setVal('about_copy_ar_2', d.about_settings?.copy_ar_2);
  setVal('about_image_url', d.about_settings?.image_url);
  setVal('about_image_tag_en', d.about_settings?.image_tag_en);
  setVal('about_image_tag_ar', d.about_settings?.image_tag_ar);

  // Location
  setVal('loc_address_en', d.location_settings?.address_en);
  setVal('loc_address_ar', d.location_settings?.address_ar);
  setVal('loc_note_en', d.location_settings?.note_en);
  setVal('loc_note_ar', d.location_settings?.note_ar);
  setVal('loc_maps_url', d.location_settings?.maps_url);
  setVal('loc_directions_url', d.location_settings?.directions_url);

  // Contact
  setVal('contact_phone_1', d.contact_settings?.phone_1);
  setVal('contact_phone_2', d.contact_settings?.phone_2);
  setVal('contact_hours_en', d.contact_settings?.hours_en);
  setVal('contact_hours_ar', d.contact_settings?.hours_ar);

  // Social
  setVal('social_tiktok_url', d.social_settings?.tiktok_url);
  setVal('social_tiktok_handle', d.social_settings?.tiktok_handle);

  // SEO
  setVal('seo_page_title', d.seo_settings?.page_title);
  setVal('seo_meta_description', d.seo_settings?.meta_description);
  setVal('seo_og_title', d.seo_settings?.og_title);
  setVal('seo_og_description', d.seo_settings?.og_description);
  setVal('seo_og_image', d.seo_settings?.og_image);
  setVal('seo_favicon', d.seo_settings?.favicon);

  // Site
  setVal('site_cafe_name', d.site_settings?.cafe_name);
  setVal('site_logo_url', d.site_settings?.logo_url);
  setVal('site_primary_color', d.site_settings?.primary_color);
  setVal('site_background_color', d.site_settings?.background_color);
  setVal('site_footer_copyright', d.site_settings?.footer_copyright);
  setVal('site_developer_label', d.site_settings?.developer_label);
  setVal('site_developer_logo', d.site_settings?.developer_logo);

  // Animations
  setCheck('anim_parallax_enabled', d.animation_settings?.parallax_enabled);
  setCheck('anim_zoom_enabled', d.animation_settings?.zoom_enabled);
  setCheck('anim_marquee_enabled', d.animation_settings?.marquee_enabled);
  setCheck('anim_reveal_enabled', d.animation_settings?.reveal_enabled);
  setCheck('anim_reduced_motion', d.animation_settings?.reduced_motion);
  setVal('anim_intensity', d.animation_settings?.intensity || 1.0);
  document.getElementById('animIntensityVal').textContent = d.animation_settings?.intensity || 1.0;

  // Populate Categories Select Filters
  populateCategorySelects();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.value = val;
}

function setCheck(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.checked = !!val;
}

// Populate Category Options
function populateCategorySelects() {
  const filter = document.getElementById('menuCategoryFilter');
  const modalSelect = document.getElementById('modalMenuCategory');
  const categories = state.adminData.menu_categories || [];

  filter.innerHTML = '<option value="all">All Categories</option>';
  modalSelect.innerHTML = '';

  categories.forEach(cat => {
    filter.innerHTML += `<option value="${cat.key}">${cat.en} (${cat.ar})</option>`;
    modalSelect.innerHTML += `<option value="${cat.key}">${cat.en} (${cat.ar})</option>`;
  });
}

// Render Stats
function renderStats() {
  const menuCount = state.adminData.menu_items ? state.adminData.menu_items.length : 0;
  const galleryCount = state.adminData.gallery_items ? state.adminData.gallery_items.length : 0;
  document.getElementById('statMenuItems').textContent = menuCount;
  document.getElementById('statGalleryItems').textContent = galleryCount;
}

// Render Menu Table
function renderMenuList() {
  const tbody = document.getElementById('menuTableBody');
  const catFilter = document.getElementById('menuCategoryFilter').value;
  const search = document.getElementById('menuSearch').value.toLowerCase();
  const categoriesMap = {};
  (state.adminData.menu_categories || []).forEach(c => categoriesMap[c.key] = c.ar);

  let items = state.adminData.menu_items || [];
  if (catFilter !== 'all') {
    items = items.filter(i => i.category_key === catFilter);
  }
  if (search) {
    items = items.filter(i => (i.name_ar && i.name_ar.toLowerCase().includes(search)) || (i.name_en && i.name_en.toLowerCase().includes(search)));
  }

  items.sort((a, b) => a.sort_order - b.sort_order);

  tbody.innerHTML = '';
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--cream-dim); padding:20px;">No menu items found</td></tr>`;
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ar-input"><strong>${escapeHtml(item.name_ar)}</strong></td>
      <td>${escapeHtml(item.name_en || '—')}</td>
      <td><span class="user-badge">${categoriesMap[item.category_key] || item.category_key}</span></td>
      <td><strong style="color:var(--gold);">${item.price} EGP</strong></td>
      <td>${item.sort_order}</td>
      <td>${item.visible !== false ? '<span style="color:var(--success);">✓ Yes</span>' : '<span style="color:var(--danger);">✕ Hidden</span>'}</td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editMenuItem('${item.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteMenuItem('${item.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Edit Menu Item
function editMenuItem(id) {
  const item = state.adminData.menu_items.find(i => i.id === id);
  if (!item) return;

  state.editingMenuItemId = id;
  document.getElementById('modalMenuTitle').textContent = 'Edit Menu Item';
  document.getElementById('menuItemId').value = item.id;
  document.getElementById('modalMenuCategory').value = item.category_key;
  document.getElementById('modalMenuNameAr').value = item.name_ar;
  document.getElementById('modalMenuNameEn').value = item.name_en || '';
  document.getElementById('modalMenuPrice').value = item.price;
  document.getElementById('modalMenuSort').value = item.sort_order;
  document.getElementById('modalMenuVisible').checked = item.visible !== false;

  document.getElementById('menuItemModal').style.display = 'flex';
}

function openMenuItemModal() {
  state.editingMenuItemId = null;
  document.getElementById('modalMenuTitle').textContent = 'Add New Menu Item';
  document.getElementById('formMenuItem').reset();
  document.getElementById('menuItemId').value = '';
  document.getElementById('menuItemModal').style.display = 'flex';
}

function closeMenuItemModal() {
  document.getElementById('menuItemModal').style.display = 'none';
}

function confirmDeleteMenuItem(id) {
  const item = state.adminData.menu_items.find(i => i.id === id);
  if (!item) return;

  document.getElementById('confirmModalText').textContent = `Are you sure you want to delete "${item.name_ar}" (${item.price} EGP)?`;
  state.confirmDeleteCallback = async () => {
    const res = await fetch(`/api/admin/menu/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Item deleted');
      closeConfirmModal();
      await loadAdminData();
    } else {
      showToast('Failed to delete item', 'error');
    }
  };
  document.getElementById('confirmModal').style.display = 'flex';
}

// Render Gallery Admin
function renderGalleryList() {
  const grid = document.getElementById('galleryAdminGrid');
  const items = state.adminData.gallery_items || [];
  items.sort((a, b) => a.sort_order - b.sort_order);

  grid.innerHTML = '';
  items.forEach(g => {
    const card = document.createElement('div');
    card.className = 'gallery-admin-card';
    card.innerHTML = `
      <img src="../${g.image_url}" alt="${escapeHtml(g.title_en)}" onerror="this.src='../images/rustic-roast-cafe-logo.png'" />
      <div class="gallery-admin-details">
        <div class="en">${escapeHtml(g.title_en || 'Gallery Image')}</div>
        <div class="ar">${escapeHtml(g.title_ar || '')}</div>
      </div>
      <div class="gallery-admin-actions">
        <button class="btn btn-outline btn-sm" onclick="editGalleryItem('${g.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeleteGalleryItem('${g.id}')">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function openGalleryModal() {
  state.editingGalleryItemId = null;
  document.getElementById('modalGalleryTitle').textContent = 'Add Gallery Image';
  document.getElementById('formGalleryItem').reset();
  document.getElementById('galleryItemId').value = '';
  document.getElementById('galleryModal').style.display = 'flex';
}

function editGalleryItem(id) {
  const item = state.adminData.gallery_items.find(g => g.id === id);
  if (!item) return;

  state.editingGalleryItemId = id;
  document.getElementById('modalGalleryTitle').textContent = 'Edit Gallery Image';
  document.getElementById('galleryItemId').value = item.id;
  document.getElementById('modalGalleryUrl').value = item.image_url;
  document.getElementById('modalGalleryTitleEn').value = item.title_en || '';
  document.getElementById('modalGalleryTitleAr').value = item.title_ar || '';
  document.getElementById('modalGallerySort').value = item.sort_order || 1;
  document.getElementById('modalGalleryVisible').checked = item.visible !== false;

  document.getElementById('galleryModal').style.display = 'flex';
}

function closeGalleryModal() {
  document.getElementById('galleryModal').style.display = 'none';
}

function confirmDeleteGalleryItem(id) {
  document.getElementById('confirmModalText').textContent = `Are you sure you want to delete this gallery photo?`;
  state.confirmDeleteCallback = async () => {
    const res = await fetch(`/api/admin/gallery/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Gallery image deleted');
      closeConfirmModal();
      await loadAdminData();
    } else {
      showToast('Failed to delete image', 'error');
    }
  };
  document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (state.confirmDeleteCallback) {
    state.confirmDeleteCallback();
  }
});

// File Upload Helper
function setupFileUploader(fileInputId, targetInputId) {
  const fileInput = document.getElementById(fileInputId);
  if (!fileInput) return;
  fileInput.addEventListener('change', async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
      showToast('Uploading image...');
      const res = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        document.getElementById(targetInputId).value = data.url;
        showToast('Image uploaded successfully!');
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Image upload failed', 'error');
    }
  });
}

// Toast Notifications
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}
