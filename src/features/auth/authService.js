import { prototypeAuthConfig } from './prototypeAuthConfig.js';

const INVALID_CREDENTIALS_MESSAGE = 'The username or password is incorrect.';

export function authenticateOperator(username, password) {
  if (
    username.trim() !== prototypeAuthConfig.username ||
    password !== prototypeAuthConfig.password
  ) {
    throw new Error(INVALID_CREDENTIALS_MESSAGE);
  }

  const session = { username: prototypeAuthConfig.username };
  window.sessionStorage.setItem(prototypeAuthConfig.sessionStorageKey, JSON.stringify(session));
  return session;
}

export function readOperatorSession() {
  try {
    const storedSession = window.sessionStorage.getItem(prototypeAuthConfig.sessionStorageKey);
    if (!storedSession) return null;

    const session = JSON.parse(storedSession);
    return session?.username === prototypeAuthConfig.username ? session : null;
  } catch {
    return null;
  }
}

export function clearOperatorSession() {
  window.sessionStorage.removeItem(prototypeAuthConfig.sessionStorageKey);
}
