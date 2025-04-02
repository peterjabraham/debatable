# Vercel Monitoring Dashboard

This dashboard provides real-time monitoring of your Vercel deployments, including deployment status, logs, and system health.

## Features

- **Deployment Status**: View the current status of your latest deployment
- **Deployment List**: See a list of recent deployments with their status
- **Deployment Logs**: View detailed logs for each deployment
- **API Performance**: Monitor your API routes performance with metrics like response time and error rates
- **Auto-refresh**: Dashboard can automatically refresh to show the latest data

## Setup

### 1. Set up environment variables

Create or update your `.env.local` file with the following variables:

```
# Vercel API access
NEXT_PUBLIC_VERCEL_TOKEN=your_vercel_token
NEXT_PUBLIC_VERCEL_TEAM_ID=your_team_id (optional)
NEXT_PUBLIC_VERCEL_PROJECT_ID=your_project_id

# Monitoring API key (used to secure the monitoring endpoints)
MONITORING_API_KEY=your_monitoring_api_key
NEXT_PUBLIC_MONITORING_API_KEY=your_monitoring_api_key
```

### 2. Get your Vercel API token

1. Go to [Vercel account settings](https://vercel.com/account/tokens)
2. Create a new token with the appropriate permissions:
   - Read deployments
   - Read projects
   - Read team information (if using a team)
   - Read metrics and analytics
3. Copy the token and set it as `NEXT_PUBLIC_VERCEL_TOKEN` in your `.env.local` file

### 3. Get your project ID

1. Go to your project in the Vercel dashboard
2. Open project settings
3. Find the Project ID in the settings page
4. Copy the ID and set it as `NEXT_PUBLIC_VERCEL_PROJECT_ID` in your `.env.local` file

### 4. Get your team ID (optional)

If your project is part of a team:

1. Go to the team settings in Vercel
2. Find the Team ID
3. Copy the ID and set it as `NEXT_PUBLIC_VERCEL_TEAM_ID` in your `.env.local` file

## Usage

Access the monitoring dashboard at `/admin/monitoring`.

### Monitoring API Performance

The API Performance tab shows metrics for your API routes, including:

- **Invocations**: Number of times each API route has been called
- **Average Duration**: Average response time in milliseconds
- **p90**: 90th percentile response time (90% of requests are faster than this)
- **Errors**: Number of errors and error rate

You can:
- Sort metrics by clicking on column headers
- Enable auto-refresh to keep the metrics up to date
- See the most important API performance issues at a glance

#### Instrumenting Your API Routes

To collect performance metrics from your API routes, use the `trackApiMetrics` wrapper function:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { trackApiMetrics } from '@/lib/monitoring/api-metrics';

export async function GET(req: NextRequest) {
  return trackApiMetrics(req, '/api/your/route/path', async () => {
    // Your API route logic here
    return NextResponse.json({ success: true });
  });
}
```

#### Generating Test Traffic

For testing the API metrics functionality, you can use the included traffic generator:

```bash
curl -X GET "http://localhost:3000/api/monitoring/generate-traffic?count=20" -H "x-api-key: your_monitoring_api_key"
```

This will send multiple requests to the demo API endpoint with various response times and error rates to populate your metrics dashboard.

## Development vs Production

The dashboard includes a mock data mode that is enabled by default in development and when no Vercel token is provided. This allows you to work on the dashboard without needing real API credentials.

When `NEXT_PUBLIC_VERCEL_TOKEN` is set, the dashboard will connect to the real Vercel API.

> **Note**: The API performance monitoring uses mock data by default, as Vercel currently doesn't have a public API for serverless function metrics at the route level. In the future, when Vercel adds support for this, the implementation can be updated to use real data.

## Customization

### Refresh Intervals

You can customize the refresh intervals by modifying the following files:

- `src/lib/vercel/hooks.ts`: Contains the refresh intervals for different data types
- `src/components/monitoring/DeploymentLogs.tsx`: Contains the auto-refresh toggle for logs
- `src/components/monitoring/ApiPerformance.tsx`: Contains the auto-refresh toggle for API metrics

### Styling

The dashboard uses Tailwind CSS for styling. You can customize the look and feel by modifying the components in the `src/components/monitoring` directory.

## Security Considerations

- The Vercel API token has read access to your project data. Keep it secure.
- Use environment variables to store sensitive information.
- Consider implementing authentication for the monitoring dashboard to restrict access.
- The monitoring API key should be kept secure and only shared with authorized personnel.

## Troubleshooting

If you encounter issues:

1. Check that your environment variables are correctly set
2. Verify that your Vercel API token has the correct permissions
3. Check the browser console for any API errors
4. Review server logs for any backend errors in the API metrics collection

## Example .env.local File

```
# Vercel API access
NEXT_PUBLIC_VERCEL_TOKEN=tlp_AbC123XyZ456
NEXT_PUBLIC_VERCEL_TEAM_ID=team_AbCdEfGhIjKl
NEXT_PUBLIC_VERCEL_PROJECT_ID=prj_123456789

# Monitoring API key
MONITORING_API_KEY=mon_test_key_123456
NEXT_PUBLIC_MONITORING_API_KEY=mon_test_key_123456
``` 