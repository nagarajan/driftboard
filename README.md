# Task Board - Kanban Task Management App

A modern, drag-and-drop kanban board application built with React, TypeScript, and Tailwind CSS.

## Features

- **Multiple Boards**: Create and switch between multiple kanban boards
- **Swimlanes (Columns)**: Each board has customizable swimlanes
  - Inline editable titles
  - Drag to reorder swimlanes left/right
  - Move swimlanes between boards via menu
- **Tasks**: Create and manage tasks in each swimlane
  - Inline editable titles
  - Drag and drop between swimlanes
  - Mark as complete (turns green)
  - Delete with confirmation (if task has subtasks)
- **Subtasks**: Create nested subtasks under tasks
  - Inline editable titles
  - Mark as complete (turns green)
  - Drag between tasks
  - Drag to swimlane to promote to a full task
- **Persistence**: Data synced to Firebase Firestore (cloud) with localStorage fallback
- **Multi-User Support**: Sign in with Google to sync data across devices
  - Guest mode: Data saved locally in browser
  - Signed in: Data synced to Firebase, keyed by email address

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **@dnd-kit** - Drag and drop functionality
- **Zustand** - State management with localStorage persistence
- **Firebase Firestore** - Cloud database for persistent storage
- **Firebase Auth** - Google authentication for multi-user support
- **UUID** - Unique ID generation

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm
- A Firebase project (for cloud persistence)

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use an existing one)
3. Enable Firestore Database:
   - Go to Build -> Firestore Database
   - Click "Create database"
   - Select "Start in test mode" (for development)
   - Choose a location close to you
4. Enable Google Authentication:
   - Go to Build -> Authentication
   - Click "Get started"
   - Go to "Sign-in method" tab
   - Click on "Google" and enable it
   - Add your domain to "Authorized domains" if hosting externally
5. Update Firestore Security Rules:
   - Go to Build -> Firestore Database -> Rules tab
   - Replace the rules with:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userEmail}/taskboards/{docId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   - Click "Publish"
6. Get your Firebase config:
   - Go to Project Settings (gear icon) -> Your Apps -> Web App
   - If no web app exists, click "Add app" and select Web
   - Copy the config values

### Installation

```bash
# Navigate to the project directory
cd driving/experimental/rnagarajan/tasks

# Install dependencies
npm install

# Copy the environment template
cp .env.example .env.local

# Edit .env.local with your Firebase credentials
# Fill in the values from your Firebase project settings
```

Edit `.env.local` with your Firebase config:
```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

Then start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Create a Board**: Click the board switcher dropdown and select "Create new board"
2. **Add Swimlanes**: Click the "+ Add Swimlane" button on the right side of the board
3. **Add Tasks**: Click "+ Add Task" at the bottom of any swimlane
4. **Add Subtasks**: Click "+ Add subtask" on any task
5. **Edit Titles**: Click on any title to edit it inline
6. **Drag and Drop**:
   - Drag tasks between swimlanes
   - Drag subtasks between tasks
   - Drag subtasks to a swimlane to convert them to tasks
   - Drag swimlanes to reorder them
7. **Complete Tasks/Subtasks**: Click the checkbox to mark as complete
8. **Delete**: Click the delete icon (X or trash) on tasks/subtasks
9. **Move Swimlanes**: Click the menu (...) on a swimlane and select "Move to board"

## Project Structure

```
src/
  components/
    Board.tsx           - Main board with drag-drop context
    BoardSwitcher.tsx   - Board selection dropdown
    Swimlane.tsx        - Kanban column component
    SwimlaneMenu.tsx    - Swimlane options menu
    Task.tsx            - Task card with subtasks
    Subtask.tsx         - Subtask item
    EditableTitle.tsx   - Inline editable text
    ConfirmDialog.tsx   - Delete confirmation modal
    FontSizeSelector.tsx - UI scale selector
    GoogleAccountWidget.tsx - Google sign-in/out widget
  config/
    firebase.ts         - Firebase/Firestore/Auth initialization
  store/
    authStore.ts        - Authentication state and Google sign-in
    boardStore.ts       - Zustand store with Firestore sync
  types/
    index.ts            - TypeScript interfaces
  App.tsx               - Root component
  main.tsx              - Entry point
  index.css             - Tailwind imports
.env.example            - Environment variables template
```
