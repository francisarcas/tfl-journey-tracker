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
  
  // Calculate journey fare using zone-based calculation
  async calculateJourneyFare(fromStation, toStation, dateTime) {
    try {
      // For bus journeys, return fixed fare
      if (!toStation) {
        return 1.75;
      }
      
      // Always use zone-based calculation
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
    // First try to get zone info from STATION_ZONES (from station-data.js)
    let fromZones = STATION_ZONES[fromStation];
    let toZones = toStation ? STATION_ZONES[toStation] : fromZones;
    
    // If not found in STATION_ZONES, try API
    if (!fromZones) {
      const fromDetails = await this.getStationDetails(fromStation);
      fromZones = fromDetails ? fromDetails.zones : [1];
    }
    
    if (!toZones && toStation) {
      const toDetails = await this.getStationDetails(toStation);
      toZones = toDetails ? toDetails.zones : [1];
    }
    
    // Default to zone 1 if still not found
    if (!fromZones) fromZones = [1];
    if (!toZones) toZones = [1];
    
    // Calculate the highest zone traveled through
    const allZones = [...fromZones, ...toZones];
    const highestZone = Math.max(...allZones);
    
    const isPeak = this.isPeakTime(dateTime);
    
    // 2026 TFL Fare matrix - CORRECTED with real TFL contactless fares
    const fareMatrix = {
      '1-1': { peak: 2.80, offPeak: 2.80 },
      '1-2': { peak: 3.70, offPeak: 2.80 },
      '1-3': { peak: 4.10, offPeak: 2.90 },
      '1-4': { peak: 4.60, offPeak: 3.40 },
      '1-5': { peak: 5.10, offPeak: 3.40 },
      '1-6': { peak: 5.60, offPeak: 3.40 },
      '2-2': { peak: 2.50, offPeak: 1.90 },
      '2-3': { peak: 2.50, offPeak: 1.90 },
      '2-4': { peak: 2.50, offPeak: 1.90 },
      '2-5': { peak: 3.00, offPeak: 1.90 },
      '2-6': { peak: 3.00, offPeak: 1.90 },
      '3-3': { peak: 2.50, offPeak: 1.90 },
      '3-4': { peak: 2.50, offPeak: 1.90 },
      '3-5': { peak: 3.00, offPeak: 1.90 },
      '3-6': { peak: 3.00, offPeak: 1.90 },
      '4-4': { peak: 2.50, offPeak: 2.20 },
      '4-5': { peak: 3.00, offPeak: 2.20 },
      '4-6': { peak: 3.00, offPeak: 2.20 },
      '5-5': { peak: 3.00, offPeak: 2.20 },
      '5-6': { peak: 3.00, offPeak: 2.20 },
      '6-6': { peak: 3.00, offPeak: 2.20 }
    };
    
    // Determine the fare zone key
    // If journey crosses zone 1, use 1-X format
    // Otherwise use min-max format
    const minZone = Math.min(...allZones);
    const maxZone = Math.max(...allZones);
    
    let zoneKey;
    if (minZone === 1) {
      // Journey involves Zone 1
      zoneKey = maxZone === 1 ? '1-1' : `1-${maxZone}`;
    } else {
      // Journey doesn't involve Zone 1
      zoneKey = minZone === maxZone ? `${minZone}-${minZone}` : `${minZone}-${maxZone}`;
    }
    
    console.log(`Fare calculation: ${fromStation} (zones: ${fromZones}) → ${toStation} (zones: ${toZones})`);
    console.log(`Zone key: ${zoneKey}, Peak: ${isPeak}`);
    
    if (fareMatrix[zoneKey]) {
      const fare = isPeak ? fareMatrix[zoneKey].peak : fareMatrix[zoneKey].offPeak;
      console.log(`Fare: £${fare.toFixed(2)}`);
      return fare;
    }
    
    // Fallback calculation if zone combination not in matrix
    console.warn('Using fallback calculation for zone:', zoneKey);
    return isPeak ? 4.60 : 3.40;
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
