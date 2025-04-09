# Legal Document Summarizer Browser Extension

A browser extension that  detects and summarizes legal documents like terms of service, and privacy policies and many more using multi-model AI technology.

## Features

- **Multi-Model AI Analysis**: Uses multiple AI models (OpenAI, Claude, Gemini) for comprehensive analysis
- **Risk Assessment**: Identifies key points with color-coded risk level indicators (low, medium, high)
- **Overall Grading**: Provides letter grades (A to E) for transparency, complexity, fairness, privacy, and overall risk
- **Auto Detection**: Automatically detects legal documents on web pages
- **Complexity Analysis**: Scores document complexity and identifies legal jargon with explanations
- **Comprehensive Summaries**: Provides thorough summaries covering all important aspects

## How to Use
**Manual Mode**: 
   - Navigate to a page with legal content (terms of service, privacy policy, etc.)
   - Click the extension icon in your browser toolbar
   - The extension will extract the text and generate a comprehensive analysis

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension-build folder
5. The extension should now be installed and ready to use

## Requirements

- Chromium-based browser (Chrome, Edge, Brave, etc.)
- Internet connection for API access

## Privacy

This extension processes document text through multiple AI APIs. The extension includes a pre-configured OpenAI API key, but you may need to provide your own keys for Claude and Gemini models. No document data is stored permanently beyond your local browser storage.

## License

MIT License
