const fs = require('fs');
const path = require('path');

console.log('🤖 VSA Chat Assistant Setup');
console.log('============================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✅ .env file found');
  
  // Read and check if API key is set
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('REACT_APP_OPENAI_API_KEY=') && !envContent.includes('your_openai_api_key_here')) {
    console.log('✅ OpenAI API key appears to be configured');
  } else {
    console.log('⚠️  OpenAI API key not configured in .env file');
    console.log('   Please add: REACT_APP_OPENAI_API_KEY=your_actual_api_key');
  }
} else {
  console.log('❌ .env file not found');
  console.log('   Creating .env file template...');
  
  const envTemplate = `# OpenAI API Key for Chat Assistant
# Get your API key from: https://platform.openai.com/api-keys
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration (if not already set)
# REACT_APP_SUPABASE_URL=your_supabase_url
# REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
`;
  
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ .env file created with template');
  console.log('   Please edit .env and add your actual OpenAI API key');
}

console.log('\n📋 Next Steps:');
console.log('1. Get OpenAI API key from: https://platform.openai.com/api-keys');
console.log('2. Edit .env file and replace "your_openai_api_key_here" with your actual key');
console.log('3. Restart the development server (npm start)');
console.log('4. Test the chat assistant by clicking the 💬 button');

console.log('\n💡 Note: The chat assistant will work with basic responses even without the API key!');
