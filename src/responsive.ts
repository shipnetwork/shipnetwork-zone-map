export enum DeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
}

export interface ResponsiveConfig {
  mobileBreakpoint: number;
  tabletBreakpoint: number;
}

export class ResponsiveManager {
  private config: ResponsiveConfig = {
    mobileBreakpoint: 768,
    tabletBreakpoint: 1024,
  };

  private listeners: Array<(deviceType: DeviceType) => void> = [];
  private currentDevice: DeviceType;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, config?: Partial<ResponsiveConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.currentDevice = this.detectDevice(container.clientWidth);
    this.setupResizeObserver(container);
  }

  private detectDevice(width: number): DeviceType {
    if (width < this.config.mobileBreakpoint) {
      return DeviceType.MOBILE;
    } else if (width < this.config.tabletBreakpoint) {
      return DeviceType.TABLET;
    }
    return DeviceType.DESKTOP;
  }

  private setupResizeObserver(container: HTMLElement) {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const newDevice = this.detectDevice(width);

        if (newDevice !== this.currentDevice) {
          this.currentDevice = newDevice;
          this.notifyListeners(newDevice);
        }
      }
    });

    this.resizeObserver.observe(container);
  }

  public getCurrentDevice(): DeviceType {
    return this.currentDevice;
  }

  public isMobile(): boolean {
    return this.currentDevice === DeviceType.MOBILE;
  }

  public isTablet(): boolean {
    return this.currentDevice === DeviceType.TABLET;
  }

  public isDesktop(): boolean {
    return this.currentDevice === DeviceType.DESKTOP;
  }

  public onDeviceChange(callback: (deviceType: DeviceType) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(deviceType: DeviceType) {
    this.listeners.forEach((listener) => listener(deviceType));
  }

  public destroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.listeners = [];
  }
}

// Touch detection utilities
export class TouchUtils {
  static isTouchDevice(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      (navigator as any).msMaxTouchPoints > 0
    );
  }

  static getMinTapTargetSize(): number {
    return 44; // 44px minimum for accessibility
  }

  static addTouchFeedback(element: HTMLElement) {
    element.style.webkitTapHighlightColor = 'rgba(0, 0, 0, 0.1)';
    element.style.cursor = 'pointer';
  }
}

// Viewport utilities
export class ViewportUtils {
  static getViewportSize() {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  static isLandscape(): boolean {
    return window.innerWidth > window.innerHeight;
  }

  static isPortrait(): boolean {
    return window.innerHeight > window.innerWidth;
  }

  static getSafeAreaInsets() {
    // Get safe area insets for devices with notches
    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('--sat') || '0'),
      right: parseInt(style.getPropertyValue('--sar') || '0'),
      bottom: parseInt(style.getPropertyValue('--sab') || '0'),
      left: parseInt(style.getPropertyValue('--sal') || '0'),
    };
  }
}
