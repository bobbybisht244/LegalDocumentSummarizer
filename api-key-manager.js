// API Key Manager for Legal Document Summarizer
// This file handles the secure storage and retrieval of API keys

// Default API key - stored in an encoded format for basic obfuscation
// This isn't true security, but helps avoid casual inspection
const encodedDefaultKey = 'c2stcHJvai1qVkwzamk5djVzN3RDWnhOM1E0dTNsUU5tUi1QLTFieEsxZ3NnZzF1Mjc4RGYwaXplcHlQcWN3QWhoRFlCZ294eXZucXA5eGFnblQzQmxia0ZKM094OTVDMkhJdXk2aWdSNU5YaUFMX0poam5XdGE3bUZjUWJGbk5tdG1fV1hxQ1JvYjQ0YTBMWWdCQ29wRnVPT2JybFF0RWRCNEE=';

/**
 * Decode the stored API key
 * @returns {string} - The decoded API key
 */
function decodeApiKey() {
  // Simple base64 decoding - not truly secure but better than plaintext
  return atob(encodedDefaultKey);
}

/**
 * Initialize the API Key during extension installation
 * This is called from background.js during the installation process
 */
function initializeApiKey() {
  // Always use the secured default key
  const defaultApiKey = decodeApiKey();
  
  // Store the API key in Chrome's sync storage
  chrome.storage.sync.set({ apiKey: defaultApiKey }, () => {
    console.log('API key initialized successfully');
  });
}

/**
 * Verify that the API key is valid
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<boolean>} - Whether the API key is valid
 */
function validateApiKey(apiKey) {
  return new Promise((resolve) => {
    // Basic format validation
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      resolve(false);
      return;
    }
    
    // Check if it follows the OpenAI API key format (both standard and project keys)
    // This is a simple regex check, not a full validation
    const openAIKeyPattern = /^sk-(proj-)?[A-Za-z0-9_-]{32,}$/;
    if (!openAIKeyPattern.test(apiKey)) {
      resolve(false);
      return;
    }
    
    // For now, assume the key is valid if it matches the pattern
    // In a production app, you might want to make a test API call
    resolve(true);
  });
}

/**
 * Get the stored API key
 * @returns {Promise<string>} - The API key (always returns the default key)
 */
function getApiKey() {
  return new Promise((resolve) => {
    // Always use the default key
    resolve(decodeApiKey());
  });
}

// Make functions available in global context instead of ES modules
// This is more compatible with Chrome extensions
window.apiKeyManager = {
  initializeApiKey,
  validateApiKey,
  getApiKey
};