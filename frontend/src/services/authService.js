import axios from 'axios';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8090";
const AUTH_API_BASE_URL = `${BASE_URL}/api/`; 

const setAuthData = (token, username, role) => {
  localStorage.setItem('userToken', token);
  localStorage.setItem('username', username);
  localStorage.setItem('userRole', role);
};

const login = async (username_or_email, password) => {
  try {
    const formData = new URLSearchParams();
    formData.append('username', username_or_email);
    formData.append('password', password);

    const response = await axios.post(AUTH_API_BASE_URL + 'login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded', 
      },
    });

    const token = response.data.access_token; 
    
    // Fetch full user profile to get the role
    const profileResponse = await axios.get(AUTH_API_BASE_URL + 'users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const loggedInUsername = profileResponse.data.username; 
    const role = profileResponse.data.role;
    
    setAuthData(token, loggedInUsername, role);

    return { username: loggedInUsername, token: token, role: role }; 
  } catch (error) {
    console.error('Backend Login Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Login failed. Please check your credentials.');
  }
};

const register = async (username, email, password) => {
  try {
    const response = await axios.post(AUTH_API_BASE_URL + 'register', {
      username,
      email,
      password,
    });
    return response.data; 
  } catch (error) {
    console.error('Backend Registration Error:', error.response?.data || error.message);
    let errorMessage = 'Registration failed. ';
    if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
            errorMessage += error.response.data.detail;
        } else if (Array.isArray(error.response.data.detail)) {
            errorMessage += error.response.data.detail.map(err => err.msg).join('; ');
        }
    } else {
        errorMessage += error.message;
    }
    throw new Error(errorMessage);
  }
};

const registerStaff = async (username, email, password, role, staff_code) => {
  try {
    const response = await axios.post(AUTH_API_BASE_URL + 'register/staff', {
      username,
      email,
      password,
      role,
      staff_code: staff_code || "NOVA2026"
    });
    return response.data;
  } catch (error) {
    console.error('Backend Staff Registration Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Staff registration failed.');
  }
};

const updateProfile = async (email, oldPassword, newPassword) => {
  try {
    const token = getToken();
    const payload = {};
    if (email) payload.email = email;
    if (oldPassword && newPassword) {
      payload.old_password = oldPassword;
      payload.new_password = newPassword;
    }
    const response = await axios.put(AUTH_API_BASE_URL + 'users/profile', payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Update Profile Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Failed to update profile.');
  }
};

const logout = () => {
  localStorage.removeItem('userToken'); 
  localStorage.removeItem('username'); 
  localStorage.removeItem('userRole'); 
};

const isAuthenticated = () => {
  const token = localStorage.getItem('userToken');
  return token !== null;
};

const getToken = () => {
  return localStorage.getItem('userToken');
};

const getRole = () => {
  return localStorage.getItem('userRole') || 'user';
};

const forgotPassword = async (email) => {
  try {
    const response = await axios.post(AUTH_API_BASE_URL + 'forgot-password', { email });
    return response.data; 
  } catch (error) {
    console.error('Forgot Password Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Failed to send reset link.');
  }
};

const resetPassword = async (token, new_password) => {
  try {
    const response = await axios.post(AUTH_API_BASE_URL + 'reset-password', { token, new_password });
    return response.data; 
  } catch (error) {
    console.error('Reset Password Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Failed to reset password.');
  }
};

const getProfile = async () => {
  try {
    const token = getToken();
    const response = await axios.get(AUTH_API_BASE_URL + 'users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  } catch (error) {
    console.error('Get Profile Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.detail || 'Failed to fetch profile.');
  }
};

export default {
  login,
  register,
  registerStaff,
  updateProfile,
  getProfile,
  logout,
  isAuthenticated,
  getToken,
  getRole,
  forgotPassword, 
  resetPassword,  
};
