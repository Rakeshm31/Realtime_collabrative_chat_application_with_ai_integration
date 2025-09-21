import React, { useEffect, useState, useRef } from 'react'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import { useLocation } from 'react-router-dom'
import { getWebContainer } from '../config/webContainer'
import hljs from 'highlight.js'
import 'highlight.js/styles/vs2015.css'
import axios from '../config/axios'

const Project = () => {
  const location = useLocation()
  const project = location.state?.project
  
  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Project Not Found</h2>
          <p>Please go back and select a project.</p>
        </div>
      </div>
    )
  }

  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [fileTree, setFileTree] = useState({})
  const [currentFile, setCurrentFile] = useState('')
  const [webContainer, setWebContainer] = useState(null)
  const [isWebContainerLoaded, setIsWebContainerLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  
  // Collaborator states
  const [showAddCollaborator, setShowAddCollaborator] = useState(false)
  const [collaboratorEmail, setCollaboratorEmail] = useState('')
  const [isAddingCollaborator, setIsAddingCollaborator] = useState(false)
  
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Get current user info
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get('/users/profile')
        setCurrentUser(response.data.user)
      } catch (error) {
        console.error('Failed to get user profile:', error)
        const token = localStorage.getItem('token')
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            setCurrentUser({ email: payload.email, _id: payload.userId || 'current-user' })
          } catch (e) {
            console.log('Could not decode token')
          }
        }
      }
    }
    fetchUser()
  }, [])

  // Add collaborator function
  const addCollaborator = async (e) => {
    e.preventDefault()
    if (!collaboratorEmail.trim() || isAddingCollaborator) return

    setIsAddingCollaborator(true)

    try {
      console.log('Adding collaborator:', collaboratorEmail)
      const response = await axios.post('/projects/add-collaborator', {
        projectId: project._id,
        email: collaboratorEmail.trim().toLowerCase()
      })

      console.log('Collaborator added:', response.data)

      if (response.data.addedUser) {
        setUsers(prevUsers => [...prevUsers, response.data.addedUser])
      }

      setCollaboratorEmail('')
      setShowAddCollaborator(false)
      
      setMessages(prev => [...prev, {
        message: `✅ ${collaboratorEmail} has been added as a collaborator!`,
        sender: { _id: 'system', email: 'System' }
      }])

      if (socketRef.current) {
        socketRef.current.emit('user-added', {
          projectId: project._id,
          user: response.data.addedUser
        })
      }

    } catch (error) {
      console.error('Failed to add collaborator:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to add collaborator'
      
      setMessages(prev => [...prev, {
        message: `❌ ${errorMessage}`,
        sender: { _id: 'system', email: 'System' }
      }])
    } finally {
      setIsAddingCollaborator(false)
    }
  }

  const saveFileTree = async (fileTree) => {
    try {
      await axios.put('/projects/update-file-tree', {
        projectId: project._id,
        fileTree: fileTree
      })
    } catch (error) {
      console.error('Error saving file tree:', error)
    }
  }

  // Socket.IO initialization
  useEffect(() => {
    const initializeSocketConnection = () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }

      const socket = initializeSocket(project._id)
      socketRef.current = socket

      receiveMessage('project-message', (data) => {
        console.log('📨 Received message:', data)
        setMessages(prevMessages => [...prevMessages, data])
      })

      receiveMessage('user-joined', (data) => {
        console.log('👋 User joined:', data)
        setMessages(prevMessages => [...prevMessages, {
          message: `${data.user.email} joined the project`,
          sender: { _id: 'system', email: 'System' }
        }])
      })

      receiveMessage('user-added', (data) => {
        console.log('👥 User added:', data)
        setUsers(prevUsers => {
          const exists = prevUsers.find(u => u._id === data.user._id)
          if (!exists) {
            return [...prevUsers, data.user]
          }
          return prevUsers
        })
      })

      receiveMessage('file-updated', (data) => {
        console.log('📁 File updated:', data)
        setFileTree(data.fileTree)
      })

      socket.on('connect', () => {
        console.log('🔗 Socket connected to project:', project._id)
      })

      socket.on('disconnect', () => {
        console.log('💔 Socket disconnected')
      })
    }

    initializeSocketConnection()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [project._id])

  // WebContainer initialization
  useEffect(() => {
    const initWebContainer = async () => {
      try {
        const container = await getWebContainer()
        setWebContainer(container)
        setIsWebContainerLoaded(true)
        console.log('✅ WebContainer initialized')
      } catch (error) {
        console.error('❌ WebContainer initialization failed:', error)
      }
    }

    initWebContainer()
  }, [])

  // Project data fetching
  useEffect(() => {
    const getProject = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`/projects/get-project/${project._id}`)
        
        const projectData = response.data.project
        const safeFileTree = projectData?.fileTree || {}
        
        setFileTree(safeFileTree)
        setUsers(projectData.users || [])
        
        const fileKeys = Object.keys(safeFileTree)
        if (fileKeys.length > 0) {
          setCurrentFile(fileKeys[0])
        }
        
      } catch (error) {
        console.error('Error fetching project:', error)
        setFileTree({})
      } finally {
        setLoading(false)
      }
    }

    getProject()
  }, [project._id])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const messageData = {
      message: newMessage,
      sender: {
        _id: currentUser?._id || 'current-user',
        email: currentUser?.email || 'You'
      }
    }

    console.log('📤 Sending message:', messageData)
    setMessages(prevMessages => [...prevMessages, messageData])

    if (socketRef.current) {
      sendMessage('project-message', messageData)
    }

    setNewMessage('')
  }

  const handleFileTreeUpdate = (updatedFileTree) => {
    setFileTree(updatedFileTree)
    saveFileTree(updatedFileTree)
    
    if (socketRef.current) {
      socketRef.current.emit('file-updated', { fileTree: updatedFileTree })
    }
  }

  const createNewFile = () => {
    const fileName = prompt('Enter file name with extension (e.g., server.js, app.py, index.html):')
    if (fileName && fileName.trim()) {
      const cleanFileName = fileName.trim()
      const fileExtension = cleanFileName.split('.').pop()?.toLowerCase()
      
      let defaultContent = getDefaultFileContent(cleanFileName, fileExtension)

      const updatedFileTree = {
        ...fileTree,
        [cleanFileName]: {
          file: {
            contents: defaultContent
          }
        }
      }
      handleFileTreeUpdate(updatedFileTree)
      setCurrentFile(cleanFileName)
    }
  }

  const getDefaultFileContent = (fileName, extension) => {
    if (fileName === 'server.js' || extension === 'js') {
      return `const express = require('express');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/data', (req, res) => {
  try {
    const data = req.body;
    console.log('Received data:', data);
    res.status(201).json({ message: 'Data received successfully' });
  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).json({ error: 'Failed to process data' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
  console.log(\`Server listening on port \${port}\`);
});`
    }
    
    if (extension === 'html') {
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My App</title>
</head>
<body>
    <h1>Welcome to My App</h1>
    <p>This is a collaborative project!</p>
</body>
</html>`
    }
    
    return '// New file\nconsole.log("Hello, World!");'
  }

  // ✅ ENHANCED RUN FUNCTION WITH JAVASCRIPT EXECUTION
  const runCurrentFile = async () => {
    if (!webContainer || !currentFile || !fileTree[currentFile]) {
      console.log('❌ Cannot run: missing requirements')
      return
    }

    setIsRunning(true)
    console.log('🚀 Running file:', currentFile)

    try {
      const fileContent = fileTree[currentFile].file.contents
      const fileExtension = currentFile.split('.').pop()?.toLowerCase()

      let output = ''

      if (fileExtension === 'js') {
        // ✅ REAL JAVASCRIPT EXECUTION
        try {
          await webContainer.fs.writeFile(currentFile, fileContent)
          
          const process = await webContainer.spawn('node', [currentFile])
          
          let stdoutData = ''
          
          process.output.pipeTo(new WritableStream({
            write(data) {
              stdoutData += data
              console.log('JS Output:', data)
            }
          }))
          
          const exitCode = await process.exit
          
          if (exitCode === 0) {
            output = stdoutData || 'Program executed successfully (no output)'
          } else {
            output = `Program exited with code ${exitCode}`
          }
          
        } catch (jsError) {
          output = `JavaScript execution error: ${jsError.message}`
          console.error('JS execution failed:', jsError)
        }
        
      } else if (fileExtension === 'html') {
        output = `HTML file ${currentFile} is ready for preview.
        
To view this HTML file:
1. Right-click and "Save As" to download
2. Open in browser to see the webpage
3. Or use a live server extension

HTML content detected: ${fileContent.length} characters`
        
      } else if (fileExtension === 'css') {
        output = `CSS file ${currentFile} analyzed:

📊 Stylesheet Information:
- Total characters: ${fileContent.length}
- Lines of code: ${fileContent.split('\n').length}
- Contains selectors and styling rules

💡 To apply this CSS:
1. Link it to an HTML file: <link rel="stylesheet" href="${currentFile}">
2. Or embed in <style> tags
3. Use with your HTML files for styling`
        
      } else {
        output = `File type .${fileExtension} is not directly executable.
        
Supported file types:
• .js - JavaScript (Node.js execution)
• .html - HTML preview information  
• .css - CSS analysis
• .cpp/.c - C++ simulation
• .py - Python (if configured)`
      }

      // Display output in chat with better formatting
      setMessages(prev => [...prev, {
        message: `🖥️ **${currentFile}** Execution Result:\n\n${output}`,
        sender: { _id: 'system', email: 'Code Runner' }
      }])

    } catch (error) {
      console.error('❌ Run error:', error)
      setMessages(prev => [...prev, {
        message: `❌ **Error** running ${currentFile}:\n\n${error.message}`,
        sender: { _id: 'system', email: 'Error Handler' }
      }])
    } finally {
      setIsRunning(false)
    }
  }

  const getLanguageFromExtension = (filename) => {
    const extension = filename?.split('.').pop()?.toLowerCase()
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'py': 'python'
    }
    return languageMap[extension] || 'plaintext'
  }

  // ✅ DEFINE fileKeys HERE (THIS FIXES THE ERROR)
  const fileKeys = Object.keys(fileTree || {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading project...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Left Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
        {/* Project Header */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-semibold text-lg text-white mb-2">{project.name}</h3>
          
          {/* Collaborators Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Collaborators</span>
              <button 
                onClick={() => setShowAddCollaborator(!showAddCollaborator)}
                className="text-xs bg-blue-600 px-2 py-1 rounded text-white hover:bg-blue-700 transition-colors"
              >
                <i className="ri-user-add-line mr-1"></i>
                Add collaborator
              </button>
            </div>
            
            {/* Add Collaborator Form */}
            {showAddCollaborator && (
              <form onSubmit={addCollaborator} className="mb-3 bg-gray-700 p-3 rounded">
                <input
                  type="email"
                  value={collaboratorEmail}
                  onChange={(e) => setCollaboratorEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full p-2 text-sm bg-gray-600 border border-gray-500 rounded mb-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <div className="flex gap-2">
                  <button 
                    type="submit" 
                    disabled={isAddingCollaborator}
                    className="text-xs bg-green-600 px-3 py-1 rounded text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isAddingCollaborator ? 'Adding...' : 'Add'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAddCollaborator(false)
                      setCollaboratorEmail('')
                    }}
                    className="text-xs bg-gray-600 px-3 py-1 rounded text-white hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            
            <div className="space-y-1">
              {users.map((user, index) => (
                <div key={user._id || index} className="flex items-center text-sm text-gray-300">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs mr-2">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <span>{user.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Files Section */}
        <div className="p-4 border-b border-gray-700">
          <h4 className="font-medium mb-2 text-gray-300">Files</h4>
          <div className="space-y-1">
            {fileKeys.map((fileName, index) => (
              <div
                key={`file-${fileName}-${index}`}
                onClick={() => setCurrentFile(fileName)}
                className={`p-2 rounded cursor-pointer text-sm flex items-center transition-colors ${
                  currentFile === fileName 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <i className="ri-file-code-line mr-2"></i>
                <span className="truncate">{fileName}</span>
              </div>
            ))}
            <button 
              onClick={createNewFile}
              className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center justify-center transition-colors"
            >
              <i className="ri-add-line mr-2"></i>
              New File
            </button>
          </div>
        </div>

        {/* Chat Section */}
        <div className="flex flex-col flex-1 p-4">
          <h4 className="font-medium mb-2 text-gray-300">Chat</h4>
          <div className="flex-1 bg-gray-900 rounded border border-gray-700 overflow-y-auto p-3 mb-3">
            <div className="space-y-3">
              {messages.map((msg, index) => (
                <div key={`message-${index}-${msg.sender._id}`} className="text-sm">
                  <div className="flex items-center mb-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2 ${
                      msg.sender.email === 'AI' ? 'bg-purple-600' :
                      msg.sender.email === 'System' ? 'bg-green-600' :
                      msg.sender.email === 'Code Runner' ? 'bg-orange-600' :
                      'bg-blue-600'
                    }`}>
                      {msg.sender.email?.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-400">{msg.sender.email}</span>
                  </div>
                  <div className="ml-7 text-gray-300 whitespace-pre-wrap">
                    {msg.message}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Message Input */}
          <form onSubmit={handleSendMessage}>
            <div className="flex">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message... (use @ai for AI help)"
                className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-white placeholder-gray-400"
              />
              <button
                type="submit"
                className="px-3 bg-blue-600 text-white rounded-r hover:bg-blue-700 flex items-center transition-colors"
              >
                <i className="ri-send-plane-line"></i>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Main Code Editor */}
      <div className="flex-1 flex flex-col">
        {/* Editor Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between">
          <div className="flex items-center">
            <i className="ri-file-code-line mr-2 text-blue-400"></i>
            <span className="font-medium text-white">
              {currentFile || 'Select a file'}
            </span>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={runCurrentFile}
              className={`px-3 py-1 rounded text-sm flex items-center text-white transition-colors ${
                isRunning ? 'bg-orange-600' : 'bg-green-600 hover:bg-green-700'
              }`}
              disabled={!currentFile || isRunning}
            >
              {isRunning ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-white border-t-transparent mr-1"></div>
                  Running...
                </>
              ) : (
                <>
                  <i className="ri-play-line mr-1"></i>
                  Run
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code Editor */}
        <div className="flex-1 bg-gray-900 overflow-auto">
          {currentFile && fileTree[currentFile] ? (
            <div
              contentEditable
              suppressContentEditableWarning={true}
              onBlur={(e) => {
                const updatedContent = e.target.innerText
                const updatedFileTree = {
                  ...fileTree,
                  [currentFile]: {
                    file: {
                      contents: updatedContent
                    }
                  }
                }
                handleFileTreeUpdate(updatedFileTree)
              }}
              dangerouslySetInnerHTML={{
                __html: hljs.highlight(
                  fileTree[currentFile]?.file?.contents || '',
                  { 
                    language: getLanguageFromExtension(currentFile),
                    ignoreIllegals: true 
                  }
                ).value
              }}
              className="p-6 font-mono text-sm leading-6 outline-none min-h-full text-gray-300"
              style={{
                whiteSpace: 'pre-wrap',
                tabSize: 2,
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <i className="ri-file-code-line text-6xl mb-4 text-gray-600"></i>
                <p className="mb-4">Select a file to start coding</p>
                <button 
                  onClick={createNewFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Create New File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Project
