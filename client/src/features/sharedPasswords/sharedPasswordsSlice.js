import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../services/api';
import {
  decryptText,
  decryptFields,
  generateItemAesKey,
  encryptValueWithAesKey,
  encryptFieldsWithAesKey,
  rsaEncrypt,
} from '../../utils/crypto';
import { getMasterPassword, getRsaPrivateKey } from '../../utils/secureSession';

export const fetchSharedWithMe = createAsyncThunk(
  'sharedPasswords/fetchSharedWithMe',
  async (_, thunkAPI) => {
    try {
      const response = await api.get('/password-shares/shared-with-me');
      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to load shared passwords'
      );
    }
  }
);

export const sharePasswordToUser = createAsyncThunk(
  'sharedPasswords/sharePasswordToUser',
  async ({ passwordId, userId, password }, thunkAPI) => {
    try {
      const masterPassword = getMasterPassword();
      const rsaPrivateKey = getRsaPrivateKey();

      if (!masterPassword || !rsaPrivateKey) {
        return thunkAPI.rejectWithValue(
          'Your encryption keys are not ready. Please unlock your vault (re-enter your master password) and share again.'
        );
      }

      let encryptedItemKey = null;
      let reEncryptedPassword = null;
      let reEncryptedNote = null;
      let reEncryptedFields = null;

      try {
        const recipientKeyRes = await api.get(`/keypair/${userId}/public`);
        const recipientPublicKey = recipientKeyRes.data.publicKey;

        if (!recipientPublicKey) {
          return thunkAPI.rejectWithValue(
            "The recipient hasn't set up encryption keys yet. Ask them to log in and set their master password first."
          );
        }

        const salt = thunkAPI.getState().auth.user?.encryptionSalt;
        const { aesKeyJwk } = await generateItemAesKey();
        encryptedItemKey = await rsaEncrypt(aesKeyJwk, recipientPublicKey);

        if (password.encryptedPassword) {
          const decryptedPassword = await decryptText(
            password.encryptedPassword,
            masterPassword,
            salt
          );
          if (decryptedPassword) {
            reEncryptedPassword = await encryptValueWithAesKey(
              decryptedPassword,
              aesKeyJwk
            );
          }
        }

        if (password.encryptedNote) {
          const decryptedNote = await decryptText(
            password.encryptedNote,
            masterPassword,
            salt
          );
          if (decryptedNote) {
            reEncryptedNote = await encryptValueWithAesKey(
              decryptedNote,
              aesKeyJwk
            );
          }
        }

        if (password.encryptedFields) {
          const decryptedFields = await decryptFields(
            password.encryptedFields,
            masterPassword,
            salt
          );
          if (decryptedFields) {
            reEncryptedFields = await encryptFieldsWithAesKey(
              decryptedFields,
              aesKeyJwk
            );
          }
        }

        if (
          !encryptedItemKey ||
          (!reEncryptedPassword && !reEncryptedNote && !reEncryptedFields)
        ) {
          return thunkAPI.rejectWithValue(
            'Failed to encrypt this item for the recipient. Share not created.'
          );
        }
      } catch (err) {
        console.error('Share re-encryption failed:', err);
        return thunkAPI.rejectWithValue(
          'Failed to encrypt this item for the recipient. Share not created.'
        );
      }

      const response = await api.post(`/password-shares/${passwordId}/share`, {
        userId,
        encryptedItemKey,
        reEncryptedPassword,
        reEncryptedNote,
        reEncryptedFields,
      });

      return response.data;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to share password'
      );
    }
  }
);

export const removePasswordShare = createAsyncThunk(
  'sharedPasswords/removePasswordShare',
  async (shareId, thunkAPI) => {
    try {
      await api.delete(`/password-shares/${shareId}`);
      return shareId;
    } catch (error) {
      return thunkAPI.rejectWithValue(
        error.response?.data?.message || 'Failed to remove share'
      );
    }
  }
);

const sharedPasswordsSlice = createSlice({
  name: 'sharedPasswords',

  initialState: {
    sharedWithMe: [],
    userEncryptionSalt: null,
    userKeyPair: null,
    loading: false,
    error: null,

    sharing: false,
    shareError: null,

    removing: false,
    removeError: null,
  },

  reducers: {
    clearShareError: (state) => {
      state.shareError = null;
      state.removeError = null;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(fetchSharedWithMe.pending, (state) => {
        state.loading = true;
        state.error = null;
      })

      .addCase(fetchSharedWithMe.fulfilled, (state, action) => {
        state.loading = false;
        state.sharedWithMe = action.payload.sharedPasswords || [];
        state.userEncryptionSalt = action.payload.userEncryptionSalt || null;
        state.userKeyPair = action.payload.userKeyPair || null;
      })

      .addCase(fetchSharedWithMe.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      .addCase(sharePasswordToUser.pending, (state) => {
        state.sharing = true;
        state.shareError = null;
      })

      .addCase(sharePasswordToUser.fulfilled, (state) => {
        state.sharing = false;
      })

      .addCase(sharePasswordToUser.rejected, (state, action) => {
        state.sharing = false;
        state.shareError = action.payload;
      })

      .addCase(removePasswordShare.pending, (state) => {
        state.removing = true;
        state.removeError = null;
      })

      .addCase(removePasswordShare.fulfilled, (state, action) => {
        state.removing = false;

        state.sharedWithMe = state.sharedWithMe.filter(
          (item) => item.id !== action.payload
        );
      })

      .addCase(removePasswordShare.rejected, (state, action) => {
        state.removing = false;
        state.removeError = action.payload;
      });
  },
});

export const { clearShareError } = sharedPasswordsSlice.actions;

export default sharedPasswordsSlice.reducer;
