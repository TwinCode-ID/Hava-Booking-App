const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    try {
        let token = req.headers.authorization;

        if(token && token.startsWith("Bearer")){
            token = token.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select("-password");
            next();
        } else {
            res.status(401).json({message: "Token failed", error: error.message});
        }
    } catch (err) {
        res.status(401).json({message: "Token failed", error: error.message})
    }
}

const studioAdmin = async (req, res, next) => {
    if (!req.user || req.user.role !== 'studioAdmin') {
       if (!req.user || req.user.role !== 'devTeam') {
        return res.status(403).json({message: "Unauthorized user"});
        }
    }
    next();
};

const devTeam = async (req, res, next) => {
    if (!req.user || req.user.role !== 'devTeam') {
        return res.status(403).json({message: "Unauthorized user"});
    }
    next();
};


module.exports = {protect, studioAdmin, devTeam}