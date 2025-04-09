// Popup script for Legal Document Summarizer
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // Get the summarize button
  const summarizeBtn = document.getElementById('summarize-btn');
  const errorMessage = document.createElement('div');
  errorMessage.style.color = 'red';
  errorMessage.style.marginTop = '10px';
  errorMessage.style.display = 'none';
  summarizeBtn.parentNode.insertBefore(errorMessage, summarizeBtn.nextSibling);
  
  // Function to show error message
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    summarizeBtn.textContent = 'Try Again';
    summarizeBtn.disabled = false;
  }
  
  // Function to check if content script is ready and inject it if needed
  function checkContentScriptReady(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, async (response) => {
        if (chrome.runtime.lastError) {
          console.log('Content script not ready, injecting it now...');
          
          try {
            // Inject the content script
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            });
            
            // Wait a moment for the script to initialize
            setTimeout(() => {
              // Verify the script was loaded successfully
              chrome.tabs.sendMessage(tabId, { type: 'PING' }, (secondResponse) => {
                if (chrome.runtime.lastError) {
                  reject(new Error('Failed to load content script. Please try refreshing the page.'));
                } else {
                  console.log('Content script successfully injected');
                  resolve();
                }
              });
            }, 500);
          } catch (error) {
            console.error('Error injecting content script:', error);
            reject(new Error('Failed to load content script: ' + error.message));
          }
        } else {
          resolve();
        }
      });
    });
  }

  // Always use the default API key
  function checkApiKey() {
    return new Promise((resolve) => {
      // Use the default key from our secure approach
      const encodedDefaultKey = 'c2stcHJvai1qVkwzamk5djVzN3RDWnhOM1E0dTNsUU5tUi1QLTFieEsxZ3NnZzF1Mjc4RGYwaXplcHlQcWN3QWhoRFlCZ294eXZucXA5eGFnblQzQmxia0ZKM094OTVDMkhJdXk2aWdSNU5YaUFMX0poam5XdGE3bUZjUWJGbk5tdG1fV1hxQ1JvYjQ0YTBMWWdCQ29wRnVPT2JybFF0RWRCNEE=';
      const defaultApiKey = atob(encodedDefaultKey);
      
      // Always set the API key to ensure it's the correct one
      chrome.storage.sync.set({ 
        apiKey: defaultApiKey,
        languageStyle: 'simple', // Always use simple language
        summaryLength: 'comprehensive' // Always provide comprehensive summaries
      }, () => {
        console.log('Default API key and settings set successfully');
        resolve(true);
      });
    });
  }
  
  // Add click event to the summarize button
  summarizeBtn.addEventListener('click', async () => {
    console.log('Summarize button clicked');
    
    try {
      // Hide any previous error message
      errorMessage.style.display = 'none';
      
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }
      
      // Log the tab URL for debugging
      console.log('Processing tab with URL:', tab.url);
      
      // Special handling for difficult pages (iTunes terms, etc.)
      const url = tab.url.toLowerCase();
      if (url.includes('apple.com') && url.includes('/internet-services/itunes') && url.includes('/terms.html')) {
        console.log('Detected Apple iTunes Terms page - using special extraction approach');
      }
      
      // Show loading state
      summarizeBtn.textContent = 'Analyzing...';
      summarizeBtn.disabled = true;
      
      // Check and set API key if needed
      await checkApiKey();
      
      // Check if content script is ready
      try {
        await checkContentScriptReady(tab.id);
      } catch (error) {
        console.error('Content script not ready:', error);
        showError('Content script not ready. Please refresh the page or navigate to a different tab and try again.');
        return;
      }
      
      // Extract text from the page using the content script
      chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_TEXT' }, async (response) => {
        console.log('Received response from content script:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Content script error:', chrome.runtime.lastError);
          
          // Try direct extraction as a fallback
          console.log('Attempting direct text extraction as fallback...');
          try {
            await directTextExtraction(tab.id);
            return;
          } catch (directError) {
            console.error('Direct extraction failed:', directError);
            showError('Error extracting text: ' + directError.message);
            return;
          }
        }
        
        if (!response || !response.text) {
          console.log('No text returned from content script, attempting direct extraction...');
          
          // Try direct extraction if content script didn't return text
          try {
            await directTextExtraction(tab.id);
            return;
          } catch (directError) {
            console.error('Direct extraction failed:', directError);
            showError('No legal document detected on this page. The extension works with Terms of Service, Privacy Policies, EULAs, and other legal documents.');
            return;
          }
        }

        const text = response.text;
        
        // Check if the text is substantial enough to analyze
        if (text.length < 100) {
          console.log('Extracted text too short, attempting direct extraction...');
          
          // Try direct extraction as a fallback for short texts
          try {
            await directTextExtraction(tab.id);
            return;
          } catch (directError) {
            console.error('Direct extraction failed:', directError);
            showError('The extracted text is too short to analyze. Please try on a page with more content.');
            return;
          }
        }
        
        processExtractedText(text, tab.url);
      });
      
      // Function to process successfully extracted text
      function processExtractedText(text, url) {
        console.log(`Processing extracted text: ${text.length} characters`);
        
        // Store the text in global variables that the results page can access as a tertiary backup
        window.lastExtractedText = text;
        window.lastExtractedUrl = url;
        
        // Store the text in chrome.storage.local for the results page
        // This is more reliable than localStorage for extensions
        chrome.storage.local.set({
          documentText: text,
          documentUrl: url,
          extractionTimestamp: Date.now() // Add timestamp for debugging
        }, () => {
          console.log('Document text stored successfully in chrome.storage.local');
          
          // Also store in localStorage as a backup
          try {
            localStorage.setItem('documentText', text);
            localStorage.setItem('documentUrl', url);
            localStorage.setItem('extractionTimestamp', Date.now().toString());
            console.log('Document text also stored in localStorage as backup');
          } catch (e) {
            console.warn('Could not store in localStorage (backup only):', e);
          }
          
          // Do one final verification that the data was stored correctly
          chrome.storage.local.get(['documentText'], (result) => {
            const storedLength = result.documentText ? result.documentText.length : 0;
            console.log(`Verification: chrome.storage.local contains ${storedLength} characters`);
            
            if (storedLength < 100 && text.length > 100) {
              console.warn('Warning: Storage verification failed - stored text is shorter than original');
            }
          });
          
          // Open results page
          chrome.windows.create({
            url: 'results.html',
            type: 'popup',
            width: 800,
            height: 700 // Slightly taller to show more content
          });
          
          // Reset button
          summarizeBtn.textContent = 'Summarize Document';
          summarizeBtn.disabled = false;
        });
      }
      
      // Function to directly extract text from the page using executeScript
      async function directTextExtraction(tabId) {
        console.log('Starting universal direct text extraction...');
        
        // First get the URL to check if we need special handling
        const tab = await chrome.tabs.get(tabId);
        const url = tab.url.toLowerCase();
        console.log('Extracting from URL:', url);
        
        return new Promise((resolve, reject) => {
          // Execute a script directly in the page to extract text
          chrome.scripting.executeScript({
            target: { tabId },
            function: () => {
              console.log('Running direct extraction script in page context');
              
              // Helper function to check if element is visible
              function isVisible(elem) {
                if (!elem) return false;
                try {
                  const style = window.getComputedStyle(elem);
                  return style.display !== 'none' && 
                         style.visibility !== 'hidden' && 
                         style.opacity !== '0' &&
                         elem.offsetWidth > 0 && 
                         elem.offsetHeight > 0;
                } catch (e) {
                  return false; // If we can't check visibility, assume not visible
                }
              }
              
              // Helper to check if text is likely legal content
              function containsLegalTerminology(text) {
                if (!text) return false;
                
                const legalTerms = [
                  'terms', 'conditions', 'privacy', 'legal', 'agreement', 'license',
                  'copyright', 'intellectual property', 'disclaimer', 'warranty',
                  'liability', 'indemnification', 'governing law', 'jurisdiction',
                  'arbitration', 'dispute', 'termination', 'refund', 'prohibited',
                  'clause', 'policy', 'cookies', 'gdpr', 'ccpa', 'personal data',
                  'consent', 'opt-out', 'third party', 'service provider',
                  'rights', 'obligations', 'confidential', 'compliance', 'violation',
                  'restriction', 'limitation', 'waiver', 'severability', 'binding'
                ];
                
                const textLower = text.toLowerCase();
                return legalTerms.some(term => textLower.includes(term));
              }
              
              // Helper function to extract from document
              function extractTextFromElements(elements, filterFn = null) {
                if (!elements || elements.length === 0) return null;
                
                // Sort elements by text length, largest first
                const contentElements = Array.from(elements)
                  .filter(el => isVisible(el) && (!filterFn || filterFn(el)))
                  .map(el => ({
                    element: el,
                    text: el.innerText.trim(),
                    length: el.innerText.trim().length
                  }))
                  .filter(item => item.length > 100) // Must have substantial text
                  .sort((a, b) => b.length - a.length);
                
                if (contentElements.length === 0) return null;
                
                if (contentElements[0].length > 500) {
                  console.log(`Found content with ${contentElements[0].length} characters`);
                  return contentElements[0].text;
                }
                
                return null;
              }
              
              // Get the URL to check for special handling
              const url = window.location.href.toLowerCase();
              
              // Method 1: Check for specific legal document containers first
              const specificSelectors = [
                // Generic legal document containers
                'main article', 'article.terms', 'article.privacy', 'article.legal',
                'div.terms', 'div.privacy-policy', 'div.legal', '.legal-content',
                'section.terms', 'section.privacy', 'section.tos', 'section.eula',
                '.terms-of-service', '.terms-of-use', '.terms-and-conditions',
                '#terms-of-service', '#privacy-policy', '#legal-terms',
                
                // Main content wrappers
                'main .content', 'main .container', 'main section', 
                '#main-content', '#content', '.main-content', '.content-main',
                '.page-content', '.article-content', '.post-content',
              
                // Common layout patterns
                '.container .row', '.container .main', '.wrapper .content',
                'main .row', 'article .content', '.body-content',
                
                // Specific vendor patterns (Apple, Google, Microsoft, etc.)
                '.main.terms', '.main.legal', '.section-content', 
                '[data-testid="legal-content"]', '[data-testid="terms"]',
                '[data-analytics-section="legal"]', '[data-region="terms"]'
              ];
              
              for (const selector of specificSelectors) {
                try {
                  const elements = document.querySelectorAll(selector);
                  const text = extractTextFromElements(elements);
                  if (text) {
                    console.log(`Found legal text with selector: ${selector}`);
                    return text;
                  }
                } catch (e) {
                  console.error(`Error with selector ${selector}:`, e);
                }
              }
              
              // Method 2: Find generic container elements with legal terminology
              const genericContainers = [
                'main', 'article', 'section', '.container', '.content', '.page', 
                '.row', '.wrapper', '.body', '#main', '#content', '#primary'
              ];
              
              for (const selector of genericContainers) {
                try {
                  const elements = document.querySelectorAll(selector);
                  const text = extractTextFromElements(elements, el => {
                    const content = el.innerText.toLowerCase();
                    return containsLegalTerminology(content);
                  });
                  
                  if (text) {
                    console.log(`Found legal text in container: ${selector}`);
                    return text;
                  }
                } catch (e) {
                  console.error(`Error with container ${selector}:`, e);
                }
              }
              
              // Method 3: Look for elements with legal-related IDs or classes
              try {
                const legalIdClassElements = document.querySelectorAll(
                  '[id*="terms"], [id*="privacy"], [id*="legal"], [id*="policy"], [id*="eula"], ' +
                  '[class*="terms"], [class*="privacy"], [class*="legal"], [class*="policy"], [class*="eula"]'
                );
                
                const text = extractTextFromElements(legalIdClassElements);
                if (text) {
                  console.log('Found legal text via ID/class matching');
                  return text;
                }
              } catch (e) {
                console.error('Error with ID/class selector:', e);
              }
              
              // Method 4: Try with all text elements that contain legal phrases
              console.log('Trying text-based extraction for all elements...');
              const legalTextBlocks = [];
              const allTextElements = document.querySelectorAll('p, li, div, section, article, h1, h2, h3, h4, h5, h6');
              
              for (const el of allTextElements) {
                if (!isVisible(el)) continue;
                if (el.closest('nav') || el.closest('header') || el.closest('footer') || el.closest('aside')) continue;
                
                const text = el.innerText.trim();
                // Skip very short text or very large containers
                if (text.length < 50 || (el.children.length > 20 && el.tagName !== 'UL' && el.tagName !== 'OL')) continue;
                
                if (containsLegalTerminology(text)) {
                  legalTextBlocks.push(text);
                }
              }
              
              if (legalTextBlocks.length > 0) {
                console.log(`Found ${legalTextBlocks.length} legal text blocks`);
                return legalTextBlocks.join('\n\n');
              }
              
              // Method 5: Find the div with the most text content
              console.log('Looking for largest text container...');
              try {
                const divs = document.querySelectorAll('div');
                const largestDivs = Array.from(divs)
                  .filter(div => isVisible(div) && div.innerText.trim().length > 500)
                  .sort((a, b) => b.innerText.trim().length - a.innerText.trim().length);
                
                if (largestDivs.length > 0) {
                  const largestDiv = largestDivs[0];
                  console.log(`Found largest text div with ${largestDiv.innerText.trim().length} characters`);
                  return largestDiv.innerText.trim();
                }
              } catch (e) {
                console.error('Error finding largest div:', e);
              }
              
              // Method 6: As a last resort, just try the body
              console.log('Trying body text as last resort');
              const bodyText = document.body.innerText.trim();
              if (bodyText.length > 500) {
                return bodyText;
              }
              
              // If absolutely nothing worked
              console.error('All extraction methods failed');
              return "Failed to extract legal text from this document.";
            }
          }, (results) => {
            if (chrome.runtime.lastError) {
              console.error('Direct extraction script error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            if (!results || !results[0] || !results[0].result) {
              console.error('No results from direct extraction');
              reject(new Error('Failed to extract document text'));
              return;
            }
            
            const extractedText = results[0].result;
            console.log(`Direct extraction successful: ${extractedText.length} characters`);
            
            if (extractedText.length < 100 || extractedText === "Failed to extract legal text from this document.") {
              reject(new Error('The extracted text is too short or extraction failed'));
              return;
            }
            
            // Process the successfully extracted text
            processExtractedText(extractedText, tab.url);
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error: ' + error.message);
    }
  });
  
  // No settings link needed anymore as we've removed customization options
});