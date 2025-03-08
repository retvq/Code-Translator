# AI-powered Code Translator

A web-based tool to translate code between Python3, Java, C, and C++ using the Gemini API.

## Features
- Translate code across Python3, Java, C, and C++.
- Modern UI with teal, dark slate, and amber theme.
- Separate dropdowns for source and target languages.
- Real-time stats (lines and characters) for input/output.

## Installation
1. Download the `code_translator.html` file from this repository.
2. Open it in a modern browser (e.g., Chrome, Firefox).
3. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/) or [Google Cloud Console](https://console.cloud.google.com/ai/gemini).
4. Replace `YOUR_GEMINI_API_KEY_HERE` in the JavaScript section with your API key.

## Usage
1. Paste your code in the "Input Code" textarea.
2. Select the source language and target language from the dropdowns.
3. Click "Translate" to see the translated code in the "Translated Code" textarea.
4. Use "Clear" to reset or "Copy Output" to copy the result.

## Requirements
- A web browser with internet access.
- A valid Gemini API key (free tier available).

## Troubleshooting
- **API Errors**: Ensure your API key is valid and activated.
- **CORS Issues**: Run via a local server (e.g., `python -m http.server`) if needed.
- **Rate Limits**: Free tier limits apply (e.g., 60 requests/minute).

## Contributing
- Report issues or suggest features on the [Issues](https://github.com/retvq/code_translator/issues) page.
- Fork, modify, and submit pull requests with your changes.

## License
MIT License - see [LICENSE](LICENSE) file for details.
