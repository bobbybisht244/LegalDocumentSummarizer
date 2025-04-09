// Content script for Legal Document Summarizer
console.log('Content script loaded: Legal Document Summarizer');

// Set a global flag to indicate the content script is ready
window.legalSummarizerContentScriptReady = true;

// Debug mode for logging
const DEBUG = true;

// Debug logging function
function logDebug(message, ...args) {
  if (DEBUG) {
    console.log(`[Legal Summarizer] ${message}`, ...args);
  }
}

logDebug('Starting content script');

// Function to check if the page is a legal document
function isLegalDocument() {
  // Always consider the page a legal document when running from the popup
  // This avoids cases where our detection might fail but the user wants to analyze anyway
  if (window.manuallyActivated) {
    logDebug('Manual activation detected, treating as legal document');
    return true;
  }
  
  // 1. Check the URL for legal document patterns
  const url = window.location.href.toLowerCase();
  const urlPatterns = [
    '/terms', '/tos', '/terms-of-service', '/terms-of-use', '/terms-and-conditions',
    '/eula', '/end-user-license-agreement', '/license-agreement', '/user-agreement',
    '/privacy', '/privacy-policy', '/data-policy', '/data-protection',
    '/cookie', '/cookie-policy', '/cookie-notice',
    '/legal', '/disclaimer', '/guidelines', '/rules', '/conditions',
    '/refund-policy', '/returns', '/shipping-policy', '/return-policy',
    '/acceptable-use', '/acceptable-use-policy', '/community-guidelines',
    '/content-policy', '/copyright', '/ip-policy', '/ip-notice',
    '/dmca', '/gdpr', '/ccpa', '/personal-information', '/data-processing',
    '/dispute', '/arbitration', '/class-action', '/liability',
    '/api-terms', '/api-policy', '/developer-terms', '/developer-policy',
    '/subscription-terms', '/billing-policy', '/payment-terms',
    '/accessibility', '/nda', '/confidentiality', '/workplace-policy',
    // Add Apple specific URL patterns
    '/internet-services/itunes', '/apple-pay', '/app-store/terms-conditions'
  ];
  
  const hasLegalUrl = urlPatterns.some(pattern => url.includes(pattern));
  if (hasLegalUrl) {
    logDebug('Legal document detected based on URL pattern');
    return true;
  }
  
  // 2. Check the page title
  const title = document.title.toLowerCase();
  const titlePatterns = [
    'terms', 'term of', 'conditions', 'privacy', 'policy', 'legal', 'eula',
    'license agreement', 'user agreement', 'copyright', 'disclaimer',
    'cookies', 'gdpr', 'ccpa', 'data protection', 'refund', 'return',
    'acceptable use', 'community guidelines', 'content policy', 'api terms',
    'arbitration', 'dispute resolution', 'liability', 'indemnification',
    'confidentiality', 'nda', 'non-disclosure', 'apple media services'
  ];
  
  const hasLegalTitle = titlePatterns.some(pattern => title.includes(pattern));
  if (hasLegalTitle) {
    logDebug('Legal document detected based on page title');
    return true;
  }
  
  // 3. Check for legal headings
  const headings = document.querySelectorAll('h1, h2, h3');
  const headingTexts = Array.from(headings).map(h => h.innerText.toLowerCase());
  const headingPatterns = [
    'terms of service', 'terms of use', 'terms and conditions',
    'end user license agreement', 'eula', 'privacy policy',
    'cookie policy', 'user agreement', 'legal terms',
    'refund policy', 'return policy', 'shipping policy',
    'acceptable use policy', 'community guidelines', 'content policy',
    'api terms', 'developer terms', 'copyright notice',
    'disclaimer', 'gdpr', 'ccpa', 'data protection',
    'arbitration agreement', 'dispute resolution', 'liability',
    'non-disclosure agreement', 'confidentiality', 'workplace policy',
    'apple media services', 'itunes store terms'
  ];
  
  const hasLegalHeading = headingTexts.some(text => 
    headingPatterns.some(pattern => text.includes(pattern))
  );
  
  if (hasLegalHeading) {
    logDebug('Legal document detected based on headings');
    return true;
  }
  
  // 4. Check for common phrases in the text that indicate it's a legal document
  const bodyText = document.body.innerText.toLowerCase();
  const legalPhrases = [
    'terms of service', 'terms of use', 'end user license agreement',
    'privacy policy', 'acceptable use policy', 'cookie policy',
    'terms and conditions', 'user agreement', 'legal notice',
    'by accessing this', 'by using this', 'you agree to', 'you consent to',
    'legal agreement between', 'binding agreement', 'at its sole discretion',
    'intellectual property rights', 'limited license to', 'copyright protection',
    'warranty disclaimer', 'limitation of liability', 'indemnification',
    'governing law', 'jurisdiction', 'arbitration', 'dispute resolution',
    'class action waiver', 'severability', 'entire agreement',
    'modifications to these terms', 'termination of account',
    'refund policy', 'return policy', 'shipping policy',
    'data processing agreement', 'gdpr compliance', 'ccpa compliance',
    'personal information collection', 'data controller', 'data processor',
    'subscription terms', 'billing agreement', 'payment processing',
    'prohibited content', 'prohibited conduct', 'content moderation',
    'api usage', 'developer guidelines', 'rate limiting',
    'confidentiality obligations', 'non-disclosure', 'workplace policy',
    'apple media services', 'apple id', 'itunes store'
  ];
  
  // Check if the document has a substantial number of legal phrases
  let legalPhraseCount = 0;
  let detectedPhrases = [];
  for (const phrase of legalPhrases) {
    if (bodyText.includes(phrase)) {
      legalPhraseCount++;
      detectedPhrases.push(phrase);
      if (legalPhraseCount >= 3) { // If we find at least 3 legal phrases, consider it a legal document
        logDebug('Legal document detected based on legal phrases', detectedPhrases);
        return true;
      }
    }
  }
  
  // 5. Check if the URL domain is known to host legal documents
  const knownLegalDomains = [
    'termsfeed.com', 'tosdr.org', 'apple.com/legal', 'iubenda.com',
    'privacypolicy.com', 'termsofservice.com', 'policies.google.com',
    'facebook.com/policy', 'twitter.com/tos', 'legal.yahoo.com',
    'amazon.com/gp/help/customer/display.html', 'adobe.com/legal',
    'linkedin.com/legal', 'github.com/site/terms', 'spotify.com/legal',
    'paypal.com/webapps/mpp/ua', 'netflix.com/legal'
  ];
  
  const isDomainLegal = knownLegalDomains.some(domain => url.includes(domain));
  if (isDomainLegal) {
    logDebug('Legal document detected based on domain');
    return true;
  }
  
  // If we haven't detected it as a legal document by now, it probably isn't one
  logDebug('Not detected as a legal document');
  return false;
}

// Function to extract legal text from the page
function extractLegalText() {
  logDebug('Extracting legal text');
  
  // Special handling for Apple's legal pages
  const url = window.location.href.toLowerCase();
  
  // Special case for Apple iTunes Terms page
  if (url.includes('apple.com') && url.includes('/internet-services/itunes') && url.includes('/terms.html')) {
    logDebug('Detected Apple iTunes Terms page, using iTunes-specific extraction');
    return extractAppleItunesTerms();
  }
  // General case for other Apple legal pages 
  else if (url.includes('apple.com') && (url.includes('/legal/') || url.includes('/terms') || url.includes('/itunes'))) {
    logDebug('Detected Apple legal page, using special extraction');
    return extractAppleLegalText();
  }
  
  // Always extract text if manually activated, otherwise check if it's a legal document
  if (!window.manuallyActivated && !isLegalDocument()) {
    logDebug('Not a legal document and not manually activated');
    return null; // Not a legal document, return null
  }
  
  logDebug('Starting text extraction process');
  
  // ======= Method 1: Try specific legal document selectors =======
  const contentSelectors = [
    // Specific legal document selectors first
    'div.terms', 'div.terms-of-service', 'div.tos', 'div.privacy-policy', 'div.legal',
    'div.eula', 'div.agreement', 'div.conditions', 'div.policy',
    'section.terms', 'section.privacy', 'section.legal', 'section.policy',
    'article.terms', 'article.privacy', 'article.legal', 'article.policy',
    '.legal-content', '.terms-content', '.privacy-content', '.policy-content',
    '#terms', '#privacy', '#legal', '#tos', '#eula', '#agreement', '#conditions', '#policy',
    '.terms', '.privacy', '.tos', '.agreement', '.policy',
    
    // Main content areas
    'main[role="main"]', 'main', 'article', '.main-content', '.article-content', 
    '.page-content', '.content-wrapper', '#content', '#main', '#main-content',
    
    // For larger websites with specific layouts
    '.main.terms', '.main.legal', '#main-content section', 'section[data-analytics-section="legal"]',
    '[data-testid="legal-content"]', '[data-testid="terms"]', '[data-testid="privacy"]',
    '[data-component="legal"]', '[data-component="terms"]',
    
    // Common content containers
    '.container', '.content', '.page', '.page-container', '.wrapper', '.main',
    '#container', '#wrapper', '#page', '#legal', '#policy-content',
    
    // For iframe-based legal documents
    'iframe[src*="terms"]', 'iframe[src*="privacy"]', 'iframe[src*="legal"]'
  ];
  
  // Try each selector to find legal content
  for (const selector of contentSelectors) {
    // Handle iframe content if needed
    if (selector.startsWith('iframe')) {
      try {
        const iframes = document.querySelectorAll(selector);
        for (const iframe of iframes) {
          try {
            const iframeContent = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeContent && iframeContent.body) {
              const text = iframeContent.body.innerText.trim();
              if (text.length > 500) {
                logDebug('Found legal content in iframe:', selector);
                return text;
              }
            }
          } catch (e) {
            // Cross-origin iframe access is restricted
            logDebug('Cannot access iframe content due to security restrictions');
          }
        }
      } catch (e) {
        logDebug('Error accessing iframe content:', e);
      }
      continue;
    }
    
    // Process regular selectors
    const elements = document.querySelectorAll(selector);
    
    if (elements.length > 0) {
      // Sort by content length, get the one with the most content
      const contentElements = Array.from(elements).map(el => ({
        element: el,
        text: el.innerText.trim(),
        length: el.innerText.trim().length
      })).filter(item => item.length > 0);
      
      if (contentElements.length > 0) {
        contentElements.sort((a, b) => b.length - a.length);
        
        // If the longest content is substantial, use it
        if (contentElements[0].length > 500) {
          logDebug(`Found legal content in selector "${selector}": ${contentElements[0].length} chars`);
          return contentElements[0].text;
        }
      }
    }
  }
  
  // ======= Method 2: Check for elements with legal-related IDs or classes =======
  logDebug('Trying legal-related ID/class detection');
  const potentialLegalElements = Array.from(document.querySelectorAll(
    '[id*="terms"], [id*="privacy"], [id*="legal"], [id*="policy"], [id*="eula"], [id*="conditions"], ' +
    '[class*="terms"], [class*="privacy"], [class*="legal"], [class*="policy"], [class*="eula"], [class*="conditions"]'
  ));
  
  if (potentialLegalElements.length > 0) {
    // Find the largest potential legal element
    const filteredElements = potentialLegalElements
      .filter(el => !isElementHidden(el) && el.innerText.trim().length > 0);
      
    if (filteredElements.length > 0) {
      filteredElements.sort((a, b) => b.innerText.trim().length - a.innerText.trim().length);
      const largestElement = filteredElements[0];
      
      if (largestElement.innerText.trim().length > 500) {
        logDebug(`Found legal content by ID/class: ${largestElement.innerText.trim().length} chars`);
        return largestElement.innerText.trim();
      }
    }
  }
  
  // ======= Method 3: Use direct text node extraction (like in Apple method) =======
  logDebug('Using direct text node extraction');
  
  const legalText = [];
  const paragraphs = new Set(); // Use a Set to avoid duplicates
  
  // Look for all text-containing elements
  const findTextElements = (element) => {
    // Skip hidden elements and navigation/scripts
    if (isElementHidden(element) || 
        element.tagName === 'SCRIPT' || 
        element.tagName === 'STYLE' ||
        element.tagName === 'NOSCRIPT' ||
        element.closest('nav') || 
        element.closest('footer') ||
        element.closest('header')) {
      return;
    }
    
    // If this element has direct text (not just whitespace),
    // and doesn't have too many children, it's likely a text block
    const text = element.innerText.trim();
    if (text.length > 50 && element.children.length < 5) {
      if (!paragraphs.has(text)) {  // Avoid duplicates
        paragraphs.add(text);
        legalText.push(text);
      }
    }
    
    // Recursively process children
    for (const child of element.children) {
      findTextElements(child);
    }
  };
  
  // Start the traversal from the document body
  findTextElements(document.body);
  
  if (legalText.length > 0) {
    const combinedText = legalText.join('\n\n');
    if (combinedText.length > 500) {
      logDebug(`Extracted text using direct traversal: ${legalText.length} paragraphs, ${combinedText.length} chars`);
      return combinedText;
    }
  }
  
  // ======= Method 4: Aggressively extract all page text =======
  logDebug('Using aggressive extraction method');
  
  // Get all visible paragraphs with substantial text
  const textBlocks = [];
  const textElements = document.querySelectorAll('p, li, div, section, article, h1, h2, h3, h4, h5, h6');
  
  for (const el of textElements) {
    // Skip if not visible or in navigation/header/footer
    if (isElementHidden(el) || 
        el.closest('nav') || 
        el.closest('header') || 
        el.closest('footer') || 
        el.closest('aside') || 
        el.tagName === 'SCRIPT' || 
        el.tagName === 'STYLE' ||
        el.tagName === 'NOSCRIPT') {
      continue;
    }
    
    const text = el.innerText.trim();
    
    // Only consider elements with substantial text
    if (text.length > 30) {
      // Check if text contains legal language
      if (containsLegalTerminology(text)) {
        textBlocks.push(text);
      }
      // For longer text blocks, be less selective
      else if (text.length > 100) {
        textBlocks.push(text);
      }
    }
  }
  
  // Combine all text blocks
  if (textBlocks.length > 0) {
    const combinedText = textBlocks.join('\n\n');
    
    if (combinedText.length > 500) {
      logDebug(`Extracted combined text from multiple elements: ${textBlocks.length} blocks, ${combinedText.length} chars`);
      return combinedText;
    }
  }
  
  // ======= Method 5: Last resort - use the entire body content =======
  const bodyText = document.body.innerText.trim();
  
  if (bodyText.length > 500) {
    logDebug(`Using entire body text as last resort: ${bodyText.length} chars`);
    return bodyText;
  }
  
  logDebug('No substantial legal text found after trying all methods');
  return null; // No legal text found
}

// Special function specifically for Apple iTunes Terms page
function extractAppleItunesTerms() {
  logDebug('Using iTunes-specific extraction method for Apple /internet-services/itunes/*/terms.html');
  
  // Target the exact structure of the iTunes Terms page
  // First: Try to get the main content which usually contains all the terms text
  const mainContent = document.querySelector('main .section-content');
  if (mainContent && mainContent.innerText.trim().length > 500) {
    logDebug(`Found iTunes terms in main content: ${mainContent.innerText.trim().length} chars`);
    return mainContent.innerText.trim();
  }
  
  // Second: Try the specific terms and conditions section
  const termsContainer = document.querySelector('.main .terms-container') || 
                         document.querySelector('.main .terms') || 
                         document.querySelector('.section-content');
  
  if (termsContainer && termsContainer.innerText.trim().length > 500) {
    logDebug(`Found iTunes terms in terms container: ${termsContainer.innerText.trim().length} chars`);
    return termsContainer.innerText.trim();
  }
  
  // Third: Look for the specific structure with the primary column that contains the text
  const primaryColumn = document.querySelector('#main .column.primary') || 
                       document.querySelector('.primary.content');
  
  if (primaryColumn && primaryColumn.innerText.trim().length > 500) {
    logDebug(`Found iTunes terms in primary column: ${primaryColumn.innerText.trim().length} chars`);
    return primaryColumn.innerText.trim();
  }
  
  // Fourth: Try to get all sections at once
  const allSections = document.querySelectorAll('section');
  if (allSections.length > 0) {
    let combinedText = '';
    for (const section of allSections) {
      if (section.innerText.trim().length > 100) {
        combinedText += section.innerText.trim() + '\n\n';
      }
    }
    
    if (combinedText.length > 500) {
      logDebug(`Found iTunes terms in sections: ${combinedText.length} chars`);
      return combinedText;
    }
  }
  
  // Fifth: Look for paragraphs and lists which typically contain the terms
  const contentElements = document.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6');
  if (contentElements.length > 0) {
    let combinedText = '';
    for (const el of contentElements) {
      // Skip hidden elements and those in navigation/footer
      if (isElementHidden(el) || el.closest('nav') || el.closest('footer')) {
        continue;
      }
      
      const text = el.innerText.trim();
      if (text.length > 10) {
        combinedText += text + '\n\n';
      }
    }
    
    if (combinedText.length > 500) {
      logDebug(`Found iTunes terms in paragraphs and lists: ${combinedText.length} chars`);
      return combinedText;
    }
  }
  
  // Sixth: Extremely aggressive - get all divs with substantial text
  const divElements = document.querySelectorAll('div');
  if (divElements.length > 0) {
    // Sort by text length to find the div with the most content (likely the terms container)
    const textDivs = Array.from(divElements)
      .filter(div => !isElementHidden(div) && div.innerText.trim().length > 500)
      .sort((a, b) => b.innerText.trim().length - a.innerText.trim().length);
    
    if (textDivs.length > 0) {
      const largestTextDiv = textDivs[0];
      logDebug(`Found iTunes terms in largest text div: ${largestTextDiv.innerText.trim().length} chars`);
      return largestTextDiv.innerText.trim();
    }
  }
  
  // Seventh: Single selector extraction as a fallback using exact selectors for this page
  const specificSelectors = [
    'main .section-content', 
    '#main-content',
    '.main.legal',
    '.legal-container',
    '.section'
  ];
  
  for (const selector of specificSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element && element.innerText.trim().length > 500) {
        logDebug(`Found iTunes terms using selector "${selector}": ${element.innerText.trim().length} chars`);
        return element.innerText.trim();
      }
    } catch (e) {
      logDebug(`Error with selector ${selector}:`, e);
    }
  }
  
  // If all specific methods fail, fall back to the general Apple extraction method
  logDebug('iTunes-specific methods failed, falling back to general Apple method');
  return extractAppleLegalText();
}

// Special function to extract text from Apple's legal pages
function extractAppleLegalText() {
  logDebug('Using Apple-specific extraction method');

  // Special handling for Apple's terms pages which are notoriously difficult to scrape
  // First attempt: Apple Media Services Terms and Conditions
  const termsContainer = document.querySelector('.main.terms') || 
                         document.querySelector('.main.legal') ||
                         document.querySelector('.terms-container') ||
                         document.querySelector('#main section');
  
  if (termsContainer && termsContainer.innerText.trim().length > 500) {
    logDebug('Extracted text from Apple terms container');
    return termsContainer.innerText.trim();
  }
  
  // Second attempt: Look for sections with terms-specific attributes
  const termsSection = document.querySelector('[data-analytics-section="legal"]') ||
                      document.querySelector('[data-analytics-region="terms and conditions"]') ||
                      document.querySelector('[data-analytics-region="legal"]');
  
  if (termsSection && termsSection.innerText.trim().length > 500) {
    logDebug('Extracted text from Apple data-analytics section');
    return termsSection.innerText.trim();
  }
  
  // Third attempt: Apple typically structures their legal content in sections
  const legalSections = document.querySelectorAll('section');
  
  // If we find sections, extract from all of them
  if (legalSections.length > 0) {
    let combinedText = '';
    let foundSubstantialContent = false;
    
    for (const section of legalSections) {
      // Skip very small sections that are likely navigation
      if (section.innerText.trim().length > 100) {
        combinedText += section.innerText.trim() + '\n\n';
        foundSubstantialContent = true;
      }
    }
    
    if (foundSubstantialContent && combinedText.length > 500) {
      logDebug('Extracted text from Apple legal sections');
      return combinedText;
    }
  }
  
  // Fourth attempt: Try common Apple structures
  const mainContent = document.querySelector('main') || 
                     document.querySelector('.main') || 
                     document.querySelector('#main');
  
  if (mainContent && mainContent.innerText.trim().length > 500) {
    logDebug('Extracted text from Apple main content');
    return mainContent.innerText.trim();
  }
  
  // Fifth attempt: Try getting ordered lists which are common in Apple's terms
  const legalLists = document.querySelectorAll('ol, ul');
  if (legalLists.length > 0) {
    let listText = '';
    let foundSubstantialLists = false;
    
    for (const list of legalLists) {
      if (list.innerText.trim().length > 100) {
        listText += list.innerText.trim() + '\n\n';
        foundSubstantialLists = true;
      }
    }
    
    if (foundSubstantialLists && listText.length > 500) {
      logDebug('Extracted text from Apple legal lists');
      return listText;
    }
  }
  
  // Sixth attempt: Directly find all text nodes with legal content
  // This is a fallback approach that should work even when other methods fail
  logDebug('Using direct text node extraction for Apple page');
  
  const legalText = [];
  const paragraphs = [];
  
  // Look for all text-containing elements
  const findTextElements = (element) => {
    // Skip hidden elements and navigation/scripts
    if (isElementHidden(element) || 
        element.tagName === 'SCRIPT' || 
        element.tagName === 'STYLE' ||
        element.tagName === 'NOSCRIPT' ||
        element.closest('nav') || 
        element.closest('footer') ||
        element.closest('header')) {
      return;
    }
    
    // If this element has direct text (not just whitespace),
    // and doesn't have too many children, it's likely a text block
    const text = element.innerText.trim();
    if (text.length > 50 && element.children.length < 5) {
      if (!paragraphs.includes(text)) {  // Avoid duplicates
        paragraphs.push(text);
        legalText.push(text);
      }
    }
    
    // Recursively process children
    for (const child of element.children) {
      findTextElements(child);
    }
  };
  
  // Start the traversal from the document body
  findTextElements(document.body);
  
  if (legalText.length > 0) {
    const combinedText = legalText.join('\n\n');
    if (combinedText.length > 500) {
      logDebug(`Extracted text using direct traversal: ${legalText.length} paragraphs, ${combinedText.length} chars`);
      return combinedText;
    }
  }
  
  // Seventh attempt: Extract all substantial text blocks
  logDebug('Using aggressive extraction for Apple page');
  let allText = '';
  const textElements = document.querySelectorAll('p, li, div, section, article, h1, h2, h3, h4, h5, h6');
  
  for (const el of textElements) {
    // Skip hidden elements and navigation
    if (isElementHidden(el) || 
        el.closest('nav') || 
        el.closest('footer') ||
        el.tagName === 'SCRIPT' || 
        el.tagName === 'STYLE') {
      continue;
    }
    
    const text = el.innerText.trim();
    if (text.length > 30) {
      allText += text + '\n\n';
    }
  }
  
  if (allText.length > 500) {
    logDebug(`Extracted all visible text blocks from Apple page: ${allText.length} chars`);
    return allText;
  }
  
  // Absolute last resort: use the entire body text
  const bodyText = document.body.innerText.trim();
  
  if (bodyText.length > 500) {
    logDebug(`Using entire body text from Apple page: ${bodyText.length} chars`);
    return bodyText;
  }
  
  logDebug('All extraction methods failed for Apple page');
  return null;
}

// Helper function to check if an element is hidden
function isElementHidden(element) {
  const style = window.getComputedStyle(element);
  return style.display === 'none' || 
         style.visibility === 'hidden' || 
         style.opacity === '0' ||
         element.offsetWidth === 0 || 
         element.offsetHeight === 0;
}

// Helper function to check if text contains legal terminology
function containsLegalTerminology(text) {
  if (!text) return false;
  
  const legalTerms = [
    // Basic legal terms
    'terms', 'conditions', 'privacy', 'legal', 'agreement', 'license',
    'copyright', 'intellectual property', 'disclaimer', 'warranty',
    'liability', 'indemnification', 'governing law', 'jurisdiction',
    'arbitration', 'dispute', 'termination', 'refund', 'prohibited',
    'clause', 'policy', 'cookies', 'gdpr', 'ccpa', 'personal data',
    'consent', 'opt-out', 'third party', 'service provider', 'processor',
    
    // Additional legal concepts
    'rights', 'obligations', 'confidential', 'compliance', 'violation',
    'restriction', 'limitation', 'waiver', 'severability', 'binding',
    'modification', 'cancellation', 'termination', 'proprietary',
    'ownership', 'assignment', 'transfer', 'remedies', 'damages',
    'notification', 'disclosure', 'representation', 'warranties',
    
    // Common legal phrases
    'by accessing', 'by using', 'you agree to', 'you consent to',
    'govern your use', 'at its sole discretion', 'accept these terms',
    'lawful purpose', 'subject to change', 'irrevocable', 'perpetual',
    'worldwide', 'non-exclusive', 'royalty-free', 'transferable',
    'applicable laws', 'you represent that', 'you warrant that',
    
    // Privacy-specific terms
    'data subject', 'data protection', 'information we collect',
    'how we use', 'tracking technologies', 'third-party services',
    'information sharing', 'data retention', 'data security',
    'your choices', 'opt-out rights', 'access rights'
  ];
  
  const textLower = text.toLowerCase();
  
  // Check for individual terms
  if (legalTerms.some(term => textLower.includes(term))) {
    return true;
  }
  
  // Check for structured legal patterns
  const legalPatterns = [
    /section\s+\d+(\.\d+)?/i,          // Section 1.2
    /article\s+\d+(\.\d+)?/i,           // Article 2.3
    /^\d+\.\s+[A-Z]/m,                  // 1. CAPITALIZED HEADER
    /^\d+\.\d+\.\s+/m,                  // 1.1. Subsection
    /\([a-z]\)\s+/,                      // (a) List items
    /last\s+updated\s+on/i,             // Last updated on
    /last\s+modified\s+on/i,            // Last modified on
    /effective\s+date/i,                // Effective date
    /©\s*\d{4}/                         // Copyright symbol with year
  ];
  
  // Return true if any legal pattern is found
  return legalPatterns.some(pattern => pattern.test(textLower));
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.type);
  
  if (request.type === 'PING') {
    // Simple ping to check if content script is loaded
    sendResponse({ status: 'OK' });
    return true; // Keep the message channel open for async response
  }
  
  if (request.type === 'EXTRACT_TEXT') {
    try {
      // Set manual activation flag to force extraction even if not detected as legal
      window.manuallyActivated = true;
      logDebug('Manual activation set by EXTRACT_TEXT request');
      
      const text = extractLegalText();
      
      // Log the extracted text length to help with debugging
      if (text) {
        logDebug(`Successfully extracted text (${text.length} characters)`);
      } else {
        logDebug('Failed to extract any text');
      }
      
      sendResponse({ text });
    } catch (error) {
      console.error('Error extracting text:', error);
      logDebug('Error during text extraction:', error);
      sendResponse({ error: error.message });
    }
    return true; // Keep the message channel open for async response
  }
  
  return true; // Keep the message channel open for async response
});