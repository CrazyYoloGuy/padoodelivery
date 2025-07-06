// Landing Page PWA Installation Manager
class DeliverRoutePWA {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.serviceWorker = null;
        this.init();
    }

    async init() {
        console.log('🚀 Landing Page PWA initializing...');
        
        // Check if already installed
        this.checkInstallStatus();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Setup install prompt handlers
        this.setupInstallPrompt();
        
        // Setup UI interactions
        this.setupUI();
        
        // Setup smooth scrolling
        this.setupSmoothScrolling();
        
        console.log('✅ Landing Page PWA initialized');
    }

    checkInstallStatus() {
        // Check if app is installed (running in standalone mode)
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('📱 App is running in standalone mode');
        } else if (window.navigator && window.navigator.standalone) {
            this.isInstalled = true;
            console.log('📱 App is running in iOS standalone mode');
        } else if (window.location.search.includes('source=pwa')) {
            this.isInstalled = true;
            console.log('📱 App launched from PWA');
        }

        // If installed, hide download buttons and show different message
        if (this.isInstalled) {
            this.handleInstalledState();
        }
    }

    handleInstalledState() {
        const downloadButtons = document.querySelectorAll('#downloadBtn, #downloadBtnMain');
        downloadButtons.forEach(btn => {
            if (btn) {
                btn.innerHTML = `
                    <span class="btn-icon">✅</span>
                    App Installed
                `;
                btn.disabled = true;
                btn.style.opacity = '0.7';
                btn.style.cursor = 'not-allowed';
            }
        });
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });
                
                this.serviceWorker = registration;
                console.log('✅ Service Worker registered successfully:', registration.scope);
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    console.log('🔄 Service Worker update found');
                    this.handleServiceWorkerUpdate(registration);
                });
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        } else {
            console.log('⚠️ Service Workers not supported');
        }
    }

    setupInstallPrompt() {
        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('💾 Install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', (e) => {
            console.log('✅ App was installed successfully');
            this.isInstalled = true;
            this.showInstallSuccess();
            this.handleInstalledState();
        });
    }

    setupUI() {
        // Download button handlers
        const downloadBtn = document.getElementById('downloadBtn');
        const downloadBtnMain = document.getElementById('downloadBtnMain');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.handleInstallClick());
        }
        
        if (downloadBtnMain) {
            downloadBtnMain.addEventListener('click', () => this.handleInstallClick());
        }

        // Modal handlers
        const modal = document.getElementById('installModal');
        const closeModal = document.getElementById('closeModal');
        
        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideModal());
        }
        
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal();
                }
            });
        }

        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                if (window.scrollY > 50) {
                    navbar.style.background = 'rgba(255, 255, 255, 0.98)';
                    navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
                } else {
                    navbar.style.background = 'rgba(255, 255, 255, 0.95)';
                    navbar.style.boxShadow = 'none';
                }
            }
        });

        // Animate elements on scroll
        this.setupScrollAnimations();
    }

    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.transform = 'translateY(0)';
                    entry.target.style.opacity = '1';
                }
            });
        }, observerOptions);

        // Observe feature cards
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach((card, index) => {
            card.style.transform = 'translateY(30px)';
            card.style.opacity = '0';
            card.style.transition = `all 0.6s ease ${index * 0.1}s`;
            observer.observe(card);
        });
    }

    setupSmoothScrolling() {
        // Handle navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    async handleInstallClick() {
        console.log('📱 Install button clicked');

        if (this.deferredPrompt) {
            try {
                this.deferredPrompt.prompt();
                const choiceResult = await this.deferredPrompt.userChoice;
                
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ User accepted the install prompt');
                } else {
                    console.log('❌ User dismissed the install prompt');
                }
                
                this.deferredPrompt = null;
                
            } catch (error) {
                console.error('❌ Install prompt failed:', error);
                this.showInstallInstructions();
            }
        } else {
            this.showInstallInstructions();
        }
    }

    showInstallInstructions() {
        const modal = document.getElementById('installModal');
        const stepsContainer = document.getElementById('installSteps');
        
        if (!modal || !stepsContainer) return;

        const instructions = this.generateInstallInstructions();
        stepsContainer.innerHTML = instructions;
        modal.classList.add('show');
    }

    generateInstallInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);

        if (isIOS) {
            return `
                <div class="install-step">
                    <h4>📱 Install on iOS Safari</h4>
                    <ol>
                        <li>Tap the <strong>Share button</strong> (box with arrow) at the bottom</li>
                        <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                        <li>Tap <strong>"Add"</strong> to confirm installation</li>
                        <li>Find the app icon on your home screen</li>
                    </ol>
                    <p><strong>Important:</strong> Always open from your home screen!</p>
                </div>
            `;
        } else if (isAndroid && isChrome) {
            return `
                <div class="install-step">
                    <h4>🤖 Install on Android Chrome</h4>
                    <ol>
                        <li>Tap the <strong>menu button</strong> (three dots) in the top right</li>
                        <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
                        <li>Tap <strong>"Install"</strong> to confirm</li>
                        <li>Find the app icon on your home screen</li>
                    </ol>
                    <p><strong>Important:</strong> Always open from your home screen!</p>
                </div>
            `;
        } else {
            return `
                <div class="install-step">
                    <h4>💻 Install Instructions</h4>
                    <p>To install this app:</p>
                    <ul>
                        <li><strong>Chrome/Edge:</strong> Look for the install icon in the address bar</li>
                        <li><strong>Safari (iOS):</strong> Use Share → Add to Home Screen</li>
                        <li><strong>Firefox:</strong> Use the menu → Add to Home Screen</li>
                    </ul>
                    <p>Once installed, open from your home screen for the best experience!</p>
                </div>
            `;
        }
    }

    hideModal() {
        const modal = document.getElementById('installModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    showInstallSuccess() {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            z-index: 9999;
            font-weight: 500;
        `;
        
        toast.innerHTML = '✅ App installed successfully!';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.deliverRoutePWA = new DeliverRoutePWA();
    });
} else {
    window.deliverRoutePWA = new DeliverRoutePWA();
}

// Add modal CSS
const style = document.createElement('style');
style.textContent = `
    .modal.show {
        display: flex !important;
    }
`;
document.head.appendChild(style);