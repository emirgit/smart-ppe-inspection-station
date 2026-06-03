const { requireFields } = require('../src/middlewares/validate');
const errorHandler = require('../src/middlewares/errorHandler');

// ─── requireFields Middleware ────────────────────────────
describe('requireFields middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { body: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call next() when all required fields are present', () => {
    mockReq.body = { name: 'John', email: 'john@example.com' };
    const middleware = requireFields(['name', 'email']);

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 422 when a required field is missing', () => {
    mockReq.body = { name: 'John' };
    const middleware = requireFields(['name', 'email']);

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 422,
          message: 'email is required',
        }),
      })
    );
  });

  it('should return 422 when a required field is null', () => {
    mockReq.body = { name: null };
    const middleware = requireFields(['name']);

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(422);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'name is required',
        }),
      })
    );
  });

  it('should return 422 when a required field is empty string', () => {
    mockReq.body = { name: '' };
    const middleware = requireFields(['name']);

    middleware(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(422);
  });

  it('should call next() when no fields are required', () => {
    const middleware = requireFields([]);

    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

// ─── errorHandler Middleware ─────────────────────────────
describe('errorHandler middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should return 500 with error message for unhandled errors', () => {
    const err = new Error('Something broke');

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 500,
          message: 'Something broke',
        }),
      })
    );
  });

  it('should use err.statusCode if set', () => {
    const err = new Error('Not Found');
    err.statusCode = 404;

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 404 }),
      })
    );
  });

  it('should use res.statusCode if it was already set to non-200', () => {
    mockRes.statusCode = 400;
    const err = new Error('Bad Request');

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('should default message to "Internal server error" when not provided', () => {
    const err = {};

    errorHandler(err, mockReq, mockRes, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Internal server error',
        }),
      })
    );
  });
});
