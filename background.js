// Background script for Legal Document Summarizer extension
console.log('Background script loaded');

// API Key Manager will be loaded separately via script tag

// Listen for the extension being installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed or updated');
  
  // Initialize API key first (after a slight delay to ensure apiKeyManager is loaded)
  setTimeout(() => {
    if (window.apiKeyManager) {
      window.apiKeyManager.initializeApiKey();
    } else {
      console.error('API Key Manager not found - check script loading order');
    }
  }, 500);
  
  // Initialize other default settings
  chrome.storage.sync.get(['summaryLength', 'languageStyle', 'autoSummarize'], (result) => {
    // Only set values that don't already exist
    const settings = {};
    
    if (result.summaryLength === undefined) {
      settings.summaryLength = 'comprehensive';
    }
    
    if (result.languageStyle === undefined) {
      settings.languageStyle = 'simple';
    }
    
    if (result.autoSummarize === undefined) {
      settings.autoSummarize = false;
    }
    
    // If we have settings to save, save them
    if (Object.keys(settings).length > 0) {
      chrome.storage.sync.set(settings, () => {
        console.log('Default settings initialized:', settings);
      });
    }
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
              
              // Store the document text temporarily
              localStorage.setItem('autoSummarizeText', response.text);
              localStorage.setItem('autoSummarizeUrl', tab.url);
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
    const text = localStorage.getItem('autoSummarizeText');
    const url = localStorage.getItem('autoSummarizeUrl');
    
    if (text && url) {
      // Store for results page
      localStorage.setItem('documentText', text);
      localStorage.setItem('documentUrl', url);
      
      // Open results page
      chrome.windows.create({
        url: 'results.html',
        type: 'popup',
        width: 800,
        height: 600
      });
      
      // Clear temporary storage
      localStorage.removeItem('autoSummarizeText');
      localStorage.removeItem('autoSummarizeUrl');
    }
  }
});