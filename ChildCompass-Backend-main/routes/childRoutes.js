const express = require('express');
const Child = require('../models/child');
const router = express.Router();
const mongoose = require('mongoose');


// Register Child
router.post('/register', async (req, res) => {
    const { name, age, gender,fcm } = req.body;
    
    console.log(req.body);
    console.log(name +" "+age+" "+ gender);
    try {
        const newChild = new Child({ name, age, gender ,fcm });
        await newChild.save();

        // Include the auto-generated connection string in the response
        res.status(200).json({
            message: 'Child registered successfully',
            child: {
                id: newChild._id,
                name: newChild.name,
                age: newChild.age,
                gender: newChild.gender,
                connectionString: newChild.connectionString,
            },
        });
        
    } catch (err) {
        console.log(err.message);
        res.status(500).json({ message: err.message });
    }
});

// Get names of children by list of connectionStrings
router.post('/names-by-connection', async (req, res) => {
    const { connectionStrings } = req.body;

    if (!Array.isArray(connectionStrings)) {
        return res.status(400).json({ message: 'connectionStrings must be an array.' });
    }

    try {
        const children = await Child.find({
            connectionString: { $in: connectionStrings }
        });

        const result = {};
        connectionStrings.forEach(cs => {
            const child = children.find(c => c.connectionString === cs);
            result[cs] = child ? child.name : null; // return null if not found
        });

        res.status(200).json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



function formatTimeDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} min${remainingMinutes !== 1 ? 's' : ''}`;
    }
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
}

// Helper function to format last used time as "X hours Y mins ago"
function formatLastUsed(ms) {
    const now = Date.now();
    const diff = now - ms;
    return formatTimeDuration(diff) + ' ago';
}

// Log app usage endpoint
router.post('/logAppUsage', async (req, res) => {
    let gplay;
try {
    gplay = await import('google-play-scraper');
    // If you need the default export
    gplay = gplay.default || gplay;
} catch (err) {
    console.error('Failed to import google-play-scraper:', err);
    throw err;
}
    try {
        const { connectionString, appUsage, battery } = req.body;

        // Validate required fields
        if (!connectionString || appUsage === undefined || battery === undefined) {
            return res.status(400).json({
                success: false,
                message: 'connectionString, appUsage, and battery are required'
            });
        }

        console.log("Battery : ", battery);
        console.log("App Usage : ", appUsage);

        // Process app usage data
        // Process app usage data - filter out apps not in Play Store
        const enhancedAppUsage = [];
        
        for (const app of appUsage) {
            try {
                // Fetch app details from Google Play
                const appDetails = await gplay.app({ appId: app.packageName });
                
                enhancedAppUsage.push({
                    appName: appDetails.title,
                    imageUrl: appDetails.icon,
                    totalTimeInForeground: formatTimeDuration(app.totalTimeInForeground),
                    lastTimeUsed: formatLastUsed(app.lastTimeUsed)
                });
            } catch (error) {
                console.log(`App ${app.packageName} not found in Google Play Store - discarding`);
                // Skip this app as it's not in Play Store
                continue;
            }
        }

        // Find the child by connectionString and update their appUsage and battery
        const updatedChild = await Child.findOneAndUpdate(
            { connectionString: connectionString },
            { 
                $set: { 
                    appUseage: enhancedAppUsage, // Use the enhanced data
                    battery: battery 
                }
            },
            { new: true } // Return the updated document
        );

        if (!updatedChild) {
            return res.status(404).json({
                success: false,
                message: 'Child not found with the provided connectionString'
            });
        }

        res.status(200).json({
            success: true,
            message: 'App usage and battery updated successfully',
            child: updatedChild
        });

    } catch (error) {
        console.error('Error updating app usage:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});



// Get child's app usage and battery by ID
router.get('/childUsage/:childId', async (req, res) => {
    try {
        const { childId } = req.params;

        // Find the child by ID, selecting only the needed fields
        const child = await Child.findOne({ connectionString: childId })
            .select('appUseage battery name')
            .lean();

        if (!child) {
            return res.status(404).json({
                success: false,
                message: 'Child not found with the provided ID'
            });
        }

        console.log(child); // Moved before the response

        res.status(200).json({
            success: true,
            message: 'Child usage data retrieved successfully',
            data: {
                name: child.name,
                appUseage: child.appUseage || [],
                battery: child.battery || 0
            }
        });
    } catch (error) {
        console.error('Error fetching child usage:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});


router.get('/geofenceLocations/:childId', async (req, res) => {
    try {
        const { childId } = req.params;

        // Find the child by ID, selecting only the needed fields
        const child = await Child.findOne({ connectionString: childId })
            .select('geofenceLocations')
            .lean();

        if (!child) {
            return res.status(404).json({
                success: false,
                message: 'Child not found with the provided ID'
            });
        }

        

        res.status(200).json({
            success: true,
            message: 'Child geofenceLocations data retrieved successfully',
            data: {
                geofenceLocations: child.geofenceLocations || [],
               
            }
        });
    } catch (error) {
        console.error('Error fetching child geofenceLocations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});


// Log geofenceLocations endpoint
router.post('/addGeofence', async (req, res) => {

    try {
        const { connectionString, geofenceLocations } = req.body;

        
        

        // Find the child by connectionString and update their appUsage and battery
        const updatedChild = await Child.findOneAndUpdate(
            { connectionString: connectionString },
            { 
                $push: { 
                    geofenceLocations:   geofenceLocations  
                }
            },
            { new: true } // Return the updated document
        );
        

        if (!updatedChild) {
            return res.status(404).json({
                success: false,
                message: 'Child not found with the provided connectionString'
            });
        }

        res.status(200).json({
            success: true,
            message: 'geofenceLocations updated successfully',
            
        });

    } catch (error) {
        console.error('Error updating geofenceLocations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});


// DELETE endpoint to remove a geofence location
router.delete('/remove-geofence', async (req, res) => {
    try {
        console.log('Received request to remove geofence:', req.body);
        
        const { childConnectionString, geofence } = req.body;
        
        if (!childConnectionString || !geofence || !geofence.latitude || !geofence.longitude) {
            console.log('Validation failed - missing required fields:', {
                childConnectionString: !!childConnectionString,
                geofence: !!geofence,
                latitude: geofence?.latitude,
                longitude: geofence?.longitude
            });
            return res.status(400).json({ error: "Missing required fields" });
        }

        console.log('Attempting to remove geofence for child:', childConnectionString);
        console.log('Geofence to remove:', geofence);

        const updatedChild = await Child.findOneAndUpdate(
            { connectionString: childConnectionString },
            { 
                $pull: { 
                    geofenceLocations: { 
                        latitude: geofence.latitude,
                        longitude: geofence.longitude
                    } 
                } 
            },
            { new: true }
        );

        if (!updatedChild) {
            console.log('Child not found with connection string:', childConnectionString);
            return res.status(404).json({ error: "Child not found" });
        }

        console.log('Geofence removed successfully. Updated child:', updatedChild);
        res.status(200).json({
            message: "Geofence removed successfully"
        });
    } catch (error) {
        console.error("Error removing geofence:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
