// =====================================================
// CONFIGURATION & INITIALIZATION
// =====================================================

const SUPABASE_URL = "https://yrctiwerbualvmzhvngb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyY3Rpd2VyYnVhbHZtemh2bmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1OTIwMTksImV4cCI6MjA4NjE2ODAxOX0.3Fywb8kgTd0-s24jduK9BNjTtmgijTwM_r6dcbb3RzU";

let mySupabaseClient;
let currentUser = null;
let loggedInUserProfile = null;
let householdProfilesMap = new Map();

// DOM elements
let authContainer, authEmail, authPassword, authMessage;
let appContentWrapper;
let userMenu, userMenuToggle, userMenuAvatar, userMenuGreeting, userMenuUsername;

// Initialize Supabase
try {
  mySupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error("Failed to initialize Supabase client:", e);
  alert("Error: Supabase library failed to load. Please check your internet connection.");
}

// Global variables
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

const today = new Date();
let activeYear = today.getFullYear();
let activeMonth = `${activeYear}-${MONTHS[today.getMonth()]}`;

let journeys = [];
let isCalculatingFare = false;
let userHomeZone = 4;
let monthlyCardCost = 246.60;
let editingJourneyId = null;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function getGreeting(userName) {
  const hour = new Date().getHours();
  let greetingPhrase;

  if (hour >= 6 && hour < 12) {
    greetingPhrase = "Good morning";
  } else if (hour >= 12 && hour < 18) {
    greetingPhrase = "Good afternoon";
  } else if (hour >= 18 && hour < 24) {
    greetingPhrase = "Good evening";
  } else {
    greetingPhrase = "Good night";
  }
  return `${greetingPhrase},`;
}

function capitalizeLineName(line) {
  const names = {
    'northern': 'Northern',
    'victoria': 'Victoria',
    'central': 'Central',
    'piccadilly': 'Piccadilly',
    'district': 'District',
    'circle': 'Circle',
    'metropolitan': 'Metropolitan',
    'hammersmith': 'Hammersmith & City',
    'bakerloo': 'Bakerloo',
    'jubilee': 'Jubilee',
    'waterloo': 'Waterloo & City',
    'elizabeth': 'Elizabeth',
    'overground': 'Overground',
    'dlr': 'DLR',
    'tram': 'Tram',
    'bus': 'Bus'
  };
  return names[line] || line;
}

function getStationData(stationName) {
  return TFL_STATIONS.find(s => s.name === stationName);
}

function getStationZones(stationName) {
  return STATION_ZONES[stationName] || [1];
}

function getTransportIcon(transport) {
  const icons = {
    underground: '<i class="fa-solid fa-train-subway"></i>',
    overground: '<i class="fa-solid fa-train"></i>',
    elizabeth: '<i class="fa-solid fa-train-tram"></i>',
    tram: '<i class="fa-solid fa-train-tram"></i>',
    bus: '<i class="fa-solid fa-bus"></i>',
    dlr: '<i class="fa-solid fa-train"></i>'
  };
  return icons[transport] || '<i class="fa-solid fa-train"></i>';
}

function formatDate(dateString) {
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('en-GB', options);
  }
}

function getDailyCap(journeyList) {
  const allBus = journeyList.every(j => j.transport === 'bus' || j.transport === 'tram');
  
  if (allBus) {
    return DAILY_CAPS['bus'];
  }
  
  let maxZone = 1;
  journeyList.forEach(journey => {
    if (journey.transport !== 'bus' && journey.transport !== 'tram') {
      const originZones = getStationZones(journey.origin);
      const destZones = journey.destination ? getStationZones(journey.destination) : originZones;
      
      const highestZone = Math.max(...originZones, ...destZones);
      maxZone = Math.max(maxZone, highestZone);
    }
  });
  
  const capKey = maxZone === 1 ? '1' : `1-${maxZone}`;
  return DAILY_CAPS[capKey] || DAILY_CAPS['1-6'];
}

function getMonthlyCardCost(homeZone) {
  const zoneKey = homeZone === 1 ? '1' : `1-${homeZone}`;
  return MONTHLY_TRAVELCARD_PRICES[zoneKey] || 246.60;
}

// =====================================================
// AUTH FUNCTIONS
// =====================================================

async function handleAuth(type) {
  authMessage.textContent = '';
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    authMessage.textContent = 'Please enter both email and password.';
    return;
  }

  let response;
  if (type === 'signup') {
    authMessage.textContent = 'Signing up... Please wait.';
    response = await mySupabaseClient.auth.signUp({ email, password });
  } else {
    authMessage.textContent = 'Logging in...';
    response = await mySupabaseClient.auth.signInWithPassword({ email, password });
  }

  if (response.error) {
    authMessage.textContent = response.error.message;
    console.error("Auth error:", response.error);
  } else {
    if (type === 'signup' && !response.data.user?.identities?.length) {
      authMessage.textContent = 'Sign up successful! Please check your email for confirmation to log in.';
    } else {
      authMessage.textContent = 'Login successful!';
      authEmail.value = '';
      authPassword.value = '';
      currentUser = response.data.user;

      const { data: profileData, error: profileError } = await mySupabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile after auth:", profileError);
        await mySupabaseClient.auth.signOut();
        currentUser = null;
        loggedInUserProfile = null;
        authMessage.textContent = 'Login failed: Could not retrieve user profile. Please ensure you have a profile entry.';
        updateAuthUI();
      } else {
        loggedInUserProfile = profileData;
        updateAuthUI();
        await loadUserSettings();
        await fetchJourneysFromSupabase();
        updateAll();
      }
    }
  }
}

async function handleLogout() {
  // Uncheck the menu toggle first
  const menuToggle = document.getElementById('userMenuToggle');
  if (menuToggle) {
    menuToggle.checked = false;
  }
  
  const { error } = await mySupabaseClient.auth.signOut();
  if (error) {
    console.error("Logout error:", error);
    alert("Error logging out: " + error.message);
  } else {
    currentUser = null;
    loggedInUserProfile = null;
    householdProfilesMap.clear();
    journeys = [];
    editingJourneyId = null;
    updateAuthUI();
    updateAll();
  }
}

function updateAuthUI() {
  if (currentUser && loggedInUserProfile) {
    authContainer.style.display = 'none';
    appContentWrapper.style.display = 'block';
    userMenu.style.display = 'block';

    const personName = loggedInUserProfile.display_name;
    const avatarSrc = loggedInUserProfile.avatar_url || "assets/person001.png";

    userMenuAvatar.src = avatarSrc;
    userMenuGreeting.textContent = getGreeting(personName);
    userMenuUsername.textContent = personName;
    userMenuToggle.checked = false;
  } else {
    authContainer.style.display = 'block';
    appContentWrapper.style.display = 'none';
    userMenu.style.display = 'none';

    userMenuAvatar.src = "";
    userMenuGreeting.textContent = "";
    userMenuUsername.textContent = "";
    userMenuToggle.checked = false;
  }
}

// =====================================================
// SUPABASE DATA FUNCTIONS
// =====================================================

async function fetchJourneysFromSupabase() {
  if (!mySupabaseClient || !currentUser || !loggedInUserProfile) {
    journeys = [];
    return;
  }

  const { data: allJourneys, error } = await mySupabaseClient
    .from('journeys')
    .select('*')
    .eq('household_id', loggedInUserProfile.household_id)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) {
    console.error("Error fetching journeys:", error);
    alert("Error loading journeys. Please check the console.");
    return;
  }

  journeys = allJourneys.map(j => ({
    ...j,
    price: parseFloat(j.price)
  }));
}

async function saveJourneyToSupabase(journey) {
  if (!currentUser || !loggedInUserProfile) {
    alert("You must be logged in to add a journey.");
    return false;
  }

  const { data, error } = await mySupabaseClient
    .from('journeys')
    .insert([{
      user_id: currentUser.id,
      household_id: loggedInUserProfile.household_id,
      person: loggedInUserProfile.role,
      date: journey.date,
      time: journey.time,
      transport: journey.transport,
      origin: journey.origin,
      destination: journey.destination,
      price: journey.price,
      month: journey.month
    }])
    .select();

  if (error) {
    console.error("Error saving journey:", error);
    alert("Error saving journey. Please check the console.");
    return false;
  }

  return true;
}

async function updateJourneyInSupabase(id, journey) {
  if (!currentUser || !loggedInUserProfile) {
    alert("You must be logged in to edit a journey.");
    return false;
  }

  const { error } = await mySupabaseClient
    .from('journeys')
    .update({
      date: journey.date,
      time: journey.time,
      transport: journey.transport,
      origin: journey.origin,
      destination: journey.destination,
      price: journey.price,
      month: journey.month
    })
    .eq('id', id)
    .eq('household_id', loggedInUserProfile.household_id);

  if (error) {
    console.error("Error updating journey:", error);
    alert("Error updating journey. Please check the console.");
    return false;
  }

  return true;
}

async function deleteJourneyFromSupabase(id) {
  const { error } = await mySupabaseClient
    .from('journeys')
    .delete()
    .eq('id', id)
    .eq('household_id', loggedInUserProfile.household_id);

  if (error) {
    console.error("Error deleting journey:", error);
    alert("Error deleting journey. Please check the console.");
    return false;
  }

  return true;
}

// =====================================================
// SETTINGS FUNCTIONS
// =====================================================

async function loadUserSettings() {
  if (!currentUser) return;

  const { data, error } = await mySupabaseClient
    .from('user_settings')
    .select('*')
    .eq('user_id', currentUser.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Error loading settings:", error);
    return;
  }

  if (data) {
    userHomeZone = data.home_zone;
    monthlyCardCost = getMonthlyCardCost(userHomeZone);
  }
}

async function saveUserSettings() {
  if (!currentUser) return;

  const { data, error } = await mySupabaseClient
    .from('user_settings')
    .upsert({
      user_id: currentUser.id,
      home_zone: userHomeZone
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error("Error saving settings:", error);
    alert("Error saving settings. Please try again.");
  }
}

function openSettings() {
  document.getElementById('settingsModal').classList.add('active');
  document.getElementById('homeZoneSelect').value = userHomeZone.toString();
  updateTravelcardCostDisplay();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('active');
}

function updateTravelcardCostDisplay() {
  const selectedZone = parseInt(document.getElementById('homeZoneSelect').value);
  const cost = getMonthlyCardCost(selectedZone);
  document.getElementById('travelcardCostDisplay').textContent = `£${cost.toFixed(2)}`;
}

async function saveSettings() {
  userHomeZone = parseInt(document.getElementById('homeZoneSelect').value);
  monthlyCardCost = getMonthlyCardCost(userHomeZone);
  await saveUserSettings();
  closeSettings();
  updateAll();
  
  const btn = document.querySelector('.save-settings-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
  setTimeout(() => {
    btn.innerHTML = originalText;
  }, 2000);
}

// =====================================================
// JOURNEY FORM FUNCTIONS
// =====================================================

function setupAutoPriceCalculation() {
  const dateTimeInput = document.getElementById('dateTimeInput');
  const transportInput = document.getElementById('transportInput');
  const originInput = document.getElementById('originInput');
  const destinationInput = document.getElementById('destinationInput');
  const priceInput = document.getElementById('priceInput');
  const loadingIndicator = document.getElementById('priceLoadingIndicator');
  
  let calculationTimeout;
  let lastCalculation = { origin: '', destination: '', dateTime: '', transport: '' };
  
  async function updatePrice() {
    const transport = transportInput.value;
    const origin = originInput.value.trim();
    const destination = destinationInput.value.trim();
    const dateTime = dateTimeInput.value;
    
    if (!dateTime || !origin) return;
    if (transport !== 'bus' && transport !== 'tram' && !destination) return;
    
    if (lastCalculation.origin === origin && 
        lastCalculation.destination === destination && 
        lastCalculation.dateTime === dateTime &&
        lastCalculation.transport === transport) {
      return;
    }
    
    if (isCalculatingFare) return;
    
    isCalculatingFare = true;
    loadingIndicator.classList.add('active');
    priceInput.value = '';
    
    try {
      const fare = await TFL_API.calculateJourneyFare(
        origin, 
        (transport === 'bus' || transport === 'tram') ? null : destination,
        dateTime
      );
      
      priceInput.value = fare.toFixed(2);
      
      lastCalculation = { origin, destination, dateTime, transport };
      
      console.log(`Calculated fare: £${fare.toFixed(2)} (${TFL_API.isPeakTime(dateTime) ? 'Peak' : 'Off-Peak'})`);
    } catch (error) {
      console.error('Error calculating fare:', error);
      priceInput.value = '3.40';
    } finally {
      isCalculatingFare = false;
      loadingIndicator.classList.remove('active');
    }
  }
  
  function scheduleUpdate() {
    clearTimeout(calculationTimeout);
    calculationTimeout = setTimeout(updatePrice, 500);
  }
  
  dateTimeInput.addEventListener('change', scheduleUpdate);
  transportInput.addEventListener('change', scheduleUpdate);
  
  originInput.addEventListener('blur', scheduleUpdate);
  destinationInput.addEventListener('blur', scheduleUpdate);
}

function setupStationAutocomplete(inputId, suggestionsId) {
  const input = document.getElementById(inputId);
  const suggestionsDiv = document.getElementById(suggestionsId);
  
  input.addEventListener('input', () => {
    const query = input.value.toLowerCase().trim();
    const transport = document.getElementById('transportInput').value;
    
    if (query.length === 0) {
      suggestionsDiv.style.display = 'none';
      return;
    }
    
    let filteredStations;
    if (transport === 'bus') {
      filteredStations = TFL_STATIONS.filter(station => 
        station.lines.includes('bus') && station.name.toLowerCase().includes(query)
      );
    } else if (transport === 'tram') {
      filteredStations = TFL_STATIONS.filter(station => 
        station.lines.includes('tram') && station.name.toLowerCase().includes(query)
      );
    } else {
      filteredStations = TFL_STATIONS.filter(station => 
        !station.lines.includes('bus') && !station.lines.includes('tram') && station.name.toLowerCase().includes(query)
      );
    }
    
    const matches = filteredStations.slice(0, 10);
    
    if (matches.length === 0) {
      suggestionsDiv.style.display = 'none';
      return;
    }
    
    suggestionsDiv.innerHTML = '';
    matches.forEach(station => {
      const item = document.createElement('div');
      item.className = 'station-suggestion-item';
      
      const lineBadges = station.lines.map(line => 
        `<div class="line-badge ${line}" title="${capitalizeLineName(line)}"></div>`
      ).join('');
      
      item.innerHTML = `
        <span class="station-name">${station.name}</span>
        <div class="line-indicators">${lineBadges}</div>
      `;
      
      item.onclick = () => {
        input.value = station.name;
        suggestionsDiv.style.display = 'none';
        input.dispatchEvent(new Event('blur'));
      };
      
      suggestionsDiv.appendChild(item);
    });
    
    suggestionsDiv.style.display = 'block';
  });
  
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestionsDiv.contains(e.target)) {
      suggestionsDiv.style.display = 'none';
    }
  });
  
  input.addEventListener('focus', () => {
    if (input.value.trim().length > 0) {
      input.dispatchEvent(new Event('input'));
    }
  });
}

function handleTransportChange() {
  const transport = document.getElementById('transportInput').value;
  const destinationGroup = document.getElementById('destinationGroup');
  const originLabel = document.getElementById('originLabel');
  const originInput = document.getElementById('originInput');
  
  if (transport === 'bus') {
    destinationGroup.style.display = 'none';
    document.getElementById('destinationInput').value = '';
    originLabel.textContent = 'Bus Route';
    originInput.placeholder = 'Select bus number';
  } else if (transport === 'tram') {
    destinationGroup.style.display = 'block';
    originLabel.textContent = 'From';
    originInput.placeholder = 'Origin tram stop';
    document.getElementById('destinationInput').placeholder = 'Destination tram stop';
  } else {
    destinationGroup.style.display = 'block';
    originLabel.textContent = 'From';
    originInput.placeholder = 'Origin station';
    document.getElementById('destinationInput').placeholder = 'Destination station';
  }
  
  originInput.value = '';
  document.getElementById('destinationInput').value = '';
  document.getElementById('priceInput').value = '';
}

async function addJourney() {
  const dateTimeValue = document.getElementById('dateTimeInput').value;
  const transport = document.getElementById('transportInput').value;
  const origin = document.getElementById('originInput').value.trim();
  const destination = document.getElementById('destinationInput').value.trim();
  const price = parseFloat(document.getElementById('priceInput').value);
  
  if (!dateTimeValue) {
    alert('Please enter a date and time');
    return;
  }
  
  const [dateStr, timeStr] = dateTimeValue.split('T');
  const time = timeStr;
  const dateObj = new Date(dateStr + 'T00:00:00');
  const year = dateObj.getFullYear();
  const monthIndex = dateObj.getMonth();
  const correctMonth = `${year}-${MONTHS[monthIndex]}`;
  
  if (!origin) {
    alert(transport === 'bus' || transport === 'tram' ? 'Please select a bus route' : 'Please enter an origin station');
    return;
  }
  
  if (transport !== 'bus' && transport !== 'tram' && !destination) {
    alert('Please enter a destination station');
    return;
  }
  
  if (!price || price <= 0) {
    alert('Please enter a valid price');
    return;
  }
  
  const journey = {
    date: dateStr,
    time: time,
    transport: transport,
    origin: origin,
    destination: (transport === 'bus' || transport === 'tram') ? null : destination,
    price: price,
    month: correctMonth
  };
  
  let success;
  if (editingJourneyId) {
    success = await updateJourneyInSupabase(editingJourneyId, journey);
    if (success) {
      editingJourneyId = null;
      document.getElementById('addJourneyBtn').innerHTML = '<i class="fa-solid fa-circle-plus"></i>';
    }
  } else {
    success = await saveJourneyToSupabase(journey);
  }
  
  if (success) {
    document.getElementById('originInput').value = '';
    document.getElementById('destinationInput').value = '';
    document.getElementById('priceInput').value = '';
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('dateTimeInput').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    await fetchJourneysFromSupabase();
    updateAll();
    
    console.log('Journey ' + (editingJourneyId ? 'updated' : 'added') + ':', journey);
  }
}

function editJourney(id) {
  const journey = journeys.find(j => j.id === id);
  if (!journey) return;
  
  editingJourneyId = id;
  
  document.getElementById('dateTimeInput').value = `${journey.date}T${journey.time}`;
  document.getElementById('transportInput').value = journey.transport;
  handleTransportChange();
  document.getElementById('originInput').value = journey.origin;
  if (journey.destination) {
    document.getElementById('destinationInput').value = journey.destination;
  }
  document.getElementById('priceInput').value = journey.price.toFixed(2);
  
  document.getElementById('addJourneyBtn').innerHTML = '<i class="fa-solid fa-check"></i>';
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteJourney(id) {
  if (!confirm('Delete this journey?')) return;
  
  const success = await deleteJourneyFromSupabase(id);
  
  if (success) {
    if (editingJourneyId === id) {
      editingJourneyId = null;
      document.getElementById('addJourneyBtn').innerHTML = '<i class="fa-solid fa-circle-plus"></i>';
    }
    await fetchJourneysFromSupabase();
    updateAll();
  }
}

// =====================================================
// RENDERING FUNCTIONS
// =====================================================

function renderYears() {
  const yearTabsDiv = document.getElementById('yearTabs');
  yearTabsDiv.innerHTML = '';
  
  const years = new Set([activeYear]);
  journeys.forEach(j => {
    const year = parseInt(j.date.substring(0, 4));
    years.add(year);
  });
  
  [...years].sort().forEach(year => {
    const tab = document.createElement('div');
    tab.className = 'year-tab';
    if (year === activeYear) tab.classList.add('active');
    
    let yearHasExcess = false;
    MONTHS.forEach(month => {
      const monthKey = `${year}-${month}`;
      const monthJourneys = journeys.filter(j => j.month === monthKey);
      
      const dailyCosts = {};
      monthJourneys.forEach(j => {
        if (!dailyCosts[j.date]) {
          dailyCosts[j.date] = [];
        }
        dailyCosts[j.date].push(j);
      });
      
      let monthEffectiveSpend = 0;
      Object.keys(dailyCosts).forEach(date => {
        const dayJourneys = dailyCosts[date];
        const dayTotal = dayJourneys.reduce((sum, j) => sum + j.price, 0);
        const dailyCap = getDailyCap(dayJourneys);
        monthEffectiveSpend += Math.min(dayTotal, dailyCap);
      });
      
      if (monthEffectiveSpend >= monthlyCardCost) {
        yearHasExcess = true;
      }
    });
    
    if (yearHasExcess) {
      tab.classList.add('exceeds-card');
    }
    
    tab.textContent = year;
    tab.onclick = () => {
      activeYear = year;
      const currentMonthAbbr = activeMonth.substring(5, 8);
      activeMonth = `${activeYear}-${currentMonthAbbr}`;
      updateAll();
    };
    yearTabsDiv.appendChild(tab);
  });
}

function renderMonths() {
  const monthTabsDiv = document.getElementById('monthTabs');
  monthTabsDiv.innerHTML = '';
  
  MONTHS.forEach((month, index) => {
    const monthKey = `${activeYear}-${month}`;
    const tab = document.createElement('div');
    tab.className = 'month-tab';
    if (monthKey === activeMonth) tab.classList.add('active');
    
    const monthJourneys = journeys.filter(j => j.month === monthKey);
    const dailyCosts = {};
    monthJourneys.forEach(j => {
      if (!dailyCosts[j.date]) {
        dailyCosts[j.date] = [];
      }
      dailyCosts[j.date].push(j);
    });
    
    let monthEffectiveSpend = 0;
    Object.keys(dailyCosts).forEach(date => {
      const dayJourneys = dailyCosts[date];
      const dayTotal = dayJourneys.reduce((sum, j) => sum + j.price, 0);
      const dailyCap = getDailyCap(dayJourneys);
      monthEffectiveSpend += Math.min(dayTotal, dailyCap);
    });
    
    if (monthEffectiveSpend >= monthlyCardCost) {
      tab.classList.add('exceeds-card');
    }
    
    tab.textContent = month;
    tab.onclick = () => {
      activeMonth = monthKey;
      updateAll();
    };
    monthTabsDiv.appendChild(tab);
  });
  setTimeout(() => {
    const activeTab = monthTabsDiv.querySelector('.month-tab.active');
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, 100);
}

function renderJourneys() {
  const journeyListDiv = document.getElementById('journeyList');
  
  const monthJourneys = journeys.filter(j => j.month === activeMonth);
  
  if (monthJourneys.length === 0) {
    journeyListDiv.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-train-subway"></i>
        <h3>No journeys this month</h3>
        <p>Add your first journey above to start tracking</p>
      </div>
    `;
    return;
  }
  
  const groupedByDate = {};
  monthJourneys.forEach(j => {
    if (!groupedByDate[j.date]) {
      groupedByDate[j.date] = [];
    }
    groupedByDate[j.date].push(j);
  });
  
  const sortedDates = Object.keys(groupedByDate).sort().reverse();
  
  journeyListDiv.innerHTML = '';
  
  sortedDates.forEach(date => {
    const dateJourneys = groupedByDate[date];
    const dateTotal = dateJourneys.reduce((sum, j) => sum + j.price, 0);
    const dailyCap = getDailyCap(dateJourneys);
    const isCapped = dateTotal >= dailyCap;
    
    const dateGroup = document.createElement('div');
    dateGroup.className = 'journey-date-group';
    
    const dateHeader = document.createElement('div');
    dateHeader.className = 'journey-date-header';
    dateHeader.innerHTML = `
      <span>${formatDate(date)}</span>
      <span>
        <span class="date-total">£${dateTotal.toFixed(2)}</span>
        ${isCapped ? `<span class="date-capped">⚡ Capped at £${dailyCap.toFixed(2)}</span>` : ''}
      </span>
    `;
    dateGroup.appendChild(dateHeader);
    
    dateJourneys.sort((a, b) => a.time.localeCompare(b.time));
    
    dateJourneys.forEach(journey => {
      const item = document.createElement('div');
      item.className = 'journey-item';
      
      const originStation = getStationData(journey.origin);
      const destinationStation = journey.destination ? getStationData(journey.destination) : null;
      
      const originBadges = originStation ? originStation.lines.map(line => 
        `<div class="line-badge ${line}" title="${capitalizeLineName(line)}"></div>`
      ).join('') : '';
      
      const destinationBadges = destinationStation ? destinationStation.lines.map(line => 
        `<div class="line-badge ${line}" title="${capitalizeLineName(line)}"></div>`
      ).join('') : '';
      
      const route = journey.destination 
        ? `
          <span class="station-with-lines">
            ${journey.origin}
            <span class="line-indicators">${originBadges}</span>
          </span>
          <span class="arrow">→</span>
          <span class="station-with-lines">
            ${journey.destination}
            <span class="line-indicators">${destinationBadges}</span>
          </span>
        `
        : `
          <span class="station-with-lines">
            ${journey.origin}
            <span class="line-indicators">${originBadges}</span>
          </span>
        `;
      
      item.innerHTML = `
        <div class="journey-left">
          <div class="journey-time">${journey.time.substring(0, 5)}</div>
          <div class="journey-icon ${journey.transport}">
            ${getTransportIcon(journey.transport)}
          </div>
          <div class="journey-details">
            <div class="journey-route">${route}</div>
            <div class="journey-transport">${capitalizeLineName(journey.transport)}</div>
          </div>
        </div>
        <div class="journey-right">
          <div class="journey-price">£${journey.price.toFixed(2)}</div>
          <div class="journey-actions">
            <span class="action edit" onclick="editJourney('${journey.id}')" title="Edit journey">
              <i class="fa-solid fa-pencil"></i>
            </span>
            <span class="action delete" onclick="deleteJourney('${journey.id}')" title="Delete journey">
              <i class="fa-solid fa-trash"></i>
            </span>
          </div>
        </div>
      `;
      
      dateGroup.appendChild(item);
    });
    
    journeyListDiv.appendChild(dateGroup);
  });
}

function updateSummary() {
  const monthJourneys = journeys.filter(j => j.month === activeMonth);
  
  const dailyCosts = {};
  monthJourneys.forEach(j => {
    if (!dailyCosts[j.date]) {
      dailyCosts[j.date] = [];
    }
    dailyCosts[j.date].push(j);
  });
  
  let totalEffectiveSpend = 0;
  Object.keys(dailyCosts).forEach(date => {
    const dayJourneys = dailyCosts[date];
    const dayTotal = dayJourneys.reduce((sum, j) => sum + j.price, 0);
    const dailyCap = getDailyCap(dayJourneys);
    totalEffectiveSpend += Math.min(dayTotal, dailyCap);
  });
  
  const journeyCount = monthJourneys.length;
  
  document.getElementById('currentMonthSpend').textContent = `£${totalEffectiveSpend.toFixed(2)}`;
  document.getElementById('journeyCount').textContent = `${journeyCount} journey${journeyCount !== 1 ? 's' : ''}`;
  
  const comparisonCard = document.getElementById('comparisonCard');
  const comparisonLabel = document.getElementById('comparisonLabel');
  const comparisonValue = document.getElementById('comparison');
  const comparisonText = document.getElementById('comparisonText');
  
  const zoneText = userHomeZone === 1 ? 'Zone 1' : `Zones 1-${userHomeZone}`;
  comparisonLabel.textContent = `Monthly Card (${zoneText})`;
  
  comparisonCard.classList.remove('exceeds-monthly');
  
  if (totalEffectiveSpend === 0) {
    comparisonValue.textContent = '-';
    comparisonText.textContent = 'Start tracking to compare';
  } else {
    const difference = monthlyCardCost - totalEffectiveSpend;
    
    if (difference > 0) {
      comparisonValue.textContent = `£${difference.toFixed(2)}`;
      comparisonText.textContent = 'Saved with contactless';
    } else {
      comparisonCard.classList.add('exceeds-monthly');
      comparisonValue.textContent = `£${Math.abs(difference).toFixed(2)}`;
      comparisonText.textContent = 'Oyster card would save money';
    }
  }
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayJourneys = journeys.filter(j => j.date === todayStr);
  const todayTotal = todayJourneys.reduce((sum, j) => sum + j.price, 0);
  
  const todaySpendEl = document.getElementById('todaySpend');
  const capStatusEl = document.getElementById('capStatus');
  
  todaySpendEl.textContent = `£${todayTotal.toFixed(2)}`;
  
  if (todayJourneys.length === 0) {
    capStatusEl.textContent = 'No journeys today';
  } else {
    const dailyCap = getDailyCap(todayJourneys);
    
    if (todayTotal >= dailyCap) {
      capStatusEl.textContent = `⚡ Daily cap reached (£${dailyCap.toFixed(2)})`;
    } else {
      const remaining = dailyCap - todayTotal;
      capStatusEl.textContent = `£${remaining.toFixed(2)} until cap (£${dailyCap.toFixed(2)})`;
    }
  }
}

// =====================================================
// CHART FUNCTIONS
// =====================================================

let spendingChart;

function initChart() {
  const ctx = document.getElementById('spendingChart');
  spendingChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [{
        label: 'Monthly Spend',
        data: new Array(12).fill(0),
        backgroundColor: '#0a84ff',
        borderRadius: 8,
        barPercentage: 0.7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return '£' + context.parsed.y.toFixed(2);
            }
          },
          backgroundColor: 'var(--tooltip-bg)',
          titleColor: 'white',
          bodyColor: 'white'
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#f5f5f7'
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: '#2a2a31'
          },
          ticks: {
            color: '#f5f5f7',
            callback: function(value) {
              return '£' + value;
            }
          }
        }
      }
    }
  });
}

function updateChart() {
  const yearJourneys = journeys.filter(j => j.date.startsWith(activeYear.toString()));
  const monthlyData = new Array(12).fill(0);
  
  const monthlyDailyCosts = {};
  
  yearJourneys.forEach(j => {
    const monthIndex = MONTHS.indexOf(j.month.split('-')[1]);
    if (monthIndex !== -1) {
      if (!monthlyDailyCosts[monthIndex]) {
        monthlyDailyCosts[monthIndex] = {};
      }
      if (!monthlyDailyCosts[monthIndex][j.date]) {
        monthlyDailyCosts[monthIndex][j.date] = [];
      }
      monthlyDailyCosts[monthIndex][j.date].push(j);
    }
  });
  
  const barColors = new Array(12).fill('#0a84ff');
  
  Object.keys(monthlyDailyCosts).forEach(monthIndex => {
    const dailyCosts = monthlyDailyCosts[monthIndex];
    let monthTotal = 0;
    
    Object.keys(dailyCosts).forEach(date => {
      const dayJourneys = dailyCosts[date];
      const dayTotal = dayJourneys.reduce((sum, j) => sum + j.price, 0);
      const dailyCap = getDailyCap(dayJourneys);
      
      monthTotal += Math.min(dayTotal, dailyCap);
    });
    
    monthlyData[monthIndex] = monthTotal;
    
    if (monthTotal >= monthlyCardCost) {
      barColors[monthIndex] = '#ff453a';
    }
  });
  
  spendingChart.data.datasets[0].data = monthlyData;
  spendingChart.data.datasets[0].backgroundColor = barColors;
  spendingChart.update();
}

// =====================================================
// MAIN UPDATE FUNCTION
// =====================================================

function updateAll() {
  renderYears();
  renderMonths();
  renderJourneys();
  updateSummary();
  updateChart();
}

// =====================================================
// APP INITIALIZATION
// =====================================================

async function initApp() {
  console.log('TFL Journey Tracker - Contactless vs Oyster Comparison Tool');
  console.log('Total stations loaded:', TFL_STATIONS.length);
  
  authContainer = document.getElementById('authContainer');
  authEmail = document.getElementById('authEmail');
  authPassword = document.getElementById('authPassword');
  authMessage = document.getElementById('authMessage');
  appContentWrapper = document.getElementById('appContentWrapper');
  userMenu = document.getElementById('user-menu');
  userMenuToggle = document.getElementById('userMenuToggle');
  userMenuAvatar = document.getElementById('userMenuAvatar');
  userMenuGreeting = document.getElementById('userMenuGreeting');
  userMenuUsername = document.getElementById('userMenuUsername');
  
  // Setup logout button event listener
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleLogout();
    });
  }
  
  if (!currentUser) {
    const { data: { session }, error } = await mySupabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      const { data: profileData, error: profileError } = await mySupabaseClient
        .from('profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (profileError) {
        console.error("Error fetching user profile during initApp:", profileError);
        await mySupabaseClient.auth.signOut();
        currentUser = null;
        loggedInUserProfile = null;
      } else {
        loggedInUserProfile = profileData;
      }
    }
  }

  updateAuthUI();

  if (currentUser && loggedInUserProfile) {
    await loadUserSettings();
    await fetchJourneysFromSupabase();
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('dateTimeInput').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    initChart();
    
    document.getElementById('transportInput').addEventListener('change', handleTransportChange);
    document.getElementById('homeZoneSelect').addEventListener('change', updateTravelcardCostDisplay);
    
    setupStationAutocomplete('originInput', 'originSuggestions');
    setupStationAutocomplete('destinationInput', 'destinationSuggestions');
    setupAutoPriceCalculation();
    
    updateAll();
  }
}

document.addEventListener('DOMContentLoaded', initApp);
