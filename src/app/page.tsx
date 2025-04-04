import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Mic, MessageSquare, Brain, BookOpen, Users, Lightbulb, RefreshCw, FileText } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col overflow-auto bg-gray-700">
      <AppHeader currentPage="home" />

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4 text-center bg-black">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6">
            Debate with AI Experts</h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto mb-10 text-gray-300">
            Upload content or specify a topic to create a debate between AI experts with opposing perspectives.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/app/debate">
              <Button size="lg" className="rounded-full px-8">
                Start Debating
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg" className="rounded-full px-8">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-4 md:px-8 lg:py-24 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-bold mb-4 text-white">Powerful Features for Enriching Debates</h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              Everything you need to engage in high-quality intellectual discourse with AI-powered experts
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <MessageSquare className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">AI-Powered Expert Debates</h3>
              <p className="text-sm text-blue-200">
                Engage with AI-generated historical and modern experts who debate your topics with authentic perspectives and specialized knowledge.
              </p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <Mic className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Voice Synthesis & Input</h3>
              <p className="text-sm text-blue-200">
                Listen to expert voices through AI speech synthesis and participate in debates using your own voice with speech-to-text technology.
              </p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <FileText className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Content Upload & Analysis</h3>
              <p className="text-sm text-blue-200">
                Upload documents, articles, and research papers to extract debate topics and have experts analyze the key points automatically.
              </p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <Brain className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Critical Thinking Enhancement</h3>
              <p className="text-sm text-blue-200">
                Break through confirmation bias by exploring multiple perspectives, strengthening your ability to analyze complex topics.
              </p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <RefreshCw className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Dynamic Debate Adaptation</h3>
              <p className="text-sm text-blue-200">
                Debates evolve based on your input, with experts responding to your arguments and challenging your perspective in real-time.
              </p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <Lightbulb className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Debate Summaries & Insights</h3>
              <p className="text-sm text-blue-200">
                Get comprehensive summaries of key points from both sides, helping you synthesize information and form well-rounded conclusions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 px-4 md:px-8 lg:py-24 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              Start engaging in intellectually stimulating debates in four simple steps
            </p>
          </div>

          {/* Desktop view - horizontal steps */}
          <div className="hidden md:flex justify-between items-center w-full mb-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center z-10 w-1/4 px-2">
              <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">1</div>
              <h3 className="text-lg font-semibold mb-2">Enter Your Topic</h3>
              <p className="text-sm text-gray-300">
                Submit a debate topic or upload a document to extract key discussion points.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center z-10 w-1/4 px-2">
              <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">2</div>
              <h3 className="text-lg font-semibold mb-2">AI Selects Experts</h3>
              <p className="text-sm text-gray-300">
                Our AI selects the most relevant figures to debate your topic from different perspectives.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center z-10 w-1/4 px-2">
              <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">3</div>
              <h3 className="text-lg font-semibold mb-2">Debate Begins</h3>
              <p className="text-sm text-gray-300">
                Listen to or read as expert opinions unfold in a dynamic, authentic debate.
              </p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center z-10 w-1/4 px-2">
              <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">4</div>
              <h3 className="text-lg font-semibold mb-2">Participate & Learn</h3>
              <p className="text-sm text-gray-300">
                Join the conversation with your own perspectives and challenge the experts.
              </p>
            </div>

            {/* Connecting line between steps */}
            <div className="absolute top-6 left-0 w-full h-1 bg-gray-700" style={{ zIndex: 1 }}></div>
          </div>

          {/* Mobile view - vertical steps */}
          <div className="grid grid-cols-1 gap-8 md:hidden">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">1</div>
              <h3 className="text-lg font-semibold mb-2">Enter Your Topic</h3>
              <p className="text-sm text-gray-300">
                Submit a debate topic or upload a document to extract key discussion points automatically.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">2</div>
              <h3 className="text-lg font-semibold mb-2">AI Selects Experts</h3>
              <p className="text-sm text-gray-300">
                Our AI selects the most relevant historical or contemporary figures to debate your topic from different perspectives.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">3</div>
              <h3 className="text-lg font-semibold mb-2">Debate Begins</h3>
              <p className="text-sm text-gray-300">
                Listen to or read as expert opinions unfold in a dynamic, authentic debate based on their real-life views and expertise.
              </p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-base mb-4">4</div>
              <h3 className="text-lg font-semibold mb-2">Participate & Learn</h3>
              <p className="text-sm text-gray-300">
                Join the conversation with your own perspectives and challenge the experts, refining your understanding and critical thinking.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-16 px-4 md:px-8 lg:py-24 bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-bold mb-4 text-white">Transformative Use Cases</h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              Discover how Debate-able enhances learning, critical thinking, and idea development across various domains
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <Brain className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Critical Thinking Development</h3>
              <p className="text-sm text-blue-200 mb-4">
                Break through confirmation bias by exploring opposing viewpoints on complex topics, challenging your assumptions and strengthening your analytical skills.
              </p>
              <p className="text-xs font-medium text-blue-100">Example debate: <span className="text-green-400">"Is artificial intelligence a threat or a tool for progress?"</span> with Alan Turing vs. Elon Musk</p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <BookOpen className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Academic & Learning Enhancement</h3>
              <p className="text-sm text-blue-200 mb-4">
                Enhance your understanding of philosophy, politics, ethics, and history by engaging with the greatest minds across different eras on important topics.
              </p>
              <p className="text-xs font-medium text-blue-100">Example debate: <span className="text-green-400">"Should we have universal basic income?"</span> with Karl Marx vs. Milton Friedman</p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <FileText className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Writing & Idea Refinement</h3>
              <p className="text-sm text-blue-200 mb-4">
                Perfect for authors, debaters, and thinkers refining arguments for essays or books, exposing you to nuanced perspectives you might not have considered.
              </p>
              <p className="text-xs font-medium text-blue-100">Example debate: <span className="text-green-400">"Would Shakespeare approve of AI-generated poetry?"</span> with Shakespeare vs. an AI model</p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <Lightbulb className="h-8 w-8 text-blue-300 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-white">Creative Problem-Solving</h3>
              <p className="text-sm text-blue-200 mb-4">
                Apply expert perspectives to business strategy, technology, or future trends, gaining insights from different disciplines and approaches.
              </p>
              <p className="text-xs font-medium text-blue-100">Example debate: <span className="text-green-400">"What's the best way to colonize Mars?"</span> with Elon Musk vs. Carl Sagan</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 md:px-8 lg:py-24 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-bold mb-4">What Users Are Saying</h2>
            <p className="text-base text-gray-300 max-w-2xl mx-auto">
              See how Debate-able is transforming the way people learn and think
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center mr-4">
                  <Users className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">Sarah Johnson</p>
                  <p className="text-xs text-blue-200">Graduate Student</p>
                </div>
              </div>
              <p className="text-sm text-blue-200">
                "Debate-able has completely transformed my research process. Being able to hear Einstein and Bohr debate quantum theory helped me understand complex concepts in a way textbooks never could."
              </p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center mr-4">
                  <Users className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">Michael Chen</p>
                  <p className="text-xs text-blue-200">Professor</p>
                </div>
              </div>
              <p className="text-sm text-blue-200">
                "I've incorporated Debate-able into my political science curriculum. Having students witness virtual debates between historical figures adds a dimension to learning that was previously impossible."
              </p>
            </div>

            <div className="bg-blue-900 p-6 rounded-lg shadow-sm border border-blue-800">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-700 flex items-center justify-center mr-4">
                  <Users className="h-5 w-5 text-blue-300" />
                </div>
                <div>
                  <p className="font-semibold text-white">David Williams</p>
                  <p className="text-xs text-blue-200">Author & Podcaster</p>
                </div>
              </div>
              <p className="text-sm text-blue-200">
                "As someone who interviews experts for a living, Debate-able has become my secret weapon for preparation. I can simulate debates on complex topics before speaking with real experts."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="start-debating" className="py-16 px-4 md:px-8 lg:py-24 bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Transform Your Thinking?</h2>
          <p className="text-lg text-gray-300 mb-8">
            Join thousands of students, professionals, and curious minds expanding their intellectual horizons through AI-powered debates.
          </p>
          <Button size="lg" className="bg-green-500 hover:bg-green-600 text-white px-8">
            <Link href="/app/debate">Start Debating Now</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-12 px-4 text-gray-300">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-white mb-4">Debate-able</h3>
            <p className="text-sm mb-4">
              Leveraging AI to create meaningful intellectual discourse and enhance critical thinking across disciplines.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Links</h4>
            <ul className="space-y-2">
              <li><Link href="#features" className="text-sm hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#how-it-works" className="text-sm hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="#use-cases" className="text-sm hover:text-white transition-colors">Use Cases</Link></li>
              <li><Link href="/app/debate" className="text-sm hover:text-white transition-colors">Start Debating</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="text-sm hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="#" className="text-sm hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm hover:text-white transition-colors">Data Usage</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Connect</h4>
            <ul className="space-y-2">
              <li><Link href="#" className="text-sm hover:text-white transition-colors">Twitter</Link></li>
              <li><Link href="#" className="text-sm hover:text-white transition-colors">LinkedIn</Link></li>
              <li><Link href="#" className="text-sm hover:text-white transition-colors">Email</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-gray-800 text-sm text-center">
          © {new Date().getFullYear()} Debate-able. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
