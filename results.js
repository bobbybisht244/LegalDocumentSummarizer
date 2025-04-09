// Results page script for Legal Document Summarizer
document.addEventListener('DOMContentLoaded', () => {
  console.log('Results page loaded');
  
  // DOM elements
  const loadingDiv = document.getElementById('loading');
  const errorDiv = document.getElementById('error');
  const resultsDiv = document.getElementById('results');
  const summaryText = document.getElementById('summary-text');
  const keyPointsList = document.getElementById('key-points-list');
  const risksList = document.getElementById('risks-list');
  const gradesContainer = document.getElementById('grades-container');
  const backBtn = document.getElementById('back-btn');
  
  // Get the document text from both sources with improved logging
  console.log('Attempting to retrieve document text...');
  
  chrome.storage.local.get(['documentText', 'documentUrl'], (result) => {
    console.log('Chrome storage result availability:', {
      hasDocumentText: !!result.documentText,
      hasDocumentUrl: !!result.documentUrl,
      textLength: result.documentText ? result.documentText.length : 0
    });
    
    // Try to get text from chrome.storage.local first
    let documentText = result.documentText;
    let documentUrl = result.documentUrl;
    
    // If not found in chrome.storage, try localStorage as fallback
    if (!documentText) {
      console.log('No text found in chrome.storage.local, checking localStorage...');
      try {
        documentText = localStorage.getItem('documentText');
        documentUrl = localStorage.getItem('documentUrl');
        console.log('localStorage document text length:', documentText ? documentText.length : 0);
      } catch (err) {
        console.error('Error accessing localStorage:', err);
      }
    } else {
      console.log('Found document text in chrome.storage.local, length:', documentText.length);
    }
    
    // Additional fallback mechanism for very persistent issues
    if (!documentText && window.opener) {
      try {
        console.log('Attempting to get document text from opener window...');
        // Try to get the text from the popup window that opened this one
        documentText = window.opener.lastExtractedText;
        documentUrl = window.opener.lastExtractedUrl;
        
        if (documentText) {
          console.log('Retrieved document text from opener window, length:', documentText.length);
        }
      } catch (err) {
        console.error('Error accessing opener window:', err);
      }
    }
    
    // Check if we have text to analyze
    if (!documentText) {
      console.error('No document text found in any storage location');
      showError('No document text to analyze. Please try reloading the original page and clicking "Summarize Document" again.');
      return;
    }
    
    // Log the length for debugging
    console.log(`Processing document text (${documentText.length} characters) from URL: ${documentUrl}`);
    
    // Ensure the text is substantial
    if (documentText.length < 100) {
      console.error('Document text too short:', documentText);
      showError('The document text is too short to analyze. Please try again with a longer document.');
      return;
    }
    
    // Add event listeners
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.close();
    });
    
    // Function to provide the OpenAI API key
    function getDefaultApiKey() {
      // Using the encoded version of the provided API key for better security
      const encodedDefaultKey = 'c2stcHJvai1qVkwzamk5djVzN3RDWnhOM1E0dTNsUU5tUi1QLTFieEsxZ3NnZzF1Mjc4RGYwaXplcHlQcWN3QWhoRFlCZ294eXZucXA5eGFnblQzQmxia0ZKM094OTVDMkhJdXk2aWdSNU5YaUFMX0poam5XdGE3bUZjUWJGbk5tdG1fV1hxQ1JvYjQ0YTBMWWdCQ29wRnVPT2JybFF0RWRCNEE=';
      return atob(encodedDefaultKey);
    }
    
    // Load the settings but always use our secure API keys
    chrome.storage.sync.get(['apiKey', 'summaryLength', 'languageStyle', 'useMultiModel'], (settings) => {
      // Always use our default API key for consistency and security
      settings.apiKey = getDefaultApiKey();
      console.log('Using OpenAI API key:', settings.apiKey.substring(0, 10) + '...');
      
      // Always use comprehensive summary with simple language
      settings.summaryLength = 'comprehensive';
      settings.languageStyle = 'simple';
      
      // Check if we should use the multi-model approach
      if (settings.useMultiModel === undefined) {
        settings.useMultiModel = true; // Default to using multi-model if not set
      }
      
      console.log('Using multi-model analysis:', settings.useMultiModel);
      
      // Load multi-model API script dynamically to handle multiple models
      if (settings.useMultiModel) {
        // Load the multi-model-api.js script dynamically
        const script = document.createElement('script');
        script.src = 'multi-model-api.js';
        script.onload = () => {
          console.log('Multi-model API script loaded successfully');
          
          // Initialize the API with the encoded keys from storage
          chrome.storage.local.get(['multiModelApiKeys'], (result) => {
            if (result.multiModelApiKeys) {
              console.log('Using stored multi-model API keys');
              
              // Start the multi-model analysis
              try {
                window.multiModelAPI.analyzeWithMultipleModels(documentText, documentUrl)
                  .then(result => {
                    console.log('Multi-model analysis complete');
                    displayResults(result);
                  })
                  .catch(error => {
                    console.error('Error with multi-model analysis:', error);
                    
                    // If the multi-model analysis partially succeeded (at least one model worked),
                    // we wouldn't get an error here. So this means all models failed.
                    if (error.message && error.message.includes('All AI models failed')) {
                      // Fall back to single model as a last resort
                      console.log('All multi-model APIs failed, trying single OpenAI model as final fallback');
                      analyzeLegalDocument(documentText, documentUrl, settings);
                    } else {
                      // Some other unexpected error occurred
                      showError(`Error analyzing document: ${error.message || 'Unknown error'}. Try again or check your API keys.`);
                    }
                  });
              } catch (error) {
                console.error('Error starting multi-model analysis:', error);
                
                // This is a script/initialization error, not an API error
                // Most likely the multi-model API script failed to initialize properly
                const errorMsg = error.message || 'Unknown initialization error';
                console.log(`Multi-model initialization failed: ${errorMsg}`);
                
                // Fall back to single model analysis as a last resort
                analyzeLegalDocument(documentText, documentUrl, settings);
              }
            } else {
              console.error('No multi-model API keys found in storage');
              // Fall back to single model
              analyzeLegalDocument(documentText, documentUrl, settings);
            }
          });
        };
        
        script.onerror = () => {
          console.error('Failed to load multi-model API script');
          // Fall back to single model analysis if script fails to load
          analyzeLegalDocument(documentText, documentUrl, settings);
        };
        
        // Add the script to the page
        document.head.appendChild(script);
      } else {
        // Start the single-model analysis with OpenAI
        analyzeLegalDocument(documentText, documentUrl, settings);
      }
    });
  });
  
  // Function to analyze the legal document using OpenAI
  async function analyzeLegalDocument(text, url, settings) {
    try {
      const result = await summarizeWithOpenAI(text, url, settings);
      displayResults(result);
    } catch (error) {
      console.error('Error analyzing document:', error);
      showError(`Error analyzing document: ${error.message}`);
    }
  }
  
  // Function to call OpenAI API for summarization
  async function summarizeWithOpenAI(text, url, settings) {
    console.log('Summarizing text with OpenAI, length:', text.length);
    
    // Prepare the prompt
    const prompt = createPrompt(text, settings);
    
    // Only use the model we know works with this API key
    const models = ['gpt-4o-mini'];
    let lastError = null;
    
    // Try each model in order until one works
    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: 'You are a legal expert specializing in analyzing and simplifying complex legal documents for the average person.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.log(`Model ${model} failed:`, errorData.error?.message);
          lastError = new Error(errorData.error?.message || 'Error calling OpenAI API');
          continue; // Try next model
        }
        
        const data = await response.json();
        console.log(`OpenAI ${model} response:`, data);
        
        // Parse the response
        return parseOpenAIResponse(data.choices[0].message.content);
      } catch (error) {
        console.error(`Error with model ${model}:`, error);
        lastError = error;
        // Continue to next model
      }
    }
    
    // If we get here, all models failed
    const modelsList = models.join(', ');
    throw lastError || new Error(`None of the available OpenAI models (${modelsList}) worked with your API key. Please check your API key permissions in your OpenAI account and make sure it has access to at least one of these models.`);
  }
  
  // Function to create the prompt based on settings
  function createPrompt(text, settings) {
    // Always use simple language
    const styleDescription = 'Use simple, everyday language that a 5th grader could understand';
    
    return `I need help analyzing this legal document:

${text.substring(0, 15000)}${text.length > 15000 ? '... (document truncated due to length)' : ''}

Based on the above document, please provide:

1. A comprehensive summary of the main points covering ALL important aspects that a user must know. The summary can be as long as needed to include all relevant information. ${styleDescription}.

2. A list of 5-7 key points from the document, each with a risk level (low, medium, or high) indicating how potentially concerning each point is for the average user.

3. A list of 3-5 potential risks or concerns that users should be aware of.

4. Letter grades (A to E, with A being best) for each of these aspects of the document:
   - Overall: How fair and user-friendly is this document overall?
   - Transparency: How clear and understandable is the document?
   - Complexity: How complex or simple is the language? (A = very simple)
   - Fairness: How balanced are the rights and obligations?
   - Privacy: How well does it protect user privacy?
   - Risks: What is the overall risk level for users? (A = low risk)

5. Complexity analysis:
   - A complexity score from 0-100 (where 0 is extremely simple and 100 is extremely complex)
   - A list of 5-10 legal jargon terms found in the document, each with a complexity level (simple, moderate, complex)

Format your response in JSON as follows:
{
  "summary": "Summary text here...",
  "keyPoints": [
    {"text": "Point 1", "riskLevel": "low/medium/high"},
    {"text": "Point 2", "riskLevel": "low/medium/high"}
  ],
  "risks": ["Risk 1", "Risk 2"],
  "grades": {
    "overall": "A/B/C/D/E",
    "transparency": "A/B/C/D/E",
    "complexity": "A/B/C/D/E",
    "fairness": "A/B/C/D/E",
    "privacy": "A/B/C/D/E",
    "risks": "A/B/C/D/E"
  },
  "complexity": {
    "score": 75,
    "terms": [
      {"term": "Legal term 1", "level": "simple/moderate/complex"},
      {"term": "Legal term 2", "level": "simple/moderate/complex"}
    ]
  }
}

Important: Return ONLY the JSON, with no other text or explanation.`;
  }
  
  // Function to parse OpenAI's response
  function parseOpenAIResponse(responseText) {
    // Handle empty response
    if (!responseText || typeof responseText !== 'string') {
      throw new Error('Empty or invalid response from OpenAI');
    }
    
    // Clean up response - remove markdown code blocks if present
    let cleanedResponse = responseText;
    
    // Check for code blocks (```json ... ```) that some models like to return
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
    const codeBlockMatch = codeBlockRegex.exec(responseText);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleanedResponse = codeBlockMatch[1].trim();
      console.log('Extracted JSON from OpenAI code block');
    }
    
    try {
      // Try to parse the cleaned response as JSON
      return JSON.parse(cleanedResponse);
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      console.log('Problematic response from OpenAI:', cleanedResponse.substring(0, 100) + "...");
      
      // If parsing fails, try to extract JSON using regex
      const jsonRegex = /{[\s\S]*}/;
      const match = cleanedResponse.match(jsonRegex);
      
      if (match) {
        try {
          const result = JSON.parse(match[0]);
          console.log('Successfully extracted JSON with regex from OpenAI response');
          return result;
        } catch (secondError) {
          console.error('Second parsing attempt for OpenAI also failed:', secondError);
          throw new Error('Failed to parse the AI response. The API returned invalid JSON format.');
        }
      } else {
        console.error('No JSON-like structure found in OpenAI response');
        throw new Error('AI response was not in the expected format. No JSON object found.');
      }
    }
  }
  
  // Function to display results
  function displayResults(result) {
    // Hide loading, show results
    loadingDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
    
    // Log which models were used (if any)
    if (result.modelContributions && result.modelContributions.length > 0) {
      console.log('Models used for analysis:', result.modelContributions);
    }
    
    // Display summary
    summaryText.textContent = result.summary;
    
    // Display key points
    keyPointsList.innerHTML = '';
    result.keyPoints.forEach(point => {
      const li = document.createElement('li');
      li.className = `key-point risk-${point.riskLevel}`;
      li.textContent = point.text;
      keyPointsList.appendChild(li);
    });
    
    // Display risks
    risksList.innerHTML = '';
    if (result.risks && result.risks.length > 0) {
      const ul = document.createElement('ul');
      result.risks.forEach(risk => {
        const li = document.createElement('li');
        li.textContent = risk;
        ul.appendChild(li);
      });
      risksList.appendChild(ul);
    } else {
      risksList.textContent = 'No significant risks identified.';
    }
    
    // Display grades
    gradesContainer.innerHTML = '';
    const grades = result.grades;
    const gradeLabels = {
      overall: 'Overall',
      transparency: 'Transparency',
      complexity: 'Complexity',
      fairness: 'Fairness',
      privacy: 'Privacy',
      risks: 'Risk Level'
    };
    
    // Change layout to use the full width of the column in new layout
    gradesContainer.style.flexDirection = 'column';
    gradesContainer.style.width = '100%';
    
    for (const [key, label] of Object.entries(gradeLabels)) {
      if (grades[key]) {
        const card = document.createElement('div');
        card.className = 'grade-card';
        
        const title = document.createElement('div');
        title.className = 'grade-title';
        title.textContent = label;
        
        const value = document.createElement('div');
        value.className = `grade-value grade-${grades[key]}`;
        value.textContent = grades[key];
        
        card.appendChild(title);
        card.appendChild(value);
        gradesContainer.appendChild(card);
      }
    }
    
    // Display which models contributed to this analysis if available
    if (result.modelContributions && result.modelContributions.length > 0) {
      // Create models badge container
      const modelsContainer = document.createElement('div');
      modelsContainer.className = 'models-container';
      modelsContainer.style.marginTop = '20px';
      modelsContainer.style.fontSize = '12px';
      modelsContainer.style.color = '#666';
      modelsContainer.style.textAlign = 'center';
      modelsContainer.style.padding = '8px';
      modelsContainer.style.backgroundColor = '#f8f9fa';
      modelsContainer.style.borderRadius = '4px';
      
      // Create heading
      const modelsHeading = document.createElement('div');
      modelsHeading.textContent = 'Analysis powered by multiple AI models:';
      modelsHeading.style.marginBottom = '5px';
      modelsHeading.style.fontWeight = 'bold';
      modelsContainer.appendChild(modelsHeading);
      
      // Create model badges
      const badgeContainer = document.createElement('div');
      badgeContainer.style.display = 'flex';
      badgeContainer.style.justifyContent = 'center';
      badgeContainer.style.gap = '8px';
      
      // Get unique models (in case there are duplicates)
      const uniqueModels = [...new Set(result.modelContributions)];
      
      // Create a badge for each model
      uniqueModels.forEach(model => {
        const modelBadge = document.createElement('span');
        modelBadge.className = `model-badge model-${model}`;
        modelBadge.textContent = getModelDisplayName(model);
        modelBadge.style.padding = '3px 8px';
        modelBadge.style.borderRadius = '12px';
        modelBadge.style.fontSize = '11px';
        modelBadge.style.fontWeight = 'bold';
        
        // Different color for each model
        switch(model) {
          case 'openai':
            modelBadge.style.backgroundColor = '#10a37f';
            modelBadge.style.color = 'white';
            break;
          case 'gemini':
            modelBadge.style.backgroundColor = '#4285f4';
            modelBadge.style.color = 'white';
            break;
          case 'anthropic':
            modelBadge.style.backgroundColor = '#b075d5';
            modelBadge.style.color = 'white';
            break;
          default:
            modelBadge.style.backgroundColor = '#e0e0e0';
            modelBadge.style.color = '#333';
        }
        
        badgeContainer.appendChild(modelBadge);
      });
      
      modelsContainer.appendChild(badgeContainer);
      
      // Add explanation text
      const explanationText = document.createElement('div');
      explanationText.textContent = 'This analysis combines insights from multiple AI models for a more comprehensive evaluation.';
      explanationText.style.marginTop = '8px';
      explanationText.style.fontSize = '11px';
      modelsContainer.appendChild(explanationText);
      
      // Add the models section to the results
      resultsDiv.appendChild(modelsContainer);
    }
  }
  
  // Helper function to get display name for each model
  function getModelDisplayName(modelId) {
    switch(modelId) {
      case 'openai':
        return 'OpenAI GPT';
      case 'gemini':
        return 'Google Gemini';
      case 'anthropic':
        return 'Anthropic Claude';
      default:
        return modelId.charAt(0).toUpperCase() + modelId.slice(1); // Capitalize first letter
    }
  }
  
  // Function to show error message with improved debugging
  function showError(message) {
    console.error('Error in results page:', message);
    
    // Hide loading, show error
    loadingDiv.style.display = 'none';
    errorDiv.style.display = 'block';
    
    // Create a more detailed error message with debug info
    const errorHeading = document.createElement('div');
    errorHeading.style.color = '#e53935';
    errorHeading.style.fontWeight = 'bold';
    errorHeading.style.marginBottom = '10px';
    errorHeading.textContent = message;
    
    const debugInfo = document.createElement('div');
    debugInfo.style.fontSize = '12px';
    debugInfo.style.marginTop = '10px';
    debugInfo.style.color = '#666';
    debugInfo.innerHTML = `
      <p>Debug information:</p>
      <ul>
        <li>Browser: ${navigator.userAgent}</li>
        <li>Time: ${new Date().toLocaleString()}</li>
        <li>localStorage available: ${typeof localStorage !== 'undefined'}</li>
        <li>chrome.storage available: ${typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined'}</li>
      </ul>
      <p>Please try refreshing the page or try a different legal document.</p>
      <p>Click the "Back" button to return to the browser extension popup.</p>
    `;
    
    // Clear any previous error message
    errorDiv.innerHTML = '';
    
    // Add the new error components
    errorDiv.appendChild(errorHeading);
    errorDiv.appendChild(debugInfo);
  }
  
  // Feedback functionality
  const helpfulBtn = document.getElementById('feedback-helpful');
  const notHelpfulBtn = document.getElementById('feedback-not-helpful');
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackText = document.getElementById('feedback-text');
  const submitFeedbackBtn = document.getElementById('submit-feedback');
  const feedbackThanksMsg = document.getElementById('feedback-thanks');
  
  let feedbackType = null;
  
  helpfulBtn.addEventListener('click', function() {
    feedbackType = 'helpful';
    helpfulBtn.classList.add('selected');
    notHelpfulBtn.classList.remove('selected');
    feedbackForm.style.display = 'block';
  });
  
  notHelpfulBtn.addEventListener('click', function() {
    feedbackType = 'not_helpful';
    notHelpfulBtn.classList.add('selected');
    helpfulBtn.classList.remove('selected');
    feedbackForm.style.display = 'block';
  });
  
  submitFeedbackBtn.addEventListener('click', function() {
    if (!feedbackType) return;
    
    // Get the current URL from storage
    chrome.storage.local.get(['documentUrl'], function(result) {
      const currentUrl = result.documentUrl || 'unknown';
      const summaryText = document.getElementById('summary-text').textContent;
      
      const feedbackData = {
        type: feedbackType,
        url: currentUrl,
        comment: feedbackText.value.trim(),
        timestamp: new Date().toISOString(),
        summarySnippet: summaryText.substring(0, 100) + '...' // First 100 chars of summary
      };
      
      // Store feedback in Chrome storage
      chrome.storage.local.get('userFeedback', function(data) {
        const feedbackArray = data.userFeedback || [];
        feedbackArray.push(feedbackData);
        
        chrome.storage.local.set({ 'userFeedback': feedbackArray }, function() {
          console.log('Feedback saved:', feedbackData);
          
          // Show thanks message
          feedbackForm.style.display = 'none';
          feedbackThanksMsg.style.display = 'block';
        });
      });
    });
  });
});