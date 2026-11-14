import { FileSystemNode, FileType } from './types';

export const INITIAL_FILES: FileSystemNode[] = [
  {
    id: 'root',
    name: 'project-root',
    type: FileType.FOLDER,
    isOpen: true,
    children: [
      {
        id: 'src',
        name: 'src',
        type: FileType.FOLDER,
        isOpen: true,
        children: [
          {
            id: 'App.tsx',
            name: 'App.tsx',
            type: FileType.FILE,
            language: 'typescript',
            content: `import React from 'react';
import './styles.css';

export default function App() {
  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}`
          },
          {
            id: 'index.tsx',
            name: 'index.tsx',
            type: FileType.FILE,
            language: 'typescript',
            content: `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
          },
          {
            id: 'utils.ts',
            name: 'utils.ts',
            type: FileType.FILE,
            language: 'typescript',
            content: `export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US').format(date);
};`
          }
        ]
      },
      {
        id: 'public',
        name: 'public',
        type: FileType.FOLDER,
        isOpen: false,
        children: [
          {
            id: 'index.html',
            name: 'index.html',
            type: FileType.FILE,
            language: 'html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>React App</title>
</head>
<body>
	<div id="root"></div>
</body>
</html>`
          }
        ]
      },
      {
        id: 'package.json',
        name: 'package.json',
        type: FileType.FILE,
        language: 'json',
        content: `{
  "name": "react-typescript",
  "version": "1.0.0",
  "description": "React and TypeScript example starter project",
  "keywords": [
    "typescript",
    "react",
    "starter"
  ],
  "dependencies": {
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "react-scripts": "5.0.1"
  }
}`
      },
      {
        id: 'styles.css',
        name: 'styles.css',
        type: FileType.FILE,
        language: 'css',
        content: `.App {
  font-family: sans-serif;
  text-align: center;
}

h1 {
  color: #333;
}
`
      }
    ]
  }
];