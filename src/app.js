// src/app.js
const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
// Structured logging for containers
const winston = require('winston')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
})

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB connection
// mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/todoapp', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/todoapp')

// Todo Schema
const todoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

const Todo = mongoose.model('Todo', todoSchema)

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  })
})

app.get('/api/todos', async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 })
    res.json(todos)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/todos', async (req, res) => {
  try {
    const todo = new Todo({
      title: req.body.title,
      completed: req.body.completed || false
    })
    const savedTodo = await todo.save()
    res.status(201).json(savedTodo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.put('/api/todos/:id', async (req, res) => {
  try {
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    )
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' })
    }
    res.json(todo)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

app.delete('/api/todos/:id', async (req, res) => {
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id)
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' })
    }
    res.json({ message: 'Todo deleted successfully' })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.message)
  res.status(500).json({ error: 'Internal server error' })
})

// START SERVER (ВАЖНО: перед SIGTERM)
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    env: process.env.NODE_ENV
  })
})

// graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received')

  server.close(async () => {
    await mongoose.connection.close()
    logger.info('MongoDB closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => process.emit('SIGTERM'))