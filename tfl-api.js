// tfl-api.js - TFL API Integration Handler

const TFL_API = {
  // API Keys for different endpoints
  keys: {
    journey: '180551b650a54340ab343de4b7e8eb18',
    stoppoints: '11af6153acbc425089deff17c8542539',
    search: 'a45bab74cb224dee840fabda3bc1a8db',
    stationData: 'e14084ca479941199812145fab197882'
  },
  
  baseUrl: 'https://api.tfl.gov.uk',
  
  // Get station details including zones
  async getStationDetails(stationName) {
    try {
      const searchUrl = `${this.baseUrl}/StopPoint/Search/${encodeURIComponent(stationName)}?modes=tube,overground,elizabeth-line,dlr&app_key=${this.keys.search}`;
      const response = await fetch(searchUrl);
      
      if (!response.ok) {
        console.error('Station search failed:', response.status);
        return null;
      }
      
      const data = await response.json();
      
      if (data.matches && data.matches.length > 0) {
        const match = data.matches[0];
        const stationId = match.id;
        
        // Get detailed station info
        const detailUrl = `${this.baseUrl}/StopPoint/${stationId}?app_key=${this.keys.stoppoints}`;
        const detailResponse = await fetch(detailUrl);
        
        if (!detailResponse.ok) {
          console.error('Station detail fetch failed:', detailResponse.status);
          return null;
        }
        
        const stationDetail = await detailResponse.json();
        
        // Extract zones from additionalProperties
        let zones = [];
        if (stationDetail.additionalProperties) {
          const zoneProperty = stationDetail.additionalProperties.find(
            prop => prop.key === 'Zone'
          );
          if (zoneProperty && zoneProperty.value) {
            zones = zoneProperty.value.split('/').map(z => parseInt(z.trim()));
          }
        }
        
        return {
          name: stationDetail.commonName,
          zones: zones.length > 0 ? zones : [1], // Default to zone 1 if not found
          lines: stationDetail.lines ? stationDetail.lines.map(l => l.id) : []
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching station details:', error);
      return null;
    }
  },
  
  // Calculate journey fare using TFL Journey Planner API
  async calculateJourneyFare(fromStation, toStation, dateTime) {
    try {
      // For bus journeys, return fixed fare
      if (!toStation) {
        return 1.75;
      }
      
      // Parse the datetime
      const journeyDate = new Date(dateTime);
      const year = journeyDate.getFullYear();
      const month = String(journeyDate.getMonth() + 1).padStart(2, '0');
      const day = String(journeyDate.getDate()).padStart(2, '0');
      const hour = String(journeyDate.getHours()).padStart(2, '0');
      const minute = String(journeyDate.getMinutes()).padStart(2, '0');
      
      const timeParam = `${hour}${minute}`;
      const dateParam = `${year}${month}${day}`;
      
      // Search for station IDs first
      const fromSearch = await this.searchStation(fromStation);
      const toSearch = await this.searchStation(toStation);
      
      if (!fromSearch || !toSearch) {
        console.error('Could not find station IDs');
        return this.fallbackFareCalculation(fromStation, toStation, dateTime);
      }
      
      const fromId = fromSearch.id;
      const toId = toSearch.id;
      
      // Use Journey Planner API
      const journeyUrl = `${this.baseUrl}/Journey/JourneyResults/${encodeURIComponent(fromId)}/to/${encodeURIComponent(toId)}?date=${dateParam}&time=${timeParam}&app_key=${this.keys.journey}`;
      
      const response = await fetch(journeyUrl);
      
      if (!response.ok) {
        console.error('Journey API failed:', response.status);
        return this.fallbackFareCalculation(fromStation, toStation, dateTime);
      }
      
      const data = await response.json();
      
      // Extract fare from the journey data
      if (data.journeys && data.journeys.length > 0) {
        const journey = data.journeys[0];
        
        // Try to get fare information
        if (journey.fare && journey.fare.totalCost) {
          return journey.fare.totalCost / 100; // Convert pence to pounds
        }
        
        // If no fare in journey, try fares array
        if (data.fares && data.fares.length > 0) {
          const adultFare = data.fares.find(f => f.passengerType === 'Adult');
          if (adultFare && adultFare.cost) {
            return adultFare.cost / 100;
          }
        }
      }
      
      // Fallback to zone-based calculation
      return this.fallbackFareCalculation(fromStation, toStation, dateTime);
      
    } catch (error) {
      console.error('Error calculating fare:', error);
      return this.fallbackFareCalculation(fromStation, toStation, dateTime);
    }
  },
  
  // Search for a station and return its ID
  async searchStation(stationName) {
    try {
      const searchUrl = `${this.baseUrl}/StopPoint/Search/${encodeURIComponent(stationName)}?modes=tube,overground,elizabeth-line,dlr&app_key=${this.keys.search}`;
      const response = await fetch(searchUrl);
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.matches && data.matches.length > 0) {
        return {
          id: data.matches[0].id,
          name: data.matches[0].name
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error searching station:', error);
      return null;
    }
  },
  
  // Fallback fare calculation using zone data
  async fallbackFareCalculation(fromStation, toStation, dateTime) {
    const fromDetails = await this.getStationDetails(fromStation);
    const toDetails = toStation ? await this.getStationDetails(toStation) : fromDetails;
    
    if (!fromDetails || !toDetails) {
      console.warn('Using default fare - station details not found');
      return 3.40; // Default fare
    }
    
    const minFromZone = Math.min(...fromDetails.zones);
    const maxToZone = Math.max(...toDetails.zones);
    
    const isPeak = this.isPeakTime(dateTime);
    
    // 2026 TFL Fare matrix (updated with correct fares)
    const fareMatrix = {
      '1-1': { peak: 3.10, offPeak: 3.00 },
      '1-2': { peak: 3.60, offPeak: 3.10 },
      '1-3': { peak: 4.20, offPeak: 3.50 },
      '1-4': { peak: 4.80, offPeak: 3.80 },
      '1-5': { peak: 5.40, offPeak: 3.80 },
      '1-6': { peak: 5.90, offPeak: 4.20 },
      '2-2': { peak: 2.10, offPeak: 1.90 },
      '2-3': { peak: 2.50, offPeak: 2.10 },
      '2-4': { peak: 2.80, offPeak: 2.30 },
      '2-5': { peak: 3.20, offPeak: 2.50 },
      '2-6': { peak: 3.50, offPeak: 2.70 },
      '3-3': { peak: 2.10, offPeak: 1.90 },
      '3-4': { peak: 2.40, offPeak: 2.00 },
      '3-5': { peak: 2.70, offPeak: 2.20 },
      '3-6': { peak: 3.00, offPeak: 2.40 },
      '4-4': { peak: 2.10, offPeak: 1.90 },
      '4-5': { peak: 2.40, offPeak: 2.00 },
      '4-6': { peak: 2.70, offPeak: 2.20 },
      '5-5': { peak: 2.10, offPeak: 1.90 },
      '5-6': { peak: 2.40, offPeak: 2.00 },
      '6-6': { peak: 2.10, offPeak: 1.90 }
    };
    
    const zoneKey = `${minFromZone}-${maxToZone}`;
    
    if (fareMatrix[zoneKey]) {
      return isPeak ? fareMatrix[zoneKey].peak : fareMatrix[zoneKey].offPeak;
    }
    
    // Calculate based on zone difference if not in matrix
    const zoneDiff = maxToZone - minFromZone;
    return isPeak ? (3.10 + zoneDiff * 0.50) : (3.00 + zoneDiff * 0.40);
  },
  
  // Check if journey time is peak
  isPeakTime(dateTimeString) {
    const journeyDate = new Date(dateTimeString);
    const dayOfWeek = journeyDate.getDay();
    const hours = journeyDate.getHours();
    const minutes = journeyDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    
    // Weekend is always off-peak
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Weekday peak times: 06:30-09:30 and 16:00-19:00
    const morningPeakStart = 6 * 60 + 30;
    const morningPeakEnd = 9 * 60 + 30;
    const eveningPeakStart = 16 * 60;
    const eveningPeakEnd = 19 * 60;
    
    return (totalMinutes >= morningPeakStart && totalMinutes <= morningPeakEnd) ||
           (totalMinutes >= eveningPeakStart && totalMinutes <= eveningPeakEnd);
  }
};
