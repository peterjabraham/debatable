# Project Status

## Completed Features

### Core Debate Functionality
- ✅ Topic input and expert selection
- ✅ Expert response generation using GPT-4o
- ✅ User perspective input
- ✅ Dynamic expert responses to user input
- ✅ Cost tracking for API usage
- ✅ Mock implementation for testing without API key
- ✅ LangChain integration for enhanced debate logic
- ✅ Background knowledge retrieval for experts
- ✅ Context management for multi-turn debates
- ✅ Simulated "thinking" for more natural response timing

### Voice Features
- ✅ Voice synthesis for expert responses using ElevenLabs
- ✅ Voice toggle option
- ✅ Individual play/stop controls for each response
- ✅ Audio caching to prevent unnecessary regeneration
- ✅ Loading state indication during voice generation
- ✅ Speech-to-text for user input via microphone

### UI/UX Improvements
- ✅ Dark/Light theme support
- ✅ Responsive design for all screen sizes
- ✅ Expert profile cards with stance indicators
- ✅ Message bubbles with expert information
- ✅ Loading states and animations
- ✅ Debate summary feature with key points extraction
- ✅ Token usage and cost display
- ✅ Interactive microphone button with visual feedback
- ✅ Rebranded to "Debate-able"
- ✅ "Thinking" indicator for experts during response generation
- ✅ Improved notification positioning and styling
- ✅ Simplified content uploader with streamlined options
- ✅ Quick access to sample topics for testing

## Pending Features

### Core Functionality
- [ ] Save/Load debate sessions
- [ ] Export debate transcripts
- [ ] Multiple debate formats (1v1, panel, etc.)
- [ ] Custom expert selection
- [ ] Citation support for expert claims
- [ ] Enhanced fact-checking with external API integration

### Voice Enhancements
- [✅] Voice input for user perspective
- [ ] Voice emotion/tone control
- [ ] Multiple voice options per expert
- [ ] Background music/ambiance option
- [ ] Voice speed control

### UI/UX Enhancements
- [ ] Progress tracking for debate stages
- [ ] Interactive timeline view
- [ ] Expert credibility scores
- [ ] Real-time fact-checking
- [ ] Social sharing features
- [ ] Debate statistics and analytics

### Advanced Features
- [ ] Multi-user debate support
- [ ] Real-time collaborative debates
- [ ] Integration with research databases
- [ ] Custom expert persona creation
- [ ] Debate scoring system
- [ ] Learning mode with explanations
- [ ] Knowledge graph visualization

### Technical Improvements
- [✅] Optimize API usage with model selection (gpt-4o)
- [ ] Implement rate limiting
- [✅] Add comprehensive error handling for API keys
- [ ] Improve voice synthesis quality
- [ ] Add unit and integration tests
- [✅] Implement caching strategy for mock responses
- [ ] Add analytics tracking

## Known Issues
- Voice synthesis occasionally takes longer than expected
- Need to improve key points extraction accuracy
- API server explicitly disabled - using built-in Next.js API routes
- Port 3000 conflicts requiring fallback to 3001
- ~~Mobile responsiveness can be enhanced~~ (Improved with UI simplification)
- ~~Dark mode contrast needs adjustment in some areas~~ (Fixed with notification styling updates)
- ~~Notification positioning interfering with navigation elements~~ (Fixed with z-index and margin adjustments)
- ~~Project-based OpenAI API keys may not work correctly~~
- ~~API connectivity issues causing experts not to load properly~~

## Recent Changes
- Resolved OpenAI integration issues:
  - Updated environment configuration for API access
  - Added proper error handling for API responses
  - Implemented fallback to mock data when API is unavailable
  - Fixed API server configuration to use built-in Next.js routes
  - Added comprehensive logging for API interactions
- Resolved natural package dependency issues:
  - Removed natural package dependency
  - Implemented lightweight string-similarity for text comparison
  - Added custom TF-IDF implementation
  - Enhanced topic extraction with simplified approach
- Fixed build issues related to API configuration:
  - Updated environment variables for API control
  - Implemented proper API server availability checks
  - Added fallback mechanisms for API failures
  - Enhanced error handling in API routes
- Enhanced debugging and monitoring:
  - Added environment variable tracking
  - Improved error logging
  - Added API response monitoring
  - Enhanced debug output for API interactions

## Current Architecture

### Frontend
- Next.js 15 with TailwindCSS for UI
- Zustand for state management
- Components for debate panel, expert cards, message bubbles
- ThinkingIndicator component for visualization of AI processing

### Backend
- Next.js API routes for serverless functions
- OpenAI integration with GPT-4o for core responses
- LangChain for agent-based operations:
  - Knowledge retrieval agents
  - Fact-checking functionality
  - Context management
  - Using modular package structure (@langchain/core, @langchain/openai)
- Firebase/Firestore for data persistence

### Data Flow
1. User selects a topic
2. System generates experts with opposing viewpoints
3. Background knowledge is retrieved for experts
4. Context management system initializes
5. Initial expert statements are generated
6. User adds perspective through UI
7. Turn-based debate continues with context awareness

## Next Steps

### Serverless Migration Plan

#### Phase 1: User Authentication & Profiles

1. **Authentication System**
   - Implement Auth0 or NextAuth.js for serverless authentication
   - Create login/signup flows with social login options
   - Design user profile page with customization options
   - Set up JWT token handling for serverless functions

2. **User Profile Data Schema**
   ```typescript
   interface UserProfile {
     id: string;
     email: string;
     name: string;
     profilePicture?: string;
     preferences: {
       defaultExpertType: 'historical' | 'domain';
       useVoiceSynthesis: boolean;
       theme: 'light' | 'dark' | 'system';
     }
   }
   ```

#### Phase 2: Database & Persistence Layer

1. **Choose Serverless Database**
   - **Primary DB**: Firestore/DynamoDB for document-based storage
   - **Considerations**: Scaling, cold starts, query patterns

2. **Data Schema Design**
   ```typescript
   // Debate history schema
   interface SavedDebate {
     id: string;
     userId: string;
     topic: string;
     experts: Expert[];
     messages: Message[];
     expertType: 'historical' | 'domain';
     createdAt: Date;
     updatedAt: Date; // Updated field name for consistency
     status: string;
     isFavorite: boolean;
     tags?: string[];
     summary?: string;
     context?: DebateContext; // Added for LangChain context
   }
   ```

3. **Data Access Layer**
   - Create abstraction for database operations
   - Implement CRUD operations for debates
   - Set up indexes for efficient queries

#### Phase 3: Serverless Functions

1. **Auth-Protected API Routes**
   - Convert current `/api/debate` to authenticated endpoint
   - Add user context to all API calls

2. **New Endpoints**
   ```
   /api/debates             # List user's debates
   /api/debates/[id]        # Get/update specific debate
   /api/favorites           # Manage favorite debates
   /api/user/preferences    # Update user preferences
   ```

3. **Optimize for Cold Starts**
   - Split large functions into smaller ones
   - Implement connection pooling for database
   - Use provisioned concurrency for critical paths

#### Phase 4: Frontend Enhancements

1. **User Dashboard**
   - Recent debates list
   - Favorites section
   - Topic recommendations

2. **Persistence Controls**
   - "Save Debate" button
   - Auto-save functionality
   - Export/share options

3. **History & Favorites UI**
   ```jsx
   <DebateHistory 
     debates={userDebates}
     onSelect={loadDebate}
     onDelete={deleteDebate}
     onToggleFavorite={toggleFavorite}
   />
   ```

### Implementation Staging

#### Stage 1: Foundation (Weeks 1-2)
- Set up authentication
- Create database schemas
- Implement basic user profiles

#### Stage 2: Core Functionality (Weeks 3-4)
- Debate persistence
- History & favorites
- User preferences

#### Stage 3: Enhanced Features (Weeks 5-6)
- Dashboard & analytics
- Sharing functionality
- Optimizations & performance

### Technical Architecture

### Key Considerations

1. **Stateless Design**
   - Move from client-state to server-persisted state
   - Ensure all functions can run independently

2. **Cost Optimization**
   - Implement tiered usage limits
   - Consider caching for expensive operations
   - Monitor API call volume to OpenAI/ElevenLabs

3. **Security**
   - Secure user data with proper encryption
   - Implement rate limiting
   - Add API key rotation 

## Resilience Improvement Plan

Based on our recent fixes addressing API connectivity issues, we've identified several areas for improvement to make the application more resilient:

### Phase 1: Enhanced Offline Capabilities

1. **Expand Mock Data Library**
   - Create a comprehensive library of mock experts for various topics
   - Develop more sophisticated response generation for offline mode
   - Add high-quality sample debates for common topics

2. **Improve Error Detection**
   - Implement network status monitoring
   - Add proactive API availability checking
   - Create a centralized error tracking system

3. **Graceful Degradation Strategy**
   ```typescript
   interface DegradationStrategy {
     level: 'full' | 'partial' | 'minimal';
     features: {
       expertGeneration: boolean;
       responseGeneration: boolean;
       voiceSynthesis: boolean;
       topicExtraction: boolean;
     }
     fallbacks: {
       experts: Expert[];
       responses: (topic: string, message: string) => string;
       voices: VoiceAlternative[];
     }
   }
   ```

### Phase 2: Improved API Resilience

1. **Circuit Breaker Pattern**
   - Implement circuit breakers for each API endpoint
   - Add automatic fallback to offline mode when APIs are down
   - Create recovery mechanisms when APIs become available again

2. **Request Retry with Exponential Backoff**
   ```typescript
   async function resilientFetch(url, options, maxRetries = 3) {
     let retries = 0;
     while (retries < maxRetries) {
       try {
         return await fetch(url, options);
       } catch (error) {
         retries++;
         if (retries >= maxRetries) throw error;
         // Exponential backoff: 200ms, 400ms, 800ms, etc.
         await new Promise(r => setTimeout(r, 200 * Math.pow(2, retries - 1)));
       }
     }
   }
   ```

3. **API Health Monitoring**
   - Create a lightweight health check system
   - Implement API availability dashboards
   - Set up alerting for persistent API issues

### Phase 3: User Experience Enhancements

1. **Transparent Error Communication**
   - Design user-friendly error messages
   - Add visual indicators for degraded functionality
   - Provide clear instructions for offline capabilities

2. **Progressive Enhancement**
   - Build core features to work without API dependencies
   - Add enhanced features when APIs are available
   - Implement feature toggles for graceful feature management

3. **Feedback Loop**
   - Add telemetry for error tracking
   - Implement user feedback for error scenarios
   - Create automated error reporting

### Implementation Timeline

#### Short-term (1-2 weeks)
- Expand mock data library
- Implement basic circuit breaker pattern
- Add user-friendly error messages

#### Medium-term (3-4 weeks)
- Create comprehensive retry mechanisms
- Implement API health monitoring
- Design graceful degradation strategies

#### Long-term (1-2 months)
- Build telemetry and analytics for error tracking
- Create full offline mode with sophisticated features
- Implement automatic recovery procedures

### Technical Architecture

```