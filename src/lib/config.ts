// API configuration
export const API_URL = 'http://127.0.0.1:5000';
export const WS_URL = 'ws://127.0.0.1:5000';

// Get base URL for frontend
export const getFrontendURL = () => {
    return 'http://127.0.0.1:8080';
};

// Function to get API URL with endpoint
export const getAPIURL = (endpoint: string) => {
    return `${API_URL}${endpoint}`;
};