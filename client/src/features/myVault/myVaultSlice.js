import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import { sharePasswordToUser } from '../sharedPasswords/sharedPasswordsSlice';

export const fetchMyVault = createAsyncThunk(
  'myVault/fetchMyVault',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/my-vault');
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to load my vault'
      );
    }
  }
);

export const createMyVaultFolder = createAsyncThunk(
  'myVault/createMyVaultFolder',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.post('/my-vault/folders', data);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to create folder'
      );
    }
  }
);

export const updateMyVaultFolder = createAsyncThunk(
  'myVault/updateMyVaultFolder',
  async ({ folderId, name }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/my-vault/folders/${folderId}`, { name });
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update folder'
      );
    }
  }
);

export const deleteMyVaultFolder = createAsyncThunk(
  'myVault/deleteMyVaultFolder',
  async (folderId, { rejectWithValue }) => {
    try {
      await api.delete(`/my-vault/folders/${folderId}`);
      return folderId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to delete folder'
      );
    }
  }
);

export const createMyVaultPassword = createAsyncThunk(
  'myVault/createMyVaultPassword',
  async (data, { rejectWithValue }) => {
    try {
      const res = await api.post('/my-vault/passwords', data);
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to create password'
      );
    }
  }
);

export const updateMyVaultPassword = createAsyncThunk(
  'myVault/updateMyVaultPassword',
  async ({ passwordId, data }, { dispatch, rejectWithValue }) => {
    try {
      const res = await api.put(`/my-vault/passwords/${passwordId}`, data);
      const updated = res.data;

      if (Array.isArray(updated?.shares) && updated.shares.length > 0) {
        for (const share of updated.shares) {
          if (share.sharedWithId) {
            dispatch(
              sharePasswordToUser({
                passwordId: updated.id,
                userId: share.sharedWithId,
                password: updated,
              })
            ).catch(() => {});
          }
        }
      }

      return updated;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update password'
      );
    }
  }
);

export const deleteMyVaultPassword = createAsyncThunk(
  'myVault/deleteMyVaultPassword',
  async (passwordId, { rejectWithValue }) => {
    try {
      await api.delete(`/my-vault/passwords/${passwordId}`);
      return passwordId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to delete password'
      );
    }
  }
);

export const fetchMyVaultTrash = createAsyncThunk(
  'myVault/fetchMyVaultTrash',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/my-vault/trash');
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to load trash'
      );
    }
  }
);

export const restoreMyVaultPassword = createAsyncThunk(
  'myVault/restoreMyVaultPassword',
  async (passwordId, { rejectWithValue }) => {
    try {
      const res = await api.post(`/my-vault/passwords/${passwordId}/restore`);
      return {
        passwordId,
        folderRestored: res.data?.folderRestored,
        folderId: res.data?.folderId,
        folderName: res.data?.folderName,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to restore password'
      );
    }
  }
);

export const purgeMyVaultPassword = createAsyncThunk(
  'myVault/purgeMyVaultPassword',
  async (passwordId, { rejectWithValue }) => {
    try {
      await api.delete(`/my-vault/passwords/${passwordId}/purge`);
      return passwordId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to permanently delete password'
      );
    }
  }
);

export const fetchMyVaultFolderTrash = createAsyncThunk(
  'myVault/fetchMyVaultFolderTrash',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/my-vault/folders/trash');
      return res.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to load folder trash'
      );
    }
  }
);

export const restoreMyVaultFolder = createAsyncThunk(
  'myVault/restoreMyVaultFolder',
  async (folderId, { rejectWithValue }) => {
    try {
      await api.post(`/my-vault/folders/${folderId}/restore`);
      return folderId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to restore folder'
      );
    }
  }
);

export const purgeMyVaultFolder = createAsyncThunk(
  'myVault/purgeMyVaultFolder',
  async (folderId, { rejectWithValue }) => {
    try {
      await api.delete(`/my-vault/folders/${folderId}/purge`);
      return folderId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to permanently delete folder'
      );
    }
  }
);

const removeEntrySubtree = (passwords, id) => {
  const idsToRemove = new Set([id]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const password of passwords) {
      if (
        !idsToRemove.has(password.id) &&
        password.parentId &&
        idsToRemove.has(password.parentId)
      ) {
        idsToRemove.add(password.id);
        changed = true;
      }
    }
  }

  return passwords.filter((password) => !idsToRemove.has(password.id));
};

const myVaultSlice = createSlice({
  name: 'myVault',

  initialState: {
    vault: null,
    folders: [],
    passwords: [],
    trash: [],
    folderTrash: [],
    selectedFolderId: null,
    loading: false,
    actionLoading: false,
    trashLoading: false,
    folderTrashLoading: false,
    error: null,
  },

  reducers: {
    setSelectedFolderId: (state, action) => {
      state.selectedFolderId = action.payload;
    },

    clearMyVaultError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchMyVault.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchMyVault.fulfilled, (state, action) => {
        state.loading = false;
        state.vault = action.payload;
        state.folders = action.payload.folders || [];
        state.passwords = action.payload.passwords || [];
      })

      .addCase(fetchMyVault.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(createMyVaultFolder.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })

      .addCase(createMyVaultFolder.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.folders.push(action.payload);
      })

      .addCase(createMyVaultFolder.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(updateMyVaultFolder.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })

      .addCase(updateMyVaultFolder.fulfilled, (state, action) => {
        state.actionLoading = false;

        state.folders = state.folders.map((folder) =>
          folder.id === action.payload.id ? action.payload : folder
        );
      })

      .addCase(updateMyVaultFolder.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(deleteMyVaultFolder.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })

      .addCase(deleteMyVaultFolder.fulfilled, (state, action) => {
        state.actionLoading = false;

        state.folders = state.folders.filter(
          (folder) => folder.id !== action.payload
        );

        state.passwords = state.passwords.filter(
          (password) => password.folderId !== action.payload
        );

        if (state.selectedFolderId === action.payload) {
          state.selectedFolderId = null;
        }
      })

      .addCase(deleteMyVaultFolder.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(createMyVaultPassword.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })

      .addCase(createMyVaultPassword.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.passwords.unshift(action.payload);
      })

      .addCase(createMyVaultPassword.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(updateMyVaultPassword.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })

      .addCase(updateMyVaultPassword.fulfilled, (state, action) => {
        state.actionLoading = false;

        state.passwords = state.passwords.map((password) =>
          password.id === action.payload.id ? action.payload : password
        );
      })

      .addCase(updateMyVaultPassword.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(deleteMyVaultPassword.pending, (state) => {
        state.actionLoading = true;
        state.error = null;
      })

      .addCase(deleteMyVaultPassword.fulfilled, (state, action) => {
        state.actionLoading = false;

        state.passwords = removeEntrySubtree(state.passwords, action.payload);
      })

      .addCase(deleteMyVaultPassword.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })

      .addCase(fetchMyVaultTrash.pending, (state) => {
        state.trashLoading = true;
        state.error = null;
      })
      .addCase(fetchMyVaultTrash.fulfilled, (state, action) => {
        state.trashLoading = false;
        state.trash = action.payload || [];
      })
      .addCase(fetchMyVaultTrash.rejected, (state, action) => {
        state.trashLoading = false;
        state.error = action.payload;
      })

      .addCase(restoreMyVaultPassword.fulfilled, (state, action) => {
        state.trash = state.trash.filter((item) => item.id !== action.payload.passwordId);
        if (action.payload.folderRestored && action.payload.folderId) {
          state.folderTrash = state.folderTrash.filter((f) => f.id !== action.payload.folderId);
        }
      })

      .addCase(purgeMyVaultPassword.fulfilled, (state, action) => {
        state.trash = state.trash.filter((item) => item.id !== action.payload);
      })

      .addCase(fetchMyVaultFolderTrash.pending, (state) => {
        state.folderTrashLoading = true;
      })
      .addCase(fetchMyVaultFolderTrash.fulfilled, (state, action) => {
        state.folderTrashLoading = false;
        state.folderTrash = action.payload || [];
      })
      .addCase(fetchMyVaultFolderTrash.rejected, (state) => {
        state.folderTrashLoading = false;
      })

      .addCase(restoreMyVaultFolder.fulfilled, (state, action) => {
        state.folderTrash = state.folderTrash.filter((f) => f.id !== action.payload);
      })

      .addCase(purgeMyVaultFolder.fulfilled, (state, action) => {
        state.folderTrash = state.folderTrash.filter((f) => f.id !== action.payload);
      });
  },
});

export const { setSelectedFolderId, clearMyVaultError } = myVaultSlice.actions;

export default myVaultSlice.reducer;