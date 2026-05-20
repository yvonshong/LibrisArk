import re

with open('/home/song/Code/Personal/LibrisArk/app/src/lib/remotely-save/fsOnedrive.ts', 'r') as f:
    content = f.read()

# 1. Remove obsidian and msal imports
content = re.sub(r'import \{ request, requestUrl \} from "obsidian";\n', '', content)
content = re.sub(r'import \{ VALID_REQURL \} from "\./baseTypesObs";\n', '', content)
content = re.sub(r'import \{ CryptoProvider, PublicClientApplication \} from "@azure/msal-node";\n', '', content)

# 2. Add Tauri http fetch import
content = 'import { fetch } from "@tauri-apps/plugin-http";\n' + content

# 3. Fix baseTypes import
content = re.sub(r'import \{(.*?)\} from "\./baseTypes";\n', 
                 r'import {\1} from "./baseTypes";\n', content, flags=re.DOTALL)

# 4. Replace request(...) with fetch(...) wrapper
# Since Obsidian's request(options) takes {url, method, contentType, body, headers} and returns string.
# We can create a helper `async function obsidianRequest` to mock it.
mock_request = """
async function request(options: any) {
  const res = await fetch(options.url, {
    method: options.method,
    headers: {
      ...options.headers,
      ...(options.contentType ? { "Content-Type": options.contentType } : {})
    },
    body: options.body
  });
  return await res.text();
}
async function requestUrl(options: any) {
  const res = await fetch(options.url, {
    method: options.method,
    headers: {
      ...options.headers,
      ...(options.contentType ? { "Content-Type": options.contentType } : {})
    },
    body: options.body
  });
  return {
    json: await res.json(),
    text: await res.text(),
    arrayBuffer: await res.arrayBuffer()
  };
}
const VALID_REQURL = true;
"""

content = mock_request + content

# 5. Fix getAuthUrlAndVerifier PKCE generation using SubtleCrypto
pkce_code = """
async function generatePkceCodes() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge };
}
"""

content = pkce_code + content

# Fix getAuthUrlAndVerifier function body
old_get_auth = '''export async function getAuthUrlAndVerifier(
  clientID: string,
  authority: string
) {
  const cryptoProvider = new CryptoProvider();
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();

  const pkceCodes = {
    challengeMethod: "S256", // Use SHA256 Algorithm
    verifier: verifier,
    challenge: challenge,
  };

  const authCodeUrlParams = {
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
    codeChallenge: pkceCodes.challenge, // PKCE Code Challenge
    codeChallengeMethod: pkceCodes.challengeMethod, // PKCE Code Challenge Method
  };

  const pca = new PublicClientApplication({
    auth: {
      clientId: clientID,
      authority: authority,
    },
  });
  const authCodeUrl = await pca.getAuthCodeUrl(authCodeUrlParams);

  return {
    authUrl: authCodeUrl,
    verifier: verifier,
  };
}'''

new_get_auth = '''export async function getAuthUrlAndVerifier(
  clientID: string,
  authority: string
) {
  const { verifier, challenge } = await generatePkceCodes();

  const params = new URLSearchParams({
    client_id: clientID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  const authUrl = `${authority}/oauth2/v2.0/authorize?${params.toString()}`;

  return {
    authUrl,
    verifier,
  };
}'''

content = content.replace(old_get_auth, new_get_auth)

# Save
with open('/home/song/Code/Personal/LibrisArk/app/src/lib/remotely-save/fsOnedrive.ts', 'w') as f:
    f.write(content)
