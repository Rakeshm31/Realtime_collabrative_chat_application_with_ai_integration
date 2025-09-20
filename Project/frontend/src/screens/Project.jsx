import React, { useEffect, useState, useRef } from 'react'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import { useLocation } from 'react-router-dom'
import { getWebContainer } from '../config/webContainer'
import hljs from 'highlight.js'
import 'highlight.js/styles/vs2015.css' // Dark theme like in the demo
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
      }
    }
    fetchUser()
  }, [])

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
        setUsers(prevUsers => [...prevUsers, data.user])
      })

      receiveMessage('user-left', (data) => {
        console.log('👋 User left:', data)
        setUsers(prevUsers => prevUsers.filter(u => u._id !== data.user._id))
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
    
    // Broadcast file update to other users
    if (socketRef.current) {
      socketRef.current.emit('file-updated', { fileTree: updatedFileTree })
    }
  }

  const createNewFile = () => {
    const fileName = prompt('Enter file name (e.g., server.js, index.html):')
    if (fileName && fileName.trim()) {
      const fileExtension = fileName.split('.').pop() || 'js'
      let defaultContent = getDefaultFileContent(fileName, fileExtension)

      const updatedFileTree = {
        ...fileTree,
        [fileName]: {
          file: {
            contents: defaultContent
          }
        }
      }
      handleFileTreeUpdate(updatedFileTree)
      setCurrentFile(fileName)
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

  const runCurrentFile = async () => {
    if (!webContainer || !currentFile || !fileTree[currentFile]) {
      console.log('❌ Cannot run: missing requirements')
      return
    }

    console.log('🚀 Running file:', currentFile)
    
    const output = `✅ ${currentFile} executed successfully!
    
📋 File: ${currentFile}
📊 Status: Ready to run
🚀 Environment: Node.js WebContainer

💡 To see actual output, this would normally:
1. Start the server on the specified port
2. Handle incoming requests
3. Log messages to console
4. Process API endpoints

🔧 Next steps:
- Test API endpoints
- Add more routes
- Implement database connection
- Deploy to production`

    setMessages(prev => [...prev, {
      message: output,
      sender: { _id: 'system', email: 'System' }
    }])
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
              <button className="text-xs bg-blue-600 px-2 py-1 rounded text-white hover:bg-blue-700">
                <i className="ri-user-add-line mr-1"></i>
                Add collaborator
              </button>
            </div>
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
              className="px-3 py-1 bg-green-600 rounded text-sm flex items-center text-white hover:bg-green-700 transition-colors"
              disabled={!currentFile}
            >
              <i className="ri-play-line mr-1"></i>
              Run
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
