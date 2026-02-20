import { greetUser } from '$utils/greet';

// Import the widget component - it now handles all the map logic
import './widget';

window.Webflow ||= [];
window.Webflow.push(() => {
  const name = 'John Doe';
  greetUser(name);
  
  // Initialize the zone map widget
  const mapElement = document.createElement('shipnetwork-zone-map');
  mapElement.style.width = '100%';
  mapElement.style.height = '100%';
  
  const container = document.querySelector('#usps-map');
  if (container) {
    container.appendChild(mapElement);
  }
});
