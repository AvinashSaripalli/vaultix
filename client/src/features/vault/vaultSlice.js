import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';

export const fetchVaults = createAsyncThunk(
  'vault/fetchVaults',
  async (_, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const response = await api.get('/vaults', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch vaults'
      );
    }
  }
);

export const fetchVaultBySlug = createAsyncThunk(
  'vault/fetchVaultBySlug',
  async (slug, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const response = await api.get(`/vaults/${slug}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch vault'
      );
    }
  }
);

export const fetchPasswordsByVault = createAsyncThunk(
  'vault/fetchPasswordsByVault',
  async (vaultId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const response = await api.get(`/passwords/vault/${vaultId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch passwords'
      );
    }
  }
);

export const fetchFoldersByVault = createAsyncThunk(
  'vault/fetchFoldersByVault',
  async (vaultId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const response = await api.get(`/folders/vault/${vaultId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch folders'
      );
    }
  }
);

export const createFolder = createAsyncThunk(
  'vault/createFolder',
  async (payload, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const response = await api.post('/folders', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to create folder'
      );
    }
  }
);

export const createPassword = createAsyncThunk(
  'vault/createPassword',
  async (payload, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const response = await api.post('/passwords', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to create password'
      );
    }
  }
);

export const updatePassword = createAsyncThunk(
  'vault/updatePassword',
  async ({ passwordId, payload }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const response = await api.put(`/passwords/${passwordId}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to update password'
      );
    }
  }
);

export const deletePassword = createAsyncThunk(
  'vault/deletePassword',
  async (passwordId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      await api.delete(`/passwords/${passwordId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return passwordId;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to delete password'
      );
    }
  }
);

export const fetchVaultTrash = createAsyncThunk(
  'vault/fetchVaultTrash',
  async (vaultId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;
      const res = await api.get(`/passwords/vault/${vaultId}/trash`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { vaultId, trash: res.data || [] };
    } catch (error) {
      return { vaultId, trash: [] };
    }
  }
);

export const restorePassword = createAsyncThunk(
  'vault/restorePassword',
  async ({ passwordId, vaultId }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;
      await api.post(`/passwords/${passwordId}/restore`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { passwordId, vaultId };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to restore password'
      );
    }
  }
);

export const purgePassword = createAsyncThunk(
  'vault/purgePassword',
  async ({ passwordId, vaultId }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;
      const res = await api.delete(`/passwords/${passwordId}/purge`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        passwordId,
        vaultId,
        approvalRequired: res.data?.approvalRequired,
        message: res.data?.message,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to permanently delete password'
      );
    }
  }
);

export const deleteFolder = createAsyncThunk(
  'vault/deleteFolder',
  async (folderId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      await api.delete(`/folders/${folderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return folderId;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to delete folder'
      );
    }
  }
);

export const shareFolderAccess = createAsyncThunk(
  'vault/shareFolderAccess',
  async ({ folderId, userEmail, accessLevel, vaultId }, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      await api.post(
        `/folders/${folderId}/share`,
        {
          userEmail,
          accessLevel,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const response = await api.get(`/folders/vault/${vaultId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return {
        folderId,
        folders: response.data,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to share folder'
      );
    }
  }
);

export const fetchActivityLogs = createAsyncThunk(
  'vault/fetchActivityLogs',
  async (departmentId, thunkAPI) => {
    try {
      const token = thunkAPI.getState().auth.token;

      const params = {};
      if (departmentId) params.departmentId = departmentId;

      const response = await api.get('/activity', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to fetch activity logs'
      );
    }
  }
);

const initialState = {
  vaults: [],
  selectedVault: null,
  passwords: [],
  folders: [],
  trash: [],
  trashByVault: {},
  activityLogs: [],
  selectedPasswordId: null,
  selectedFolderId: null,

  isAddPasswordModalOpen: false,
  isEditPasswordModalOpen: false,
  isAddFolderModalOpen: false,

  vaultsLoading: false,
  passwordsLoading: false,
  foldersLoading: false,
  activityLoading: false,
  actionLoading: false,
  trashLoading: false,

  searchTerm: '',
  collapsedFolders: {},
  error: null,
};

const vaultSlice = createSlice({
  name: 'vault',
  initialState,
  reducers: {
    selectPassword: (state, action) => {
      state.selectedPasswordId = action.payload;
    },
    openAddPasswordModal: (state) => {
      state.isAddPasswordModalOpen = true;
    },
    closeAddPasswordModal: (state) => {
      state.isAddPasswordModalOpen = false;
    },
    openEditPasswordModal: (state) => {
      state.isEditPasswordModalOpen = true;
    },
    closeEditPasswordModal: (state) => {
      state.isEditPasswordModalOpen = false;
    },
    openAddFolderModal: (state) => {
      state.isAddFolderModalOpen = true;
    },
    closeAddFolderModal: (state) => {
      state.isAddFolderModalOpen = false;
    },
    selectFolder: (state, action) => {
      state.selectedFolderId = action.payload;
      state.selectedPasswordId = null;
      state.searchTerm = '';
    },
    clearSelectedFolder: (state) => {
      state.selectedFolderId = null;
      state.selectedPasswordId = null;
    },
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
    },
    toggleFolderCollapse: (state, action) => {
      const folderId = action.payload;
      state.collapsedFolders[folderId] = !state.collapsedFolders[folderId];
    },
    clearVaultError: (state) => {
      state.error = null;
    },
    clearVaultState: (state) => {
      state.vaults = [];
      state.selectedVault = null;
      state.passwords = [];
      state.folders = [];
      state.activityLogs = [];
      state.selectedPasswordId = null;
      state.selectedFolderId = null;
      state.isAddPasswordModalOpen = false;
      state.isEditPasswordModalOpen = false;
      state.isAddFolderModalOpen = false;
      state.vaultsLoading = false;
      state.passwordsLoading = false;
      state.foldersLoading = false;
      state.activityLoading = false;
      state.actionLoading = false;
      state.searchTerm = '';
      state.collapsedFolders = {};
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVaults.pending, (state) => {
        state.vaultsLoading = true;
        state.error = null;
      })
      .addCase(fetchVaults.fulfilled, (state, action) => {
        state.vaultsLoading = false;
        state.vaults = action.payload;
      })
      .addCase(fetchVaults.rejected, (state, action) => {
        state.vaultsLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchVaultBySlug.pending, (state) => {
        state.vaultsLoading = true;
        state.error = null;
      })
      .addCase(fetchVaultBySlug.fulfilled, (state, action) => {
        state.vaultsLoading = false;
        state.selectedVault = action.payload;
      })
      .addCase(fetchVaultBySlug.rejected, (state, action) => {
        state.vaultsLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchPasswordsByVault.pending, (state) => {
        state.passwordsLoading = true;
        state.error = null;
      })
      .addCase(fetchPasswordsByVault.fulfilled, (state, action) => {
        state.passwordsLoading = false;
        state.passwords = action.payload;

        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        if (state.selectedFolderId && isDesktop) {
          const folderPasswords = action.payload.filter(
            (item) => item.folderId === state.selectedFolderId
          );

          state.selectedPasswordId = folderPasswords.length
            ? folderPasswords[0].id
            : null;
        } else {
          state.selectedPasswordId = null;
        }
      })
      .addCase(fetchPasswordsByVault.rejected, (state, action) => {
        state.passwordsLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchFoldersByVault.pending, (state) => {
        state.foldersLoading = true;
        state.error = null;
      })
      .addCase(fetchFoldersByVault.fulfilled, (state, action) => {
        state.foldersLoading = false;
        state.folders = action.payload;

        if (
          state.selectedFolderId &&
          !action.payload.some((folder) => folder.id === state.selectedFolderId)
        ) {
          state.selectedFolderId = null;
        }
      })
      .addCase(fetchFoldersByVault.rejected, (state, action) => {
        state.foldersLoading = false;
        state.error = action.payload;
      })

      .addCase(createFolder.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createFolder.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.folders.push(action.payload);
        state.isAddFolderModalOpen = false;
      })
      .addCase(createFolder.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(createPassword.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(createPassword.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.passwords.unshift(action.payload);
        state.selectedPasswordId = action.payload.id;
        state.isAddPasswordModalOpen = false;
      })
      .addCase(createPassword.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(updatePassword.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(updatePassword.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.passwords = state.passwords.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload } : item
        );
        state.isEditPasswordModalOpen = false;
      })
      .addCase(updatePassword.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(deletePassword.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deletePassword.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.passwords = state.passwords.filter((item) => item.id !== action.payload);

        if (state.selectedPasswordId === action.payload) {
          const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
          const folderPasswords = state.selectedFolderId
            ? state.passwords.filter((item) => item.folderId === state.selectedFolderId)
            : state.passwords;
          state.selectedPasswordId = isDesktop && folderPasswords.length
            ? folderPasswords[0].id
            : null;
        }
      })
      .addCase(deletePassword.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchVaultTrash.pending, (state) => {
        state.trashLoading = true;
      })
      .addCase(fetchVaultTrash.fulfilled, (state, action) => {
        state.trashLoading = false;
        state.trashByVault[action.payload.vaultId] = action.payload.trash || [];
      })
      .addCase(fetchVaultTrash.rejected, (state, action) => {
        state.trashLoading = false;
        const vaultId = action.meta?.arg;
        if (vaultId) {
          state.trashByVault[vaultId] = [];
        }
      })

      .addCase(restorePassword.fulfilled, (state, action) => {
        const list = state.trashByVault[action.payload.vaultId];
        if (list) {
          state.trashByVault[action.payload.vaultId] = list.filter(
            (item) => item.id !== action.payload.passwordId
          );
        }
      })

      .addCase(purgePassword.fulfilled, (state, action) => {
        if (!action.payload?.approvalRequired) {
          const list = state.trashByVault[action.payload.vaultId];
          if (list) {
            state.trashByVault[action.payload.vaultId] = list.filter(
              (item) => item.id !== action.payload.passwordId
            );
          }
        }
      })

      .addCase(deleteFolder.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(deleteFolder.fulfilled, (state, action) => {
        state.actionLoading = false;

        state.folders = state.folders.filter(
          (folder) => folder.id !== action.payload
        );

        if (state.selectedFolderId === action.payload) {
          state.selectedFolderId = null;
        }

        state.passwords = state.passwords.filter(
          (password) => password.folderId !== action.payload
        );

        if (
          state.selectedPasswordId &&
          !state.passwords.some((item) => item.id === state.selectedPasswordId)
        ) {
          state.selectedPasswordId = state.passwords[0]?.id || null;
        }
      })
      .addCase(deleteFolder.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(shareFolderAccess.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(shareFolderAccess.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.folders = action.payload.folders;

        if (state.selectedVault) {
          state.selectedVault = {
            ...state.selectedVault,
            folders: action.payload.folders,
          };
        }
      })
      .addCase(shareFolderAccess.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchActivityLogs.pending, (state) => {
        state.activityLoading = true;
        state.error = null;
      })
      .addCase(fetchActivityLogs.fulfilled, (state, action) => {
        state.activityLoading = false;
        state.activityLogs = action.payload;
      })
      .addCase(fetchActivityLogs.rejected, (state, action) => {
        state.activityLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  selectPassword,
  openAddPasswordModal,
  closeAddPasswordModal,
  openEditPasswordModal,
  closeEditPasswordModal,
  openAddFolderModal,
  closeAddFolderModal,
  selectFolder,
  clearSelectedFolder,
  setSearchTerm,
  toggleFolderCollapse,
  clearVaultError,
  clearVaultState,
} = vaultSlice.actions;

export default vaultSlice.reducer;