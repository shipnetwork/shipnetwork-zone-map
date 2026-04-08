import { BottomSheet, BottomSheetState } from './mobile-ui';
import { DeviceType, ResponsiveManager } from './responsive';
import { WAREHOUSES } from './warehouses';
import { ZoneCalculator, SERVICES, type ServiceType } from './zone-calculator';
import { StaticUSMap, type ZoneFeature } from './static-map';
import { calculateNetworkStats, type NetworkStats } from './stats-calculator';

interface WarehouseMarkerData {
  element: SVGCircleElement;
}

export class ShipNetworkZoneMap extends HTMLElement {
  private shadow: ShadowRoot;
  private container: HTMLElement | null = null;
  private staticMap: StaticUSMap | null = null;
  private zoneCalculator: ZoneCalculator;
  private responsiveManager: ResponsiveManager | null = null;
  private bottomSheet: BottomSheet | null = null;

  private warehouseMarkers: Map<string, WarehouseMarkerData> = new Map();
  private selectedWarehouses: Set<string> = new Set();
  private activeService: ServiceType = 'ground';
  private statsWereVisible = false;
  private originMarker: SVGCircleElement | null = null;
  private destinationMarker: SVGCircleElement | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.zoneCalculator = new ZoneCalculator();
  }

  static get observedAttributes() {
    return ['mapbox-token', 'initial-warehouses', 'theme', 'mobile-breakpoint'];
  }

  connectedCallback() {
    // Override any external height (e.g. Webflow fixed height) so the widget
    // always sizes to its own content and the stats panel pushes content down
    this.style.height = 'auto';
    this.style.display = 'block';
    this.render();
    this.initializeMap();
  }

  disconnectedCallback() {
    if (this.staticMap) {
      this.staticMap.destroy();
    }
    if (this.responsiveManager) {
      this.responsiveManager.destroy();
    }
    if (this.bottomSheet) {
      this.bottomSheet.destroy();
    }
  }

  private render() {
    // Create styles
    const style = document.createElement('style');
    style.textContent = this.getStyles();

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'widget-container';
    this.container.innerHTML = `
      <div class="main-grid">
        <aside class="locations-sidebar">
          <h2 class="sidebar-title">Our Warehouse Locations</h2>
          <div class="location-buttons-grid" id="location-buttons-grid"></div>

          <div class="service-section">
            <h2 class="sidebar-title">KNCT Service</h2>
            <div class="service-buttons-grid" id="service-toggle-pills">
              ${SERVICES.map((s) => `
                <button class="location-button service-pill${s.id === 'ground' ? ' selected' : ''}" data-service="${s.id}">
                  <span class="location-button-text">${s.label} · ${s.tagline}</span>
                  <span class="location-button-arrow"><svg width="12" height="11" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.65989 0.95298L10.5965 0.699711L10.9597 8.54346M0.798361 9.95344L10.5965 0.699711L0.798361 9.95344Z" stroke="#ADADAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="zone-legend" id="zone-legend">
            <p class="zone-legend-title">Shipping Zones</p>
            <div class="zone-legend-grid" id="zone-legend-grid"></div>
          </div>
        </aside>
        <div class="map-wrapper">
          <div id="map-container"></div>
          <div id="zone-tooltip" class="zone-tooltip" aria-hidden="true"></div>
        </div>
      </div>
      <div class="stats-panel" id="stats-panel" style="display:none;">
        <div class="stats-cards">
          <div class="stats-card">
            <div class="stats-card-value" id="stat-avg-zone">—</div>
            <div class="stats-card-label">Avg Shipping Zone</div>
          </div>
          <div class="stats-card">
            <div class="stats-card-value" id="stat-avg-days">—</div>
            <div class="stats-card-label">Avg Days in Transit</div>
          </div>
          <div class="stats-card stats-card-highlight">
            <div class="stats-card-value" id="stat-savings">—</div>
            <div class="stats-card-label">Savings vs. Single DC</div>
          </div>
        </div>
        <button class="pdf-download-btn" id="pdf-download-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Download Report
        </button>
      </div>
      <footer class="zipcode-footer">
        <p class="footer-label">Enter Zipcodes to get an idea on zones and days of shipping</p>
        <div class="zipcode-inputs-row">
          <input type="text" id="from-zipcode" class="zipcode-input" placeholder="Warehouse Zipcode" maxlength="5" />
          <span class="to-separator">to</span>
          <input type="text" id="to-zipcode" class="zipcode-input" placeholder="Destination Zipcode" maxlength="5" />
        </div>
      </footer>
    `;

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.container);
  }

  private getStyles(): string {
    return `
      @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@600;700&display=swap');

      :host {
        display: block;
        width: 100%;
      }

      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .widget-container {
        width: 100%;
        max-width: 1319px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        background: transparent;
        container-type: inline-size;
        container-name: widget;
      }

      /* Main 2-Column Grid */
      .main-grid {
        display: grid;
        grid-template-columns: 480px 1fr;
        gap: 0;
        align-items: stretch;
      }

      /* Locations Sidebar */
      .locations-sidebar {
        background: transparent;
        padding: 24px 20px;
        overflow-y: auto;
        border-right: none;
      }

      .sidebar-title {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        margin: 0 0 20px 0;
        text-align: left;
        letter-spacing: -0.2px;
      }

      .location-buttons-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .location-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px 0 16px;
        height: 40px;
        background: white;
        border: 1px solid rgba(4, 12, 51, 0.15);
        border-radius: 5px;
        cursor: pointer;
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #ADADAD;
        transition: all 0.2s ease;
        box-shadow: none;
        width: 100%;
      }

      .location-button:hover {
        background: white;
        border-color: #B7DEFF;
        color: #050C32;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .location-button.selected {
        background: white;
        color: #111;
        border-color: #3b9eff;
        box-shadow: 0 0 0 1px #3b9eff, 0 4px 12px rgba(59, 158, 255, 0.15);
      }

      .location-button-text {
        font-weight: 600;
        flex: 1;
        text-align: left;
      }

      .location-button.selected .location-button-text {
        font-weight: 700;
        color: #111;
      }

      /* Arrow badge — gray rectangle behind icon */
      .location-button-arrow {
        margin-left: 10px;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #F5F4F2;
        border-radius: 5px;
        flex-shrink: 0;
        transition: all 0.2s ease;
      }

      .location-button-arrow svg path {
        stroke: #ADADAD;
        transition: stroke 0.2s ease;
      }

      /* Selected: blue arrow, keep badge */
      .location-button.selected .location-button-arrow svg path {
        stroke: #3b9eff;
      }

      /* Zone Legend */
      .zone-legend {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid rgba(4, 12, 51, 0.08);
      }

      .zone-legend-title {
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #ADADAD;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        margin: 0 0 10px 0;
      }

      .zone-legend-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 6px 10px;
      }

      .zone-legend-item {
        display: flex;
        align-items: center;
        gap: 7px;
      }

      .zone-swatch {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        flex-shrink: 0;
        border: 1px solid rgba(0,0,0,0.06);
      }

      .zone-label {
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #ADADAD;
        white-space: nowrap;
      }

      /* Map Wrapper - Responsive */
      .map-wrapper {
        position: relative;
        width: 100%;
        overflow: hidden;
        align-self: start;
        /* Push map down to align with 'Our Warehouse Locations' header */
        padding-top: 20px;
      }

      .zone-tooltip {
        position: absolute;
        pointer-events: none;
        background: rgba(5, 12, 50, 0.88);
        color: #fff;
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 10px;
        border-radius: 6px;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 0.12s ease;
        z-index: 20;
        transform: translate(12px, -50%);
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      }

      .zone-tooltip.visible {
        opacity: 1;
      }

      #map-container {
        width: 100%;
        aspect-ratio: 858 / 560;
        position: relative;
        overflow: hidden;
        background: transparent;
        display: block;
      }

      /* Responsive adjustments — container queries fire based on the widget's
         own width, not the viewport.
         - Above 1000px (e.g. 1319px desktop): 2-column sidebar + map
         - 1000px and below (tablet 768px, fixed 600px, mobile 375px): stacked */

      @container widget (max-width: 1000px) {
        /* Stack: map on top, locations below */
        .main-grid {
          display: flex;
          flex-direction: column;
        }

        /* Map on top */
        .map-wrapper {
          order: 1;
          width: 100%;
          align-self: auto;
        }

        /* Locations below */
        .locations-sidebar {
          order: 2;
          border-right: none;
          border-top: none;
          padding: 16px;
          max-height: none;
          align-self: auto;
        }

        .sidebar-title {
          font-size: 14px;
          margin-bottom: 12px;
        }

        /* 2-column button grid */
        .location-buttons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .location-button {
          padding: 10px 12px;
          font-size: 13px;
          border-radius: 8px;
        }

        .location-button-arrow {
          display: none;
        }

        .location-button-text {
          text-align: center;
        }
      }

      /* Extra-narrow: tighten padding on small phones */
      @container widget (max-width: 420px) {
        .locations-sidebar {
          padding: 12px;
        }

        .location-button {
          font-size: 12px;
          padding: 9px 10px;
        }
      }

      /* Zipcode Footer — hidden until confirmed needed */
      .zipcode-footer {
        display: none;
        padding: 20px 24px;
        background: #fff;
        border-top: 1px solid #e0e0e0;
      }

      .footer-label {
        font-size: 13px;
        color: #666;
        margin: 0 0 12px 0;
        text-align: center;
      }

      .zipcode-inputs-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .zipcode-input {
        width: 180px;
        padding: 10px 14px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        font-family: inherit;
      }

      .zipcode-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
      }

      .to-separator {
        font-size: 13px;
        color: #666;
        font-weight: 500;
      }

      /* Mobile footer adjustments */
      @container widget (max-width: 1000px) {
        .zipcode-footer {
          padding: 16px;
        }

        .zipcode-inputs-row {
          flex-direction: column;
          gap: 8px;
        }

        .zipcode-input {
          width: 100%;
          max-width: 300px;
        }

        .to-separator {
          display: none;
        }

        .zipcode-input:first-child::placeholder {
          content: 'From ZIP';
        }

        .zipcode-input:last-child::placeholder {
          content: 'To ZIP';
        }
      }

      /* ── Service Toggle ─────────────────────────────────────── */
      .service-section {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid rgba(4, 12, 51, 0.08);
      }

      .service-buttons-grid {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      /* ── Stats Panel ─────────────────────────────────────────── */
      .stats-panel {
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
        border-top: 1px solid rgba(4, 12, 51, 0.08);
      }

      .stats-cards {
        display: flex;
        gap: 0;
        flex: 1;
        min-width: 0;
      }

      .stats-card {
        flex: 1;
        padding: 12px 20px;
        text-align: center;
        border-right: 1px solid rgba(4, 12, 51, 0.08);
      }

      .stats-card:last-child {
        border-right: none;
      }

      .stats-card-value {
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 28px;
        font-weight: 700;
        color: #050C32;
        line-height: 1.1;
      }

      .stats-card-label {
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 11px;
        font-weight: 600;
        color: #ADADAD;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
      }

      .stats-card-highlight .stats-card-value {
        color: #3b9eff;
      }

      /* ── PDF Download Button ─────────────────────────────────── */
      .pdf-download-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px;
        background: #050C32;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        transition: all 0.2s ease;
        flex-shrink: 0;
      }

      .pdf-download-btn:hover {
        background: #1a2550;
        box-shadow: 0 4px 12px rgba(5, 12, 50, 0.25);
      }

      .pdf-download-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      @container widget (max-width: 700px) {
        .stats-panel {
          flex-direction: column;
          align-items: stretch;
        }

        .stats-cards {
          flex-wrap: wrap;
        }

        .stats-card {
          min-width: 120px;
        }

        .pdf-download-btn {
          width: 100%;
          justify-content: center;
        }
      }

      /* Desktop Controls */
      .desktop-controls {
        position: absolute;
        bottom: 20px;
        left: 20px;
        background: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
        max-width: none;
      }

      .desktop-warehouse-panel {
        position: absolute;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.15);
        width: 280px;
        max-height: 80vh;
        overflow: hidden;
        z-index: 1000;
      }

      .desktop-legend {
        position: absolute;
        bottom: 20px;
        right: 20px;
        background: white;
        padding: 12px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        max-width: 250px;
        z-index: 1000;
      }

      /* Mobile Bottom Sheet Styles */
      .mobile-control-trigger {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 12px 24px;
        border-radius: 24px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        border: none;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .mobile-legend {
        position: absolute;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 8px 12px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 1000;
        font-size: 11px;
        max-width: 90%;
      }

      /* Tablet Styles */
      @media (min-width: 768px) and (max-width: 1023px) {
        .desktop-controls,
        .desktop-warehouse-panel {
          width: 240px;
          font-size: 14px;
        }
        
        .desktop-warehouse-panel {
          max-height: 60vh;
        }
      }

      /* Hide/show based on device */
      @media (max-width: 767px) {
        .desktop-controls,
        .desktop-warehouse-panel,
        .desktop-legend {
          display: none;
        }
      }

      @media (min-width: 768px) {
        .mobile-control-trigger,
        .mobile-legend {
          display: none;
        }
      }

      /* Common Styles */
      .zip-input-group {
        display: flex;
        flex-direction: row;
        gap: 10px;
        align-items: flex-end;
        flex-wrap: wrap;
      }

      .zip-input-group > div {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 120px;
      }

      .zip-input-group label {
        font-size: 12px;
        font-weight: 600;
        color: #333;
      }

      .zip-input {
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 14px;
        width: 100%;
        min-height: 44px;
      }

      .zip-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }

      .calculate-button {
        padding: 12px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        min-height: 44px;
      }

      .calculate-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .calculate-button:active {
        transform: translateY(0);
      }

      .calculate-button.secondary {
        background: #95a5a6;
      }

      /* Warehouse Panel Styles */
      .warehouse-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .warehouse-panel-header h3 {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
      }

      .warehouse-actions {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-bottom: 1px solid #e0e0e0;
      }

      .warehouse-action-btn {
        flex: 1;
        padding: 8px 12px;
        background: #f0f0f0;
        border: 1px solid #ddd;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
        min-height: 44px;
      }

      .warehouse-action-btn:hover {
        background: #e0e0e0;
      }

      .warehouse-list {
        padding: 8px;
        max-height: 400px;
        overflow-y: auto;
      }

      .warehouse-item {
        display: flex;
        align-items: center;
        padding: 12px;
        margin: 4px 0;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        min-height: 44px;
      }

      .warehouse-item:hover {
        background: #f8f9fa;
      }

      .warehouse-checkbox {
        width: 20px;
        height: 20px;
        margin-right: 12px;
        cursor: pointer;
      }

      .warehouse-marker-preview {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-right: 12px;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        flex-shrink: 0;
      }

      .warehouse-name {
        font-size: 14px;
        color: #333;
        font-weight: 500;
      }

      /* Legend Styles */
      .legend-title {
        font-weight: 600;
        margin-bottom: 8px;
        font-size: 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
      }

      .legend-row {
        display: flex;
        align-items: center;
        margin: 6px 0;
        font-size: 12px;
      }

      .color-box {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        margin-right: 8px;
        border: 1px solid rgba(0,0,0,0.1);
        flex-shrink: 0;
      }

      .mode-indicator {
        font-size: 11px;
        color: #666;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #eee;
        font-style: italic;
      }

      /* Warehouse Markers */
      .warehouse-marker {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 14px;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }

      .warehouse-marker.selected {
        transform: scale(1.3);
        z-index: 1000 !important;
      }

      /* Mobile optimizations */
      @media (max-width: 767px) {
        .warehouse-item,
        .warehouse-action-btn,
        .calculate-button,
        .zip-input {
          min-height: 44px;
        }

        .warehouse-checkbox {
          width: 24px;
          height: 24px;
        }

        .warehouse-name {
          font-size: 16px;
        }
      }
    `;
  }

  private async initializeMap() {
    const mapContainer = this.shadow.querySelector('#map-container') as HTMLElement;
    if (!mapContainer) return;

    // Wait for container to have dimensions
    await new Promise(resolve => setTimeout(resolve, 0));

    // Calculate initial dimensions
    const width = mapContainer.clientWidth || 800;
    const height = mapContainer.clientHeight > 50 ? mapContainer.clientHeight : 600;

    // Ensure container has minimum dimensions
    if (width < 50 || height < 50) {
      mapContainer.style.minWidth = '800px';
      mapContainer.style.minHeight = '600px';
    }

    // Create static map (dimensions are managed internally at 858×560)
    this.staticMap = new StaticUSMap(mapContainer);

    // Handle window resize
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === mapContainer && this.staticMap) {
          const newWidth = entry.contentRect.width > 50 ? entry.contentRect.width : 800;
          const newHeight = entry.contentRect.height > 50 ? entry.contentRect.height : 600;
          this.staticMap.resize(newWidth, newHeight);
          // Redraw markers
          this.createWarehouseMarkers();
          // Redraw zones if any are selected
          if (this.selectedWarehouses.size > 0) {
            this.updateWarehouseZones();
          }
        }
      }
    });
    resizeObserver.observe(mapContainer);

    // Create UI and markers
    this.createWarehouseMarkers();
    this.createUI();
    this.initTooltip(mapContainer);

    // Dispatch ready event
    this.dispatchEvent(new CustomEvent('map-ready', { 
      detail: { map: this.staticMap },
      bubbles: true,
      composed: true
    }));
  }

  private initTooltip(mapContainer: HTMLElement) {
    const tooltip = this.shadow.querySelector('#zone-tooltip') as HTMLElement | null;
    if (!tooltip || !this.staticMap) return;

    let rafId = 0;

    mapContainer.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.staticMap || this.selectedWarehouses.size === 0) {
        tooltip.classList.remove('visible');
        return;
      }

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!this.staticMap) return;

        // Map mouse position to canvas coordinate space (canvas is CSS-scaled)
        const rect = mapContainer.getBoundingClientRect();
        const cssX = e.clientX - rect.left;
        const cssY = e.clientY - rect.top;
        const scaleX = 858 / rect.width;
        const scaleY = 560 / rect.height;
        const canvasX = cssX * scaleX;
        const canvasY = cssY * scaleY;

        // Only show tooltip when cursor is inside the US boundary
        if (!this.staticMap.isPointInUS(canvasX, canvasY)) {
          tooltip.classList.remove('visible');
          return;
        }

        const { lng, lat } = this.staticMap.unproject(canvasX, canvasY);

        // Find the minimum zone across all selected warehouses
        let minZone = Infinity;
        this.selectedWarehouses.forEach((warehouseId) => {
          const warehouse = WAREHOUSES.find((wh) => wh.id === warehouseId);
          if (warehouse) {
            const distance = this.zoneCalculator.calculateDistance(
              warehouse.coordinates[1], warehouse.coordinates[0], lat, lng
            );
            const zone = this.zoneCalculator.calculateZone(distance);
            minZone = Math.min(minZone, zone.zoneNumber);
          }
        });

        if (!isFinite(minZone)) {
          tooltip.classList.remove('visible');
          return;
        }

        const days = this.zoneCalculator.getTransitDays(minZone, this.activeService);
        tooltip.textContent = `Zone ${minZone} · ${days}`;

        // Position tooltip relative to the map-wrapper (tooltip's offset parent)
        const wrapperRect = (tooltip.parentElement as HTMLElement).getBoundingClientRect();
        tooltip.style.left = `${e.clientX - wrapperRect.left}px`;
        tooltip.style.top = `${e.clientY - wrapperRect.top}px`;
        tooltip.classList.add('visible');
      });
    });

    mapContainer.addEventListener('mouseleave', () => {
      cancelAnimationFrame(rafId);
      tooltip.classList.remove('visible');
    });
  }

  private createWarehouseMarkers() {
    if (!this.staticMap) return;

    const markerElements = this.staticMap.createWarehouseMarkers(
      WAREHOUSES,
      this.selectedWarehouses,
      (warehouse) => {
        const button = this.shadow.querySelector(
          `.location-button[data-warehouse-id="${warehouse.id}"]`
        ) as HTMLElement;
        if (button) {
          button.click();
        }
      }
    );

    // Store marker elements
    markerElements.forEach((element, id) => {
      this.warehouseMarkers.set(id, { element });
    });
  }

  private createUI() {
    // Populate legend dynamically so it reflects the active service
    this.updateLegend();

    // Wire service toggle pills — clicking an active pill deselects it
    const pillContainer = this.shadow.querySelector('#service-toggle-pills');
    if (pillContainer) {
      pillContainer.querySelectorAll<HTMLButtonElement>('.service-pill').forEach((pill) => {
        pill.addEventListener('click', () => {
          const isAlreadyActive = pill.classList.contains('selected');
          pillContainer.querySelectorAll('.service-pill').forEach((p) => p.classList.remove('selected'));

          if (isAlreadyActive) {
            // Toggle off — revert to default ground service
            this.activeService = 'ground';
            this.updateLegend();
            this.updateWarehouseZones();
          } else {
            this.activeService = pill.dataset.service as ServiceType;
            pill.classList.add('selected');
            this.updateLegend();
            this.updateWarehouseZones();
          }
        });
      });
    }

    // Populate location buttons
    const buttonGrid = this.shadow.querySelector('#location-buttons-grid');
    if (!buttonGrid) return;

    WAREHOUSES.forEach((warehouse) => {
      const button = document.createElement('button');
      button.className = 'location-button';
      button.dataset.warehouseId = warehouse.id;
      button.innerHTML = `
        <span class="location-button-text">${warehouse.city}, ${warehouse.state}</span>
        <span class="location-button-arrow"><svg width="12" height="11" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.65989 0.95298L10.5965 0.699711L10.9597 8.54346M0.798361 9.95344L10.5965 0.699711L0.798361 9.95344Z" stroke="#ADADAD" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      `;

      button.addEventListener('click', () => {
        if (this.selectedWarehouses.has(warehouse.id)) {
          this.selectedWarehouses.delete(warehouse.id);
          button.classList.remove('selected');
          this.updateWarehouseMarkerAppearance(warehouse.id, false);
        } else {
          this.selectedWarehouses.add(warehouse.id);
          button.classList.add('selected');
          this.updateWarehouseMarkerAppearance(warehouse.id, true);
        }
        this.updateWarehouseZones();
      });

      buttonGrid.appendChild(button);
    });

    // Wire PDF download button
    const pdfBtn = this.shadow.querySelector('#pdf-download-btn');
    pdfBtn?.addEventListener('click', () => this.generatePDF());

    // Wire up zipcode inputs
    const fromZip = this.shadow.querySelector('#from-zipcode') as HTMLInputElement;
    const toZip = this.shadow.querySelector('#to-zipcode') as HTMLInputElement;

    if (fromZip && toZip) {
      const handleCalculate = () => {
        if (fromZip.value.length === 5 && toZip.value.length === 5) {
          this.calculateCustomZones(fromZip.value, toZip.value);
        }
      };

      fromZip.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCalculate();
      });

      toZip.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCalculate();
      });

      toZip.addEventListener('blur', handleCalculate);
    }
  }

  /** Rebuild the legend swatches to reflect the active service's colours & day labels */
  private updateLegend() {
    const grid = this.shadow.querySelector('#zone-legend-grid');
    if (!grid) return;
    const service = this.activeService;
    const zones = this.zoneCalculator.getZoneRanges();
    grid.innerHTML = zones.map((z) => {
      const color = z.colors[service];
      const days = z.transitDays[service];
      return `<div class="zone-legend-item">
        <span class="zone-swatch" style="background:${color}"></span>
        <span class="zone-label">Zone ${z.zoneNumber} · ${days}</span>
      </div>`;
    }).join('');
  }

  /** Recalculate and display network stats, show/hide stats panel */
  private updateStats() {
    const statsPanel = this.shadow.querySelector('#stats-panel') as HTMLElement | null;
    if (!statsPanel) return;

    if (this.selectedWarehouses.size === 0) {
      statsPanel.style.display = 'none';
      this.statsWereVisible = false;
      return;
    }

    const selectedWhs = WAREHOUSES.filter((wh) => this.selectedWarehouses.has(wh.id));
    const stats = calculateNetworkStats(selectedWhs, this.activeService, this.zoneCalculator);

    if (!stats) {
      statsPanel.style.display = 'none';
      this.statsWereVisible = false;
      return;
    }

    statsPanel.style.display = 'flex';

    // Scroll the stats panel into view the first time it appears
    if (!this.statsWereVisible) {
      this.statsWereVisible = true;
      setTimeout(() => statsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
    }

    const avgZoneEl = this.shadow.querySelector('#stat-avg-zone');
    const avgDaysEl = this.shadow.querySelector('#stat-avg-days');
    const savingsEl = this.shadow.querySelector('#stat-savings');

    if (avgZoneEl) avgZoneEl.textContent = `Zone ${stats.avgZone}`;
    if (avgDaysEl) avgDaysEl.textContent = stats.avgTransitDays;
    if (savingsEl) {
      savingsEl.textContent = stats.savingsVsSingleDC > 0
        ? `${stats.savingsVsSingleDC}%`
        : '—';
    }
  }

  private createMobileUI() {
    if (!this.container) return;

    // Create trigger button
    const trigger = document.createElement('button');
    trigger.className = 'mobile-control-trigger';
    trigger.innerHTML = `📍 Warehouses & Zones`;
    trigger.addEventListener('click', () => {
      if (this.bottomSheet) {
        this.bottomSheet.toggle();
      }
    });
    this.container.appendChild(trigger);

    // Create mobile legend
    const legend = document.createElement('div');
    legend.className = 'mobile-legend';
    legend.innerHTML = `<div style="font-weight: 600;">USPS Zones</div>`;
    this.container.appendChild(legend);

    // Create bottom sheet content
    const content = this.getMobileSheetContent();
    this.bottomSheet = new BottomSheet(this.container, content);
    
    // Setup event listeners after bottom sheet is created
    this.setupMobileEventListeners();
  }

  private getMobileSheetContent(): string {
    const warehouseItems = WAREHOUSES.map(
      (wh) => `
        <label class="warehouse-item">
          <input 
            type="checkbox" 
            class="warehouse-checkbox" 
            data-warehouse-id="${wh.id}"
          />
          <span class="warehouse-marker-preview" style="background-color: ${wh.markerColor}"></span>
          <span class="warehouse-name">${wh.city}, ${wh.state}</span>
        </label>
      `
    ).join('');

    return `
      <div style="padding-bottom: 20px;">
        <h3 style="font-size: 18px; margin-bottom: 16px;">ShipNetwork Warehouses</h3>
        
        <div class="warehouse-actions">
          <button class="warehouse-action-btn" id="mobile-select-all">Select All</button>
          <button class="warehouse-action-btn" id="mobile-clear-all">Clear All</button>
        </div>
        
        <div class="warehouse-list">
          ${warehouseItems}
        </div>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
          <h3 style="font-size: 18px; margin-bottom: 16px;">Custom ZIP Calculation</h3>
          <div class="zip-input-group">
            <div>
              <label for="mobile-from-zip">From ZIP:</label>
              <input type="text" id="mobile-from-zip" class="zip-input" placeholder="From ZIP" maxlength="5" pattern="[0-9]*">
            </div>
            <div>
              <label for="mobile-to-zip">To ZIP:</label>
              <input type="text" id="mobile-to-zip" class="zip-input" placeholder="To ZIP" maxlength="5" pattern="[0-9]*">
            </div>
            <button id="mobile-calculate" class="calculate-button">Calculate Zones</button>
            <button id="mobile-clear" class="calculate-button secondary">Clear Zones</button>
          </div>
        </div>
      </div>
    `;
  }

  private setupMobileEventListeners() {
    if (!this.bottomSheet) return;

    const content = this.bottomSheet.getContentElement();

    // Warehouse checkboxes
    const checkboxes = content.querySelectorAll('.warehouse-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach((cb) => {
      cb.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const warehouseId = target.dataset.warehouseId;
        if (warehouseId) {
          if (target.checked) {
            this.selectWarehouse(warehouseId);
          } else {
            this.deselectWarehouse(warehouseId);
          }
        }
      });
    });

    // Select/Clear all buttons
    const selectAllBtn = content.querySelector('#mobile-select-all');
    selectAllBtn?.addEventListener('click', () => this.selectAllWarehouses(checkboxes));

    const clearAllBtn = content.querySelector('#mobile-clear-all');
    clearAllBtn?.addEventListener('click', () => this.clearAllWarehouses(checkboxes));

    // ZIP calculation
    const calculateBtn = content.querySelector('#mobile-calculate');
    const fromInput = content.querySelector('#mobile-from-zip') as HTMLInputElement;
    const toInput = content.querySelector('#mobile-to-zip') as HTMLInputElement;
    
    calculateBtn?.addEventListener('click', () => {
      if (fromInput && toInput) {
        this.calculateCustomZones(fromInput.value, toInput.value);
      }
    });

    const clearBtn = content.querySelector('#mobile-clear');
    clearBtn?.addEventListener('click', () => this.clearCustomZones());
  }

  private createDesktopUI() {
    // Implementation similar to current desktop UI
    // Will be added in next iteration
  }

  private handleDeviceChange(deviceType: DeviceType) {
    // Clear current UI
    const existingControls = this.container?.querySelectorAll('.mobile-control-trigger, .mobile-legend, .desktop-controls, .desktop-warehouse-panel, .desktop-legend');
    existingControls?.forEach((el) => el.remove());

    if (this.bottomSheet) {
      this.bottomSheet.destroy();
      this.bottomSheet = null;
    }

    // Recreate UI for new device type
    this.createUI();
  }

  private selectWarehouse(warehouseId: string) {
    this.selectedWarehouses.add(warehouseId);
    this.updateWarehouseMarkerAppearance(warehouseId, true);
    this.updateWarehouseZones();
    
    this.dispatchEvent(new CustomEvent('warehouse-selected', {
      detail: { warehouseId, selected: true },
      bubbles: true,
      composed: true
    }));
  }

  private deselectWarehouse(warehouseId: string) {
    this.selectedWarehouses.delete(warehouseId);
    this.updateWarehouseMarkerAppearance(warehouseId, false);
    this.updateWarehouseZones();

    this.dispatchEvent(new CustomEvent('warehouse-selected', {
      detail: { warehouseId, selected: false },
      bubbles: true,
      composed: true
    }));
  }

  private updateWarehouseMarkerAppearance(warehouseId: string, selected: boolean) {
    if (this.staticMap) {
      this.staticMap.updateMarkerAppearance(warehouseId, selected);
    }
  }

  private selectAllWarehouses(checkboxes: NodeListOf<HTMLInputElement>) {
    checkboxes.forEach((cb) => {
      cb.checked = true;
      const warehouseId = cb.dataset.warehouseId;
      if (warehouseId) {
        this.selectWarehouse(warehouseId);
      }
    });
  }

  private clearAllWarehouses(checkboxes: NodeListOf<HTMLInputElement>) {
    checkboxes.forEach((cb) => {
      cb.checked = false;
      const warehouseId = cb.dataset.warehouseId;
      if (warehouseId) {
        this.deselectWarehouse(warehouseId);
      }
    });
  }

  private updateWarehouseZones() {
    if (!this.staticMap || this.selectedWarehouses.size === 0) {
      this.clearZones();
      this.updateStats();
      return;
    }

    const selectedCoords: [number, number][] = [];
    this.selectedWarehouses.forEach((warehouseId) => {
      const warehouse = WAREHOUSES.find((wh) => wh.id === warehouseId);
      if (warehouse) {
        selectedCoords.push(warehouse.coordinates);
      }
    });

    if (selectedCoords.length === 0) return;

    const zoneFeatures: ZoneFeature[] = [];
    const gridSize = 0.3;

    for (let lat = 24; lat <= 50; lat += gridSize) {
      for (let lng = -125; lng <= -66; lng += gridSize) {
        let minZone = Infinity;

        selectedCoords.forEach((coord) => {
          const distance = this.zoneCalculator.calculateDistance(
            coord[1], coord[0], lat, lng
          );
          const zone = this.zoneCalculator.calculateZone(distance);
          minZone = Math.min(minZone, zone.zoneNumber);
        });

        if (isFinite(minZone)) {
          // Use the per-service colour for this zone
          const color = this.zoneCalculator.getZoneColor(minZone, this.activeService);
          zoneFeatures.push({
            zone: minZone,
            color,
            coordinates: [[
              [lng, lat],
              [lng + gridSize, lat],
              [lng + gridSize, lat + gridSize],
              [lng, lat + gridSize],
              [lng, lat],
            ]],
          });
        }
      }
    }

    this.staticMap.drawZones(zoneFeatures);
    this.updateStats();
  }

  private clearZones() {
    if (this.staticMap) {
      this.staticMap.clearZones();
    }
  }

  private async calculateCustomZones(fromZip: string, toZip: string) {
    // Custom ZIP calculation can be implemented later
    // For now, just log the request
    console.log('Calculate zones from', fromZip, 'to', toZip);
    // This would require a ZIP code geocoding service
  }

  private clearCustomZones() {
    this.originMarker = null;
    this.destinationMarker = null;
    this.clearZones();
  }

  /** Open a light-DOM modal containing the HubSpot lead-capture form */
  private bannerShown = false;

  private showUpsellBanner() {
    // Only show once per session
    if (this.bannerShown) return;
    this.bannerShown = true;

    // Inject styles once
    if (!document.getElementById('sn-upsell-styles')) {
      const style = document.createElement('style');
      style.id = 'sn-upsell-styles';
      style.textContent = `
        #sn-upsell-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          background: #fff;
          box-shadow: 0 -4px 30px rgba(5, 12, 50, 0.12);
          border-top: 1px solid rgba(5, 12, 50, 0.08);
          transform: translateY(100%);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        #sn-upsell-banner.visible {
          transform: translateY(0);
        }
        #sn-upsell-inner {
          max-width: 960px;
          margin: 0 auto;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
          box-sizing: border-box;
        }
        #sn-upsell-text { flex: 1; min-width: 200px; }
        #sn-upsell-headline {
          font-size: 15px;
          font-weight: 700;
          color: #050C32;
          margin: 0 0 4px;
        }
        #sn-upsell-sub {
          font-size: 12px;
          color: #6b7280;
          margin: 0;
          line-height: 1.5;
        }
        #sn-upsell-form {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        #sn-upsell-form input {
          height: 40px;
          border: 1px solid rgba(4, 12, 51, 0.18);
          border-radius: 6px;
          padding: 0 12px;
          font-size: 13px;
          font-family: 'Open Sans', sans-serif;
          color: #050C32;
          outline: none;
          box-sizing: border-box;
          width: 180px;
        }
        #sn-upsell-form input:focus {
          border-color: #B7DEFF;
        }
        #sn-upsell-submit {
          height: 40px;
          padding: 0 20px;
          background: #050C32;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Open Sans', sans-serif;
          cursor: pointer;
          white-space: nowrap;
        }
        #sn-upsell-submit:hover { background: #1a2a6c; }
        #sn-upsell-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        #sn-upsell-dismiss {
          background: none;
          border: none;
          font-size: 12px;
          color: #9ca3af;
          cursor: pointer;
          font-family: 'Open Sans', sans-serif;
          padding: 0;
          white-space: nowrap;
          text-decoration: underline;
        }
        #sn-upsell-dismiss:hover { color: #050C32; }
        #sn-upsell-close {
          position: absolute;
          top: 12px;
          right: 16px;
          background: none;
          border: none;
          font-size: 20px;
          color: #9ca3af;
          cursor: pointer;
          line-height: 1;
          padding: 2px 6px;
        }
        #sn-upsell-close:hover { color: #050C32; }
        #sn-upsell-thanks {
          font-size: 14px;
          font-weight: 600;
          color: #050C32;
          padding: 4px 0;
        }
        @media (max-width: 600px) {
          #sn-upsell-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
          #sn-upsell-form input { width: 100%; }
          #sn-upsell-submit { width: 100%; }
        }
      `;
      document.head.appendChild(style);
    }

    // Build banner
    const banner = document.createElement('div');
    banner.id = 'sn-upsell-banner';

    banner.innerHTML = `
      <button id="sn-upsell-close" aria-label="Close">&times;</button>
      <div id="sn-upsell-inner">
        <div id="sn-upsell-text">
          <p id="sn-upsell-headline">Your report is ready! Want a more accurate analysis?</p>
          <p id="sn-upsell-sub">Our team will run a free custom analysis based on your actual order volume and destinations — takes about 15 minutes.</p>
        </div>
        <form id="sn-upsell-form" novalidate>
          <input type="text"  name="firstname" placeholder="First name"  required autocomplete="given-name" />
          <input type="email" name="email"     placeholder="Work email"  required autocomplete="email" />
          <button type="submit" id="sn-upsell-submit">Get My Free Analysis</button>
          <button type="button" id="sn-upsell-dismiss">No thanks</button>
        </form>
      </div>
    `;

    document.body.appendChild(banner);

    // Animate in after a short delay so the transition fires
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));

    const slideOut = () => {
      banner.classList.remove('visible');
      banner.addEventListener('transitionend', () => banner.remove(), { once: true });
    };

    // Close button
    banner.querySelector('#sn-upsell-close')!.addEventListener('click', slideOut);
    // Dismiss link
    banner.querySelector('#sn-upsell-dismiss')!.addEventListener('click', slideOut);
    // Auto-dismiss after 30s
    const autoTimer = setTimeout(slideOut, 30_000);

    // Form submit → POST to HubSpot
    const form = banner.querySelector('#sn-upsell-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearTimeout(autoTimer);

      const firstnameInput = form.querySelector<HTMLInputElement>('[name="firstname"]')!;
      const emailInput     = form.querySelector<HTMLInputElement>('[name="email"]')!;
      const submitBtn      = form.querySelector<HTMLButtonElement>('#sn-upsell-submit')!;

      if (!firstnameInput.value.trim() || !emailInput.value.trim()) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      const PORTAL_ID = '8210927';
      const FORM_ID   = 'd65468f8-4f8a-47ab-9464-58a2ce286048';

      try {
        await fetch(
          `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: [
                { name: 'firstname', value: firstnameInput.value.trim() },
                { name: 'email',     value: emailInput.value.trim() },
              ],
              context: {
                pageUri: window.location.href,
                pageName: document.title,
              },
            }),
          }
        );
      } catch (_) {
        // Silently ignore network errors — don't block the user
      }

      // Show thank-you then slide out
      form.innerHTML = '<p id="sn-upsell-thanks">Thanks! A ShipNetwork rep will reach out shortly.</p>';
      setTimeout(slideOut, 3000);
    });
  }

  private async generatePDF() {
    const btn = this.shadow.querySelector('#pdf-download-btn') as HTMLButtonElement | null;
    if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const mapContainer = this.shadow.querySelector('#map-container') as HTMLElement | null;

      // --- Gather stats ---
      const selectedWhs = WAREHOUSES.filter((wh) => this.selectedWarehouses.has(wh.id));
      const stats = calculateNetworkStats(selectedWhs, this.activeService, this.zoneCalculator);
      const serviceDef = SERVICES.find((s) => s.id === this.activeService)!;

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;

      // ── Header ──────────────────────────────────────────────
      doc.setFillColor(5, 12, 50);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('ShipNetwork — Zone Analysis Report', margin, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      doc.text(`${serviceDef.label} Service (${serviceDef.days} days)  ·  Generated ${dateStr}`, pageW - margin, 14, { align: 'right' });

      let cursorY = 30;

      // ── Map screenshot ───────────────────────────────────────
      if (mapContainer) {
        const canvas = await html2canvas(mapContainer, { scale: 1.5, useCORS: true, backgroundColor: null });
        const imgData = canvas.toDataURL('image/png');
        const maxMapW = pageW - margin * 2;
        const ratio = canvas.height / canvas.width;
        const mapImgH = Math.min(maxMapW * ratio, pageH * 0.45);
        const mapImgW = mapImgH / ratio;
        doc.addImage(imgData, 'PNG', margin, cursorY, mapImgW, mapImgH);
        cursorY += mapImgH + 8;
      }

      // ── Stats row ────────────────────────────────────────────
      if (stats) {
        const cardW = (pageW - margin * 2) / 3;
        const cards = [
          { label: 'Avg Shipping Zone', value: `Zone ${stats.avgZone}` },
          { label: 'Avg Days in Transit', value: stats.avgTransitDays },
          { label: 'Savings vs Single DC', value: stats.savingsVsSingleDC > 0 ? `${stats.savingsVsSingleDC}%` : 'N/A (1 DC)' },
        ];

        cards.forEach((card, i) => {
          const x = margin + i * cardW;
          doc.setFillColor(248, 249, 250);
          doc.roundedRect(x, cursorY, cardW - 3, 22, 2, 2, 'F');
          doc.setTextColor(5, 12, 50);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text(card.value, x + cardW / 2 - 1.5, cursorY + 11, { align: 'center' });
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(130, 130, 130);
          doc.text(card.label.toUpperCase(), x + cardW / 2 - 1.5, cursorY + 18, { align: 'center' });
        });

        cursorY += 28;

        // ── Per-warehouse table ──────────────────────────────────
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 12, 50);
        doc.text('Warehouse Breakdown', margin, cursorY);
        cursorY += 5;

        const colW = [90, 40, 60];
        const headers = ['Warehouse', 'Avg Zone', 'Avg Transit'];
        const rows = stats.perWarehouse.map((w) => [w.warehouseName, `Zone ${w.avgZone}`, w.avgTransitDays]);

        // Header row
        doc.setFillColor(5, 12, 50);
        doc.rect(margin, cursorY, colW[0] + colW[1] + colW[2], 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        let cx = margin + 3;
        headers.forEach((h, i) => { doc.text(h, cx, cursorY + 5); cx += colW[i]; });
        cursorY += 7;

        // Data rows
        rows.forEach((row, ri) => {
          doc.setFillColor(ri % 2 === 0 ? 248 : 255, ri % 2 === 0 ? 249 : 255, ri % 2 === 0 ? 250 : 255);
          doc.rect(margin, cursorY, colW[0] + colW[1] + colW[2], 6.5, 'F');
          doc.setTextColor(50, 50, 50);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          cx = margin + 3;
          row.forEach((cell, i) => { doc.text(cell, cx, cursorY + 4.5); cx += colW[i]; });
          cursorY += 6.5;
        });
      }

      // ── Footer ──────────────────────────────────────────────
      doc.setFontSize(7);
      doc.setTextColor(180, 180, 180);
      doc.setFont('helvetica', 'normal');
      doc.text('ShipNetwork · Shipping Zone Analysis  |  Data is estimated and based on representative US ZIP destinations.', margin, pageH - 6);

      doc.save(`ShipNetwork-Zone-Analysis-${serviceDef.label}-${new Date().toISOString().slice(0, 10)}.pdf`);

      // Show upsell banner after PDF starts downloading
      this.showUpsellBanner();
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Download Report'; }
    }
  }
}

// Register the custom element
if (typeof window !== 'undefined' && !customElements.get('shipnetwork-zone-map')) {
  customElements.define('shipnetwork-zone-map', ShipNetworkZoneMap);
}
