import React, { createContext, useState, useEffect, useContext } from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          localStorage.setItem("token", token);
          const userData = await authAPI.getMe();
          setUser(userData);
        } catch (error) {
          console.error("Failed to load user:", error);
          logout();
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await authAPI.login(email, password);
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      setLoading(false);
      return data.user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const loginWithGoogle = async (credentialToken) => {
    setLoading(true);
    try {
      const data = await authAPI.googleSSO(credentialToken);
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      setLoading(false);
      return data.user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const newUser = await authAPI.register(userData);
      setLoading(false);
      return newUser;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        isAuthenticated: !!user,
        isPremium: user?.is_premium || false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
