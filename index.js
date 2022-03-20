import prompts from 'prompts';
import { series } from 'async';
import { readFileSync, writeFileSync } from 'fs';
import https from 'https';
import path from 'path';
import { promisify } from 'util';
import { ComputerVisionClient } from '@azure/cognitiveservices-computervision';
import { ApiKeyCredentials } from '@azure/ms-rest-js';
import { ClientSecretCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
// import { getKey } from './src/auth.js';
// import config from './config.js';

const credential = new ClientSecretCredential(
  config.tenantId,
  config.clientId,
  config.clientSecret,
);
const client = new SecretClient(config.keyVaultEndpoint, credential);

export async function getKey() {
  const retrievedSecret = await client.getSecret(config.secretName);
  return retrievedSecret.value;
}

const sleep = promisify(setTimeout);

const STATUS_SUCCEEDED = 'succeeded';
const STATUS_FAILED = 'failed';

const computerVisionClient = (key, endpoint) =>
  new ComputerVisionClient(
    new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': key } }),
    endpoint,
  );

function computerVision(filePath, key) {
  series(
    [
      async function () {
        printRecText(
          await readTextFromLocal(
            computerVisionClient(key, config.computerVisionEndpoint),
            filePath,
          ),
        );
      },
      () => Promise.resolve(),
    ],
    (err) => {
      throw err;
    },
  );
}

// Perform read and await the result from URL
async function readTextFromURL(client, url) {
  // To recognize text in a local image, replace client.read() with readTextInStream() as shown:
  let result = await client.read(url);
  // Operation ID is last path segment of operationLocation (a URL)
  const operation = result.operationLocation.split('/').slice(-1)[0];

  // Wait for read recognition to complete
  // result.status is initially undefined, since it's the result of read
  while (result.status !== STATUS_SUCCEEDED) {
    await sleep(1000);
    result = await client.getReadResult(operation);
  }
  return result.analyzeResult.readResults; // Return the first page of result. Replace [0] with the desired page if this is a multi-page file such as .pdf or .tiff.
}

async function readTextFromLocal(client, path) {
  let result = await client.readInStream(readFileSync(path));
  const operation = result.operationLocation.split('/').slice(-1)[0];

  // Wait for read recognition to complete
  // result.status is initially undefined, since it's the result of read
  while (result.status !== STATUS_SUCCEEDED) {
    await sleep(1000);
    result = await client.getReadResult(operation);
  }
  return result.analyzeResult.readResults; // Return the first page of result. Replace [0] with the desired page if this is a multi-page file such as .pdf or .tiff.
}

// Prints all text from Read result
function printRecText(readResults) {
  writeFileSync('./api-response', JSON.stringify(readResults));
  console.log('Recognized text:');
  for (const page in readResults) {
    if (readResults.length > 1) {
      console.log(`==== Page: ${page}`);
    }
    const result = readResults[page];
    if (result.lines.length) {
      for (const line of result.lines) {
        console.log(line.words.map((w) => w.text).join(' '));
      }
    } else {
      console.log('No recognized text.');
    }
  }
}

const SUPPORTED_FILE_EXT = ['.png'];

async function runApp() {
  const response = await prompts({
    name: 'filePath',
    type: 'text',
    message: `Where is the file? Supported formats: ${SUPPORTED_FILE_EXT}`,
    validate: (x) => SUPPORTED_FILE_EXT.includes(path.extname(x)),
  });

  computerVision(response.filePath, await getKey());
}

runApp();
