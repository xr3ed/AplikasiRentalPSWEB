const memberService = require('../services/memberService');

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

module.exports = {
    getAllMembers,
    createMember: createMemberAPI,
    getMemberByPhone,
    createMemberInternal
};