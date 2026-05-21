
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Brain, Shield, Zap, LayoutTemplate, MonitorSmartphone, Download, Globe } from 'lucide-react';
import logo from './assets/logo.png';
import './App.css';

const GithubIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
    <path d="M9 18c-4.51 2-5-2-7-2"/>
  </svg>
);

function App() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
  };

  const features = [
    {
      icon: <Zap className="text-blue-400" size={24} />,
      title: t('features.local_first_title'),
      desc: t('features.local_first_desc'),
    },
    {
      icon: <Brain className="text-purple-400" size={24} />,
      title: t('features.ai_copilot_title'),
      desc: t('features.ai_copilot_desc'),
    },
    {
      icon: <Shield className="text-green-400" size={24} />,
      title: t('features.privacy_title'),
      desc: t('features.privacy_desc'),
    },
    {
      icon: <LayoutTemplate className="text-orange-400" size={24} />,
      title: t('features.modern_ui_title'),
      desc: t('features.modern_ui_desc'),
    },
    {
      icon: <MonitorSmartphone className="text-pink-400" size={24} />,
      title: t('features.cross_platform_title'),
      desc: t('features.cross_platform_desc'),
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5 } }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-50 overflow-x-hidden selection:bg-blue-500/30">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 border-x-0 border-t-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <img src={logo} alt="LibrisArk Logo" className="w-8 h-8 object-contain rounded-md" />
            LibrisArk
          </div>
          <div className="flex items-center gap-6 text-sm font-medium">
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors cursor-pointer">
              <Globe size={16} />
              {i18n.language === 'zh' ? 'English' : '中文'}
            </button>
            <a href="https://github.com/yvonshong/LibrisArk" target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-white transition-colors">
              <GithubIcon size={20} />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-6">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6">
              <span className="gradient-text">{t('hero.title')}</span>
            </h1>
            <p className="text-xl lg:text-2xl text-neutral-300 font-medium mb-4 max-w-2xl mx-auto">
              {t('hero.subtitle')}
            </p>
            <p className="text-base text-neutral-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              {t('hero.description')}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a 
                href="https://github.com/yvonshong/LibrisArk/releases/latest" 
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              >
                <Download size={20} />
                {t('hero.cta_download')}
              </a>
              <a 
                href="https://github.com/yvonshong/LibrisArk" 
                target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-8 py-4 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-all hover:scale-105 active:scale-95"
              >
                <GithubIcon size={20} />
                {t('hero.cta_github')}
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-neutral-900/30 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feat, i) => (
              <motion.div 
                key={i}
                variants={itemVariants}
                className="glass-panel p-8 rounded-2xl hover:bg-white/[0.05] transition-colors group cursor-default"
              >
                <div className="w-12 h-12 rounded-xl bg-neutral-800/80 flex items-center justify-center mb-6 border border-neutral-700/50 group-hover:scale-110 transition-transform">
                  {feat.icon}
                </div>
                <h3 className="text-lg font-semibold mb-3 text-neutral-100">{feat.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 text-center text-sm text-neutral-500 border-t border-neutral-800">
        <p>© {new Date().getFullYear()} LibrisArk. {t('footer.rights')}</p>
      </footer>
    </div>
  );
}

export default App;
