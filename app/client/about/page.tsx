'use client';
import { motion } from 'framer-motion';
import { Heart, Mail, Phone, Calendar, Users, QrCode, MessageCircle, Shield, Award, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const features = [
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: 'WhatsApp & SMS Invitations',
      description: 'Send beautiful invitations via WhatsApp or SMS with real‑time delivery tracking.',
    },
    {
      icon: <QrCode className="w-6 h-6" />,
      title: 'QR Code Check‑In',
      description: 'Guests check in instantly using unique QR codes – no paper lists, no delays.',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Guest Management',
      description: 'Import, segment, and manage your guest list with ease. Track RSVPs and dietary preferences.',
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: 'Event Dashboard',
      description: 'Real‑time overview of check‑ins, guest counts, and event analytics at a glance.',
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Secure & Private',
      description: 'Your data is encrypted and stored securely. Only you and your team have access.',
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: 'Custom Invitation Cards',
      description: 'Design personalized digital cards that match your wedding theme perfectly.',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
      `}</style>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0D4F4F] via-[#0A3D3D] to-[#082E2E] text-white">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#E8A598] rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#E8A598] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 lg:py-28 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <Heart className="w-4 h-4 text-[#E8A598]" />
              <span className="text-sm font-medium">Built for Tanzanian weddings</span>
            </div>
            {/* Logo image instead of text */}
            <img
              src="/_Little Wed Logo.svg"
              alt="Little Wed"
              className="h-20 md:h-24 lg:h-24 w-auto mx-auto mb-4"
            />
            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto">
              The complete wedding management platform for modern couples and event planners.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 lg:py-20">
        {/* Mission Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center mb-20"
        >
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Our <span className="text-[#0D4F4F]">Mission</span>
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-[#0D4F4F] to-[#E8A598] mx-auto rounded-full mb-6" />
          <p className="text-gray-600 max-w-3xl mx-auto text-lg leading-relaxed">
            We believe every couple deserves a stress‑free wedding planning experience. 
            LittleWed brings together guest management, invitations, and real‑time check‑ins 
            into one beautiful platform – so you can focus on what truly matters.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="mb-20">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            What <span className="text-[#0D4F4F]">You Get</span>
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-[#0D4F4F] to-[#E8A598] mx-auto rounded-full mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0D4F4F]/10 to-[#E8A598]/10 flex items-center justify-center text-[#0D4F4F] group-hover:scale-105 transition-transform mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-100"
        >
          <div className="grid md:grid-cols-2 gap-0">
            <div className="bg-gradient-to-br from-[#0D4F4F] to-[#0A3D3D] p-8 md:p-10 text-white">
              <h3 className="font-serif text-2xl font-bold mb-3">Need Help?</h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                Our support team is here to assist you with any questions about the platform, event setup, or technical issues.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Phone className="w-4 h-4 text-[#E8A598]" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Call / WhatsApp</p>
                    <p className="font-medium">+255 769 999 902</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-[#E8A598]" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60">Email</p>
                    <p className="font-medium">hello@littlewed.com</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-8 md:p-10 bg-gray-50">
              <h3 className="font-serif text-2xl font-bold text-gray-800 mb-4">Get in Touch</h3>
              <p className="text-gray-600 mb-6">
                Whether you're planning your own wedding or helping clients, we'd love to hear from you.
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#0D4F4F] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">Response time:</span> Within 24 hours on business days.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Heart className="w-5 h-5 text-[#0D4F4F] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600">
                    We speak <span className="font-semibold">English</span> and <span className="font-semibold">Swahili</span>.
                  </p>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 text-[#0D4F4F] font-semibold hover:gap-3 transition-all"
                >
                  Send us a message →
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer Note */}
        <div className="text-center mt-12 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} LittleWed – Beautiful weddings, perfectly managed.</p>
        </div>
      </div>
    </div>
  );
}