const fs = require('fs');
const path = require('path');
const axios = require('axios');

// --- Configuration ---
const API_ENDPOINT_URL = 'https://u91h1twf00.execute-api.eu-north-1.amazonaws.com/default/IssueTranscribe'; // 👈 Your API Gateway URL
const FILE_TO_TRANSCRIBE = 'AD09009.wav';     // 👈 The audio file
const MIME_TYPE = 'audio/wav';                // 👈 The file's MIME type
// ---------------------

/**
 * Reads a file, converts it to Base64, and sends it to the Lambda API.
 */
async function getTranscription() {
  try {
    // 1. Read the audio file from disk
    console.log(`Reading file: ${FILE_TO_TRANSCRIBE}...`);
    const audioFile = fs.readFileSync(path.resolve(FILE_TO_TRANSCRIBE));

    // 2. Convert the file buffer to a Base64 string
    const audioBase64 = audioFile.toString('base64');
    console.log('File converted to Base64.');

    // 3. Create the JSON payload (This is what your Lambda expects)
    const payload = {
      mime_type: MIME_TYPE,
      audio_base64: audioBase64,
    };
    //console.log(payload)
    // 4. Send the POST request to your API Gateway
    console.log(`Sending request to ${API_ENDPOINT_URL}...`);
    const response = await axios.post(API_ENDPOINT_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Increase timeout for potentially long transcriptions
      timeout: 60000, // 60 seconds
    });

    // 5. Log the structured response
    console.log('\n--- SUCCESS ---');
    const data = response.data;
    console.log('Transcription:', data.transcription);
    console.log('Title:', data.title || '(none)');
    console.log('AI Category:', data.ai_category || '(none)');

  } catch (error) {
    console.error('\n--- ERROR ---');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Status:', error.response.status);
      console.error('API Error Body:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error:', error.message);
    }
  }
}

// Run the function
getTranscription();