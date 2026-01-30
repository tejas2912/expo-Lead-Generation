const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    console.log('🔍 Validation - Request body:', req.body);
    const { error, value } = schema.validate(req.body);
    if (error) {
      console.log('🔍 Validation error:', error.details);
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    console.log('🔍 Validation passed:', value);
    req.body = value; // Use validated values
    next();
  };
};

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registerUserSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  full_name: Joi.string().min(2).max(200).required(),
  phone: Joi.string().max(50).optional(),
  role: Joi.string().valid('platform_admin', 'company_admin', 'employee').required(),
  company_id: Joi.string().uuid().when('role', {
    is: 'platform_admin',
    then: Joi.optional(),
    otherwise: Joi.required()
  })
});

const createVisitorSchema = Joi.object({
  phone: Joi.string().max(50).required(),
  full_name: Joi.string().max(200).optional(),
  email: Joi.string().email().optional(),
  organization: Joi.string().max(200).optional(),
  designation: Joi.string().max(200).optional(),
  city: Joi.string().max(120).optional(),
  country: Joi.string().max(120).optional(),
  interests: Joi.string().valid('Hot', 'Warm', 'Cold', '').optional()
});

const createLeadSchema = Joi.object({
  visitor_id: Joi.string().uuid().allow(null, '').optional(),
  phone: Joi.string().max(50).when('visitor_id', {
    is: Joi.string().empty(''),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  full_name: Joi.string().max(200).when('visitor_id', {
    is: Joi.string().empty(''),
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  email: Joi.string().email({ tlds: { allow: false } }).optional().allow(''),
  organization: Joi.string().max(200).optional(),
  designation: Joi.string().max(200).optional(),
  city: Joi.string().max(120).optional(),
  country: Joi.string().max(120).optional(),
  interests: Joi.string().valid('Hot', 'Warm', 'Cold', '').optional(),
  notes: Joi.string().optional(),
  follow_up_date: Joi.date().optional().allow('')
  // priority: Joi.string().valid('high', 'medium', 'low').optional(), // Temporarily removed
  // tags: Joi.string().optional() // Temporarily removed
}).custom((value, helpers) => {
  // Convert empty visitor_id to undefined for proper processing
  if (value.visitor_id === '') {
    value.visitor_id = undefined;
  }
  // Convert empty follow_up_date to undefined for proper processing
  if (value.follow_up_date === '') {
    value.follow_up_date = undefined;
  }
  return value;
});

const createCompanySchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  contact_email: Joi.string().email().optional(),
  contact_phone: Joi.string().max(50).optional(),
  company_code: Joi.string().max(20).optional()
});

const updateLeadSchema = Joi.object({
  organization: Joi.string().max(200).optional(),
  designation: Joi.string().max(200).optional(),
  city: Joi.string().max(120).optional(),
  country: Joi.string().max(120).optional(),
  interests: Joi.string().valid('Hot', 'Warm', 'Cold', '').optional(),
  notes: Joi.string().optional(),
  follow_up_date: Joi.date().optional().allow('')
}).custom((value, helpers) => {
  // Convert empty follow_up_date to undefined for proper processing
  if (value.follow_up_date === '') {
    value.follow_up_date = undefined;
  }
  return value;
});

const createCompanyAdminSchema = Joi.object({
  full_name: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(20).allow('').optional(),
  password: Joi.string().min(6).max(100).required(),
  company_id: Joi.string().uuid().required()
});

const updateUserSchema = Joi.object({
  full_name: Joi.string().min(2).max(200).optional(),
  email: Joi.string().email().optional(),
  phone: Joi.string().max(20).optional(),
  role: Joi.string().optional(),
  company_id: Joi.string().uuid().optional()
});

module.exports = {
  validateRequest,
  loginSchema,
  registerUserSchema,
  createVisitorSchema,
  createLeadSchema,
  createCompanySchema,
  updateLeadSchema,
  createCompanyAdminSchema,
  updateUserSchema
};
