# TFL Tracker

A modern, intelligent London transport expense tracking application with automatic fare calculation and daily cap monitoring.

![TFL Tracker](https://img.shields.io/badge/status-active-success)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)
![TFL API](https://img.shields.io/badge/TFL_API-003688?logo=transport-for-london&logoColor=white)

## 🎯 Overview

TFL Tracker is a sophisticated web application designed to help Londoners track their Transport for London (TFL) spending using contactless payment. With automatic fare calculation, daily cap monitoring, and intelligent zone-based pricing, it helps you understand whether contactless or a monthly Travelcard offers better value for your commute.

**⚠️ Important Note**: This application uses **Supabase** as its backend database. To use this application, you'll need to set up your own Supabase project or connect it to another database provider of your choice.

## ✨ Features

### Core Functionality
- **🚇 Multi-Transport Support**: Track journeys across Underground, Overground, Elizabeth Line, DLR, Tram, and Bus
- **💰 Automatic Fare Calculation**: Real-time fare calculation using TFL API and zone-based pricing (2026 rates)
- **📊 Daily Cap Monitoring**: Track daily spending against TFL daily caps with visual indicators
- **📅 Monthly Comparison**: Compare contactless spending vs monthly Travelcard costs
- **🎯 Smart Station Search**: Autocomplete with line indicators for 900+ stations
- **⏰ Peak/Off-Peak Detection**: Automatic peak time detection for accurate fare calculation
- **📈 Visual Analytics**: Interactive charts showing spending patterns over time
- **🏠 Zone Configuration**: Set your home zone for personalized Travelcard comparisons

### User Experience
- **🎨 TFL-Inspired Design**: Authentic London transport aesthetic with official line colors
- **📱 Fully Responsive**: Seamless experience across desktop, tablet, and mobile devices
- **🔐 Secure Authentication**: Email/password authentication with Supabase Auth
- **☁️ Real-time Sync**: All journeys synchronized across devices instantly
- **💾 Auto-save**: Changes are automatically saved to the database
- **🎯 Quick Add**: Add journeys with pre-filled current date/time
- **📊 Date Grouping**: Journeys organized by date with daily totals

### Smart Features
- **🚦 Cap Status Indicators**: Visual feedback when daily cap is reached
- **💳 Travelcard Comparison**: Automatic calculation of potential savings
- **🔄 Journey Editing**: Edit or delete past journeys
- **📍 Line Badges**: Visual line indicators for each station
- **⚡ Price Loading**: Real-time fare calculation as you type

## 🚀 Demo

[**Live Demo**](https://francisarcas.github.io/tfl-journey-tracker/)

## 📱 Screenshots

### Dashboard View
- Monthly spending overview with TFL-styled summary cards
- Daily cap status and journey count
- Travelcard comparison indicator

### Journey Management
- Add journeys with station autocomplete
- Automatic fare calculation
- Edit/delete functionality

### Analytics
- Monthly spending chart
- Year/month navigation
- Daily spending breakdown

## 🛠️ Technologies Used

### Frontend
- **HTML5**: Semantic markup and structure
- **CSS3**: 
  - CSS Grid and Flexbox layouts
  - Custom properties for TFL line colors
  - Smooth animations and transitions
  - Responsive media queries
- **Vanilla JavaScript**: 
  - Modern ES6+ syntax
  - Async/await for API calls
  - DOM manipulation
  - Chart.js integration

### Backend & Database
- **Supabase**: 
  - PostgreSQL database
  - Real-time subscriptions
  - Row Level Security (RLS)
  - Authentication system

### External APIs
- **TFL Unified API**: 
  - Station search and details
  - Zone information
  - Real-time fare data (when available)

### Libraries
- **Chart.js 4.x**: Interactive data visualization
- **Font Awesome 6.5.1**: Icon library
- **Supabase JS Client 2.x**: Database connectivity

## 📦 Installation & Setup

### Prerequisites
- A Supabase account (free tier available at [supabase.com](https://supabase.com))
- TFL API keys (free at [api.tfl.gov.uk](https://api.tfl.gov.uk))
- Basic knowledge of SQL for database setup
- A web server or local development environment

### Step 1: Clone the Repository

```bash
git clone https://github.com/francisarcas/tfl-journey-tracker.git
cd tfl-journey-tracker
```

### Step 2: Set Up Supabase Database

1. Create a new project in [Supabase](https://supabase.com)
2. Run the following SQL in the Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  home_zone INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create journeys table
CREATE TABLE journeys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  transport_type TEXT NOT NULL CHECK (transport_type IN ('underground', 'overground', 'elizabeth', 'dlr', 'tram', 'bus')),
  origin_station TEXT NOT NULL,
  destination_station TEXT,
  journey_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid());

-- Create RLS Policies for journeys
CREATE POLICY "Users can view own journeys"
  ON journeys FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own journeys"
  ON journeys FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own journeys"
  ON journeys FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own journeys"
  ON journeys FOR DELETE
  USING (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX idx_journeys_user_id ON journeys(user_id);
CREATE INDEX idx_journeys_datetime ON journeys(journey_datetime);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
```

### Step 3: Configure Supabase Connection

1. Open `app.js` in your code editor
2. Locate these lines (near the top of the file):

```javascript
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

3. Replace with your Supabase project credentials:
   - Find your URL and anon key in Supabase Dashboard → Settings → API

### Step 4: Configure TFL API Keys

1. Register for free TFL API keys at [api.tfl.gov.uk](https://api.tfl.gov.uk)
2. Open `tfl-api.js` in your code editor
3. Locate the `keys` object:

```javascript
const TFL_API = {
  keys: {
    journey: 'YOUR_JOURNEY_KEY',
    stoppoints: 'YOUR_STOPPOINTS_KEY',
    search: 'YOUR_SEARCH_KEY',
    stationData: 'YOUR_STATION_DATA_KEY'
  },
  // ...
};
```

4. Replace with your TFL API keys (you can use the same key for all endpoints)

### Step 5: Create User Profile

After setting up authentication, create a profile entry for your user:

```sql
-- Replace 'user-uuid' with your actual user ID from auth.users
INSERT INTO profiles (user_id, display_name, avatar_url, home_zone)
VALUES ('user-uuid', 'Your Name', 'assets/person001.png', 4);
```

### Step 6: Add Assets

Place your avatar image in the `assets/` directory:
- `assets/person001.png` (user avatar)
- `assets/logos/tfl.png` (TFL logo)
- `assets/favicon/` (favicon files)

### Step 7: Deploy

Upload all files to your web server or use a service like:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

## 💡 Usage

### Getting Started

1. **Sign Up/Login**: Create an account or log in with existing credentials
2. **Configure Settings**: Set your home zone for accurate Travelcard comparisons
3. **Add Journey**: 
   - Select transport type
   - Choose origin (and destination for non-bus journeys)
   - Pick date/time (defaults to now)
   - Price auto-calculates based on zones and peak time
4. **Track Spending**: View daily totals, monthly spending, and Travelcard comparisons

### Adding Journeys

- **Bus Journey**: Select "Bus" transport type, choose route number or origin, leave destination empty
- **Rail Journey**: Select transport type, use autocomplete for stations, price calculates automatically
- **Edit Journey**: Click pencil icon to modify details
- **Delete Journey**: Click trash icon to remove journey

### Understanding Daily Caps

- Daily caps prevent you from paying more than a set amount per day
- Cap varies by zones traveled (e.g., Zone 1-2: £8.90)
- Once capped, remaining journeys are free
- Green "Capped!" indicator shows when daily cap is reached

### Monthly Travelcard Comparison

- Set your home zone in settings
- App calculates relevant Travelcard cost
- Red border indicates when monthly contactless exceeds Travelcard cost
- Helps decide between contactless and Travelcard

## 🎨 Customization

### Changing TFL Fare Rates

Edit the fare matrix in `tfl-api.js`:

```javascript
const fareMatrix = {
  '1-1': { peak: 2.80, offPeak: 2.80 },
  '1-2': { peak: 3.70, offPeak: 2.80 },
  // ... add or modify fares
};
```

### Adding New Transport Types

1. Update the database constraint:

```sql
ALTER TABLE journeys DROP CONSTRAINT IF EXISTS journeys_transport_type_check;
ALTER TABLE journeys ADD CONSTRAINT journeys_transport_type_check 
  CHECK (transport_type IN ('underground', 'overground', 'elizabeth', 'dlr', 'tram', 'bus', 'your_new_type'));
```

2. Add to the HTML select options:

```html
<select id="transportInput">
  <!-- existing options -->
  <option value="your_new_type">Your New Type</option>
</select>
```

3. Add CSS color variable:

```css
:root {
  --your-new-type: #HEXCOLOR;
}
```

### Customizing Station Data

Edit `station-data.js` to add/modify stations:

```javascript
const STATION_ZONES = {
  "Your Station": [1, 2], // Station name: [zones]
  // ...
};

const TFL_STATIONS = [
  {"name": "Your Station", "lines": ["central", "northern"]},
  // ...
];
```

### Modifying Daily Caps

Edit `station-data.js`:

```javascript
const DAILY_CAPS = {
  'bus': 5.25,
  '1': 8.90,
  '1-2': 8.90,
  // ... modify as needed
};
```

### Changing Monthly Travelcard Prices

Edit `station-data.js`:

```javascript
const MONTHLY_TRAVELCARD_PRICES = {
  '1': 171.70,
  '1-2': 171.70,
  // ... update with current prices
};
```

## 🔧 Alternative Database Setup

While this app is built for Supabase, you can adapt it to other providers:

### Firebase
- Use Firestore for data storage
- Firebase Authentication for users
- Adapt the database queries to Firestore syntax

### MongoDB
- MongoDB Atlas for database
- Custom Node.js/Express backend
- JWT authentication

### PostgreSQL (Self-hosted)
- Direct PostgreSQL connection
- Custom REST API
- Session-based authentication

## 🌐 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🐛 Known Issues

- TFL API occasionally returns incomplete zone data for some stations
- Fare calculation falls back to zone-based calculation when API is unavailable
- Some bus routes may not have autocomplete suggestions
- Historical fare data only accurate for 2026 rates (update annually)

## 📞 Contact

Francis Arcas - [Linkedin](https://www.linkedin.com/in/francisarcas)

Project Link: [https://francisarcas.github.io/tfl-journey-tracker/](https://francisarcas.github.io/tfl-journey-tracker/)

Repository: [https://github.com/francisarcas/tfl-journey-tracker](https://github.com/francisarcas/tfl-journey-tracker)

## 🙏 Acknowledgments

- Transport for London for the Unified API
- Chart.js for beautiful data visualization
- Supabase for backend infrastructure
- Font Awesome for comprehensive icon library
- TFL for official line colors and design inspiration

## 💼 Use Cases

- Daily commuters tracking contactless vs Travelcard value
- Occasional travelers monitoring transport spending
- Budget-conscious Londoners optimizing transport costs
- Expense tracking for work-related travel
- Students comparing payment methods
- Tourists tracking London transport expenses

## 🔮 Future Enhancements

- **Weekly Cap Tracking**: Monitor weekly spending caps
- **Route Optimization**: Suggest cheaper alternative routes
- **Export Functionality**: Export journey data to CSV/PDF
- **Budget Alerts**: Notifications when approaching spending limits
- **Multi-User Support**: Family or group expense tracking
- **Oyster Card Integration**: Track both contactless and Oyster
- **Journey Planning**: Integration with TFL journey planner
- **Receipt Generation**: Create expense receipts for reimbursement

---

**Built with ❤️ for London commuters**
