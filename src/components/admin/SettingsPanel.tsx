 // src/components/admin/SettingsPanel.tsx - COMPLETE UPDATED VERSION
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000/api';
const token = localStorage.getItem('adminToken') || '';

interface Settings {
  shortener_base: string;
  shortener_api_key: string;
  auto_shorten_links: string;
}

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    shortener_base: '',
    shortener_api_key: '',
    auto_shorten_links: 'true'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const keys = ['shortener_base', 'shortener_api_key', 'auto_shorten_links'];
      
      const settingsData: any = {};
      for (const key of keys) {
        try {
          const { data } = await axios.get(`${API_BASE}/admin/settings/${key}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          settingsData[key] = data.value || '';
        } catch (err) {
          console.log(`Setting ${key} not found, using default`);
          settingsData[key] = '';
        }
      }
      
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage('');
    try {
      console.log('💾 Saving settings:', settings);
      
      // Save all settings
      for (const [key, value] of Object.entries(settings)) {
        await axios.put(
          `${API_BASE}/admin/protected/settings/${key}`,
          { value: String(value) },
          { 
            headers: { 
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            } 
          }
        );
      }
      
      setMessage('✅ Settings saved successfully! Auto-shortening is now ENABLED!');
      
      // ✅ IMPORTANT: Force enable auto-shortening after save
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      setMessage(`❌ Failed to save settings: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestShortener = async () => {
    try {
      setTestResult('🔄 Testing Cuty.io connection...');
      
      const testUrl = 'https://example.com/test-anime-episode';
      const response = await axios.post(`${API_BASE}/admin/protected/test-shortener`,
        { testUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setTestResult(`✅ ${response.data.message}\nShortened: ${response.data.shortenedUrl}`);
      } else {
        setTestResult(`❌ ${response.data.message}`);
      }
    } catch (err: any) {
      setTestResult(`❌ Test failed: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-white mb-6">Link Shortener Settings</h2>

      <div className="space-y-6">
        {/* Link Shortener Settings */}
        <div className="bg-slate-700/50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">🔗 Link Shortener Configuration</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Shortener Base URL *
              </label>
              <input
                type="url"
                value={settings.shortener_base}
                onChange={(e) => setSettings({ ...settings, shortener_base: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
                placeholder="https://api.cuty.io/api/shorten"  // ✅ CORRECT ENDPOINT
              />
              <p className="text-slate-400 text-sm mt-1">
                Supported services: cuty.io, tinyurl.com, etc.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                API Key (Optional)
              </label>
              <input
                type="password"
                value={settings.shortener_api_key}
                onChange={(e) => setSettings({ ...settings, shortener_api_key: e.target.value })}
                className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2 focus:ring-purple-500 focus:border-purple-500 transition"
                placeholder="Your API key for premium features"
              />
              <p className="text-slate-400 text-sm mt-1">
                Required for custom slugs and analytics
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_shorten"
                checked={settings.auto_shorten_links === 'true'}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  auto_shorten_links: e.target.checked ? 'true' : 'false' 
                })}
                className="w-4 h-4 text-purple-600 bg-slate-800 border-slate-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="auto_shorten" className="text-sm text-slate-300">
                Automatically shorten new episode/chapter links
              </label>
            </div>
          </div>
        </div>

        {/* Test Section */}
        <div className="bg-blue-600/20 p-6 rounded-lg border border-blue-500/30">
          <h3 className="text-lg font-semibold text-blue-400 mb-4">🧪 Test Shortener</h3>
          
          <div className="space-y-3">
            <button
              onClick={handleTestShortener}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition"
            >
              Test Link Shortener
            </button>
            
            {testResult && (
              <div className={`p-3 rounded-lg text-sm ${
                testResult.includes('✅') 
                  ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-600/20 text-red-400 border border-red-500/30'
              }`}>
                {testResult}
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-lg transition w-full"
        >
          {loading ? 'Saving...' : '💾 Save All Settings'}
        </button>

        {message && (
          <div className={`p-4 rounded-lg ${
            message.includes('✅') 
              ? 'bg-green-600/20 text-green-400 border border-green-500/30' 
              : 'bg-red-600/20 text-red-400 border border-red-500/30'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 bg-slate-800/50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">📖 How It Works</h3>
        <ul className="text-slate-300 space-y-2 text-sm">
          <li>• Set your preferred shortener service (cuty.io recommended)</li>
          <li>• Enable auto-shortening for automatic link conversion</li>
          <li>• New episodes/chapters will automatically get shortened links</li>
          <li>• Use bulk action to process existing content</li>
          <li>• Changing services? Update base URL and run bulk action</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPanel;