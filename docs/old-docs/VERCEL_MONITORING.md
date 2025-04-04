# Vercel Deployment Monitoring

This feature integrates with the Vercel REST API to provide real-time monitoring of your GreatDebate application deployments directly from your admin dashboard.

## Features

- **Latest Deployment Status**: View the status of your most recent deployment
- **Deployment History**: Browse through recent deployments with status and timestamps
- **Detailed Logs**: Examine logs for each deployment to diagnose issues
- **Function Metrics**: Monitor serverless function performance (coming soon)

## Setup Instructions

### 1. Create a Vercel API Token

1. Go to your [Vercel account settings](https://vercel.com/account/tokens)
2. Click "Create" to generate a new token
3. Set the name (e.g., "GreatDebate Monitoring")
4. Select appropriate permissions (read-only is recommended)
5. Copy the generated token

### 2. Configure Environment Variables

Add the following variables to your `.env.local` file:

```
VERCEL_TOKEN=your_vercel_token_here
VERCEL_PROJECT_ID=your_project_id_here
VERCEL_TEAM_ID=your_team_id_here  # Only if using a team project
MONITORING_API_KEY=your_custom_secret_key  # Create your own secure value
NEXT_PUBLIC_MONITORING_CLIENT_KEY=your_client_side_key  # For client-side API access
```

To find your `VERCEL_PROJECT_ID`:
1. Go to your project in the Vercel dashboard
2. Click on "Settings"
3. Look for "Project ID" under the "General" section

### 3. Access the Monitoring Dashboard

Once configured, your monitoring dashboard will be available at:

```
/admin/monitoring
```

## Security Considerations

- Always keep your Vercel token secret
- Use a read-only token when possible
- The monitoring API is protected with the `MONITORING_API_KEY` to prevent unauthorized access

## API Usage

The Vercel monitoring system includes a protected API that can be used to fetch deployment data programmatically:

- `GET /api/monitoring?action=latest`: Get the latest deployment
- `GET /api/monitoring?action=deployments&limit=5`: Get recent deployments
- `GET /api/monitoring?action=logs&deploymentId=<id>`: Get logs for a specific deployment

All API requests require an `x-api-key` header matching your `MONITORING_API_KEY`.

Example API request:

```javascript
const response = await fetch('/api/monitoring?action=latest', {
  headers: {
    'x-api-key': 'your_monitoring_api_key'
  }
});
const data = await response.json();
console.log(data.deployment);
```

## Troubleshooting

If you encounter issues with the monitoring system:

1. **Missing Data**: Check that your Vercel token has sufficient permissions
2. **Authentication Errors**: Verify your environment variables are correctly set
3. **API Errors**: Check the browser console for detailed error messages

## Future Enhancements

Planned features for future releases:

- Automated alerts for failed deployments
- Email/Slack/Discord notifications
- Custom performance metrics
- Deployment comparison view

## Dependencies

This feature uses the following libraries:

- `axios`: HTTP client for API requests
- `date-fns`: Date formatting utilities
- NextAuth.js: Used for authentication and authorization

## Contributing

When contributing to the monitoring feature, please ensure that sensitive information like API keys are never hardcoded. Always use environment variables for configuration. 