/**
 * Surf Top Loader Plugin (NProgress-Grade)
 *
 * Provides a high-performance, GPU-accelerated progress bar for Surf.
 * Features:
 * - Trickle animation (convincing slowdown)
 * - Burst protection (no flicker on fast requests)
 * - Concurrency safety (handles multiple overlapping requests)
 * - GPU acceleration (scaleX)
 */

const TopLoader = {
  name: 'SurfTopLoader',
  // Config
  config: {
    showDelay: 120, // ms to wait before showing (anti-flicker)
    minVisible: 280, // ms to keep visible if shown
    minDuration: 400, // ms minimum total duration
    completeDuration: 180, // ms to go from N% to 100%
    fadeDuration: 200, // ms to fade out
    trickleSpeed: 120, // ms between trickle ticks
    height: '3px',
    color: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
    className: 'surf-top-loader',
    zIndex: 9999,
  },

  // State
  state: {
    active: 0, // Valid requests in flight
    progress: 0, // 0.0 to 1.0
    opacity: 0, // 0 or 1
    status: 'IDLE', // IDLE, PENDING, VISIBLE, COMPLETING, FADING
    lastStart: 0, // timestamp
    lastShow: 0, // timestamp
    rafId: null, // requestAnimationFrame ID
    timerId: null, // setTimeout ID for delays
  },

  // DOM
  element: null,

  /**
   * Install the plugin
   */
  install(Surf, options = {}) {
    Object.assign(this.config, options);
    this.ensureDom();

    // Bind Surf events
    Surf.on('pulse:start', this.start.bind(this));
    Surf.on('pulse:end', this.done.bind(this));
    Surf.on('pulse:error', this.error.bind(this)); // Handle API errors too
  },

  /**
   * Ensure DOM element exists and is attached
   */
  ensureDom() {
    // If element exists but was removed from DOM (e.g. page navigation), re-attach it
    if (this.element && !document.body.contains(this.element)) {
      document.body.appendChild(this.element);
      return;
    }

    // If element exists and is attached, nothing to do
    if (this.element) return;

    // Check if element already exists in DOM (from previous instance)
    const existing = document.getElementById(this.config.className);
    if (existing) {
      this.element = existing;
      return;
    }

    const el = document.createElement('div');
    el.id = this.config.className;
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: this.config.height,
      background: this.config.color,
      zIndex: this.config.zIndex,
      pointerEvents: 'none',
      transformOrigin: 'left',
      transform: 'scaleX(0)',
      opacity: '0',
      transition: 'transform 0.2s ease-out, opacity 0.2s linear',
    });

    document.body.appendChild(el);
    this.element = el;
  },

  /**
   * Start the loader sequence
   */
  start() {
    this.state.active++;
    this.state.lastStart = Date.now();

    if (this.state.status === 'IDLE' || this.state.status === 'FADING') {
      this.state.status = 'PENDING';
      this.state.progress = 0.08; // Start at 8% (psychological start)
      this.state.opacity = 0;
      this.ensureDom(); // Ensure DOM is ready before rendering
      this.render();

      // Delay showing to prevent flicker on fast requests
      if (this.state.timerId) clearTimeout(this.state.timerId);
      this.state.timerId = setTimeout(() => {
        if (this.state.active > 0) {
          this.show();
        }
      }, this.config.showDelay);
    }
  },

  /**
   * Transition to VISIBLE state
   */
  show() {
    this.state.status = 'VISIBLE';
    this.state.lastShow = Date.now();
    this.state.opacity = 1;
    this.ensureDom(); // Ensure DOM is ready
    this.render();
    this.tick();
  },

  /**
   * Request completed
   */
  done(force = false) {
    // If called by an event listener, force will be the event detail object (truthy)
    // We only want to treat it as true if explicitly passed as true
    const isForce = force === true;

    if (!isForce && this.state.active > 0) {
      this.state.active--;
    }

    // Only complete if no more active requests
    if (
      this.state.active === 0 &&
      (this.state.status === 'VISIBLE' || this.state.status === 'PENDING')
    ) {
      this.complete();
    } else if (this.state.active === 0 && this.state.status === 'PENDING') {
      // Finished before showing -> cancel pending
      this.reset();
    }
  },

  /**
   * Handle errors
   */
  error() {
    // Red flash could be added here
    this.done();
  },

  /**
   * Drive the completion sequence
   */
  complete() {
    if (this.state.status !== 'VISIBLE') {
      this.reset();
      return;
    }

    this.state.status = 'COMPLETING';

    // Ensure minimum visibility time
    const shownTime = Date.now() - this.state.lastShow;
    const remainingTime = Math.max(0, this.config.minVisible - shownTime);

    // Ensure DOM is ready for completion animation
    this.ensureDom();

    setTimeout(() => {
      if (this.state.status !== 'COMPLETING') return;

      this.state.progress = 1;
      this.render();

      setTimeout(() => {
        if (this.state.status !== 'COMPLETING') return;

        this.state.status = 'FADING';
        this.state.opacity = 0;
        this.render();

        setTimeout(() => {
          this.reset();
        }, this.config.fadeDuration);
      }, this.config.completeDuration);
    }, remainingTime);
  },

  /**
   * Render current state to DOM
   */
  render() {
    if (!this.element) return;

    // Use transform for GPU-accelerated width change
    this.element.style.transform = `scaleX(${this.state.progress})`;
    this.element.style.opacity = this.state.status === 'PENDING' ? '0' : this.state.opacity;

    // Manage transitions manually for different phases if needed
    if (this.state.status === 'COMPLETING') {
      this.element.style.transition = `transform ${this.config.completeDuration}ms ease-out, opacity ${this.config.fadeDuration}ms linear`;
    } else if (this.state.status === 'VISIBLE') {
      this.element.style.transition = 'transform 0.2s ease-out, opacity 0.2s linear';
    } else {
      this.element.style.transition = 'none';
    }
  },

  /**
   * Reset state
   */
  reset() {
    this.state.active = 0;
    this.state.progress = 0;
    this.state.opacity = 0;
    this.state.status = 'IDLE';
    if (this.state.rafId) cancelAnimationFrame(this.state.rafId);
    if (this.state.timerId) clearTimeout(this.state.timerId);
    this.render();
  },

  /**
   * Trickle animation loop
   */
  tick() {
    if (this.state.status !== 'VISIBLE') return;

    // Trickle logic: increment by random amount, decreasing as it approaches 1
    // (1 - progress) ensures it slows down and never quite reaches 100% on its own
    const amount = (1 - this.state.progress) * this.clamp(Math.random() * 0.03, 0.01, 0.92);

    this.state.progress = this.clamp(this.state.progress + amount, 0, 0.994);
    this.render();

    // Loop
    if (this.state.status === 'VISIBLE') {
      if (this.state.rafId) cancelAnimationFrame(this.state.rafId);
      // Throttled recursion via setTimeout to control speed, using rAF for the render
      setTimeout(() => {
        this.state.rafId = requestAnimationFrame(this.tick.bind(this));
      }, this.config.trickleSpeed);
    }
  },

  clamp(n, min, max) {
    if (n < min) return min;
    if (n > max) return max;
    return n;
  },
};

export default TopLoader;
