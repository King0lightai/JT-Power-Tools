// License Verification Service
// Handles secure license key verification via server-side proxy

const LicenseService = (() => {
  // ⚠️ IMPORTANT: Set this to your deployed license proxy URL
  // See server/DEPLOYMENT.md for setup instructions
  const LICENSE_PROXY_URL = 'https://jt-tools-license-proxy.king0light-ai.workers.dev/'; // UPDATE THIS!

  // Product configuration (kept for compatibility)
  const PRODUCT_PERMALINK = 'jtpowertools';

  // Re-validation interval (24 hours)
  const REVALIDATION_INTERVAL = 24 * 60 * 60 * 1000;

  // Simple encryption key derived from extension ID
  const ENCRYPTION_KEY = 'jt-power-tools-v1';

  // Verify license key via secure proxy
  async function verifyLicense(licenseKey) {
    try {
      if (LICENSE_PROXY_URL.includes('YOUR_WORKER_URL')) {
        console.error('License: LICENSE_PROXY_URL not configured!');
        return {
          success: false,
          error: 'License validation not configured. Please deploy the license proxy server.'
        };
      }

      console.log('License: Verifying license key via proxy...');

      // Call our secure proxy server instead of Gumroad directly
      const response = await fetch(LICENSE_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: licenseKey,
          action: 'verify'
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        // License is valid - encrypt and store
        const licenseData = {
          valid: true,
          key: licenseKey,
          purchaseEmail: result.data.purchaseEmail,
          productName: result.data.productName,
          purchaseDate: result.data.purchaseDate,
          verifiedAt: result.data.verifiedAt,
          signature: result.data.signature,
          lastRevalidated: Date.now()
        };

        // Encrypt and store license data
        await saveLicenseData(licenseData);

        console.log('License: Valid license activated');
        return { success: true, data: licenseData };
      } else {
        // License is invalid
        console.log('License: Invalid license key');
        return { success: false, error: result.error || 'Invalid license key' };
      }
    } catch (error) {
      console.error('License: Error verifying license:', error);
      return {
        success: false,
        error: 'Unable to verify license. Please check your internet connection and try again.'
      };
    }
  }

  // Re-validate existing license (periodic check)
  async function revalidateLicense() {
    try {
      const licenseData = await getLicenseData();

      if (!licenseData || !licenseData.key) {
        return { success: false, error: 'No license to revalidate' };
      }

      console.log('License: Re-validating existing license...');

      const response = await fetch(LICENSE_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          licenseKey: licenseData.key,
          action: 'revalidate'
        })
      });

      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Update stored license data
        licenseData.lastRevalidated = Date.now();
        licenseData.signature = result.data.signature;
        await saveLicenseData(licenseData);

        console.log('License: Re-validation successful');
        return { success: true, data: licenseData };
      } else {
        // License no longer valid (refunded, revoked, etc.)
        console.warn('License: Re-validation failed - license may be revoked');
        await removeLicense();
        return { success: false, error: 'License is no longer valid' };
      }
    } catch (error) {
      console.error('License: Error re-validating license:', error);
      // Don't remove license on network errors, just skip re-validation
      return { success: false, error: 'Re-validation failed', silent: true };
    }
  }

  // Simple XOR encryption for license data
  function encrypt(text) {
    try {
      const textBytes = new TextEncoder().encode(text);
      const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
      const encrypted = new Uint8Array(textBytes.length);

      for (let i = 0; i < textBytes.length; i++) {
        encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
      }

      // Convert to base64
      return btoa(String.fromCharCode(...encrypted));
    } catch (error) {
      console.error('License: Encryption error:', error);
      return text; // Fallback to plaintext if encryption fails
    }
  }

  function decrypt(encryptedText) {
    try {
      // Decode from base64
      const encrypted = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      const keyBytes = new TextEncoder().encode(ENCRYPTION_KEY);
      const decrypted = new Uint8Array(encrypted.length);

      for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
      }

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('License: Decryption error:', error);
      return null;
    }
  }

  // Save license data to storage (encrypted)
  async function saveLicenseData(licenseData) {
    try {
      // Encrypt sensitive data
      const encrypted = encrypt(JSON.stringify(licenseData));
      await chrome.storage.sync.set({
        jtToolsLicense: encrypted,
        jtToolsLicenseVersion: 2 // Version flag for encrypted format
      });
      console.log('License: Encrypted license data saved');
    } catch (error) {
      console.error('License: Error saving license data:', error);
    }
  }

  // Get stored license data (decrypt if needed)
  async function getLicenseData() {
    try {
      const result = await chrome.storage.sync.get(['jtToolsLicense', 'jtToolsLicenseVersion']);

      if (!result.jtToolsLicense) {
        return null;
      }

      // Handle encrypted data (v2)
      if (result.jtToolsLicenseVersion === 2) {
        const decrypted = decrypt(result.jtToolsLicense);
        return decrypted ? JSON.parse(decrypted) : null;
      }

      // Handle legacy unencrypted data (v1) - migrate it
      if (typeof result.jtToolsLicense === 'object') {
        console.log('License: Migrating legacy license data to encrypted format');
        await saveLicenseData(result.jtToolsLicense);
        return result.jtToolsLicense;
      }

      return null;
    } catch (error) {
      console.error('License: Error getting license data:', error);
      return null;
    }
  }

  // Check if user has valid premium license (with re-validation)
  async function hasValidLicense() {
    const licenseData = await getLicenseData();

    if (!licenseData || !licenseData.valid) {
      return false;
    }

    // Check if re-validation is needed (24 hours since last check)
    const lastRevalidated = licenseData.lastRevalidated || licenseData.verifiedAt;
    const timeSinceRevalidation = Date.now() - lastRevalidated;

    if (timeSinceRevalidation > REVALIDATION_INTERVAL) {
      console.log('License: Re-validation required (24 hours elapsed)');

      // Re-validate in background
      const result = await revalidateLicense();

      if (!result.success) {
        // If re-validation failed due to network, allow temporary access
        if (result.silent) {
          console.warn('License: Re-validation failed (network), allowing temporary access');
          return true;
        }
        // If license was actually revoked, deny access
        return false;
      }
    }

    return true;
  }

  // Check if re-validation is needed on startup
  async function checkRevalidationNeeded() {
    const licenseData = await getLicenseData();

    if (!licenseData || !licenseData.valid) {
      return;
    }

    const lastRevalidated = licenseData.lastRevalidated || licenseData.verifiedAt;
    const timeSinceRevalidation = Date.now() - lastRevalidated;

    // If more than 24 hours, trigger re-validation
    if (timeSinceRevalidation > REVALIDATION_INTERVAL) {
      console.log('License: Triggering background re-validation on startup');
      revalidateLicense().catch(err => {
        console.error('License: Background re-validation error:', err);
      });
    }
  }

  // Remove license (for deactivation)
  async function removeLicense() {
    await chrome.storage.sync.remove(['jtToolsLicense', 'jtToolsLicenseVersion']);
    console.log('License: License removed');
  }

  // Public API
  return {
    verifyLicense,
    revalidateLicense,
    getLicenseData,
    hasValidLicense,
    removeLicense,
    checkRevalidationNeeded,
    PRODUCT_PERMALINK
  };
})();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.LicenseService = LicenseService;
}

// Check if re-validation needed on extension startup
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Run revalidation check when extension loads
  LicenseService.checkRevalidationNeeded();
}
