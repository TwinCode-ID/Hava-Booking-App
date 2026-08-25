import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";
import {
  AUTH_SESSION_INVALID_EVENT,
  AUTH_TOKEN_ROTATED_EVENT,
  clearStoredAuth,
  getAccessToken,
  normalizeAccessToken,
  storeAccessToken,
} from "../utils/authToken";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const clearAuthState = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();

      if (token) {
        const response = await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE);
        setUser(response.data);
        setIsAuthenticated(true);
      } else {
        clearAuthState();
      }
    } catch {
      clearAuthState();
    } finally {
      setLoading(false);
    }
  }, [clearAuthState]);

  const login = async (token) => {
    setLoading(true);

    try {
      const normalizedToken = normalizeAccessToken(token);
      if (!normalizedToken) {
        throw new Error("The server returned an invalid access token.");
      }

      const response = await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE, {
        headers: { Authorization: `Bearer ${normalizedToken}` },
      });
      const authenticatedUser = response.data;

      if (!authenticatedUser?._id || !authenticatedUser?.role) {
        throw new Error("The server returned an invalid user profile.");
      }

      storeAccessToken(normalizedToken);
      setUser(authenticatedUser);
      setIsAuthenticated(true);
      return authenticatedUser;
    } catch (error) {
      clearAuthState();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    clearAuthState();
    window.location.assign("/");
  }, [clearAuthState]);

  const updateUser = (updatedUserData) => {
    setUser((currentUser) => ({ ...currentUser, ...updatedUserData }));
  };

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    const handleInvalidSession = () => {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    };

    window.addEventListener(AUTH_SESSION_INVALID_EVENT, handleInvalidSession);
    return () =>
      window.removeEventListener(
        AUTH_SESSION_INVALID_EVENT,
        handleInvalidSession,
      );
  }, []);

  useEffect(() => {
    const handleTokenRotation = () => {
      void checkAuthStatus();
    };

    window.addEventListener(AUTH_TOKEN_ROTATED_EVENT, handleTokenRotation);
    return () =>
      window.removeEventListener(
        AUTH_TOKEN_ROTATED_EVENT,
        handleTokenRotation,
      );
  }, [checkAuthStatus]);

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key !== "token") return;

      if (event.newValue) checkAuthStatus();
      else {
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [checkAuthStatus]);

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
