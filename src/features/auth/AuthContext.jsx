import { createContext, useContext, useState } from 'react';
import {
  authenticateOperator,
  clearOperatorSession,
  readOperatorSession,
} from './authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [operator, setOperator] = useState(readOperatorSession);

  function login(username, password) {
    try {
      const session = authenticateOperator(username, password);
      setOperator(session);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to sign in. Please try again.',
      };
    }
  }

  function logout() {
    clearOperatorSession();
    setOperator(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: Boolean(operator), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
