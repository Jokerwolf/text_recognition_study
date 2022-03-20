import { ClientSecretCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import path from 'path';

import config from '../config';

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
