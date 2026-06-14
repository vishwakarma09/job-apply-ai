import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor to add the JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email, password) => {
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);
    const response = await api.post("/api/auth/login", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data;
  },
  register: async (userData) => {
    const response = await api.post("/api/auth/register", userData);
    return response.data;
  },
  getMe: async () => {
    const response = await api.get("/api/auth/me");
    return response.data;
  },
  googleSSO: async (credential) => {
    const response = await api.post("/api/auth/google-sso", { credential });
    return response.data;
  }
};

export const profilesAPI = {
  uploadResume: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/api/profiles/upload-resume", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  getResumes: async () => {
    const response = await api.get("/api/profiles/resumes");
    return response.data;
  },
  getAll: async () => {
    const response = await api.get("/api/profiles");
    return response.data;
  },
  create: async (profileData) => {
    const response = await api.post("/api/profiles", profileData);
    return response.data;
  },
  getActive: async () => {
    const response = await api.get("/api/profiles/active");
    return response.data;
  },
  update: async (profileId, profileData) => {
    const response = await api.put(`/api/profiles/${profileId}`, profileData);
    return response.data;
  },
  getKnowledgebase: async () => {
    const response = await api.get("/api/profiles/knowledgebase");
    return response.data;
  },
  getUnansweredKnowledgebase: async () => {
    const response = await api.get("/api/profiles/knowledgebase/unanswered");
    return response.data;
  },
  updateKnowledgebaseEntry: async (kbId, answer) => {
    const response = await api.put(`/api/profiles/knowledgebase/${kbId}`, { answer });
    return response.data;
  }
};

export const connectorsAPI = {
  getAll: async () => {
    const response = await api.get("/api/connectors");
    return response.data;
  },
  add: async (connectorData) => {
    const response = await api.post("/api/connectors", connectorData);
    return response.data;
  },
  update: async (connectorId, connectorData) => {
    const response = await api.put(`/api/connectors/${connectorId}`, connectorData);
    return response.data;
  },
  delete: async (connectorId) => {
    const response = await api.delete(`/api/connectors/${connectorId}`);
    return response.data;
  }
};

export const jobsAPI = {
  getAll: async () => {
    const response = await api.get("/api/jobs");
    return response.data;
  },
  getDetail: async (jobId) => {
    const response = await api.get(`/api/jobs/${jobId}`);
    return response.data;
  },
  create: async (jobData) => {
    const response = await api.post("/api/jobs", jobData);
    return response.data;
  },
  update: async (jobId, jobData) => {
    const response = await api.put(`/api/jobs/${jobId}`, jobData);
    return response.data;
  },
  tailorApplication: async (jobId, jobProfileId, jobDescription) => {
    const response = await api.post(`/api/jobs/${jobId}/tailor`, {
      job_profile_id: jobProfileId,
      job_description: jobDescription
    });
    return response.data;
  }
};

export const conversationsAPI = {
  getList: async (jobId) => {
    const response = await api.get(`/api/conversations/${jobId}`);
    return response.data;
  },
  add: async (jobId, convoData) => {
    const response = await api.post(`/api/conversations/${jobId}`, convoData);
    return response.data;
  }
};

export const billingAPI = {
  getPlans: async () => {
    const response = await api.get("/api/billing/plans");
    return response.data;
  },
  checkout: async (planId, promoCode = null) => {
    const response = await api.post("/api/billing/checkout", {
      plan_id: planId,
      promo_code: promoCode
    });
    return response.data;
  }
};
