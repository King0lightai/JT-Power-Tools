// License Verification Service
// Handles Gumroad license key verification

const LicenseService = (() => {
  // Your Gumroad product permalink (you'll need to set this)
  const PRODUCT_PERMALINK = 'jtpowertools'; // e.g., 'jt-tools'

  // Verify license key with Gumroad API
  async function verifyLicense(licenseKey) {
    try {
      console.log('License: Verifying license key...');

      // Gumroad license verification endpoint
      const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'product_permalink': PRODUCT_PERMALINK,
          'license_key': licenseKey,
        })
      });

      const data = await response.json();
      console.log('License: API response:', data);

      if (data.success && data.purchase) {
        // License is valid
        const licenseData = {
          valid: true,
          key: licenseKey,
          purchaseEmail: data.purchase.email,
          productName: data.purchase.product_name,
          purchaseDate: data.purchase.created_at,
          verifiedAt: Date.now()
        };

        // Store license data
        await saveLicenseData(licenseData);

        console.log('License: Valid license activated');
        return { success: true, data: licenseData };
      } else {
        // License is invalid
        console.log('License: Invalid license key');
        return { success: false, error: data.message || 'Invalid license key' };
      }
    } catch (error) {
      console.error('License: Error verifying license:', error);
      return { success: false, error: 'Unable to verify license. Please check your internet connection.' };
    }
  }

  // Save license data to storage
  async function saveLicenseData(licenseData) {
    await chrome.storage.sync.set({ jtToolsLicense: licenseData });
    console.log('License: License data saved');
  }

  // Get stored license data
  async function getLicenseData() {
    try {
      const result = await chrome.storage.sync.get(['jtToolsLicense']);
      return result.jtToolsLicense || null;
    } catch (error) {
      console.error('License: Error getting license data:', error);
      return null;
    }
  }

  // Check if user has valid premium license
  async function hasValidLicense() {
    const licenseData = await getLicenseData();

    if (!licenseData || !licenseData.valid) {
      return false;
    }

    // Optional: Add expiration check if you want time-limited licenses
    // For now, once verified, it stays valid
    return true;
  }

  // Remove license (for deactivation)
  async function removeLicense() {
    await chrome.storage.sync.remove(['jtToolsLicense']);
    console.log('License: License removed');
  }

  // Public API
  return {
    verifyLicense,
    getLicenseData,
    hasValidLicense,
    removeLicense,
    PRODUCT_PERMALINK
  };
})();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.LicenseService = LicenseService;
}
