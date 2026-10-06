export function getCurrentLocation({ maximumAge = 300000, enableHighAccuracy = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Your browser does not support location services."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        const messages = {
          1: "Location permission was denied. Allow location access in your browser.",
          2: "Your location is currently unavailable. Check Windows Location settings.",
          3: "Location request timed out. Try again after enabling Windows Location.",
        };

        reject(new Error(messages[error.code] || "Could not get your location."));
      },
      {
        enableHighAccuracy,
        timeout: 30000,
        maximumAge,
      }
    );
  });
}
