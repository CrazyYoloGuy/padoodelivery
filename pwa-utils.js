// PWA Utilities - Service Worker Registration and Install Prompt
class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.serviceWorker = null;
        this.init();
    }

    async init() {
        console.log('🚀 PWA Manager initializing...');
        
        // Check if already installed
        this.checkInstallStatus();
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Setup install prompt
        this.setupInstallPrompt();
        
        // Setup update checker
        this.setupUpdateChecker();
        
        // Add install button if not installed
        this.addInstallButton();
        
        // Setup offline indicator
        this.setupOfflineIndicator();
        
        console.log('✅ PWA Manager initialized');
    }

    checkInstallStatus() {
        // Check if app is installed
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('📱 App is running in standalone mode');
        } else if (window.navigator && window.navigator.standalone) {
            this.isInstalled = true;
            console.log('📱 App is running in iOS standalone mode');
        } else if (window.location.search.includes('source=pwa')) {
            this.isInstalled = true;
            console.log('📱 App launched from PWA');
        } else {
            console.log('🌐 App is running in browser mode');
        }
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
                
                // Check for existing service worker
                if (registration.active) {
                    console.log('🔧 Service Worker is active');
                }
                
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        } else {
            console.log('⚠️ Service Workers not supported');
        }
    }

    handleServiceWorkerUpdate(registration) {
        const newWorker = registration.installing;
        
        if (newWorker) {
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('🔄 New service worker available');
                    this.showUpdateAvailable();
                }
            });
        }
    }

    showUpdateAvailable() {
        // Create update notification
        const updateBanner = document.createElement('div');
        updateBanner.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #3b82f6;
                color: white;
                padding: 12px;
                text-align: center;
                z-index: 9999;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            ">
                <span>🔄 A new version is available!</span>
                <button onclick="window.pwa.updateApp()" style="
                    background: white;
                    color: #3b82f6;
                    border: none;
                    padding: 6px 12px;
                    margin-left: 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                ">Update Now</button>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: transparent;
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 6px 12px;
                    margin-left: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Later</button>
            </div>
        `;
        
        document.body.appendChild(updateBanner);
    }

    updateApp() {
        if (this.serviceWorker && this.serviceWorker.waiting) {
            this.serviceWorker.waiting.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
        }
    }

    setupInstallPrompt() {
        // Listen for beforeinstallprompt event (Android Chrome/Edge)
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('💾 Install prompt available');
            
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            this.deferredPrompt = e;
            
            // Show install button
            this.showInstallButton();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', (e) => {
            console.log('✅ App was installed successfully');
            this.isInstalled = true;
            this.hideInstallButton();
            this.showInstallSuccess();
        });

        // For iOS Safari - show install instructions only on landing page
        if (this.isIOSSafari() && !this.isInstalled && this.isLandingPage()) {
            setTimeout(() => {
                this.showInstallButton();
            }, 3000); // Show after 3 seconds
        }

        // For other mobile browsers - only on landing page
        if (this.isMobile() && !this.isInstalled && !this.deferredPrompt && this.isLandingPage()) {
            setTimeout(() => {
                this.showInstallButton();
            }, 5000); // Show after 5 seconds
        }
    }

    showInstallButton() {
        if (this.isInstalled || !this.isLandingPage()) return;
        
        const existingButton = document.querySelector('.pwa-install-btn');
        if (existingButton) {
            existingButton.style.display = 'block';
            return;
        }
        
        const installButton = document.createElement('button');
        installButton.className = 'pwa-install-btn';
        installButton.innerHTML = `
            📱 Install App
        `;
        installButton.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            z-index: 1000;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
        `;
        
        installButton.addEventListener('click', () => this.promptInstall());
        installButton.addEventListener('mouseenter', () => {
            installButton.style.transform = 'translateY(-2px)';
            installButton.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
        });
        installButton.addEventListener('mouseleave', () => {
            installButton.style.transform = 'translateY(0)';
            installButton.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
        });
        
        document.body.appendChild(installButton);
    }

    addInstallButton() {
        // Only show install button on landing page
        // For other pages, users should go to landing page to install
        if (!this.isInstalled && this.isLandingPage()) {
            setTimeout(() => {
                if (!document.querySelector('.pwa-install-btn')) {
                    this.showInstallButton();
                }
            }, 2000); // Show after 2 seconds if no prompt available
        }
    }

    hideInstallButton() {
        const installButton = document.querySelector('.pwa-install-btn');
        if (installButton) {
            installButton.style.display = 'none';
        }
    }

    async promptInstall() {
        if (!this.deferredPrompt) {
            // Fallback for browsers that don't support beforeinstallprompt
            this.showInstallInstructions();
            return;
        }
        
        try {
            // Show the install prompt
            this.deferredPrompt.prompt();
            
            // Wait for the user to respond
            const choiceResult = await this.deferredPrompt.userChoice;
            
            if (choiceResult.outcome === 'accepted') {
                console.log('✅ User accepted the install prompt');
            } else {
                console.log('❌ User dismissed the install prompt');
            }
            
            // Clear the deferred prompt
            this.deferredPrompt = null;
            
        } catch (error) {
            console.error('❌ Install prompt failed:', error);
            this.showInstallInstructions();
        }
    }

    showInstallInstructions() {
        const isIOS = this.isIOSSafari();
        const isAndroid = this.isAndroid();
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 20px;
                backdrop-filter: blur(5px);
            ">
                <div style="
                    background: white;
                    border-radius: 16px;
                    padding: 28px;
                    max-width: 420px;
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.25);
                    position: relative;
                    animation: modalSlideIn 0.3s ease-out;
                ">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📱</div>
                    <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 1.5rem; font-weight: 700;">Install Delivery App</h3>
                    <p style="margin: 0 0 24px 0; color: #6b7280; line-height: 1.5; font-size: 1rem;">
                        Get the full app experience with faster loading, offline access, and home screen installation.
                    </p>
                    
                    ${isIOS ? `
                        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: left;">
                            <div style="font-weight: 600; color: #92400e; margin-bottom: 12px; display: flex; align-items: center;">
                                <span style="font-size: 1.2rem; margin-right: 8px;">⚠️</span>
                                CRITICAL: Remove Browser UI
                            </div>
                            <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                                <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px; display: flex; align-items: center;">
                                    <span style="font-size: 1.2rem; margin-right: 8px;">🍎</span>
                                    iOS Safari Installation:
                                </div>
                                <ol style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.6;">
                                    <li>Tap the <strong>Share</strong> button (box with arrow) at the bottom</li>
                                    <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
                                    <li>Tap <strong>"Add"</strong> to confirm</li>
                                    <li>🎯 <strong>Open from HOME SCREEN only!</strong> (Not Safari!)</li>
                                </ol>
                            </div>
                            <div style="color: #92400e; font-weight: 600; font-size: 0.9rem;">
                                📝 Remember: Always launch from home screen to avoid browser branding!
                            </div>
                        </div>
                    ` : isAndroid ? `
                        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: left;">
                            <div style="font-weight: 600; color: #92400e; margin-bottom: 12px; display: flex; align-items: center;">
                                <span style="font-size: 1.2rem; margin-right: 8px;">⚠️</span>
                                CRITICAL: Remove Browser Branding
                            </div>
                            <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                                <div style="font-weight: 600; color: #1f2937; margin-bottom: 8px; display: flex; align-items: center;">
                                    <span style="font-size: 1.2rem; margin-right: 8px;">🤖</span>
                                    Android Chrome Installation:
                                </div>
                                <ol style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.6;">
                                    <li>Tap the <strong>menu</strong> (three dots) in the top right</li>
                                    <li>Tap <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong></li>
                                    <li>Tap <strong>"Install"</strong> to confirm (NOT just "Add"!)</li>
                                    <li>🎯 <strong>Open from HOME SCREEN only!</strong> (Not Chrome!)</li>
                                </ol>
                            </div>
                            <div style="color: #92400e; font-weight: 600; font-size: 0.9rem;">
                                📝 Remember: Open from home screen to remove browser logo from app switcher!
                            </div>
                        </div>
                    ` : `
                        <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 20px; text-align: left;">
                            <div style="font-weight: 600; color: #1f2937; margin-bottom: 12px;">Installation Options:</div>
                            <ul style="margin: 0; padding-left: 20px; color: #4b5563; line-height: 1.6;">
                                <li><strong>Chrome/Edge:</strong> Look for install icon in address bar</li>
                                <li><strong>Safari (iOS):</strong> Share → Add to Home Screen</li>
                                <li><strong>Chrome (Android):</strong> Menu → Add to Home Screen</li>
                                <li><strong>Firefox:</strong> Menu → Add to Home Screen</li>
                            </ul>
                        </div>
                    `}
                    
                    <div style="display: flex; gap: 12px; justify-content: center;">
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="
                            background: #3b82f6;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 1rem;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                            Got it!
                        </button>
                        <button onclick="window.pwa.hideInstallInstructions(); window.pwa.showInstallButton();" style="
                            background: #f3f4f6;
                            color: #6b7280;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 500;
                            font-size: 1rem;
                        ">
                            Remind Later
                        </button>
                    </div>
                </div>
            </div>
            <style>
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: translateY(30px) scale(0.9); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            </style>
        `;
        
        modal.id = 'install-instructions-modal';
        document.body.appendChild(modal);
    }

    showInstallSuccess() {
        const toast = document.createElement('div');
        toast.innerHTML = `
            <div style="
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
            ">
                ✅ App installed successfully!
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 3000);
    }

    setupUpdateChecker() {
        // Check for updates every 10 minutes when app is active
        setInterval(async () => {
            if (this.serviceWorker) {
                try {
                    await this.serviceWorker.update();
                } catch (error) {
                    console.error('❌ Update check failed:', error);
                }
            }
        }, 10 * 60 * 1000); // 10 minutes
    }

    // Helper methods for device detection
    isLandingPage() {
        // Check if we're on the landing page (root path)
        const path = window.location.pathname;
        return path === '/' || path === '/index.html' || path.includes('landingpage');
    }

    isIOSSafari() {
        const userAgent = window.navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent);
        const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
        return isIOS && isSafari;
    }

    isAndroid() {
        return /Android/.test(window.navigator.userAgent);
    }

    isMobile() {
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent);
    }

    hideInstallInstructions() {
        const modal = document.getElementById('install-instructions-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Utility methods for offline detection
    setupOfflineIndicator() {
        const showOfflineIndicator = () => {
            const indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #ef4444;
                    color: white;
                    padding: 8px;
                    text-align: center;
                    z-index: 9998;
                    font-size: 14px;
                ">
                    📡 You are currently offline
                </div>
            `;
            
            document.body.appendChild(indicator);
        };

        const hideOfflineIndicator = () => {
            const indicator = document.getElementById('offline-indicator');
            if (indicator) {
                document.body.removeChild(indicator);
            }
        };

        window.addEventListener('online', hideOfflineIndicator);
        window.addEventListener('offline', showOfflineIndicator);

        // Check initial state
        if (!navigator.onLine) {
            showOfflineIndicator();
        }
    }
}

// Initialize PWA Manager when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.pwa = new PWAManager();
    });
} else {
    window.pwa = new PWAManager();
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAManager;
} 