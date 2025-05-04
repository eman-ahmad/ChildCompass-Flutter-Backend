const mongoose = require('mongoose');

const ChildSchema = new mongoose.Schema({
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, enum: ['boy', 'girl'], required: true },
    connectionString: { type: String, unique: true },
    appUseage :{ type:[mongoose.Schema.Types.Mixed], default: []},
    battery:{type:Number , default:100},
    geofenceLocations :{ type:[mongoose.Schema.Types.Mixed], default: []},
    fcm: { type: String, default:'' },
    
});

// Generate a 4-digit alphanumeric connection string
ChildSchema.pre('save', function (next) {
    if (!this.connectionString) {
        this.connectionString = Math.random().toString(36).substring(2, 6).toUpperCase();
    }
    next();
});

module.exports = mongoose.model('Child', ChildSchema);
