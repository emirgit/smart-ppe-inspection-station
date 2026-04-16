const app = require('./app');
const swaggerUi = require('swagger-ui-express');
const openApiSpec = require('./docs/openapi.json');

const PORT = process.env.PORT || 5001;

// API contract and interactive API docs
app.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: 'Turnstile PPE API Docs',
  })
);

app.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
