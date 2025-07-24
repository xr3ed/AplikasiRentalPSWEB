const packageService = require('../services/packageService');
const db = require('../database').getInstance();

exports.getAllPackages = async (req, res, next) => {
    try {
        const packages = await packageService.getAllPackages();
        res.json({ message: "success", data: packages });
    } catch (err) {
        next(err);
    }
};

exports.createPackage = async (req, res, next) => {
    try {
        const newPackage = await packageService.createPackage(req.body);
        res.status(201).json({ message: "success", data: newPackage });
    } catch (err) {
        next(err);
    }
};