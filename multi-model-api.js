/**
 * Multi-model API integration for Legal Document Summarizer
 * This module handles multiple AI models and combines their results
 */

// API Key management
function getEncodedKeys() {
  // Use environment variables if in a project/testing environment
  // This helps with development and testing
  try {
    if (process.env.OPENAI_API_KEY && process.env.GEMINI_API_KEY && process.env.ANTHROPIC_API_KEY) {
      console.log('Using API keys from environment variables');
      return {
        openai: btoa(process.env.OPENAI_API_KEY),
        gemini: btoa(process.env.GEMINI_API_KEY),
        anthropic: btoa(process.env.ANTHROPIC_API_KEY)
      };
    }
  } catch (e) {
    // Not in Node environment, continue with default keys
  }
  
  // Base64 encoded API keys for security (fallback)
  return {
    openai: 'c2stcHJvai1qVkwzamk5djVzN3RDWnhOM1E0dTNsUU5tUi1QLTFieEsxZ3NnZzF1Mjc4RGYwaXplcHlQcWN3QWhoRFlCZ294eXZucXA5eGFnblQzQmxia0ZKM094OTVDMkhJdXk2aWdSNU5YaUFMX0poam5XdGE3bUZjUWJGbk5tdG1fV1hxQ1JvYjQ0YTBMWWdCQ29wRnVPT2JybFF0RWRCNEE=',
    // Updated API keys with properly encoded versions
    gemini: 'QUl6YVN5Q0tlY0RGZFF4VVBycmluLXAzVWpxeW41X2o3M3Jvd2s4',
    anthropic: 'c2stYW50LWFwaTAzLWNQRTFOMDh2YXFaZUwwajlRZXQ1MWpRNktuTzI1RWJ4ZDNoakNsLWJKUlNZcUZ2akdyOUJSNm5HU3hfSzV1QW9IcUd2cUtPUUMybDBnOE01cndCcGZBLXMxM2Q2d0FB'
  };
}

// Helper to base64 encode a string
function encodeToBase64(text) {
  return btoa(text);
}

// Initialize API keys in storage
function initializeApiKeys() {
  const encodedKeys = getEncodedKeys();
  
  // Store all keys in chrome.storage.local for better background script compatibility
  chrome.storage.local.set({
    'multiModelApiKeys': {
      openai: encodedKeys.openai,
      gemini: encodedKeys.gemini,
      anthropic: encodedKeys.anthropic
    }
  }, () => {
    console.log('Multi-model API keys initialized in local storage');
  });
}

// Get API keys from storage
async function getApiKeys() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['multiModelApiKeys'], (result) => {
      if (result.multiModelApiKeys) {
        const keys = {
          openai: atob(result.multiModelApiKeys.openai),
          gemini: atob(result.multiModelApiKeys.gemini),
          anthropic: atob(result.multiModelApiKeys.anthropic)
        };
        resolve(keys);
      } else {
        // Fallback to default keys if not found in storage
        const encodedKeys = getEncodedKeys();
        const keys = {
          openai: atob(encodedKeys.openai),
          gemini: atob(encodedKeys.gemini),
          anthropic: atob(encodedKeys.anthropic)
        };
        resolve(keys);
      }
    });
  });
}

// Create prompt for each model type
function createPromptForModel(text, model) {
  // Base prompt for all models
  const basePrompt = `I need help analyzing this legal document:

${text.substring(0, 15000)}${text.length > 15000 ? '... (document truncated due to length)' : ''}

Based on the above document, please provide:

1. A comprehensive summary of the main points covering ALL important aspects that a user must know. The summary can be as long as needed to include all relevant information. Use simple, everyday language that a 5th grader could understand.

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

  // Customize for specific models if needed
  switch(model) {
    case 'openai':
      return basePrompt + "\n\nIMPORTANT: Your response must be ONLY valid JSON that can be parsed with JSON.parse(). DO NOT include backticks, code blocks, or any text outside the JSON.";
    case 'gemini':
      return basePrompt + "\n\nCRITICAL: RESPOND WITH ONLY THE JSON OBJECT, NOTHING ELSE. NO MARKDOWN FORMATTING. NO CODE BLOCKS. NO BACKTICKS. NO EXPLANATION TEXT BEFORE OR AFTER THE JSON.";
    case 'anthropic':
      return basePrompt + "\n\nVERY IMPORTANT: Your response must be a valid JSON object that can be parsed with JSON.parse(). Do not include any text before or after the JSON. Do not use markdown code blocks. The response should start with '{' and end with '}' with nothing else.";
    default:
      return basePrompt;
  }
}

// Call OpenAI API
async function callOpenAI(text, apiKey) {
  console.log('Calling OpenAI API');
  
  // Define models to try in order of preference
  const openaiModels = [
    'gpt-3.5-turbo-0125', // Using only models confirmed to work with this key
    'gpt-3.5-turbo-instruct',
    'text-davinci-003'
  ];
  
  let lastError = null;
  
  // Try each model in order
  for (const model of openaiModels) {
    try {
      console.log(`Trying OpenAI model: ${model}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
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
              content: createPromptForModel(text, 'openai')
            }
          ],
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || `Error with ${model}`;
        console.warn(`OpenAI model ${model} failed: ${errorMessage}`);
        lastError = new Error(errorMessage);
        continue; // Try next model
      }
      
      const data = await response.json();
      
      // Check if we have valid response data
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        console.warn(`OpenAI model ${model} returned incomplete data structure`);
        lastError = new Error(`Invalid response structure from OpenAI ${model}`);
        continue; // Try next model
      }
      
      console.log(`Successfully got response from OpenAI model: ${model}`);
      return parseResponse(data.choices[0].message.content, 'openai');
    } catch (error) {
      console.error(`Error with OpenAI model ${model}:`, error);
      lastError = error;
      // Continue to next model
    }
  }
  
  // If we get here, all models failed
  const modelsList = openaiModels.join(', ');
  throw lastError || new Error(`All OpenAI models (${modelsList}) failed with your API key`);
}

// Call Google Gemini API
async function callGemini(text, apiKey) {
  console.log('Calling Google Gemini API');
  
  // Define models to try in order of preference
  const geminiModels = [
    'gemini-1.5-pro', // First choice - most capable
    'gemini-1.5-flash' // Second choice - faster but still capable
  ];
  
  let lastError = null;
  
  // Try each model in order
  for (const model of geminiModels) {
    try {
      console.log(`Trying Gemini model: ${model}`);
      
      // Use the v1 API endpoint with the current model
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: createPromptForModel(text, 'gemini')
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || `Error with ${model}`;
        console.warn(`Gemini model ${model} failed: ${errorMessage}`);
        lastError = new Error(errorMessage);
        continue; // Try next model
      }
      
      const data = await response.json();
      
      // Check if we have valid response data
      if (!data.candidates || !data.candidates[0] || 
          !data.candidates[0].content || !data.candidates[0].content.parts ||
          !data.candidates[0].content.parts[0]) {
        console.warn(`Gemini model ${model} returned incomplete data structure`);
        lastError = new Error(`Invalid response structure from Gemini ${model}`);
        continue; // Try next model
      }
      
      // Extract the text from Gemini's response format
      const content = data.candidates[0].content.parts[0].text;
      console.log(`Successfully got response from Gemini model: ${model}`);
      return parseResponse(content, 'gemini');
    } catch (error) {
      console.error(`Error with Gemini model ${model}:`, error);
      lastError = error;
      // Continue to next model
    }
  }
  
  // If we get here, all models failed
  const modelsList = geminiModels.join(', ');
  throw lastError || new Error(`All Gemini models (${modelsList}) failed with your API key`);
}

// Call Anthropic Claude API
async function callClaude(text, apiKey) {
  console.log('Calling Anthropic Claude API');
  
  // Define models to try in order of preference
  const claudeModels = [
    'claude-3-haiku-20240307' // Using only the model we confirmed is working
  ];
  
  let lastError = null;
  
  // Try each model in order
  for (const model of claudeModels) {
    try {
      console.log(`Trying Claude model: ${model}`);
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'tools-2024-05-16'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4000,
          system: "You are a legal expert specializing in analyzing and simplifying complex legal documents for the average person.",
          messages: [
            {
              role: 'user',
              content: createPromptForModel(text, 'anthropic')
            }
          ],
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || `Error with ${model}`;
        console.warn(`Claude model ${model} failed: ${errorMessage}`);
        lastError = new Error(errorMessage);
        continue; // Try next model
      }
      
      const data = await response.json();
      
      // Check if we have valid response data with appropriate structure
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        console.warn(`Claude model ${model} returned incomplete data structure`);
        lastError = new Error(`Invalid response structure from Claude ${model}`);
        continue; // Try next model
      }
      
      // Extract content correctly from Claude API response (combining all text parts)
      let content = '';
      for (const item of data.content) {
        if (item.type === 'text') {
          content += item.text;
        }
      }
      
      if (!content) {
        console.warn(`Claude model ${model} returned empty content`);
        lastError = new Error(`Empty content from Claude ${model}`);
        continue; // Try next model
      }
      
      console.log(`Successfully got response from Claude model: ${model}`);
      return parseResponse(content, 'anthropic');
    } catch (error) {
      console.error(`Error with Claude model ${model}:`, error);
      lastError = error;
      // Continue to next model
    }
  }
  
  // If we get here, all models failed
  const modelsList = claudeModels.join(', ');
  throw lastError || new Error(`All Claude models (${modelsList}) failed with your API key`);
}

// Parse API response based on the model
function parseResponse(responseText, model) {
  console.log(`Parsing ${model} response`);
  
  // Handle empty response
  if (!responseText || typeof responseText !== 'string') {
    throw new Error(`Empty or invalid response from ${model}`);
  }
  
  // Clean up response - remove markdown code blocks if present
  let cleanedResponse = responseText;
  
  // Remove markdown code blocks (```json ... ```) if present
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
  const codeBlockMatch = codeBlockRegex.exec(responseText);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleanedResponse = codeBlockMatch[1].trim();
    console.log(`Extracted JSON from code block in ${model} response`);
  }
  
  try {
    // Try direct JSON parsing first with the cleaned response
    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error(`Error parsing ${model} response:`, error);
    console.log(`Problematic response from ${model}:`, cleanedResponse.substring(0, 100) + "...");
    
    // Fallback to regex extraction if direct parsing fails
    const jsonRegex = /{[\s\S]*}/;
    const match = cleanedResponse.match(jsonRegex);
    
    if (match) {
      try {
        const result = JSON.parse(match[0]);
        console.log(`Successfully extracted JSON with regex from ${model} response`);
        return result;
      } catch (secondError) {
        console.error(`Second parsing attempt for ${model} also failed:`, secondError);
        throw new Error(`Failed to parse the ${model} response. The API returned invalid JSON.`);
      }
    } else {
      console.error(`No JSON-like structure found in ${model} response`);
      throw new Error(`${model} response was not in the expected format. No JSON object found.`);
    }
  }
}

// Combined analysis across multiple models
async function analyzeWithMultipleModels(text, url) {
  console.log('Starting multi-model analysis');
  const apiKeys = await getApiKeys();
  const results = [];
  const errors = [];
  
  // Call each available API in parallel
  const apiPromises = [];
  
  if (apiKeys.openai) {
    apiPromises.push(
      callOpenAI(text, apiKeys.openai)
        .then(result => {
          results.push({ model: 'openai', result });
          return result;
        })
        .catch(error => {
          errors.push({ model: 'openai', error: error.message });
          return null;
        })
    );
  }
  
  if (apiKeys.gemini) {
    apiPromises.push(
      callGemini(text, apiKeys.gemini)
        .then(result => {
          results.push({ model: 'gemini', result });
          return result;
        })
        .catch(error => {
          errors.push({ model: 'gemini', error: error.message });
          return null;
        })
    );
  }
  
  if (apiKeys.anthropic) {
    apiPromises.push(
      callClaude(text, apiKeys.anthropic)
        .then(result => {
          results.push({ model: 'anthropic', result });
          return result;
        })
        .catch(error => {
          errors.push({ model: 'anthropic', error: error.message });
          return null;
        })
    );
  }
  
  // Wait for all API calls to complete
  await Promise.all(apiPromises);
  
  // If all APIs failed, throw an error
  if (results.length === 0) {
    throw new Error(`All AI models failed: ${errors.map(e => `${e.model}: ${e.error}`).join(', ')}`);
  }
  
  // Set this flag to true to disable OpenAI in case it keeps failing
  const skipOpenAI = true;
  
  // Filter out OpenAI if it's failing or we're skipping it
  const filteredResults = skipOpenAI 
    ? results.filter(r => r.model !== 'openai')
    : results;
    
  // If we have no results after filtering, but we had OpenAI results, keep OpenAI
  if (filteredResults.length === 0 && results.some(r => r.model === 'openai')) {
    console.log('Using OpenAI results despite configuration to skip it, as it\'s the only model with results');
  } else if (filteredResults.length > 0) {
    // We have results from other models, use those instead of OpenAI
    results.length = 0; // Clear the array
    filteredResults.forEach(r => results.push(r)); // Add back the filtered results
  }
  
  // Log which models were used
  console.log(`Successfully used these models: ${results.map(r => r.model).join(', ')}`);
  if (errors.length > 0) {
    console.log(`These models failed: ${errors.map(e => e.model).join(', ')}`);
  }
  
  // Combine results from different models
  return combineResults(results);
}

// Helper function to average letter grades
function averageGrades(grades) {
  const gradeValues = {
    'A': 4,
    'B': 3,
    'C': 2,
    'D': 1,
    'E': 0
  };
  
  const reverseGradeValues = {
    4: 'A',
    3: 'B',
    2: 'C',
    1: 'D',
    0: 'E'
  };
  
  // Process each grade category
  const result = {};
  
  for (const category of ['overall', 'transparency', 'complexity', 'fairness', 'privacy', 'risks']) {
    let total = 0;
    let count = 0;
    
    // Sum up the numeric grade values
    for (const { result } of grades) {
      if (result.grades && result.grades[category]) {
        total += gradeValues[result.grades[category]] || 0;
        count++;
      }
    }
    
    // Convert back to letter grade
    if (count > 0) {
      const average = Math.round(total / count);
      result[category] = reverseGradeValues[average];
    } else {
      result[category] = 'C'; // Default grade if no data
    }
  }
  
  return result;
}

// Combine results from multiple models
function combineResults(modelResults) {
  console.log('Combining results from multiple models');
  
  if (modelResults.length === 1) {
    // Only one model succeeded, return its results directly
    return modelResults[0].result;
  }
  
  // Initialize the combined result
  const combined = {
    summary: '',
    keyPoints: [],
    risks: [],
    grades: {},
    modelContributions: [], // Track which models contributed
    complexity: {
      score: 0, // 0-100 scale
      terms: [] // Will hold legal jargon terms found in document
    }
  };
  
  // Average the grades from all models
  combined.grades = averageGrades(modelResults);
  
  // For each model result
  modelResults.forEach(({ model, result }) => {
    combined.modelContributions.push(model);
    
    // Combine summaries (most complex part)
    if (combined.summary.length === 0) {
      // If this is the first valid summary, use it as the base
      combined.summary = result.summary;
    } else {
      // Avoid duplication by only adding new information
      // This is a simplified approach - a proper implementation would need more sophisticated text analysis
      if (result.summary && result.summary.length > combined.summary.length * 0.5) {
        combined.summary += "\n\nAdditional insights: " + result.summary.substring(0, 200) + "...";
      }
    }
    
    // Combine key points (avoid duplicates)
    if (result.keyPoints && Array.isArray(result.keyPoints)) {
      result.keyPoints.forEach(point => {
        // Simple duplication check - if the point text is not substantially similar to any existing point
        const isDuplicate = combined.keyPoints.some(existingPoint => 
          existingPoint.text.toLowerCase().includes(point.text.toLowerCase().substring(0, 15)) ||
          point.text.toLowerCase().includes(existingPoint.text.toLowerCase().substring(0, 15))
        );
        
        if (!isDuplicate) {
          combined.keyPoints.push(point);
        }
      });
    }
    
    // Combine risks (avoid duplicates)
    if (result.risks && Array.isArray(result.risks)) {
      result.risks.forEach(risk => {
        // Simple duplication check
        const isDuplicate = combined.risks.some(existingRisk =>
          existingRisk.toLowerCase().includes(risk.toLowerCase().substring(0, 15)) ||
          risk.toLowerCase().includes(existingRisk.toLowerCase().substring(0, 15))
        );
        
        if (!isDuplicate) {
          combined.risks.push(risk);
        }
      });
    }
    
    // Process complexity information
    if (result.complexity) {
      // Add complexity score - we'll average them later
      if (typeof result.complexity.score === 'number') {
        // Add to running total
        combined.complexity.score += result.complexity.score;
      }
      
      // Add legal terms without duplicates
      if (result.complexity.terms && Array.isArray(result.complexity.terms)) {
        result.complexity.terms.forEach(term => {
          // Check if this term is already included (avoid duplicates)
          const isDuplicate = combined.complexity.terms.some(existingTerm => 
            existingTerm.term.toLowerCase() === term.term.toLowerCase()
          );
          
          if (!isDuplicate) {
            combined.complexity.terms.push(term);
          }
        });
      }
    }
  });
  
  // Calculate average complexity score
  if (modelResults.length > 0) {
    // Count models that provided complexity scores
    const modelsWithComplexity = modelResults.filter(({ result }) => 
      result.complexity && typeof result.complexity.score === 'number'
    ).length;
    
    if (modelsWithComplexity > 0) {
      combined.complexity.score = Math.round(combined.complexity.score / modelsWithComplexity);
    } else {
      // Default complexity if no models provided it (based on complexity grade)
      const complexityGrade = combined.grades.complexity || 'C';
      const defaultScores = { 'A': 20, 'B': 40, 'C': 60, 'D': 80, 'E': 95 };
      combined.complexity.score = defaultScores[complexityGrade];
    }
  }
  
  // Limit the number of key points and risks to avoid overwhelming the user
  if (combined.keyPoints.length > 7) {
    combined.keyPoints = combined.keyPoints.slice(0, 7);
  }
  
  if (combined.risks.length > 5) {
    combined.risks = combined.risks.slice(0, 5);
  }
  
  return combined;
}

// Export the module functions
// Check if window exists (for content/popup scripts) or if we're in a service worker context
if (typeof window !== 'undefined') {
  // Browser context (content script, popup)
  window.multiModelAPI = {
    initializeApiKeys,
    getApiKeys,
    analyzeWithMultipleModels
  };
} else {
  // Service worker context (background script)
  self.multiModelAPI = {
    initializeApiKeys,
    getApiKeys,
    analyzeWithMultipleModels
  };
}