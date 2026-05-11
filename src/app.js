const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const inquiryRoutes = require('./routes/inquiries');
const caseRoutes = require('./routes/cases');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const jobRoutes = require('./routes/jobs');

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: config.isProduction ? config.allowedOrigins : true,
  credentials: true,
}));

// Logging
app.use(morgan(config.isProduction ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Docs
const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use('/auth', authRoutes);
app.use('/', publicRoutes);
app.use('/inquiries', inquiryRoutes);
app.use('/cases', caseRoutes);
app.use('/users', userRoutes);
app.use('/groups', groupRoutes);
app.use('/jobs', jobRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', message: 'Эндпоинт не найден' });
});

// Error handler
app.use(errorHandler);

module.exports = app;
