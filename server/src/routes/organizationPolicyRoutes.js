const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/authMiddleware');
const organizationPolicyController = require('../controllers/organizationPolicyController');

router.get('/', authenticate, organizationPolicyController.getOrganizationPolicy);
router.put('/', authenticate, organizationPolicyController.updateOrganizationPolicy);

module.exports = router;
