const express = require('express');
const Parent = require('../models/parent');
const Child = require('../models/child');
const Task = require('../models/task');
const router = express.Router();


router.post('/add', async (req, res) => {
  console.log('➡️ Received task:', req.body);
 

  try {
    const { targetChildID, title, datetime, priority, parentEmail } = req.body;
    const completed = false;

    console.log('Received datetime:', datetime);
    console.log('Type of datetime:', typeof datetime);
    const parsedDate = new Date(datetime);
    console.log('Parsed datetime:', parsedDate);
    console.log('ISO String:', parsedDate.toISOString());
    console.log('Valid date check:', !isNaN(parsedDate.getTime()));
  
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid datetime format'
      });
    }


    const child = await Child.findOne({ connectionString: targetChildID });

    if (!child) {
      return res.status(404).json({
        success: false,
        message: 'Child not found with the given connection string'
      });
    }

    const task = new Task({
      title,
      datetime: new Date(datetime),
      priority,
      parentEmail,
      connectionString: targetChildID,
      completed
    });

    await task.save();

    console.log('✅ Task saved:', task);
    res.status(201).json({ 
      success: true,
      message: 'Task created successfully',
      task: task
    });

  } catch (err) {
    console.error('❌ Task creation error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create task',
      error: err.message 
    });
  }
});


router.get('/task', async (req, res) => {
  const { connectionString } = req.query;

  if (!connectionString) {
    return res.status(400).json({ message: 'Missing connectionString' });
  }

  try {
    const tasks = await Task.find({ connectionString, completed: false })
      .select('title priority datetime completed') // Select specific fields
      .lean();

    // Filter out invalid tasks and format datetime
    const validTasks = tasks
      .filter(task =>
        task.title &&
        task.datetime &&
        !isNaN(new Date(task.datetime).getTime())
      )
      .map(task => ({
        ...task,
        datetime: new Date(task.datetime).toISOString()
      }));

    res.status(200).json(validTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/completed-tasks', async (req, res) => {
  try {
    const { connectionString } = req.query;

    if (!connectionString) {
      return res.status(400).json({ error: 'Connection string is required' });
    }

    // Fetch completed tasks from parent
    const tasks = await Task.find({
      from: 'parent',
      completed: true,
      connectionString: connectionString,
    });

    // Return the tasks in the format required
    const formattedTasks = tasks.map(task => ({
      _id: task._id,
      title: task.title,
      priority: task.priority,
      datetime: task.datetime,
      from: 'parent',
      completed: true,
      connectionString: task.connectionString,
    }));

    return res.status(200).json(formattedTasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.get('/incompleted-tasks', async (req, res) => {
  try {
    const { connectionString } = req.query;

    if (!connectionString) {
      return res.status(400).json({ error: 'Connection string is required' });
    }

    // Fetch completed tasks from parent
    const tasks = await Task.find({
      from: 'parent',
      completed: true,
      connectionString: connectionString,
    });

    // Return the tasks in the format required
    const formattedTasks = tasks.map(task => ({
      _id: task._id,
      title: task.title,
      priority: task.priority,
      datetime: task.datetime,
      from: 'parent',
      completed: false,
      connectionString: task.connectionString,
    }));

    return res.status(200).json(formattedTasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
})

// Endpoint
router.patch('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { completed, connectionString } = req.body;

    // Validate input
    if (typeof completed !== 'boolean' || !connectionString) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request data' 
      });
    }

    // Find and update the task
    const updatedTask = await Task.findOneAndUpdate(
      { 
        _id: taskId,
        connectionString: connectionString 
      },
      { completed },
      { new: true } // Return the updated document
    );

    if (!updatedTask) {
      return res.status(404).json({ 
        success: false,
        message: 'Task not found or connection string mismatch' 
      });
    }

    res.status(200).json({
      success: true,
      task: updatedTask
    });

  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});


// Example route: GET /tasks/:parentEmail
router.get('/:parentEmail/:connectionString', async (req, res) => {
  try {
    const tasks = await Task.find({
      parentEmail: req.params.parentEmail,
      connectionString: req.params.connectionString // or connectionString if that's your field name
    });
    res.status(200).json({ tasks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

  
module.exports = router;