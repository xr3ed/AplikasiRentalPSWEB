const memberService = require('../services/memberService');
const db = require('../database').getInstance();

const getAllMembers = async (req, res, next) => {
    try {
        const members = await memberService.getAllMembers();
        res.json({ message: "success", data: members });
    } catch (err) {
        next(err);
    }
};

const createMemberAPI = async (req, res, next) => {
    try {
        const { name, phone_number } = req.body;
        const newMember = await memberService.createMember({ name, phone: phone_number });
        res.status(201).json({ message: "success", data: newMember });
    } catch (err) {
        next(err);
    }
};

// Fungsi ini diekspor untuk digunakan oleh whatsapp.js
const getMemberByPhone = async (phone) => {
    return await memberService.getMemberByPhone(phone);
};

// Fungsi ini diekspor untuk digunakan oleh whatsapp.js
const createMemberInternal = async (memberData) => {
    return await memberService.createMember(memberData);
};

const getMemberById = async (req, res, next) => {
    try {
        const member = await memberService.getMemberById(req.params.id);
        if (!member) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json({ message: "success", data: member });
    } catch (err) {
        next(err);
    }
};

const updateMember = async (req, res, next) => {
    try {
        const { name, phone_number } = req.body;
        const updatedMember = await memberService.updateMember(req.params.id, { name, phone_number });
        if (!updatedMember) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json({ message: "success", data: updatedMember });
    } catch (err) {
        next(err);
    }
};

const deleteMember = async (req, res, next) => {
    try {
        const result = await memberService.deleteMember(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json({ message: 'Member deleted successfully' });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllMembers,
    createMember: createMemberAPI,
    getMemberByPhone,
    createMemberInternal,
    getMemberById,
    updateMember,
    deleteMember
};