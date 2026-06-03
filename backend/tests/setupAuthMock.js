jest.mock('../src/middlewares/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.admin = {
      id: 1,
      email: 'test@example.com',
      name: 'Test Admin',
    };
    next();
  },
}));
