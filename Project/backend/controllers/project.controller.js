import projectModel from '../models/project.model.js';
import * as projectService from '../services/project.service.js';
import userModel from '../models/user.model.js';
import { validationResult } from 'express-validator';

export const createProject = async (req, res) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { name } = req.body;
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        const userId = loggedInUser._id;

        const newProject = await projectService.createProject({ name, userId });

        res.status(201).json(newProject);

    } catch (err) {
        console.log(err);
        res.status(400).send(err.message);
    }



}

export const getAllProject = async (req, res) => {
    try {

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })

        const allUserProjects = await projectService.getAllProjectByUserId({
            userId: loggedInUser._id
        })

        return res.status(200).json({
            projects: allUserProjects
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }
}

export const addUserToProject = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, users } = req.body

        const loggedInUser = await userModel.findOne({
            email: req.user.email
        })


        const project = await projectService.addUsersToProject({
            projectId,
            users,
            userId: loggedInUser._id
        })

        return res.status(200).json({
            project,
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }


}

export const getProjectById = async (req, res) => {

    const { projectId } = req.params;

    try {

        const project = await projectService.getProjectById({ projectId });

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

export const updateFileTree = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const { projectId, fileTree } = req.body;

        const project = await projectService.updateFileTree({
            projectId,
            fileTree
        })

        return res.status(200).json({
            project
        })

    } catch (err) {
        console.log(err)
        res.status(400).json({ error: err.message })
    }

}

export const addCollaboratorByEmail = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { projectId, email } = req.body;
        
        // Find the user by email
        const userToAdd = await userModel.findOne({ email: email.toLowerCase().trim() });
        if (!userToAdd) {
            return res.status(404).json({ error: 'User with this email not found. User must register first.' });
        }

        // Get current logged in user
        const loggedInUser = await userModel.findOne({ email: req.user.email });
        
        // Check if user is already in the project
        const existingProject = await projectModel.findOne({
            _id: projectId,
            users: userToAdd._id
        });
        
        if (existingProject) {
            return res.status(400).json({ error: 'User is already a collaborator in this project' });
        }

        // Add user to project
        const project = await projectService.addUsersToProject({
            projectId,
            users: [userToAdd._id.toString()],
            userId: loggedInUser._id
        });

        // Return updated project with populated users
        const updatedProject = await projectModel.findById(projectId).populate('users');

        return res.status(200).json({
            project: updatedProject,
            message: `Successfully added ${email} as collaborator`,
            addedUser: {
                _id: userToAdd._id,
                email: userToAdd.email
            }
        });

    } catch (err) {
        console.log('Add collaborator error:', err);
        res.status(400).json({ error: err.message });
    }
};
