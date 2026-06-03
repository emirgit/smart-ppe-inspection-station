const express = require('express');
const router = express.Router();
const { requireFields } = require('../middlewares/validate');
const { authenticate } = require('../middlewares/auth.middleware');
const { signUp, login, getMe } = require('../controllers/auth.controller');

router.post('/signup', requireFields(['email', 'password', 'name']), signUp);
router.post('/login', requireFields(['email', 'password']), login);
router.get('/me', authenticate, getMe);

module.exports = router;
