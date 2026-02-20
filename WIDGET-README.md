# ShipNetwork Zone Map Widget

A responsive, embeddable USPS shipping zone calculator with multi-warehouse support. Works seamlessly across mobile, tablet, and desktop devices.

## Features

- ✅ **Fully Responsive**: Adapts to any container size
- 📱 **Mobile Optimized**: Bottom sheet UI with swipe gestures
- 🏢 **Multi-Warehouse Support**: Select multiple warehouses to visualize optimal shipping zones
- 🎯 **Smart Zone Blending**: Shows minimum zone number from all selected warehouses
- 📍 **Custom ZIP Calculation**: Calculate zones between any two ZIP codes
- 🔒 **Shadow DOM Isolation**: Complete style isolation from host page
- ⚡ **Lightweight**: Fast loading and smooth performance

## Quick Start

### 1. Installation via CDN

Add the following code to your HTML:

```html
<!-- Required: Mapbox GL JS -->
<link href="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.css" rel="stylesheet" />
<script src="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.js"></script>

<!-- ShipNetwork Zone Map Widget -->
<script src="https://cdn.jsdelivr.net/gh/YOUR-ORG/usps-zone-map@latest/dist/shipnetwork-zone-map.js"></script>
```

### 2. Add the Widget Element

```html
<shipnetwork-zone-map 
  style="width: 100%; height: 600px;"
  mapbox-token="YOUR_MAPBOX_TOKEN">
</shipnetwork-zone-map>
```

**Note:** Replace `YOUR_MAPBOX_TOKEN` with your Mapbox access token. Get one for free at [mapbox.com](https://account.mapbox.com/).

## Configuration

### Attributes

The widget supports the following attributes:

```html
<shipnetwork-zone-map 
  mapbox-token="pk.your_token_here"
  initial-warehouses="chicago,atlanta"
  theme="light"
  mobile-breakpoint="768">
</shipnetwork-zone-map>
```

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `mapbox-token` | string | Required | Your Mapbox API token |
| `initial-warehouses` | string | `""` | Comma-separated warehouse IDs to pre-select |
| `theme` | string | `"light"` | Visual theme (light/dark) |
| `mobile-breakpoint` | number | `768` | Width (px) below which mobile UI is shown |

### Warehouse IDs

Available warehouse locations:

- `anaheim` - Anaheim, CA
- `las-vegas` - Las Vegas, NV
- `reno` - Reno, NV
- `salt-lake-city` - Salt Lake City, UT
- `chicago` - Chicago, IL
- `houston` - Houston, TX
- `atlanta` - Atlanta, GA
- `olean` - Olean, NY
- `scranton` - Scranton, PA
- `west-hazleton` - West Hazleton, PA

## Events

The widget emits custom events that you can listen to:

```javascript
const widget = document.querySelector('shipnetwork-zone-map');

// Map is ready and initialized
widget.addEventListener('map-ready', (e) => {
  console.log('Map ready:', e.detail.map);
});

// Warehouse selection changed
widget.addEventListener('warehouse-selected', (e) => {
  console.log('Warehouse:', e.detail.warehouseId, 'Selected:', e.detail.selected);
});

// Zone calculation completed
widget.addEventListener('zone-calculated', (e) => {
  console.log('Zone:', e.detail.zone, 'Distance:', e.detail.distance);
});
```

## Responsive Behavior

### Mobile (< 768px)
- Bottom sheet UI with swipe gestures
- Large tap targets (44px minimum)
- Full-width controls
- Compact legend

### Tablet (768px - 1024px)
- Side panels (collapsible)
- Medium-sized controls
- Optimized for portrait and landscape

### Desktop (> 1024px)
- Panels on left and right sides
- Hover interactions
- Full feature set

## Styling

The widget uses Shadow DOM for complete style isolation. You can style the widget container but not its internals:

```css
/* Correct: Style the container */
shipnetwork-zone-map {
  width: 100%;
  height: 600px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

/* Note: Internal styles are isolated via Shadow DOM */
```

## Browser Support

- ✅ Chrome/Edge 88+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ iOS Safari 14+
- ✅ Chrome Android

## Examples

### Basic Usage

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/YOUR-ORG/usps-zone-map@latest/dist/shipnetwork-zone-map.js"></script>
</head>
<body>
  <shipnetwork-zone-map style="width: 100%; height: 600px;"></shipnetwork-zone-map>
</body>
</html>
```

### With Pre-selected Warehouses

```html
<shipnetwork-zone-map 
  style="width: 100%; height: 600px;"
  initial-warehouses="chicago,atlanta,houston">
</shipnetwork-zone-map>
```

### Responsive Container

```html
<div style="width: 100%; max-width: 1200px; margin: 0 auto;">
  <shipnetwork-zone-map 
    style="width: 100%; height: clamp(400px, 60vh, 800px);">
  </shipnetwork-zone-map>
</div>
```

### Event Handling

```html
<shipnetwork-zone-map id="my-map"></shipnetwork-zone-map>

<script>
  const map = document.getElementById('my-map');
  
  map.addEventListener('warehouse-selected', (e) => {
    if (e.detail.selected) {
      console.log('Warehouse selected:', e.detail.warehouseId);
    }
  });
</script>
```

## Development

### Local Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Visit http://localhost:3000/widget-demo.html
```

### Building for Production

```bash
# Build widget bundle
pnpm build

# Output: dist/shipnetwork-zone-map.js
```

### Testing on Different Devices

1. **Desktop**: Open `http://localhost:3000/widget-demo.html` in your browser
2. **Mobile**: Use Chrome DevTools device emulation or test on actual device
3. **Responsive**: Resize browser window to test breakpoints

## Publishing to CDN

### Using jsDelivr with GitHub

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Add widget"
   git push origin main
   ```

2. **Tag a release:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Use jsDelivr CDN:**
   ```html
   <!-- Latest version -->
   <script src="https://cdn.jsdelivr.net/gh/YOUR-USERNAME/YOUR-REPO@latest/dist/shipnetwork-zone-map.js"></script>
   
   <!-- Specific version -->
   <script src="https://cdn.jsdelivr.net/gh/YOUR-USERNAME/YOUR-REPO@v1.0.0/dist/shipnetwork-zone-map.js"></script>
   ```

## Troubleshooting

### Widget not appearing

1. Verify Mapbox GL JS is loaded before the widget script
2. Check that your Mapbox token is valid
3. Ensure the container has explicit height (e.g., `height: 600px`)
4. Check browser console for errors

### Map tiles not loading

- Verify your Mapbox token is correct
- Check network tab for failed requests
- Ensure you're not exceeding Mapbox API limits

### Styles look broken

- The widget uses Shadow DOM for isolation
- Check that you're not trying to style internal elements
- Only the container (`<shipnetwork-zone-map>`) can be styled

## License

ISC

## Support

For issues and questions, please file an issue on GitHub.
