// Background wrapper script for Legal Document Summarizer
console.log('Background wrapper script loaded');

// API Key Manager component
const encodedDefaultKey = 'c2stcHJvai1qVkwzamk5djVzN3RDWnhOM1E0dTNsUU5tUi1QLTFieEsxZ3NnZzF1Mjc4RGYwaXplcHlQcWN3QWhoRFlCZ294eXZucXA5eGFnblQzQmxia0ZKM094OTVDMkhJdXk2aWdSNU5YaUFMX0poam5XdGE3bUZjUWJGbk5tdG1fV1hxQ1JvYjQ0YTBMWWdCQ29wRnVPT2JybFF0RWRCNEE=';

// Decode the stored API key
function decodeApiKey() {
  // Simple base64 decoding
  try {
    return atob(encodedDefaultKey);
  } catch (e) {
    console.error('Error decoding API key:', e);
    return '';
  }
}

// Initialize the API Key during extension installation
function initializeApiKey() {
  // Always use the secured default key
  const defaultApiKey = decodeApiKey();
  
  // Store the API key in Chrome's sync storage
  chrome.storage.sync.set({ apiKey: defaultApiKey }, () => {
    console.log('API key initialized successfully');
  });
}

// Validate that the API key is valid
function validateApiKey(apiKey) {
  return new Promise((resolve) => {
    // Basic format validation
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      resolve(false);
      return;
    }
    
    // Check if it follows the OpenAI API key format (both standard and project keys)
    const openAIKeyPattern = /^sk-(proj-)?[A-Za-z0-9_-]{32,}$/;
    if (!openAIKeyPattern.test(apiKey)) {
      resolve(false);
      return;
    }
    
    // For now, assume the key is valid if it matches the pattern
    resolve(true);
  });
}

// Get the stored API key
function getApiKey() {
  return new Promise((resolve) => {
    // Always use the default key
    resolve(decodeApiKey());
  });
}

// Background script functionality
// Listen for the extension being installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated');
  
  // Initialize legacy API key first for backward compatibility
  initializeApiKey();
  
  // In service worker context, we need to use self instead of window
  // and we need to manually implement the functions we need
  
  // Define API key management for background script directly
  // instead of trying to import the multi-model-api.js file
  
  // Base64 encoded API keys for security (copied from multi-model-api.js)
  const encodedApiKeys = {
    openai: 'c2stcHJvai1qVkwzamk5djVzN3RDWnhOM1E0dTNsUU5tUi1QLTFieEsxZ3NnZzF1Mjc4RGYwaXplcHlQcWN3QWhoRFlCZ294eXZucXA5eGFnblQzQmxia0ZKM094OTVDMkhJdXk2aWdSNU5YaUFMX0poam5XdGE3bUZjUWJGbk5tdG1fV1hxQ1JvYjQ0YTBMWWdCQ29wRnVPT2JybFF0RWRCNEE=',
    gemini: 'QUFBQVVMTG4xcml0VGtDa1VfMHh6a05MZHZVU0hzUHRqTmdma3FXU1FPRGRUNWNOa0FZd24yUU1sN0FxYXd3MHRRYmZOdXhjVldLeU1fZkI4bzFLTGc=',
    anthropic: 'c2tfYW50XzNkdkxDaDhWQlljcnpndjZQdWxNcnlxUUZnUjExN1U4SWRQMFJyRlBvSGxJdGJm'
  };
  
  // Store the API keys in chrome.storage.local so they're accessible across contexts
  chrome.storage.local.set({ multiModelApiKeys: encodedApiKeys }, () => {
    console.log('Multi-model API keys initialized in background script');
  });
  
  // Check if auto-summarize is enabled
  chrome.storage.sync.get(['autoSummarize'], (result) => {
    const autoSummarize = result.autoSummarize !== false; // Default to true if not set
    console.log('Auto-summarize is', autoSummarize ? 'enabled' : 'disabled');
  });
  
  // Set default settings
  const settings = {
    summaryLength: 'comprehensive',
    languageStyle: 'simple',
    autoSummarize: true, // Enable auto-summarize by default since we no longer have a settings page
    useMultiModel: true  // Enable multi-model analysis by default
  };
  
  // Save default settings
  chrome.storage.sync.set(settings, () => {
    console.log('Default settings initialized:', settings);
  });
});

// Listen for tab updates to automatically summarize legal documents
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only proceed if the tab has completed loading and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if auto-summarize is enabled
    checkAutoSummarize();
  }
});

function checkAutoSummarize() {
  // Check if auto-summarize is enabled
  chrome.storage.sync.get(['autoSummarize', 'apiKey'], (result) => {
    // Auto-summarize is disabled or API key is not set
    if (!result.autoSummarize || !result.apiKey) {
      return;
    }
    
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0 || !tabs[0].id) {
        return;
      }
      
      const tab = tabs[0];
      
      // Comprehensive check for common legal document patterns in URLs
      const legalUrlPatterns = [
        // Terms-related documents
        /terms/i, /tos/i, /terms.*service/i, /terms.*use/i, /terms.*conditions/i,
        // Privacy-related documents
        /privacy/i, /privacy.*policy/i, /data.*policy/i, /data.*protection/i,
        // EULA and license-related
        /eula/i, /license.*agreement/i, /end.*user.*license/i, /user.*agreement/i,
        // Cookie and tracking-related
        /cookie/i, /cookie.*policy/i, /cookie.*notice/i,
        // General legal pages
        /legal/i, /disclaimer/i, /conditions/i, /guidelines/i, /policy/i,
        // E-commerce-related legal documents
        /refund/i, /return.*policy/i, /shipping.*policy/i,
        // Community and content rules
        /community.*guidelines/i, /content.*policy/i, /acceptable.*use/i,
        // Privacy regulations
        /gdpr/i, /ccpa/i, /personal.*information/i, /data.*processing/i,
        // Dispute resolution
        /dispute/i, /arbitration/i, /class.*action/i, 
        // API and developer documents
        /api.*terms/i, /developer.*terms/i, /developer.*policy/i,
        // Subscription and billing
        /subscription.*terms/i, /billing.*policy/i, /payment.*terms/i,
        // Other legal documents
        /accessibility/i, /nda/i, /confidentiality/i, /workplace.*policy/i
      ];
      
      // Check if URL might be a legal page
      const mightBeLegalPage = legalUrlPatterns.some(pattern => 
        pattern.test(tab.url) || 
        (tab.title && pattern.test(tab.title)));
      
      if (mightBeLegalPage) {
        // Wait a moment to make sure content script is loaded
        setTimeout(() => {
          // Check if content script is ready by sending a ping
          chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('Content script not ready yet for auto-summarize');
              return;
            }
            
            // Extract text and show notification
            chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TEXT' }, (response) => {
              if (chrome.runtime.lastError || !response || !response.text || response.text.length < 100) {
                return;
              }
              
              // Create notification that legal text was found
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Legal Document Detected',
                message: 'Would you like to summarize and analyze this legal document?',
                buttons: [{ title: 'Summarize Now' }],
                priority: 2
              });
              
              // Store the document text temporarily in chrome.storage.local instead of localStorage
              // localStorage is not recommended in background scripts
              chrome.storage.local.set({ 
                'autoSummarizeText': response.text,
                'autoSummarizeUrl': tab.url
              });
            });
          });
        }, 1500); // Delay to ensure content script is loaded
      }
    });
  });
}

// Listen for notification clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "Summarize Now" button
    // Get the stored text and URL from chrome.storage.local
    chrome.storage.local.get(['autoSummarizeText', 'autoSummarizeUrl'], (result) => {
      const text = result.autoSummarizeText;
      const url = result.autoSummarizeUrl;
      
      if (text && url) {
        // Store for results page using chrome.storage.local
        chrome.storage.local.set({
          'documentText': text,
          'documentUrl': url
        }, () => {
          // Open results page
          chrome.windows.create({
            url: 'results.html',
            type: 'popup',
            width: 800,
            height: 600
          });
          
          // Clear temporary storage
          chrome.storage.local.remove(['autoSummarizeText', 'autoSummarizeUrl']);
        });
      }
    });
  }
});