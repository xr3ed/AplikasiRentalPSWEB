const { body, validationResult } = require('express-validator');

const validateTv = [
    body('name').notEmpty().withMessage('Nama tidak boleh kosong'),
    body('status').isIn(['on', 'off']).withMessage('Status harus on atau off'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validateTvStatus = [
    body('status').isIn(['on', 'off']).withMessage('Status harus on atau off'),
    body('package_id').optional().isInt({ min: 1 }).withMessage('Package ID tidak valid'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validateStatus = [
    body('status').isIn(['on', 'off']).withMessage('Status harus on atau off'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validateMember = [
    body('name').notEmpty().withMessage('Nama tidak boleh kosong'),
    body('phone_number').isMobilePhone('id-ID').withMessage('Nomor telepon tidak valid'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

const validatePackage = [
    body('name').notEmpty().withMessage('Nama paket tidak boleh kosong'),
    body('duration_minutes').isInt({ min: 1 }).withMessage('Durasi harus angka positif'),
    body('price').isFloat({ min: 0 }).withMessage('Harga tidak valid'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

module.exports = { validateTv, validateStatus, validateMember, validatePackage, validateTvStatus };