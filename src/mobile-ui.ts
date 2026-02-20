export enum BottomSheetState {
  COLLAPSED = 'collapsed',
  HALF_OPEN = 'half-open',
  FULL_OPEN = 'full-open',
}

export class BottomSheet {
  private container: HTMLElement;
  private sheet: HTMLElement;
  private backdrop: HTMLElement;
  private handle: HTMLElement;
  private content: HTMLElement;
  private state: BottomSheetState = BottomSheetState.COLLAPSED;
  
  private startY: number = 0;
  private currentY: number = 0;
  private isDragging: boolean = false;
  
  private listeners: Map<string, Array<(state: BottomSheetState) => void>> = new Map();

  constructor(container: HTMLElement, contentHTML: string) {
    this.container = container;
    this.createElements(contentHTML);
    this.attachEventListeners();
  }

  private createElements(contentHTML: string) {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'bottom-sheet-backdrop';
    this.backdrop.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      z-index: 999;
    `;

    // Create sheet
    this.sheet = document.createElement('div');
    this.sheet.className = 'bottom-sheet';
    this.sheet.style.cssText = `
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      border-radius: 20px 20px 0 0;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
      transform: translateY(calc(100% - 60px));
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1000;
      max-height: 90%;
      display: flex;
      flex-direction: column;
      touch-action: none;
    `;

    // Create handle
    this.handle = document.createElement('div');
    this.handle.className = 'bottom-sheet-handle';
    this.handle.style.cssText = `
      width: 40px;
      height: 4px;
      background: #ddd;
      border-radius: 2px;
      margin: 12px auto 8px;
      cursor: grab;
      flex-shrink: 0;
    `;

    // Create content container
    this.content = document.createElement('div');
    this.content.className = 'bottom-sheet-content';
    this.content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: 0 16px 20px;
    `;
    this.content.innerHTML = contentHTML;

    // Assemble
    this.sheet.appendChild(this.handle);
    this.sheet.appendChild(this.content);
    this.container.appendChild(this.backdrop);
    this.container.appendChild(this.sheet);
  }

  private attachEventListeners() {
    // Touch events for dragging
    this.handle.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.handle.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.handle.addEventListener('touchend', this.handleTouchEnd.bind(this));

    // Mouse events for desktop testing
    this.handle.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseEnd.bind(this));

    // Backdrop click
    this.backdrop.addEventListener('click', () => {
      this.setState(BottomSheetState.COLLAPSED);
    });

    // Prevent scrolling when sheet is open
    this.content.addEventListener('touchstart', (e) => {
      const target = e.target as HTMLElement;
      const isScrollable = target.scrollHeight > target.clientHeight;
      if (!isScrollable) {
        e.stopPropagation();
      }
    });
  }

  private handleTouchStart(e: TouchEvent) {
    this.isDragging = true;
    this.startY = e.touches[0].clientY;
    this.currentY = this.startY;
    this.sheet.style.transition = 'none';
    this.handle.style.cursor = 'grabbing';
  }

  private handleTouchMove(e: TouchEvent) {
    if (!this.isDragging) return;
    
    e.preventDefault();
    this.currentY = e.touches[0].clientY;
    const deltaY = this.currentY - this.startY;
    
    // Only allow dragging down from full-open, or up/down from other states
    const currentTransform = this.getTransformY();
    let newTransform = currentTransform + deltaY;
    
    // Clamp values
    const minTransform = 0; // Fully open
    const maxTransform = this.sheet.offsetHeight - 60; // Collapsed (show 60px)
    newTransform = Math.max(minTransform, Math.min(maxTransform, newTransform));
    
    this.sheet.style.transform = `translateY(${newTransform}px)`;
    
    // Update backdrop opacity
    const progress = 1 - (newTransform / maxTransform);
    this.backdrop.style.opacity = (progress * 0.3).toString();
  }

  private handleTouchEnd() {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.sheet.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    this.handle.style.cursor = 'grab';
    
    const deltaY = this.currentY - this.startY;
    const velocity = deltaY;
    
    // Determine next state based on gesture
    const sheetHeight = this.sheet.offsetHeight;
    const halfOpen = sheetHeight * 0.5;
    const collapsed = sheetHeight - 60;
    
    const currentTransform = this.getTransformY();
    
    let newState: BottomSheetState;
    
    if (velocity > 50) {
      // Swipe down
      if (this.state === BottomSheetState.FULL_OPEN) {
        newState = BottomSheetState.HALF_OPEN;
      } else {
        newState = BottomSheetState.COLLAPSED;
      }
    } else if (velocity < -50) {
      // Swipe up
      if (this.state === BottomSheetState.COLLAPSED) {
        newState = BottomSheetState.HALF_OPEN;
      } else {
        newState = BottomSheetState.FULL_OPEN;
      }
    } else {
      // Snap to nearest state based on position
      if (currentTransform < halfOpen / 2) {
        newState = BottomSheetState.FULL_OPEN;
      } else if (currentTransform < (halfOpen + collapsed) / 2) {
        newState = BottomSheetState.HALF_OPEN;
      } else {
        newState = BottomSheetState.COLLAPSED;
      }
    }
    
    this.setState(newState);
  }

  private handleMouseDown(e: MouseEvent) {
    this.isDragging = true;
    this.startY = e.clientY;
    this.currentY = this.startY;
    this.sheet.style.transition = 'none';
    this.handle.style.cursor = 'grabbing';
    e.preventDefault();
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    
    this.currentY = e.clientY;
    const deltaY = this.currentY - this.startY;
    
    const currentTransform = this.getTransformY();
    let newTransform = currentTransform + deltaY;
    
    const minTransform = 0;
    const maxTransform = this.sheet.offsetHeight - 60;
    newTransform = Math.max(minTransform, Math.min(maxTransform, newTransform));
    
    this.sheet.style.transform = `translateY(${newTransform}px)`;
    
    const progress = 1 - (newTransform / maxTransform);
    this.backdrop.style.opacity = (progress * 0.3).toString();
  }

  private handleMouseEnd() {
    if (!this.isDragging) return;
    this.handleTouchEnd();
  }

  private getTransformY(): number {
    const transform = this.sheet.style.transform;
    const match = transform.match(/translateY\((-?\d+(?:\.\d+)?)px\)/);
    return match ? parseFloat(match[1]) : 0;
  }

  public setState(state: BottomSheetState) {
    this.state = state;
    
    const sheetHeight = this.sheet.offsetHeight;
    
    switch (state) {
      case BottomSheetState.COLLAPSED:
        this.sheet.style.transform = `translateY(calc(100% - 60px))`;
        this.backdrop.style.opacity = '0';
        this.backdrop.style.pointerEvents = 'none';
        break;
      case BottomSheetState.HALF_OPEN:
        this.sheet.style.transform = `translateY(${sheetHeight * 0.5}px)`;
        this.backdrop.style.opacity = '0.15';
        this.backdrop.style.pointerEvents = 'auto';
        break;
      case BottomSheetState.FULL_OPEN:
        this.sheet.style.transform = 'translateY(0)';
        this.backdrop.style.opacity = '0.3';
        this.backdrop.style.pointerEvents = 'auto';
        break;
    }
    
    this.notifyListeners('stateChange', state);
  }

  public getState(): BottomSheetState {
    return this.state;
  }

  public toggle() {
    if (this.state === BottomSheetState.COLLAPSED) {
      this.setState(BottomSheetState.HALF_OPEN);
    } else {
      this.setState(BottomSheetState.COLLAPSED);
    }
  }

  public on(event: string, callback: (state: BottomSheetState) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  private notifyListeners(event: string, state: BottomSheetState) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(state));
    }
  }

  public updateContent(contentHTML: string) {
    this.content.innerHTML = contentHTML;
  }

  public getContentElement(): HTMLElement {
    return this.content;
  }

  public destroy() {
    this.backdrop.remove();
    this.sheet.remove();
    this.listeners.clear();
  }
}
