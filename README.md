# VSA Website

A modern, responsive website for the Vietnamese Student Association (VSA) built with React, TypeScript, and Supabase.

## 🚀 Features

- **Modern UI/UX**: Built with React 18, TypeScript, and Tailwind CSS
- **Authentication**: Secure user authentication with Supabase Auth
- **Event Management**: Create, manage, and display events with attendance tracking
- **Points System**: Gamified points system for member engagement
- **Admin Dashboard**: Comprehensive admin panel for content management
- **Chat Assistant**: AI-powered chat assistant for member support
- **Feedback System**: Collect and manage member feedback
- **Responsive Design**: Mobile-first design that works on all devices
- **Real-time Updates**: Live data synchronization with Supabase

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel, Docker, Kubernetes
- **Monitoring**: Prometheus, Grafana
- **Infrastructure**: Terraform, AWS

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- npm or yarn
- Git
- Supabase CLI (optional, for local development)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/vsa-website.git
cd vsa-website
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory and add the following variables:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: OpenAI API Key for chat assistant
REACT_APP_OPENAI_API_KEY=your_openai_api_key
```

**⚠️ Security Note**: Never commit `.env` files to version control. The `.env.example` file is provided as a template.

### 4. Database Setup

1. Set up a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration files in the `supabase/migrations/` directory
3. Configure your Supabase URL and API keys in the `.env.local` file

### 5. Start Development Server

```bash
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000).

## 📁 Project Structure

```
vsa-website/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Admin/          # Admin-specific components
│   │   ├── Auth/           # Authentication components
│   │   ├── Chat/           # Chat assistant components
│   │   └── ui/             # Base UI components
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React context providers
│   ├── lib/                # Utility libraries
│   ├── types/              # TypeScript type definitions
│   └── data/               # Data access layer
├── supabase/               # Supabase configuration and migrations
├── infrastructure/         # Terraform infrastructure code
├── k8s/                   # Kubernetes deployment files
├── monitoring/            # Monitoring configuration
└── docs/                  # Documentation
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Docker

```bash
# Build the Docker image
docker build -t vsa-website .

# Run the container
docker run -p 3000:3000 vsa-website
```

### Kubernetes

```bash
# Apply Kubernetes configurations
kubectl apply -f k8s/
```

## 🔧 Available Scripts

- `npm start` - Start development server
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run eject` - Eject from Create React App (not recommended)

## 🔒 Security

- All API keys and sensitive data are stored in environment variables
- `.env` files are gitignored and never committed
- Supabase handles authentication and authorization
- All user inputs are validated and sanitized

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@vsa-website.com or create an issue in the GitHub repository.

## 🙏 Acknowledgments

- [Create React App](https://github.com/facebook/create-react-app)
- [Supabase](https://supabase.com)
- [Tailwind CSS](https://tailwindcss.com)
- [React](https://reactjs.org)

---

**Note**: This README is automatically updated. For the most current information, always refer to the latest version in the repository.