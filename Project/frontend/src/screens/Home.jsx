import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {
  const { user } = useContext(UserContext)
  const [ isModalOpen, setIsModalOpen ] = useState(false)
  const [ projectName, setProjectName ] = useState('') // ✅ Fixed: was null
  const [ project, setProject ] = useState([])
  const navigate = useNavigate()

  function createProject(e) {
    e.preventDefault()
    console.log({ projectName })
    
    axios.post('/projects/create', {
      name: projectName,
    })
    .then((res) => {
      console.log(res)
      setIsModalOpen(false)
      setProjectName('') // ✅ Reset form
      // ✅ Add new project to the list immediately
      setProject(prevProjects => [...prevProjects, res.data])
    })
    .catch((error) => {
      console.log(error)
    })
  }

  useEffect(() => {
    axios.get('/projects/all').then((res) => {
      setProject(res.data.projects)
    }).catch(err => {
      console.log(err)
    })
  }, [])

  return (
    <main className='p-4 flex gap-3 flex-wrap'>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="project p-4 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-100"
      >
        <i className="ri-add-line text-2xl"></i>
        <p>New Project</p>
      </div>
      
      {project.map((project) => (
        <div
          key={project._id}
          onClick={() => {
            navigate(`/project`, {
              state: { project }
            })
          }}
          className="project flex flex-col gap-2 cursor-pointer p-4 border border-slate-300 rounded-md min-w-52 hover:bg-slate-200"
        >
          <h3 className="font-semibold">{project.name}</h3>
          <div className="flex items-center gap-1">
            <i className="ri-user-line"></i>
            <p className="text-sm text-gray-600">
              Collaborators: {project.users.length}
            </p>
          </div>
        </div>
      ))}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
            <form onSubmit={createProject}>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Project Name
                </label>
                <input
                  onChange={(e) => setProjectName(e.target.value)}
                  value={projectName}
                  type="text" 
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md" 
                  required 
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default Home
