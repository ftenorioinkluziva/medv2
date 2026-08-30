// App State
const state = {
  profile: null,
  documents: [],
  analyses: [],
  structuredBiomarkers: [],
  settings: { hasKey: false, modelExtraction: '', modelAnalysis: '' },
  activeAnalysisId: null, // Selected analysis (can be history)
  pendingFile: null
};

const authScreen = document.getElementById('auth-screen');
const authForm = document.getElementById('auth-form');
const authToggle = document.getElementById('auth-toggle');
const authSubmit = document.getElementById('auth-submit');
const authError = document.getElementById('auth-error');
const authName = document.getElementById('auth-name');
const authNameLabel = document.getElementById('auth-name-label');
const authTitle = document.getElementById('auth-title');
const authDescription = document.getElementById('auth-description');
let authMode = 'sign-in';

// DOM Elements
const views = {
  dashboard: document.getElementById('view-dashboard'),
  labs: document.getElementById('view-labs'),
  scores: document.getElementById('view-scores'),
  profile: document.getElementById('view-profile'),
  history: document.getElementById('view-history'),
  planDetail: document.getElementById('view-plan-detail')
};

// Custom Selects
const selectLens = document.getElementById('select-lens');
const inputLensLongevidade = document.getElementById('input-lens-longevidade');
const inputLensConvencional = document.getElementById('input-lens-convencional');
const inputLensPerformance = document.getElementById('input-lens-performance');

// Navigation triggers
const navDashboardLogo = document.getElementById('nav-dashboard-logo');
const linkGoProfile = document.getElementById('link-go-profile');
const linkViewAllDocs = document.getElementById('link-view-all-docs');
const btnHistoryBack = document.getElementById('btn-history-back');
const btnDetailBack = document.getElementById('btn-detail-back');
const btnSyncOpenGym = document.getElementById('btn-sync-opengym');

// Settings Elements
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const settingsForm = document.getElementById('settings-form');
const inputApiKey = document.getElementById('input-api-key');
const selectModelExt = document.getElementById('select-model-extraction');
const selectModelAnl = document.getElementById('select-model-analysis');
const apiKeyWarning = document.getElementById('api-key-warning');
const btnWarningConfig = document.getElementById('btn-warning-config');

// Profile Form Elements
const profileForm = document.getElementById('profile-form');
const btnCancelProfile = document.getElementById('btn-cancel-profile');
const inputIdade = document.getElementById('input-idade');
const inputSexo = document.getElementById('input-sexo');
const inputAltura = document.getElementById('input-altura');
const inputPeso = document.getElementById('input-peso');
const profileImcValue = document.getElementById('profile-imc-value');

// Upload Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const uploadDialog = document.getElementById('upload-dialog');
const uploadFileName = document.getElementById('upload-file-name');
const selectDocType = document.getElementById('select-doc-type');
const btnCancelUpload = document.getElementById('btn-cancel-upload');
const btnSubmitUpload = document.getElementById('btn-submit-upload');
const uploadLoading = document.getElementById('upload-loading');
const documentsContainer = document.getElementById('documents-container');

// Dashboard Info Displays
const headerPatientName = document.getElementById('header-patient-name');
const patientNameDisplay = document.getElementById('patient-name-display');
const patientAgeSex = document.getElementById('patient-age-sex');
const metricAltura = document.getElementById('metric-altura');
const metricPeso = document.getElementById('metric-peso');
const metricMassaMagra = document.getElementById('metric-massa-magra');
const metricImc = document.getElementById('metric-imc');
const badgeImcClass = document.getElementById('badge-imc-class');
const metricInbodyScore = document.getElementById('metric-inbody-score');
const statusAnalysisDate = document.getElementById('status-analysis-date');
const statusSummaryText = document.getElementById('status-summary-text');
const plansAnalysisDate = document.getElementById('plans-analysis-date');

// Plans Cards
const planCardSuplementacao = document.getElementById('plan-card-suplementacao');
const planCardAlimentar = document.getElementById('plan-card-alimentar');
const planCardTreino = document.getElementById('plan-card-treino');
const planDateSuplementacao = document.getElementById('plan-date-suplementacao');
const planDateAlimentar = document.getElementById('plan-date-alimentar');
const planDateTreino = document.getElementById('plan-date-treino');

// History View Panels
const analysesHistoryList = document.getElementById('analyses-history-list');
const allDocumentsList = document.getElementById('all-documents-list');

// Detail View Panel
const detailDate = document.getElementById('detail-date');
const inlineDetailSlot = document.getElementById('dashboard-detail-slot');
const inlineDetailDate = document.getElementById('inline-detail-date');
const detailContainer = document.querySelector('#view-plan-detail .detail-container');
const detailPanels = {
  status: document.getElementById('panel-det-status'),
  insights: document.getElementById('panel-det-insights'),
  supl: document.getElementById('panel-det-supl'),
  nutri: document.getElementById('panel-det-nutri'),
  treino: document.getElementById('panel-det-treino')
};
const detailTabs = {
  status: document.getElementById('btn-tab-det-status'),
  insights: document.getElementById('btn-tab-det-insights'),
  supl: document.getElementById('btn-tab-det-supl'),
  nutri: document.getElementById('btn-tab-det-nutri'),
  treino: document.getElementById('btn-tab-det-treino')
};
const detStatusContent = document.getElementById('det-status-content');
const detStatusExameRef = document.getElementById('det-status-exame-ref');
const supplementsContainer = document.getElementById('supplements-container');
const detNutriContent = document.getElementById('det-nutri-content');
const detTreinoContent = document.getElementById('det-treino-content');

// Active Analysis Bar Elements
const activeAnalysisBar = document.getElementById('active-analysis-bar');
const selectActiveAnalysis = document.getElementById('select-active-analysis');
const btnResetLatest = document.getElementById('btn-reset-latest');

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
  setupAuthHandlers();
  const session = await loadSession();
  if (!session) return;
  document.querySelector('.app-container').classList.remove('hidden');
  setupViewNavigation();
  setupSettingsHandlers();
  setupProfileHandlers();
  setupUploadHandlers();
  if (inlineDetailSlot && detailContainer) {
    inlineDetailSlot.appendChild(detailContainer);
  }
  setupDetailTabHandlers();
  
  // Load Initial Data
  await loadSettings();
  await loadProfile();
  await loadDocuments();
  await loadAnalyses();
  
  // Render Dashboard
  renderDashboard();
  if (state.activeAnalysisId) openPlanDetails('status');
});

async function loadSession() {
  try {
    const response = await fetch('/api/auth/get-session', { credentials: 'include' });
    const session = await response.json();
    if (!session) {
      authScreen.classList.remove('hidden');
      document.querySelector('.app-container').classList.add('hidden');
      return null;
    }
    authScreen.classList.add('hidden');
    return session;
  } catch {
    authScreen.classList.remove('hidden');
    document.querySelector('.app-container').classList.add('hidden');
    authError.textContent = 'Não foi possível verificar a sessão.';
    return null;
  }
}

function setupAuthHandlers() {
  authToggle.addEventListener('click', () => {
    authMode = authMode === 'sign-in' ? 'sign-up' : 'sign-in';
    const signup = authMode === 'sign-up';
    authName.classList.toggle('hidden', !signup);
    authNameLabel.classList.toggle('hidden', !signup);
    authName.required = signup;
    authTitle.textContent = signup ? 'Crie seu acesso ao MedV2' : 'Acesse o MedV2';
    authDescription.textContent = signup ? 'Crie uma conta para guardar seus dados com segurança.' : 'Entre para consultar seu perfil, exames e análises.';
    authSubmit.textContent = signup ? 'Criar conta' : 'Entrar';
    authToggle.textContent = signup ? 'Já tenho uma conta' : 'Criar uma conta';
    authError.textContent = '';
  });
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authError.textContent = '';
    authSubmit.disabled = true;
    try {
      const endpoint = authMode === 'sign-up' ? '/api/auth/sign-up/email' : '/api/auth/sign-in/email';
      const body = { email: document.getElementById('auth-email').value.trim(), password: document.getElementById('auth-password').value };
      if (authMode === 'sign-up') body.name = authName.value.trim();
      const response = await fetch(endpoint, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || payload.error?.message || 'Não foi possível autenticar.');
      }
      window.location.reload();
    } catch (error) {
      authError.textContent = error.message;
    } finally {
      authSubmit.disabled = false;
    }
  });
}

// --- API FETCH HELPERS ---
async function apiFetch(url, options = {}) {
  try {
    const response = await fetch(url, { credentials: 'include', ...options });
    if (response.status === 401 || response.status === 403) {
      authScreen.classList.remove('hidden');
      document.querySelector('.app-container').classList.add('hidden');
      throw new Error('Sua sessão expirou. Entre novamente.');
    }
    const result = await response.json();
    if (!result.success) {
      const operationError = result.error || {};
      const error = new Error(operationError.message || operationError || "Algo deu errado na requisição.");
      error.code = operationError.code;
      error.retryable = operationError.retryable;
      throw error;
    }
    return result;
  } catch (err) {
    console.error(`API Error for ${url}:`, err);
    alert(err.message);
    throw err;
  }
}

// --- DATA LOADING & STATE SYNC ---
async function loadSettings() {
  const res = await apiFetch('/api/settings');
  state.settings = res.settings;
  if (!state.settings.hasKey) {
    apiKeyWarning.classList.remove('hidden');
  } else {
    apiKeyWarning.classList.add('hidden');
  }
  // Fill settings inputs
  inputApiKey.value = state.settings.openrouterApiKey || '';
  selectModelExt.value = state.settings.modelExtraction || 'google/gemini-2.5-flash';
  selectModelAnl.value = state.settings.modelAnalysis || 'google/gemini-2.5-pro';
  if (selectLens) selectLens.value = state.settings.lens || 'longevidade';
  if (inputLensLongevidade) inputLensLongevidade.value = state.settings.lensLongevidade || '';
  if (inputLensConvencional) inputLensConvencional.value = state.settings.lensConvencional || '';
  if (inputLensPerformance) inputLensPerformance.value = state.settings.lensPerformance || '';
}

async function loadProfile() {
  const res = await apiFetch('/api/profile');
  state.profile = res.profile;
  syncProfileToForm();
}

async function loadDocuments() {
  const res = await apiFetch('/api/documents');
  state.documents = res.documents;
  renderDocumentsList();
}

async function loadAnalyses() {
  const res = await apiFetch('/api/analyses');
  state.analyses = res.analyses;
  try {
    const structuredResponse = await fetch('/api/biomarkers/history', { credentials: 'include' });
    const structuredPayload = structuredResponse.ok ? await structuredResponse.json() : null;
    state.structuredBiomarkers = structuredPayload?.success ? structuredPayload.biomarkers : [];
  } catch {
    state.structuredBiomarkers = [];
  }
  
  if (state.analyses.length > 0) {
    // Default to the first (latest) analysis if not already set or invalid
    if (!state.activeAnalysisId || !state.analyses.some(a => a.id === state.activeAnalysisId)) {
      state.activeAnalysisId = state.analyses[0].id;
    }
    activeAnalysisBar.classList.remove('hidden');
    renderAnalysisDropdown();
  } else {
    state.activeAnalysisId = null;
    activeAnalysisBar.classList.add('hidden');
  }
}

// --- VIEW NAVIGATION ---
function showView(viewId) {
  Object.keys(views).forEach(key => {
    if (key === viewId) {
      views[key].classList.add('active');
    } else {
      views[key].classList.remove('active');
    }
  });

  // Update active status on sub-header navigation buttons
  ['dashboard', 'labs', 'scores', 'profile', 'history'].forEach(id => {
    const el = document.getElementById(`nav-${id}`);
    if (el) {
      if (id === viewId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });
  
  // Specific view transitions
  if (viewId === 'dashboard') {
    renderDashboard();
  } else if (viewId === 'labs') {
    initLabsView();
  } else if (viewId === 'scores') {
    renderScoresView();
  } else if (viewId === 'profile') {
    syncProfileToForm();
  } else if (viewId === 'history') {
    renderHistoryView();
  }
  
  // Scroll to top
  window.scrollTo({ top: 0 });
}

function setupViewNavigation() {
  navDashboardLogo.addEventListener('click', () => showView('dashboard'));
  
  // Tab buttons bindings
  const navDashboard = document.getElementById('nav-dashboard');
  const navLabs = document.getElementById('nav-labs');
  const navScores = document.getElementById('nav-scores');
  const navProfile = document.getElementById('nav-profile');
  const navHistory = document.getElementById('nav-history');
  
  if (navDashboard) navDashboard.addEventListener('click', () => showView('dashboard'));
  if (navLabs) navLabs.addEventListener('click', () => showView('labs'));
  if (navScores) navScores.addEventListener('click', () => showView('scores'));
  if (navProfile) navProfile.addEventListener('click', () => showView('profile'));
  if (navHistory) navHistory.addEventListener('click', () => showView('history'));

  const cardScores = document.getElementById('card-health-scores');
  if (cardScores) {
    cardScores.addEventListener('click', () => {
      showView('scores');
    });
  }

  linkGoProfile.addEventListener('click', (e) => {
    e.preventDefault();
    showView('profile');
  });
  linkViewAllDocs.addEventListener('click', (e) => {
    e.preventDefault();
    showView('history');
  });
  btnHistoryBack.addEventListener('click', () => showView('dashboard'));
  btnDetailBack.addEventListener('click', () => showView('dashboard'));
  if (btnSyncOpenGym) {
    btnSyncOpenGym.addEventListener('click', () => {
      window.open('http://localhost:8080/#/settings', '_blank');
    });
  }
  
  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (confirm("Deseja sair do aplicativo?")) {
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
      window.location.reload();
    }
  });
}

// --- SETTINGS CONTROLS ---
function setupSettingsHandlers() {
  btnSettings.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });
  
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  btnCancelSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  btnWarningConfig.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await apiFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelExtraction: selectModelExt.value,
        modelAnalysis: selectModelAnl.value,
        lens: selectLens ? selectLens.value : 'longevidade',
        lensLongevidade: inputLensLongevidade ? inputLensLongevidade.value.trim() : undefined,
        lensConvencional: inputLensConvencional ? inputLensConvencional.value.trim() : undefined,
        lensPerformance: inputLensPerformance ? inputLensPerformance.value.trim() : undefined
      })
    });
    
    settingsModal.classList.add('hidden');
    await loadSettings();
    alert("Configurações atualizadas!");
  });
}

// --- PROFILE TABS & UPDATE ---
function setupProfileSelects() {
  if (!profileForm) return;

  const closeSelect = (control, returnFocus = false) => {
    const trigger = control.querySelector('.custom-select-trigger');
    const menu = control.querySelector('.custom-select-menu');
    control.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    if (returnFocus) trigger.focus();
  };

  const closeOtherSelects = (currentControl) => {
    profileForm.querySelectorAll('.custom-select.is-open').forEach(control => {
      if (control !== currentControl) closeSelect(control);
    });
  };

  profileForm.querySelectorAll('select').forEach(select => {
    if (select.dataset.enhancedSelect === 'true') return;

    const control = document.createElement('div');
    const trigger = document.createElement('button');
    const value = document.createElement('span');
    const caret = document.createElement('span');
    const menu = document.createElement('div');
    const menuId = `${select.id}-options`;
    const fieldLabel = profileForm.querySelector(`label[for="${select.id}"]`);

    control.className = 'custom-select';
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'custom-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menuId);
    trigger.setAttribute('aria-label', fieldLabel?.textContent?.trim() || select.name || 'Selecionar opção');

    value.className = 'custom-select-value';
    caret.className = 'custom-select-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '⌄';
    trigger.append(value, caret);

    menu.id = menuId;
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', fieldLabel?.textContent?.trim() || select.name || 'Opções');
    menu.hidden = true;

    select.parentNode.insertBefore(control, select);
    control.append(select, trigger, menu);
    select.classList.add('native-select-proxy');
    select.dataset.enhancedSelect = 'true';
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    if (fieldLabel) fieldLabel.htmlFor = trigger.id;

    const sync = () => {
      value.textContent = select.selectedOptions[0]?.textContent || 'Selecione...';
      trigger.disabled = select.disabled;
      menu.querySelectorAll('.custom-select-option').forEach((optionButton, index) => {
        const selected = index === select.selectedIndex;
        optionButton.classList.toggle('is-selected', selected);
        optionButton.setAttribute('aria-selected', String(selected));
      });
    };

    Array.from(select.options).forEach((option, index) => {
      const optionButton = document.createElement('button');
      optionButton.type = 'button';
      optionButton.className = 'custom-select-option';
      optionButton.setAttribute('role', 'option');
      optionButton.dataset.optionIndex = String(index);
      optionButton.textContent = option.textContent;
      optionButton.disabled = option.disabled;

      optionButton.addEventListener('click', () => {
        select.selectedIndex = index;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync();
        closeSelect(control, true);
      });

      optionButton.addEventListener('keydown', event => {
        const enabledOptions = Array.from(menu.querySelectorAll('.custom-select-option:not(:disabled)'));
        const currentIndex = enabledOptions.indexOf(optionButton);
        let target;

        if (event.key === 'ArrowDown') target = enabledOptions[currentIndex + 1] || enabledOptions[0];
        if (event.key === 'ArrowUp') target = enabledOptions[currentIndex - 1] || enabledOptions.at(-1);
        if (event.key === 'Home') target = enabledOptions[0];
        if (event.key === 'End') target = enabledOptions.at(-1);
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSelect(control, true);
          return;
        }

        if (target) {
          event.preventDefault();
          target.focus();
        }
      });

      menu.appendChild(optionButton);
    });

    trigger.addEventListener('click', () => {
      const shouldOpen = !control.classList.contains('is-open');
      closeOtherSelects(control);
      if (!shouldOpen) {
        closeSelect(control);
        return;
      }

      control.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
    });

    trigger.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      closeOtherSelects(control);
      control.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      menu.hidden = false;
      const selectedOption = menu.querySelector('.custom-select-option.is-selected:not(:disabled)');
      const fallbackOption = menu.querySelector('.custom-select-option:not(:disabled)');
      (selectedOption || fallbackOption)?.focus();
    });

    select.addEventListener('change', sync);
    control.syncFromNativeSelect = sync;
    sync();
  });

  document.addEventListener('click', event => {
    if (event.target.closest('.custom-select')) return;
    profileForm.querySelectorAll('.custom-select.is-open').forEach(control => closeSelect(control));
  });
}

function syncProfileSelects() {
  profileForm?.querySelectorAll('.custom-select').forEach(control => {
    control.syncFromNativeSelect?.();
  });
}

function setupProfileHandlers() {
  const tabButtons = document.querySelectorAll('.profile-tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  setupProfileSelects();
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Calculate IMC dynamically
  [inputAltura, inputPeso].forEach(input => {
    input.addEventListener('input', () => {
      const height = parseFloat(inputAltura.value) / 100;
      const weight = parseFloat(inputPeso.value);
      if (height > 0 && weight > 0) {
        const imc = (weight / (height * height)).toFixed(1);
        profileImcValue.textContent = imc;
      } else {
        profileImcValue.textContent = '--';
      }
    });
  });

  btnCancelProfile.addEventListener('click', () => showView('dashboard'));

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(profileForm);
    const data = {};
    formData.forEach((value, key) => {
      // Convert numbers
      if (['idade', 'altura', 'peso', 'cardioSistolica', 'cardioDiastolica', 'cardioFcRepouso', 'sonoHoras', 'sonoQualidade', 'sonoTempoCama', 'aguaDia', 'nivelEstresse', 'perfForcaPreensao', 'perfSentarLevantar', 'perfVo2Max', 'perfToleranciaCo2'].includes(key)) {
        data[key] = value ? parseFloat(value) : null;
      } else {
        data[key] = value;
      }
    });
    
    // Calculate final IMC
    if (data.altura && data.peso) {
      data.imc = parseFloat((data.peso / ((data.altura / 100) * (data.altura / 100))).toFixed(1));
    }
    
    // Copy remaining scores if they weren't in basic form inputs
    data.massaMagra = state.profile.massaMagra;
    data.inbodyScore = state.profile.inbodyScore;
    
    await apiFetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    await loadProfile();
    showView('dashboard');
    alert("Perfil updated!");
  });

  // Connect checkboxes to hidden inputs for serialization
  const setupCheckboxGroup = (checkboxClass, hiddenInputId) => {
    const checkboxes = document.querySelectorAll(checkboxClass);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!hiddenInput) return;
    
    const updateHiddenField = () => {
      const selected = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      hiddenInput.value = selected.join(', ');
    };
    
    checkboxes.forEach(cb => {
      cb.addEventListener('change', updateHiddenField);
    });
  };
  
  setupCheckboxGroup('.restriction-cb', 'hidden-dietary-restrictions');
  setupCheckboxGroup('.dietchange-cb', 'hidden-recent-diet-changes');
  setupCheckboxGroup('.sensitivity-cb', 'hidden-food-sensitivities');
  setupCheckboxGroup('.exercise-type-cb', 'hidden-exercise-types');
  setupCheckboxGroup('.recovery-limit-cb', 'hidden-limitations-and-recovery');
}

function syncProfileToForm() {
  if (!state.profile) return;
  
  // Fill all form inputs
  Object.keys(state.profile).forEach(key => {
    const input = profileForm.querySelector(`[name="${key}"]`);
    if (input) {
      input.value = state.profile[key] !== null ? state.profile[key] : '';
    }
  });
  
  // Sync checkbox states from hidden inputs
  const syncCheckboxes = (hiddenInputId, checkboxClass) => {
    const hiddenInput = document.getElementById(hiddenInputId);
    if (!hiddenInput) return;
    const hiddenVal = hiddenInput.value || '';
    const values = hiddenVal.split(',').map(s => s.trim()).filter(Boolean);
    const checkboxes = document.querySelectorAll(checkboxClass);
    checkboxes.forEach(cb => {
      cb.checked = values.includes(cb.value);
    });
  };
  
  syncCheckboxes('hidden-dietary-restrictions', '.restriction-cb');
  syncCheckboxes('hidden-recent-diet-changes', '.dietchange-cb');
  syncCheckboxes('hidden-food-sensitivities', '.sensitivity-cb');
  syncCheckboxes('hidden-exercise-types', '.exercise-type-cb');
  syncCheckboxes('hidden-limitations-and-recovery', '.recovery-limit-cb');
  
  profileImcValue.textContent = state.profile.imc || '--';
  
  // Update Header greeting
  const patientName = state.profile.nome || 'patient';
  headerPatientName.textContent = patientName;
  patientNameDisplay.textContent = patientName;
  
  // Update avatar initial
  document.querySelector('.profile-avatar').textContent = patientName.charAt(0).toUpperCase();
  document.getElementById('profile-name-text').textContent = patientName;
  document.getElementById('profile-email-text').textContent = patientName.toLowerCase().replace(/\s+/g, '') + '@sami.local';
  syncProfileSelects();
}

// --- DOCUMENT UPLOADS ---
function setupUploadHandlers() {
  // Dropzone click triggers input click
  dropzone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', handleFileSelection);
  
  // Drag and drop handlers
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--accent-orange)';
    dropzone.style.background = 'rgba(255, 140, 0, 0.04)';
  });
  
  ['dragleave', 'dragend'].forEach(type => {
    dropzone.addEventListener(type, () => {
      dropzone.style.borderColor = 'var(--border-color)';
      dropzone.style.background = 'rgba(10, 10, 12, 0.3)';
    });
  });
  
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--border-color)';
    dropzone.style.background = 'rgba(10, 10, 12, 0.3)';
    
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        fileInput.files = e.dataTransfer.files;
        handleFileSelection();
      } else {
        alert("Apenas arquivos PDF são aceitos.");
      }
    }
  });

  btnCancelUpload.addEventListener('click', () => {
    state.pendingFile = null;
    uploadDialog.classList.add('hidden');
    fileInput.value = '';
  });

  btnSubmitUpload.addEventListener('click', async () => {
    if (!state.pendingFile) return;
    
    if (!state.settings.hasKey) {
      alert("O servidor ainda não tem OPENROUTER_API_KEY configurada.");
      return;
    }

    const type = selectDocType.value;
    const formData = new FormData();
    formData.append('pdf', state.pendingFile);
    formData.append('docType', type);
    
    uploadLoading.classList.remove('hidden');
    uploadDialog.classList.add('hidden');
    
    try {
      const res = await fetch('/api/upload-document', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: formData
      });
      const result = await res.json();
      
      if (!result.success) {
        const operationError = result.error || {};
        const error = new Error(operationError.message || operationError || "Erro ao processar laudo.");
        error.code = operationError.code;
        error.retryable = operationError.retryable;
        throw error;
      }
      
      alert(result.message);
      
      // Update state data
      await loadProfile();
      await loadDocuments();
      await loadAnalyses();
      
      state.pendingFile = null;
      fileInput.value = '';
      
      // If blood test was uploaded, keep the detailed analysis on the dashboard
      if (type === 'blood-test' && result.analysis) {
        state.activeAnalysisId = result.analysis.id;
        openPlanDetails('status');
      } else {
        renderDashboard();
      }
      
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro no processamento: " + err.message);
    } finally {
      uploadLoading.classList.add('hidden');
    }
  });
}

function handleFileSelection() {
  if (fileInput.files.length > 0) {
    state.pendingFile = fileInput.files[0];
    uploadFileName.textContent = state.pendingFile.name;
    
    // Prefill dialog type based on file name contents
    const nameLower = state.pendingFile.name.toLowerCase();
    if (nameLower.includes('bio') || nameLower.includes('inbody') || nameLower.includes('impedance')) {
      selectDocType.value = 'bioimpedance';
    } else {
      selectDocType.value = 'blood-test';
    }
    
    uploadDialog.classList.remove('hidden');
  }
}

// --- RENDER FUNCTIONS ---

function renderDashboard() {
  if (!state.profile) return;
  
  // Patient details
  const name = state.profile.nome || 'patient';
  patientNameDisplay.textContent = name;
  patientAgeSex.textContent = `${state.profile.idade} anos • ${state.profile.sexo}`;
  
  // Corporal indicators
  metricAltura.textContent = state.profile.altura || '--';
  metricPeso.textContent = state.profile.peso || '--';
  metricMassaMagra.textContent = state.profile.massaMagra || '--';
  metricImc.textContent = state.profile.imc || '--';
  
  // IMC Class Badge styling
  const badge = badgeImcClass;
  if (state.profile.imc) {
    const val = state.profile.imc;
    badge.classList.remove('hidden', 'badge-normal', 'badge-warning', 'badge-danger');
    if (val < 18.5) {
      badge.textContent = "Abaixo do Peso";
      badge.classList.add('badge-warning');
    } else if (val < 25) {
      badge.textContent = "Normal";
      badge.classList.add('badge-normal');
    } else if (val < 30) {
      badge.textContent = "Sobrepeso";
      badge.classList.add('badge-warning');
    } else {
      badge.textContent = "Obesidade";
      badge.classList.add('badge-danger');
    }
  } else {
    badge.classList.add('hidden');
  }
  
  if (metricInbodyScore) {
    metricInbodyScore.textContent = state.profile.inbodyScore ? `${state.profile.inbodyScore}` : '--';
  }
  
  // Find current active analysis in state
  const activeAnalysis = state.analyses.find(a => a.id === state.activeAnalysisId);
  
  if (activeAnalysis) {
    const formattedDate = formatDateString(activeAnalysis.date);
    statusAnalysisDate.textContent = formattedDate;
    statusSummaryText.innerHTML = parseMarkdown(activeAnalysis.healthStatus);
    inlineDetailSlot?.classList.remove('hidden');
    plansAnalysisDate.textContent = formattedDate;
    
    // Update Plan card sub-dates
    planDateSuplementacao.textContent = formattedDate;
    planDateAlimentar.textContent = formattedDate;
    planDateTreino.textContent = formattedDate;
  } else {
    statusAnalysisDate.textContent = "Sem análises";
    statusSummaryText.textContent = "Nenhuma análise de exame disponível. Carregue um PDF de exame de sangue para iniciar.";
    inlineDetailSlot?.classList.add('hidden');
    plansAnalysisDate.textContent = "--";
    
    planDateSuplementacao.textContent = "Nenhum plano";
    planDateAlimentar.textContent = "Nenhum plano";
    planDateTreino.textContent = "Nenhum plano";
  }

  // Update dynamic health scores circles on dashboard
  updateDashboardScores(activeAnalysis);
  
  // Setup click triggers on plans
  planCardSuplementacao.onclick = () => activeAnalysis && openPlanDetails('supl');
  planCardAlimentar.onclick = () => activeAnalysis && openPlanDetails('nutri');
  planCardTreino.onclick = () => activeAnalysis && openPlanDetails('treino');
  // Trigger toolbar visibility
  if (state.analyses.length > 0) {
    activeAnalysisBar.classList.remove('hidden');
    // Check if showing historical values
    if (state.activeAnalysisId !== state.analyses[0].id) {
      btnResetLatest.classList.remove('hidden');
    } else {
      btnResetLatest.classList.add('hidden');
    }
  } else {
    activeAnalysisBar.classList.add('hidden');
  }
}

function renderAnalysisDropdown() {
  selectActiveAnalysis.innerHTML = '';
  state.analyses.forEach((anl) => {
    const option = document.createElement('option');
    option.value = anl.id;
    option.textContent = `${formatDateString(anl.date)} - Ref: ${anl.bloodTestFilename || 'Exame'}`;
    selectActiveAnalysis.appendChild(option);
  });
  
  selectActiveAnalysis.value = state.activeAnalysisId;
  
  // Dropdown change updates active analysis context
  selectActiveAnalysis.onchange = (e) => {
    state.activeAnalysisId = e.target.value;
    renderDashboard();
    if (inlineDetailSlot && !inlineDetailSlot.classList.contains('hidden')) openPlanDetails('status');
  };
  
  btnResetLatest.onclick = () => {
    if (state.analyses.length > 0) {
      state.activeAnalysisId = state.analyses[0].id;
      selectActiveAnalysis.value = state.activeAnalysisId;
      renderDashboard();
    }
  };
}

function renderDocumentsList() {
  documentsContainer.innerHTML = '';
  
  const displayDocs = state.documents.slice(0, 3); // Top 3 on dashboard
  
  if (displayDocs.length === 0) {
    documentsContainer.innerHTML = '<div class="no-docs-message">Nenhum documento cadastrado. Use a área de upload acima para enviar seus exames.</div>';
    return;
  }
  
  displayDocs.forEach(doc => {
    const formattedDate = formatDateString(doc.date);
    const item = document.createElement('div');
    item.className = 'doc-item';
    
    const badgeType = doc.type === 'blood-test' ? 'badge-blood' : 'badge-bio';
    const badgeText = doc.type === 'blood-test' ? 'Exames de Sangue' : 'Bioimpedância';
    
    item.innerHTML = `
      <div class="doc-info">
        <span class="doc-title" title="${doc.name}">${doc.name}</span>
        <div class="doc-meta-row">
          <span class="doc-badge ${badgeType}">${badgeText}</span>
          <span class="doc-badge badge-processed">${doc.status}</span>
          <span class="doc-date">${formattedDate}</span>
        </div>
      </div>
      <a href="/api/documents/${encodeURIComponent(doc.id)}/file" target="_blank" class="btn-view-doc">Ver exame</a>
    `;
    
    documentsContainer.appendChild(item);
  });
}

function renderHistoryView() {
  // Render Analyses History
  analysesHistoryList.innerHTML = '';
  if (state.analyses.length === 0) {
    analysesHistoryList.innerHTML = '<div class="no-docs-message">Nenhuma análise registrada no histórico.</div>';
  } else {
    state.analyses.forEach(anl => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-item-info">
          <span class="history-item-title">${formatDateString(anl.date)}</span>
          <span class="history-item-subtitle">${anl.bloodTestFilename || 'Exame de sangue'}</span>
        </div>
        <button class="btn-view-doc" onclick="loadHistoryAnalysis('${anl.id}')">Visualizar</button>
      `;
      analysesHistoryList.appendChild(item);
    });
  }

  // Render All Documents History
  allDocumentsList.innerHTML = '';
  if (state.documents.length === 0) {
    allDocumentsList.innerHTML = '<div class="no-docs-message">Nenhum documento arquivado.</div>';
  } else {
    state.documents.forEach(doc => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const badgeType = doc.type === 'blood-test' ? 'badge-blood' : 'badge-bio';
      const badgeText = doc.type === 'blood-test' ? 'Sangue' : 'Bioimpedância';
      
      item.innerHTML = `
        <div class="history-item-info">
          <span class="history-item-title" title="${doc.name}">${doc.name}</span>
          <span class="history-item-subtitle">${formatDateString(doc.date)} • <span class="doc-badge ${badgeType}">${badgeText}</span></span>
        </div>
        <a href="/api/documents/${encodeURIComponent(doc.id)}/file" target="_blank" class="btn-view-doc">Ver PDF</a>
      `;
      allDocumentsList.appendChild(item);
    });
  }
}

// Action triggers from history screen
window.loadHistoryAnalysis = function(analysisId) {
  state.activeAnalysisId = analysisId;
  selectActiveAnalysis.value = analysisId;
  showView('dashboard');
};

// --- PLAN DETAILS RENDERING & TABS ---
function openPlanDetails(tabKey) {
  const activeAnalysis = state.analyses.find(a => a.id === state.activeAnalysisId);
  if (!activeAnalysis) return;
  
  detailDate.textContent = formatDateString(activeAnalysis.date);
  if (inlineDetailDate) inlineDetailDate.textContent = formatDateString(activeAnalysis.date);
  
  // Render values
  detStatusContent.innerHTML = parseMarkdown(activeAnalysis.healthStatus);
  detStatusExameRef.textContent = `Exame de referência: ${activeAnalysis.bloodTestFilename || 'Laudo enviado'}`;

  // Render General Orientations (Katia Haranaka/Nutrition and Guilherme Freccia)
  const nutriOrientWrapper = document.getElementById('det-nutri-orientation-wrapper');
  const nutriOrientEl = document.getElementById('det-nutri-orientation');
  if (nutriOrientEl && nutriOrientWrapper) {
    if (activeAnalysis.nutritionOrientation) {
      nutriOrientEl.innerHTML = parseMarkdown(activeAnalysis.nutritionOrientation);
      nutriOrientWrapper.classList.remove('hidden');
    } else {
      nutriOrientWrapper.classList.add('hidden');
    }
  }

  const treinoOrientWrapper = document.getElementById('det-treino-orientation-wrapper');
  const treinoOrientEl = document.getElementById('det-treino-orientation');
  if (treinoOrientEl && treinoOrientWrapper) {
    if (activeAnalysis.trainingOrientation) {
      treinoOrientEl.innerHTML = parseMarkdown(activeAnalysis.trainingOrientation);
      treinoOrientWrapper.classList.remove('hidden');
    } else {
      treinoOrientWrapper.classList.add('hidden');
    }
  }

  // Render Deterministic Alerts
  const alertsContainer = document.getElementById('det-alerts-container');
  if (alertsContainer) {
    alertsContainer.innerHTML = '';
    const alerts = activeAnalysis.deterministicAlerts || [];
    alertsContainer.classList.remove('hidden');
    
    const header = document.createElement('h3');
    header.className = 'alerts-section-title';
    header.textContent = 'Insights';
    alertsContainer.appendChild(header);

    if (alerts.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'detail-card';
      emptyMsg.style.padding = '32px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = 'var(--text-secondary)';
      emptyMsg.style.background = 'rgba(255, 255, 255, 0.015)';
      emptyMsg.style.border = '1px dashed var(--border-color)';
      emptyMsg.innerHTML = '<p class="empty-alert-message">Nenhum desvio crítico identificado. Seus biomarcadores estão dentro das faixas ótimas recomendadas pelas bases de conhecimento!</p>';
      alertsContainer.appendChild(emptyMsg);
    } else {
      const grid = document.createElement('div');
      grid.className = 'alerts-grid';

      alerts.forEach(alert => {
        const card = document.createElement('div');
        card.className = `alert-card alert-severity-${alert.severity}`;
        
        let icon = '';
        if (alert.severity === 'danger') {
          icon = `<svg xmlns="http://www.w3.org/2000/svg" class="alert-icon alert-danger-color" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        } else if (alert.severity === 'warning') {
          icon = `<svg xmlns="http://www.w3.org/2000/svg" class="alert-icon alert-warning-color" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
        } else {
          icon = `<svg xmlns="http://www.w3.org/2000/svg" class="alert-icon alert-info-color" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        card.innerHTML = `
          <div class="alert-header">
            <div class="alert-title-row">
              ${icon}
              <span class="alert-biomarker">${alert.biomarker}</span>
            </div>
            <span class="alert-badge-source">${alert.source || 'Clínica'}</span>
          </div>
          <div class="alert-details">
            <span class="alert-value-label">Valor obtido: <strong>${alert.value} ${alert.unit}</strong></span>
            <span class="alert-range-label">Alvo ideal: <strong>${alert.optimalRange}</strong></span>
          </div>
          <div class="alert-body">
            <div class="alert-insight"><strong>Fisiopatologia:</strong> ${parseMarkdown(alert.insight)}</div>
            <div class="alert-protocol" style="margin-top: 8px;"><strong>Biohack / Protocolo:</strong> ${parseMarkdown(alert.protocol)}</div>
          </div>
        `;
        grid.appendChild(card);
      });
      
      alertsContainer.appendChild(grid);
    }
  }
  
  // Supplements Cards (Page 5 style)
  supplementsContainer.innerHTML = '';
  if (!activeAnalysis.supplementation || activeAnalysis.supplementation.length === 0) {
    supplementsContainer.innerHTML = '<div class="no-docs-message">Nenhum suplemento prescrito para esta análise.</div>';
  } else {
    activeAnalysis.supplementation.forEach(supp => {
      const card = document.createElement('div');
      card.className = 'supp-item-card';
      card.innerHTML = `
        <div class="supp-header">
          <svg class="supp-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"></path><path d="m8.5 8.5 7 7"></path></svg>
          <span class="supp-name">${supp.name}</span>
        </div>
        <p class="supp-purpose">${supp.purpose}</p>
        <div class="supp-row">
          <span class="supp-label">Dose</span>
          <span class="supp-val">${supp.dose}</span>
        </div>
        <div class="supp-row">
          <span class="supp-label">Frequência</span>
          <span class="supp-val">${supp.frequency}</span>
        </div>
      `;
      supplementsContainer.appendChild(card);
    });
  }
  
  // Set default active day based on current date
  const daysOfWeek = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const currentDayIndex = new Date().getDay();
  state.selectedDay = daysOfWeek[currentDayIndex];

  // Render day contents (Nutrition & Training)
  renderPlanDayContents();
  
  // Keep the details in the dashboard flow instead of opening a second view.
  switchDetailTab(tabKey);
  showView('dashboard');
  inlineDetailSlot?.classList.remove('hidden');
  inlineDetailSlot?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderPlanDayContents() {
  const activeAnalysis = state.analyses.find(a => a.id === state.activeAnalysisId);
  if (!activeAnalysis) return;

  // Nutrition Rendering (Object vs Legacy String)
  if (typeof activeAnalysis.nutritionPlan === 'string') {
    document.getElementById('nutrition-day-tabs').classList.add('hidden');
    detNutriContent.innerHTML = parseMarkdown(activeAnalysis.nutritionPlan);
  } else {
    document.getElementById('nutrition-day-tabs').classList.remove('hidden');
    
    // Update active tab buttons styling
    document.querySelectorAll('#nutrition-day-tabs .day-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-day') === state.selectedDay) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    const content = activeAnalysis.nutritionPlan[state.selectedDay];
    if (!content) {
      detNutriContent.innerHTML = `<div class="no-meals-message">Nenhuma recomendação alimentar descrita para este dia da semana.</div>`;
    } else if (typeof content === 'string') {
      detNutriContent.innerHTML = parseMarkdown(content);
    } else if (Array.isArray(content)) {
      if (content.length === 0) {
        detNutriContent.innerHTML = `<div class="no-meals-message">Nenhuma refeição programada para este dia da semana.</div>`;
      } else {
        let html = '<div class="meals-list">';
        content.forEach(meal => {
          const protein = meal.proteinGrams || 0;
          const carbs = meal.carbsGrams || 0;
          const fat = meal.fatGrams || 0;
          const totalCalories = Math.round((protein * 4) + (carbs * 4) + (fat * 9));
          html += `
            <div class="meal-item-card">
              <div class="meal-item-header">
                <span class="meal-time">${meal.time || '--:--'}</span>
                <h4 class="meal-name">${meal.name}</h4>
              </div>
              <p class="meal-description">${meal.description || ''}</p>
              <div class="meal-macros">
                <span class="macro-badge macro-protein">Proteínas: <strong>${protein}g</strong></span>
                <span class="macro-badge macro-carb">Carboidratos: <strong>${carbs}g</strong></span>
                <span class="macro-badge macro-fat">Gorduras: <strong>${fat}g</strong></span>
                <span class="macro-badge macro-kcal">Calorias: <strong>${totalCalories} kcal</strong></span>
              </div>
            </div>
          `;
        });
        html += '</div>';
        detNutriContent.innerHTML = html;
      }
    } else {
      detNutriContent.innerHTML = `<div class="no-meals-message">Formato inválido de refeições.</div>`;
    }
  }

  // Training Rendering (Object vs Legacy String)
  if (typeof activeAnalysis.trainingPlan === 'string') {
    document.getElementById('training-day-tabs').classList.add('hidden');
    detTreinoContent.innerHTML = parseMarkdown(activeAnalysis.trainingPlan);
  } else {
    document.getElementById('training-day-tabs').classList.remove('hidden');
    
    // Update active tab buttons styling
    document.querySelectorAll('#training-day-tabs .day-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-day') === state.selectedDay) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    const content = activeAnalysis.trainingPlan[state.selectedDay] || "### Descanso\nNenhum treino programado para este dia da semana.";
    detTreinoContent.innerHTML = parseMarkdown(content);
  }
}

function setupDetailTabHandlers() {
  Object.keys(detailTabs).forEach(key => {
    detailTabs[key].addEventListener('click', () => {
      switchDetailTab(key);
    });
  });

  // Nutrition day buttons
  const nutriDayBtns = document.querySelectorAll('#nutrition-day-tabs .day-tab-btn');
  nutriDayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.getAttribute('data-day');
      state.selectedDay = day;
      
      // Sync training day selector to match the same day for a consistent experience
      const syncTrainingBtn = document.querySelector(`#training-day-tabs .day-tab-btn[data-day="${day}"]`);
      if (syncTrainingBtn) {
        document.querySelectorAll('#training-day-tabs .day-tab-btn').forEach(b => b.classList.remove('active'));
        syncTrainingBtn.classList.add('active');
      }

      // Re-render
      renderPlanDayContents();
    });
  });

  // Training day buttons
  const trainingDayBtns = document.querySelectorAll('#training-day-tabs .day-tab-btn');
  trainingDayBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const day = btn.getAttribute('data-day');
      state.selectedDay = day;
      
      // Sync nutrition day selector to match the same day
      const syncNutriBtn = document.querySelector(`#nutrition-day-tabs .day-tab-btn[data-day="${day}"]`);
      if (syncNutriBtn) {
        document.querySelectorAll('#nutrition-day-tabs .day-tab-btn').forEach(b => b.classList.remove('active'));
        syncNutriBtn.classList.add('active');
      }

      // Re-render
      renderPlanDayContents();
    });
  });
}

function switchDetailTab(activeKey) {
  Object.keys(detailPanels).forEach(key => {
    if (key === activeKey) {
      detailPanels[key].classList.add('active');
      detailTabs[key].classList.add('active');
    } else {
      detailPanels[key].classList.remove('active');
      detailTabs[key].classList.remove('active');
    }
  });
}

// --- UTILITY HELPERS ---
function formatDateString(dateStr) {
  if (!dateStr) return '--';
  // Check if YYYY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const months = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    const day = parseInt(parts[2]);
    const month = months[parseInt(parts[1]) - 1];
    const year = parts[0];
    return `${day} de ${month} de ${year}`;
  }
  return dateStr;
}

// Custom Markdown Parser
function parseMarkdown(md) {
  if (!md) return "";
  
  const lines = md.split('\n');
  let html = '';
  let listType = null;

  const closeList = () => {
    if (!listType) return;
    html += `</${listType}>`;
    listType = null;
  };

  const openList = (type) => {
    if (listType === type) return;
    closeList();
    html += `<${type}>`;
    listType = type;
  };
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    let trimmed = line.trim();
    if (!trimmed) {
      if (listType) {
        const nextContentLine = lines
          .slice(lineIndex + 1)
          .find(candidate => candidate.trim());
        const nextTrimmed = nextContentLine?.trim() || '';
        const continuesCurrentList = listType === 'ul'
          ? nextTrimmed.startsWith('* ') || nextTrimmed.startsWith('- ')
          : /^\d+\.\s/.test(nextTrimmed);

        if (!continuesCurrentList) closeList();
      }
      continue;
    }
    
    // Headings
    if (trimmed.startsWith('### ')) {
      closeList();
      html += `<h3>${trimmed.slice(4)}</h3>`;
    } else if (trimmed.startsWith('## ')) {
      closeList();
      html += `<h2>${trimmed.slice(3)}</h2>`;
    } else if (trimmed.startsWith('# ')) {
      closeList();
      html += `<h1>${trimmed.slice(2)}</h1>`;
    }
    // Bullet list items
    else if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      openList('ul');
      html += `<li>${trimmed.slice(2)}</li>`;
    }
    // Number list items
    else if (/^\d+\.\s/.test(trimmed)) {
      openList('ol');
      html += `<li>${trimmed.replace(/^\d+\.\s/, '')}</li>`;
    }
    // Regular paragraph
    else {
      closeList();
      html += `<p>${trimmed}</p>`;
    }
  }

  closeList();
  
  // Format bold text **word**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Keep only the leading label bold when an entire list item was emphasized.
  html = html.replace(
    /<li><strong>([^<:]+:)\s*([\s\S]*?)<\/strong><\/li>/g,
    '<li><strong>$1</strong> $2</li>'
  );
  
  return html;
}

// Robust Biomarker Lookup Helper
function findBiomarker(biomarkers, name) {
  if (!name || !biomarkers) return null;
  const clean = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const target = clean(name);
  return biomarkers.find(x => {
    const cand = clean(x.name);
    if (cand === target) return true;
    
    // Substring/Synonym Fallbacks
    if (target === 'VITAMINA D' && (cand.includes('VITAMINA D') || cand.includes('25-OH-VITAMINA D') || cand.includes('25-HIDROXI'))) return true;
    if (target === 'TSH' && cand.includes('TSH')) return true;
    if (target === 'AST (TGO)' && (cand.includes('TGO') || cand.includes('AST'))) return true;
    if (target === 'ALT (TGP)' && (cand.includes('TGP') || cand.includes('ALT'))) return true;
    if (target === 'VITAMINA B12' && (cand.includes('B12') || cand.includes('COBALAMINA'))) return true;
    if (target === 'PROTEINA C REATIVA' && (cand.includes('PCR') || cand.includes('CR') || cand.includes('REATIVA'))) return true;
    if (target === 'TRIGLICERIDEOS' && (cand.includes('TRIGLI'))) return true;
    if (target === 'COLESTEROL HDL' && (cand.includes('HDL'))) return true;
    if (target === 'COLESTEROL LDL' && (cand.includes('LDL'))) return true;
    if (target === 'TESTOSTERONA TOTAL' && (cand.includes('TESTOSTERONA'))) return true;
    if (target === 'T4 LIVRE' && (cand.includes('T4'))) return true;
    if (target === 'T3 LIVRE' && (cand.includes('T3'))) return true;
    return false;
  }) || null;
}

/**
 * --- DYNAMIC HEALTH SCORES COMPUTATION (Item 5) ---
 */
function updateDashboardScores(activeAnalysis) {
  const metabEl = document.getElementById('score-metabolica');
  const cardioEl = document.getElementById('score-cardio');
  const tireoideEl = document.getElementById('score-tireoide');
  const geralEl = document.getElementById('score-geral');
  
  const metabCircle = document.querySelector('.metab-circle');
  const cardioCircle = document.querySelector('.cardio-circle');
  const tireoideCircle = document.querySelector('.tireoide-circle');
  const geralCircle = document.querySelector('.geral-circle');
  
  if (!metabEl) return; // Not on page yet
  
  if (!activeAnalysis) {
    [metabEl, cardioEl, tireoideEl, geralEl].forEach(el => el.textContent = '--');
    [metabCircle, cardioCircle, tireoideCircle, geralCircle].forEach(c => c.setAttribute('stroke-dasharray', '0, 100'));
    return;
  }
  
  const biomarkers = activeAnalysis.biomarkers || [];
  const profile = state.profile || {};
  
  const getVal = (name) => {
    const b = findBiomarker(biomarkers, name);
    return b ? parseFloat(String(b.value).replace(',', '.')) : null;
  };
  
  // 1. Metabólica
  let scoreMetab = 100;
  const imc = parseFloat(profile.imc);
  if (!isNaN(imc) && imc > 25) {
    scoreMetab -= Math.min(30, Math.round((imc - 25) * 4));
  }
  const homa = getVal('HOMA-IR');
  if (homa !== null) {
    if (homa > 1.9) scoreMetab -= 15;
    if (homa > 2.9) scoreMetab -= 15;
  } else {
    const glicose = getVal('GLICOSE');
    if (glicose > 99) scoreMetab -= 15;
  }
  const tg = getVal('TRIGLICERÍDEOS') || getVal('TRIGLICERIDEOS');
  if (tg > 150) scoreMetab -= 10;
  scoreMetab = Math.max(10, Math.min(100, scoreMetab));
  
  // 2. Cardiovascular
  let scoreCardio = 100;
  const hdl = getVal('COLESTEROL HDL') || getVal('HDL');
  const ldl = getVal('COLESTEROL LDL') || getVal('LDL');
  if (hdl !== null && hdl < 40) scoreCardio -= 20;
  if (ldl !== null && ldl > 130) scoreCardio -= 15;
  if (ldl !== null && ldl > 160) scoreCardio -= 10;
  const sys = parseFloat(profile.cardioSistolica);
  const dia = parseFloat(profile.cardioDiastolica);
  if (!isNaN(sys) && sys > 130) scoreCardio -= 15;
  if (!isNaN(dia) && dia > 85) scoreCardio -= 10;
  scoreCardio = Math.max(10, Math.min(100, scoreCardio));
  
  // 3. Tireoidiana
  let scoreTireoide = 100;
  const tsh = getVal('TSH');
  const t4 = getVal('T4 LIVRE') || getVal('T4');
  if (tsh !== null) {
    if (tsh < 0.4 || tsh > 4.5) scoreTireoide -= 20;
    if (tsh > 2.5 && tsh <= 4.5) scoreTireoide -= 10;
  }
  if (t4 !== null && (t4 < 0.8 || t4 > 1.9)) scoreTireoide -= 20;
  if (tsh === null && t4 === null) scoreTireoide = 95;
  scoreTireoide = Math.max(10, Math.min(100, scoreTireoide));
  
  // 4. Geral & Nutricional
  let scoreGeral = 100;
  const vitd = getVal('VITAMINA D') || getVal('25-OH-VITAMINA D');
  if (vitd !== null && vitd < 30) scoreGeral -= 15;
  const b12 = getVal('VITAMINA B12');
  if (b12 !== null && b12 < 300) scoreGeral -= 15;
  const scoreInbody = parseFloat(profile.inbodyScore);
  if (!isNaN(scoreInbody) && scoreInbody < 75) {
    scoreGeral -= Math.min(20, Math.round((75 - scoreInbody) * 1.5));
  }
  const sono = parseFloat(profile.sonoQualidade);
  if (!isNaN(sono) && sono < 7) scoreGeral -= 15;
  scoreGeral = Math.max(10, Math.min(100, scoreGeral));
  
  metabEl.textContent = scoreMetab;
  cardioEl.textContent = scoreCardio;
  tireoideEl.textContent = scoreTireoide;
  geralEl.textContent = scoreGeral;
  
  metabCircle.setAttribute('stroke-dasharray', `${scoreMetab}, 100`);
  cardioCircle.setAttribute('stroke-dasharray', `${scoreCardio}, 100`);
  tireoideCircle.setAttribute('stroke-dasharray', `${scoreTireoide}, 100`);
  geralCircle.setAttribute('stroke-dasharray', `${scoreGeral}, 100`);
}

/**
 * --- LABS HISTORICAL TIMELINE VIEW (Item 2) ---
 */
let labsSelectedMarkers = [];

const calculatedMarkersList = [
  'HOMA-IR', 'RELAÇÃO TG/HDL', 'RELAÇÃO CT/HDL', 'RAZÃO DE RITIS', 'TESTOSTERONA LIVRE',
  'FIB-4', 'RELAÇÃO NEUTRÓFILOS/LINFÓCITOS (NLR)', 'RELAÇÃO PLAQUETAS/LINFÓCITOS (PLR)', 'RELAÇÃO PSA LIVRE/TOTAL'
];

const markerDirections = {
  'CREATININA': 'lower',
  'GLICOSE': 'lower',
  'INSULINA': 'lower',
  'HOMA-IR': 'lower',
  'TRIGLICERÍDEOS': 'lower',
  'COLESTEROL LDL': 'lower',
  'COLESTEROL NÃO HDL': 'lower',
  'APOLIPOPROTEÍNA B': 'lower',
  'LIPOPROTEÍNA A': 'lower',
  'PROTEÍNA C REATIVA': 'lower',
  'HOMOCISTEÍNA': 'lower',
  'AST (TGO)': 'lower',
  'ALT (TGP)': 'lower',
  'GGT': 'lower',
  'FIB-4': 'lower',
  'RELAÇÃO NEUTRÓFILOS/LINFÓCITOS (NLR)': 'lower',
  'RELAÇÃO PLAQUETAS/LINFÓCITOS (PLR)': 'lower',
  
  'COLESTEROL HDL': 'higher',
  'FILTRAÇÃO GLOMERULAR ESTIMADA': 'higher',
  'VITAMINA D': 'higher',
  'VITAMINA B12': 'higher',
  'TESTOSTERONA TOTAL': 'higher',
  'TESTOSTERONA LIVRE': 'higher',
  'RELAÇÃO PSA LIVRE/TOTAL': 'higher'
};

function calculateSpearman(x, y) {
  const n = x.length;
  if (n < 2) return 0;
  
  const pairs = x.map((val, i) => ({ x: val, y: y[i], xRank: 0, yRank: 0 }));
  
  // Rank X
  pairs.sort((a, b) => a.x - b.x);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && pairs[j].x === pairs[i].x) {
      j++;
    }
    const rank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      pairs[k].xRank = rank;
    }
    i = j;
  }
  
  // Rank Y
  pairs.sort((a, b) => a.y - b.y);
  i = 0;
  while (i < n) {
    let j = i;
    while (j < n && pairs[j].y === pairs[i].y) {
      j++;
    }
    const rank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      pairs[k].yRank = rank;
    }
    i = j;
  }
  
  let sumD2 = 0;
  for (let k = 0; k < n; k++) {
    const diff = pairs[k].xRank - pairs[k].yRank;
    sumD2 += diff * diff;
  }
  
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

function updateCorrelationInfo(selectedMarkerNames) {
  const infoPanel = document.getElementById('labs-correlation-info');
  if (!infoPanel) return;
  
  if (!selectedMarkerNames || selectedMarkerNames.length < 2) {
    infoPanel.classList.add('hidden');
    return;
  }
  
  const m1 = selectedMarkerNames[0];
  const m2 = selectedMarkerNames[1];
  
  const pairedPoints = [];
  state.analyses.forEach(anl => {
    const b1 = anl.biomarkers?.find(x => x.name.toUpperCase() === m1.toUpperCase());
    const b2 = anl.biomarkers?.find(x => x.name.toUpperCase() === m2.toUpperCase());
    if (b1 && b2 && b1.value !== null && b2.value !== null) {
      pairedPoints.push({
        date: anl.date,
        x: parseFloat(String(b1.value).replace(',', '.')),
        y: parseFloat(String(b2.value).replace(',', '.'))
      });
    }
  });
  
  infoPanel.classList.remove('hidden');
  
  const count = pairedPoints.length;
  if (count < 6) {
    infoPanel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="badge-coev">Co-evolução Clínica</span>
        <span>Exibindo painel de co-evolução para <strong>${m1}</strong> e <strong>${m2}</strong>.</span>
      </div>
      <div class="correlation-meta">
        * Menos de 6 coletas coincidentes (${count} ponto(s)). Correlação estatística desativada por instabilidade clínica devido ao baixo volume de dados.
      </div>
    `;
  } else {
    const xVals = pairedPoints.map(p => p.x);
    const yVals = pairedPoints.map(p => p.y);
    const rho = calculateSpearman(xVals, yVals);
    const formattedRho = rho.toFixed(2);
    
    let interpretation = "correlação fraca";
    const absRho = Math.abs(rho);
    if (absRho >= 0.7) interpretation = "forte correlação";
    else if (absRho >= 0.4) interpretation = "correlação moderada";
    
    const direction = rho > 0 ? "positiva (co-evoluem no mesmo sentido)" : "negativa (sentidos opostos)";
    
    const sortedPoints = [...pairedPoints].sort((a, b) => new Date(a.date) - new Date(b.date));
    const datesList = sortedPoints.map(p => {
      const parts = p.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    }).join(', ');
    
    let warningMsg = "";
    if (count < 10) {
      warningMsg = `<div class="correlation-warning">⚠️ Recomendado preferencialmente 10 pontos para maior confiabilidade estatística (atualmente com ${count}).</div>`;
    }
    
    infoPanel.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span class="badge-corr">Correlação Estatística</span>
        <span>Análise de Tendência de Spearman: <strong>&rho; = ${formattedRho}</strong> (${interpretation} ${direction})</span>
      </div>
      <div class="correlation-description">
        Pontos coincidentes de análise: <strong>${count}</strong> (${datesList}).
      </div>
      ${warningMsg}
    `;
  }
}

// Load Context Annotations
function loadActiveAnalysisAnnotations() {
  const activeAnalysis = state.analyses.find(a => a.id === state.activeAnalysisId);
  const dateEl = document.getElementById('annotation-active-date');
  if (!dateEl) return;
  
  if (!activeAnalysis) {
    dateEl.textContent = "Selecione um exame";
    return;
  }
  
  dateEl.textContent = formatDateString(activeAnalysis.date);
  
  // Reset checkbox states and details
  document.querySelectorAll('.annotation-tag-cb').forEach(cb => cb.checked = false);
  document.getElementById('input-annotation-details').value = '';
  
  if (activeAnalysis.annotations) {
    try {
      const data = JSON.parse(activeAnalysis.annotations);
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach(tag => {
          const cb = Array.from(document.querySelectorAll('.annotation-tag-cb'))
            .find(c => c.value === tag);
          if (cb) cb.checked = true;
        });
      }
      if (data.details) {
        document.getElementById('input-annotation-details').value = data.details;
      }
    } catch (e) {
      // Fallback
      document.getElementById('input-annotation-details').value = activeAnalysis.annotations;
    }
  }
}

// Save Context Annotations
async function saveActiveAnalysisAnnotations() {
  const activeAnalysis = state.analyses.find(a => a.id === state.activeAnalysisId);
  if (!activeAnalysis) {
    alert("Nenhuma análise selecionada.");
    return;
  }
  
  const selectedTags = Array.from(document.querySelectorAll('.annotation-tag-cb:checked'))
    .map(cb => cb.value);
  const details = document.getElementById('input-annotation-details').value.trim();
  
  const annotationsStr = JSON.stringify({
    tags: selectedTags,
    details: details
  });
  
  try {
    const result = await apiFetch(`/api/analyses/${activeAnalysis.id}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations: annotationsStr })
    });
    
    // Update local state
    activeAnalysis.annotations = annotationsStr;
    
    // Redraw and reload
    drawLabsChart(labsSelectedMarkers);
    renderLabsHistoryTable(allAvailableMarkers);
    
    alert("Anotações salvas com sucesso!");
  } catch (err) {
    console.error(err);
    alert("Erro ao salvar: " + err.message);
  }
}

const presetExplanations = {
  'preset-carga-aterogenica': {
    title: 'Carga Aterogênica',
    question: 'A quantidade de colesterol e partículas aterogênicas está aumentando?',
    text: 'Acompanha o volume total de lipoproteínas aterogênicas na circulação. Útil para identificar o acúmulo subclínico de partículas que causam aterosclerose.',
    markers: ['COLESTEROL LDL', 'COLESTEROL NÃO HDL', 'APOLIPOPROTEÍNA B', 'TRIGLICERÍDEOS', 'LIPOPROTEÍNA A']
  },
  'preset-discordancia-ldl-apob': {
    title: 'Discordância LDL vs ApoB',
    question: 'O LDL parece aceitável, mas o número de partículas continua elevado?',
    text: 'Identifica a discordância clínica entre o colesterol carregado (LDL) e a contagem de partículas (ApoB). Crucial quando os triglicerídeos estão elevados.',
    markers: ['COLESTEROL LDL', 'COLESTEROL NÃO HDL', 'APOLIPOPROTEÍNA B']
  },
  'preset-sindrome-metabolica': {
    title: 'Síndrome Metabólica',
    question: 'Resistência à insulina e dislipidemia estão evoluindo juntas?',
    text: 'Avalia a co-evolução da resposta à insulina, triglicerídeos e HDL. Permite rastrear precocemente o desenvolvimento de dislipidemia aterogênica.',
    markers: ['TRIGLICERÍDEOS', 'COLESTEROL HDL', 'RELAÇÃO TG/HDL', 'INSULINA', 'HOMA-IR', 'GLICOSE']
  },
  'preset-controle-glicemico-ampliado': {
    title: 'Controle Glicêmico Ampliado',
    question: 'A glicemia permanece normal à custa de maior produção de insulina?',
    text: 'Mapeia a regulação da glicose a médio/longo prazo. Permite ver a sobrecarga pancreática antes da glicemia de jejum alterar.',
    markers: ['GLICOSE', 'INSULINA', 'HOMA-IR', 'HEMOGLOBINA GLICADA', 'GLICEMIA MÉDIA ESTIMADA']
  },
  'preset-figado-metabolico': {
    title: 'Fígado Metabólico',
    question: 'Alterações metabólicas estão acompanhando sinais hepáticos?',
    text: 'Mapeia enzimas de lesão hepática (AST/ALT), gordura visceral (Triglicerídeos) e resistência insulínica.',
    markers: ['ALT (TGP)', 'AST (TGO)', 'GGT', 'TRIGLICERÍDEOS', 'INSULINA', 'HOMA-IR']
  },
  'preset-inflamacao-aterotrombose': {
    title: 'Inflamação & Aterotrombose',
    question: 'Existe coevolução entre inflamação sistêmica e marcadores plaquetários?',
    text: 'Avalia o estado pró-inflamatório e pró-trombótico sistêmico a partir do fibrinogênio, plaquetas e PCR ultrassensível.',
    markers: ['PROTEÍNA C REATIVA', 'FIBRINOGÊNIO', 'LEUCÓCITOS', 'SEGMENTADOS', 'PLAQUETAS']
  },
  'preset-funcao-renal': {
    title: 'Função Renal',
    question: 'A taxa de filtração renal está estável ou apresenta tendência de queda?',
    text: 'Acompanha a depuração renal correlacionando a creatinina e ureia com a taxa de filtração glomerular estimada (eGFR).',
    markers: ['CREATININA', 'FILTRAÇÃO GLOMERULAR ESTIMADA', 'UREIA', 'POTÁSSIO']
  },
  'preset-tireoide-essencial': {
    title: 'Tireoide Essencial',
    question: 'A resposta da hipófise é compatível com a produção de hormônio livre?',
    text: 'Monitora a sensibilidade do eixo hipófise-tireoide correlacionando o hormônio estimulador (TSH) e a forma livre periférica (T4 Livre).',
    markers: ['TSH', 'T4 LIVRE']
  },
  'preset-risco-hepatico-fib4': {
    title: 'FIB-4 (Risco Hepático)',
    question: 'Qual o risco calculado de fibrose hepática no fígado gorduroso?',
    text: 'Calcula o escore FIB-4 integrando a idade virtual com plaquetas e transaminases para triagem não invasiva de fibrose.',
    markers: ['IDADE', 'AST (TGO)', 'ALT (TGP)', 'PLAQUETAS', 'FIB-4']
  },
  'preset-inflamacao-hematologica': {
    title: 'Inflamação Hematológica',
    question: 'A resposta imune celular está sinalizando inflamação crônica?',
    text: 'Acompanha as relações NLR (Neutrófilos/Linfócitos) e PLR (Plaquetas/Linfócitos) junto à PCR, como marcadores de estresse imunológico.',
    markers: ['PROTEÍNA C REATIVA', 'LEUCÓCITOS', 'SEGMENTADOS', 'LINFÓCITOS', 'RELAÇÃO NEUTRÓFILOS/LINFÓCITOS (NLR)', 'PLAQUETAS', 'RELAÇÃO PLAQUETAS/LINFÓCITOS (PLR)']
  },
  'preset-b12-folato-homocisteina': {
    title: 'B12, Folato & Homocisteína',
    question: 'Os níveis de vitaminas estão garantindo uma metilação adequada?',
    text: 'Verifica a co-evolução dos níveis de B12 e Folato com a Homocisteína (marcador de risco cardiovascular e neurodegenerativo por defeito de metilação).',
    markers: ['VITAMINA B12', 'ÁCIDO FÓLICO', 'HOMOCISTEÍNA', 'VCM', 'RDW', 'CREATININA', 'FILTRAÇÃO GLOMERULAR ESTIMADA']
  },
  'preset-eritropoiese-ferro': {
    title: 'Eritropoiese & Ferro',
    question: 'O estoque celular de ferro é suficiente para a síntese saudável de hemácias?',
    text: 'Acompanha a integridade do transporte de oxigênio analisando hemoglobina e índices hematológicos em conjunto com a ferritina.',
    markers: ['FERRITINA', 'FERRO SÉRICO', 'HEMOGLOBINA', 'HEMATÓCRITO', 'VCM', 'HCM', 'RDW']
  },
  'preset-metabolismo-osseo-mineral': {
    title: 'Metabolismo Ósseo-Mineral',
    question: 'O eixo Vitamina D-Cálcio-PTH está equilibrado fisiologicamente?',
    text: 'Monitora a homeostase mineral. Se a Vitamina D está baixa ou o Cálcio oscila, o PTH aumenta para reabsorver cálcio dos ossos.',
    markers: ['VITAMINA D', 'CÁLCIO IÔNICO', 'PARATORMÔNIO', 'MAGNÉSIO', 'FILTRAÇÃO GLOMERULAR ESTIMADA']
  },
  'preset-disponibilidade-androgenica': {
    title: 'Disponibilidade Androgênica',
    question: 'A fração ativa livre da testosterona está biologicamente adequada?',
    text: 'Avalia a relação entre a testosterona produzida (Total) e a globulina ligadora SHBG, estimando a Testosterona Livre bioativa.',
    markers: ['TESTOSTERONA TOTAL', 'SHBG', 'TESTOSTERONA LIVRE']
  },
  'preset-eixo-gonadal-masculino': {
    title: 'Eixo Gonadal Masculino',
    question: 'O estímulo da hipófise (LH/FSH) é condizente com a produção gonadal?',
    text: 'Monitora a integridade do eixo hipotálamo-hipófise-gonadal em homens, analisando as gonadotrofinas e a testosterona total/livre.',
    markers: ['TESTOSTERONA TOTAL', 'TESTOSTERONA LIVRE', 'LH', 'FSH']
  },
  'preset-balanco-androgeno-estradiol': {
    title: 'Balanço Andrógeno-Estradiol',
    question: 'Existe equilíbrio ou aromatização excessiva dos hormônios sexuais?',
    text: 'Mapeia a relação de equilíbrio entre androgênios e estrogênios. Importante para rastrear taxas elevadas de conversão por aromatase.',
    markers: ['TESTOSTERONA TOTAL', 'TESTOSTERONA LIVRE', 'ESTRADIOL', 'SHBG']
  },
  'preset-androgenos-perifericos': {
    title: 'Andrógenos Periféricos',
    question: 'A conversão periférica para o androgênio mais potente (DHT) está elevada?',
    text: 'Acompanha a produção de Di-hidrotestosterona (DHT) a partir da testosterona total via enzima 5-alfa-redutase.',
    markers: ['TESTOSTERONA TOTAL', 'TESTOSTERONA LIVRE', 'DHT', 'SHBG']
  },
  'preset-eixo-adrenal': {
    title: 'Eixo Adrenal',
    question: 'A resposta adrenal ao estresse diário está compensada?',
    text: 'Mapeia o cortisol das 8h (estresse agudo) contra a produção de DHEA-S (reserva androgênica da adrenal, estresse crônico).',
    markers: ['CORTISOL (08 HORAS)', 'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)']
  },
  'preset-prostata': {
    title: 'Acompanhamento Próstata',
    question: 'A evolução do PSA e a fração livre sinalizam alterações de alerta?',
    text: 'Acompanha o volume prostático e tendências de PSA. A relação livre/total reduzida (<0.20) acende alertas diagnósticos.',
    markers: ['PSA TOTAL', 'PSA LIVRE', 'RELAÇÃO PSA LIVRE/TOTAL']
  },
  'preset-hematopoieticos': {
    title: 'Micronutrientes Hematopoiéticos',
    question: 'Há carência nutricional de cofatores de síntese celular vermelha?',
    text: 'Acompanha os níveis de Ferro, Ferritina, B12 e Ácido fólico que dão suporte à integridade eritrocitária (Hemoglobina/VCM).',
    markers: ['VITAMINA B12', 'ÁCIDO FÓLICO', 'FERRO SÉRICO', 'FERRITINA', 'HEMOGLOBINA', 'VCM', 'RDW']
  },
  'preset-minerais-metabolicos': {
    title: 'Minerais Metabólicos',
    question: 'Cofatores enzimáticos e minerais estão em níveis ideais de saúde?',
    text: 'Acompanha minerais que atuam como cofatores em centenas de reações metabólicas sistêmicas, como o magnésio e o zinco.',
    markers: ['VITAMINA D', 'MAGNÉSIO', 'ZINCO SÉRICO', 'CÁLCIO IÔNICO', 'PARATORMÔNIO']
  }
};

function updatePresetExplanation(presetId) {
  const data = presetExplanations[presetId];
  if (!data) return;
  
  const titleEl = document.getElementById('explanation-title');
  const questionEl = document.getElementById('explanation-question');
  const textEl = document.getElementById('explanation-text');
  const listContainer = document.getElementById('explanation-biomarkers-list');
  
  if (titleEl) titleEl.textContent = data.title;
  if (questionEl) questionEl.textContent = data.question;
  if (textEl) textEl.textContent = data.text;
  
  if (listContainer) {
    listContainer.innerHTML = '';
    data.markers.forEach(m => {
      const isCalculated = calculatedMarkersList.includes(m.toUpperCase());
      const span = document.createElement('span');
      span.className = `biomarker-mini-tag ${isCalculated ? 'calc' : ''}`;
      span.textContent = m;
      listContainer.appendChild(span);
    });
  }
}

let allAvailableMarkers = [];

function initLabsView() {
  // Extract all unique biomarker names across all analyses
  const markerNamesSet = new Set();
  if (state.structuredBiomarkers.length > 0) {
    state.structuredBiomarkers.forEach(b => markerNamesSet.add(b.biomarkerName));
  } else {
    state.analyses.forEach(anl => {
      if (anl.biomarkers) anl.biomarkers.forEach(b => markerNamesSet.add(b.name));
    });
  }
  
  allAvailableMarkers = Array.from(markerNamesSet).sort();
  
  // Set default selection to "Carga Aterogênica" markers
  if (labsSelectedMarkers.length === 0) {
    const defaults = ['COLESTEROL LDL', 'COLESTEROL NÃO HDL', 'APOLIPOPROTEÍNA B', 'TRIGLICERÍDEOS', 'LIPOPROTEÍNA A'];
    labsSelectedMarkers = allAvailableMarkers.filter(m => defaults.includes(m.toUpperCase()));
    if (labsSelectedMarkers.length === 0 && allAvailableMarkers.length > 0) {
      labsSelectedMarkers = allAvailableMarkers.slice(0, 2);
    }
  }
  
  if (allAvailableMarkers.length === 0) {
    document.getElementById('labs-chart-container').innerHTML = '<div class="no-chart-data">Carregue exames de sangue para visualizar.</div>';
    document.getElementById('labs-history-table').innerHTML = '';
    return;
  }
  
  // Hook Presets dynamically using exact matching
  const applyPreset = (presetId, targets) => {
    const btn = document.getElementById(presetId);
    if (!btn) return;
    btn.onclick = () => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      labsSelectedMarkers = allAvailableMarkers.filter(m => 
        targets.some(t => m.toUpperCase() === t.toUpperCase())
      );
      
      drawLabsChart(labsSelectedMarkers);
      updatePresetExplanation(presetId);
    };
  };

  // 1. Prioridade 1
  applyPreset('preset-carga-aterogenica', ['COLESTEROL LDL', 'COLESTEROL NÃO HDL', 'APOLIPOPROTEÍNA B', 'TRIGLICERÍDEOS', 'LIPOPROTEÍNA A']);
  applyPreset('preset-discordancia-ldl-apob', ['COLESTEROL LDL', 'COLESTEROL NÃO HDL', 'APOLIPOPROTEÍNA B']);
  applyPreset('preset-sindrome-metabolica', ['TRIGLICERÍDEOS', 'COLESTEROL HDL', 'RELAÇÃO TG/HDL', 'INSULINA', 'HOMA-IR', 'GLICOSE']);
  applyPreset('preset-controle-glicemico-ampliado', ['GLICOSE', 'INSULINA', 'HOMA-IR', 'HEMOGLOBINA GLICADA', 'GLICEMIA MÉDIA ESTIMADA']);
  applyPreset('preset-figado-metabolico', ['ALT (TGP)', 'AST (TGO)', 'GGT', 'TRIGLICERÍDEOS', 'INSULINA', 'HOMA-IR']);
  applyPreset('preset-inflamacao-aterotrombose', ['PROTEÍNA C REATIVA', 'FIBRINOGÊNIO', 'LEUCÓCITOS', 'SEGMENTADOS', 'PLAQUETAS']);
  applyPreset('preset-funcao-renal', ['CREATININA', 'FILTRAÇÃO GLOMERULAR ESTIMADA', 'UREIA', 'POTÁSSIO']);
  applyPreset('preset-tireoide-essencial', ['TSH', 'T4 LIVRE']);
  
  // 2. Derivados
  applyPreset('preset-risco-hepatico-fib4', ['IDADE', 'AST (TGO)', 'ALT (TGP)', 'PLAQUETAS', 'FIB-4']);
  applyPreset('preset-inflamacao-hematologica', ['PROTEÍNA C REATIVA', 'LEUCÓCITOS', 'SEGMENTADOS', 'LINFÓCITOS', 'RELAÇÃO NEUTRÓFILOS/LINFÓCITOS (NLR)', 'PLAQUETAS', 'RELAÇÃO PLAQUETAS/LINFÓCITOS (PLR)']);
  applyPreset('preset-b12-folato-homocisteina', ['VITAMINA B12', 'ÁCIDO FÓLICO', 'HOMOCISTEÍNA', 'VCM', 'RDW', 'CREATININA', 'FILTRAÇÃO GLOMERULAR ESTIMADA']);
  applyPreset('preset-eritropoiese-ferro', ['FERRITINA', 'FERRO SÉRICO', 'HEMOGLOBINA', 'HEMATÓCRITO', 'VCM', 'HCM', 'RDW']);
  applyPreset('preset-metabolismo-osseo-mineral', ['VITAMINA D', 'CÁLCIO IÔNICO', 'PARATORMÔNIO', 'MAGNÉSIO', 'FILTRAÇÃO GLOMERULAR ESTIMADA']);
  
  // 3. Hormonais
  applyPreset('preset-disponibilidade-androgenica', ['TESTOSTERONA TOTAL', 'SHBG', 'TESTOSTERONA LIVRE']);
  applyPreset('preset-eixo-gonadal-masculino', ['TESTOSTERONA TOTAL', 'TESTOSTERONA LIVRE', 'LH', 'FSH']);
  applyPreset('preset-balanco-androgeno-estradiol', ['TESTOSTERONA TOTAL', 'TESTOSTERONA LIVRE', 'ESTRADIOL', 'SHBG']);
  applyPreset('preset-androgenos-perifericos', ['TESTOSTERONA TOTAL', 'TESTOSTERONA LIVRE', 'DHT', 'SHBG']);
  applyPreset('preset-eixo-adrenal', ['CORTISOL (08 HORAS)', 'SULFATO DE DEHIDROEPIANDROSTERONA (SDHEA)']);
  applyPreset('preset-prostata', ['PSA TOTAL', 'PSA LIVRE', 'RELAÇÃO PSA LIVRE/TOTAL']);
  
  // 4. Micronutrientes
  applyPreset('preset-hematopoieticos', ['VITAMINA B12', 'ÁCIDO FÓLICO', 'FERRO SÉRICO', 'FERRITINA', 'HEMOGLOBINA', 'VCM', 'RDW']);
  applyPreset('preset-minerais-metabolicos', ['VITAMINA D', 'MAGNÉSIO', 'ZINCO SÉRICO', 'CÁLCIO IÔNICO', 'PARATORMÔNIO']);

  // Compact selectors replace the long mobile button wall while reusing the
  // existing preset buttons as the single source of behavior.
  [
    'select-preset-principal',
    'select-preset-derivado',
    'select-preset-hormonal',
    'select-preset-micronutrientes'
  ].forEach(selectId => {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.onchange = () => document.getElementById(select.value)?.click();
  });
  
  // Set initial preset active class
  document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
  const btnDefault = document.getElementById('preset-carga-aterogenica');
  if (btnDefault) btnDefault.classList.add('active');
  
  // Bind Save Annotations button
  const saveAnnoBtn = document.getElementById('btn-save-annotations');
  if (saveAnnoBtn) {
    saveAnnoBtn.onclick = saveActiveAnalysisAnnotations;
  }
  
  // Active Analysis select dropdown custom hook to reload annotations on active view change
  const selectDropdown = document.getElementById('select-active-analysis');
  if (selectDropdown) {
    const originalChange = selectDropdown.onchange;
    selectDropdown.onchange = (e) => {
      if (originalChange) originalChange(e);
      loadActiveAnalysisAnnotations();
    };
  }

  // Initial draw
  drawLabsChart(labsSelectedMarkers);
  renderLabsHistoryTable(allAvailableMarkers);
  loadActiveAnalysisAnnotations();
  updatePresetExplanation('preset-carga-aterogenica');
}

function drawLabsChart(selectedMarkerNames) {
  const container = document.getElementById('labs-chart-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (!selectedMarkerNames || selectedMarkerNames.length === 0) {
    container.innerHTML = '<div class="no-chart-data">Selecione pelo menos um biomarcador para plotar o gráfico.</div>';
    return;
  }
  
  const width = container.clientWidth || 800;
  const height = 300;
  const paddingTop = 30;
  const paddingBottom = 40;
  const paddingLeft = 60;
  const paddingRight = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const structuredRows = state.structuredBiomarkers;
  const sortedAnalyses = [...state.analyses].sort((a, b) => new Date(a.date) - new Date(b.date));
  const structuredGroups = Array.from(structuredRows.reduce((groups, row) => {
    if (!groups.has(row.analysisId)) groups.set(row.analysisId, { date: row.date, annotations: row.annotations || "", rows: [] });
    groups.get(row.analysisId).rows.push(row);
    return groups;
  }, new Map()).values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  
  if (sortedAnalyses.length === 0 && structuredGroups.length === 0) {
    container.innerHTML = '<div class="no-chart-data">Carregue exames de sangue para visualizar.</div>';
    return;
  }
  
  const data = structuredGroups.length > 0 ? structuredGroups.map(group => {
    const points = {};
    selectedMarkerNames.forEach(name => {
      const row = group.rows.find(item => item.biomarkerName.toUpperCase() === name.toUpperCase());
      points[name] = row ? row.valueNumeric : null;
    });
    return { date: group.date, points, annotations: group.annotations };
  }) : sortedAnalyses.map(anl => {
    const points = {};
    selectedMarkerNames.forEach(name => {
      const b = anl.biomarkers?.find(x => x.name.toUpperCase() === name.toUpperCase());
      points[name] = b ? parseFloat(String(b.value).replace(',', '.')) : null;
    });
    return {
      date: anl.date,
      points,
      annotations: anl.annotations || ""
    };
  });

  const referenceRanges = {};
  const units = {};
  if (structuredGroups.length > 0) {
    structuredRows.forEach(row => {
      if (selectedMarkerNames.some(name => name.toUpperCase() === row.biomarkerName.toUpperCase())) {
        if (row.referenceRange) referenceRanges[row.biomarkerName] = row.referenceRange;
        if (row.unit) units[row.biomarkerName] = row.unit;
      }
    });
  } else {
    selectedMarkerNames.forEach(name => {
      for (let anl of sortedAnalyses) {
        const b = anl.biomarkers?.find(x => x.name.toUpperCase() === name.toUpperCase());
        if (b) {
          if (b.referenceRange) referenceRanges[name] = b.referenceRange;
          if (b.unit) units[name] = b.unit;
        }
      }
    });
  }

  const pointPercentages = [];
  selectedMarkerNames.forEach(name => {
    let firstVal = null;
    for (let d of data) {
      if (d.points[name] !== null) {
        firstVal = d.points[name];
        break;
      }
    }
    
    data.forEach(d => {
      const val = d.points[name];
      if (val === null) return;
      
      let pct = 0.0;
      if (firstVal !== null && firstVal !== 0) {
        pct = (val - firstVal) / firstVal;
      }
      pointPercentages.push({ name, val, pct });
      d.pointsPct = d.pointsPct || {};
      d.pointsPct[name] = pct;
    });
  });

  let axisMin = 0.0;
  let axisMax = 1.0;
  
  if (pointPercentages.length > 0) {
    const pcts = pointPercentages.map(p => p.pct);
    const minVal = Math.min(...pcts);
    const maxVal = Math.max(...pcts);
    
    axisMin = Math.floor((minVal - 0.05) * 20) / 20;
    axisMax = Math.ceil((maxVal + 0.05) * 20) / 20;
    
    if (axisMax - axisMin < 0.10) {
      const mid = Math.round(((axisMin + axisMax) / 2) * 20) / 20;
      axisMin = mid - 0.05;
      axisMax = mid + 0.05;
    }
  }

  const getNormalizedY = (name, pct) => {
    const clampedPct = (pct - axisMin) / (axisMax - axisMin);
    return height - paddingBottom - (clampedPct * chartHeight);
  };
  
  const colors = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#eab308'];
  
  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const ratio = i / gridCount;
    const y = paddingTop + chartHeight * ratio;
    
    svg += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#222222" stroke-width="1" stroke-dasharray="3" />`;
    
    const pctVal = axisMax - (axisMax - axisMin) * ratio;
    let label = Math.round(pctVal * 100) + '%';
    if (Math.round(pctVal * 100) > 0) {
      label = '+' + label;
    }
    svg += `<text class="chart-axis-label" x="${paddingLeft - 10}" y="${y + 3}" text-anchor="end">${label}</text>`;
  }
  
  if (axisMin <= 0 && axisMax >= 0) {
    const y0 = getNormalizedY(null, 0);
    svg += `<line x1="${paddingLeft}" y1="${y0}" x2="${width - paddingRight}" y2="${y0}" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1.2" stroke-dasharray="4,4" />`;
    svg += `<text class="chart-baseline-label" x="${width - paddingRight - 8}" y="${y0 - 5}" text-anchor="end">0% (Linha de Base)</text>`;
  }
  
  const xSpan = data.length - 1 || 1;
  data.forEach((d, idx) => {
    const x = data.length === 1 ? paddingLeft + (chartWidth / 2) : paddingLeft + (chartWidth / xSpan) * idx;
    svg += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${height - paddingBottom}" stroke="#222222" stroke-width="1" stroke-dasharray="1" />`;
    
    const dateObj = new Date(d.date + 'T00:00:00');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    
    // Draw a small warning icon or star if the date has annotations
    let annoIndicator = "";
    if (d.annotations) {
      annoIndicator = "*";
    }
    svg += `<text class="chart-axis-label${annoIndicator ? ' is-annotated' : ''}" x="${x}" y="${height - paddingBottom + 16}" text-anchor="middle">${day}/${month}${annoIndicator}</text>`;
  });
  
  selectedMarkerNames.forEach((name, sIdx) => {
    const color = colors[sIdx % colors.length];
    let pathData = '';
    const pointsToRender = [];
    const isCalculated = calculatedMarkersList.includes(name.toUpperCase());
    
    let lastIdx = -1;
    data.forEach((d, idx) => {
      const val = d.points[name];
      if (val === null) return;
      
      const pct = d.pointsPct[name];
      const x = data.length === 1 ? paddingLeft + (chartWidth / 2) : paddingLeft + (chartWidth / xSpan) * idx;
      const y = getNormalizedY(name, pct);
      
      pointsToRender.push({ x, y, val, date: d.date, annotations: d.annotations });
      
      // Breaking lines logic for no-interpolation
      if (pathData === '' || lastIdx !== idx - 1) {
        pathData += ` M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
      lastIdx = idx;
    });
    
    if (pathData !== '') {
      const strokeDash = isCalculated ? 'stroke-dasharray="5,5"' : '';
      svg += `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="2.5" ${strokeDash} stroke-linecap="round" stroke-linejoin="round" />`;
    }
    
    pointsToRender.forEach(p => {
      // Draw a different shape for calculated dots: a small square instead of circle
      if (isCalculated) {
        svg += `<rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" fill="#111111" stroke="${color}" stroke-width="2" />`;
      } else {
        svg += `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#111111" stroke="${color}" stroke-width="2" />`;
      }
      
      // Compile tooltip rich string
      const dir = markerDirections[name.toUpperCase()];
      const dirSymbol = dir ? (dir === 'lower' ? '(Alvo: ↓)' : '(Alvo: ↑)') : '';
      const refRange = referenceRanges[name] || 'N/A';
      const unit = units[name] || '';
      
      let contextStr = '';
      if (p.annotations) {
        try {
          const parsedAnno = JSON.parse(p.annotations);
          const tagsStr = (parsedAnno.tags && parsedAnno.tags.length > 0) ? `Tags: ${parsedAnno.tags.join(', ')}` : '';
          const detailsStr = parsedAnno.details ? `Obs: ${parsedAnno.details}` : '';
          if (tagsStr || detailsStr) {
            contextStr = `\nContexto: ${[tagsStr, detailsStr].filter(Boolean).join(' | ')}`;
          }
        } catch(e) {
          contextStr = `\nContexto: ${p.annotations}`;
        }
      }
      
      const tooltipText = `${name} ${dirSymbol}\nValor: ${p.val} ${unit}\nRef: ${refRange}\nColeta: ${formatDateString(p.date)}${contextStr}`;
      
      svg += `<circle cx="${p.x}" cy="${p.y}" r="12" fill="transparent" style="cursor: pointer;">
        <title>${tooltipText}</title>
      </circle>`;
    });
  });
  
  svg += `</svg>`;
  
  // Legend HTML with visual indicators for calculated vs measured and directions
  let legendHtml = '<div class="chart-legend">';
  selectedMarkerNames.forEach((name, sIdx) => {
    const color = colors[sIdx % colors.length];
    const isCalculated = calculatedMarkersList.includes(name.toUpperCase());
    const dir = markerDirections[name.toUpperCase()];
    const dirSymbol = dir ? (dir === 'lower' ? '↓' : '↑') : '';
    
    // Calculated gets a dashed legend line or small border
    const legendDotStyle = isCalculated 
      ? `border: 2px dashed ${color}; background-color: transparent; border-radius: 2px; width:10px; height:6px;`
      : `background-color: ${color}; width: 8px; height: 8px; border-radius: 50%;`;
      
    legendHtml += `
      <div class="legend-item" style="display: flex; align-items: center; gap: 6px;">
        <span class="legend-dot" style="${legendDotStyle}"></span>
        <span class="legend-text">
          ${name} ${dirSymbol ? `<strong style="color:var(--text-muted); margin-left: 2px;">(${dirSymbol})</strong>` : ''} 
          ${isCalculated ? '<small class="calc-label">(CALC)</small>' : ''}
        </span>
      </div>
    `;
  });
  legendHtml += '</div>';
  
  container.innerHTML = svg + legendHtml;
  
  // Update Correlation info panel
  updateCorrelationInfo(selectedMarkerNames);
}

function renderLabsHistoryTable(allAvailableMarkers) {
  const table = document.getElementById('labs-history-table');
  if (!table) return;
  
  const sortedAnalyses = [...state.analyses].sort((a, b) => new Date(b.date) - new Date(a.date));
  const structuredRows = state.structuredBiomarkers;
  const structuredDates = Array.from(new Map(structuredRows.map(row => [row.analysisId, row.date])).entries())
    .map(([analysisId, date]) => ({ analysisId, date }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const columns = structuredRows.length > 0 ? structuredDates : sortedAnalyses;
  
  // 1. Render Headers
  let headerHtml = '<tr><th>Biomarcador</th><th>Unidade</th>';
  columns.forEach(column => {
    const formattedDate = formatDateString(column.date);
    headerHtml += `<th>${formattedDate}</th>`;
  });
  headerHtml += '</tr>';
  table.querySelector('thead').innerHTML = headerHtml;
  
  // 2. Render Rows
  let bodyHtml = '';
  allAvailableMarkers.forEach(name => {
    let unit = '';
    const isCalculated = calculatedMarkersList.includes(name.toUpperCase());
    if (structuredRows.length > 0) {
      unit = structuredRows.find(row => row.biomarkerName.toUpperCase() === name.toUpperCase())?.unit || '';
    } else {
      for (let anl of sortedAnalyses) {
        const b = anl.biomarkers?.find(x => x.name.toUpperCase() === name.toUpperCase());
        if (b && b.unit) {
          unit = b.unit;
          break;
        }
      }
    }
    
    bodyHtml += `<tr>
      <td><strong>${name}</strong> ${isCalculated ? '<small class="calc-label calc-label-table">CALCULADO</small>' : ''}</td>
      <td class="unit-cell">${unit}</td>
    `;
    
    columns.forEach(column => {
      const b = structuredRows.length > 0
        ? structuredRows.find(row => row.analysisId === column.analysisId && row.biomarkerName.toUpperCase() === name.toUpperCase())
        : column.biomarkers?.find(x => x.name.toUpperCase() === name.toUpperCase());
      if (b) {
        const isAltered = b.status && b.status !== 'normal';
        const value = structuredRows.length > 0 ? b.valueText : b.value;
        bodyHtml += `<td class="biomarker-value${isAltered ? ' is-altered' : ''}">${value}</td>`;
      } else {
        bodyHtml += '<td class="muted-cell">-</td>';
      }
    });
    
    bodyHtml += '</tr>';
  });
  
  table.querySelector('tbody').innerHTML = bodyHtml;
}

/**
 * --- SYSTEMS BIOLOGY SCORES VIEW (Item 3 & 5) ---
 */
function renderScoresView() {
  const container = document.getElementById('scores-details-container');
  if (!container) return;
  
  const activeAnalysis = state.analyses.find(a => a.id === state.activeAnalysisId);
  if (!activeAnalysis) {
    container.innerHTML = '<div class="no-chart-data">Nenhuma análise de exames cadastrada. Envie um laudo para ver o detalhamento dos sistemas.</div>';
    return;
  }
  
  const biomarkers = activeAnalysis.biomarkers || [];
  const profile = state.profile || {};
  
  const getBadge = (name) => {
    const b = findBiomarker(biomarkers, name);
    if (!b) return '<span class="status-badge normal" style="background:rgba(255,255,255,0.03);color:var(--text-secondary);">N/D</span>';
    const status = b.status || 'normal';
    let label = 'Normal';
    if (status === 'alto') label = 'Alto';
    if (status === 'baixo') label = 'Baixo';
    if (status === 'alterado') label = 'Alterado';
    return `<span class="status-badge ${status.toLowerCase()}">${label}</span>`;
  };
  
  // Calculate scores dynamically matching dashboard logic
  // 1. Metabólica
  let scoreMetab = 100;
  const imc = parseFloat(profile.imc);
  if (!isNaN(imc) && imc > 25) scoreMetab -= Math.min(30, Math.round((imc - 25) * 4));
  const homa = findBiomarker(biomarkers, 'HOMA-IR') || biomarkers.find(x => x.name.toUpperCase().includes('HOMA'));
  if (homa) {
    const homaVal = parseFloat(String(homa.value).replace(',', '.'));
    if (homaVal > 1.9) scoreMetab -= 15;
    if (homaVal > 2.9) scoreMetab -= 15;
  } else {
    const glic = findBiomarker(biomarkers, 'GLICOSE');
    if (glic && parseFloat(glic.value) > 99) scoreMetab -= 15;
  }
  const tg = findBiomarker(biomarkers, 'TRIGLICERÍDEOS') || findBiomarker(biomarkers, 'TRIGLICERIDEOS');
  if (tg && parseFloat(tg.value) > 150) scoreMetab -= 10;
  scoreMetab = Math.max(10, Math.min(100, scoreMetab));

  // 2. Cardiovascular
  let scoreCardio = 100;
  const hdl = findBiomarker(biomarkers, 'COLESTEROL HDL');
  const ldl = findBiomarker(biomarkers, 'COLESTEROL LDL');
  if (hdl && parseFloat(hdl.value) < 40) scoreCardio -= 20;
  if (ldl && parseFloat(ldl.value) > 130) scoreCardio -= 15;
  if (ldl && parseFloat(ldl.value) > 160) scoreCardio -= 10;
  const sys = parseFloat(profile.cardioSistolica);
  const dia = parseFloat(profile.cardioDiastolica);
  if (!isNaN(sys) && sys > 130) scoreCardio -= 15;
  if (!isNaN(dia) && dia > 85) scoreCardio -= 10;
  scoreCardio = Math.max(10, Math.min(100, scoreCardio));

  // 3. Tireoide
  let scoreTireoide = 100;
  const tsh = findBiomarker(biomarkers, 'TSH');
  const t4 = findBiomarker(biomarkers, 'T4 LIVRE');
  if (tsh) {
    const tshVal = parseFloat(tsh.value);
    if (tshVal < 0.4 || tshVal > 4.5) scoreTireoide -= 20;
    if (tshVal > 2.5 && tshVal <= 4.5) scoreTireoide -= 10;
  }
  if (t4 && (parseFloat(t4.value) < 0.8 || parseFloat(t4.value) > 1.9)) scoreTireoide -= 20;
  if (!tsh && !t4) scoreTireoide = 95;
  scoreTireoide = Math.max(10, Math.min(100, scoreTireoide));

  // 4. Inflamação
  let scoreInflam = 100;
  const pcr = findBiomarker(biomarkers, 'PROTEÍNA C REATIVA') || findBiomarker(biomarkers, 'PROTEINA C REATIVA');
  const ferritina = findBiomarker(biomarkers, 'FERRITINA');
  if (pcr) {
    const pcrVal = parseFloat(pcr.value);
    if (pcrVal > 1.0) scoreInflam -= 15;
    if (pcrVal > 3.0) scoreInflam -= 15;
  }
  if (ferritina) {
    const ferVal = parseFloat(ferritina.value);
    if (ferVal > 300) scoreInflam -= 15;
    if (ferVal < 30) scoreInflam -= 10;
  }
  scoreInflam = Math.max(10, Math.min(100, scoreInflam));

  // 5. Hormônios
  let scoreHormonio = 100;
  const testo = findBiomarker(biomarkers, 'TESTOSTERONA TOTAL');
  const shbg = findBiomarker(biomarkers, 'SHBG');
  if (testo) {
    const testoVal = parseFloat(testo.value);
    if (testoVal < 300) scoreHormonio -= 25;
    if (testoVal > 900) scoreHormonio -= 10;
  }
  if (shbg && parseFloat(shbg.value) < 15) scoreHormonio -= 15;
  if (!testo && !shbg) scoreHormonio = 95;
  scoreHormonio = Math.max(10, Math.min(100, scoreHormonio));

  // 6. Nutricional/Geral
  let scoreNutri = 100;
  const vitd = findBiomarker(biomarkers, 'VITAMINA D');
  const vitb12 = findBiomarker(biomarkers, 'VITAMINA B12');
  if (vitd && parseFloat(vitd.value) < 30) scoreNutri -= 15;
  if (vitb12 && parseFloat(vitb12.value) < 300) scoreNutri -= 15;
  const inbody = parseFloat(profile.inbodyScore);
  if (!isNaN(inbody) && inbody < 75) scoreNutri -= Math.min(20, Math.round((75 - inbody) * 1.5));
  scoreNutri = Math.max(10, Math.min(100, scoreNutri));

  // Systems Definition
  const systems = [
    {
      title: "Metabolismo & Glicemia",
      subtitle: "Sensibilidade à insulina, controle de glicose e composição corporal",
      score: scoreMetab,
      markers: ['Glicose', 'Insulina', 'HOMA-IR', 'Triglicerídeos']
    },
    {
      title: "Saúde Cardiovascular",
      subtitle: "Lipoproteínas, pressão arterial, batimentos cardíacos e risco de aterosclerose",
      score: scoreCardio,
      markers: ['Colesterol Total', 'Colesterol HDL', 'Colesterol LDL', 'Relação TG/HDL', 'Relação CT/HDL']
    },
    {
      title: "Painel da Tireoide",
      subtitle: "Hormônios tireoidianos e velocidade do metabolismo basal",
      score: scoreTireoide,
      markers: ['TSH', 'T4 Livre', 'T3 Livre']
    },
    {
      title: "Saúde Inflamatória & Enzimas",
      subtitle: "Inflamação sistêmica de baixo grau e estresse celular",
      score: scoreInflam,
      markers: ['Proteína C Reativa', 'Ferritina', 'Razão de Ritis']
    },
    {
      title: "Hormônios & Vitalidade",
      subtitle: "Hormônios sexuais, andrógenos e proteínas de ligação",
      score: scoreHormonio,
      markers: ['Testosterona Total', 'SHBG', 'Testosterona Livre', 'LH', 'FSH', 'Estradiol']
    },
    {
      title: "Nutrição & Estilo de Vida",
      subtitle: "Armazenamento de micronutrientes, qualidade do sono e score corporal",
      score: scoreNutri,
      markers: ['Vitamina D', 'Vitamina B12', 'Ferritina']
    }
  ];

  let cardsHtml = '';
  systems.forEach(sys => {
    let tableRows = '';
    sys.markers.forEach(mName => {
      const b = findBiomarker(biomarkers, mName);
      const val = b ? `${b.value} ${b.unit || ''}` : '--';
      const ref = b ? b.referenceRange : '--';
      const badge = getBadge(mName);
      
      tableRows += `
        <tr>
          <td><strong>${mName}</strong></td>
          <td>${val}</td>
          <td class="reference-cell">${ref}</td>
          <td>${badge}</td>
        </tr>
      `;
    });

    cardsHtml += `
      <div class="system-score-card">
        <div class="system-header-row">
          <div class="system-title-col">
            <span class="system-title">${sys.title}</span>
            <span class="system-subtitle">${sys.subtitle}</span>
          </div>
          <span class="system-score-badge">${sys.score} <span class="score-scale">/100</span></span>
        </div>
        
        <div class="system-progress-container">
          <div class="system-slider-track">
            <div class="system-slider-thumb" style="left: ${sys.score}%;"></div>
          </div>
        </div>
        
        <table class="system-markers-table">
          <thead>
            <tr>
              <th>Marcador</th>
              <th>Valor</th>
              <th>Referência</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  });
  
  container.innerHTML = cardsHtml;
}
