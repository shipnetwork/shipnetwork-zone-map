import { BottomSheet, BottomSheetState } from './mobile-ui';
import { DeviceType, ResponsiveManager } from './responsive';
import { WAREHOUSES } from './warehouses';
import { ZoneCalculator } from './zone-calculator';
import { StaticUSMap, type ZoneFeature } from './static-map';

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
        </aside>
        <div class="map-wrapper">
          <div id="map-container"></div>
        </div>
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
        background: #fff;
        container-type: inline-size;
        container-name: widget;
      }

      /* Main 2-Column Grid */
      .main-grid {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 0;
        /* stretch is the default — both columns fill the row height driven
           by the map's aspect-ratio, eliminating whitespace below */
        align-items: stretch;
      }

      /* Locations Sidebar */
      .locations-sidebar {
        background: #dedfe0;
        padding: 24px 20px;
        overflow-y: auto;
        border-right: 1px solid #e0e0e0;
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
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .location-button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        cursor: pointer;
        font-size: 14px;
        color: #333;
        transition: all 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        width: 100%;
      }

      .location-button:hover {
        background: #f8f9fa;
        border-color: #ccc;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        transform: translateY(-1px);
      }

      .location-button.selected {
        background: #667eea;
        color: white;
        border-color: #667eea;
        box-shadow: 0 3px 8px rgba(102, 126, 234, 0.3);
      }

      .location-button-text {
        font-weight: 500;
        flex: 1;
        text-align: left;
      }

      .location-button-arrow {
        margin-left: 8px;
        opacity: 0.5;
        font-size: 16px;
      }

      .location-button.selected .location-button-arrow {
        opacity: 0.9;
      }

      /* Map Wrapper - Responsive */
      .map-wrapper {
        position: relative;
        width: 100%;
        overflow: hidden;
        /* Shrink to the map's intrinsic height — prevents the column from
           stretching taller than the map and creating whitespace */
        align-self: start;
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
          border-top: 1px solid #e0e0e0;
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
    
    // Dispatch ready event
    this.dispatchEvent(new CustomEvent('map-ready', { 
      detail: { map: this.staticMap },
      bubbles: true,
      composed: true
    }));
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
    // Populate location buttons
    const buttonGrid = this.shadow.querySelector('#location-buttons-grid');
    if (!buttonGrid) return;

    WAREHOUSES.forEach((warehouse) => {
      const button = document.createElement('button');
      button.className = 'location-button';
      button.dataset.warehouseId = warehouse.id;
      button.innerHTML = `
        <span class="location-button-text">${warehouse.city}, ${warehouse.state}</span>
        <span class="location-button-arrow">→</span>
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

    // Calculate minimum zones using grid
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

        const zoneObj = this.zoneCalculator.getZoneRanges().find((z) => z.zoneNumber === minZone);

        if (zoneObj) {
          zoneFeatures.push({
            zone: minZone,
            color: zoneObj.color,
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

    // Draw zones on static map
    this.staticMap.drawZones(zoneFeatures);
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
    // Clear any custom markers if they exist
    this.originMarker = null;
    this.destinationMarker = null;
    this.clearZones();
  }
}

// Register the custom element
if (typeof window !== 'undefined' && !customElements.get('shipnetwork-zone-map')) {
  customElements.define('shipnetwork-zone-map', ShipNetworkZoneMap);
}
