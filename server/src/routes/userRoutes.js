const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');

const {
  getShareableUsers,
  getUsers,
  createUserByAdmin,
  updateUser,
  deleteUser,
  getUserAccessSummary,
} = require('../controllers/userController');

const router = express.Router();

router.get('/shareable', authenticate, getShareableUsers);

router.get('/', authenticate, getUsers);
router.post('/', authenticate, createUserByAdmin);
router.get('/:id/access', authenticate, getUserAccessSummary);
router.put('/:id', authenticate, updateUser);
router.delete('/:id', authenticate, deleteUser);

module.exports = router;