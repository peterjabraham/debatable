# Google Cloud Firestore Setup for Great Debate

This guide explains how to set up Google Cloud Firestore for the Great Debate application.

## Prerequisites

1. A Google Cloud account
2. Node.js installed on your machine
3. Great Debate codebase cloned to your local machine

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown menu at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "greatdebate")
5. Click "Create"

## Step 2: Enable the Firestore API

1. In your new project, go to the navigation menu (☰)
2. Navigate to "Firestore"
3. Click "Create Database"
4. Choose "Start in production mode" or "Start in test mode" (for development)
5. Select a location that's close to you or your users
6. Click "Create"

## Step 3: Create a Service Account

1. In the navigation menu, go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Enter a name for your service account (e.g., "greatdebate-app")
4. Optionally add a description
5. Click "Create and Continue"
6. Assign the "Cloud Datastore User" role (this includes Firestore access)
7. Click "Continue" and then "Done"

## Step 4: Generate a Service Account Key

1. Find your service account in the list and click the three dots menu ("⋮")
2. Click "Manage keys"
3. Click "Add Key" > "Create new key"
4. Select "JSON" and click "Create"
5. A JSON key file will be downloaded to your computer

## Step 5: Configure Your Application

1. Rename the downloaded JSON key file to something recognizable (e.g., `greatdebate-credentials.json`)
2. Move the file to your project directory (but keep it outside of any public folders)
3. Update your `.env.local` file:

```
# Google Cloud Configuration
GOOGLE_APPLICATION_CREDENTIALS=path/to/your-credentials.json
GOOGLE_CLOUD_PROJECT=your-project-id
```

4. Replace `path/to/your-credentials.json` with the actual path to your JSON key file
5. Replace `your-project-id` with your Google Cloud project ID (found in the project settings)

## Step 6: Security Best Practices

1. Never commit your credentials file to version control
2. Make sure it's included in your `.gitignore` file
3. Set up proper security rules in Firestore to restrict access to your data

## Step 7: Deploy and Test

1. Restart your development server: `npm run dev`
2. Test your application to ensure Firestore connectivity

## Firestore Collection Structure

The application uses the following collections:

- `users`: Stores user profiles
- `debates`: Stores debate information
- `favorites`: Stores user favorite debates

## Troubleshooting

- If you get authentication errors, make sure your credentials file path is correct
- Ensure your service account has the proper permissions
- Check that the Firestore API is enabled in your project
- For development, you can set `USE_MOCK_DATA=true` in your `.env.local` file to use mock data 