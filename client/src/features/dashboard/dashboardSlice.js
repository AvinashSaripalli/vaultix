import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchSecuritySummary = createAsyncThunk(
  'dashboard/fetchSecuritySummary',
  async (arg = 'PERSONAL', thunkAPI) => {
    try {
      const vaultType = typeof arg === 'string' ? arg : arg?.vaultType || 'PERSONAL';
      const folderId = typeof arg === 'object' ? arg?.folderId : null;
      const token = thunkAPI.getState().auth.token;
      const params = new URLSearchParams({ vaultType });
      if (folderId && folderId !== 'ALL') params.set('folderId', folderId);
      const response = await api.get(
        `/dashboard/security-summary?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch security summary'
      );
    }
  }
);

export const fetchPasswordActivity = createAsyncThunk(
  'dashboard/fetchPasswordActivity',
  async ({ range = '7D', vaultType = 'PERSONAL', folderId = null }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;
      const params = new URLSearchParams({ range, vaultType });
      if (folderId && folderId !== 'ALL') params.set('folderId', folderId);
      const response = await api.get(
        `/dashboard/password-activity?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch password activity'
      );
    }
  }
);

export const fetchRecentPasswords = createAsyncThunk(
  'dashboard/fetchRecentPasswords',
  async (arg = 'PERSONAL', thunkAPI) => {
    try {
      const vaultType = typeof arg === 'string' ? arg : arg?.vaultType || 'PERSONAL';
      const folderId = typeof arg === 'object' ? arg?.folderId : null;
      const token = thunkAPI.getState().auth.token;
      const params = new URLSearchParams({ vaultType });
      if (folderId && folderId !== 'ALL') params.set('folderId', folderId);
      const response = await api.get(
        `/dashboard/recent-passwords?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch recent passwords'
      );
    }
  }
);

export const fetchLoginActivity = createAsyncThunk(
  'dashboard/fetchLoginActivity',
  async (_, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;
      const response = await api.get('/login-activity', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const activities = response.data.activities || [];
      const total = activities.length;
      const success = activities.filter((a) => a.status === 'SUCCESS').length;
      const failed = activities.filter((a) => a.status === 'FAILED').length;
      const blocked = activities.filter((a) => a.status === 'BLOCKED').length;
      return { loginTotal: total, loginSuccess: success, loginFailed: failed, loginBlocked: blocked, recentLogins: activities.slice(0, 5) };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch login activity'
      );
    }
  }
);

export const fetchRecentActivityLogs = createAsyncThunk(
  'dashboard/fetchRecentActivityLogs',
  async (_, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;
      const response = await api.get('/activity', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return (response.data || []).slice(0, 5);
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch activity logs'
      );
    }
  }
);

const initialState = {
  totalPasswords: 0,
  companyPasswords: 0,
  personalPasswords: 0,
  deletedPasswords: 0,
  weakPasswords: 0,
  oldPasswords: 0,
  riskPasswords: 0,
  securityScore: 100,
  folders: [],
  passwordTrend: [],
  recentPasswords: [],
  loginTotal: 0,
  loginSuccess: 0,
  loginFailed: 0,
  loginBlocked: 0,
  recentLogins: [],
  recentActivityLogs: [],
  summaryLoading: false,
  activityLoading: false,
  recentLoading: false,
  loginLoading: false,
  activityLogsLoading: false,
  error: null,
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSecuritySummary.pending, (state) => {
        state.summaryLoading = true;
        state.error = null;
      })
      .addCase(fetchSecuritySummary.fulfilled, (state, action) => {
        state.summaryLoading = false;
        state.totalPasswords = action.payload.totalPasswords || 0;
        state.companyPasswords = action.payload.companyPasswords || 0;
        state.personalPasswords = action.payload.personalPasswords || 0;
        state.deletedPasswords = action.payload.deletedPasswords || 0;
        state.weakPasswords = action.payload.weakPasswords || 0;
        state.oldPasswords = action.payload.oldPasswords || 0;
        state.riskPasswords = action.payload.riskPasswords || 0;
        state.securityScore = action.payload.securityScore ?? 100;
        state.folders = action.payload.folders || [];
      })
      .addCase(fetchSecuritySummary.rejected, (state, action) => {
        state.summaryLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchPasswordActivity.pending, (state) => {
        state.activityLoading = true;
        state.error = null;
      })
      .addCase(fetchPasswordActivity.fulfilled, (state, action) => {
        state.activityLoading = false;
        state.passwordTrend = action.payload.passwordTrend || [];
      })
      .addCase(fetchPasswordActivity.rejected, (state, action) => {
        state.activityLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchRecentPasswords.pending, (state) => {
        state.recentLoading = true;
        state.error = null;
      })
      .addCase(fetchRecentPasswords.fulfilled, (state, action) => {
        state.recentLoading = false;
        state.recentPasswords = action.payload.recentPasswords || [];
      })
      .addCase(fetchRecentPasswords.rejected, (state, action) => {
        state.recentLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchLoginActivity.pending, (state) => {
        state.loginLoading = true;
      })
      .addCase(fetchLoginActivity.fulfilled, (state, action) => {
        state.loginLoading = false;
        state.loginTotal = action.payload.loginTotal;
        state.loginSuccess = action.payload.loginSuccess;
        state.loginFailed = action.payload.loginFailed;
        state.loginBlocked = action.payload.loginBlocked;
        state.recentLogins = action.payload.recentLogins;
      })
      .addCase(fetchLoginActivity.rejected, (state, action) => {
        state.loginLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchRecentActivityLogs.pending, (state) => {
        state.activityLogsLoading = true;
      })
      .addCase(fetchRecentActivityLogs.fulfilled, (state, action) => {
        state.activityLogsLoading = false;
        state.recentActivityLogs = action.payload;
      })
      .addCase(fetchRecentActivityLogs.rejected, (state, action) => {
        state.activityLogsLoading = false;
        state.error = action.payload;
      });
  },
});

export default dashboardSlice.reducer;